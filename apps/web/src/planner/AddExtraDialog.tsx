import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, Search } from 'lucide-react'
import {
  INGREDIENT_UNITS,
  VOLUME_UNITS,
  type AddExtraInput,
  type IngredientUnit,
  type UsdaFoodDto,
} from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { useUsdaSearch } from '@/recipes/queries'

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/**
 * Add a standalone USDA food ("extra") to a meal window. The server freezes the
 * per-100g snapshot at add-time, so the client sends only the fdcId + authored
 * amount — never nutrient values — exactly like a recipe ingredient.
 */
export function AddExtraDialog({
  open,
  windowId,
  windowName,
  onClose,
  onAdd,
  isAdding,
}: {
  open: boolean
  windowId: string | null
  windowName: string
  onClose: () => void
  onAdd: (input: AddExtraInput) => void
  isAdding: boolean
}) {
  const { t } = useTranslation()
  const [term, setTerm] = useState('')
  const [includeBranded, setIncludeBranded] = useState(false)
  const [selected, setSelected] = useState<UsdaFoodDto | null>(null)

  const debounced = useDebounced(term, 350)
  const { data, isFetching } = useUsdaSearch(debounced, includeBranded)
  const foods = data?.foods ?? []
  const degraded = data?.degraded ?? false

  const reset = () => {
    setTerm('')
    setSelected(null)
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={t('planner.extra.title', { window: windowName })}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t('planner.extra.search')}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label={t('planner.extra.search')}
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={includeBranded}
              onChange={(e) => setIncludeBranded(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            {t('recipes.ingredients.branded')}
          </label>
        </div>

        {degraded && <p className="text-xs text-muted-foreground">{t('recipes.ingredients.degraded')}</p>}

        {debounced.trim().length >= 2 && foods.length > 0 && !selected && (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {foods.map((food) => (
              <li key={food.fdcId}>
                <button
                  type="button"
                  onClick={() => setSelected(food)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">{food.descriptionEn}</span>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    {Math.round(food.per100g.kcal)} kcal/100g
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {debounced.trim().length >= 2 && !isFetching && foods.length === 0 && !selected && (
          <p className="text-sm text-muted-foreground">{t('recipes.ingredients.noResults')}</p>
        )}

        {selected && windowId && (
          <QuantityForm
            food={selected}
            windowId={windowId}
            isAdding={isAdding}
            onCancel={() => setSelected(null)}
            onAdd={(input) => {
              onAdd(input)
              reset()
            }}
          />
        )}
      </div>
    </Dialog>
  )
}

function QuantityForm({
  food,
  windowId,
  onAdd,
  onCancel,
  isAdding,
}: {
  food: UsdaFoodDto
  windowId: string
  onAdd: (input: AddExtraInput) => void
  onCancel: () => void
  isAdding: boolean
}) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('100')
  const [unit, setUnit] = useState<IngredientUnit>('g')
  const [density, setDensity] = useState('1')
  const [gramsPerPiece, setGramsPerPiece] = useState('50')

  const needsDensity = useMemo(() => VOLUME_UNITS.includes(unit), [unit])
  const needsPiece = unit === 'piece'

  const submit = () => {
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return
    const input: AddExtraInput = { windowId, fdcId: food.fdcId, amount: amt, unit }
    if (needsDensity) input.densityGPerMl = Number(density) || 1
    if (needsPiece) input.gramsPerPiece = Number(gramsPerPiece) || 1
    onAdd(input)
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-muted/40 p-4">
      <p className="mb-3 text-sm font-medium text-foreground">{food.descriptionEn}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t('recipes.ingredients.amount')}</label>
          <Input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t('recipes.ingredients.unit')}</label>
          <Select value={unit} onChange={(e) => setUnit(e.target.value as IngredientUnit)} className="w-24">
            {INGREDIENT_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </div>
        {needsDensity && (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('recipes.ingredients.density')}</label>
            <Input type="number" min="0" step="any" value={density} onChange={(e) => setDensity(e.target.value)} className="w-24" />
          </div>
        )}
        {needsPiece && (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('recipes.ingredients.gramsPerPiece')}</label>
            <Input type="number" min="0" step="any" value={gramsPerPiece} onChange={(e) => setGramsPerPiece(e.target.value)} className="w-24" />
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={submit} disabled={isAdding}>
            <Plus className="h-4 w-4" />
            {t('recipes.ingredients.add')}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isAdding}>
            {t('recipes.form.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
