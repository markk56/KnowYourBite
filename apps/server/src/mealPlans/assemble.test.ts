import { describe, it, expect } from 'vitest'
import { assembleMealPlanDto, recipeRefFromRow, type RecipeRef } from './assemble'
import type {
  MealEntryRow,
  MealExtraRow,
  MealPlanDayRow,
  MealPlanRow,
  MealWindowRow,
  RecipeRow,
} from '../db/schema'

// ── Fixtures (only the fields the assembler reads; rest cast away) ──────────────

function plan(overrides: Partial<MealPlanRow> = {}): MealPlanRow {
  return {
    id: 'plan-1',
    tenantId: 't1',
    clientId: 'c1',
    title: 'Week 1',
    period: 'day',
    status: 'draft',
    startDate: null,
    notes: null,
    sourceTargetId: null,
    targetKcal: null,
    targetProteinG: null,
    targetCarbsG: null,
    targetFatG: null,
    createdAt: new Date('2026-07-16T00:00:00Z'),
    updatedAt: new Date('2026-07-16T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as MealPlanRow
}

const day: MealPlanDayRow = {
  id: 'day-1',
  tenantId: 't1',
  planId: 'plan-1',
  dayIndex: 0,
  label: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as MealPlanDayRow

const window: MealWindowRow = {
  id: 'win-1',
  tenantId: 't1',
  planId: 'plan-1',
  dayId: 'day-1',
  name: 'Breakfast',
  timeOfDay: '08:00',
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
} as MealWindowRow

function entry(overrides: Partial<MealEntryRow> = {}): MealEntryRow {
  return {
    id: 'entry-1',
    tenantId: 't1',
    planId: 'plan-1',
    windowId: 'win-1',
    recipeId: 'recipe-1',
    servingMultiplier: '1',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as MealEntryRow
}

// A recipe with total 800 kcal / 40 P / 90 C / 25 F over 2 servings → 400/20/45/12.5 per serving.
function recipeRef(overrides: Partial<RecipeRef> = {}): RecipeRef {
  return {
    title: 'Oatmeal',
    servings: 2,
    perServing: { kcal: 400, proteinG: 20, fatG: 12.5, carbG: 45, fiberG: 5, saltG: 0.3 },
    missing: false,
    allergens: ['gluten'],
    ...overrides,
  }
}

describe('assembleMealPlanDto', () => {
  it('computes entry contribution = recipe per-serving × multiplier', () => {
    const dto = assembleMealPlanDto({
      plan: plan(),
      clientName: 'Jane',
      days: [day],
      windows: [window],
      entries: [entry({ servingMultiplier: '1.5' })],
      extras: [],
      recipesById: new Map([['recipe-1', recipeRef()]]),
    })
    const e = dto.days[0]!.windows[0]!.entries[0]!
    expect(e.contribution.kcal).toBe(600) // 400 × 1.5
    expect(e.contribution.proteinG).toBeCloseTo(30)
    expect(e.perServing.kcal).toBe(400)
    expect(e.allergens).toEqual(['gluten'])
  })

  it('a missing (deleted) recipe contributes zero but keeps the row', () => {
    const dto = assembleMealPlanDto({
      plan: plan(),
      clientName: 'Jane',
      days: [day],
      windows: [window],
      entries: [entry()],
      extras: [],
      recipesById: new Map([['recipe-1', recipeRef({ missing: true })]]),
    })
    const e = dto.days[0]!.windows[0]!.entries[0]!
    expect(e.recipeMissing).toBe(true)
    expect(e.contribution.kcal).toBe(0)
    expect(dto.total.kcal).toBe(0)
  })

  it('rolls window → day → plan totals and averages per day', () => {
    const dto = assembleMealPlanDto({
      plan: plan({ period: 'day' }),
      clientName: 'Jane',
      days: [day],
      windows: [window],
      entries: [entry({ servingMultiplier: '2' })], // 400×2 = 800 kcal
      extras: [extra()],
      recipesById: new Map([['recipe-1', recipeRef()]]),
    })
    // entry 800 + extra (banana 89/100g × 100g = 89)
    expect(dto.days[0]!.windows[0]!.nutrition.kcal).toBe(889)
    expect(dto.days[0]!.nutrition.kcal).toBe(889)
    expect(dto.total.kcal).toBe(889)
    expect(dto.perDayAverage.kcal).toBe(889) // single day
  })

  it('surfaces a day target comparison only when the plan snapshotted a target', () => {
    const withTarget = assembleMealPlanDto({
      plan: plan({ targetKcal: '2000', targetProteinG: '150', targetCarbsG: '200', targetFatG: '70' }),
      clientName: 'Jane',
      days: [day],
      windows: [window],
      entries: [entry({ servingMultiplier: '1' })], // 400 kcal
      extras: [],
      recipesById: new Map([['recipe-1', recipeRef()]]),
    })
    const cmp = withTarget.days[0]!.targetComparison!
    expect(cmp.target.targetKcal).toBe(2000)
    expect(cmp.remaining.kcal).toBe(1600)
    expect(cmp.percentOfTarget.kcal).toBe(20)

    const noTarget = assembleMealPlanDto({
      plan: plan(),
      clientName: 'Jane',
      days: [day],
      windows: [window],
      entries: [],
      extras: [],
      recipesById: new Map(),
    })
    expect(noTarget.days[0]!.targetComparison).toBeNull()
    expect(noTarget.target).toBeNull()
  })
})

describe('recipeRefFromRow', () => {
  it('derives per-serving = cached total ÷ authored servings', () => {
    const row = {
      id: 'r',
      title: 'Stew',
      servings: 4,
      totalKcal: '1200',
      totalProteinG: '80',
      totalCarbsG: '100',
      totalFatG: '40',
      totalFiberG: '16',
      totalSaltG: '4',
      deletedAt: null,
    } as RecipeRow
    const ref = recipeRefFromRow(row, [])
    expect(ref.perServing.kcal).toBe(300) // 1200 / 4
    expect(ref.perServing.proteinG).toBe(20)
    expect(ref.missing).toBe(false)
  })
})

// Banana extra: 89 kcal/100g, 100 g resolved.
function extra(overrides: Partial<MealExtraRow> = {}): MealExtraRow {
  return {
    id: 'extra-1',
    tenantId: 't1',
    planId: 'plan-1',
    windowId: 'win-1',
    sortOrder: 0,
    fdcId: 1105314,
    canonicalNameEn: 'Banana, raw',
    amount: '100',
    unit: 'g',
    gramsResolved: '100',
    kcalPer100g: '89',
    proteinPer100g: '1.1',
    carbsPer100g: '23',
    fatPer100g: '0.3',
    fiberPer100g: '2.6',
    saltPer100g: '0',
    basisUnit: '100g',
    snapshotJson: null,
    fetchedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as MealExtraRow
}
