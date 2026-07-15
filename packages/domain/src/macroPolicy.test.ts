import { describe, it, expect } from 'vitest'
import { basalMetabolicRate } from './energy'
import { KCAL_PER_GRAM } from './macros'
import {
  clampCalorieAdjustmentPercent,
  MACRO_RULE_SETS,
  MAX_CALORIE_ADJUSTMENT_PERCENT,
  resolveAssessmentTargets,
} from './macroPolicy'

describe('clampCalorieAdjustmentPercent', () => {
  it('passes values inside the safe band through unchanged', () => {
    expect(clampCalorieAdjustmentPercent(-15)).toBe(-15)
    expect(clampCalorieAdjustmentPercent(0)).toBe(0)
    expect(clampCalorieAdjustmentPercent(20)).toBe(20)
  })

  it('clamps values outside ±30% and coerces non-finite input to 0', () => {
    expect(clampCalorieAdjustmentPercent(-80)).toBe(-MAX_CALORIE_ADJUSTMENT_PERCENT)
    expect(clampCalorieAdjustmentPercent(999)).toBe(MAX_CALORIE_ADJUSTMENT_PERCENT)
    expect(clampCalorieAdjustmentPercent(Number.NaN)).toBe(0)
    expect(clampCalorieAdjustmentPercent(Number.POSITIVE_INFINITY)).toBe(MAX_CALORIE_ADJUSTMENT_PERCENT)
  })
})

describe('resolveAssessmentTargets', () => {
  const male = { sex: 'male' as const, ageYears: 30, heightCm: 180, weightKg: 80, activityFactor: 1.375 }

  it('composes BMR → maintenance TDEE (BMR × activity factor)', () => {
    const bmr = basalMetabolicRate({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 30 })
    const t = resolveAssessmentTargets(male, 'standard')
    expect(t.bmrKcal).toBeCloseTo(bmr, 6)
    expect(t.maintenanceTdeeKcal).toBeCloseTo(bmr * 1.375, 6)
  })

  it('applies the goal adjustment to the maintenance TDEE', () => {
    const maintenance = resolveAssessmentTargets(male, 'standard').maintenanceTdeeKcal
    const cut = resolveAssessmentTargets({ ...male, calorieAdjustmentPercent: -20 }, 'standard')
    expect(cut.targetKcal).toBeCloseTo(maintenance * 0.8, 6)
    // Out-of-band adjustments are clamped before use.
    const wild = resolveAssessmentTargets({ ...male, calorieAdjustmentPercent: -95 }, 'standard')
    expect(wild.targetKcal).toBeCloseTo(maintenance * 0.7, 6)
  })

  it('standard macros: protein 1.6 g/kg, fat 0.9 g/kg, carbs fill the remainder', () => {
    const t = resolveAssessmentTargets(male, 'standard')
    expect(t.macros.proteinG).toBeCloseTo(1.6 * 80, 6) // 128 g
    expect(t.macros.fatG).toBeCloseTo(0.9 * 80, 6) // 72 g
    const usedKcal = t.macros.proteinG * KCAL_PER_GRAM.protein + t.macros.fatG * KCAL_PER_GRAM.fat
    expect(t.macros.carbG).toBeCloseTo((t.targetKcal - usedKcal) / KCAL_PER_GRAM.carb, 6)
  })

  it('sports macros use the higher protein/fat targets', () => {
    const t = resolveAssessmentTargets({ ...male, activityFactor: 1.725 }, 'sports')
    expect(t.macros.proteinG).toBeCloseTo(2.0 * 80, 6) // 160 g
    expect(t.macros.fatG).toBeCloseTo(1.0 * 80, 6) // 80 g
  })

  it('rejects a non-positive activity factor', () => {
    expect(() => resolveAssessmentTargets({ ...male, activityFactor: 0 }, 'standard')).toThrow(RangeError)
  })

  it('exposes the two rule sets as the D4 policy seam', () => {
    expect(Object.keys(MACRO_RULE_SETS).sort()).toEqual(['sports', 'standard'])
  })
})
