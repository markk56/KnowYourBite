import { describe, it, expect } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/i18n'
import { ThemeProvider } from '@/theme'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPlaceholder } from '@/pages/DashboardPlaceholder'

function renderShell(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppShell>{children}</AppShell>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('AppShell', () => {
  it('renders the brand lockup and localized welcome content', () => {
    renderShell(<DashboardPlaceholder />)
    expect(screen.getByRole('heading', { level: 1, name: 'Know Your Bite' })).toBeInTheDocument()
    expect(screen.getByAltText('Know Your Bite')).toBeInTheDocument()
    expect(screen.getByText('Welcome to Know Your Bite')).toBeInTheDocument()
  })

  it('renders the five navigation entries', () => {
    renderShell(<DashboardPlaceholder />)
    for (const label of ['Dashboard', 'Clients', 'Recipes', 'Meal Planner', 'Settings']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})
