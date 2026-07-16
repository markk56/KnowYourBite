import {
  compareToTarget,
  mealEntryNutrients,
  mealExtraNutrients,
  roundNutrients,
  sumMealNutrients,
  type MacroTarget,
  type Nutrients,
} from '@kyb/domain'
import type {
  Allergen,
  DayTargetComparisonDto,
  IngredientUnit,
  MealEntryDto,
  MealExtraDto,
  MealPlanDayDto,
  MealPlanDto,
  MealPlanPeriod,
  MealPlanStatus,
  MealPlanSummaryDto,
  MealPlanTargetDto,
  MealWindowDto,
  NutrientsDto,
} from '@kyb/shared'
import type {
  MealEntryRow,
  MealExtraRow,
  MealPlanDayRow,
  MealPlanRow,
  MealWindowRow,
  RecipeRow,
} from '../db/schema'

/**
 * Pure DTO assembly for a meal plan (Milestone 4). Given the loaded rows + the
 * referenced recipe data, it computes every nutrition number deterministically via
 * `@kyb/domain` — the same source of truth as the recipe roll-up — so the live
 * dashboard and any later export agree byte-for-byte. No I/O here (testable).
 */

const num = (v: string | null): number => (v == null ? 0 : Number(v))
const ZERO_NUTRIENTS: Nutrients = { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, fiberG: 0, saltG: 0 }

/** Per-serving nutrients for a recipe = cached total ÷ authored servings. */
export interface RecipeRef {
  title: string
  servings: number
  perServing: Nutrients
  missing: boolean
  allergens: Allergen[]
}

export function recipeRefFromRow(row: RecipeRow, allergens: Allergen[]): RecipeRef {
  const servings = row.servings > 0 ? row.servings : 1
  const total: Nutrients = {
    kcal: num(row.totalKcal),
    proteinG: num(row.totalProteinG),
    fatG: num(row.totalFatG),
    carbG: num(row.totalCarbsG),
    fiberG: num(row.totalFiberG),
    saltG: num(row.totalSaltG),
  }
  return {
    title: row.title,
    servings: row.servings,
    perServing: {
      kcal: total.kcal / servings,
      proteinG: total.proteinG / servings,
      fatG: total.fatG / servings,
      carbG: total.carbG / servings,
      fiberG: total.fiberG / servings,
      saltG: total.saltG / servings,
    },
    missing: row.deletedAt != null,
    allergens,
  }
}

function per100gFromExtra(row: MealExtraRow): Nutrients {
  return {
    kcal: num(row.kcalPer100g),
    proteinG: num(row.proteinPer100g),
    fatG: num(row.fatPer100g),
    carbG: num(row.carbsPer100g),
    fiberG: num(row.fiberPer100g),
    saltG: num(row.saltPer100g),
  }
}

const toDto = (n: Nutrients): NutrientsDto => roundNutrients(n)

export interface AssembleInput {
  plan: MealPlanRow
  clientName: string
  days: MealPlanDayRow[]
  windows: MealWindowRow[]
  entries: MealEntryRow[]
  extras: MealExtraRow[]
  recipesById: Map<string, RecipeRef>
}

function planTarget(plan: MealPlanRow): MealPlanTargetDto | null {
  if (plan.targetKcal == null) return null
  return {
    targetKcal: num(plan.targetKcal),
    proteinG: num(plan.targetProteinG),
    carbsG: num(plan.targetCarbsG),
    fatG: num(plan.targetFatG),
  }
}

function toEntryDto(row: MealEntryRow, ref: RecipeRef | undefined): MealEntryDto {
  const perServing = ref?.perServing ?? ZERO_NUTRIENTS
  return {
    id: row.id,
    recipeId: row.recipeId,
    recipeTitle: ref?.title ?? 'Deleted recipe',
    recipeMissing: ref?.missing ?? true,
    servingMultiplier: num(row.servingMultiplier),
    recipeServings: ref?.servings ?? 1,
    perServing: toDto(perServing),
    // A missing (soft-deleted) recipe contributes 0 — see entryRaw.
    contribution: toDto(entryRaw(row, ref)),
    allergens: ref?.allergens ?? [],
    sortOrder: row.sortOrder,
  }
}

function toExtraDto(row: MealExtraRow): MealExtraDto {
  const per100g = per100gFromExtra(row)
  const grams = num(row.gramsResolved)
  return {
    id: row.id,
    fdcId: row.fdcId,
    canonicalNameEn: row.canonicalNameEn,
    amount: num(row.amount),
    unit: row.unit as IngredientUnit,
    gramsResolved: grams,
    per100g: toDto(per100g),
    contribution: toDto(mealExtraNutrients(per100g, grams)),
    sortOrder: row.sortOrder,
  }
}

/** Raw (unrounded) contribution of an entry — used to roll windows/days up without double-rounding. */
function entryRaw(row: MealEntryRow, ref: RecipeRef | undefined): Nutrients {
  if (!ref || ref.missing) return ZERO_NUTRIENTS
  return mealEntryNutrients(ref.perServing, num(row.servingMultiplier))
}

