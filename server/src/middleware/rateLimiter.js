import rateLimit from 'express-rate-limit'
import { config } from '../config.js'

export const generalRateLimit = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  skip: () => config.nodeEnv !== 'production',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please retry later.',
    code: 429
  }
})

export const authRateLimit = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.authRateLimitMax,
  skip: () => config.nodeEnv !== 'production',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait and try again.',
    code: 429
  }
})
