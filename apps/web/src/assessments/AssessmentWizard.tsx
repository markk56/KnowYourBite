import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ClipboardList, Sparkles } from 'lucide-react'
import {
  isEmptyEntryRow,
  isEmptyPayloadValue,
  isEntryRowArray,
  pruneAssessmentPayload,
  sectionsForType,
  type AssessmentDraftInput,
  type AssessmentDto,
  type AssessmentField,
  type AssessmentPayload,
  type AssessmentPayloadValue,
  type FinishWithAiResult,
  type Sex,
} from '@kyb/shared'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useClient } from '@/clients/queries'
import { groupFoodPreferences, useFoodPreferences } from '@/settings/queries'
import { FormEngine } from './FormEngine'
import { FinishWithAiPanel } from './FinishWithAiPanel'
import { assessmentsApi } from './api'
import { useApprovedTargets, useCreateAssessment, useCurrentAssessment, useSaveDraft } from './queries'

interface FormValues {
  sex: string
  ageYears: string
  heightCm: string
  weightKg: string
  activityFactor: string
  payload: Record<string, AssessmentPayloadValue>
}

const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s))

function fromAssessment(a: AssessmentDto): FormValues {
  return {
    sex: a.sex ?? '',
    ageYears: a.ageYears != null ? String(a.ageYears) : '',
    heightCm: a.heightCm != null ? String(a.heightCm) : '',
    weightKg: a.weightKg != null ? String(a.weightKg) : '',
    activityFactor: a.activityFactor != null ? String(a.activityFactor) : '',
    // Values keep their stored shape — structured answers pass straight through.
    payload: { ...(a.payload ?? {}) },
  }
}

export function AssessmentWizard() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const clientId = params.id ?? ''
  const [, setLocation] = useLocation()

  const { data: client } = useClient(clientId)
  const { data: current, isPending } = useCurrentAssessment(clientId)
  const create = useCreateAssessment(clientId)

  const backLink = (
    <Link
      href={`/clients/${clientId}`}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {t('assessments.back')}
    </Link>
  )

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {backLink}
        <p className="text-muted-foreground">{t('assessments.loading')}</p>
      </div>
    )
  }

  // No draft, or the last one is already completed → offer to start a fresh one.
  if (!current || current.status === 'completed') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {backLink}
        {current?.status === 'completed' && <CompletedSummary clientId={clientId} assessment={current} />}
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">{t('assessments.startTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('assessments.startBody', { type: t(`clients.type.${client?.clientType ?? 'standard'}`) })}
          </p>
          <Button className="mt-4" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? t('assessments.starting') : t('assessments.start')}
          </Button>
        </div>
      </div>
    )
  }

  return <DraftEditor key={current.id} clientId={clientId} assessment={current} onDone={() => setLocation(`/clients/${clientId}`)} />
}

function CompletedSummary({ clientId, assessment }: { clientId: string; assessment: AssessmentDto }) {
  const { t } = useTranslation()
  const { data: targets } = useApprovedTargets(clientId, assessment.id)
  if (!targets) return null
  const r = Math.round
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
        {t('assessments.review.finalTargets')}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('assessments.review.kcal')} value={r(targets.targetKcal)} />
        <Stat label={t('assessments.review.protein')} value={r(targets.proteinG)} />
        <Stat label={t('assessments.review.carbs')} value={r(targets.carbsG)} />
        <Stat label={t('assessments.review.fat')} value={r(targets.fatG)} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

