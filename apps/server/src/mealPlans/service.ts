import { toGrams, type QuantityUnit } from '@kyb/domain'
import {
  PERIOD_DAY_COUNT,
  type AddEntryInput,
  type AddExtraInput,
  type AddWindowInput,
  type Allergen,
  type ErrorCode,
  type MealPlanCreateInput,
  type MealPlanDto,
  type MealPlanSummaryDto,
  type MealPlanUpdateInput,
  type UpdateEntryInput,
  type UpdateExtraInput,
  type UpdateWindowInput,
} from '@kyb/shared'
import { resolveFood, UsdaNormalizationError } from '../usda/cache'
import {
  assembleMealPlanDto,
  assembleSummaryDto,
  recipeRefFromRow,
  type RecipeRef,
} from './assemble'
import { mealPlansRepository } from './repository'
import type { NewMealWindowRow } from '../db/schema'

/** A service-level error the router maps directly onto the response envelope. */
export class ServiceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

const repo = mealPlansRepository

/** Default meal windows scaffolded into every new day (renameable in the UI). */
const DEFAULT_WINDOWS: Array<{ name: string; timeOfDay: string }> = [
  { name: 'Breakfast', timeOfDay: '08:00' },
  { name: 'Lunch', timeOfDay: '12:30' },
  { name: 'Dinner', timeOfDay: '18:30' },
]

// ── Assembly loaders ────────────────────────────────────────────────────────

/** Load the recipe refs (per-serving snapshot + allergens + missing flag) for a set of entries. */
async function loadRecipeRefs(
  tenantId: string,
  entries: readonly MealEntryRow[],
): Promise<Map<string, RecipeRef>> {
  const ids = [...new Set(entries.map((e) => e.recipeId))]
  const [recipeRows, allergenRows] = await Promise.all([
    repo.recipesByIds(tenantId, ids),
    repo.allergensByRecipeIds(tenantId, ids),
  ])
  const allergensByRecipe = new Map<string, Allergen[]>()
  for (const a of allergenRows) {
    const list = allergensByRecipe.get(a.recipeId) ?? []
    list.push(a.allergen)
    allergensByRecipe.set(a.recipeId, list)
  }
  const map = new Map<string, RecipeRef>()
  for (const row of recipeRows) {
    map.set(row.id, recipeRefFromRow(row, allergensByRecipe.get(row.id) ?? []))
  }
  return map
}

/** Load + assemble a full plan DTO or throw NOT_FOUND. */
export async function getPlan(tenantId: string, id: string): Promise<MealPlanDto> {
  const plan = await repo.findPlanRow(tenantId, id)
  if (!plan) throw new ServiceError('NOT_FOUND', 'Meal plan not found')
  const [days, windows, entries, extras, clientName] = await Promise.all([
    repo.listDaysByPlan(tenantId, id),
    repo.listWindowsByPlan(tenantId, id),
    repo.listEntriesByPlan(tenantId, id),
    repo.listExtrasByPlan(tenantId, id),
    repo.clientName(tenantId, plan.clientId),
  ])
  const recipesById = await loadRecipeRefs(tenantId, entries)
  return assembleMealPlanDto({
    plan,
    clientName: clientName ?? 'Unknown client',
    days,
    windows,
    entries,
    extras,
    recipesById,
  })
}

// ── Plans ────────────────────────────────────────────────────────────────────

export async function listPlans(tenantId: string, clientId?: string): Promise<MealPlanSummaryDto[]> {
  const rows = await repo.listPlanRows(tenantId, clientId)
  const ids = rows.map((r) => r.id)
  const clientIds = [...new Set(rows.map((r) => r.clientId))]
  const [names, dayCounts, entryCounts] = await Promise.all([
    repo.clientNamesByIds(tenantId, clientIds),
    repo.daysCountByPlans(tenantId, ids),
    repo.entryCountsByPlans(tenantId, ids),
  ])
  return rows.map((row) =>
    assembleSummaryDto(
      row,
      names.get(row.clientId) ?? 'Unknown client',
      dayCounts.get(row.id) ?? 0,
      entryCounts.get(row.id) ?? 0,
    ),
  )
}

