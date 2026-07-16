import express, { type Express, type RequestHandler } from 'express'
import helmet from 'helmet'
import { ok } from '@kyb/shared'
import { createApiRouter } from './api/router'
import { apiNotFound } from './middleware/error'
import { passport } from './auth/passport'

export interface CreateAppOptions {
  /** Session middleware (Postgres-backed). Provided in index.ts and in auth integration tests. */
  sessionMiddleware?: RequestHandler
}

/**
 * Builds the Express app: security headers, JSON parsing, optional session +
 * passport, the health probe, and the versioned API. Pure and synchronous.
 * Without `sessionMiddleware` the auth routes' session features are inactive —
 * fine for health/ping unit tests. Web serving + the final error handler are
 * attached around this in index.ts.
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const app = express()
  app.disable('x-powered-by')
  // Behind the Replit TLS proxy — required for Secure cookies / correct IPs.
  app.set('trust proxy', 1)

  app.use(
    helmet({
      // Relaxed for the SPA + Vite HMR during M0; strict CSP is added later.
      contentSecurityPolicy: false,
    }),
  )
  // 4mb headroom for inline recipe cover photos (compressed to data URLs client-side).
  app.use(express.json({ limit: '4mb' }))

  if (options.sessionMiddleware) {
    app.use(options.sessionMiddleware)
    app.use(passport.initialize())
    app.use(passport.session())
  }

  app.get('/healthz', (_req, res) => {
    res.json(ok({ status: 'ok', service: 'know-your-bite' }))
  })

  app.use('/api/v1', createApiRouter())
  app.use('/api', apiNotFound)

  return app
}
