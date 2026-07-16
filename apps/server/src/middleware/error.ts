import type { NextFunction, Request, Response } from 'express'
import { err, statusForCode, ERROR_CODES, type ErrorCode } from '@kyb/shared'
import { getEnv } from '../config/env'

/** 404 for unmatched /api routes (web routes fall through to the SPA). */
export function apiNotFound(_req: Request, res: Response): void {
  res.status(statusForCode('NOT_FOUND')).json(err('NOT_FOUND', 'API route not found'))
}

const isErrorCode = (v: unknown): v is ErrorCode =>
  typeof v === 'string' && (ERROR_CODES as readonly string[]).includes(v)

/** Duck-typed ZodError check (avoids a hard zod dep + cross-realm `instanceof`). */
function zodIssues(error: unknown): unknown[] | null {
  if (
    error !== null &&
    typeof error === 'object' &&
    (error as { name?: unknown }).name === 'ZodError' &&
    Array.isArray((error as { issues?: unknown }).issues)
  ) {
    return (error as { issues: unknown[] }).issues
  }
  return null
}

/**
 * Central error handler → uniform error envelope with a stable code. Must be
 * registered LAST. Known error shapes are mapped to their proper status:
 *   • ZodError (a `.parse()` that escaped a route)      → 400 VALIDATION_ERROR
 *   • Domain/ServiceError carrying a stable ErrorCode   → that code's status
 *   • anything else                                     → 500 INTERNAL
 * Outside production (Replit runs `NODE_ENV=development`) the real message +
 * any Postgres SQLSTATE are echoed in `details` so failures are diagnosable
 * instead of an opaque 500. Production stays terse — internals never leak.
 */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  console.error(`[error] ${req.method} ${req.originalUrl} →`, error)
  const isProd = getEnv().NODE_ENV === 'production'

  // A validation error thrown (rather than handled via safeParse) → 400.
  const issues = zodIssues(error)
  if (issues) {
    res.status(statusForCode('VALIDATION_ERROR')).json(err('VALIDATION_ERROR', 'Request failed validation', issues))
    return
  }

  // Domain/service errors already carry a stable ErrorCode (e.g. CONFLICT).
  // Note: a Postgres error's `.code` is a SQLSTATE ("23502") — not in ERROR_CODES
  // — so it correctly falls through to the 500 branch below.
  const code = (error as { code?: unknown } | null)?.code
  if (isErrorCode(code)) {
    const message = error instanceof Error ? error.message : 'Request failed'
    res.status(statusForCode(code)).json(err(code, message))
    return
  }

  // Unexpected → 500. Surface the real cause outside production so a dev/Replit
  // client can see what actually broke (message + Postgres SQLSTATE if present).
  const details =
    !isProd && error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          ...(typeof (error as { code?: unknown }).code === 'string'
            ? { pgCode: (error as { code: string }).code }
            : {}),
        }
      : undefined
  const clientMessage = !isProd && error instanceof Error ? error.message : 'Internal server error'
  res.status(statusForCode('INTERNAL')).json(err('INTERNAL', clientMessage, details))
}
