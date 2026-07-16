import type {
  AddEntryInput,
  AddExtraInput,
  AddWindowInput,
  MealPlanCreateInput,
  MealPlanDto,
  MealPlanSummaryDto,
  MealPlanUpdateInput,
  PlannerChatMessage,
  PlannerChatResponse,
  UpdateEntryInput,
  UpdateExtraInput,
  UpdateWindowInput,
} from '@kyb/shared'
import { apiFetch } from '@/lib/api'

/**
 * Meal-plans API client (Milestone 4). Every mutation returns the full, freshly
 * assembled plan (with server-authoritative nutrition), so the caller just writes
 * it into the detail cache — no client-side nutrition math, matching the recipe
 * module.
 */
export const mealPlansApi = {
  list: (clientId?: string) => {
    const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''
    return apiFetch<{ plans: MealPlanSummaryDto[] }>(`/meal-plans${qs}`).then((r) => r.plans)
  },
  get: (id: string) => apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}`).then((r) => r.plan),
  create: (input: MealPlanCreateInput) =>
    apiFetch<{ plan: MealPlanDto }>('/meal-plans', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.plan),
  update: (id: string, patch: MealPlanUpdateInput) =>
    apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => r.plan),
  remove: (id: string) => apiFetch<{ success: boolean }>(`/meal-plans/${id}`, { method: 'DELETE' }),

  addWindow: (id: string, input: AddWindowInput) =>
    apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}/windows`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.plan),
  updateWindow: (id: string, windowId: string, patch: UpdateWindowInput) =>
    apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}/windows/${windowId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => r.plan),
  removeWindow: (id: string, windowId: string) =>
    apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}/windows/${windowId}`, {
      method: 'DELETE',
    }).then((r) => r.plan),

  addEntry: (id: string, input: AddEntryInput) =>
    apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}/entries`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.plan),
  updateEntry: (id: string, entryId: string, patch: UpdateEntryInput) =>
    apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}/entries/${entryId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => r.plan),
  removeEntry: (id: string, entryId: string) =>
    apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}/entries/${entryId}`, {
      method: 'DELETE',
    }).then((r) => r.plan),

  addExtra: (id: string, input: AddExtraInput) =>
    apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}/extras`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.plan),
  updateExtra: (id: string, extraId: string, patch: UpdateExtraInput) =>
    apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}/extras/${extraId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => r.plan),
  removeExtra: (id: string, extraId: string) =>
    apiFetch<{ plan: MealPlanDto }>(`/meal-plans/${id}/extras/${extraId}`, {
      method: 'DELETE',
    }).then((r) => r.plan),

  /** One turn of the propose-only planning assistant. Returns reply + validated proposals. */
  chat: (id: string, messages: PlannerChatMessage[]) =>
    apiFetch<PlannerChatResponse>(`/meal-plans/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
}