function extraRaw(row: MealExtraRow): Nutrients {
  return mealExtraNutrients(per100gFromExtra(row), num(row.gramsResolved))
}

export function assembleMealPlanDto(input: AssembleInput): MealPlanDto {
  const { plan, clientName, days, windows, entries, extras, recipesById } = input

  const entriesByWindow = groupBy(entries, (e) => e.windowId)
  const extrasByWindow = groupBy(extras, (e) => e.windowId)
  const windowsByDay = groupBy(windows, (w) => w.dayId)
  const target = planTarget(plan)
  const macroTarget: MacroTarget | null = target
    ? { targetKcal: target.targetKcal, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG }
    : null

  const dayDtos: MealPlanDayDto[] = days.map((day) => {
    const dayWindows = (windowsByDay.get(day.id) ?? []).sort(bySort)
    const windowDtos: MealWindowDto[] = dayWindows.map((w) => {
      const wEntries = (entriesByWindow.get(w.id) ?? []).sort(bySort)
      const wExtras = (extrasByWindow.get(w.id) ?? []).sort(bySort)
      const windowRaw = sumMealNutrients([
        ...wEntries.map((e) => entryRaw(e, recipesById.get(e.recipeId))),
        ...wExtras.map((x) => extraRaw(x)),
      ])
      return {
        id: w.id,
        dayId: w.dayId,
        name: w.name,
        timeOfDay: w.timeOfDay,
        sortOrder: w.sortOrder,
        entries: wEntries.map((e) => toEntryDto(e, recipesById.get(e.recipeId))),
        extras: wExtras.map(toExtraDto),
        nutrition: toDto(windowRaw),
      }
    })
    const dayRaw = sumMealNutrients(
      dayWindows.flatMap((w) => [
        ...(entriesByWindow.get(w.id) ?? []).map((e) => entryRaw(e, recipesById.get(e.recipeId))),
        ...(extrasByWindow.get(w.id) ?? []).map((x) => extraRaw(x)),
      ]),
    )
    const targetComparison: DayTargetComparisonDto | null = macroTarget
      ? roundComparison(compareToTarget(dayRaw, macroTarget))
      : null
    return {
      id: day.id,
      dayIndex: day.dayIndex,
      label: day.label,
      windows: windowDtos,
      nutrition: toDto(dayRaw),
      targetComparison,
    }
  })

  // Plan total = Σ every entry/extra (raw), averaged across the day count.
  const planRaw = sumMealNutrients([
    ...entries.map((e) => entryRaw(e, recipesById.get(e.recipeId))),
    ...extras.map((x) => extraRaw(x)),
  ])
  const dayCount = days.length > 0 ? days.length : 1
  const perDayAverage: Nutrients = {
    kcal: planRaw.kcal / dayCount,
    proteinG: planRaw.proteinG / dayCount,
    fatG: planRaw.fatG / dayCount,
    carbG: planRaw.carbG / dayCount,
    fiberG: planRaw.fiberG / dayCount,
    saltG: planRaw.saltG / dayCount,
  }

  return {
    id: plan.id,
    clientId: plan.clientId,
    clientName,
    title: plan.title,
    period: plan.period as MealPlanPeriod,
    status: plan.status as MealPlanStatus,
    startDate: plan.startDate,
    notes: plan.notes,
    target,
    days: dayDtos,
    total: toDto(planRaw),
    perDayAverage: toDto(perDayAverage),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}

export function assembleSummaryDto(
  plan: MealPlanRow,
  clientName: string,
  dayCount: number,
  entryCount: number,
): MealPlanSummaryDto {
  return {
    id: plan.id,
    clientId: plan.clientId,
    clientName,
    title: plan.title,
    period: plan.period as MealPlanPeriod,
    status: plan.status as MealPlanStatus,
    startDate: plan.startDate,
    dayCount,
    entryCount,
    targetKcal: plan.targetKcal == null ? null : num(plan.targetKcal),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}

// ── helpers ────────────────────────────────────────────────────────────────────

function groupBy<T, K>(items: readonly T[], key: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k) ?? []
    list.push(item)
    map.set(k, list)
  }
  return map
}

function bySort(a: { sortOrder: number }, b: { sortOrder: number }): number {
  return a.sortOrder - b.sortOrder
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function roundComparison(c: ReturnType<typeof compareToTarget>): DayTargetComparisonDto {
  return {
    target: {
      targetKcal: c.target.targetKcal,
      proteinG: c.target.proteinG,
      carbsG: c.target.carbsG,
      fatG: c.target.fatG,
    },
    remaining: {
      kcal: Math.round(c.remaining.kcal),
      proteinG: round1(c.remaining.proteinG),
      carbsG: round1(c.remaining.carbsG),
      fatG: round1(c.remaining.fatG),
    },
    percentOfTarget: {
      kcal: Math.round(c.percentOfTarget.kcal),
      proteinG: Math.round(c.percentOfTarget.proteinG),
      carbsG: Math.round(c.percentOfTarget.carbsG),
      fatG: Math.round(c.percentOfTarget.fatG),
    },
  }
}
