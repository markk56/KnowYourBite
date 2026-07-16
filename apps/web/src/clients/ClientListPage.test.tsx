import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ClientDto } from '@kyb/shared'
import '@/i18n'
import { ThemeProvider } from '@/theme'
import { ClientListPage } from './ClientListPage'
import { clientKeys } from './queries'

function makeClient(over: Partial<ClientDto>): ClientDto {
  return {
    id: 'c1',
    fullName: 'Sample Client',
    email: null,
    phone: null,
    clientType: 'standard',
    clientSince: '2026-07-15',
    assessmentStatus: 'unfinished',
    avatarUrl: null,
    notes: null,
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    ...over,
  }
}

function renderClients(seed?: ClientDto[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  if (seed) queryClient.setQueryData(clientKeys.list({}), seed)
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ClientListPage />
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ClientListPage', () => {
  it('renders the empty state with a New client CTA when there are no clients', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: { clients: [] } }),
      }),
    )
    renderClients()
    expect(await screen.findByText('No clients yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first client to get started.')).toBeInTheDocument()
    // Header button + empty-state CTA both read "New client".
    expect(screen.getAllByText('New client').length).toBeGreaterThan(0)
  })

  it('renders a card per client with a type label', async () => {
    renderClients([
      makeClient({ id: 'a', fullName: 'Alice Anderson', clientType: 'standard' }),
      makeClient({ id: 'b', fullName: 'Bob Runner', clientType: 'sports' }),
    ])
    await waitFor(() => {
      expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
      expect(screen.getByText('Bob Runner')).toBeInTheDocument()
    })
    // 'Sports' appears both as a filter <option> and as the card's type label.
    expect(screen.getAllByText('Sports').length).toBeGreaterThanOrEqual(2)
  })
})
