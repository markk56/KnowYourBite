import { z } from 'zod'
import type { NutrientsDto } from './usda'
import { INGREDIENT_UNITS, VOLUME_UNITS, type Allergen, type IngredientUnit } from './recipes'

/**
 * Meal-planning contract (Milestone 4) — the flagship module. A plan is a tree:
 *
 *   meal_plan → days → windows → { entries (recipe + multiplier), extras (frozen food) }
 *
 * Recipe integrity is enforced *structurally*: an entry carries only a
 * `recipeId` + a `servingMultiplier` from a fixed allowed set. There is no field
 * anywhere in this contract that can address an ingredient gram, so neither the UI
 * nor (later) the AI can alter a recipe's authored amounts (ARCHITECTURE §5). All
 * nutrition numbers are derived server-side from `@kyb/domain` and returned on the
 * DTO; the client never sends nutrient values.
 */

// ── Enums / allowed sets ───────────────────────────────────────────────────────

export const MEAL_PLAN_PERIODS = ['day', 'week'] as const
export type MealPlanPeriod = (typeof MEAL_PLAN_PERIODS)[number]

/** Draft → Complete → Exported → Reopened (duplication makes a fresh Draft). */
export const MEAL_PLAN_STATUSES = ['draft', 'complete', 'exported', 'reopened'] as const
export type MealPlanStatus = (typeof MEAL_PLAN_STATUSES)[number]

/**
 * The ONLY serving multipliers a meal entry may take (ADR §5 — recipe integrity).
 * The segmented control and the DB both enforce this set; nothing continuous.
 */
export const SERVING_MULTIPLIERS = [1, 1.25, 1.5, 2] as const
export type ServingMultiplier = (typeof SERVING_MULTIPLIERS)[number]

export function isServingMultiplier(v: number): v is ServingMultiplier {
  return (SERVING_MULTIPLIERS as readonly number[]).includes(v)
}

const servingMultiplierSchema = z
  .number()
  .refine(isServingMultiplier, { message: 'Serving multiplier must be one of 1, 1.25, 1.5, 2' })

/** Number of days scaffolded for each period. */
export const PERIOD_DAY_COUNT: Record<MealPlanPeriod, number> = { day: 1, week: 7 }

// ── DTOs ───────────────────────────────────────────────────────────────────────

/** A recipe placed into a meal window; nutrition is the recipe's live per-serving × multiplier. */
export interface MealEntryDto {
  id: string
  recipeId: string
  recipeTitle: string
  /** True when the referenced recipe was since deleted — contribution counts as 0. */
  recipeMissing: boolean
  servingMultiplier: number
  /** The recipe's authored servings (context for the multiplier control). */
  recipeServings: number
  /** The recipe's current per-serving nutrients (from its frozen ingredient snapshots). */
  perServing: NutrientsDto
  /** perServing × servingMultiplier. */
  contribution: NutrientsDto
  /** The recipe's confirmed/detected allergens (for at-a-glance conflict flags). */
  allergens: Allergen[]
  sortOrder: number
}

/** A standalone USDA food added straight into a window (frozen snapshot, like an ingredient). */
export interface MealExtraDto {
  id: string
  fdcId: number
  canonicalNameEn: string
  amount: number
  unit: IngredientUnit
  gramsResolved: number
  per100g: NutrientsDto
  contribution: NutrientsDto
  sortOrder: number
}

export interface MealWindowDto {
  id: string
  dayId: string
  name: string
  /** Optional clock time for the calendar TimeAxis, "HH:MM" (08:00–20:00). */
  timeOfDay: string | null
  sortOrder: number
  entries: MealEntryDto[]
  extras: MealExtraDto[]
  /** Σ entries + extras in this window. */
  nutrition: NutrientsDto
}

/** The per-day clinical target snapshotted onto the plan at creation. */
export interface MealPlanTargetDto {
  targetKcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface TargetDeltaDto {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface DayTargetComparisonDto {
  target: MealPlanTargetDto
  remaining: TargetDeltaDto
  percentOfTarget: TargetDeltaDto
}

export interface MealPlanDayDto {
  id: string
  dayIndex: number
  label: string | null
  windows: MealWindowDto[]
  /** Σ all windows in the day. */
  nutrition: NutrientsDto
  /** Present only when the plan carries a snapshotted target. */
  targetComparison: DayTargetComparisonDto | null
}

/** Full plan with the whole tree + deterministic roll-ups. */
export interface MealPlanDto {
  id: string
  clientId: string
  clientName: string
  title: string
  period: MealPlanPeriod
  status: MealPlanStatus
  /** ISO date (YYYY-MM-DD) the plan starts, or null. */
  startDate: string | null
  notes: string | null
  target: MealPlanTargetDto | null
  days: MealPlanDayDto[]
  /** Σ every day (the week total, or the single day). */
  total: NutrientsDto
  /** total ÷ number of days — the per-day average, comparable to the day target. */
  perDayAverage: NutrientsDto
  createdAt: string
  updatedAt: string
}

/** Lightweight row for the plans dashboard. */
export interface MealPlanSummaryDto {
  id: string
  clientId: string
  clientName: string
  title: string
  period: MealPlanPeriod
  status: MealPlanStatus
  startDate: string | null
  dayCount: number
  entryCount: number
  targetKcal: number | null
  createdAt: string
  updatedAt: string
}

// ── Input schemas ──────────────────────────────────────────────────────────────

const optionalText = (max: number) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().max(max).optional())

/** ISO calendar date, "YYYY-MM-DD". */
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)')

