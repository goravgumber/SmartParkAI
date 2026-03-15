export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'smartpark_dev_secret_2024',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  mqttUrl: process.env.MQTT_URL || 'mqtt://localhost:1883',
  trustProxy: process.env.TRUST_PROXY === 'true',
  deviceApiKey: process.env.DEVICE_API_KEY || '',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 300,
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20
}
