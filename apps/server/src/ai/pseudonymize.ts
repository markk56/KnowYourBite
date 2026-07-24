import type { AssessmentPayload } from '@kyb/shared'

/**
 * Fail-closed pseudonymization for the AI boundary (ADR §6). The assessment
 * envelope carries no direct identifiers (name/phone/email live on the client
 * record, never sent), and the five Harris–Benedict inputs are non-identifying
 * clinical fields. This guard defends against a stray identifier sneaking into
 * the free-form `payload`: if any answer key *looks* like a direct identifier we
 * throw rather than risk leaking PII to Anthropic. Structured answers (repeater
 * / frequency rows) carry their own nested keys, which are serialized into the
 * prompt too — so those keys are checked as well.
 */

const IDENTIFIER_KEY = /(name|e-?mail|phone|tel|address|ssn|passport)/i

export class PseudonymizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PseudonymizationError'
  }
}

function assertKeySafe(key: string): void {
  if (IDENTIFIER_KEY.test(key)) {
    throw new PseudonymizationError(`Refusing to send potential identifier field "${key}" to the AI service`)
  }
}

/** Throws if a payload key (top-level or nested row key) looks like a direct identifier. */
export function assertNoDirectIdentifiers(payload: AssessmentPayload): AssessmentPayload {
  for (const [key, value] of Object.entries(payload)) {
    assertKeySafe(key)
    if (Array.isArray(value)) {
      for (const row of value) {
        if (typeof row === 'object' && row !== null) {
          for (const rowKey of Object.keys(row)) assertKeySafe(rowKey)
        }
      }
    }
  }
  return payload
}
