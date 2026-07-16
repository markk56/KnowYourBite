import { QueryClientProvider } from '@tanstack/react-query'
import { Route, Switch } from 'wouter'
import { useTranslation } from 'react-i18next'
import { queryClient } from '@/lib/queryClient'
import { ThemeProvider } from '@/theme'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPlaceholder } from '@/pages/DashboardPlaceholder'
import { AuthPage } from '@/pages/AuthPage'
import { ClientListPage } from '@/clients/ClientListPage'
import { ClientDetailPage } from '@/clients/ClientDetailPage'
import { AssessmentWizard } from '@/assessments/AssessmentWizard'
import { RecipeListPage } from '@/recipes/RecipeListPage'
import { RecipeEditorPage, RecipeCreatePage } from '@/recipes/RecipeEditorPage'
import { useCurrentUser } from '@/auth/useAuth'

function ComingSoon({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center">
      <h3 className="text-xl font-semibold text-foreground">{t(titleKey)}</h3>
      <p className="mt-2 text-muted-foreground">{t('nav.comingSoon')}</p>
    </div>
  )
}

function Root() {
  const { t } = useTranslation()
  const { data: user, isPending } = useCurrentUser()

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        {t('auth.loading')}
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DashboardPlaceholder} />
        <Route path="/clients" component={ClientListPage} />
        <Route path="/clients/:id/assessment" component={AssessmentWizard} />
        <Route path="/clients/:id" component={ClientDetailPage} />
        <Route path="/recipes" component={RecipeListPage} />
        <Route path="/recipes/new" component={RecipeCreatePage} />
        <Route path="/recipes/:id" component={RecipeEditorPage} />
        <Route path="/planner">{() => <ComingSoon titleKey="nav.planner" />}</Route>
        <Route path="/settings">{() => <ComingSoon titleKey="nav.settings" />}</Route>
        <Route>{() => <ComingSoon titleKey="nav.dashboard" />}</Route>
      </Switch>
    </AppShell>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
