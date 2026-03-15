import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { authMiddleware, requireRoles } from '../middleware/auth.js'
import { getIO } from '../socket.js'
import { validateBody, validateQuery } from '../middleware/validate.js'

const router = Router()
const listQuerySchema = z.object({
  facilityId: z.string().uuid().optional(),
  severity: z.enum(['CRITICAL', 'WARNING', 'INFO']).optional(),
  resolved: z.enum(['true', 'false']).optional()
})
const createAlertSchema = z.object({
  facilityId: z.string().uuid(),
  severity: z.enum(['CRITICAL', 'WARNING', 'INFO']),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(5).max(500)
})

router.get('/', authMiddleware, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { facilityId, severity, resolved } = req.query

    const where = {
      ...(facilityId ? { facilityId: String(facilityId) } : {}),
      ...(severity ? { severity: String(severity).toUpperCase() } : {}),
      ...(typeof resolved !== 'undefined' ? { isResolved: String(resolved) === 'true' } : {})
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    res.json({ success: true, data: alerts })
  } catch (error) {
    next(error)
  }
})

router.post('/', authMiddleware, requireRoles('OWNER', 'ADMIN'), validateBody(createAlertSchema), async (req, res, next) => {
  try {
    const { facilityId, severity, title, description } = req.body

    const alert = await prisma.alert.create({
      data: {
        facilityId,
        severity: String(severity).toUpperCase(),
        title,
        description
      }
    })

    const io = getIO()
    if (io) {
      io.to(facilityId).emit('alert:new', alert)
    }

    res.status(201).json({ success: true, data: alert })
  } catch (error) {
    next(error)
  }
})

router.put('/:id/resolve', authMiddleware, requireRoles('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: { isResolved: true }
    })

    const io = getIO()
    if (io) {
      io.to(alert.facilityId).emit('alert:resolved', alert)
    }

    res.json({ success: true, data: alert })
  } catch (error) {
    if (error.code === 'P2025') {
      error.statusCode = 404
      error.message = 'Alert not found.'
    }
    next(error)
  }
})

export default router
