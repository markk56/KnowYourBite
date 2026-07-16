import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { getDb } from '../db/client'
import {
  assessmentTargets,
  clients,
  mealEntries,
  mealExtras,
  mealPlanDays,
  mealPlans,
  mealWindows,
  recipeAllergens,
  recipes,
  type AssessmentTargetRow,
  type MealEntryRow,
  type MealExtraRow,
  type MealPlanDayRow,
  type MealPlanRow,
  type MealWindowRow,
  type NewMealEntryRow,
  type NewMealExtraRow,
  type NewMealPlanDayRow,
  type NewMealPlanRow,
  type NewMealWindowRow,
  type RecipeAllergenRow,
  type RecipeRow,
} from '../db/schema'
import { activeForTenant } from '../db/tenantScope'

/**
 * Tenant-scoped meal-plans repository. Pure data access + batch loaders (the
 * deterministic roll-ups live in the service, which calls `@kyb/domain`). Every
 * method scopes to `tenantId`; unknown/other-tenant ids resolve to null/false so
 * routes emit 404. Structural children are loaded per-plan in one query each
 * (denormalized `plan_id`) to keep whole-plan assembly free of N+1.
 */
export const mealPlansRepository = {
  // ── Plans ─────────────────────────────────────────────────────────────────
  async findPlanRow(tenantId: string, id: string): Promise<MealPlanRow | null> {
    const [row] = await getDb()
      .select()
      .from(mealPlans)
      .where(and(activeForTenant(mealPlans, tenantId), eq(mealPlans.id, id)))
      .limit(1)
    return row ?? null
  },

  async listPlanRows(tenantId: string, clientId?: string): Promise<MealPlanRow[]> {
    const filters = [activeForTenant(mealPlans, tenantId)]
    if (clientId) filters.push(eq(mealPlans.clientId, clientId))
    return getDb()
      .select()
      .from(mealPlans)
      .where(and(...filters))
      .orderBy(desc(mealPlans.createdAt))
  },

  async createPlan(values: NewMealPlanRow): Promise<MealPlanRow> {
    const [row] = await getDb().insert(mealPlans).values(values).returning()
    if (!row) throw new Error('Failed to create meal plan')
    return row
  },

  async updatePlan(
    tenantId: string,
    id: string,
    patch: Partial<NewMealPlanRow>,
  ): Promise<MealPlanRow | null> {
    const [row] = await getDb()
      .update(mealPlans)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(activeForTenant(mealPlans, tenantId), eq(mealPlans.id, id)))
      .returning()
    return row ?? null
  },

  async softDeletePlan(tenantId: string, id: string): Promise<boolean> {
    const rows = await getDb()
      .update(mealPlans)
      .set({ deletedAt: new Date() })
      .where(and(activeForTenant(mealPlans, tenantId), eq(mealPlans.id, id)))
      .returning({ id: mealPlans.id })
    return rows.length > 0
  },

  // ── Days ──────────────────────────────────────────────────────────────────
  async insertDays(rows: NewMealPlanDayRow[]): Promise<MealPlanDayRow[]> {
    if (rows.length === 0) return []
    return getDb().insert(mealPlanDays).values(rows).returning()
  },

  async listDaysByPlan(tenantId: string, planId: string): Promise<MealPlanDayRow[]> {
    return getDb()
      .select()
      .from(mealPlanDays)
      .where(and(eq(mealPlanDays.tenantId, tenantId), eq(mealPlanDays.planId, planId)))
      .orderBy(asc(mealPlanDays.dayIndex))
  },

  async findDay(tenantId: string, dayId: string): Promise<MealPlanDayRow | null> {
    const [row] = await getDb()
      .select()
      .from(mealPlanDays)
      .where(and(eq(mealPlanDays.tenantId, tenantId), eq(mealPlanDays.id, dayId)))
      .limit(1)
    return row ?? null
  },

  async daysCountByPlans(tenantId: string, planIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    if (planIds.length === 0) return counts
    const rows = await getDb()
      .select({ planId: mealPlanDays.planId, id: mealPlanDays.id })
      .from(mealPlanDays)
      .where(and(eq(mealPlanDays.tenantId, tenantId), inArray(mealPlanDays.planId, planIds)))
    for (const r of rows) counts.set(r.planId, (counts.get(r.planId) ?? 0) + 1)
    return counts
  },

  // ── Windows ─────────────────────────────────────────────────────────────────
  async insertWindow(values: NewMealWindowRow): Promise<MealWindowRow> {
    const [row] = await getDb().insert(mealWindows).values(values).returning()
    if (!row) throw new Error('Failed to create meal window')
    return row
  },

  async insertWindows(rows: NewMealWindowRow[]): Promise<MealWindowRow[]> {
    if (rows.length === 0) return []
    return getDb().insert(mealWindows).values(rows).returning()
  },

  async listWindowsByPlan(tenantId: string, planId: string): Promise<MealWindowRow[]> {
    return getDb()
      .select()
      .from(mealWindows)
      .where(and(eq(mealWindows.tenantId, tenantId), eq(mealWindows.planId, planId)))
      .orderBy(asc(mealWindows.sortOrder), asc(mealWindows.createdAt))
  },

  async findWindow(tenantId: string, windowId: string): Promise<MealWindowRow | null> {
    const [row] = await getDb()
      .select()
      .from(mealWindows)
      .where(and(eq(mealWindows.tenantId, tenantId), eq(mealWindows.id, windowId)))
      .limit(1)
    return row ?? null
  },

  async updateWindow(
    tenantId: string,
    windowId: string,
    patch: Partial<Pick<NewMealWindowRow, 'name' | 'timeOfDay' | 'sortOrder'>>,
  ): Promise<MealWindowRow | null> {
    const [row] = await getDb()
      .update(mealWindows)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(mealWindows.tenantId, tenantId), eq(mealWindows.id, windowId)))
      .returning()
    return row ?? null
  },

  async deleteWindow(tenantId: string, windowId: string): Promise<boolean> {
    const rows = await getDb()
      .delete(mealWindows)
      .where(and(eq(mealWindows.tenantId, tenantId), eq(mealWindows.id, windowId)))
      .returning({ id: mealWindows.id })
    return rows.length > 0
  },

  async maxWindowSort(tenantId: string, dayId: string): Promise<number> {
    const rows = await getDb()
      .select({ sortOrder: mealWindows.sortOrder })
      .from(mealWindows)
      .where(and(eq(mealWindows.tenantId, tenantId), eq(mealWindows.dayId, dayId)))
    return rows.reduce((m, r) => Math.max(m, r.sortOrder), -1)
  },

  // ── Entries ─────────────────────────────────────────────────────────────────
  async insertEntry(values: NewMealEntryRow): Promise<MealEntryRow> {
    const [row] = await getDb().insert(mealEntries).values(values).returning()
    if (!row) throw new Error('Failed to add meal entry')
    return row
  },

  async listEntriesByPlan(tenantId: string, planId: string): Promise<MealEntryRow[]> {
    return getDb()
      .select()
      .from(mealEntries)
      .where(and(eq(mealEntries.tenantId, tenantId), eq(mealEntries.planId, planId)))
      .orderBy(asc(mealEntries.sortOrder), asc(mealEntries.createdAt))
  },

  async findEntry(tenantId: string, entryId: string): Promise<MealEntryRow | null> {
    const [row] = await getDb()
      .select()
      .from(mealEntries)
      .where(and(eq(mealEntries.tenantId, tenantId), eq(mealEntries.id, entryId)))
      .limit(1)
    return row ?? null
  },

  /** Update ONLY placement + multiplier. There is no ingredient-amount field to touch. */
  async updateEntry(
    tenantId: string,
    entryId: string,
    patch: Partial<Pick<NewMealEntryRow, 'servingMultiplier' | 'windowId' | 'sortOrder'>>,
  ): Promise<MealEntryRow | null> {
    const [row] = await getDb()
      .update(mealEntries)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(mealEntries.tenantId, tenantId), eq(mealEntries.id, entryId)))
      .returning()
    return row ?? null
  },

  async deleteEntry(tenantId: string, entryId: string): Promise<boolean> {
    const rows = await getDb()
      .delete(mealEntries)
      .where(and(eq(mealEntries.tenantId, tenantId), eq(mealEntries.id, entryId)))
      .returning({ id: mealEntries.id })
    return rows.length > 0
  },

  async maxEntrySort(tenantId: string, windowId: string): Promise<number> {
    const rows = await getDb()
      .select({ sortOrder: mealEntries.sortOrder })
      .from(mealEntries)
      .where(and(eq(mealEntries.tenantId, tenantId), eq(mealEntries.windowId, windowId)))
    return rows.reduce((m, r) => Math.max(m, r.sortOrder), -1)
  },

  async entryCountsByPlans(tenantId: string, planIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    if (planIds.length === 0) return counts
    const rows = await getDb()
      .select({ planId: mealEntries.planId, id: mealEntries.id })
      .from(mealEntries)
      .where(and(eq(mealEntries.tenantId, tenantId), inArray(mealEntries.planId, planIds)))
    for (const r of rows) counts.set(r.planId, (counts.get(r.planId) ?? 0) + 1)
    return counts
  },

  // ── Extras ──────────────────────────────────────────────────────────────────
  async insertExtra(values: NewMealExtraRow): Promise<MealExtraRow> {
    const [row] = await getDb().insert(mealExtras).values(values).returning()
    if (!row) throw new Error('Failed to add meal extra')
    return row
  },

  async listExtrasByPlan(tenantId: string, planId: string): Promise<MealExtraRow[]> {
    return getDb()
      .select()
      .from(mealExtras)
      .where(and(eq(mealExtras.tenantId, tenantId), eq(mealExtras.planId, planId)))
      .orderBy(asc(mealExtras.sortOrder), asc(mealExtras.createdAt))
  },

  async findExtra(tenantId: string, extraId: string): Promise<MealExtraRow | null> {
    const [row] = await getDb()
      .select()
      .from(mealExtras)
      .where(and(eq(mealExtras.tenantId, tenantId), eq(mealExtras.id, extraId)))
      .limit(1)
    return row ?? null
  },

  async updateExtra(
    tenantId: string,
    extraId: string,
    patch: Partial<
      Pick<NewMealExtraRow, 'amount' | 'unit' | 'gramsResolved' | 'windowId' | 'sortOrder'>
    >,
  ): Promise<MealExtraRow | null> {
    const [row] = await getDb()
      .update(mealExtras)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(mealExtras.tenantId, tenantId), eq(mealExtras.id, extraId)))
      .returning()
    return row ?? null
  },

  async deleteExtra(tenantId: string, extraId: string): Promise<boolean> {
    const rows = await getDb()
      .delete(mealExtras)
      .where(and(eq(mealExtras.tenantId, tenantId), eq(mealExtras.id, extraId)))
      .returning({ id: mealExtras.id })
    return rows.length > 0
  },

  async maxExtraSort(tenantId: string, windowId: string): Promise<number> {
    const rows = await getDb()
      .select({ sortOrder: mealExtras.sortOrder })
      .from(mealExtras)
      .where(and(eq(mealExtras.tenantId, tenantId), eq(mealExtras.windowId, windowId)))
    return rows.reduce((m, r) => Math.max(m, r.sortOrder), -1)
  },

  // ── Referenced data (recipes, allergens, targets, clients) ───────────────────
  /** Recipes referenced by entries — includes soft-deleted ones so titles survive. */
  async recipesByIds(tenantId: string, ids: string[]): Promise<RecipeRow[]> {
    if (ids.length === 0) return []
    return getDb()
      .select()
      .from(recipes)
      .where(and(eq(recipes.tenantId, tenantId), inArray(recipes.id, ids)))
  },

  async allergensByRecipeIds(tenantId: string, ids: string[]): Promise<RecipeAllergenRow[]> {
    if (ids.length === 0) return []
    return getDb()
      .select()
      .from(recipeAllergens)
      .where(and(eq(recipeAllergens.tenantId, tenantId), inArray(recipeAllergens.recipeId, ids)))
  },

  /** The client's most recently approved assessment targets (for the plan snapshot). */
  async latestApprovedTarget(
    tenantId: string,
    clientId: string,
  ): Promise<AssessmentTargetRow | null> {
    const [row] = await getDb()
      .select()
      .from(assessmentTargets)
      .where(and(eq(assessmentTargets.tenantId, tenantId), eq(assessmentTargets.clientId, clientId)))
      .orderBy(desc(assessmentTargets.approvedAt))
      .limit(1)
    return row ?? null
  },

  async clientName(tenantId: string, clientId: string): Promise<string | null> {
    const [row] = await getDb()
      .select({ fullName: clients.fullName })
      .from(clients)
      .where(and(activeForTenant(clients, tenantId), eq(clients.id, clientId)))
      .limit(1)
    return row?.fullName ?? null
  },

  async clientNamesByIds(tenantId: string, ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>()
    if (ids.length === 0) return names
    const rows = await getDb()
      .select({ id: clients.id, fullName: clients.fullName })
      .from(clients)
      // Include soft-deleted clients so a plan still shows a name.
      .where(and(eq(clients.tenantId, tenantId), inArray(clients.id, ids)))
    for (const r of rows) names.set(r.id, r.fullName)
    return names
  },

  /** Verify a client belongs to the tenant (active) — used before creating a plan. */
  async clientExists(tenantId: string, clientId: string): Promise<boolean> {
    const [row] = await getDb()
      .select({ id: clients.id })
      .from(clients)
      .where(and(activeForTenant(clients, tenantId), eq(clients.id, clientId)))
      .limit(1)
    return !!row
  },

  /** True when the recipe exists for the tenant and is not soft-deleted. */
  async activeRecipeExists(tenantId: string, recipeId: string): Promise<boolean> {
    const [row] = await getDb()
      .select({ id: recipes.id })
      .from(recipes)
      .where(
        and(eq(recipes.tenantId, tenantId), eq(recipes.id, recipeId), isNull(recipes.deletedAt)),
      )
      .limit(1)
    return !!row
  },
}
