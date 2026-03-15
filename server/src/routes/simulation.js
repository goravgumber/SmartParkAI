import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'

const router = Router()

const startSchema = z.object({
  facilityId: z.string().uuid(),
  intervalSeconds: z.number().int().min(1).max(60).default(5)
})

const piPayloadSchema = z.object({
  parking_id: z.string().min(1),
  device_id: z.string().min(1),
  timestamp: z.string().min(1),
  slots: z.record(z.string().regex(/^(available|occupied|reserved|disabled)$/i)),
  confidence: z.number().min(0).max(1).optional().default(0.9),
  device_health: z
    .object({
      cpuPercent: z.number().min(0).max(100).optional(),
      ramPercent: z.number().min(0).max(100).optional(),
      temperature: z.number().min(-20).max(120).optional(),
      ipAddress: z.string().max(64).optional(),
      status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE']).optional()
    })
    .optional()
})

const STATUS_MAP = {
  available: 'AVAILABLE',
  occupied: 'OCCUPIED',
  reserved: 'RESERVED',
  disabled: 'DISABLED'
}

const state = {
  isRunning: false,
  facilityId: null,
  updatesCount: 0,
  startedAt: null,
  lastPayloadAt: null,
  lastChangedCount: 0
}

async function notifyPiControl(path, method = 'POST') {
  const baseUrl = process.env.PI_CONTROL_URL
  if (!baseUrl) {
    console.warn(`[simulation] PI_CONTROL_URL is not configured, skipping ${path}`)
    return null
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, { method })
    return response
  } catch (error) {
    console.warn(`[simulation] Pi control request failed for ${path}:`, error?.message || error)
    return null
  }
}

async function buildLiveSummaryPayload(facilityId, changedCount) {
  const [available, occupied, reserved, disabled] = await Promise.all([
    prisma.parkingSlot.count({ where: { zone: { facilityId }, status: 'AVAILABLE' } }),
    prisma.parkingSlot.count({ where: { zone: { facilityId }, status: 'OCCUPIED' } }),
    prisma.parkingSlot.count({ where: { zone: { facilityId }, status: 'RESERVED' } }),
    prisma.parkingSlot.count({ where: { zone: { facilityId }, status: 'DISABLED' } })
  ])

  const total = available + occupied + reserved + disabled
  const occupancyRate = total ? Number(((occupied / total) * 100).toFixed(2)) : 0

  return {
    facilityId,
    total,
    available,
    occupied,
    reserved,
    disabled,
    occupancyRate,
    changedCount,
    updatesCount: state.updatesCount,
    timestamp: new Date().toISOString()
  }
}

function emitLiveSummary(io, facilityId, payload) {
  if (io) {
    io.to(facilityId).emit('occupancy:live', payload)
  }
}

function stopSimulationInterval() {
  state.isRunning = false
  state.facilityId = null
  state.startedAt = null
  state.lastChangedCount = 0
}

router.post('/start', authMiddleware, validateBody(startSchema), async (req, res, next) => {
  try {
    const { facilityId } = req.body

    const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true } })
    if (!facility) {
      const error = new Error('Facility not found.')
      error.statusCode = 404
      throw error
    }

    if (state.isRunning) {
      const error = new Error('Simulation is already running. Stop it before starting again.')
      error.statusCode = 409
      throw error
    }

    state.isRunning = true
    state.facilityId = facilityId
    state.startedAt = Date.now()
    state.updatesCount = 0
    state.lastPayloadAt = null
    state.lastChangedCount = 0
    await notifyPiControl('/start', 'POST')

    const io = req.app.get('io')
    if (io) {
      io.emit('simulation:started', {
        facilityId,
        timestamp: new Date().toISOString()
      })
    }

    res.json({
      success: true,
      data: {
        message: 'Pi camera active',
        facilityId
      }
    })
  } catch (error) {
    next(error)
  }
})

router.post('/stop', authMiddleware, async (req, res, next) => {
  try {
    const previousFacilityId = state.facilityId
    await notifyPiControl('/stop', 'POST')

    if (state.isRunning) {
      stopSimulationInterval()
    }

    const io = req.app.get('io')
    if (io) {
      io.emit('simulation:stopped', {
        facilityId: previousFacilityId,
        timestamp: new Date().toISOString()
      })
    }

    res.json({
      success: true,
      data: {
        message: 'Pi camera stopped'
      }
    })
  } catch (error) {
    next(error)
  }
})

router.post('/pi-payload', authMiddleware, validateBody(piPayloadSchema), async (req, res, next) => {
  try {
    const { parking_id: facilityId, device_id: deviceId, slots, device_health: deviceHealth } = req.body
    console.log('[Pi Payload] received:', JSON.stringify(slots))

    const facility = await prisma.facility.findUnique({ where: { id: facilityId }, select: { id: true } })
    if (!facility) {
      const error = new Error('Facility not found.')
      error.statusCode = 404
      throw error
    }

    const io = req.app.get('io')
    const slotEntries = Object.entries(slots)
    let slotsUpdated = 0

    for (const [slotCode, value] of slotEntries) {
      const mappedStatus = STATUS_MAP[String(value).toLowerCase()]
      if (!mappedStatus) continue

      const targetSlot = await prisma.parkingSlot.findFirst({
        where: {
          slotCode,
          zone: { facilityId }
        },
        include: {
          zone: { select: { id: true, facilityId: true } }
        }
      })
      if (!targetSlot) continue

      if (targetSlot.status !== mappedStatus) {
        await prisma.parkingSlot.update({
          where: { id: targetSlot.id },
          data: { status: mappedStatus }
        })

        if (io) {
          io.to(facilityId).emit('slot:updated', {
            slotId: targetSlot.id,
            slotCode: targetSlot.slotCode,
            status: mappedStatus,
            zoneId: targetSlot.zone.id,
            facilityId: targetSlot.zone.facilityId
          })
          console.log('[Pi Payload] emitted slot:updated for', slotCode, mappedStatus)
        }

        slotsUpdated += 1
      }
    }

    if (state.isRunning && state.facilityId === facilityId) {
      state.updatesCount += 1
      state.lastPayloadAt = new Date().toISOString()
      state.lastChangedCount = slotsUpdated
    }

    if (deviceHealth) {
      const device = await prisma.device.findFirst({
        where: {
          facilityId,
          OR: [{ id: deviceId }, { deviceCode: deviceId }]
        }
      })

      if (device) {
        await prisma.device.update({
          where: { id: device.id },
          data: {
            cpuPercent: deviceHealth.cpuPercent ?? device.cpuPercent,
            ramPercent: deviceHealth.ramPercent ?? device.ramPercent,
            temperature: deviceHealth.temperature ?? device.temperature,
            ipAddress: deviceHealth.ipAddress ?? device.ipAddress,
            status: deviceHealth.status ?? device.status,
            lastPingAt: new Date()
          }
        })
      }
    }

    const summaryPayload = await buildLiveSummaryPayload(facilityId, slotsUpdated)
    emitLiveSummary(io, facilityId, summaryPayload)
    console.log('[Pi Payload] emitted occupancy:live:', summaryPayload.available, 'available')

    res.json({
      success: true,
      data: {
        processed: true,
        slotsUpdated
      }
    })
  } catch (error) {
    next(error)
  }
})

router.get('/status', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        isRunning: state.isRunning,
        facilityId: state.facilityId,
        updatesCount: state.updatesCount,
        uptimeSeconds: state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0,
        lastPayloadAt: state.lastPayloadAt,
        lastChangedCount: state.lastChangedCount
      }
    })
  } catch (error) {
    next(error)
  }
})

export default router
