import { useTranslation } from 'react-i18next'
import type { NutrientsDto } from '@kyb/shared'

/**
 * Three-level nutrition view. `total` and `perServing` are the deterministic
 * numbers the server derived from frozen ingredient snapshots — the client only
 * formats them, never computes clinical values.
 */
export function NutritionTable({
  total,
  perServing,
  servings,
}: {
  total: NutrientsDto
  perServing: NutrientsDto
  servings: number
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  const fmt = (v: number, decimals = 1) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)

  const rows: Array<{ key: string; label: string; per: number; tot: number; decimals: number }> = [
    { key: 'kcal', label: t('recipes.nutrition.kcal'), per: perServing.kcal, tot: total.kcal, decimals: 0 },
    { key: 'protein', label: t('recipes.nutrition.protein'), per: perServing.proteinG, tot: total.proteinG, decimals: 1 },
    { key: 'carbs', label: t('recipes.nutrition.carbs'), per: perServing.carbG, tot: total.carbG, decimals: 1 },
    { key: 'fat', label: t('recipes.nutrition.fat'), per: perServing.fatG, tot: total.fatG, decimals: 1 },
    { key: 'fiber', label: t('recipes.nutrition.fiber'), per: perServing.fiberG, tot: total.fiberG, decimals: 1 },
    { key: 'salt', label: t('recipes.nutrition.salt'), per: perServing.saltG, tot: total.saltG, decimals: 2 },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 font-medium">{t('recipes.nutrition.nutrient')}</th>
            <th className="py-2 text-right font-medium">{t('recipes.nutrition.perServing')}</th>
            <th className="py-2 text-right font-medium">
              {t('recipes.nutrition.total')} ({servings})
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/50 last:border-0">
              <td className="py-2 text-foreground">{row.label}</td>
              <td className="py-2 text-right tabular-nums text-foreground">{fmt(row.per, row.decimals)}</td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(row.tot, row.decimals)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
