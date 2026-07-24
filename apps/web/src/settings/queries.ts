import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateFoodPreferenceInput,
  FoodPreferenceCategory,
  FoodPreferenceItemDto,
  UpdateFoodPreferenceInput,
} from '@kyb/shared'
import { foodPreferencesApi } from './api'

export const foodPreferenceKeys = {
  all: ['foodPreferences'] as const,
}

export function useFoodPreferences() {
  return useQuery({
    queryKey: foodPreferenceKeys.all,
    queryFn: foodPreferencesApi.list,
    staleTime: 60_000,
  })
}

/** Items grouped per category — the shape the anamnesis meal pickers consume. */
export function groupFoodPreferences(
  items: FoodPreferenceItemDto[] | undefined,
): Partial<Record<FoodPreferenceCategory, string[]>> | undefined {
  if (!items) return undefined
  const grouped: Partial<Record<FoodPreferenceCategory, string[]>> = {}
  for (const item of items) {
    ;(grouped[item.category] ??= []).push(item.label)
  }
  return grouped
}

export function useCreateFoodPreference() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFoodPreferenceInput) => foodPreferencesApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: foodPreferenceKeys.all }),
  })
}

export function useRenameFoodPreference() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFoodPreferenceInput }) =>
      foodPreferencesApi.rename(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: foodPreferenceKeys.all }),
  })
}

export function useRemoveFoodPreference() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => foodPreferencesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: foodPreferenceKeys.all }),
  })
}
