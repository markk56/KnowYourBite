import type { NextFunction, Request, Response } from 'express'
import { err } from '@kyb/shared'

/**
 * Per-tenant in-memory rate limiter for `/usda/*` (fixed window). A dietitian
 * typing into the food type-ahead should never exhaust the USDA quota; this bounds
 * upstream calls per tenant without adding a dependency. The single-VM process
 * model (ADR §1) makes an in-memory bucket sufficient.
 */

const WINDOW_MS = 10_000
const MAX_PER_WINDOW = 40

interface Bucket {
  count: number
  resetAt: number
}
const buckets = new Map<string, Bucket>()

export function usdaRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.tenantId ?? 'anonymous'
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    next()
    return
  }
  if (bucket.count >= MAX_PER_WINDOW) {
    res.status(429).json(err('RATE_LIMITED', 'Too many food searches — slow down a moment'))
    return
  }
  bucket.count += 1
  next()
}
