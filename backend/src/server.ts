import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

import { testConnection } from './config/database'
import { errorHandler }   from './middleware/errorHandler'

import authRoutes          from './routes/auth.routes'
import ticketsRoutes       from './routes/tickets.routes'
import usersRoutes         from './routes/users.routes'
import interventionsRoutes from './routes/interventions.routes'
import zonesRoutes         from './routes/zones.routes'
import analyticsRoutes     from './routes/analytics.routes'
import notificationsRoutes from './routes/notifications.routes'

dotenv.config()

const app  = express()
const PORT = Number(process.env.PORT ?? 4000)

// ── Security & logging ───────────────────────────────────────
app.use(helmet())

const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001']

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ── Rate limiting ────────────────────────────────────────────
app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  })
)
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 200 }))

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',          authRoutes)
app.use('/api/tickets',       ticketsRoutes)
app.use('/api/users',         usersRoutes)
app.use('/api/interventions', interventionsRoutes)
app.use('/api/zones',         zonesRoutes)
app.use('/api/analytics',     analyticsRoutes)
app.use('/api/notifications', notificationsRoutes)

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV })
})

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' })
})

// ── Error handler ────────────────────────────────────────────
app.use(errorHandler)

// ── Start ────────────────────────────────────────────────────
async function start() {
  await testConnection()
  app.listen(PORT, () => {
    console.log(`[SERVER] SIGDI API running on http://localhost:${PORT}`)
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV ?? 'development'}`)
  })
}

start().catch(err => {
  console.error('[FATAL]', err)
  process.exit(1)
})

export default app