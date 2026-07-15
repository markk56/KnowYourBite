import { Router } from 'express'
import { ok } from '@kyb/shared'
import { createAuthRouter } from '../auth/routes'
import { createClientsRouter } from '../clients/routes'
import { createAssessmentsRouter } from '../assessments/routes'
import { requireAuth } from '../middleware/tenant'

/**
 * Versioned API root (`/api/v1`). Product module routers (clients, recipes,
 * planning, settings) mount here as they land — each tenant-scoped.
 */
export function createApiRouter(): Router {
  const router = Router()

  router.get('/ping', (_req, res) => {
    res.json(ok({ pong: true }))
  })

  router.use('/auth', createAuthRouter())
  // requireAuth stays at the mount point so every client route is gated and
  // req.tenantId is populated before the handlers run.
  router.use('/clients', requireAuth, createClientsRouter())
  // Assessments hang off a client: /clients/:clientId/assessments/*
  router.use('/clients/:clientId/assessments', requireAuth, createAssessmentsRouter())

  return router
}
