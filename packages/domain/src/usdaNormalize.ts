import type { Nutrients } from './nutrition'
import { validateNutritionPer100g, type ValidationIssue } from './validator'

/**
 * Deterministic USDA → per-100g normalization (ARCHITECTURE §8.1, roadmap M3).
 * Pure and test-first: it turns a raw FoodData Central food object into a frozen
 * per-100g nutrient vector, converting kJ→kcal and Branded per-serving→per-100g,
 * then runs the plausibility gate. It **fails closed** — malformed or implausible
 * data throws {@link UsdaNormalizationError} and is never persisted (the recipe
 * snapshot can only ever hold validated numbers).
 *
 * No I/O here — the server's USDA client fetches the JSON; this module is the
 * single trusted place that interprets it.
 */

export type UsdaDataType = 'foundation' | 'sr_legacy' | 'branded'

export class UsdaNormalizationError extends Error {
  constructor(
    message: string,
    public readonly issues: ValidationIssue[] = [],
  ) {
    super(message)
    this.name = 'UsdaNormalizationError'
  }
}

/** Stable USDA nutrient *numbers* (dataset-independent, unlike nutrientId). */
const NUTRIENT = {
  energyKcal: '208',
  energyAtwaterGeneral: '957',
  energyAtwaterSpecific: '958',
  energyKj: '268',
  protein: '203',
  fat: '204',
  carb: '205',
  fiber: '291',
  sodium: '307',
} as const

const KJ_PER_KCAL = 4.184
/** WHO convention: salt (g) = sodium (g) × 2.5; USDA sodium is mg/100g. */
const SODIUM_MG_TO_SALT_G = 2.5 / 1000

interface RawFoodNutrient {
  number?: string
  nutrientNumber?: string
  amount?: number
  value?: number
  unitName?: string
  nutrient?: { number?: string; unitName?: string; name?: string }
}

interface RawFood {
  fdcId?: number
  description?: string
  dataType?: string
  foodNutrients?: unknown
  labelNutrients?: Record<string, { value?: number } | undefined>
  servingSize?: number
  servingSizeUnit?: string
}

/** "Foundation" | "SR Legacy" | "Branded" → our enum; Survey/FNDDS is excluded (throws). */
export function normalizeDataType(usdaDataType: string | undefined): UsdaDataType {
  switch ((usdaDataType ?? '').toLowerCase().replace(/[\s()]+/g, '_').replace(/_+$/g, '')) {
    case 'foundation':
    case 'foundation_food':
      return 'foundation'
    case 'sr_legacy':
    case 'sr_legacy_food':
      return 'sr_legacy'
    case 'branded':
      return 'branded'
    default:
      throw new UsdaNormalizationError(`Unsupported USDA dataType "${usdaDataType ?? '(none)'}"`)
  }
}

/**
 * Index a `foodNutrients` array by nutrient number, tolerating both the detail
 * shape (`nutrient.number` + `amount`) and the search shape (`nutrientNumber` +
 * `value`). First occurrence per number wins.
 */
function buildNutrientMap(foodNutrients: unknown): Map<string, number> {
  const map = new Map<string, number>()
  if (!Array.isArray(foodNutrients)) return map
  for (const raw of foodNutrients) {
    if (!raw || typeof raw !== 'object') continue
    const fn = raw as RawFoodNutrient
    const number = fn.number ?? fn.nutrientNumber ?? fn.nutrient?.number
    const amount = typeof fn.amount === 'number' ? fn.amount : typeof fn.value === 'number' ? fn.value : undefined
    if (!number || amount === undefined || !Number.isFinite(amount)) continue
    if (!map.has(number)) map.set(number, amount)
  }
  return map
}

/** kcal from an explicit kcal number, else Atwater factors, else kJ→kcal. */
function resolveKcal(map: Map<string, number>): number | undefined {
  const kcal =
    map.get(NUTRIENT.energyKcal) ??
    map.get(NUTRIENT.energyAtwaterSpecific) ??
    map.get(NUTRIENT.energyAtwaterGeneral)
  if (kcal !== undefined) return kcal
  const kj = map.get(NUTRIENT.energyKj)
  return kj !== undefined ? kj / KJ_PER_KCAL : undefined
}

