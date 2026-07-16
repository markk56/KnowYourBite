import { Router, type Response } from 'express'
import {
  addAllergenInputSchema,
  addIngredientInputSchema,
  confirmAllergenInputSchema,
  createCategoryInputSchema,
  err,
  ok,
  recipeCreateInputSchema,
  recipeExportInputSchema,
  recipeUpdateInputSchema,
  setRecipeCategoriesInputSchema,
  updateIngredientInputSchema,
  statusForCode,
  ALLERGENS,
  type Allergen,
  type RecipeListQuery,
} from '@kyb/shared'
import {
  addDietitianAllergen,
  addIngredient,
  confirmAllergen,
  createCategory,
  createRecipe,
  deleteRecipe,
  exportRecipe,
  getRecipe,
  listCategories,
  listRecipes,
  removeAllergen,
  removeIngredient,
  setRecipeCategories,
  ServiceError,
  suggestAllergens,
  updateIngredient,
  updateRecipe,
} from './service'

/**
 * Recipes router — mounted at `/api/v1/recipes` behind requireAuth. Every handler
 * scopes to `req.tenantId`; unknown/other-tenant ids resolve to 404 via the
 * service. Nutrition is always derived server-side from frozen snapshots.
 */
export function createRecipesRouter(): Router {
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

  const parseAllergen = (raw: string): Allergen | null =>
    (ALLERGENS as readonly string[]).includes(raw) ? (raw as Allergen) : null

  // ── Categories (declared before /:id to avoid shadowing) ─────────────────────
  router.get('/categories', (req, res, next) => {
    run(res, next, async () => {
      res.json(ok({ categories: await listCategories(req.tenantId!) }))
    })
  })

  router.post('/categories', (req, res, next) => {
    run(res, next, async () => {
      const parsed = createCategoryInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid category', parsed.error.flatten()))
        return
      }
      const category = await createCategory(req.tenantId!, parsed.data.kind, parsed.data.nameEn)
      res.status(201).json(ok({ category }))
    })
  })

  // ── Recipes ───────────────────────────────────────────────────────────────
  router.get('/', (req, res, next) => {
    run(res, next, async () => {
      const q: RecipeListQuery = {}
      if (typeof req.query.search === 'string' && req.query.search.trim()) q.search = req.query.search.trim()
      if (typeof req.query.categoryId === 'string' && req.query.categoryId) q.categoryId = req.query.categoryId
      const exclude = req.query.excludeAllergens
      if (typeof exclude === 'string' && exclude) {
        const parsed = exclude.split(',').map(parseAllergen).filter((a): a is Allergen => a !== null)
        if (parsed.length) q.excludeAllergens = parsed
      }
      res.json(ok({ recipes: await listRecipes(req.tenantId!, q) }))
    })
  })

  router.post('/', (req, res, next) => {
    run(res, next, async () => {
      const parsed = recipeCreateInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid recipe', parsed.error.flatten()))
        return
      }
      const recipe = await createRecipe(req.tenantId!, parsed.data)
      res.status(201).json(ok({ recipe }))
    })
  })

  router.get('/:id', (req, res, next) => {
    run(res, next, async () => {
      res.json(ok({ recipe: await getRecipe(req.tenantId!, req.params.id) }))
    })
  })

  router.patch('/:id', (req, res, next) => {
    run(res, next, async () => {
      const parsed = recipeUpdateInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid recipe', parsed.error.flatten()))
        return
      }
      res.json(ok({ recipe: await updateRecipe(req.tenantId!, req.params.id, parsed.data) }))
    })
  })

  router.delete('/:id', (req, res, next) => {
    run(res, next, async () => {
      await deleteRecipe(req.tenantId!, req.params.id)
      res.json(ok({ success: true }))
    })
  })

  // ── Ingredients ──────────────────────────────────────────────────────────────
  router.post('/:id/ingredients', (req, res, next) => {
    run(res, next, async () => {
      const parsed = addIngredientInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid ingredient', parsed.error.flatten()))
        return
      }
      res.status(201).json(ok({ recipe: await addIngredient(req.tenantId!, req.params.id, parsed.data) }))
    })
  })

  router.patch('/:id/ingredients/:ingredientId', (req, res, next) => {
    run(res, next, async () => {
      const parsed = updateIngredientInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid ingredient', parsed.error.flatten()))
        return
      }
      const recipe = await updateIngredient(req.tenantId!, req.params.id, req.params.ingredientId, parsed.data)
      res.json(ok({ recipe }))
    })
  })

  router.delete('/:id/ingredients/:ingredientId', (req, res, next) => {
    run(res, next, async () => {
      const recipe = await removeIngredient(req.tenantId!, req.params.id, req.params.ingredientId)
      res.json(ok({ recipe }))
    })
  })

  // ── Allergens ────────────────────────────────────────────────────────────────
  router.post('/:id/allergens', (req, res, next) => {
    run(res, next, async () => {
      const parsed = addAllergenInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid allergen', parsed.error.flatten()))
        return
      }
      res.json(ok({ recipe: await addDietitianAllergen(req.tenantId!, req.params.id, parsed.data.allergen) }))
    })
  })

  router.post('/:id/allergens/suggest', (req, res, next) => {
    run(res, next, async () => {
      const result = await suggestAllergens(req.tenantId!, req.params.id)
      const recipe = await getRecipe(req.tenantId!, req.params.id)
      res.json(ok({ result, recipe }))
    })
  })

  router.patch('/:id/allergens/:allergen', (req, res, next) => {
    run(res, next, async () => {
      const allergen = parseAllergen(req.params.allergen)
      if (!allergen) {
        res.status(400).json(err('VALIDATION_ERROR', 'Unknown allergen'))
        return
      }
      const parsed = confirmAllergenInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid body', parsed.error.flatten()))
        return
      }
      const recipe = await confirmAllergen(req.tenantId!, req.params.id, allergen, parsed.data.isConfirmed)
      res.json(ok({ recipe }))
    })
  })

  router.delete('/:id/allergens/:allergen', (req, res, next) => {
    run(res, next, async () => {
      const allergen = parseAllergen(req.params.allergen)
      if (!allergen) {
        res.status(400).json(err('VALIDATION_ERROR', 'Unknown allergen'))
        return
      }
      res.json(ok({ recipe: await removeAllergen(req.tenantId!, req.params.id, allergen) }))
    })
  })

  // ── Categories on a recipe ─────────────────────────────────────────────────
  router.put('/:id/categories', (req, res, next) => {
    run(res, next, async () => {
      const parsed = setRecipeCategoriesInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid categories', parsed.error.flatten()))
        return
      }
      const recipe = await setRecipeCategories(req.tenantId!, req.params.id, parsed.data.categoryIds)
      res.json(ok({ recipe }))
    })
  })

  // ── Export (scaled PDF, streamed) ──────────────────────────────────────────
  router.post('/:id/export', (req, res, next) => {
    run(res, next, async () => {
      const parsed = recipeExportInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid export options', parsed.error.flatten()))
        return
      }
      const { pdf, filename } = await exportRecipe(req.tenantId!, req.params.id, parsed.data, req.tenantId!)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(pdf)
    })
  })

  return router
}
