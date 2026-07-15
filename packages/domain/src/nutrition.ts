import { assertNonNegative, round } from './assert'

/**
 * Nutrition roll-ups. USDA gives values per 100 g; a recipe ingredient stores
 * an immutable per-100g snapshot (ARCHITECTURE.md — recipe integrity), so an
 * ingredient's contribution is `per100g × grams / 100`. Totals sum ingredient
 * contributions; per-serving divides by servings. All pure and deterministic.
 *
 * The canonical macro set matches the product/USDA fields used throughout:
 * kcal, protein, fat, carbohydrate, fibre, salt (grams, except kcal).
 */

export interface Nutrients {
  kcal: number
  proteinG: number
  fatG: number
  carbG: number
  fiberG: number
  saltG: number
}

export const ZERO_NUTRIENTS: Readonly<Nutrients> = Object.freeze({
  kcal: 0,
  proteinG: 0,
  fatG: 0,
  carbG: 0,
  fiberG: 0,
  saltG: 0,
})

const KEYS: (keyof Nutrients)[] = ['kcal', 'proteinG', 'fatG', 'carbG', 'fiberG', 'saltG']

/** Contribution of `grams` of a food given its per-100g nutrient snapshot. */
export function nutrientsForGrams(per100g: Nutrients, grams: number): Nutrients {
  assertNonNegative('grams', grams)
  const factor = grams / 100
  return {
    kcal: per100g.kcal * factor,
    proteinG: per100g.proteinG * factor,
    fatG: per100g.fatG * factor,
    carbG: per100g.carbG * factor,
    fiberG: per100g.fiberG * factor,
    saltG: per100g.saltG * factor,
  }
}

/** Element-wise sum of many nutrient contributions. */
export function sumNutrients(items: readonly Nutrients[]): Nutrients {
  const total: Nutrients = { ...ZERO_NUTRIENTS }
  for (const item of items) {
    for (const key of KEYS) {
      total[key] += item[key]
    }
  }
  return total
}

/** Per-serving nutrients = total / servings. */
export function perServing(total: Nutrients, servings: number): Nutrients {
  if (servings <= 0 || !Number.isFinite(servings)) {
    throw new RangeError(`servings must be greater than 0, received: ${servings}`)
  }
  const result = {} as Nutrients
  for (const key of KEYS) {
    result[key] = total[key] / servings
  }
  return result
}

/** Round every nutrient to a display precision (default 1 decimal, kcal to 0). */
export function roundNutrients(n: Nutrients, decimals = 1): Nutrients {
  return {
    kcal: Math.round(n.kcal),
    proteinG: round(n.proteinG, decimals),
    fatG: round(n.fatG, decimals),
    carbG: round(n.carbG, decimals),
    fiberG: round(n.fiberG, decimals),
    saltG: round(n.saltG, decimals),
  }
}
