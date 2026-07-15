import { describe, it, expect } from 'vitest'
import { ACTIVITY_FACTORS, basalMetabolicRate, totalDailyEnergyExpenditure } from './energy'

describe('basalMetabolicRate (revised Harris–Benedict)', () => {
  it('computes male BMR from the locked coefficients', () => {
    // 88.362 + 13.397*80 + 4.799*180 - 5.677*30
    expect(basalMetabolicRate({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 })).toBeCloseTo(
      1853.632,
      3,
    )
  })

  it('computes female BMR from the locked coefficients', () => {
    // 447.593 + 9.247*60 + 3.098*165 - 4.330*30
    expect(basalMetabolicRate({ sex: 'female', weightKg: 60, heightCm: 165, ageYears: 30 })).toBeCloseTo(
      1383.683,
      3,
    )
  })

  it('rejects non-positive measurements', () => {
    expect(() => basalMetabolicRate({ sex: 'male', weightKg: 0, heightCm: 180, ageYears: 30 })).toThrow(
      RangeError,
    )
    expect(() => basalMetabolicRate({ sex: 'male', weightKg: 80, heightCm: -1, ageYears: 30 })).toThrow(
      RangeError,
    )
    expect(() => basalMetabolicRate({ sex: 'female', weightKg: 60, heightCm: 165, ageYears: 0 })).toThrow(
      RangeError,
    )
  })
})

describe('totalDailyEnergyExpenditure', () => {
  it('multiplies BMR by the activity factor', () => {
    const bmr = basalMetabolicRate({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 })
    expect(totalDailyEnergyExpenditure({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 }, 'moderate')).toBeCloseTo(
      bmr * 1.55,
      6,
    )
  })

  it('exposes the standard PAL bands', () => {
    expect(ACTIVITY_FACTORS).toEqual({
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    })
  })
})
