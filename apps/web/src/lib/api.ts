import type { AuthUser } from '@kyb/shared'

interface Envelope {
  ok?: boolean
  data?: unknown
  error?: { message?: string; code?: string }
}

/** Fetch the versioned API, unwrapping the response envelope and throwing on error. */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  })
  const body = (await res.json().catch(() => null)) as Envelope | null
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`)
  }
  return body.data as T
}

export const authApi = {
  me: () => apiFetch<{ user: AuthUser }>('/auth/me').then((r) => r.user),
  login: (input: { email: string; password: string }) =>
    apiFetch<{ user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }).then(
      (r) => r.user,
    ),
  register: (input: { email: string; password: string; fullName: string }) =>
    apiFetch<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.user),
  logout: () => apiFetch<{ success: boolean }>('/auth/logout', { method: 'POST' }),
}
