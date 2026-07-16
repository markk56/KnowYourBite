import { resolveAssessmentTargets, type AssessmentType } from '@kyb/domain'
import {
  hbInputsSchema,
  type ApproveTargetsInput,
  type AssessmentTargetsDto,
  type ErrorCode,
  type FinishWithAiResult,
  type HbInputs,
} from '@kyb/shared'
import type { ClientAssessmentRow } from '../db/schema'
import { ASSESSMENT_PROMPT_VERSION, CLINICAL_MODEL, isAiEnabled } from '../ai/anthropic'
import { MalformedProposalError, proposeAssessment } from '../ai/assessmentProposer'
import { assessmentsRepository, roundTargets, toAssessmentDto, toTargetsDto } from './repository'

/** A service-level error the router maps directly onto the response envelope. */
export class ServiceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

const numOrNull = (v: string | null): number | null => (v === null ? null : Number(v))

/** Build validated Harris–Benedict inputs from an assessment row, or null if incomplete. */
function hbFromRow(row: ClientAssessmentRow): HbInputs | null {
  const parsed = hbInputsSchema.safeParse({
    sex: row.sex,
    ageYears: row.ageYears,
    heightCm: numOrNull(row.heightCm),
    weightKg: numOrNull(row.weightKg),
    activityFactor: numOrNull(row.activityFactor),
  })
  return parsed.success ? parsed.data : null
}

/**
 * Finish with AI: deterministic first (always), then a propose-only AI pass that
 * degrades gracefully. The assessment always lands in the `ai_proposed` review
 * state — whether or not the AI produced a proposal — so the dietitian can review
 * and approve human-final targets even with the Anthropic API turned off.
 */
export async function finishWithAi(tenantId: string, row: ClientAssessmentRow): Promise<FinishWithAiResult> {
  // Body metrics are OPTIONAL. When present we compute authoritative calorie/macro
  // targets; when absent the AI still analyses whatever the anamnesis contains and
  // the dietitian sets final targets by hand. "Finish with AI" is never blocked.
  const hb = hbFromRow(row)
  const type = row.type as AssessmentType
  const deterministic = hb ? resolveAssessmentTargets(hb, type) : null // maintenance (adjustment 0)

  let ai: FinishWithAiResult['ai']

  if (!isAiEnabled()) {
    await recordUnavailable(tenantId, row)
    await assessmentsRepository.markInReview(tenantId, row.id)
    ai = { status: 'unavailable', retryable: false }
  } else {
    try {
      const { proposal, rawOutput } = await proposeAssessment({
        type,
        hb,
        payload: (row.payload ?? {}) as Record<string, string | number | boolean | null>,
        deterministic,
      })
      await assessmentsRepository.recordInteraction({
        tenantId,
        clientId: row.clientId,
        assessmentId: row.id,
        model: CLINICAL_MODEL,
        promptVersion: ASSESSMENT_PROMPT_VERSION,
        systemDecision: 'proposed',
        rawOutput,
        proposedValues: proposal,
      })
      await assessmentsRepository.setAiProposed(tenantId, row.id, proposal, ASSESSMENT_PROMPT_VERSION)
      // Only apply the AI's % adjustment when there's a deterministic base to adjust.
      const adjusted =
        hb && deterministic
          ? roundTargets(
              resolveAssessmentTargets(
                { ...hb, calorieAdjustmentPercent: proposal.calorieAdjustmentPercent },
                type,
              ),
            )
          : null
      ai = { status: 'proposed', proposal, adjustedTargets: adjusted }
    } catch (error) {
      if (error instanceof MalformedProposalError) {
        await assessmentsRepository.recordInteraction({
          tenantId,
          clientId: row.clientId,
          assessmentId: row.id,
          model: CLINICAL_MODEL,
          promptVersion: ASSESSMENT_PROMPT_VERSION,
          systemDecision: 'rejected_malformed',
          rawOutput: error.rawOutput,
        })
      } else {
        // Upstream unavailable, pseudonymization, or an unexpected error — degrade + audit.
        await recordUnavailable(tenantId, row)
      }
      // No proposal persisted; still move to the review state (keeps any prior proposal).
      await assessmentsRepository.markInReview(tenantId, row.id)
      ai = { status: 'unavailable', retryable: true }
    }
  }

  const updated = (await assessmentsRepository.findById(tenantId, row.id)) ?? row
  return {
    assessment: toAssessmentDto(updated),
    deterministic: deterministic ? roundTargets(deterministic) : null,
    ai,
  }
}

async function recordUnavailable(tenantId: string, row: ClientAssessmentRow): Promise<void> {
  await assessmentsRepository.recordInteraction({
    tenantId,
    clientId: row.clientId,
    assessmentId: row.id,
    model: CLINICAL_MODEL,
    promptVersion: ASSESSMENT_PROMPT_VERSION,
    systemDecision: 'unavailable',
  })
}

/**
 * Approve human-final targets. Lifecycle guard: only an `ai_proposed` assessment
 * can be approved (→ CONFLICT otherwise). BMR + maintenance TDEE are recomputed
 * deterministically from the assessment's own inputs — never trusted from the
 * client request.
 */
export async function approveAssessment(
  tenantId: string,
  row: ClientAssessmentRow,
  approvedByUserId: string,
  input: ApproveTargetsInput,
): Promise<{ targets: AssessmentTargetsDto; assessmentStatus: 'completed' }> {
  if (row.status !== 'ai_proposed') {
    throw new ServiceError('CONFLICT', `Cannot approve an assessment in status "${row.status}"`)
  }
  // Body metrics optional: recompute BMR/TDEE deterministically when present, else
  // store null (the dietitian's manually-entered final targets still persist).
  const hb = hbFromRow(row)
  const deterministic = hb ? resolveAssessmentTargets(hb, row.type as AssessmentType) : null
  const targets = await assessmentsRepository.approve(
    tenantId,
    row,
    approvedByUserId,
    { bmrKcal: deterministic?.bmrKcal ?? null, maintenanceTdeeKcal: deterministic?.maintenanceTdeeKcal ?? null },
    input,
  )
  return { targets: toTargetsDto(targets), assessmentStatus: 'completed' }
}
