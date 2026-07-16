import { nutrientsForGrams, perServing, sumNutrients, type Nutrients } from './nutrition'
import { assertPositive } from './assert'

/**
 * Recipe nutrition roll-up — the deterministic three-level view the product
 * requires (ARCHITECTURE §5.1): per-ingredient contribution, recipe total, and
 * per-serving. Every number traces to a frozen per-100g snapshot × grams, so it
 * is byte-stable regardless of the mutable USDA cache (recipe integrity). Pure.
 */

export interface RecipeIngredientInput {
  /** Frozen per-100g snapshot captured at add-time. */
  per100g: Nutrients
  /** Deterministic grams the authored amount resolved to. */
  gramsResolved: number
}

export interface RecipeRollup {
  /** Per-ingredient contribution, in input order. */
  ingredients: Nutrients[]
  /** Σ ingredient contributions. */
  total: Nutrients
  /** total / servings. */
  perServing: Nutrients
}

/**
 * Roll up ingredient snapshots into ingredient / total / per-serving nutrients.
 * Invariants (unit-tested): Σ ingredient == total; perServing × servings == total.
 */
export function rollUpRecipe(ingredients: readonly RecipeIngredientInput[], servings: number): RecipeRollup {
  assertPositive('servings', servings)
  const contributions = ingredients.map((ing) => nutrientsForGrams(ing.per100g, ing.gramsResolved))
  const total = sumNutrients(contributions)
  return { ingredients: contributions, total, perServing: perServing(total, servings) }
}