/**
 * Create a plan: verify the client, SNAPSHOT the client's latest approved targets
 * (so re-assessing never moves an existing plan's goalposts), scaffold the day(s)
 * for the period and a set of default windows in each. Returns the full plan.
 */
export async function createPlan(tenantId: string, input: MealPlanCreateInput): Promise<MealPlanDto> {
  const exists = await repo.clientExists(tenantId, input.clientId)
  if (!exists) throw new ServiceError('NOT_FOUND', 'Client not found')

  const target = await repo.latestApprovedTarget(tenantId, input.clientId)

  const plan = await repo.createPlan({
    tenantId,
    clientId: input.clientId,
    title: input.title,
    period: input.period,
    status: 'draft',
    startDate: input.startDate ?? null,
    notes: input.notes ?? null,
    sourceTargetId: target?.id ?? null,
    targetKcal: target?.targetKcal ?? null,
    targetProteinG: target?.proteinG ?? null,
    targetCarbsG: target?.carbsG ?? null,
    targetFatG: target?.fatG ?? null,
  })

  const dayCount = PERIOD_DAY_COUNT[input.period]
  const days = await repo.insertDays(
    Array.from({ length: dayCount }, (_v, i) => ({
      tenantId,
      planId: plan.id,
      dayIndex: i,
      label: null,
    })),
  )
  const windowRows: NewMealWindowRow[] = days.flatMap((day) =>
    DEFAULT_WINDOWS.map((w, i) => ({
      tenantId,
      planId: plan.id,
      dayId: day.id,
      name: w.name,
      timeOfDay: w.timeOfDay,
      sortOrder: i,
    })),
  )
  await repo.insertWindows(windowRows)

  return getPlan(tenantId, plan.id)
}

/** Allowed lifecycle transitions (duplication → a fresh draft is a separate op). */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['complete'],
  complete: ['exported', 'draft'],
  exported: ['reopened'],
  reopened: ['complete', 'exported'],
}

export async function updatePlan(
  tenantId: string,
  id: string,
  patch: MealPlanUpdateInput,
): Promise<MealPlanDto> {
  const plan = await repo.findPlanRow(tenantId, id)
  if (!plan) throw new ServiceError('NOT_FOUND', 'Meal plan not found')

  const set: Record<string, unknown> = {}
  if (patch.title !== undefined) set.title = patch.title
  if (patch.startDate !== undefined) set.startDate = patch.startDate ?? null
  if (patch.notes !== undefined) set.notes = patch.notes ?? null
  if (patch.status !== undefined && patch.status !== plan.status) {
    const allowed = STATUS_TRANSITIONS[plan.status] ?? []
    if (!allowed.includes(patch.status)) {
      throw new ServiceError('CONFLICT', `Cannot move a ${plan.status} plan to ${patch.status}`)
    }
    set.status = patch.status
  }

  if (Object.keys(set).length > 0) await repo.updatePlan(tenantId, id, set)
  return getPlan(tenantId, id)
}

export async function deletePlan(tenantId: string, id: string): Promise<void> {
  const deleted = await repo.softDeletePlan(tenantId, id)
  if (!deleted) throw new ServiceError('NOT_FOUND', 'Meal plan not found')
}

// ── Windows ──────────────────────────────────────────────────────────────────

/** Verify a day belongs to the plan (and tenant); returns it or throws NOT_FOUND. */
async function requireDayInPlan(tenantId: string, planId: string, dayId: string) {
  const day = await repo.findDay(tenantId, dayId)
  if (!day || day.planId !== planId) throw new ServiceError('NOT_FOUND', 'Day not found')
  return day
}

/** Verify a window belongs to the plan (and tenant); returns it or throws NOT_FOUND. */
async function requireWindowInPlan(tenantId: string, planId: string, windowId: string) {
  const window = await repo.findWindow(tenantId, windowId)
  if (!window || window.planId !== planId) throw new ServiceError('NOT_FOUND', 'Meal window not found')
  return window
}

