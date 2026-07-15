import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AssessmentDraftInput } from '@kyb/shared'
import { assessmentsApi } from './api'

export const assessmentKeys = {
  all: (clientId: string) => ['assessments', clientId] as const,
  current: (clientId: string) => ['assessments', clientId, 'current'] as const,
  targets: (clientId: string, id: string) => ['assessments', clientId, id, 'targets'] as const,
}

/** The client's current assessment (null when none). */
export function useCurrentAssessment(clientId: string) {
  return useQuery({
    queryKey: assessmentKeys.current(clientId),
    queryFn: () => assessmentsApi.current(clientId),
    enabled: !!clientId,
  })
}

export function useApprovedTargets(clientId: string, assessmentId: string | undefined) {
  return useQuery({
    queryKey: assessmentKeys.targets(clientId, assessmentId ?? ''),
    queryFn: () => assessmentsApi.targets(clientId, assessmentId!),
    enabled: !!clientId && !!assessmentId,
  })
}

export function useCreateAssessment(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => assessmentsApi.create(clientId),
    onSuccess: (a) => {
      qc.setQueryData(assessmentKeys.current(clientId), a)
      void qc.invalidateQueries({ queryKey: assessmentKeys.all(clientId) })
    },
  })
}

/** Debounced autosave uses this directly (no query invalidation churn per keystroke). */
export function useSaveDraft(clientId: string, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: AssessmentDraftInput) => assessmentsApi.update(clientId, id, patch),
    onSuccess: (a) => qc.setQueryData(assessmentKeys.current(clientId), a),
  })
}
