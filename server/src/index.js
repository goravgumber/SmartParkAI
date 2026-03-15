import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import http from 'http'
import jwt from 'jsonwebtoken'
import { Server } from 'socket.io'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import parkingRoutes from './routes/parking.js'
import reservationRoutes from './routes/reservations.js'
import analyticsRoutes from './routes/analytics.js'
import alertRoutes from './routes/alerts.js'
import callingRoutes from './routes/calling.js'
import deviceRoutes from './routes/devices.js'
import voiceRoutes from './routes/voice.js'
import simulationRoutes from './routes/simulation.js'
import { registerSocketHandlers, setIO } from './socket.js'
import { generalRateLimit } from './middleware/rateLimiter.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { prisma } from './db.js'

const app = express()
app.set('trust proxy', 1)

const httpServer = http.createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: config.frontendUrl
  },
  maxHttpBufferSize: 1e5
})
setIO(io, app)

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
)
app.use(
  cors({
    origin: process.env.FRONTEND_URL || config.frontendUrl,
    credentials: true
  })
)
app.use(generalRateLimit)
app.use(express.json({ limit: '50kb' }))
app.use(express.urlencoded({ extended: false }))
app.use((req, res, next) => {
  res.setHeader('Bypass-Tunnel-Reminder', 'true')
  next()
})

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/parking', parkingRoutes)
app.use('/api/reservations', reservationRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/devices', deviceRoutes)
app.use('/api/voice', voiceRoutes)
app.use('/api/calling', callingRoutes)
app.use('/api/simulation', simulationRoutes)

io.use((socket, next) => {
  try {
    const authToken = socket.handshake?.auth?.token
    const headerToken = socket.handshake?.headers?.authorization?.replace('Bearer ', '')
    const token = authToken || headerToken
    if (!token) {
      return next(new Error('Unauthorized socket connection.'))
    }
    const decoded = jwt.verify(token, config.jwtSecret)
    socket.data.user = decoded
    return next()
  } catch (_error) {
    return next(new Error('Unauthorized socket connection.'))
  }
})

registerSocketHandlers(io, prisma)

app.use(notFoundHandler)
app.use(errorHandler)

const PORT = process.env.PORT || 4000

httpServer.listen(PORT, () => {
  console.log(`SmartPark server listening on port ${PORT}`)
})

export { io }
