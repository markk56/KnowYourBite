import { useTranslation } from 'react-i18next'
import type { DayTargetComparisonDto, NutrientsDto } from '@kyb/shared'
import { cn } from '@/lib/utils'

/**
 * The live, deterministic nutrition dashboard for a single day. Every number is
 * server-computed from `@kyb/domain` and returned on the plan DTO, so it updates
 * the instant a drop / multiplier change round-trips. When the plan snapshotted a
 * target, each macro shows current-vs-target with a progress bar.
 */

interface MacroRow {
  key: 'kcal' | 'proteinG' | 'carbsG' | 'fatG'
  current: number
  target: number | null
  percent: number | null
}

function macroRows(nutrition: NutrientsDto, cmp: DayTargetComparisonDto | null): MacroRow[] {
  return [
    { key: 'kcal', current: nutrition.kcal, target: cmp?.target.targetKcal ?? null, percent: cmp?.percentOfTarget.kcal ?? null },
    { key: 'proteinG', current: nutrition.proteinG, target: cmp?.target.proteinG ?? null, percent: cmp?.percentOfTarget.proteinG ?? null },
    { key: 'carbsG', current: nutrition.carbG, target: cmp?.target.carbsG ?? null, percent: cmp?.percentOfTarget.carbsG ?? null },
    { key: 'fatG', current: nutrition.fatG, target: cmp?.target.fatG ?? null, percent: cmp?.percentOfTarget.fatG ?? null },
  ]
}

/** Bar hue: within ±10% of target = good, under = neutral, over = warning. */
function barTone(percent: number | null): string {
  if (percent == null) return 'bg-primary'
  if (percent > 110) return 'bg-destructive'
  if (percent >= 90) return 'bg-secondary'
  return 'bg-primary'
}

export function NutritionDashboard({
  nutrition,
  comparison,
  labelKey,
}: {
  nutrition: NutrientsDto
  comparison: DayTargetComparisonDto | null
  labelKey: string
}) {
  const { t, i18n } = useTranslation()
  const fmt = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  const rows = macroRows(nutrition, comparison)

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(labelKey)}</p>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{t(`planner.macro.${row.key}`)}</span>
              <span className="tabular-nums text-foreground">
                {fmt.format(row.current)}
                {row.target != null && (
                  <span className="text-muted-foreground"> / {fmt.format(row.target)}</span>
                )}
              </span>
            </div>
            {row.target != null && row.percent != null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={cn('h-full rounded-full transition-all', barTone(row.percent))}
                  style={{ width: `${Math.min(row.percent, 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {comparison == null && (
        <p className="text-xs text-muted-foreground">{t('planner.dashboard.noTarget')}</p>
      )}
    </div>
  )
}
