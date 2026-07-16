import { z } from 'zod'

/**
 * USDA FoodData Central contract (Milestone 3). The web client searches foods and
 * reads a food's normalized per-100g nutrients; the server is the only tier that
 * talks to USDA and normalizes the raw JSON (deterministically, in `@kyb/domain`).
 * Clinical logic always runs on the canonical English description in this DTO.
 */

export const USDA_DATA_TYPES = ['foundation', 'sr_legacy', 'branded'] as const
export type UsdaDataType = (typeof USDA_DATA_TYPES)[number]

export const LOCALES = ['en', 'ro', 'hu'] as const
export type Locale = (typeof LOCALES)[number]

/** The canonical macro vector used everywhere (grams, except kcal). */
export interface NutrientsDto {
  kcal: number
  proteinG: number
  fatG: number
  carbG: number
  fiberG: number
  saltG: number
}

/** A normalized food (search hit or detail) — per-100g, canonical English. */
export interface UsdaFoodDto {
  fdcId: number
  dataType: UsdaDataType
  descriptionEn: string
  per100g: NutrientsDto
  basisUnit: string // '100g'
  /** True when served from our own `usda_food_cache` (no upstream call). */
  cached: boolean
}

export const usdaSearchQuerySchema = z.object({
  query: z.string().trim().min(2, 'Enter at least 2 characters').max(120),
  includeBranded: z.boolean().optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
})
export type UsdaSearchQuery = z.infer<typeof usdaSearchQuerySchema>

export interface UsdaSearchResult {
  foods: UsdaFoodDto[]
  /** True when USDA was unreachable and results came from cache only. */
  degraded: boolean
}
