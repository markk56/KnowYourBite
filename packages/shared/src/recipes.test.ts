import { describe, it, expect } from 'vitest'
import {
  addIngredientInputSchema,
  aiAllergenProposalSchema,
  recipeCreateInputSchema,
  recipeExportInputSchema,
  ALLERGENS,
  INGREDIENT_UNITS,
} from './recipes'

describe('recipeCreateInputSchema', () => {
  it('requires a title and defaults servings to 1', () => {
    const parsed = recipeCreateInputSchema.parse({ title: 'Soup' })
    expect(parsed.servings).toBe(1)
  })

  it('rejects an empty title', () => {
    expect(recipeCreateInputSchema.safeParse({ title: '' }).success).toBe(false)
  })

  it('coerces empty optional text to undefined', () => {
    const parsed = recipeCreateInputSchema.parse({ title: 'Soup', notes: '' })
    expect(parsed.notes).toBeUndefined()
  })
})

describe('addIngredientInputSchema', () => {
  it('accepts a gram amount without extra context', () => {
    expect(addIngredientInputSchema.safeParse({ fdcId: 1, amount: 200, unit: 'g' }).success).toBe(true)
  })

  it('requires a density for volume units', () => {
    const res = addIngredientInputSchema.safeParse({ fdcId: 1, amount: 1, unit: 'cup' })
    expect(res.success).toBe(false)
    expect(addIngredientInputSchema.safeParse({ fdcId: 1, amount: 1, unit: 'cup', densityGPerMl: 1 }).success).toBe(true)
  })

  it('requires grams-per-piece for the piece unit', () => {
    expect(addIngredientInputSchema.safeParse({ fdcId: 1, amount: 2, unit: 'piece' }).success).toBe(false)
    expect(
      addIngredientInputSchema.safeParse({ fdcId: 1, amount: 2, unit: 'piece', gramsPerPiece: 50 }).success,
    ).toBe(true)
  })

  it('rejects non-positive amounts', () => {
    expect(addIngredientInputSchema.safeParse({ fdcId: 1, amount: 0, unit: 'g' }).success).toBe(false)
  })
})

describe('recipeExportInputSchema', () => {
  it('accepts a positive servings count', () => {
    expect(recipeExportInputSchema.parse({ servings: 4 }).servings).toBe(4)
  })
  it('rejects zero servings', () => {
    expect(recipeExportInputSchema.safeParse({ servings: 0 }).success).toBe(false)
  })
})

describe('aiAllergenProposalSchema (additive-only)', () => {
  it('has no removals field — only additions', () => {
    const parsed = aiAllergenProposalSchema.parse({ additions: ['milk'], removals: ['gluten'] } as unknown)
    expect(parsed).not.toHaveProperty('removals')
    expect(parsed.additions).toEqual(['milk'])
  })

  it('defaults additions to an empty array', () => {
    expect(aiAllergenProposalSchema.parse({}).additions).toEqual([])
  })

  it('rejects an unknown allergen', () => {
    expect(aiAllergenProposalSchema.safeParse({ additions: ['fish'] }).success).toBe(false)
  })
})

describe('enum alignment', () => {
  it('has seven major allergens', () => {
    expect(ALLERGENS).toHaveLength(7)
  })
  it('ingredient units include grams', () => {
    expect(INGREDIENT_UNITS).toContain('g')
  })
})
