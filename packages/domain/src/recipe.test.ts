import { describe, it, expect } from 'vitest'
import type { Nutrients } from './nutrition'
import { rollUpRecipe } from './recipe'

const chicken: Nutrients = { kcal: 165, proteinG: 31, fatG: 3.6, carbG: 0, fiberG: 0, saltG: 0.2 }
const rice: Nutrients = { kcal: 130, proteinG: 2.7, fatG: 0.3, carbG: 28, fiberG: 0.4, saltG: 0 }

describe('rollUpRecipe', () => {
  const rollup = rollUpRecipe(
    [
      { per100g: chicken, gramsResolved: 200 }, // 2×
      { per100g: rice, gramsResolved: 150 }, // 1.5×
    ],
    2,
  )

  it('computes each ingredient contribution', () => {
    expect(rollup.ingredients[0]!.kcal).toBeCloseTo(330) // 165 × 2
    expect(rollup.ingredients[1]!.kcal).toBeCloseTo(195) // 130 × 1.5
  })

  it('total equals the sum of ingredient contributions', () => {
    const summed = rollup.ingredients.reduce((a, b) => a + b.kcal, 0)
    expect(rollup.total.kcal).toBeCloseTo(summed)
    expect(rollup.total.kcal).toBeCloseTo(525)
    expect(rollup.total.proteinG).toBeCloseTo(31 * 2 + 2.7 * 1.5)
  })

  it('per-serving × servings reconstructs the total (round-trip)', () => {
    expect(rollup.perServing.kcal * 2).toBeCloseTo(rollup.total.kcal)
    expect(rollup.perServing.proteinG * 2).toBeCloseTo(rollup.total.proteinG)
    expect(rollup.perServing.carbG * 2).toBeCloseTo(rollup.total.carbG)
  })

  it('rejects non-positive servings', () => {
    expect(() => rollUpRecipe([], 0)).toThrow(RangeError)
  })

  it('rolls an empty ingredient list up to zero', () => {
    const empty = rollUpRecipe([], 1)
    expect(empty.total).toEqual({ kcal: 0, proteinG: 0, fatG: 0, carbG: 0, fiberG: 0, saltG: 0 })
  })
})