function DraftEditor({
  clientId,
  assessment,
  onDone,
}: {
  clientId: string
  assessment: AssessmentDto
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState<FormValues>(() => fromAssessment(assessment))
  const [finishResult, setFinishResult] = useState<FinishWithAiResult | null>(null)
  const save = useSaveDraft(clientId, assessment.id)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: foodItems, isError: foodPrefsError } = useFoodPreferences()
  // On a failed load fall back to empty lists — the pickers stay editable
  // ("other" + already-stored chips) instead of a permanent loading state.
  const foodOptions = useMemo(
    () => (foodPrefsError ? {} : groupFoodPreferences(foodItems)),
    [foodItems, foodPrefsError],
  )

  const sections = useMemo(() => sectionsForType(assessment.type), [assessment.type])
  const numericPayloadKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const s of sections)
      for (const f of [...(s.fields ?? []), ...(s.subgroups ?? []).flatMap((g) => g.fields)])
        if (!f.bind && (f.kind === 'number' || f.kind === 'scale')) keys.add(f.key)
    return keys
  }, [sections])

  const toDraft = (v: FormValues): AssessmentDraftInput => {
    const sex = v.sex ? (v.sex as Sex) : null
    const payload: AssessmentPayload = {}
    for (const [k, raw] of Object.entries(v.payload)) {
      let val: AssessmentPayloadValue = raw
      if (typeof val === 'string') {
        if (val.trim() === '') continue
        if (numericPayloadKeys.has(k)) val = Number(val)
      }
      if (isEntryRowArray(val)) val = val.filter((row) => !isEmptyEntryRow(row))
      if (isEmptyPayloadValue(val)) continue
      payload[k] = val
    }
    return {
      sex,
      ageYears: v.ageYears.trim() === '' ? null : Math.round(Number(v.ageYears)),
      heightCm: numOrNull(v.heightCm),
      weightKg: numOrNull(v.weightKg),
      activityFactor: numOrNull(v.activityFactor),
      // Answers hidden by a failed visibleIf (e.g. women's health for a male
      // client) never persist — the draft stays free of contradictory data.
      payload: pruneAssessmentPayload(payload, sex),
    }
  }

  // Flush (not just cancel) any pending debounced save when the editor
  // unmounts, so navigating away right after typing never loses the last edits.
  const flushPending = useRef<() => void>(() => {})
  const scheduleSave = (next: FormValues) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      save.mutate(toDraft(next))
    }, 800)
    flushPending.current = () => {
      if (timer.current !== null) {
        clearTimeout(timer.current)
        timer.current = null
        save.mutate(toDraft(next))
      }
    }
  }
  useEffect(() => () => flushPending.current(), [])

  const getValue = (field: AssessmentField): unknown =>
    field.bind ? values[field.bind] : (values.payload[field.key] ?? '')

  /** Resolve a `visibleIf` key — same rule as `pruneAssessmentPayload` ('sex' or a payload key). */
  const valueForKey = (key: string): unknown => (key === 'sex' ? values.sex : values.payload[key])

  const onChange = (field: AssessmentField, value: AssessmentPayloadValue) => {
    const next: FormValues = field.bind
      ? { ...values, [field.bind]: typeof value === 'string' ? value : String(value ?? '') }
      : { ...values, payload: { ...values.payload, [field.key]: value } }
    setValues(next)
    scheduleSave(next)
  }

  const finish = useMutation({
    mutationFn: async () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null // the unmount flush must not re-fire a stale save
      }
      await save.mutateAsync(toDraft(values)) // flush before finishing
      return assessmentsApi.finish(clientId, assessment.id)
    },
    onSuccess: (res) => setFinishResult(res),
  })

  if (finishResult) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={() => setFinishResult(null)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('assessments.backToForm')}
        </button>
        <h2 className="text-xl font-bold text-foreground">{t('assessments.reviewTitle')}</h2>
        <FinishWithAiPanel
          clientId={clientId}
          assessmentId={assessment.id}
          result={finishResult}
          onApproved={onDone}
          onRetry={() => finish.mutate()}
          retrying={finish.isPending}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/clients/${clientId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('assessments.back')}
        </Link>
        <span className={save.isError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {save.isPending
            ? t('assessments.saving')
            : save.isError
              ? t('assessments.saveFailed')
              : t('assessments.saved')}
        </span>
      </div>

      <h2 className="text-xl font-bold text-foreground">{t('assessments.title')}</h2>

      <FormEngine
        sections={sections}
        getValue={getValue}
        onChange={onChange}
        disabled={finish.isPending}
        valueForKey={valueForKey}
        foodOptions={foodOptions}
      />

      {finish.error && <p className="text-sm text-destructive">{t('assessments.finishError')}</p>}

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={() => finish.mutate()} disabled={finish.isPending}>
          <Sparkles className="h-4 w-4" />
          {finish.isPending ? t('assessments.finishing') : t('assessments.finish')}
        </Button>
      </div>
    </div>
  )
}
