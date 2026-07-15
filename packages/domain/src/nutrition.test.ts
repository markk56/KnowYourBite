import { describe, it, expect } from 'vitest'
import type { Nutrients } from './nutrition'
import { nutrientsForGrams, perServing, roundNutrients, sumNutrients } from './nutrition'

const per100g: Nutrients = { kcal: 200, proteinG: 20, fatG: 10, carbG: 10, fiberG: 2, saltG: 1 }

describe('nutrientsForGrams', () => {
  it('scales a per-100g snapshot by grams/100', () => {
    expect(nutrientsForGrams(per100g, 150)).toEqual({
      kcal: 300,
      proteinG: 30,
      fatG: 15,
      carbG: 15,
      fiberG: 3,
      saltG: 1.5,
    })
  })

  it('returns zeros for zero grams', () => {
    expect(nutrientsForGrams(per100g, 0)).toEqual({
      kcal: 0,
      proteinG: 0,
      fatG: 0,
      carbG: 0,
      fiberG: 0,
      saltG: 0,
    })
  })

  it('rejects negative grams', () => {
    expect(() => nutrientsForGrams(per100g, -50)).toThrow(RangeError)
  })
})

describe('sumNutrients', () => {
  it('sums element-wise', () => {
    const a = nutrientsForGrams(per100g, 100)
    const b = nutrientsForGrams(per100g, 50)
    expect(sumNutrients([a, b])).toEqual(nutrientsForGrams(per100g, 150))
  })

  it('sums an empty list to zero', () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, proteinG: 0, fatG: 0, carbG: 0, fiberG: 0, saltG: 0 })
  })
})

describe('perServing', () => {
  it('divides totals by servings', () => {
    const total: Nutrients = { kcal: 300, proteinG: 30, fatG: 15, carbG: 15, fiberG: 3, saltG: 1.5 }
    expect(perServing(total, 3)).toEqual({
      kcal: 100,
      proteinG: 10,
      fatG: 5,
      carbG: 5,
      fiberG: 1,
      saltG: 0.5,
    })
  })

  it('rejects non-positive servings', () => {
    expect(() => perServing(per100g, 0)).toThrow(RangeError)
  })
})

describe('roundNutrients', () => {
  it('rounds kcal to integer and macros to 1 decimal by default', () => {
    const n: Nutrients = {
      kcal: 247.49,
      proteinG: 30.456,
      fatG: 5.44,
      carbG: 0.02,
      fiberG: 1.25,
      saltG: 0.149,
    }
    expect(roundNutrients(n)).toEqual({
      kcal: 247,
      proteinG: 30.5,
      fatG: 5.4,
      carbG: 0,
      fiberG: 1.3,
      saltG: 0.1,
    })
  })
})
