/**
 * The one API response envelope + stable error-code enum used by every endpoint
 * (ARCHITECTURE.md — API §, Backend §5). Success and error shapes are
 * discriminated by `ok`. Error `code` values are stable strings the client maps
 * to localized messages; HTTP status is derived from the code.
 *
 * Multi-tenant rule: cross-tenant access resolves to NOT_FOUND (404), never
 * FORBIDDEN (403) — a 403 would confirm the resource exists.
 */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

export interface ApiError {
  code: ErrorCode
  message: string
  /** Optional structured detail, e.g. field-level validation errors. */
  details?: unknown
}

export interface SuccessEnvelope<T> {
  ok: true
  data: T
}

export interface ErrorEnvelope {
  ok: false
  error: ApiError
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope

export function ok<T>(data: T): SuccessEnvelope<T> {
  return { ok: true, data }
}

export function err(code: ErrorCode, message: string, details?: unknown): ErrorEnvelope {
  return { ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } }
}

export function statusForCode(code: ErrorCode): number {
  return ERROR_STATUS[code]
}