export async function addWindow(
  tenantId: string,
  planId: string,
  input: AddWindowInput,
): Promise<MealPlanDto> {
  const plan = await repo.findPlanRow(tenantId, planId)
  if (!plan) throw new ServiceError('NOT_FOUND', 'Meal plan not found')
  await requireDayInPlan(tenantId, planId, input.dayId)
  const nextSort = (await repo.maxWindowSort(tenantId, input.dayId)) + 1
  await repo.insertWindow({
    tenantId,
    planId,
    dayId: input.dayId,
    name: input.name,
    timeOfDay: input.timeOfDay ?? null,
    sortOrder: nextSort,
  })
  return getPlan(tenantId, planId)
}

export async function updateWindow(
  tenantId: string,
  planId: string,
  windowId: string,
  input: UpdateWindowInput,
): Promise<MealPlanDto> {
  await requireWindowInPlan(tenantId, planId, windowId)
  const patch: Partial<Pick<NewMealWindowRow, 'name' | 'timeOfDay' | 'sortOrder'>> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.timeOfDay !== undefined) patch.timeOfDay = input.timeOfDay ?? null
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  await repo.updateWindow(tenantId, windowId, patch)
  return getPlan(tenantId, planId)
}

export async function removeWindow(
  tenantId: string,
  planId: string,
  windowId: string,
): Promise<MealPlanDto> {
  await requireWindowInPlan(tenantId, planId, windowId)
  await repo.deleteWindow(tenantId, windowId) // cascades its entries + extras
  return getPlan(tenantId, planId)
}

// ── Entries (recipe + multiplier only) ───────────────────────────────────────

export async function addEntry(
  tenantId: string,
  planId: string,
  input: AddEntryInput,
): Promise<MealPlanDto> {
  const plan = await repo.findPlanRow(tenantId, planId)
  if (!plan) throw new ServiceError('NOT_FOUND', 'Meal plan not found')
  await requireWindowInPlan(tenantId, planId, input.windowId)
  const recipeOk = await repo.activeRecipeExists(tenantId, input.recipeId)
  if (!recipeOk) throw new ServiceError('NOT_FOUND', 'Recipe not found')

  const nextSort = (await repo.maxEntrySort(tenantId, input.windowId)) + 1
  await repo.insertEntry({
    tenantId,
    planId,
    windowId: input.windowId,
    recipeId: input.recipeId,
    servingMultiplier: String(input.servingMultiplier),
    sortOrder: nextSort,
  })
  return getPlan(tenantId, planId)
}

export async function updateEntry(
  tenantId: string,
  planId: string,
  entryId: string,
  input: UpdateEntryInput,
): Promise<MealPlanDto> {
  const entry = await repo.findEntry(tenantId, entryId)
  if (!entry || entry.planId !== planId) throw new ServiceError('NOT_FOUND', 'Meal entry not found')

  const patch: { servingMultiplier?: string; windowId?: string; sortOrder?: number } = {}
  if (input.servingMultiplier !== undefined) patch.servingMultiplier = String(input.servingMultiplier)
  if (input.windowId !== undefined) {
    // The target window must belong to the SAME plan (and tenant).
    await requireWindowInPlan(tenantId, planId, input.windowId)
    patch.windowId = input.windowId
    // Default to the end of the target window unless an explicit order is given.
    patch.sortOrder = input.sortOrder ?? (await repo.maxEntrySort(tenantId, input.windowId)) + 1
  } else if (input.sortOrder !== undefined) {
    patch.sortOrder = input.sortOrder
  }
  await repo.updateEntry(tenantId, entryId, patch)
  return getPlan(tenantId, planId)
}

export async function removeEntry(
  tenantId: string,
  planId: string,
  entryId: string,
): Promise<MealPlanDto> {
  const entry = await repo.findEntry(tenantId, entryId)
  if (!entry || entry.planId !== planId) throw new ServiceError('NOT_FOUND', 'Meal entry not found')
  await repo.deleteEntry(tenantId, entryId)
  return getPlan(tenantId, planId)
}

// ── Extras (standalone USDA food, frozen snapshot) ────────────────────────────

