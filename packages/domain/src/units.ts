import { assertNonNegative, assertPositive } from './assert'

/**
 * Deterministic unit conversion to grams — the canonical mass basis for all
 * nutrition math. USDA nutrient values are per 100 g, so every ingredient
 * quantity must be reducible to grams. Volumes need a density (g/ml); "piece"
 * units need a grams-per-piece. When required context is missing we throw
 * rather than guess, so nutrition can never be computed from an ambiguous unit.
 */

export type MassUnit = 'mg' | 'g' | 'kg'
export type VolumeUnit = 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup'
export type CountUnit = 'piece'
export type QuantityUnit = MassUnit | VolumeUnit | CountUnit

const MASS_TO_GRAMS: Record<MassUnit, number> = { mg: 0.001, g: 1, kg: 1000 }

// Volume units expressed in millilitres (US customary spoons/cup).
const VOLUME_TO_ML: Record<VolumeUnit, number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
}

export interface ConversionContext {
  /** Density in g/ml. Required for volume units. Water ≈ 1.0. */
  densityGPerMl?: number
  /** Mass of a single piece in grams. Required for the "piece" unit. */
  gramsPerPiece?: number
}

function isMassUnit(unit: QuantityUnit): unit is MassUnit {
  return unit === 'mg' || unit === 'g' || unit === 'kg'
}

function isVolumeUnit(unit: QuantityUnit): unit is VolumeUnit {
  return unit === 'ml' || unit === 'l' || unit === 'tsp' || unit === 'tbsp' || unit === 'cup'
}

/** Convert a `quantity` in `unit` to grams. */
export function toGrams(quantity: number, unit: QuantityUnit, context: ConversionContext = {}): number {
  assertNonNegative('quantity', quantity)

  if (isMassUnit(unit)) {
    return quantity * MASS_TO_GRAMS[unit]
  }

  if (isVolumeUnit(unit)) {
    if (context.densityGPerMl === undefined) {
      throw new Error(`Volume unit "${unit}" requires a densityGPerMl to convert to grams`)
    }
    assertPositive('densityGPerMl', context.densityGPerMl)
    return quantity * VOLUME_TO_ML[unit] * context.densityGPerMl
  }

  // count unit: 'piece'
  if (context.gramsPerPiece === undefined) {
    throw new Error('Unit "piece" requires a gramsPerPiece to convert to grams')
  }
  assertPositive('gramsPerPiece', context.gramsPerPiece)
  return quantity * context.gramsPerPiece
}
