import { assertPositive } from './assert'

/**
 * Basal Metabolic Rate + Total Daily Energy Expenditure.
 *
 * Uses the **revised Harris–Benedict** equations (Roza & Shizgal, 1984), whose
 * coefficients are locked in ADR-000 §6:
 *   Men:   88.362 + 13.397·kg + 4.799·cm − 5.677·age
 *   Women: 447.593 +  9.247·kg + 3.098·cm − 4.330·age
 *
 * This is deterministic clinical math: the LLM never computes these numbers.
 * It only ever *proposes* narrative around the values this module returns
 * (ARCHITECTURE.md — AI Service §, "AI proposes, dietitian disposes").
 */

export type BiologicalSex = 'male' | 'female'

export interface BmrInput {
  sex: BiologicalSex
  weightKg: number
  heightCm: number
  ageYears: number
}

const COEFFICIENTS: Record<BiologicalSex, { base: number; weight: number; height: number; age: number }> =
  {
    male: { base: 88.362, weight: 13.397, height: 4.799, age: 5.677 },
    female: { base: 447.593, weight: 9.247, height: 3.098, age: 4.33 },
  }

/** Basal Metabolic Rate in kcal/day. */
export function basalMetabolicRate(input: BmrInput): number {
  assertPositive('weightKg', input.weightKg)
  assertPositive('heightCm', input.heightCm)
  assertPositive('ageYears', input.ageYears)
  const c = COEFFICIENTS[input.sex]
  return c.base + c.weight * input.weightKg + c.height * input.heightCm - c.age * input.ageYears
}

/**
 * Physical Activity Level multipliers applied to BMR to estimate TDEE.
 * Standard PAL bands; the exact band per client is a dietitian decision.
 */
export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const

export type ActivityLevel = keyof typeof ACTIVITY_FACTORS

/** Total Daily Energy Expenditure in kcal/day = BMR × activity factor. */
export function totalDailyEnergyExpenditure(input: BmrInput, activity: ActivityLevel): number {
  return basalMetabolicRate(input) * ACTIVITY_FACTORS[activity]
}