export const mealPlanCreateInputSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  period: z.enum(MEAL_PLAN_PERIODS),
  startDate: z.preprocess((v) => (v === '' || v == null ? undefined : v), isoDateSchema.optional()),
  notes: optionalText(5000),
})
export type MealPlanCreateInput = z.infer<typeof mealPlanCreateInputSchema>

export const mealPlanUpdateInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    startDate: z.preprocess(
      (v) => (v === '' ? null : v),
      z.union([isoDateSchema, z.null()]).optional(),
    ),
    notes: z.preprocess((v) => (v === '' ? null : v), z.union([z.string().trim().max(5000), z.null()]).optional()),
    status: z.enum(MEAL_PLAN_STATUSES).optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.startDate !== undefined ||
      v.notes !== undefined ||
      v.status !== undefined,
    { message: 'Nothing to update' },
  )
export type MealPlanUpdateInput = z.infer<typeof mealPlanUpdateInputSchema>

// Windows
export const addWindowInputSchema = z.object({
  dayId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  timeOfDay: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM').optional(),
  ),
})
export type AddWindowInput = z.infer<typeof addWindowInputSchema>

export const updateWindowInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    timeOfDay: z.preprocess(
      (v) => (v === '' ? null : v),
      z.union([z.string().regex(/^\d{2}:\d{2}$/), z.null()]).optional(),
    ),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((v) => v.name !== undefined || v.timeOfDay !== undefined || v.sortOrder !== undefined, {
    message: 'Nothing to update',
  })
export type UpdateWindowInput = z.infer<typeof updateWindowInputSchema>

// Entries (recipe + multiplier ONLY — no gram-addressing field exists by design)
export const addEntryInputSchema = z.object({
  windowId: z.string().uuid(),
  recipeId: z.string().uuid(),
  servingMultiplier: servingMultiplierSchema.default(1),
})
export type AddEntryInput = z.infer<typeof addEntryInputSchema>

export const updateEntryInputSchema = z
  .object({
    servingMultiplier: servingMultiplierSchema.optional(),
    /** Move to another window (drag-and-drop). Ownership is re-verified server-side. */
    windowId: z.string().uuid().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine(
    (v) => v.servingMultiplier !== undefined || v.windowId !== undefined || v.sortOrder !== undefined,
    { message: 'Nothing to update' },
  )
export type UpdateEntryInput = z.infer<typeof updateEntryInputSchema>

// Extras (identical resolve-to-grams shape as a recipe ingredient)
export const addExtraInputSchema = z
  .object({
    windowId: z.string().uuid(),
    fdcId: z.number().int().positive(),
    amount: z.number().positive().max(1_000_000),
    unit: z.enum(INGREDIENT_UNITS),
    densityGPerMl: z.number().positive().max(20).optional(),
    gramsPerPiece: z.number().positive().max(1_000_000).optional(),
  })
  .refine((v) => !(VOLUME_UNITS.includes(v.unit) && v.densityGPerMl === undefined), {
    message: 'A density (g/ml) is required for volume units',
    path: ['densityGPerMl'],
  })
  .refine((v) => !(v.unit === 'piece' && v.gramsPerPiece === undefined), {
    message: 'A grams-per-piece is required for the "piece" unit',
    path: ['gramsPerPiece'],
  })
export type AddExtraInput = z.infer<typeof addExtraInputSchema>

export const updateExtraInputSchema = z
  .object({
    amount: z.number().positive().max(1_000_000).optional(),
    unit: z.enum(INGREDIENT_UNITS).optional(),
    windowId: z.string().uuid().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    densityGPerMl: z.number().positive().max(20).optional(),
    gramsPerPiece: z.number().positive().max(1_000_000).optional(),
  })
  .refine(
    (v) =>
      v.amount !== undefined ||
      v.unit !== undefined ||
      v.windowId !== undefined ||
      v.sortOrder !== undefined,
    { message: 'Nothing to update' },
  )
export type UpdateExtraInput = z.infer<typeof updateExtraInputSchema>

export interface MealPlanListQuery {
  clientId?: string
}
