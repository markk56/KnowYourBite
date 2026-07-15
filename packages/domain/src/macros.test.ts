import { describe, it, expect } from 'vitest'
import { computeMacros } from './macros'

describe('computeMacros (deterministic mechanism; clinical policy is D4 data)', () => {
  it('computes grams from percent-of-calories rules, carbs as remainder', () => {
    const macros = computeMacros(
      { calories: 2000 },
      {
        protein: { mode: 'percent', percentOfCalories: 0.3 },
        fat: { mode: 'percent', percentOfCalories: 0.3 },
      },
    )
    expect(macros.proteinG).toBeCloseTo(150, 6)
    expect(macros.fatG).toBeCloseTo(66.6667, 3)
    expect(macros.carbG).toBeCloseTo(200, 6)
  })

  it('supports grams-per-kg targets with body weight', () => {
    const macros = computeMacros(
      { calories: 2000, bodyWeightKg: 70 },
      {
        protein: { mode: 'gramsPerKg', gramsPerKg: 2 },
        fat: { mode: 'percent', percentOfCalories: 0.25 },
      },
    )
    expect(macros.proteinG).toBeCloseTo(140, 6)
    expect(macros.fatG).toBeCloseTo(55.5556, 3)
    expect(macros.carbG).toBeCloseTo(235, 6)
  })

  it('supports absolute grams targets', () => {
    const macros = computeMacros(
      { calories: 2000 },
      {
        protein: { mode: 'grams', grams: 100 },
        fat: { mode: 'grams', grams: 50 },
        carbohydrate: { mode: 'grams', grams: 200 },
      },
    )
    expect(macros).toEqual({ proteinG: 100, fatG: 50, carbG: 200 })
  })

  it('throws when a gramsPerKg target lacks body weight', () => {
    expect(() =>
      computeMacros(
        { calories: 2000 },
        { protein: { mode: 'gramsPerKg', gramsPerKg: 2 }, fat: { mode: 'percent', percentOfCalories: 0.3 } },
      ),
    ).toThrow(/bodyWeightKg/)
  })

  it('throws when protein + fat exceed total calories', () => {
    expect(() =>
      computeMacros(
        { calories: 2000 },
        {
          protein: { mode: 'percent', percentOfCalories: 0.7 },
          fat: { mode: 'percent', percentOfCalories: 0.7 },
        },
      ),
    ).toThrow(RangeError)
  })
})
