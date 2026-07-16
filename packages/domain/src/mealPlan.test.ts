import { describe, it, expect } from 'vitest'
import type { Nutrients } from './nutrition'
import {
  compareToTarget,
  mealEntryNutrients,
  mealExtraNutrients,
  rollUpMeals,
  sumMealNutrients,
  type MacroTarget,
} from './mealPlan'

// Recipe per-serving snapshots (already divided by servings upstream).
const oats: Nutrients = { kcal: 380, proteinG: 13, fatG: 6.5, carbG: 67, fiberG: 10, saltG: 0.02 }
const omelette: Nutrients = { kcal: 220, proteinG: 15, fatG: 16, carbG: 2, fiberG: 0, saltG: 0.6 }
// An extra: banana per-100g.
const banana: Nutrients = { kcal: 89, proteinG: 1.1, fatG: 0.3, carbG: 23, fiberG: 2.6, saltG: 0 }

describe('mealEntryNutrients', () => {
  it('scales a recipe per-serving by the serving multiplier', () => {
    const c = mealEntryNutrients(oats, 1.5)
    expect(c.kcal).toBeCloseTo(570) // 380 × 1.5
    expect(c.proteinG).toBeCloseTo(19.5)
    expect(c.carbG).toBeCloseTo(100.5)
  })

  it('rejects a non-positive multiplier (the DB CHECK is > 0)', () => {
    expect(() => mealEntryNutrients(oats, 0)).toThrow(RangeError)
  })
})

describe('mealExtraNutrients', () => {
  it('scales a per-100g snapshot by grams (÷100)', () => {
    const c = mealExtraNutrients(banana, 120) // 120 g banana
    expect(c.kcal).toBeCloseTo(106.8) // 89 × 1.2
    expect(c.carbG).toBeCloseTo(27.6)
  })
})

describe('rollUpMeals', () => {
  it('sums recipe entries and extras into one window total', () => {
    const total = rollUpMeals(
      [
        { perServing: oats, servingMultiplier: 1 },
        { perServing: omelette, servingMultiplier: 2 },
      ],
      [{ per100g: banana, gramsResolved: 120 }],
    )
    // oats×1 + omelette×2 + banana 120g
    expect(total.kcal).toBeCloseTo(380 + 440 + 106.8)
    expect(total.proteinG).toBeCloseTo(13 + 30 + 1.32)
  })

  it('rolls an empty window up to zero', () => {
    expect(rollUpMeals([], [])).toEqual({
      kcal: 0,
      proteinG: 0,
      fatG: 0,
      carbG: 0,
      fiberG: 0,
      saltG: 0,
    })
  })
})

describe('sumMealNutrients (windows → day → week)', () => {
  it('adds day totals into a week total', () => {
    const dayA = rollUpMeals([{ perServing: oats, servingMultiplier: 1 }], [])
    const dayB = rollUpMeals([{ perServing: omelette, servingMultiplier: 1 }], [])
    const week = sumMealNutrients([dayA, dayB])
    expect(week.kcal).toBeCloseTo(380 + 220)
    expect(week.proteinG).toBeCloseTo(13 + 15)
  })
})

describe('compareToTarget', () => {
  const target: MacroTarget = { targetKcal: 2000, proteinG: 150, carbsG: 200, fatG: 70 }

  it('computes remaining (target − current) and percent of target', () => {
    const current: Nutrients = { kcal: 1500, proteinG: 120, fatG: 35, carbG: 150, fiberG: 20, saltG: 4 }
    const cmp = compareToTarget(current, target)
    expect(cmp.remaining.kcal).toBeCloseTo(500)
    expect(cmp.remaining.proteinG).toBeCloseTo(30)
    expect(cmp.percentOfTarget.kcal).toBeCloseTo(75)
    expect(cmp.percentOfTarget.carbsG).toBeCloseTo(75)
  })

  it('reports a negative remaining when over target', () => {
    const current: Nutrients = { kcal: 2300, proteinG: 150, fatG: 70, carbG: 200, fiberG: 25, saltG: 5 }
    const cmp = compareToTarget(current, target)
    expect(cmp.remaining.kcal).toBeCloseTo(-300)
    expect(cmp.percentOfTarget.kcal).toBeCloseTo(115)
  })

  it('avoids division by zero when a target component is 0', () => {
    const zero: MacroTarget = { targetKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    const current: Nutrients = { kcal: 500, proteinG: 20, fatG: 10, carbG: 60, fiberG: 5, saltG: 1 }
    const cmp = compareToTarget(current, zero)
    expect(cmp.percentOfTarget.kcal).toBe(0)
    expect(cmp.remaining.kcal).toBeCloseTo(-500)
  })
})
