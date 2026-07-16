import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Plus } from 'lucide-react'
import {
  MEAL_PLAN_PERIODS,
  type MealPlanCreateInput,
  type MealPlanPeriod,
  type MealPlanSummaryDto,
} from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { useClients } from '@/clients/queries'
import { useCreateMealPlan, useMealPlans } from './queries'

function PlanCard({ plan }: { plan: MealPlanSummaryDto }) {
  const { t } = useTranslation()
  return (
    <Link
      href={`/planner/${plan.id}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate font-semibold text-foreground">{plan.title}</p>
        <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {t(`planner.status.${plan.status}`)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{plan.clientName}</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{t(`planner.period.${plan.period}`)}</span>
        <span>{t('planner.list.entryCount', { count: plan.entryCount })}</span>
        {plan.targetKcal != null && <span>{t('planner.list.targetKcal', { kcal: Math.round(plan.targetKcal) })}</span>}
      </div>
    </Link>
  )
}

function CreatePlanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [, setLocation] = useLocation()
  const { data: clients } = useClients({})
  const createPlan = useCreateMealPlan()

  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [period, setPeriod] = useState<MealPlanPeriod>('week')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    if (!clientId) return setError(t('planner.create.clientRequired'))
    if (!title.trim()) return setError(t('planner.create.titleRequired'))
    const input: MealPlanCreateInput = { clientId, title: title.trim(), period }
    createPlan.mutate(input, {
      onSuccess: (plan) => {
        onClose()
        setLocation(`/planner/${plan.id}`)
      },
      onError: (e) => setError(e instanceof Error ? e.message : t('planner.create.error')),
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('planner.create.title')}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">{t('planner.create.client')}</label>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label={t('planner.create.client')}>
            <option value="">{t('planner.create.selectClient')}</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">{t('planner.create.planTitle')}</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('planner.create.titlePlaceholder')}
            aria-label={t('planner.create.planTitle')}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">{t('planner.create.period')}</label>
          <Select value={period} onChange={(e) => setPeriod(e.target.value as MealPlanPeriod)} aria-label={t('planner.create.period')}>
            {MEAL_PLAN_PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`planner.period.${p}`)}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={createPlan.isPending}>
            {t('planner.create.cancel')}
          </Button>
          <Button onClick={submit} disabled={createPlan.isPending}>
            {createPlan.isPending ? t('planner.create.creating') : t('planner.create.submit')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export function PlannerListPage() {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: plans, isPending, isError } = useMealPlans()

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('planner.title')}</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('planner.new')}
        </Button>
      </div>

      {isPending ? (
        <p className="text-muted-foreground">{t('planner.loading')}</p>
      ) : isError ? (
        <p className="text-destructive">{t('planner.loadError')}</p>
      ) : plans.length === 0 ? (
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t('planner.empty.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('planner.empty.body')}</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('planner.empty.cta')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}

      <CreatePlanDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
