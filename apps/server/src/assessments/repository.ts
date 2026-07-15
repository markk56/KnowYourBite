import { and, desc, eq, max } from 'drizzle-orm'
import type { DeterministicTargets } from '@kyb/domain'
import type {
  AiAssessmentProposal,
  AiDecision,
  AssessmentDto,
  AssessmentDraftInput,
  AssessmentPayload,
  AssessmentTargetsDto,
  AssessmentType,
  DeterministicTargetsDto,
  Sex,
} from '@kyb/shared'
import { getDb } from '../db/client'
import {
  aiInteractions,
  assessmentTargets,
  clientAssessments,
  clients,
  type AssessmentTargetRow,
  type ClientAssessmentRow,
  type NewClientAssessmentRow,
} from '../db/schema'
import { activeForTenant } from '../db/tenantScope'

const numOrNull = (v: string | null): number | null => (v === null ? null : Number(v))

export function toAssessmentDto(row: ClientAssessmentRow): AssessmentDto {
  return {
    id: row.id,
    clientId: row.clientId,
    version: row.version,
    type: row.type as AssessmentType,
    status: row.status,
    sex: (row.sex as Sex | null) ?? null,
    ageYears: row.ageYears,
    heightCm: numOrNull(row.heightCm),
    weightKg: numOrNull(row.weightKg),
    activityFactor: numOrNull(row.activityFactor),
    payload: (row.payload ?? {}) as AssessmentPayload,
    aiProposal: (row.aiProposal as AiAssessmentProposal | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  }
}

export function toTargetsDto(row: AssessmentTargetRow): AssessmentTargetsDto {
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    clientId: row.clientId,
    bmrKcal: Number(row.bmrKcal),
    maintenanceTdeeKcal: Number(row.maintenanceTdeeKcal),
    targetKcal: Number(row.targetKcal),
    proteinG: Number(row.proteinG),
    carbsG: Number(row.carbsG),
    fatG: Number(row.fatG),
    decisionSummary: row.decisionSummary as AiDecision,
    approvedAt: row.approvedAt.toISOString(),
  }
}

/** Translate a validated draft patch into column updates; only provided keys are set. */
function mapDraft(patch: AssessmentDraftInput): Partial<NewClientAssessmentRow> {
  const set: Partial<NewClientAssessmentRow> = {}
  if ('sex' in patch) set.sex = patch.sex ?? null
  if ('ageYears' in patch) set.ageYears = patch.ageYears ?? null
  if ('heightCm' in patch) set.heightCm = patch.heightCm == null ? null : String(patch.heightCm)
  if ('weightKg' in patch) set.weightKg = patch.weightKg == null ? null : String(patch.weightKg)
  if ('activityFactor' in patch) set.activityFactor = patch.activityFactor == null ? null : String(patch.activityFactor)
  if ('payload' in patch && patch.payload !== undefined) set.payload = patch.payload
  return set
}

/** Statuses that still permit draft edits / AI proposals. */
const EDITABLE = ['unfinished', 'ai_proposed'] as const

