import { describe, it, expect } from 'vitest'
import { normalizeUsdaFood, tryNormalizeUsdaFood, UsdaNormalizationError, normalizeDataType } from './usdaNormalize'

/** Foundation/SR Legacy detail shape: nutrient.number + amount, per 100 g. */
const carrotDetail = {
  fdcId: 2258586,
  description: 'Carrots, raw',
  dataType: 'Foundation',
  foodNutrients: [
    { nutrient: { number: '208', unitName: 'KCAL' }, amount: 41 },
    { nutrient: { number: '203', unitName: 'G' }, amount: 0.93 },
    { nutrient: { number: '204', unitName: 'G' }, amount: 0.24 },
    { nutrient: { number: '205', unitName: 'G' }, amount: 9.58 },
    { nutrient: { number: '291', unitName: 'G' }, amount: 2.8 },
    { nutrient: { number: '307', unitName: 'MG' }, amount: 69 },
  ],
}

describe('normalizeDataType', () => {
  it('maps the USDA labels to our enum', () => {
    expect(normalizeDataType('Foundation')).toBe('foundation')
    expect(normalizeDataType('SR Legacy')).toBe('sr_legacy')
    expect(normalizeDataType('Branded')).toBe('branded')
  })

  it('rejects Survey/FNDDS and unknowns', () => {
    expect(() => normalizeDataType('Survey (FNDDS)')).toThrow(UsdaNormalizationError)
    expect(() => normalizeDataType(undefined)).toThrow(UsdaNormalizationError)
  })
})

describe('normalizeUsdaFood — Foundation / SR Legacy', () => {
  it('reads per-100g nutrients and converts sodium→salt', () => {
    const n = normalizeUsdaFood(carrotDetail)
    expect(n.fdcId).toBe(2258586)
    expect(n.dataType).toBe('foundation')
    expect(n.descriptionEn).toBe('Carrots, raw')
    expect(n.per100g.kcal).toBe(41)
    expect(n.per100g.proteinG).toBe(0.93)
    expect(n.per100g.fatG).toBe(0.24)
    expect(n.per100g.carbG).toBe(9.58)
    expect(n.per100g.fiberG).toBe(2.8)
    // salt = 69 mg sodium × 2.5 / 1000 = 0.1725 → round2 → 0.17
    expect(n.per100g.saltG).toBe(0.17)
  })

  it('reads the search shape (nutrientNumber + value)', () => {
    const search = {
      fdcId: 999,
      description: 'Egg, whole, raw',
      dataType: 'SR Legacy',
      foodNutrients: [
        { nutrientNumber: '208', value: 143 },
        { nutrientNumber: '203', value: 12.6 },
        { nutrientNumber: '204', value: 9.9 },
        { nutrientNumber: '205', value: 0.72 },
      ],
    }
    const n = normalizeUsdaFood(search)
    expect(n.dataType).toBe('sr_legacy')
    expect(n.per100g.kcal).toBe(143)
    expect(n.per100g.proteinG).toBe(12.6)
  })

  it('converts kJ→kcal when only kJ energy is present', () => {
    const n = normalizeUsdaFood({
      fdcId: 5,
      description: 'Apple',
      dataType: 'Foundation',
      foodNutrients: [
        { nutrient: { number: '268', unitName: 'kJ' }, amount: 218 }, // 218 / 4.184 ≈ 52.1
        { nutrient: { number: '203' }, amount: 0.26 },
        { nutrient: { number: '204' }, amount: 0.17 },
        { nutrient: { number: '205' }, amount: 13.8 },
      ],
    })
    expect(n.per100g.kcal).toBeCloseTo(52.1, 1)
  })

  it('accepts the pure-oil edge (≈884 kcal, 100 g fat)', () => {
    const n = normalizeUsdaFood({
      fdcId: 748608,
      description: 'Oil, olive, extra virgin',
      dataType: 'SR Legacy',
      foodNutrients: [
        { nutrient: { number: '208' }, amount: 884 },
        { nutrient: { number: '204' }, amount: 100 },
        { nutrient: { number: '203' }, amount: 0 },
        { nutrient: { number: '205' }, amount: 0 },
      ],
    })
    expect(n.per100g.kcal).toBe(884)
    expect(n.per100g.fatG).toBe(100)
  })
})

describe('normalizeUsdaFood — Branded conversion', () => {
  it('converts labelNutrients per serving to per-100g', () => {
    // 55 g serving → factor 100/55 ≈ 1.818
    const n = normalizeUsdaFood({
      fdcId: 12345,
      description: 'Crunchy Cereal',
      dataType: 'Branded',
      servingSize: 55,
      servingSizeUnit: 'g',
      labelNutrients: {
        calories: { value: 210 },
        protein: { value: 4 },
        fat: { value: 3 },
        carbohydrates: { value: 42 },
        fiber: { value: 5 },
        sodium: { value: 190 },
      },
    })
    expect(n.dataType).toBe('branded')
    expect(n.per100g.kcal).toBeCloseTo(381.82, 1)
    expect(n.per100g.proteinG).toBeCloseTo(7.27, 1)
    expect(n.per100g.carbG).toBeCloseTo(76.36, 1)
  })

  it('rejects a non-gram (ml) branded serving as un-convertible', () => {
    expect(() =>
      normalizeUsdaFood({
        fdcId: 3,
        description: 'Almond Drink',
        dataType: 'Branded',
        servingSize: 240,
        servingSizeUnit: 'ml',
        labelNutrients: { calories: { value: 30 } },
      }),
    ).toThrow(UsdaNormalizationError)
  })
})

describe('normalizeUsdaFood — fail-closed', () => {
  it('rejects an implausible >900 kcal/100g food', () => {
    expect(() =>
      normalizeUsdaFood({
        fdcId: 7,
        description: 'Impossible food',
        dataType: 'Foundation',
        foodNutrients: [{ nutrient: { number: '208' }, amount: 1200 }],
      }),
    ).toThrow(UsdaNormalizationError)
  })

  it('rejects a food with no energy value', () => {
    expect(() =>
      normalizeUsdaFood({
        fdcId: 8,
        description: 'No energy',
        dataType: 'Foundation',
        foodNutrients: [{ nutrient: { number: '203' }, amount: 5 }],
      }),
    ).toThrow(UsdaNormalizationError)
  })

  it('rejects missing fdcId / description', () => {
    expect(() => normalizeUsdaFood({ description: 'x', dataType: 'Foundation' })).toThrow(UsdaNormalizationError)
    expect(() => normalizeUsdaFood({ fdcId: 1, dataType: 'Foundation' })).toThrow(UsdaNormalizationError)
  })

  it('tryNormalizeUsdaFood returns null instead of throwing', () => {
    expect(tryNormalizeUsdaFood({ garbage: true })).toBeNull()
    expect(tryNormalizeUsdaFood(carrotDetail)).not.toBeNull()
  })
})
