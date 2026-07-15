import { describe, it, expect } from 'vitest'
import type { Nutrients } from './nutrition'
import { assertValidNutritionPer100g, isValidNutritionPer100g, validateNutritionPer100g } from './validator'

const valid: Nutrients = { kcal: 200, proteinG: 20, fatG: 10, carbG: 10, fiberG: 2, saltG: 1 }

describe('validateNutritionPer100g', () => {
  it('accepts a plausible, energy-balanced snapshot', () => {
    expect(validateNutritionPer100g(valid)).toEqual([])
    expect(isValidNutritionPer100g(valid)).toBe(true)
  })

  it('flags kcal over the physical ceiling', () => {
    const issues = validateNutritionPer100g({ ...valid, kcal: 950 })
    expect(issues.some((i) => i.field === 'kcal')).toBe(true)
  })

  it('flags negative macros', () => {
    const issues = validateNutritionPer100g({ ...valid, proteinG: -5 })
    expect(issues.some((i) => i.field === 'proteinG')).toBe(true)
  })

  it('flags an energy imbalance between kcal and macros', () => {
    const issues = validateNutritionPer100g({
      kcal: 100,
      proteinG: 40,
      fatG: 5,
      carbG: 5,
      fiberG: 0,
      saltG: 0,
    })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.field).toBe('energyBalance')
  })

  it('assertValid throws on invalid, passes on valid', () => {
    expect(() => assertValidNutritionPer100g(valid)).not.toThrow()
    expect(() => assertValidNutritionPer100g({ ...valid, kcal: 5000 })).toThrow(/Invalid nutrition/)
  })
})
