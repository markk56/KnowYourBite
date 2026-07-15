import type { NextFunction, Request, Response } from 'express'
import { err, statusForCode } from '@kyb/shared'

/** 404 for unmatched /api routes (web routes fall through to the SPA). */
export function apiNotFound(_req: Request, res: Response): void {
  res.status(statusForCode('NOT_FOUND')).json(err('NOT_FOUND', 'API route not found'))
}

/**
 * Central error handler → uniform error envelope with a stable code. Must be
 * registered LAST. Internal details are logged, never leaked to the client.
 * Richer mapping (ZodError → VALIDATION_ERROR, domain errors, etc.) lands with
 * the first product module.
 */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[error]', error)
  res.status(statusForCode('INTERNAL')).json(err('INTERNAL', 'Internal server error'))
}
