import { describe, it, expect } from 'vitest'
import {
  addEntryInputSchema,
  addExtraInputSchema,
  isServingMultiplier,
  mealPlanCreateInputSchema,
  updateEntryInputSchema,
} from './mealPlans'

describe('serving multiplier — fixed allowed set (recipe integrity)', () => {
  it('accepts only {1, 1.25, 1.5, 2}', () => {
    expect(isServingMultiplier(1)).toBe(true)
    expect(isServingMultiplier(1.25)).toBe(true)
    expect(isServingMultiplier(2)).toBe(true)
    expect(isServingMultiplier(1.3)).toBe(false)
    expect(isServingMultiplier(3)).toBe(false)
    expect(isServingMultiplier(0)).toBe(false)
  })

  it('addEntry rejects a multiplier outside the set', () => {
    expect(
      addEntryInputSchema.safeParse({
        windowId: '11111111-1111-1111-1111-111111111111',
        recipeId: '22222222-2222-2222-2222-222222222222',
        servingMultiplier: 1.3,
      }).success,
    ).toBe(false)
  })

  it('addEntry defaults the multiplier to 1', () => {
    const parsed = addEntryInputSchema.parse({
      windowId: '11111111-1111-1111-1111-111111111111',
      recipeId: '22222222-2222-2222-2222-222222222222',
    })
    expect(parsed.servingMultiplier).toBe(1)
  })

  it('has no field that could address an ingredient gram', () => {
    // The entry contract is recipeId + multiplier + placement only.
    const keys = Object.keys(addEntryInputSchema.shape)
    expect(keys.sort()).toEqual(['recipeId', 'servingMultiplier', 'windowId'])
  })
})

describe('mealPlanCreateInputSchema', () => {
  it('requires a client, title and period', () => {
    expect(
      mealPlanCreateInputSchema.safeParse({
        clientId: '33333333-3333-3333-3333-333333333333',
        title: 'Week 1',
        period: 'week',
      }).success,
    ).toBe(true)
  })

  it('rejects an unknown period and a malformed date', () => {
    expect(
      mealPlanCreateInputSchema.safeParse({
        clientId: '33333333-3333-3333-3333-333333333333',
        title: 'x',
        period: 'fortnight',
      }).success,
    ).toBe(false)
    expect(
      mealPlanCreateInputSchema.safeParse({
        clientId: '33333333-3333-3333-3333-333333333333',
        title: 'x',
        period: 'day',
        startDate: '07/16/2026',
      }).success,
    ).toBe(false)
  })
})

describe('extras — resolve-to-grams guard rails', () => {
  it('requires a density for a volume unit', () => {
    const r = addExtraInputSchema.safeParse({
      windowId: '11111111-1111-1111-1111-111111111111',
      fdcId: 100,
      amount: 200,
      unit: 'ml',
    })
    expect(r.success).toBe(false)
  })

  it('accepts grams directly', () => {
    const r = addExtraInputSchema.safeParse({
      windowId: '11111111-1111-1111-1111-111111111111',
      fdcId: 100,
      amount: 120,
      unit: 'g',
    })
    expect(r.success).toBe(true)
  })
})

describe('updateEntryInputSchema', () => {
  it('rejects an empty patch', () => {
    expect(updateEntryInputSchema.safeParse({}).success).toBe(false)
  })

  it('accepts a window move (drag-and-drop)', () => {
    expect(
      updateEntryInputSchema.safeParse({ windowId: '44444444-4444-4444-4444-444444444444' }).success,
    ).toBe(true)
  })
})
