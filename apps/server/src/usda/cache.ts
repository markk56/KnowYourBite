import { eq, ilike } from 'drizzle-orm'
import {
  normalizeUsdaFood,
  tryNormalizeUsdaFood,
  UsdaNormalizationError,
  type NormalizedFood,
} from '@kyb/domain'
import type { UsdaFoodDto, UsdaSearchResult } from '@kyb/shared'
import { getDb } from '../db/client'
import { usdaFoodCache, type UsdaFoodCacheRow } from '../db/schema'
import { isUsdaEnabled, usdaFoodDetail, usdaSearch, type UsdaSearchOptions } from './client'

/**
 * Cache-first USDA pipeline (ADR §7). The global `usda_food_cache` is the durable
 * store; recipe ingredients copy a FROZEN snapshot from a resolved food, so
 * mutating the cache later never changes existing recipe nutrition (integrity).
 *
 * - `resolveFood` — read cache; on miss fetch upstream ONCE, normalize, write
 *   through, and return. A malformed/implausible food throws (never persisted).
 * - `searchFoods` — short-TTL memoized search; write-through each hit; degrade to
 *   a cache-only description search when USDA is unreachable.
 */

const num = (v: string | null): number => (v == null ? 0 : Number(v))

function rowToNormalized(row: UsdaFoodCacheRow): NormalizedFood {
  return {
    fdcId: row.fdcId,
    dataType: row.dataType,
    descriptionEn: row.descriptionEn,
    per100g: {
      kcal: num(row.kcalPer100g),
      proteinG: num(row.proteinPer100g),
      fatG: num(row.fatPer100g),
      carbG: num(row.carbsPer100g),
      fiberG: num(row.fiberPer100g),
      saltG: num(row.saltPer100g),
    },
    basisUnit: '100g',
  }
}

export function toUsdaFoodDto(food: NormalizedFood, cached: boolean): UsdaFoodDto {
  return {
    fdcId: food.fdcId,
    dataType: food.dataType,
    descriptionEn: food.descriptionEn,
    per100g: food.per100g,
    basisUnit: food.basisUnit,
    cached,
  }
}

async function readCache(fdcId: number): Promise<UsdaFoodCacheRow | null> {
  const [row] = await getDb().select().from(usdaFoodCache).where(eq(usdaFoodCache.fdcId, fdcId)).limit(1)
  return row ?? null
}

async function writeThrough(food: NormalizedFood, raw: unknown): Promise<void> {
  const values = {
    fdcId: food.fdcId,
    dataType: food.dataType,
    descriptionEn: food.descriptionEn,
    kcalPer100g: String(food.per100g.kcal),
    proteinPer100g: String(food.per100g.proteinG),
    carbsPer100g: String(food.per100g.carbG),
    fatPer100g: String(food.per100g.fatG),
    fiberPer100g: String(food.per100g.fiberG),
    saltPer100g: String(food.per100g.saltG),
    basisUnit: food.basisUnit,
    rawJson: (raw ?? {}) as object,
    fetchedAt: new Date(),
  }
  await getDb()
    .insert(usdaFoodCache)
    .values(values)
    .onConflictDoUpdate({ target: usdaFoodCache.fdcId, set: values })
}

export interface ResolvedFood {
  food: NormalizedFood
  cached: boolean
}

/**
 * Resolve a single food to a validated per-100g snapshot, cache-first. Returns
 * null when the food is not cached and USDA is unavailable. Throws
 * {@link UsdaNormalizationError} when upstream returns malformed/implausible data.
 */
export async function resolveFood(fdcId: number): Promise<ResolvedFood | null> {
  const cachedRow = await readCache(fdcId)
  if (cachedRow) return { food: rowToNormalized(cachedRow), cached: true }

  if (!isUsdaEnabled()) return null
  let raw: unknown
  try {
    raw = await usdaFoodDetail(fdcId)
  } catch {
    return null // upstream down — degrade (no cache entry to serve)
  }
  const food = normalizeUsdaFood(raw) // throws UsdaNormalizationError on bad data
  await writeThrough(food, raw)
  return { food, cached: false }
}

// ── Search (short-TTL memo + write-through + cache-only degradation) ────────────

interface SearchMemoEntry {
  at: number
  foods: UsdaFoodDto[]
}
const SEARCH_TTL_MS = 60_000
const searchMemo = new Map<string, SearchMemoEntry>()

async function cacheOnlySearch(query: string, pageSize: number): Promise<UsdaFoodDto[]> {
  const rows = await getDb()
    .select()
    .from(usdaFoodCache)
    .where(ilike(usdaFoodCache.descriptionEn, `%${query}%`))
    .limit(pageSize)
  return rows.map((row) => toUsdaFoodDto(rowToNormalized(row), true))
}

export async function searchFoods(query: string, opts: UsdaSearchOptions = {}): Promise<UsdaSearchResult> {
  const pageSize = opts.pageSize ?? 20
  const memoKey = `${opts.includeBranded ? 'b' : 'f'}:${query.toLowerCase()}`
  const memo = searchMemo.get(memoKey)
  if (memo && Date.now() - memo.at < SEARCH_TTL_MS) {
    return { foods: memo.foods.slice(0, pageSize), degraded: false }
  }

  if (isUsdaEnabled()) {
    try {
      const raw = await usdaSearch(query, opts)
      // Pair each normalized food with ITS OWN raw payload before filtering, so a
      // dropped result (e.g. a non-gram Branded item) can't misalign rawJson.
      const normalized = raw
        .map((r) => ({ food: tryNormalizeUsdaFood(r), raw: r }))
        .filter((x): x is { food: NormalizedFood; raw: unknown } => x.food !== null)
      // Write-through so a later detail read is a cache hit (no second upstream call).
      await Promise.all(normalized.map(({ food, raw: rawFood }) => writeThrough(food, rawFood)))
      const foods = normalized.map(({ food }) => toUsdaFoodDto(food, false))
      searchMemo.set(memoKey, { at: Date.now(), foods })
      return { foods: foods.slice(0, pageSize), degraded: false }
    } catch {
      // fall through to cache-only
    }
  }

  const foods = await cacheOnlySearch(query, pageSize)
  return { foods, degraded: true }
}

export { UsdaNormalizationError }
