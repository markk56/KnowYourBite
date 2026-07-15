/**
 * Tiny guards shared by the deterministic clinical functions. These throw on
 * nonsensical input so a bad number can never silently propagate into a
 * clinical calculation. Kept dependency-free to preserve domain purity.
 */

export function assertFinite(field: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${field} must be a finite number, received: ${value}`)
  }
}

export function assertPositive(field: string, value: number): void {
  assertFinite(field, value)
  if (value <= 0) {
    throw new RangeError(`${field} must be greater than 0, received: ${value}`)
  }
}

export function assertNonNegative(field: string, value: number): void {
  assertFinite(field, value)
  if (value < 0) {
    throw new RangeError(`${field} must be 0 or greater, received: ${value}`)
  }
}

/** Round to a fixed number of decimals without floating-point tail noise. */
export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.round((value + Number.EPSILON) * f) / f
}
