import { Router, type Response } from 'express'
import {
  addEntryInputSchema,
  addExtraInputSchema,
  addWindowInputSchema,
  err,
  mealPlanCreateInputSchema,
  mealPlanUpdateInputSchema,
  ok,
  plannerChatRequestSchema,
  statusForCode,
  updateEntryInputSchema,
  updateExtraInputSchema,
  updateWindowInputSchema,
} from '@kyb/shared'
import {
  addEntry,
  addExtra,
  addWindow,
  chatPlanner,
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  removeEntry,
  removeExtra,
  removeWindow,
  ServiceError,
  updateEntry,
  updateExtra,
  updatePlan,
  updateWindow,
} from './service'

/**
 * Meal-plans router — mounted at `/api/v1/meal-plans` behind requireAuth. Every
 * handler scopes to `req.tenantId`; unknown/other-tenant ids resolve to 404 via
 * the service (nested ownership is verified on the leaf). Nutrition is always
 * derived server-side from `@kyb/domain`.
 */
export function createMealPlansRouter(): Router {
  const router = Router()

  const handleServiceError = (res: Response, e: unknown): boolean => {
    if (e instanceof ServiceError) {
      res.status(statusForCode(e.code)).json(err(e.code, e.message))
      return true
    }
    return false
  }

  const run = (res: Response, next: (e: unknown) => void, fn: () => Promise<void>) => {
    fn().catch((e) => {
      if (!handleServiceError(res, e)) next(e)
    })
  }

  // ── Plans ───────────────────────────────────────────────────────────────────
  router.get('/', (req, res, next) => {
    run(res, next, async () => {
      const clientId = typeof req.query.clientId === 'string' && req.query.clientId ? req.query.clientId : undefined
      res.json(ok({ plans: await listPlans(req.tenantId!, clientId) }))
    })
  })

  router.post('/', (req, res, next) => {
    run(res, next, async () => {
      const parsed = mealPlanCreateInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid meal plan', parsed.error.flatten()))
        return
      }
      const plan = await createPlan(req.tenantId!, parsed.data)
      res.status(201).json(ok({ plan }))
    })
  })

  router.get('/:id', (req, res, next) => {
    run(res, next, async () => {
      res.json(ok({ plan: await getPlan(req.tenantId!, req.params.id) }))
    })
  })

  router.patch('/:id', (req, res, next) => {
    run(res, next, async () => {
      const parsed = mealPlanUpdateInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid update', parsed.error.flatten()))
        return
      }
      res.json(ok({ plan: await updatePlan(req.tenantId!, req.params.id, parsed.data) }))
    })
  })

  router.delete('/:id', (req, res, next) => {
    run(res, next, async () => {
      await deletePlan(req.tenantId!, req.params.id)
      res.json(ok({ success: true }))
    })
  })

  // ── Windows ─────────────────────────────────────────────────────────────────
  router.post('/:id/windows', (req, res, next) => {
    run(res, next, async () => {
      const parsed = addWindowInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid window', parsed.error.flatten()))
        return
      }
      res.status(201).json(ok({ plan: await addWindow(req.tenantId!, req.params.id, parsed.data) }))
    })
  })

  router.patch('/:id/windows/:windowId', (req, res, next) => {
    run(res, next, async () => {
      const parsed = updateWindowInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid window', parsed.error.flatten()))
        return
      }
      const plan = await updateWindow(req.tenantId!, req.params.id, req.params.windowId, parsed.data)
      res.json(ok({ plan }))
    })
  })

  router.delete('/:id/windows/:windowId', (req, res, next) => {
    run(res, next, async () => {
      const plan = await removeWindow(req.tenantId!, req.params.id, req.params.windowId)
      res.json(ok({ plan }))
    })
  })

  // ── Entries ─────────────────────────────────────────────────────────────────
  router.post('/:id/entries', (req, res, next) => {
    run(res, next, async () => {
      const parsed = addEntryInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid entry', parsed.error.flatten()))
        return
      }
      res.status(201).json(ok({ plan: await addEntry(req.tenantId!, req.params.id, parsed.data) }))
    })
  })

  router.patch('/:id/entries/:entryId', (req, res, next) => {
    run(res, next, async () => {
      const parsed = updateEntryInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid entry', parsed.error.flatten()))
        return
      }
      const plan = await updateEntry(req.tenantId!, req.params.id, req.params.entryId, parsed.data)
      res.json(ok({ plan }))
    })
  })

  router.delete('/:id/entries/:entryId', (req, res, next) => {
    run(res, next, async () => {
      const plan = await removeEntry(req.tenantId!, req.params.id, req.params.entryId)
      res.json(ok({ plan }))
    })
  })

  // ── Extras ──────────────────────────────────────────────────────────────────
  router.post('/:id/extras', (req, res, next) => {
    run(res, next, async () => {
      const parsed = addExtraInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid extra', parsed.error.flatten()))
        return
      }
      res.status(201).json(ok({ plan: await addExtra(req.tenantId!, req.params.id, parsed.data) }))
    })
  })

  router.patch('/:id/extras/:extraId', (req, res, next) => {
    run(res, next, async () => {
      const parsed = updateExtraInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid extra', parsed.error.flatten()))
        return
      }
      const plan = await updateExtra(req.tenantId!, req.params.id, req.params.extraId, parsed.data)
      res.json(ok({ plan }))
    })
  })

  router.delete('/:id/extras/:extraId', (req, res, next) => {
    run(res, next, async () => {
      const plan = await removeExtra(req.tenantId!, req.params.id, req.params.extraId)
      res.json(ok({ plan }))
    })
  })

  // ── AI planning chat (propose-only) ─────────────────────────────────────────
  router.post('/:id/chat', (req, res, next) => {
    run(res, next, async () => {
      const parsed = plannerChatRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid chat request', parsed.error.flatten()))
        return
      }
      const result = await chatPlanner(req.tenantId!, req.params.id, parsed.data.messages)
      res.json(ok(result))
    })
  })

  return router
}
