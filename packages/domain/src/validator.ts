import type { Nutrients } from './nutrition'

/**
 * Nutrition sanity validator. Rejects implausible per-100g snapshots before
 * they are persisted (ADR-000 §6: "rejects implausible values, e.g. >900
 * kcal/100g"). Returns a list of issues; empty means valid. This is a guard
 * against bad USDA data / user error — not a clinical judgement.
 */

export interface ValidationIssue {
  field: keyof Nutrients | 'energyBalance'
  message: string
}

// Physical ceilings per 100 g. Pure fat ≈ 900 kcal/100g is the practical max.
const MAX = {
  kcal: 900,
  proteinG: 100,
  fatG: 100,
  carbG: 100,
  fiberG: 100,
  saltG: 100,
} as const

const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 } as const

export function validateNutritionPer100g(n: Nutrients): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const check = (field: keyof typeof MAX) => {
    const value = n[field]
    if (!Number.isFinite(value) || value < 0) {
      issues.push({ field, message: `${field} must be a number ≥ 0` })
    } else if (value > MAX[field]) {
      issues.push({ field, message: `${field} of ${value} exceeds the plausible max ${MAX[field]}/100g` })
    }
  }

  ;(Object.keys(MAX) as (keyof typeof MAX)[]).forEach(check)

  // Energy balance: computed macro energy should be within tolerance of kcal.
  if (Number.isFinite(n.kcal) && n.kcal >= 0) {
    const macroKcal = n.proteinG * KCAL_PER_G.protein + n.carbG * KCAL_PER_G.carb + n.fatG * KCAL_PER_G.fat
    const tolerance = Math.max(30, n.kcal * 0.25)
    if (Math.abs(macroKcal - n.kcal) > tolerance) {
      issues.push({
        field: 'energyBalance',
        message: `Declared ${Math.round(n.kcal)} kcal but macros imply ~${Math.round(macroKcal)} kcal (outside ±${Math.round(tolerance)})`,
      })
    }
  }

  return issues
}

export function isValidNutritionPer100g(n: Nutrients): boolean {
  return validateNutritionPer100g(n).length === 0
}

export function assertValidNutritionPer100g(n: Nutrients): void {
  const issues = validateNutritionPer100g(n)
  if (issues.length > 0) {
    throw new Error(`Invalid nutrition snapshot: ${issues.map((i) => i.message).join('; ')}`)
  }
}
