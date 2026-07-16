import { describe, it, expect } from 'vitest'
import { buildRecipeDocDefinition, type RecipeExportSnapshot } from './recipeDoc'

const base: RecipeExportSnapshot = {
  title: 'Grilled Chicken & Rice',
  locale: 'en',
  baseServings: 2,
  servingsRequested: 4,
  ingredients: [
    { canonicalNameEn: 'Chicken breast', amount: 400, unit: 'g', gramsResolved: 400 },
    { canonicalNameEn: 'Rice, white', amount: 300, unit: 'g', gramsResolved: 300 },
  ],
  total: { kcal: 1320, proteinG: 130, fatG: 15, carbG: 170, fiberG: 2, saltG: 1.2 },
  perServing: { kcal: 330, proteinG: 32.5, fatG: 3.75, carbG: 42.5, fiberG: 0.5, saltG: 0.3 },
  allergens: ['gluten'],
  instructions: 'Grill the chicken. Boil the rice.',
  notes: null,
  storageRecommendation: null,
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  clinicName: null,
  generatedAtIso: '2026-07-16T00:00:00.000Z',
}

function texts(doc: ReturnType<typeof buildRecipeDocDefinition>): string {
  return JSON.stringify(doc.content)
}

describe('buildRecipeDocDefinition', () => {
  it('renders the title and localized sections (EN)', () => {
    const doc = buildRecipeDocDefinition(base)
    const s = texts(doc)
    expect(s).toContain('Grilled Chicken & Rice')
    expect(s).toContain('Ingredients')
    expect(s).toContain('Nutrition')
    expect(s).toContain('Allergens')
    expect(s).toContain('Preparation')
  })

  it('lists every ingredient line', () => {
    const s = texts(buildRecipeDocDefinition(base))
    expect(s).toContain('Chicken breast')
    expect(s).toContain('Rice, white')
  })

  it('uses a decimal comma for RO/HU locales', () => {
    const ro = buildRecipeDocDefinition({ ...base, locale: 'ro' })
    const s = texts(ro)
    // per-serving protein 32.5 → "32,5" in RO
    expect(s).toContain('32,5')
    expect(s).toContain('Valori nutriționale')
  })

  it('shows a no-allergens note when the list is empty', () => {
    const s = texts(buildRecipeDocDefinition({ ...base, allergens: [] }))
    expect(s).toContain('No major allergens detected')
  })

  it('sets A4 page size and the document title', () => {
    const doc = buildRecipeDocDefinition(base)
    expect(doc.pageSize).toBe('A4')
    expect(doc.info?.title).toBe('Grilled Chicken & Rice')
  })
})
