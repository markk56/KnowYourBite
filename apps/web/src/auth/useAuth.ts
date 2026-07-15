import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthUser } from '@kyb/shared'
import { authApi } from '@/lib/api'

const ME_KEY = ['me'] as const

/** Current authenticated user, or null when not logged in (401 → null). */
export function useCurrentUser() {
  return useQuery<AuthUser | null>({
    queryKey: ME_KEY,
    queryFn: () => authApi.me().catch(() => null),
    retry: false,
    staleTime: Infinity,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => qc.setQueryData(ME_KEY, null),
  })
}
