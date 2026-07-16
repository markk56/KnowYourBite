import { nutrientsForGrams, sumNutrients, type Nutrients } from './nutrition'
import { assertNonNegative, assertPositive } from './assert'

/**
 * Meal-plan nutrition roll-up (Milestone 4) — the deterministic day/week dashboard
 * math. A meal is built from two kinds of contribution:
 *
 *  - a **recipe entry**: the referenced recipe's current per-serving nutrients ×
 *    an allowed serving multiplier ({1, 1.25, 1.5, 2}). The recipe's per-serving
 *    figure itself traces to frozen per-100g ingredient snapshots, so the only
 *    thing a plan can change is *how many servings* — never an ingredient gram
 *    (recipe integrity, ARCHITECTURE §5).
 *  - an **extra**: a standalone USDA food with a frozen per-100g snapshot × grams
 *    (identical shape to a recipe ingredient).
 *
 * Everything here is pure and deterministic — the same source of truth the recipe
 * roll-up uses, so the live planner dashboard and any later PDF agree byte-for-byte.
 */

export interface MealEntryContribution {
  /** The referenced recipe's current per-serving nutrients (from frozen snapshots). */
  perServing: Nutrients
  /** Allowed multiplier — how many servings of the recipe this entry represents. */
  servingMultiplier: number
}

export interface MealExtraContribution {
  /** Frozen per-100g USDA snapshot captured at add-time (immutable). */
  per100g: Nutrients
  /** Deterministic grams the authored amount resolved to. */
  gramsResolved: number
}

/** A recipe entry's contribution = perServing × servingMultiplier. */
export function mealEntryNutrients(perServing: Nutrients, servingMultiplier: number): Nutrients {
  assertPositive('servingMultiplier', servingMultiplier)
  return {
    kcal: perServing.kcal * servingMultiplier,
    proteinG: perServing.proteinG * servingMultiplier,
    fatG: perServing.fatG * servingMultiplier,
    carbG: perServing.carbG * servingMultiplier,
    fiberG: perServing.fiberG * servingMultiplier,
    saltG: perServing.saltG * servingMultiplier,
  }
}

/** An extra's contribution = per100g × grams / 100 (same math as a recipe ingredient). */
export function mealExtraNutrients(per100g: Nutrients, gramsResolved: number): Nutrients {
  return nutrientsForGrams(per100g, gramsResolved)
}

/**
 * Roll a single meal (window) up: Σ recipe-entry contributions + Σ extra
 * contributions. A day roll-up is this over every entry/extra in the day; a week
 * roll-up sums the day totals via {@link sumMealNutrients}.
 */
export function rollUpMeals(
  entries: readonly MealEntryContribution[],
  extras: readonly MealExtraContribution[],
): Nutrients {
  const entryContribs = entries.map((e) => mealEntryNutrients(e.perServing, e.servingMultiplier))
  const extraContribs = extras.map((x) => mealExtraNutrients(x.per100g, x.gramsResolved))
  return sumNutrients([...entryContribs, ...extraContribs])
}

/** Element-wise sum of already-rolled-up nutrient totals (windows → day → week). */
export function sumMealNutrients(items: readonly Nutrients[]): Nutrients {
  return sumNutrients(items)
}

// ── Target comparison ────────────────────────────────────────────────────────

/** The per-day clinical target snapshotted onto a plan (naming matches the DTO). */
export interface MacroTarget {
  targetKcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface TargetDelta {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface TargetComparison {
  target: MacroTarget
  /** target − current (positive = under target, negative = over). */
  remaining: TargetDelta
  /** current / target × 100, clamped to 0 when the target component is 0. */
  percentOfTarget: TargetDelta
}

/**
 * Compare a day's current nutrients against its snapshotted target. Deterministic;
 * a 0 target component yields 0% rather than a division-by-zero.
 */
export function compareToTarget(current: Nutrients, target: MacroTarget): TargetComparison {
  assertNonNegative('current.kcal', current.kcal)
  const pct = (cur: number, tgt: number) => (tgt > 0 ? (cur / tgt) * 100 : 0)
  return {
    target,
    remaining: {
      kcal: target.targetKcal - current.kcal,
      proteinG: target.proteinG - current.proteinG,
      carbsG: target.carbsG - current.carbG,
      fatG: target.fatG - current.fatG,
    },
    percentOfTarget: {
      kcal: pct(current.kcal, target.targetKcal),
      proteinG: pct(current.proteinG, target.proteinG),
      carbsG: pct(current.carbG, target.carbsG),
      fatG: pct(current.fatG, target.fatG),
    },
  }
}
