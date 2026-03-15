import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

let latestSlotData = {
  available: 0,
  occupied: 0,
  reserved: 0,
  total: 0,
  timestamp: null
}

async function refreshLatestSlotData() {
  const [available, occupied, reserved, total] = await Promise.all([
    prisma.parkingSlot.count({ where: { status: 'AVAILABLE' } }),
    prisma.parkingSlot.count({ where: { status: 'OCCUPIED' } }),
    prisma.parkingSlot.count({ where: { status: 'RESERVED' } }),
    prisma.parkingSlot.count()
  ])

  latestSlotData = {
    available,
    occupied,
    reserved,
    total,
    timestamp: new Date()
  }

  return latestSlotData
}

router.post('/incoming', async (req, res) => {
  try {
    console.log('[Calling] Incoming call received')
    res.status(200).type('text/plain').send('OK')
  } catch (error) {
    console.error('[Calling] incoming error:', error)
    res.status(200).type('text/plain').send('OK')
  }
})

router.post('/gather', async (req, res) => {
  try {
    const available = await prisma.parkingSlot.count({ where: { status: 'AVAILABLE' } })
    const occupied = await prisma.parkingSlot.count({ where: { status: 'OCCUPIED' } })
    const reserved = await prisma.parkingSlot.count({ where: { status: 'RESERVED' } })
    const total = await prisma.parkingSlot.count()

    latestSlotData = {
      available,
      occupied,
      reserved,
      total,
      timestamp: new Date()
    }

    console.log('[Calling] Live slots - AVL:', available, 'OCC:', occupied)
    res.status(200).send(`Abhi ${available} parking slots khaali hain, aur ${occupied} slots bhar gaye hain. Dhanyavaad!`)
  } catch (error) {
    console.error('[Calling] gather error:', error)
    res.status(200).send('Sorry, data fetch mein problem hai. Baad mein try karein.')
  }
})

router.get('/status', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: latestSlotData
    })
  } catch (error) {
    console.error('[Calling] status error:', error)
    res.status(200).json({
      success: true,
      data: latestSlotData
    })
  }
})

router.post('/test', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Calling routes working'
    })
  } catch (error) {
    console.error('[Calling] test error:', error)
    res.status(200).json({
      success: true,
      message: 'Calling routes working'
    })
  }
})

export default router
