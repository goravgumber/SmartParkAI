import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis
const rawConnectionString = process.env.DATABASE_URL

if (!rawConnectionString) {
  throw new Error('DATABASE_URL is required to initialize Prisma.')
}

function buildPoolConfig(connectionString) {
  try {
    const parsed = new URL(connectionString)
    const isRenderHost = parsed.hostname.endsWith('.render.com')
    const sslMode = parsed.searchParams.get('sslmode')
    const requiresSsl = isRenderHost && sslMode !== 'disable'

    const poolConfig = { connectionString }
    if (requiresSsl) {
      // Render Postgres requires TLS. This keeps local development unchanged.
      poolConfig.ssl = { rejectUnauthorized: false }
    }
    return poolConfig
  } catch {
    return { connectionString }
  }
}

if (!globalForPrisma.prisma) {
  const adapter = new PrismaPg(buildPoolConfig(rawConnectionString))
  globalForPrisma.prisma = new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma
