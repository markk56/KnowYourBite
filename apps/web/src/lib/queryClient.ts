import { QueryClient } from '@tanstack/react-query'

/** Shared TanStack Query client (server state + live nutrition roll-ups later). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
