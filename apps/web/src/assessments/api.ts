import type {
  AssessmentDto,
  AssessmentDraftInput,
  AssessmentTargetsDto,
  ApproveTargetsInput,
  FinishWithAiResult,
} from '@kyb/shared'
import { apiFetch } from '@/lib/api'

const base = (clientId: string) => `/clients/${clientId}/assessments`

/** Assessments API surface (nested under a client). */
export const assessmentsApi = {
  /** Latest non-discarded assessment, or null when none exists yet (404 → null). */
  current: (clientId: string) =>
    apiFetch<{ assessment: AssessmentDto }>(`${base(clientId)}/current`)
      .then((r) => r.assessment)
      .catch(() => null),
  get: (clientId: string, id: string) =>
    apiFetch<{ assessment: AssessmentDto }>(`${base(clientId)}/${id}`).then((r) => r.assessment),
  create: (clientId: string) =>
    apiFetch<{ assessment: AssessmentDto }>(base(clientId), { method: 'POST', body: '{}' }).then(
      (r) => r.assessment,
    ),
  update: (clientId: string, id: string, patch: AssessmentDraftInput) =>
    apiFetch<{ assessment: AssessmentDto }>(`${base(clientId)}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => r.assessment),
  finish: (clientId: string, id: string) =>
    apiFetch<FinishWithAiResult>(`${base(clientId)}/${id}/finish-with-ai`, { method: 'POST', body: '{}' }),
  approve: (clientId: string, id: string, input: ApproveTargetsInput) =>
    apiFetch<{ targets: AssessmentTargetsDto; assessment: AssessmentDto | null }>(
      `${base(clientId)}/${id}/approve`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  targets: (clientId: string, id: string) =>
    apiFetch<{ targets: AssessmentTargetsDto }>(`${base(clientId)}/${id}/targets`)
      .then((r) => r.targets)
      .catch(() => null),
  remove: (clientId: string, id: string) =>
    apiFetch<{ success: boolean }>(`${base(clientId)}/${id}`, { method: 'DELETE' }),
}
