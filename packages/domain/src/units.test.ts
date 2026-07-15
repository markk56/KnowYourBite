import { describe, it, expect } from 'vitest'
import { toGrams } from './units'

describe('toGrams', () => {
  it('converts mass units', () => {
    expect(toGrams(2, 'kg')).toBe(2000)
    expect(toGrams(500, 'mg')).toBe(0.5)
    expect(toGrams(120, 'g')).toBe(120)
  })

  it('converts volume units using density', () => {
    expect(toGrams(250, 'ml', { densityGPerMl: 1 })).toBe(250)
    expect(toGrams(1, 'cup', { densityGPerMl: 1 })).toBe(240)
    expect(toGrams(1, 'tbsp', { densityGPerMl: 1 })).toBe(15)
    expect(toGrams(1, 'tsp', { densityGPerMl: 1 })).toBe(5)
    // Oil at ~0.92 g/ml
    expect(toGrams(100, 'ml', { densityGPerMl: 0.92 })).toBeCloseTo(92, 6)
  })

  it('converts piece units using grams-per-piece', () => {
    expect(toGrams(2, 'piece', { gramsPerPiece: 50 })).toBe(100)
  })

  it('throws when required context is missing', () => {
    expect(() => toGrams(250, 'ml')).toThrow(/density/i)
    expect(() => toGrams(1, 'piece')).toThrow(/gramsPerPiece/i)
  })

  it('rejects negative quantities', () => {
    expect(() => toGrams(-1, 'g')).toThrow(RangeError)
  })
})
