import { Router } from 'express'
import { ok } from '@kyb/shared'
import { createAuthRouter } from '../auth/routes'
import { createClientsRouter } from '../clients/routes'
import { createAssessmentsRouter } from '../assessments/routes'
import { createRecipesRouter } from '../recipes/routes'
import { createMealPlansRouter } from '../mealPlans/routes'
import { createUsdaRouter } from '../usda/routes'
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
  // Recipe library + USDA reference (Milestone 3).
  router.use('/usda', requireAuth, createUsdaRouter())
  router.use('/recipes', requireAuth, createRecipesRouter())
  // Meal planning (Milestone 4) — the flagship module.
  router.use('/meal-plans', requireAuth, createMealPlansRouter())

  return router
}
