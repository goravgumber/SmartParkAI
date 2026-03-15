import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { authMiddleware, requireRoles } from '../middleware/auth.js'
import { getIO } from '../socket.js'
import { validateBody, validateQuery } from '../middleware/validate.js'

const router = Router()

const summaryCache = new Map()
const SUMMARY_TTL_MS = 30 * 1000
const VALID_SLOT_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED']
const ALLOWED_SLOT_TRANSITIONS = {
  AVAILABLE: ['RESERVED', 'OCCUPIED', 'DISABLED'],
  RESERVED: ['AVAILABLE', 'OCCUPIED', 'DISABLED'],
  OCCUPIED: ['AVAILABLE', 'DISABLED'],
  DISABLED: ['AVAILABLE']
}
const slotStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED'])
})
const slotFilterSchema = z.object({
  zone: z.string().trim().max(16).optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED']).optional()
})

function buildFacilitySummaryFromSlots(slots) {
  const total = slots.length
  const available = slots.filter((slot) => slot.status === 'AVAILABLE').length
  const occupied = slots.filter((slot) => slot.status === 'OCCUPIED').length
  const reserved = slots.filter((slot) => slot.status === 'RESERVED').length

  return {
    total,
    available,
    occupied,
    reserved,
    occupancyRate: total ? Number(((occupied / total) * 100).toFixed(2)) : 0,
    lastUpdated: new Date().toISOString()
  }
}

router.get('/facilities', async (req, res, next) => {
  try {
    const facilities = await prisma.facility.findMany({
      include: {
        zones: {
          include: {
            slots: {
              select: { status: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    const data = facilities.map((facility) => {
      const slots = facility.zones.flatMap((zone) => zone.slots)
      const summary = buildFacilitySummaryFromSlots(slots)

      return {
        id: facility.id,
        name: facility.name,
        address: facility.address,
        totalSlots: facility.totalSlots,
        zoneCount: facility.zones.length,
        available: summary.available,
        occupied: summary.occupied,
        reserved: summary.reserved
      }
    })

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.get('/facilities/:id', async (req, res, next) => {
  try {
    const facility = await prisma.facility.findUnique({
      where: { id: req.params.id },
      include: {
        zones: {
          include: {
            slots: {
              select: {
                id: true,
                status: true,
                slotType: true
              }
            }
          },
          orderBy: { name: 'asc' }
        }
      }
    })

    if (!facility) {
      const error = new Error('Facility not found.')
      error.statusCode = 404
      throw error
    }

    const zones = facility.zones.map((zone) => {
      const total = zone.slots.length
      const available = zone.slots.filter((slot) => slot.status === 'AVAILABLE').length
      const occupied = zone.slots.filter((slot) => slot.status === 'OCCUPIED').length
      const reserved = zone.slots.filter((slot) => slot.status === 'RESERVED').length
      const disabled = zone.slots.filter((slot) => slot.status === 'DISABLED').length

      return {
        id: zone.id,
        name: zone.name,
        code: zone.code,
        capacity: zone.capacity,
        ratePerHour: zone.ratePerHour,
        total,
        available,
        occupied,
        reserved,
        disabled
      }
    })

    res.json({
      success: true,
      data: {
        id: facility.id,
        name: facility.name,
        address: facility.address,
        city: facility.city,
        totalSlots: facility.totalSlots,
        lat: facility.lat,
        lng: facility.lng,
        zones
      }
    })
  } catch (error) {
    next(error)
  }
})

router.get('/facilities/:id/slots', validateQuery(slotFilterSchema), async (req, res, next) => {
  try {
    const { zone, status } = req.query
    const facilityId = req.params.id

    const where = {
      zone: {
        facilityId,
        ...(zone
          ? {
              OR: [
                { code: String(zone).toUpperCase() },
                { name: { contains: String(zone), mode: 'insensitive' } }
              ]
            }
          : {})
      },
      ...(status ? { status: String(status).toUpperCase() } : {})
    }

    const slots = await prisma.parkingSlot.findMany({
      where,
      include: {
        zone: {
          select: {
            id: true,
            name: true,
            code: true,
            ratePerHour: true,
            facility: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true
              }
            }
          }
        }
      },
      orderBy: { slotCode: 'asc' }
    })

    res.json({ success: true, data: slots })
  } catch (error) {
    next(error)
  }
})

router.get('/slots/:id', async (req, res, next) => {
  try {
    const slot = await prisma.parkingSlot.findUnique({
      where: { id: req.params.id },
      include: {
        zone: {
          include: {
            facility: true
          }
        }
      }
    })

    if (!slot) {
      const error = new Error('Parking slot not found.')
      error.statusCode = 404
      throw error
    }

    res.json({ success: true, data: slot })
  } catch (error) {
    next(error)
  }
})

router.put('/slots/:id/status', authMiddleware, requireRoles('OWNER', 'ADMIN'), validateBody(slotStatusSchema), async (req, res, next) => {
  try {
    const { status } = req.body
    const normalizedStatus = String(status || '').toUpperCase()

    if (!VALID_SLOT_STATUSES.includes(normalizedStatus)) {
      const error = new Error('Invalid slot status provided.')
      error.statusCode = 400
      throw error
    }

    const existingSlot = await prisma.parkingSlot.findUnique({
      where: { id: req.params.id },
      include: {
        zone: {
          include: {
            facility: true
          }
        }
      }
    })
    if (!existingSlot) {
      const error = new Error('Parking slot not found.')
      error.statusCode = 404
      throw error
    }
    const allowedNext = ALLOWED_SLOT_TRANSITIONS[existingSlot.status] || []
    if (!allowedNext.includes(normalizedStatus)) {
      const error = new Error(`Invalid slot transition from ${existingSlot.status} to ${normalizedStatus}.`)
      error.statusCode = 409
      throw error
    }

    const updatedSlot = await prisma.parkingSlot.update({
      where: { id: req.params.id },
      data: { status: normalizedStatus },
      include: {
        zone: {
          include: {
            facility: true
          }
        }
      }
    })

    const payload = {
      slotId: updatedSlot.id,
      status: updatedSlot.status,
      slotCode: updatedSlot.slotCode,
      zone: updatedSlot.zone.name,
      facilityId: updatedSlot.zone.facilityId
    }

    const io = getIO()
    if (io) {
      io.to(updatedSlot.zone.facilityId).emit('slot:updated', payload)
    }

    summaryCache.delete(updatedSlot.zone.facilityId)

    res.json({ success: true, data: updatedSlot })
  } catch (error) {
    if (error.code === 'P2025') {
      error.statusCode = 404
      error.message = 'Parking slot not found.'
    }
    next(error)
  }
})

router.get('/summary/:facilityId', async (req, res, next) => {
  try {
    const { facilityId } = req.params
    const now = Date.now()
    const cached = summaryCache.get(facilityId)

    if (cached && now - cached.timestamp < SUMMARY_TTL_MS) {
      return res.json({
        success: true,
        data: cached.data
      })
    }

    const slots = await prisma.parkingSlot.findMany({
      where: {
        zone: {
          facilityId
        }
      },
      select: {
        status: true
      }
    })

    if (slots.length === 0) {
      const facility = await prisma.facility.findUnique({ where: { id: facilityId } })
      if (!facility) {
        const error = new Error('Facility not found.')
        error.statusCode = 404
        throw error
      }
    }

    const data = buildFacilitySummaryFromSlots(slots)
    summaryCache.set(facilityId, {
      data,
      timestamp: now
    })

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

export default router
