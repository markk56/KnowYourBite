import { Router } from 'express'
import { err, ok, usdaSearchQuerySchema } from '@kyb/shared'
import { UsdaNormalizationError } from '@kyb/domain'
import { resolveFood, searchFoods, toUsdaFoodDto } from './cache'
import { usdaRateLimit } from './rateLimit'

/**
 * USDA routes — mounted at `/api/v1/usda` behind requireAuth + per-tenant rate
 * limit. Cache-first: `/search` degrades to cached-only when USDA is unreachable;
 * `/food/:fdcId` writes through so a later add is a cache hit. Malformed/
 * implausible upstream data is rejected (400), never persisted.
 */
export function createUsdaRouter(): Router {
  const router = Router()
  router.use(usdaRateLimit)

  router.get('/search', (req, res, next) => {
    void (async () => {
      const parsed = usdaSearchQuerySchema.safeParse({
        query: typeof req.query.query === 'string' ? req.query.query : '',
        includeBranded: req.query.includeBranded === 'true' ? true : undefined,
        pageSize: typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : undefined,
      })
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid search', parsed.error.flatten()))
        return
      }
      const result = await searchFoods(parsed.data.query, {
        includeBranded: parsed.data.includeBranded,
        pageSize: parsed.data.pageSize,
      })
      res.json(ok(result))
    })().catch(next)
  })

  router.get('/food/:fdcId', (req, res, next) => {
    void (async () => {
      const fdcId = Number(req.params.fdcId)
      if (!Number.isInteger(fdcId) || fdcId <= 0) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid fdcId'))
        return
      }
      try {
        const resolved = await resolveFood(fdcId)
        if (!resolved) {
          res.status(404).json(err('NOT_FOUND', 'Food unavailable'))
          return
        }
        res.json(ok({ food: toUsdaFoodDto(resolved.food, resolved.cached) }))
      } catch (e) {
        if (e instanceof UsdaNormalizationError) {
          res.status(400).json(err('VALIDATION_ERROR', 'Food data could not be used'))
          return
        }
        throw e
      }
    })().catch(next)
  })

  return router
}
