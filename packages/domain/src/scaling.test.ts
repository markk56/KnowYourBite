import { describe, it, expect } from 'vitest'
import {
  ALLOWED_SERVING_MULTIPLIERS,
  isAllowedMultiplier,
  scaleByMultiplier,
  scaleByServings,
} from './scaling'

describe('serving multiplier (planner)', () => {
  it('exposes exactly the allowed set', () => {
    expect(ALLOWED_SERVING_MULTIPLIERS).toEqual([1, 1.25, 1.5, 2])
  })

  it('accepts only allowed multipliers', () => {
    expect(isAllowedMultiplier(1.25)).toBe(true)
    expect(isAllowedMultiplier(2)).toBe(true)
    expect(isAllowedMultiplier(1.75)).toBe(false)
    expect(isAllowedMultiplier(3)).toBe(false)
  })

  it('scales by an allowed multiplier', () => {
    expect(scaleByMultiplier(200, 1.5)).toBe(300)
    expect(scaleByMultiplier(80, 1.25)).toBe(100)
  })

  it('rejects a disallowed multiplier (recipe integrity guard)', () => {
    expect(() => scaleByMultiplier(200, 1.75)).toThrow(RangeError)
  })
})

describe('recipe export scaling (arbitrary servings)', () => {
  it('scales proportionally from base to target servings', () => {
    expect(scaleByServings(100, 1, 5)).toBe(500)
    expect(scaleByServings(300, 2, 3)).toBe(450)
  })

  it('rejects non-positive serving counts', () => {
    expect(() => scaleByServings(100, 0, 5)).toThrow(RangeError)
    expect(() => scaleByServings(100, 1, 0)).toThrow(RangeError)
  })
})
