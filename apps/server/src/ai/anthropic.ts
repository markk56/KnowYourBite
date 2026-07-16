import Anthropic from '@anthropic-ai/sdk'
import { getEnv } from '../config/env'

/**
 * Lazy Anthropic client. The whole AI layer is optional: with no
 * `ANTHROPIC_API_KEY` the app runs fully on deterministic math and every AI
 * surface degrades gracefully (ADR — "usable with the Anthropic API turned off").
 */

/** Clinical narrative model per ADR §6 routing. */
export const CLINICAL_MODEL = 'claude-opus-4-8'
export const ASSESSMENT_PROMPT_VERSION = 'assessment-v1'

/** High-volume light tasks (allergen suggestion, food translation) route to haiku. */
export const ALLERGEN_MODEL = 'claude-haiku-4-5-20251001'
export const ALLERGEN_PROMPT_VERSION = 'allergen-v1'

let client: Anthropic | undefined

export function isAiEnabled(): boolean {
  return getEnv().ANTHROPIC_API_KEY.trim().length > 0
}

export function getAnthropic(): Anthropic {
  if (!isAiEnabled()) {
    throw new Error('Anthropic API key is not configured')
  }
  if (!client) {
    client = new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY })
  }
  return client
}
