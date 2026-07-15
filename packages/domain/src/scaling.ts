import { assertNonNegative, assertPositive } from './assert'

/**
 * Two distinct, deliberately separate scaling operations:
 *
 * 1. **Meal-plan serving multiplier** — the ONLY quantity the planner/AI may
 *    change on a recipe used in a plan. Restricted to a fixed allowed set so
 *    recipe integrity stays intact (spec "Important Rule"; ADR-000 §5).
 *
 * 2. **Recipe export scaling** — arbitrary target servings chosen at PDF-export
 *    time (spec "PDF Export": stored as 1 serving, generate for 5). This scales
 *    ingredient amounts proportionally and is NOT restricted to the set.
 */

export const ALLOWED_SERVING_MULTIPLIERS = [1, 1.25, 1.5, 2] as const
export type ServingMultiplier = (typeof ALLOWED_SERVING_MULTIPLIERS)[number]

export function isAllowedMultiplier(value: number): value is ServingMultiplier {
  return (ALLOWED_SERVING_MULTIPLIERS as readonly number[]).includes(value)
}

/** Scale a base quantity by an approved planner serving multiplier. */
export function scaleByMultiplier(baseQuantity: number, multiplier: number): number {
  assertNonNegative('baseQuantity', baseQuantity)
  if (!isAllowedMultiplier(multiplier)) {
    throw new RangeError(
      `Serving multiplier ${multiplier} is not allowed. Allowed: ${ALLOWED_SERVING_MULTIPLIERS.join(', ')}`,
    )
  }
  return baseQuantity * multiplier
}

/**
 * Scale a base quantity from `baseServings` to `targetServings` (recipe PDF
 * export). Both must be positive; target may be any positive number.
 */
export function scaleByServings(
  baseQuantity: number,
  baseServings: number,
  targetServings: number,
): number {
  assertNonNegative('baseQuantity', baseQuantity)
  assertPositive('baseServings', baseServings)
  assertPositive('targetServings', targetServings)
  return (baseQuantity * targetServings) / baseServings
}
