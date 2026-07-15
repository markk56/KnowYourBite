import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClientDto, ClientCreateInput, ClientListQuery, ClientUpdateInput } from '@kyb/shared'
import { clientsApi } from './api'

/** Query-key factory; every mutation invalidates `clientKeys.all` so lists refetch. */
export const clientKeys = {
  all: ['clients'] as const,
  list: (q: ClientListQuery) => ['clients', 'list', q] as const,
  detail: (id: string) => ['clients', 'detail', id] as const,
}

export function useClients(q: ClientListQuery) {
  return useQuery({
    queryKey: clientKeys.list(q),
    queryFn: () => clientsApi.list(q),
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => clientsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientCreateInput) => clientsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }),
  })
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: ClientUpdateInput) => clientsApi.update(id, patch),
    onSuccess: (client: ClientDto) => {
      qc.setQueryData(clientKeys.detail(id), client)
      void qc.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all }),
  })
}
