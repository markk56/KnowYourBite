import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Sparkles, Check, AlertTriangle, RotateCcw } from 'lucide-react'
import type { AiDecision, DeterministicTargetsDto, FinishWithAiResult } from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { assessmentsApi } from './api'
import { assessmentKeys } from './queries'

interface Props {
  clientId: string
  assessmentId: string
  result: FinishWithAiResult
  onApproved: () => void
  onRetry: () => void
  retrying: boolean
}

const round = (n: number) => Math.round(n)

function TargetRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">
        {round(value)} <span className="font-normal text-muted-foreground">{unit}</span>
      </span>
    </div>
  )
}

export function FinishWithAiPanel({ clientId, assessmentId, result, onApproved, onRetry, retrying }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const proposed = result.ai.status === 'proposed' ? result.ai : null
  // Prefill the editable final targets from the AI's suggested targets when
  // present, otherwise from the deterministic maintenance figures.
  const seed: DeterministicTargetsDto = proposed ? proposed.adjustedTargets : result.deterministic
  const [kcal, setKcal] = useState(String(round(seed.targetKcal)))
  const [protein, setProtein] = useState(String(round(seed.proteinG)))
  const [carbs, setCarbs] = useState(String(round(seed.carbsG)))
  const [fat, setFat] = useState(String(round(seed.fatG)))

  const approve = useMutation({
    mutationFn: () => {
      // Provenance: accepted = AI values untouched; edited = AI values changed;
      // rejected = dietitian-authored (no usable AI proposal).
      let decisionSummary: AiDecision = 'rejected'
      if (proposed) {
        const untouched =
          Number(kcal) === round(seed.targetKcal) &&
          Number(protein) === round(seed.proteinG) &&
          Number(carbs) === round(seed.carbsG) &&
          Number(fat) === round(seed.fatG)
        decisionSummary = untouched ? 'accepted' : 'edited'
      }
      return assessmentsApi.approve(clientId, assessmentId, {
        targetKcal: Number(kcal),
        proteinG: Number(protein),
        carbsG: Number(carbs),
        fatG: Number(fat),
        decisionSummary,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: assessmentKeys.all(clientId) })
      onApproved()
    },
  })

  return (
    <div className="space-y-4">
      {/* Deterministic — authoritative */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('assessments.review.deterministic')}
        </h3>
        <TargetRow label={t('assessments.review.bmr')} value={result.deterministic.bmrKcal} unit="kcal" />
        <TargetRow
          label={t('assessments.review.maintenance')}
          value={result.deterministic.maintenanceTdeeKcal}
          unit="kcal"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t('assessments.review.deterministicNote')}</p>
      </div>

      {/* AI proposal — a suggestion, clearly labeled */}
      {proposed ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            {t('assessments.review.aiTitle')}
          </h3>
          <p className="whitespace-pre-wrap text-sm text-foreground">{proposed.proposal.summary}</p>
          <p className="mt-2 text-sm text-foreground">
            <span className="font-medium">{t('assessments.review.suggestedAdjustment')}: </span>
            {proposed.proposal.calorieAdjustmentPercent > 0 ? '+' : ''}
            {proposed.proposal.calorieAdjustmentPercent}% → {round(proposed.adjustedTargets.targetKcal)} kcal
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{proposed.proposal.rationale}</p>
          {proposed.proposal.focusAreas.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
              {proposed.proposal.focusAreas.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{t('assessments.review.aiNote')}</p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            {result.ai.status === 'unavailable' && !result.ai.retryable
              ? t('assessments.review.aiOff')
              : t('assessments.review.aiUnavailable')}
          </p>
          {result.ai.status === 'unavailable' && result.ai.retryable && (
            <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
              <RotateCcw className="h-4 w-4" />
              {t('assessments.review.retry')}
            </Button>
          )}
        </div>
      )}

      {/* Editable human-final targets */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('assessments.review.finalTargets')}
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { key: 'kcal', label: t('assessments.review.kcal'), value: kcal, set: setKcal },
            { key: 'protein', label: t('assessments.review.protein'), value: protein, set: setProtein },
            { key: 'carbs', label: t('assessments.review.carbs'), value: carbs, set: setCarbs },
            { key: 'fat', label: t('assessments.review.fat'), value: fat, set: setFat },
          ].map((f) => (
            <div key={f.key} className="space-y-1">
              <label htmlFor={`ft-${f.key}`} className="text-xs font-medium text-muted-foreground">
                {f.label}
              </label>
              <Input
                id={`ft-${f.key}`}
                type="number"
                inputMode="decimal"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
              />
            </div>
          ))}
        </div>

        {approve.error && <p className="mt-3 text-sm text-destructive">{t('assessments.review.approveError')}</p>}

        <div className="mt-4 flex justify-end">
          <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
            <Check className="h-4 w-4" />
            {approve.isPending ? t('assessments.review.approving') : t('assessments.review.approve')}
          </Button>
        </div>
      </div>
    </div>
  )
}
