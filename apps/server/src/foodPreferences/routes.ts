import { Router } from 'express'
import { createFoodPreferenceSchema, err, ok, updateFoodPreferenceSchema } from '@kyb/shared'
import { foodPreferencesRepository, toFoodPreferenceDto } from './repository'

/**
 * Food-preference nomenclator — mounted at `/api/v1/food-preferences` behind
 * requireAuth. Pure tenant-scoped CRUD; the first GET seeds the starter lists.
 */
export function createFoodPreferencesRouter(): Router {
  const router = Router()

  router.get('/', (req, res, next) => {
    void (async () => {
      const rows = await foodPreferencesRepository.listSeeded(req.tenantId!)
      res.json(ok({ items: rows.map(toFoodPreferenceDto) }))
    })().catch(next)
  })

  router.post('/', (req, res, next) => {
    void (async () => {
      const parsed = createFoodPreferenceSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid food preference item', parsed.error.flatten()))
        return
      }
      const row = await foodPreferencesRepository.create(req.tenantId!, parsed.data)
      if (!row) {
        res.status(409).json(err('CONFLICT', 'An item with this name already exists in this category'))
        return
      }
      res.status(201).json(ok({ item: toFoodPreferenceDto(row) }))
    })().catch(next)
  })

  router.patch('/:id', (req, res, next) => {
    void (async () => {
      const parsed = updateFoodPreferenceSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid food preference item', parsed.error.flatten()))
        return
      }
      const existing = await foodPreferencesRepository.findById(req.tenantId!, req.params.id)
      if (!existing) {
        res.status(404).json(err('NOT_FOUND', 'Item not found'))
        return
      }
      const taken = await foodPreferencesRepository.labelTaken(
        req.tenantId!,
        existing.category,
        parsed.data.label,
        existing.id,
      )
      if (taken) {
        res.status(409).json(err('CONFLICT', 'An item with this name already exists in this category'))
        return
      }
      const row = await foodPreferencesRepository.rename(req.tenantId!, existing.id, parsed.data.label)
      if (row === 'duplicate') {
        res.status(409).json(err('CONFLICT', 'An item with this name already exists in this category'))
        return
      }
      if (!row) {
        res.status(404).json(err('NOT_FOUND', 'Item not found'))
        return
      }
      res.json(ok({ item: toFoodPreferenceDto(row) }))
    })().catch(next)
  })

  router.delete('/:id', (req, res, next) => {
    void (async () => {
      const removed = await foodPreferencesRepository.remove(req.tenantId!, req.params.id)
      if (!removed) {
        res.status(404).json(err('NOT_FOUND', 'Item not found'))
        return
      }
      res.json(ok({ success: true }))
    })().catch(next)
  })

  return router
}
