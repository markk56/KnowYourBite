import { getEnv } from '../config/env'

/**
 * Thin, typed USDA FoodData Central client (ARCHITECTURE §8.1). The API key lives
 * ONLY on the server (`X-Api-Key` header), never DEMO_KEY (rejected at env boot).
 * 8s timeout, one backoff retry on 429/5xx. Every failure throws
 * {@link UsdaUpstreamError}; the cache layer catches it to degrade to cached-only.
 */

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
const TIMEOUT_MS = 8_000
const RETRY_DELAY_MS = 500

export class UsdaUpstreamError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsdaUpstreamError'
  }
}

export function isUsdaEnabled(): boolean {
  return getEnv().USDA_API_KEY.trim().length > 0
}

function apiKey(): string {
  const key = getEnv().USDA_API_KEY.trim()
  if (!key) throw new UsdaUpstreamError('USDA API key is not configured')
  return key
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** One request with a single backoff retry on transient (429 / 5xx) failures. */
async function requestWithRetry(url: string, init: RequestInit): Promise<Response> {
  const headers = { 'X-Api-Key': apiKey(), ...(init.headers ?? {}) }
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response
    try {
      res = await fetchWithTimeout(url, { ...init, headers })
    } catch (error) {
      if (attempt === 0) {
        await sleep(RETRY_DELAY_MS)
        continue
      }
      throw new UsdaUpstreamError(error instanceof Error ? error.message : 'USDA request failed')
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt === 0) {
        await sleep(RETRY_DELAY_MS)
        continue
      }
      throw new UsdaUpstreamError(`USDA responded ${res.status}`)
    }
    if (!res.ok) throw new UsdaUpstreamError(`USDA responded ${res.status}`)
    return res
  }
  throw new UsdaUpstreamError('USDA request failed')
}

export interface UsdaSearchOptions {
  includeBranded?: boolean
  pageSize?: number
}

/** POST /foods/search — Foundation + SR Legacy by default; Branded behind a toggle. */
export async function usdaSearch(query: string, opts: UsdaSearchOptions = {}): Promise<unknown[]> {
  const dataType = opts.includeBranded
    ? ['Foundation', 'SR Legacy', 'Branded']
    : ['Foundation', 'SR Legacy']
  const res = await requestWithRetry(`${BASE_URL}/foods/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, dataType, pageSize: opts.pageSize ?? 20 }),
  })
  const data = (await res.json().catch(() => null)) as { foods?: unknown } | null
  return Array.isArray(data?.foods) ? data.foods : []
}

/** GET /food/{fdcId} — full nutrient detail for a single food. */
export async function usdaFoodDetail(fdcId: number): Promise<unknown> {
  const res = await requestWithRetry(`${BASE_URL}/food/${fdcId}`, { method: 'GET' })
  return res.json()
}
