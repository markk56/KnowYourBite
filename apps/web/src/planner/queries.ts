import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AddEntryInput,
  AddExtraInput,
  AddWindowInput,
  MealPlanCreateInput,
  MealPlanDto,
  MealPlanUpdateInput,
  PlannerChatMessage,
  UpdateEntryInput,
  UpdateExtraInput,
  UpdateWindowInput,
} from '@kyb/shared'
import { mealPlansApi } from './api'

/** Query-key factory; plan mutations set the detail cache + invalidate lists. */
export const plannerKeys = {
  all: ['meal-plans'] as const,
  list: (clientId?: string) => ['meal-plans', 'list', clientId ?? 'all'] as const,
  detail: (id: string) => ['meal-plans', 'detail', id] as const,
}

export function useMealPlans(clientId?: string) {
  return useQuery({
    queryKey: plannerKeys.list(clientId),
    queryFn: () => mealPlansApi.list(clientId),
  })
}

export function useMealPlan(id: string) {
  return useQuery({
    queryKey: plannerKeys.detail(id),
    queryFn: () => mealPlansApi.get(id),
    enabled: !!id,
  })
}

export function useCreateMealPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MealPlanCreateInput) => mealPlansApi.create(input),
    onSuccess: (plan: MealPlanDto) => {
      qc.setQueryData(plannerKeys.detail(plan.id), plan)
      void qc.invalidateQueries({ queryKey: plannerKeys.all })
    },
  })
}

export function useDeleteMealPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mealPlansApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: plannerKeys.all }),
  })
}

/** Every plan write returns the full plan; cache it + invalidate lists. */
function usePlanMutation<TVars>(mutationFn: (vars: TVars) => Promise<MealPlanDto>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (plan: MealPlanDto) => {
      qc.setQueryData(plannerKeys.detail(plan.id), plan)
      void qc.invalidateQueries({ queryKey: plannerKeys.list() })
    },
  })
}

export function useUpdatePlan(id: string) {
  return usePlanMutation((patch: MealPlanUpdateInput) => mealPlansApi.update(id, patch))
}

export function useAddWindow(id: string) {
  return usePlanMutation((input: AddWindowInput) => mealPlansApi.addWindow(id, input))
}
export function useUpdateWindow(id: string) {
  return usePlanMutation((vars: { windowId: string; patch: UpdateWindowInput }) =>
    mealPlansApi.updateWindow(id, vars.windowId, vars.patch),
  )
}
export function useRemoveWindow(id: string) {
  return usePlanMutation((windowId: string) => mealPlansApi.removeWindow(id, windowId))
}

export function useAddEntry(id: string) {
  return usePlanMutation((input: AddEntryInput) => mealPlansApi.addEntry(id, input))
}
export function useUpdateEntry(id: string) {
  return usePlanMutation((vars: { entryId: string; patch: UpdateEntryInput }) =>
    mealPlansApi.updateEntry(id, vars.entryId, vars.patch),
  )
}
export function useRemoveEntry(id: string) {
  return usePlanMutation((entryId: string) => mealPlansApi.removeEntry(id, entryId))
}

export function useAddExtra(id: string) {
  return usePlanMutation((input: AddExtraInput) => mealPlansApi.addExtra(id, input))
}
export function useUpdateExtra(id: string) {
  return usePlanMutation((vars: { extraId: string; patch: UpdateExtraInput }) =>
    mealPlansApi.updateExtra(id, vars.extraId, vars.patch),
  )
}
export function useRemoveExtra(id: string) {
  return usePlanMutation((extraId: string) => mealPlansApi.removeExtra(id, extraId))
}

/** One turn of the propose-only planning assistant (does not mutate the plan cache). */
export function usePlannerChat(id: string) {
  return useMutation({
    mutationFn: (messages: PlannerChatMessage[]) => mealPlansApi.chat(id, messages),
  })
}