function resolveGrams(input: {
  amount: number
  unit: string
  densityGPerMl?: number
  gramsPerPiece?: number
}): number {
  try {
    return toGrams(input.amount, input.unit as QuantityUnit, {
      densityGPerMl: input.densityGPerMl,
      gramsPerPiece: input.gramsPerPiece,
    })
  } catch (e) {
    throw new ServiceError('VALIDATION_ERROR', e instanceof Error ? e.message : 'Could not convert to grams')
  }
}

export async function addExtra(
  tenantId: string,
  planId: string,
  input: AddExtraInput,
): Promise<MealPlanDto> {
  const plan = await repo.findPlanRow(tenantId, planId)
  if (!plan) throw new ServiceError('NOT_FOUND', 'Meal plan not found')
  await requireWindowInPlan(tenantId, planId, input.windowId)

  let resolved
  try {
    resolved = await resolveFood(input.fdcId)
  } catch (e) {
    if (e instanceof UsdaNormalizationError) {
      throw new ServiceError('VALIDATION_ERROR', 'Food data could not be used')
    }
    throw e
  }
  if (!resolved) throw new ServiceError('NOT_FOUND', 'Food unavailable')

  const grams = resolveGrams(input)
  const per100g = resolved.food.per100g
  const nextSort = (await repo.maxExtraSort(tenantId, input.windowId)) + 1

  await repo.insertExtra({
    tenantId,
    planId,
    windowId: input.windowId,
    sortOrder: nextSort,
    fdcId: resolved.food.fdcId,
    canonicalNameEn: resolved.food.descriptionEn,
    amount: String(input.amount),
    unit: input.unit,
    gramsResolved: String(round2(grams)),
    kcalPer100g: String(per100g.kcal),
    proteinPer100g: String(per100g.proteinG),
    carbsPer100g: String(per100g.carbG),
    fatPer100g: String(per100g.fatG),
    fiberPer100g: String(per100g.fiberG),
    saltPer100g: String(per100g.saltG),
    basisUnit: resolved.food.basisUnit,
    snapshotJson: per100g,
    fetchedAt: new Date(),
  })
  return getPlan(tenantId, planId)
}

export async function updateExtra(
  tenantId: string,
  planId: string,
  extraId: string,
  input: UpdateExtraInput,
): Promise<MealPlanDto> {
  const extra = await repo.findExtra(tenantId, extraId)
  if (!extra || extra.planId !== planId) throw new ServiceError('NOT_FOUND', 'Meal extra not found')

  const patch: Partial<{
    amount: string
    unit: string
    gramsResolved: string
    windowId: string
    sortOrder: number
  }> = {}

  const amountChanged = input.amount !== undefined || input.unit !== undefined
  if (amountChanged) {
    const amount = input.amount ?? Number(extra.amount)
    const unit = input.unit ?? extra.unit
    const grams = resolveGrams({
      amount,
      unit,
      densityGPerMl: input.densityGPerMl,
      gramsPerPiece: input.gramsPerPiece,
    })
    patch.amount = String(amount)
    patch.unit = unit
    patch.gramsResolved = String(round2(grams))
  }
  if (input.windowId !== undefined) {
    await requireWindowInPlan(tenantId, planId, input.windowId)
    patch.windowId = input.windowId
    patch.sortOrder = input.sortOrder ?? (await repo.maxExtraSort(tenantId, input.windowId)) + 1
  } else if (input.sortOrder !== undefined) {
    patch.sortOrder = input.sortOrder
  }
  // The frozen per-100g snapshot is never touched — only the authored amount/placement.
  await repo.updateExtra(tenantId, extraId, patch)
  return getPlan(tenantId, planId)
}

export async function removeExtra(
  tenantId: string,
  planId: string,
  extraId: string,
): Promise<MealPlanDto> {
  const extra = await repo.findExtra(tenantId, extraId)
  if (!extra || extra.planId !== planId) throw new ServiceError('NOT_FOUND', 'Meal extra not found')
  await repo.deleteExtra(tenantId, extraId)
  return getPlan(tenantId, planId)
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
