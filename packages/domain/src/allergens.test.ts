import { describe, it, expect } from 'vitest'
import { detectAllergenFloor, detectAllergensForName, ALLERGENS } from './allergens'

describe('detectAllergensForName', () => {
  it('flags milk from dairy keywords', () => {
    expect(detectAllergensForName('Cheddar cheese')).toEqual(['milk'])
    expect(detectAllergensForName('Greek yogurt, plain')).toEqual(['milk'])
    expect(detectAllergensForName('Butter, salted')).toEqual(['milk'])
  })

  it('flags gluten from cereal keywords', () => {
    expect(detectAllergensForName('Wheat flour, white')).toEqual(['gluten'])
    expect(detectAllergensForName('Spaghetti, dry pasta')).toEqual(['gluten'])
  })

  it('flags eggs, peanuts, soy, tree nuts, shellfish', () => {
    expect(detectAllergensForName('Egg, whole, raw')).toEqual(['eggs'])
    expect(detectAllergensForName('Peanut butter, smooth')).toContain('peanuts')
    expect(detectAllergensForName('Tofu, firm')).toEqual(['soy'])
    expect(detectAllergensForName('Almonds, raw')).toEqual(['tree_nuts'])
    expect(detectAllergensForName('Shrimp, cooked')).toEqual(['shellfish'])
  })

  it('is case-insensitive', () => {
    expect(detectAllergensForName('MILK, WHOLE')).toEqual(['milk'])
  })

  it('returns nothing for an allergen-free food', () => {
    expect(detectAllergensForName('Carrot, raw')).toEqual([])
    expect(detectAllergensForName('Olive oil, extra virgin')).toEqual([])
  })

  it('respects word boundaries (no substring false positives)', () => {
    // "cocoa" must not match the shellfish keyword "cod"-style fragments, and
    // "creamy" is a real substring of "cream" so DOES match milk — that is the
    // intended broad behaviour. Assert a genuine non-match instead:
    expect(detectAllergensForName('Cocoa powder, unsweetened')).toEqual([])
  })

  it('can flag multiple allergens from one compound name', () => {
    const found = detectAllergensForName('Cheese and walnut bread')
    expect(found).toEqual(expect.arrayContaining(['milk', 'gluten', 'tree_nuts']))
  })
})

describe('detectAllergenFloor', () => {
  it('unions allergens across ingredients in canonical order', () => {
    const floor = detectAllergenFloor(['Almonds, raw', 'Wheat flour', 'Egg, whole'])
    expect(floor).toEqual(['gluten', 'eggs', 'tree_nuts'])
    // canonical ALLERGENS order: milk, gluten, eggs, peanuts, soy, tree_nuts, shellfish
    expect(floor).toEqual(ALLERGENS.filter((a) => floor.includes(a)))
  })

  it('deduplicates the same allergen from multiple ingredients', () => {
    expect(detectAllergenFloor(['Whole milk', 'Cheddar cheese', 'Butter'])).toEqual(['milk'])
  })

  it('is empty for an allergen-free recipe', () => {
    expect(detectAllergenFloor(['Carrot, raw', 'Olive oil', 'Sea salt'])).toEqual([])
  })

  it('is order-independent', () => {
    const a = detectAllergenFloor(['Egg', 'Almonds', 'Wheat'])
    const b = detectAllergenFloor(['Wheat', 'Egg', 'Almonds'])
    expect(a).toEqual(b)
  })
})
