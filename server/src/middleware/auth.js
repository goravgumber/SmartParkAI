import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { prisma } from '../db.js'

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token missing. Use Bearer <token>.',
      code: 401
    })
  }

  const token = authHeader.split(' ')[1]

  let decoded
  try {
    decoded = jwt.verify(token, config.jwtSecret)
  } catch (error) {
    const isExpired = error?.name === 'TokenExpiredError'
    return res.status(401).json({
      success: false,
      error: isExpired ? 'Token has expired. Please login again.' : 'Invalid authentication token.',
      code: 401
    })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    })
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Account no longer exists. Please login again.',
        code: 401
      })
    }
    req.user = user
    return next()
  } catch (error) {
    return next(error)
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: insufficient permissions.',
        code: 403
      })
    }
    return next()
  }
}
