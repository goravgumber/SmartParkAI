import { Router } from 'express'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { authMiddleware, requireRoles } from '../middleware/auth.js'
import { getIO } from '../socket.js'
import { validateBody, validateQuery } from '../middleware/validate.js'

const router = Router()

const createReservationSchema = z.object({
  slotId: z.string().trim().uuid(),
  vehicleNumber: z.string().trim().min(6).max(20),
  driverName: z.string().trim().min(2).max(80),
  driverPhone: z.string().trim().min(8).max(20),
  durationHours: z.number().int().min(1).max(12),
  paymentMethod: z.enum(['UPI', 'CARD', 'CASH']).default('UPI'),
  startTime: z.string().datetime()
})

const reservationQuerySchema = z.object({
  status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  page: z
    .string()
    .regex(/^\d+$/)
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
})

function generateReservationCode() {
  return `SPK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

function calculatePricing(ratePerHour, durationHours) {
  const baseAmount = Number((ratePerHour * durationHours).toFixed(2))
  const serviceFee = Number((baseAmount * 0.1).toFixed(2))
  const gst = Number(((baseAmount + serviceFee) * 0.18).toFixed(2))
  const totalAmount = Number((baseAmount + serviceFee + gst).toFixed(2))
  return { baseAmount, serviceFee, gst, totalAmount }
}

async function emitSlotUpdated(slot) {
  const io = getIO()
  if (!io) return

  io.to(slot.zone.facilityId).emit('slot:updated', {
    slotId: slot.id,
    status: slot.status,
    slotCode: slot.slotCode,
    zone: slot.zone.name,
    facilityId: slot.zone.facilityId
  })
}

router.post('/', authMiddleware, validateBody(createReservationSchema), async (req, res, next) => {
  try {
    const { slotId, vehicleNumber, driverName, driverPhone, durationHours, paymentMethod, startTime } = req.body

    const duration = Number(durationHours)

    const reservationStart = new Date(startTime)
    if (Number.isNaN(reservationStart.getTime())) {
      const error = new Error('startTime is invalid.')
      error.statusCode = 400
      throw error
    }

    const reservationEnd = new Date(reservationStart.getTime() + duration * 60 * 60 * 1000)

    let createdReservation = null
    let pricing = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        createdReservation = await prisma.$transaction(
          async (tx) => {
            const slot = await tx.parkingSlot.findUnique({
              where: { id: slotId },
              include: {
                zone: {
                  include: { facility: true }
                }
              }
            })

            if (!slot) {
              const error = new Error('Slot not found.')
              error.statusCode = 404
              throw error
            }

            if (slot.status !== 'AVAILABLE') {
              const error = new Error('Slot is not available for booking.')
              error.statusCode = 409
              throw error
            }

            const conflict = await tx.reservation.findFirst({
              where: {
                slotId,
                status: { in: ['UPCOMING', 'ACTIVE'] },
                startTime: { lt: reservationEnd },
                endTime: { gt: reservationStart }
              }
            })
            if (conflict) {
              const error = new Error('Conflicting reservation already exists for this slot and time window.')
              error.statusCode = 409
              throw error
            }

            const lockUpdate = await tx.parkingSlot.updateMany({
              where: { id: slotId, status: 'AVAILABLE' },
              data: { status: 'RESERVED' }
            })
            if (lockUpdate.count !== 1) {
              const error = new Error('Slot was reserved by another request. Please retry.')
              error.statusCode = 409
              throw error
            }

            pricing = calculatePricing(slot.zone.ratePerHour, duration)
            const reservationCode = generateReservationCode()
            return tx.reservation.create({
              data: {
                reservationCode,
                slotId,
                userId: req.user.id,
                vehicleNumber,
                driverName,
                driverPhone,
                durationHours: duration,
                baseAmount: pricing.baseAmount,
                totalAmount: pricing.totalAmount,
                paymentMethod: paymentMethod || 'UPI',
                startTime: reservationStart,
                endTime: reservationEnd,
                status: 'UPCOMING'
              },
              include: {
                slot: {
                  include: {
                    zone: { include: { facility: true } }
                  }
                },
                user: {
                  select: { id: true, name: true, email: true, role: true }
                }
              }
            })
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        )
        break
      } catch (error) {
        const shouldRetry = (error?.code === 'P2034' || error?.code === 'P2002') && attempt < 2
        if (shouldRetry) continue
        throw error
      }
    }
    if (!createdReservation || !pricing) {
      const error = new Error('Unable to create reservation at this time.')
      error.statusCode = 500
      throw error
    }

    await emitSlotUpdated({
      id: createdReservation.slot.id,
      status: 'RESERVED',
      slotCode: createdReservation.slot.slotCode,
      zone: createdReservation.slot.zone
    })

    res.status(201).json({
      success: true,
      data: {
        ...createdReservation,
        pricing: {
          ...pricing
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

router.get('/', authMiddleware, validateQuery(reservationQuerySchema), async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : null
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100)
    const skip = (page - 1) * limit

    const where = {
      ...(status ? { status } : {}),
      ...(req.user.role === 'DRIVER' ? { userId: req.user.id } : {})
    }

    const [data, total] = await prisma.$transaction([
      prisma.reservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          slot: {
            include: {
              zone: {
                include: {
                  facility: true
                }
              }
            }
          }
        }
      }),
      prisma.reservation.count({ where })
    ])

    res.json({
      success: true,
      data: {
        data,
        total,
        page,
        limit
      }
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        slot: {
          include: {
            zone: {
              include: {
                facility: true
              }
            }
          }
        }
      }
    })

    if (!reservation) {
      const error = new Error('Reservation not found.')
      error.statusCode = 404
      throw error
    }

    if (req.user.role === 'DRIVER' && reservation.userId !== req.user.id) {
      const error = new Error('You are not allowed to view this reservation.')
      error.statusCode = 403
      throw error
    }

    res.json({ success: true, data: reservation })
  } catch (error) {
    next(error)
  }
})

router.put('/:id/cancel', authMiddleware, async (req, res, next) => {
  try {
    const existing = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: {
        slot: {
          include: {
            zone: true
          }
        }
      }
    })

    if (!existing) {
      const error = new Error('Reservation not found.')
      error.statusCode = 404
      throw error
    }

    if (req.user.role === 'DRIVER' && existing.userId !== req.user.id) {
      const error = new Error('You are not allowed to cancel this reservation.')
      error.statusCode = 403
      throw error
    }

    if (existing.status !== 'UPCOMING') {
      const error = new Error('Only UPCOMING reservations can be cancelled.')
      error.statusCode = 409
      throw error
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
        include: {
          slot: {
            include: {
              zone: {
                include: { facility: true }
              }
            }
          }
        }
      })

      await tx.parkingSlot.update({
        where: { id: reservation.slotId },
        data: { status: 'AVAILABLE' }
      })

      return reservation
    })

    await emitSlotUpdated({
      id: updated.slot.id,
      status: 'AVAILABLE',
      slotCode: updated.slot.slotCode,
      zone: updated.slot.zone
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

router.post('/:id/checkin', authMiddleware, requireRoles('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const reservation = await prisma.reservation.findUnique({ where: { id: req.params.id } })
    if (!reservation) {
      const error = new Error('Reservation not found.')
      error.statusCode = 404
      throw error
    }
    if (!['UPCOMING', 'ACTIVE'].includes(reservation.status)) {
      const error = new Error('Only UPCOMING reservations can be checked in.')
      error.statusCode = 409
      throw error
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReservation = await tx.reservation.update({
        where: { id: req.params.id },
        data: { status: 'ACTIVE' },
        include: {
          slot: {
            include: {
              zone: {
                include: {
                  facility: true
                }
              }
            }
          }
        }
      })

      await tx.parkingSlot.update({
        where: { id: updatedReservation.slotId },
        data: { status: 'OCCUPIED' }
      })

      return updatedReservation
    })

    await emitSlotUpdated({
      id: updated.slot.id,
      status: 'OCCUPIED',
      slotCode: updated.slot.slotCode,
      zone: updated.slot.zone
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

router.post('/:id/checkout', authMiddleware, requireRoles('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const reservation = await prisma.reservation.findUnique({ where: { id: req.params.id } })
    if (!reservation) {
      const error = new Error('Reservation not found.')
      error.statusCode = 404
      throw error
    }
    if (reservation.status !== 'ACTIVE') {
      const error = new Error('Only ACTIVE reservations can be checked out.')
      error.statusCode = 409
      throw error
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReservation = await tx.reservation.update({
        where: { id: req.params.id },
        data: { status: 'COMPLETED' },
        include: {
          slot: {
            include: {
              zone: {
                include: {
                  facility: true
                }
              }
            }
          }
        }
      })

      await tx.parkingSlot.update({
        where: { id: updatedReservation.slotId },
        data: { status: 'AVAILABLE' }
      })

      return updatedReservation
    })

    await emitSlotUpdated({
      id: updated.slot.id,
      status: 'AVAILABLE',
      slotCode: updated.slot.slotCode,
      zone: updated.slot.zone
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    next(error)
  }
})

export default router
