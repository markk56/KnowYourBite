import { assertPositive } from './assert'
import { basalMetabolicRate, type BiologicalSex } from './energy'
import { computeMacros, type MacroGrams, type MacroRuleSet } from './macros'

/**
 * Clinical macro *policy* (OPEN DECISION D4). The `macros` module is the pure
 * mechanism (calories + rules → grams); this file supplies the actual per-type
 * rule sets and composes BMR → TDEE → goal-adjusted kcal → macros.
 *
 * These g/kg values are **evidence-based defaults**, not the owner's pinned
 * clinical policy — they are the single place to change that policy, and every
 * number they produce is shown to the dietitian as an editable proposal that
 * only becomes a clinical fact after human approval (ARCHITECTURE.md — M2,
 * "AI proposes, dietitian disposes"). Standard follows general weight-management
 * targets (protein 1.6 g/kg, fat 0.9 g/kg); Sports follows resistance-training
 * targets (protein 2.0 g/kg, fat 1.0 g/kg). Carbohydrate is the remainder.
 */

export type AssessmentType = 'standard' | 'sports'

export const MACRO_RULE_SETS: Record<AssessmentType, MacroRuleSet> = {
  standard: {
    protein: { mode: 'gramsPerKg', gramsPerKg: 1.6 },
    fat: { mode: 'gramsPerKg', gramsPerKg: 0.9 },
    // carbohydrate omitted → the remaining calories after protein + fat.
  },
  sports: {
    protein: { mode: 'gramsPerKg', gramsPerKg: 2.0 },
    fat: { mode: 'gramsPerKg', gramsPerKg: 1.0 },
  },
}

/** The AI may only ever suggest a calorie change within ±this percentage. */
export const MAX_CALORIE_ADJUSTMENT_PERCENT = 30

/** Clamp a (possibly AI-proposed) calorie adjustment into the safe band. */
export function clampCalorieAdjustmentPercent(pct: number): number {
  if (Number.isNaN(pct)) return 0
  return Math.max(-MAX_CALORIE_ADJUSTMENT_PERCENT, Math.min(MAX_CALORIE_ADJUSTMENT_PERCENT, pct))
}

export interface AssessmentTargetInput {
  sex: BiologicalSex
  ageYears: number
  heightCm: number
  weightKg: number
  /** Physical-activity multiplier applied to BMR (1.2 … 1.9). */
  activityFactor: number
  /** Goal adjustment vs maintenance, e.g. -15 for a 15% deficit. Default 0. */
  calorieAdjustmentPercent?: number
}

export interface DeterministicTargets {
  bmrKcal: number
  maintenanceTdeeKcal: number
  targetKcal: number
  macros: MacroGrams
}

/**
 * The single deterministic entry point for the assessment module: Harris–
 * Benedict BMR → activity-factor maintenance TDEE → goal-adjusted target kcal →
 * macro grams. Returns full-precision numbers; callers round for storage/display.
 */
export function resolveAssessmentTargets(
  input: AssessmentTargetInput,
  type: AssessmentType,
): DeterministicTargets {
  assertPositive('activityFactor', input.activityFactor)
  const bmrKcal = basalMetabolicRate({
    sex: input.sex,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    ageYears: input.ageYears,
  })
  const maintenanceTdeeKcal = bmrKcal * input.activityFactor
  const pct = clampCalorieAdjustmentPercent(input.calorieAdjustmentPercent ?? 0)
  const targetKcal = maintenanceTdeeKcal * (1 + pct / 100)
  const macros = computeMacros({ calories: targetKcal, bodyWeightKg: input.weightKg }, MACRO_RULE_SETS[type])
  return { bmrKcal, maintenanceTdeeKcal, targetKcal, macros }
}