export const assessmentsRepository = {
  async listForClient(tenantId: string, clientId: string): Promise<ClientAssessmentRow[]> {
    return getDb()
      .select()
      .from(clientAssessments)
      .where(and(activeForTenant(clientAssessments, tenantId), eq(clientAssessments.clientId, clientId)))
      .orderBy(desc(clientAssessments.version))
  },

  async findById(tenantId: string, id: string): Promise<ClientAssessmentRow | null> {
    const [row] = await getDb()
      .select()
      .from(clientAssessments)
      .where(and(activeForTenant(clientAssessments, tenantId), eq(clientAssessments.id, id)))
      .limit(1)
    return row ?? null
  },

  /** Latest non-discarded assessment for a client (the "current" one). */
  async findCurrent(tenantId: string, clientId: string): Promise<ClientAssessmentRow | null> {
    const rows = await this.listForClient(tenantId, clientId)
    return rows.find((r) => r.status !== 'discarded') ?? null
  },

  async createDraft(tenantId: string, clientId: string, type: AssessmentType): Promise<ClientAssessmentRow> {
    // Next version spans ALL rows for the client (incl. discarded) to avoid a
    // (client_id, version) unique collision.
    const [{ value: maxVersion } = { value: null }] = await getDb()
      .select({ value: max(clientAssessments.version) })
      .from(clientAssessments)
      .where(and(eq(clientAssessments.tenantId, tenantId), eq(clientAssessments.clientId, clientId)))
    const version = (maxVersion ?? 0) + 1

    const [row] = await getDb()
      .insert(clientAssessments)
      .values({ tenantId, clientId, type, version, status: 'unfinished', payload: {} })
      .returning()
    if (!row) throw new Error('Failed to create assessment')
    return row
  },

  async updateDraft(tenantId: string, id: string, patch: AssessmentDraftInput): Promise<ClientAssessmentRow | null> {
    const [row] = await getDb()
      .update(clientAssessments)
      .set({ ...mapDraft(patch), updatedAt: new Date() })
      .where(
        and(
          activeForTenant(clientAssessments, tenantId),
          eq(clientAssessments.id, id),
          // Only editable states; completed/discarded are locked.
          eq(clientAssessments.status, 'unfinished'),
        ),
      )
      .returning()
    if (row) return row
    // Allow edits while in ai_proposed too (re-run of Finish-with-AI).
    const [row2] = await getDb()
      .update(clientAssessments)
      .set({ ...mapDraft(patch), updatedAt: new Date() })
      .where(
        and(
          activeForTenant(clientAssessments, tenantId),
          eq(clientAssessments.id, id),
          eq(clientAssessments.status, 'ai_proposed'),
        ),
      )
      .returning()
    return row2 ?? null
  },

  async setAiProposed(
    tenantId: string,
    id: string,
    proposal: AiAssessmentProposal,
    promptVersion: string,
  ): Promise<ClientAssessmentRow | null> {
    const [row] = await getDb()
      .update(clientAssessments)
      .set({ status: 'ai_proposed', aiProposal: proposal, promptVersion, updatedAt: new Date() })
      .where(and(activeForTenant(clientAssessments, tenantId), eq(clientAssessments.id, id)))
      .returning()
    return row ?? null
  },

  /** Move to the review state WITHOUT touching any existing proposal (AI degraded). */
  async markInReview(tenantId: string, id: string): Promise<ClientAssessmentRow | null> {
    const [row] = await getDb()
      .update(clientAssessments)
      .set({ status: 'ai_proposed', updatedAt: new Date() })
      .where(and(activeForTenant(clientAssessments, tenantId), eq(clientAssessments.id, id)))
      .returning()
    return row ?? null
  },

  async discard(tenantId: string, id: string): Promise<boolean> {
    const rows = await getDb()
      .update(clientAssessments)
      .set({ status: 'discarded', deletedAt: new Date() })
      .where(and(activeForTenant(clientAssessments, tenantId), eq(clientAssessments.id, id)))
      .returning({ id: clientAssessments.id })
    return rows.length > 0
  },

  async findTargets(tenantId: string, assessmentId: string): Promise<AssessmentTargetRow | null> {
    const [row] = await getDb()
      .select()
      .from(assessmentTargets)
      .where(and(eq(assessmentTargets.tenantId, tenantId), eq(assessmentTargets.assessmentId, assessmentId)))
      .limit(1)
    return row ?? null
  },

  /**
   * Approve human-final targets. Only valid on an `ai_proposed` assessment; the
   * caller checks that and returns CONFLICT otherwise. Writes the immutable
   * targets, flips the assessment + client to completed, and stamps the
   * ai_interactions audit row with the human decision.
   */
  async approve(
    tenantId: string,
    assessment: ClientAssessmentRow,
    approvedByUserId: string,
    deterministic: { bmrKcal: number; maintenanceTdeeKcal: number },
    finalValues: { targetKcal: number; proteinG: number; carbsG: number; fatG: number; decisionSummary: AiDecision },
  ): Promise<AssessmentTargetRow> {
    const db = getDb()
    const [targets] = await db
      .insert(assessmentTargets)
      .values({
        tenantId,
        assessmentId: assessment.id,
        clientId: assessment.clientId,
        bmrKcal: String(deterministic.bmrKcal),
        maintenanceTdeeKcal: String(deterministic.maintenanceTdeeKcal),
        targetKcal: String(finalValues.targetKcal),
        proteinG: String(finalValues.proteinG),
        carbsG: String(finalValues.carbsG),
        fatG: String(finalValues.fatG),
        decisionSummary: finalValues.decisionSummary,
        approvedByUserId,
      })
      .returning()
    if (!targets) throw new Error('Failed to write assessment targets')

    await db
      .update(clientAssessments)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(clientAssessments.tenantId, tenantId), eq(clientAssessments.id, assessment.id)))

    await db
      .update(clients)
      .set({ assessmentStatus: 'completed', updatedAt: new Date() })
      .where(and(eq(clients.tenantId, tenantId), eq(clients.id, assessment.clientId)))

    // Stamp the most recent proposal's audit row with the human decision.
    const [lastProposal] = await db
      .select({ id: aiInteractions.id })
      .from(aiInteractions)
      .where(and(eq(aiInteractions.tenantId, tenantId), eq(aiInteractions.assessmentId, assessment.id)))
      .orderBy(desc(aiInteractions.createdAt))
      .limit(1)
    if (lastProposal) {
      await db
        .update(aiInteractions)
        .set({ humanDecision: finalValues.decisionSummary, finalValues, updatedAt: new Date() })
        .where(and(eq(aiInteractions.tenantId, tenantId), eq(aiInteractions.id, lastProposal.id)))
    }

    return targets
  },

  async recordInteraction(input: {
    tenantId: string
    clientId: string
    assessmentId: string
    model: string
    promptVersion: string
    systemDecision: 'proposed' | 'rejected_malformed' | 'unavailable'
    rawOutput?: unknown
    proposedValues?: unknown
  }): Promise<void> {
    await getDb()
      .insert(aiInteractions)
      .values({
        tenantId: input.tenantId,
        clientId: input.clientId,
        assessmentId: input.assessmentId,
        feature: 'clinical_narrative',
        model: input.model,
        promptVersion: input.promptVersion,
        systemDecision: input.systemDecision,
        rawOutput: input.rawOutput ?? null,
        proposedValues: input.proposedValues ?? null,
      })
  },
}

/** Flatten + round a domain target set to the display/storage precision (1 decimal). */
export function roundTargets(t: DeterministicTargets): DeterministicTargetsDto {
  const r = (n: number) => Math.round(n * 10) / 10
  return {
    bmrKcal: r(t.bmrKcal),
    maintenanceTdeeKcal: r(t.maintenanceTdeeKcal),
    targetKcal: r(t.targetKcal),
    proteinG: r(t.macros.proteinG),
    carbsG: r(t.macros.carbG),
    fatG: r(t.macros.fatG),
  }
}
