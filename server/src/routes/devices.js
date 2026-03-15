import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { getIO } from '../socket.js'
import { config } from '../config.js'
import { validateBody, validateQuery } from '../middleware/validate.js'

const router = Router()
const listQuerySchema = z.object({
  facilityId: z.string().uuid().optional()
})
const heartbeatSchema = z.object({
  cpuPercent: z.number().min(0).max(100),
  ramPercent: z.number().min(0).max(100),
  temperature: z.number().min(-20).max(120),
  ipAddress: z.string().trim().max(64).optional().default('')
})

function verifyDeviceIngestion(req, res, next) {
  if (!config.deviceApiKey) {
    if (config.nodeEnv === 'production') {
      return res.status(503).json({
        success: false,
        error: 'Device ingestion key is not configured.',
        code: 503
      })
    }
    return next()
  }

  const key = req.header('x-device-key')
  if (!key || key !== config.deviceApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid device API key.',
      code: 401
    })
  }
  return next()
}

router.get('/', authMiddleware, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { facilityId } = req.query

    const devices = await prisma.device.findMany({
      where: {
        ...(facilityId ? { facilityId: String(facilityId) } : {})
      },
      orderBy: [{ status: 'asc' }, { deviceCode: 'asc' }]
    })

    res.json({ success: true, data: devices })
  } catch (error) {
    next(error)
  }
})

router.put('/:id/heartbeat', verifyDeviceIngestion, validateBody(heartbeatSchema), async (req, res, next) => {
  try {
    const { cpuPercent, ramPercent, temperature, ipAddress } = req.body

    const device = await prisma.device.update({
      where: { id: req.params.id },
      data: {
        cpuPercent: Number(cpuPercent ?? 0),
        ramPercent: Number(ramPercent ?? 0),
        temperature: Number(temperature ?? 0),
        ipAddress: ipAddress || '',
        lastPingAt: new Date(),
        status: 'ONLINE'
      }
    })

    let generatedAlert = null
    if (device.cpuPercent > 85 || device.temperature > 78) {
      generatedAlert = await prisma.alert.create({
        data: {
          facilityId: device.facilityId,
          severity: 'WARNING',
          title: `Device threshold alert: ${device.deviceCode}`,
          description: `CPU ${device.cpuPercent}% / Temp ${device.temperature}C crossed threshold.`
        }
      })

      const io = getIO()
      if (io) {
        io.to(device.facilityId).emit('alert:new', generatedAlert)
      }
    }

    res.json({
      success: true,
      data: {
        ...device,
        generatedAlert
      }
    })
  } catch (error) {
    if (error.code === 'P2025') {
      error.statusCode = 404
      error.message = 'Device not found.'
    }
    next(error)
  }
})

router.get('/stats', authMiddleware, async (req, res, next) => {
  try {
    const [total, online, offline, maintenance] = await Promise.all([
      prisma.device.count(),
      prisma.device.count({ where: { status: 'ONLINE' } }),
      prisma.device.count({ where: { status: 'OFFLINE' } }),
      prisma.device.count({ where: { status: 'MAINTENANCE' } })
    ])

    res.json({
      success: true,
      data: {
        total,
        online,
        offline,
        maintenance
      }
    })
  } catch (error) {
    next(error)
  }
})

export default router
