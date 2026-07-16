import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Sparkles, Trash2, X } from 'lucide-react'
import { ALLERGENS, type Allergen, type RecipeAllergenDto } from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  useAddAllergen,
  useConfirmAllergen,
  useRemoveAllergen,
  useSuggestAllergens,
} from './queries'

/**
 * Allergen review — deterministic floor + additive AI/dietitian flags. A
 * `deterministic` flag can never be removed (the server enforces it too); the
 * dietitian confirms the final list. AI suggestions are additive-only.
 */
export function AllergenReview({ recipeId, allergens }: { recipeId: string; allergens: RecipeAllergenDto[] }) {
  const { t } = useTranslation()
  const [toAdd, setToAdd] = useState<Allergen | ''>('')
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null)

  const add = useAddAllergen(recipeId)
  const confirm = useConfirmAllergen(recipeId)
  const remove = useRemoveAllergen(recipeId)
  const suggest = useSuggestAllergens(recipeId)

  const present = new Set(allergens.map((a) => a.allergen))
  const addable = ALLERGENS.filter((a) => !present.has(a))

  const runSuggest = () => {
    setSuggestMsg(null)
    suggest.mutate(undefined, {
      onSuccess: ({ result }) => {
        setSuggestMsg(
          result.status === 'unavailable'
            ? t('recipes.allergens.aiUnavailable')
            : result.added.length === 0
              ? t('recipes.allergens.aiNothingNew')
              : t('recipes.allergens.aiAdded', { count: result.added.length }),
        )
      },
    })
  }

  return (
    <div className="space-y-4">
      {allergens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('recipes.allergens.none')}</p>
      ) : (
        <ul className="space-y-2">
          {allergens.map((a) => (
            <li
              key={a.allergen}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{t(`recipes.allergen.${a.allergen}`)}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                    a.source === 'deterministic'
                      ? 'bg-primary/15 text-primary'
                      : a.source === 'ai'
                        ? 'bg-secondary/20 text-secondary-foreground'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {t(`recipes.allergens.source.${a.source}`)}
                </span>
                {a.isConfirmed && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    <Check className="h-3.5 w-3.5" />
                    {t('recipes.allergens.confirmed')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => confirm.mutate({ allergen: a.allergen, isConfirmed: !a.isConfirmed })}
                  disabled={confirm.isPending}
                >
                  {a.isConfirmed ? t('recipes.allergens.unconfirm') : t('recipes.allergens.confirm')}
                </Button>
                {a.source !== 'deterministic' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.mutate(a.allergen)}
                    disabled={remove.isPending}
                    aria-label={t('recipes.allergens.remove')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {a.source === 'deterministic' && (
                  <span title={t('recipes.allergens.cannotRemove')} className="text-muted-foreground">
                    <X className="h-4 w-4 opacity-40" />
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={toAdd}
          onChange={(e) => setToAdd(e.target.value as Allergen | '')}
          className="w-auto"
          aria-label={t('recipes.allergens.addLabel')}
          disabled={addable.length === 0}
        >
          <option value="">{t('recipes.allergens.addLabel')}</option>
          {addable.map((a) => (
            <option key={a} value={a}>
              {t(`recipes.allergen.${a}`)}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          disabled={!toAdd || add.isPending}
          onClick={() => {
            if (toAdd) add.mutate(toAdd, { onSuccess: () => setToAdd('') })
          }}
        >
          {t('recipes.allergens.addButton')}
        </Button>
        <Button variant="secondary" onClick={runSuggest} disabled={suggest.isPending}>
          <Sparkles className="h-4 w-4" />
          {suggest.isPending ? t('recipes.allergens.suggesting') : t('recipes.allergens.suggest')}
        </Button>
      </div>
      {suggestMsg && <p className="text-sm text-muted-foreground">{suggestMsg}</p>}
    </div>
  )
}
