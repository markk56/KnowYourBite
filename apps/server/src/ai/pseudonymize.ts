import type { AssessmentPayload } from '@kyb/shared'

/**
 * Fail-closed pseudonymization for the AI boundary (ADR §6). The assessment
 * envelope carries no direct identifiers (name/phone/email live on the client
 * record, never sent), and the five Harris–Benedict inputs are non-identifying
 * clinical fields. This guard defends against a stray identifier sneaking into
 * the free-form `payload`: if any answer key *looks* like a direct identifier we
 * throw rather than risk leaking PII to Anthropic.
 */

const IDENTIFIER_KEY = /(name|e-?mail|phone|tel|address|ssn|passport)/i

export class PseudonymizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PseudonymizationError'
  }
}

/** Throws if a payload key looks like a direct identifier. Returns the payload unchanged. */
export function assertNoDirectIdentifiers(payload: AssessmentPayload): AssessmentPayload {
  for (const key of Object.keys(payload)) {
    if (IDENTIFIER_KEY.test(key)) {
      throw new PseudonymizationError(`Refusing to send potential identifier field "${key}" to the AI service`)
    }
  }
  return payload
}
