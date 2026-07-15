import { assertNonNegative, assertPositive } from './assert'

/**
 * Deterministic macronutrient distribution.
 *
 * IMPORTANT: this module provides the *mechanism* (turn calories + explicit
 * rules into grams of protein/fat/carb). The actual clinical *policy* — the
 * exact g/kg and %-splits for Standard vs Sports clients — is OPEN DECISION D4
 * and will be supplied as data (a `MacroRuleSet` per assessment type) without
 * changing this code. We do NOT invent clinical defaults here.
 */

export const KCAL_PER_GRAM = { protein: 4, carb: 4, fat: 9 } as const

/** How a single macro target is expressed. */
export type MacroTarget =
  | { mode: 'percent'; percentOfCalories: number } // 0..1 of total kcal
  | { mode: 'gramsPerKg'; gramsPerKg: number } // needs bodyWeightKg
  | { mode: 'grams'; grams: number } // absolute grams

/** A clinical rule set (supplied per assessment type via D4). Carbs default to the remainder. */
export interface MacroRuleSet {
  protein: MacroTarget
  fat: MacroTarget
  /** If omitted, carbohydrate is the remaining calories after protein + fat. */
  carbohydrate?: MacroTarget
}

export interface MacroInput {
  calories: number
  bodyWeightKg?: number
}

export interface MacroGrams {
  proteinG: number
  fatG: number
  carbG: number
}

function gramsFromTarget(
  target: MacroTarget,
  calories: number,
  bodyWeightKg: number | undefined,
  kcalPerGram: number,
): number {
  switch (target.mode) {
    case 'grams':
      assertNonNegative('grams', target.grams)
      return target.grams
    case 'percent':
      if (target.percentOfCalories < 0 || target.percentOfCalories > 1) {
        throw new RangeError(`percentOfCalories must be within [0, 1], received: ${target.percentOfCalories}`)
      }
      return (target.percentOfCalories * calories) / kcalPerGram
    case 'gramsPerKg':
      if (bodyWeightKg === undefined) {
        throw new Error('gramsPerKg target requires bodyWeightKg in the input')
      }
      assertPositive('bodyWeightKg', bodyWeightKg)
      assertNonNegative('gramsPerKg', target.gramsPerKg)
      return target.gramsPerKg * bodyWeightKg
  }
}

/** Compute macro grams from calories + a clinical rule set. */
export function computeMacros(input: MacroInput, rules: MacroRuleSet): MacroGrams {
  assertPositive('calories', input.calories)

  const proteinG = gramsFromTarget(rules.protein, input.calories, input.bodyWeightKg, KCAL_PER_GRAM.protein)
  const fatG = gramsFromTarget(rules.fat, input.calories, input.bodyWeightKg, KCAL_PER_GRAM.fat)

  let carbG: number
  if (rules.carbohydrate) {
    carbG = gramsFromTarget(rules.carbohydrate, input.calories, input.bodyWeightKg, KCAL_PER_GRAM.carb)
  } else {
    const usedKcal = proteinG * KCAL_PER_GRAM.protein + fatG * KCAL_PER_GRAM.fat
    const remainingKcal = input.calories - usedKcal
    if (remainingKcal < -1) {
      throw new RangeError(
        `Protein + fat targets (${Math.round(usedKcal)} kcal) exceed total calories (${input.calories})`,
      )
    }
    carbG = Math.max(0, remainingKcal) / KCAL_PER_GRAM.carb
  }

  return { proteinG, fatG, carbG }
}
