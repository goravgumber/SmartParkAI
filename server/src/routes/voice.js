import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { validateBody } from '../middleware/validate.js'

const FACILITY_ID = '348efc36-7857-4569-a402-730186287dda'

const router = Router()

const voiceQuerySchema = z.object({
  text: z.string().trim().min(1).max(500),
  language: z.enum(['hi', 'en']).default('en')
})

const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many voice queries. Please retry shortly.',
    code: 429
  }
})

function detectIntent(text) {
  const lower = String(text || '').toLowerCase()
  const zonePatterns = [
    { pattern: /zone a|जोन ए/, label: 'Zone A' },
    { pattern: /zone b|जोन बी/, label: 'Zone B' },
    { pattern: /zone c|जोन सी/, label: 'Zone C' },
    { pattern: /vip/, label: 'VIP' },
    { pattern: /handicap/, label: 'Handicap' }
  ]

  const zone = zonePatterns.find((entry) => entry.pattern.test(lower))?.label || null

  if (['book', 'reserve', 'बुक', 'रिज़र्व'].some((word) => lower.includes(word))) {
    return { intent: 'RESERVATION', zone }
  }

  if (zone && ['status', 'available', 'full', 'खाली', 'kitni', 'jagah', 'bhar'].some((word) => lower.includes(word))) {
    return { intent: 'ZONE_STATUS', zone }
  }

  if (['available', 'occupied', 'slots', 'status', 'parking', 'खाली', 'उपलब्ध', 'कितने', 'kitne', 'full'].some((word) => lower.includes(word))) {
    return { intent: 'SLOT_STATUS', zone }
  }

  return { intent: 'GENERAL', zone }
}

async function getLiveParkingData() {
  const slots = await prisma.parkingSlot.findMany({
    where: {
      zone: {
        facilityId: FACILITY_ID
      }
    },
    include: {
      zone: true
    }
  })

  const available = slots.filter((slot) => slot.status === 'AVAILABLE').length
  const occupied = slots.filter((slot) => slot.status === 'OCCUPIED').length
  const reserved = slots.filter((slot) => slot.status === 'RESERVED').length
  const total = slots.length

  const zoneMap = {}
  slots.forEach((slot) => {
    const zoneName = slot.zone.name
    if (!zoneMap[zoneName]) {
      zoneMap[zoneName] = { available: 0, occupied: 0 }
    }
    if (slot.status === 'AVAILABLE') zoneMap[zoneName].available += 1
    if (slot.status === 'OCCUPIED') zoneMap[zoneName].occupied += 1
  })

  return {
    slots,
    available,
    occupied,
    reserved,
    total,
    zoneMap
  }
}

function buildFallbackMessage({ language, intent, zone, available, occupied, reserved, total, zoneMap }) {
  if (intent === 'ZONE_STATUS' && zone) {
    const current = zoneMap[zone] || { available: 0, occupied: 0 }
    return language === 'hi'
      ? `${zone} में अभी ${current.available} स्लॉट खाली हैं और ${current.occupied} भरे हुए हैं.`
      : `${zone} currently has ${current.available} available slots and ${current.occupied} occupied slots.`
  }

  if (intent === 'RESERVATION') {
    return language === 'hi'
      ? 'बुकिंग के लिए वेबसाइट पर available स्लॉट चुनें और reservation पूरा करें.'
      : 'To reserve a slot, open the website and choose any available slot.'
  }

  return language === 'hi'
    ? `अभी कुल ${total} स्लॉट में से ${available} खाली हैं, ${occupied} भरे हुए हैं और ${reserved} reserved हैं.`
    : `Out of ${total} total slots, ${available} are available, ${occupied} are occupied, and ${reserved} are reserved.`
}

router.post('/query', voiceLimiter, validateBody(voiceQuerySchema), async (req, res, next) => {
  try {
    const { text, language } = req.body
    const { intent, zone } = detectIntent(text)
    const { available, occupied, reserved, total, zoneMap } = await getLiveParkingData()

    let response = ''

    if (!process.env.ANTHROPIC_API_KEY) {
      response = buildFallbackMessage({ language, intent, zone, available, occupied, reserved, total, zoneMap })
    } else {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        })

        const message = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-5',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `You are SmartPark AI voice assistant for a parking facility in India.
Respond in ${language === 'hi' ? 'Hindi (Devanagari script)' : 'English'}.
Keep response SHORT - maximum 2 sentences. No markdown. No special characters.
Suitable for text-to-speech reading aloud.

REAL-TIME PARKING DATA:
Total slots: ${total}
Available: ${available}
Occupied: ${occupied}
Reserved: ${reserved}
Zone breakdown: ${JSON.stringify(zoneMap)}

User asked: "${text}"

Answer naturally and helpfully.`
            }
          ]
        })

        response = message.content?.[0]?.text?.trim() || buildFallbackMessage({ language, intent, zone, available, occupied, reserved, total, zoneMap })
      } catch (_error) {
        response = buildFallbackMessage({ language, intent, zone, available, occupied, reserved, total, zoneMap })
      }
    }

    res.json({
      success: true,
      data: {
        response,
        data: {
          available,
          occupied,
          reserved,
          total,
          zoneBreakdown: zoneMap
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

export default router
