import { getDb } from '../db/client'
import { aiInteractions } from '../db/schema'
import type { AiFeature } from '@kyb/shared'

/**
 * One place to write the clinical AI audit (`ai_interactions`) — ADR §6/§12. Every
 * AI surface records its system decision (proposed / rejected_malformed /
 * unavailable) so even a rejected malformed output is auditable though never
 * persisted as a proposal. Feature-agnostic: assessment (client/assessment id) and
 * recipe (recipe id) features both flow through here.
 */
export interface AiAuditInput {
  tenantId: string
  feature: AiFeature
  model: string
  promptVersion: string
  systemDecision: 'proposed' | 'rejected_malformed' | 'unavailable'
  clientId?: string
  assessmentId?: string
  recipeId?: string
  rawOutput?: unknown
  proposedValues?: unknown
}

export async function recordAiInteraction(input: AiAuditInput): Promise<void> {
  await getDb()
    .insert(aiInteractions)
    .values({
      tenantId: input.tenantId,
      clientId: input.clientId ?? null,
      assessmentId: input.assessmentId ?? null,
      recipeId: input.recipeId ?? null,
      feature: input.feature,
      model: input.model,
      promptVersion: input.promptVersion,
      systemDecision: input.systemDecision,
      rawOutput: input.rawOutput ?? null,
      proposedValues: input.proposedValues ?? null,
    })
}
