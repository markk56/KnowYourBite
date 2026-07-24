import type { CreateFoodPreferenceInput, FoodPreferenceItemDto, UpdateFoodPreferenceInput } from '@kyb/shared'
import { apiFetch } from '@/lib/api'

/** Food-preference nomenclator API (Settings + anamnesis meal checklists). */
export const foodPreferencesApi = {
  list: () => apiFetch<{ items: FoodPreferenceItemDto[] }>('/food-preferences').then((r) => r.items),
  create: (input: CreateFoodPreferenceInput) =>
    apiFetch<{ item: FoodPreferenceItemDto }>('/food-preferences', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.item),
  rename: (id: string, input: UpdateFoodPreferenceInput) =>
    apiFetch<{ item: FoodPreferenceItemDto }>(`/food-preferences/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }).then((r) => r.item),
  remove: (id: string) => apiFetch<{ success: boolean }>(`/food-preferences/${id}`, { method: 'DELETE' }),
}
