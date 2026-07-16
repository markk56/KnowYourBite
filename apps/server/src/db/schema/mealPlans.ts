import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { idColumn, softDelete, timestamps } from '../columns'
import { clients } from './clients'
import { recipes } from './recipes'

/**
 * Meal-planning cluster (Milestone 4) — the flagship module. The tree is
 *
 *   meal_plans → meal_plan_days → meal_windows → { meal_entries, meal_extras }
 *
 * Recipe integrity (ADR §5) is enforced by *shape*: `meal_entries` stores only a
 * `recipe_id` + a `serving_multiplier` (CHECK > 0). There is deliberately no
 * column anywhere in this cluster that can address an ingredient amount, so a plan
 * can only ever change *how many servings* of a recipe — never a gram of it. The
 * `target_*` columns are a SNAPSHOT of the client's latest approved
 * `assessment_targets` taken at plan-creation, so re-assessing a client never
 * silently moves an existing plan's goalposts.
 *
 * Structural children (days/windows/entries/extras) CASCADE from their parent —
 * they are wholly-owned rows, not clinical entities; the plan itself is
 * soft-deleted (the CASCADE ban applies to clients/recipes/plans/assessments).
 */

export const mealPlanPeriodEnum = pgEnum('meal_plan_period', ['day', 'week'])
export const mealPlanStatusEnum = pgEnum('meal_plan_status', [
  'draft',
  'complete',
  'exported',
  'reopened',
])

export const mealPlans = pgTable(
  'meal_plans',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    period: mealPlanPeriodEnum('period').notNull(),
    status: mealPlanStatusEnum('status').notNull().default('draft'),
    startDate: text('start_date'), // ISO "YYYY-MM-DD", nullable
    notes: text('notes'),

    // SNAPSHOT of the client's latest approved assessment_targets at creation time.
    // Nullable — a plan can be created before any assessment is completed.
    sourceTargetId: uuid('source_target_id'),
    targetKcal: numeric('target_kcal', { precision: 7, scale: 1 }),
    targetProteinG: numeric('target_protein_g', { precision: 6, scale: 1 }),
    targetCarbsG: numeric('target_carbs_g', { precision: 6, scale: 1 }),
    targetFatG: numeric('target_fat_g', { precision: 6, scale: 1 }),

    ...timestamps,
    ...softDelete,
  },
  (t) => ({
    tenantIdx: index('meal_plans_tenant_idx').on(t.tenantId),
    tenantClientIdx: index('meal_plans_tenant_client_idx').on(t.tenantId, t.clientId),
  }),
)

export const mealPlanDays = pgTable(
  'meal_plan_days',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => mealPlans.id, { onDelete: 'cascade' }),
    dayIndex: integer('day_index').notNull(), // 0-based (0 for a single-day plan)
    label: text('label'),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index('meal_plan_days_tenant_idx').on(t.tenantId),
    planDayUniq: uniqueIndex('meal_plan_days_plan_day_uniq').on(t.planId, t.dayIndex),
  }),
)

export const mealWindows = pgTable(
  'meal_windows',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => mealPlans.id, { onDelete: 'cascade' }),
    dayId: uuid('day_id')
      .notNull()
      .references(() => mealPlanDays.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // "Breakfast", "Lunch", …
    timeOfDay: text('time_of_day'), // "HH:MM" for the calendar TimeAxis, nullable
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index('meal_windows_tenant_idx').on(t.tenantId),
    dayIdx: index('meal_windows_day_idx').on(t.dayId, t.sortOrder),
    planIdx: index('meal_windows_plan_idx').on(t.planId),
  }),
)

/**
 * A recipe placed in a window. `recipe_id` + `serving_multiplier` ONLY — this is
 * the structural heart of recipe integrity. `onDelete: 'restrict'` on the recipe
 * is belt-and-braces (recipes are soft-deleted, never hard-deleted); a
 * soft-deleted recipe leaves the entry intact and the roll-up flags it missing.
 */
export const mealEntries = pgTable(
  'meal_entries',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => mealPlans.id, { onDelete: 'cascade' }),
    windowId: uuid('window_id')
      .notNull()
      .references(() => mealWindows.id, { onDelete: 'cascade' }),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'restrict' }),
    servingMultiplier: numeric('serving_multiplier', { precision: 5, scale: 2 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index('meal_entries_tenant_idx').on(t.tenantId),
    windowIdx: index('meal_entries_window_idx').on(t.windowId, t.sortOrder),
    planIdx: index('meal_entries_plan_idx').on(t.planId),
    multiplierPositive: check('meal_entries_multiplier_positive', sql`${t.servingMultiplier} > 0`),
  }),
)

/**
 * A standalone USDA food in a window — carries a FROZEN per-100g snapshot exactly
 * like `recipe_ingredients`, so mutating the global cache never changes a plan's
 * nutrition. Wholly-owned child of the window (CASCADE permitted).
 */
export const mealExtras = pgTable(
  'meal_extras',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => mealPlans.id, { onDelete: 'cascade' }),
    windowId: uuid('window_id')
      .notNull()
      .references(() => mealWindows.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),

    fdcId: integer('fdc_id').notNull(),
    canonicalNameEn: text('canonical_name_en').notNull(),
    amount: numeric('amount', { precision: 9, scale: 2 }).notNull(),
    unit: text('unit').notNull(),
    gramsResolved: numeric('grams_resolved', { precision: 9, scale: 2 }).notNull(),

    // FROZEN per-100g snapshot (immutable after write).
    kcalPer100g: numeric('kcal_per_100g', { precision: 8, scale: 2 }).notNull(),
    proteinPer100g: numeric('protein_per_100g', { precision: 7, scale: 2 }).notNull(),
    carbsPer100g: numeric('carbs_per_100g', { precision: 7, scale: 2 }).notNull(),
    fatPer100g: numeric('fat_per_100g', { precision: 7, scale: 2 }).notNull(),
    fiberPer100g: numeric('fiber_per_100g', { precision: 7, scale: 2 }).notNull().default('0'),
    saltPer100g: numeric('salt_per_100g', { precision: 7, scale: 2 }).notNull().default('0'),
    basisUnit: text('basis_unit').notNull().default('100g'),
    snapshotJson: jsonb('snapshot_json'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index('meal_extras_tenant_idx').on(t.tenantId),
    windowIdx: index('meal_extras_window_idx').on(t.windowId, t.sortOrder),
    planIdx: index('meal_extras_plan_idx').on(t.planId),
    kcalPlausible: check(
      'meal_extras_kcal_plausible',
      sql`${t.kcalPer100g} >= 0 AND ${t.kcalPer100g} <= 900`,
    ),
  }),
)

export type MealPlanRow = typeof mealPlans.$inferSelect
export type NewMealPlanRow = typeof mealPlans.$inferInsert
export type MealPlanDayRow = typeof mealPlanDays.$inferSelect
export type NewMealPlanDayRow = typeof mealPlanDays.$inferInsert
export type MealWindowRow = typeof mealWindows.$inferSelect
export type NewMealWindowRow = typeof mealWindows.$inferInsert
export type MealEntryRow = typeof mealEntries.$inferSelect
export type NewMealEntryRow = typeof mealEntries.$inferInsert
export type MealExtraRow = typeof mealExtras.$inferSelect
export type NewMealExtraRow = typeof mealExtras.$inferInsert