/** Per-100g nutrients from a Foundation / SR Legacy foodNutrients array (already per 100 g). */
function fromPer100gNutrients(food: RawFood): Nutrients {
  const map = buildNutrientMap(food.foodNutrients)
  const kcal = resolveKcal(map)
  if (kcal === undefined) {
    throw new UsdaNormalizationError('USDA food is missing an energy value')
  }
  const sodiumMg = map.get(NUTRIENT.sodium) ?? 0
  return {
    kcal,
    proteinG: map.get(NUTRIENT.protein) ?? 0,
    fatG: map.get(NUTRIENT.fat) ?? 0,
    carbG: map.get(NUTRIENT.carb) ?? 0,
    fiberG: map.get(NUTRIENT.fiber) ?? 0,
    saltG: sodiumMg * SODIUM_MG_TO_SALT_G,
  }
}

/**
 * Per-100g nutrients from a Branded food's `labelNutrients` (per serving) scaled
 * by `servingSize`. Only gram servings are convertible; ml/other units need a
 * density we don't have, so they throw (roadmap: "reject un-convertible units").
 * Falls back to a per-100g `foodNutrients` array when the label is unusable.
 */
function fromBranded(food: RawFood): Nutrients {
  const label = food.labelNutrients
  const servingSize = food.servingSize
  const unit = (food.servingSizeUnit ?? '').toLowerCase()
  const isGramServing = unit === 'g' || unit === 'grm' || unit === 'gram' || unit === 'grams'

  if (label && typeof servingSize === 'number' && servingSize > 0) {
    if (!isGramServing) {
      throw new UsdaNormalizationError(
        `Branded serving unit "${food.servingSizeUnit ?? '(none)'}" is not convertible to grams`,
      )
    }
    const factor = 100 / servingSize
    const val = (key: string): number => {
      const entry = label[key]
      return entry && typeof entry.value === 'number' && Number.isFinite(entry.value) ? entry.value : 0
    }
    const kcal = val('calories')
    if (kcal <= 0) {
      throw new UsdaNormalizationError('Branded label is missing calories')
    }
    return {
      kcal: kcal * factor,
      proteinG: val('protein') * factor,
      fatG: val('fat') * factor,
      carbG: val('carbohydrates') * factor,
      fiberG: val('fiber') * factor,
      saltG: val('sodium') * SODIUM_MG_TO_SALT_G * factor,
    }
  }

  // No usable label — some Branded records still carry per-100g foodNutrients.
  return fromPer100gNutrients(food)
}

export interface NormalizedFood {
  fdcId: number
  dataType: UsdaDataType
  descriptionEn: string
  per100g: Nutrients
  basisUnit: '100g'
}

/**
 * Normalize a raw USDA food object to a validated per-100g snapshot. Throws
 * {@link UsdaNormalizationError} for malformed input or when the result fails the
 * plausibility gate (≤900 kcal/100g, Atwater energy balance).
 */
export function normalizeUsdaFood(raw: unknown): NormalizedFood {
  if (!raw || typeof raw !== 'object') {
    throw new UsdaNormalizationError('USDA food payload is not an object')
  }
  const food = raw as RawFood
  if (typeof food.fdcId !== 'number' || !Number.isInteger(food.fdcId)) {
    throw new UsdaNormalizationError('USDA food is missing a numeric fdcId')
  }
  const description = (food.description ?? '').trim()
  if (!description) {
    throw new UsdaNormalizationError('USDA food is missing a description')
  }

  const dataType = normalizeDataType(food.dataType)
  const per100g = dataType === 'branded' ? fromBranded(food) : fromPer100gNutrients(food)

  // Round to 2 decimals to match the storage precision (numeric(_,2)); this also
  // keeps the frozen snapshot byte-stable regardless of USDA float tails.
  const rounded: Nutrients = {
    kcal: round2(per100g.kcal),
    proteinG: round2(per100g.proteinG),
    fatG: round2(per100g.fatG),
    carbG: round2(per100g.carbG),
    fiberG: round2(per100g.fiberG),
    saltG: round2(per100g.saltG),
  }

  const issues = validateNutritionPer100g(rounded)
  if (issues.length > 0) {
    throw new UsdaNormalizationError(
      `USDA food failed the plausibility gate: ${issues.map((i) => i.message).join('; ')}`,
      issues,
    )
  }

  return { fdcId: food.fdcId, dataType, descriptionEn: description, per100g: rounded, basisUnit: '100g' }
}

/** Non-throwing wrapper — returns null instead of throwing (for best-effort search hydration). */
export function tryNormalizeUsdaFood(raw: unknown): NormalizedFood | null {
  try {
    return normalizeUsdaFood(raw)
  } catch {
    return null
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
