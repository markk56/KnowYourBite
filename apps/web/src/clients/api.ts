import type {
  ClientCreateInput,
  ClientDto,
  ClientListQuery,
  ClientUpdateInput,
} from '@kyb/shared'
import { apiFetch } from '@/lib/api'

/** Clients API surface — reuses the envelope-unwrapping apiFetch. */
export const clientsApi = {
  list: (q: ClientListQuery = {}) => {
    const p = new URLSearchParams()
    if (q.search) p.set('search', q.search)
    if (q.type) p.set('type', q.type)
    const qs = p.toString()
    return apiFetch<{ clients: ClientDto[] }>(`/clients${qs ? `?${qs}` : ''}`).then((r) => r.clients)
  },
  get: (id: string) => apiFetch<{ client: ClientDto }>(`/clients/${id}`).then((r) => r.client),
  create: (input: ClientCreateInput) =>
    apiFetch<{ client: ClientDto }>('/clients', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.client),
  update: (id: string, patch: ClientUpdateInput) =>
    apiFetch<{ client: ClientDto }>(`/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => r.client),
  remove: (id: string) => apiFetch<{ success: boolean }>(`/clients/${id}`, { method: 'DELETE' }),
}
