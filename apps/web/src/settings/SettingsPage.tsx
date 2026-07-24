import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { FOOD_PREFERENCE_CATEGORIES, type FoodPreferenceCategory, type FoodPreferenceItemDto } from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useCreateFoodPreference,
  useFoodPreferences,
  useRemoveFoodPreference,
  useRenameFoodPreference,
} from './queries'

const CATEGORY_ICONS: Record<FoodPreferenceCategory, string> = {
  breakfast: '🍳',
  lunch: '🍲',
  dinner: '🌙',
  snack: '🥨',
  dessert: '🍰',
}

/**
 * Settings — the food-preference nomenclator. The dietitian curates the typical
 * breakfast/lunch/dinner/snack/dessert lists that appear as quick checklists in
 * the anamnesis ("Tipikus ételek"). Add / rename / delete, per category.
 */
export function SettingsPage() {
  const { t } = useTranslation()
  const { data: items, isPending, isError } = useFoodPreferences()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">{t('settings.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.foodPrefs.subtitle')}</p>
      </div>

      {isPending && <p className="text-muted-foreground">{t('settings.loading')}</p>}
      {isError && <p className="text-destructive">{t('settings.loadError')}</p>}

      {items && (
        <div className="grid gap-4 md:grid-cols-2">
          {FOOD_PREFERENCE_CATEGORIES.map((category) => (
            <CategoryCard
              key={category}
              category={category}
              items={items.filter((i) => i.category === category)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryCard({ category, items }: { category: FoodPreferenceCategory; items: FoodPreferenceItemDto[] }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const create = useCreateFoodPreference()

  const add = () => {
    const label = draft.trim()
    if (label === '') return
    create.mutate({ category, label }, { onSuccess: () => setDraft('') })
  }

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
        <span aria-hidden>{CATEGORY_ICONS[category]}</span>
        {t(`settings.category.${category}`)}
        <span className="ml-auto text-xs font-normal text-muted-foreground">{items.length}</span>
      </h3>

      {items.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">{t('settings.foodPrefs.empty')}</p>
      ) : (
        <ul className="mb-3 divide-y divide-border/60">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      <div className="mt-auto flex gap-2 border-t border-border/60 pt-3">
        <Input
          value={draft}
          placeholder={t('settings.foodPrefs.addPlaceholder')}
          aria-label={t('settings.foodPrefs.add')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          className="h-9"
        />
        <Button type="button" size="sm" variant="outline" disabled={create.isPending || draft.trim() === ''} onClick={add}>
          <Plus className="h-4 w-4" />
          {t('settings.foodPrefs.add')}
        </Button>
      </div>
      {create.isError && <p className="mt-2 text-xs text-destructive">{t('settings.foodPrefs.saveError')}</p>}
    </section>
  )
}

function ItemRow({ item }: { item: FoodPreferenceItemDto }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(item.label)
  const rename = useRenameFoodPreference()
  const remove = useRemoveFoodPreference()

  const commit = () => {
    const next = label.trim()
    if (next === '' || next === item.label) {
      setEditing(false)
      setLabel(item.label)
      return
    }
    rename.mutate({ id: item.id, input: { label: next } }, { onSuccess: () => setEditing(false) })
  }

  if (editing) {
    return (
      <li className="flex items-center gap-1.5 py-1.5">
        <Input
          value={label}
          autoFocus
          aria-label={t('settings.foodPrefs.rename')}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
            if (e.key === 'Escape') {
              setEditing(false)
              setLabel(item.label)
            }
          }}
          className="h-8"
        />
        <button
          type="button"
          aria-label={t('settings.foodPrefs.save')}
          disabled={rename.isPending}
          onClick={commit}
          className="rounded-md p-1.5 text-primary transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t('settings.foodPrefs.cancel')}
          onClick={() => {
            setEditing(false)
            setLabel(item.label)
          }}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        {rename.isError && <span className="text-xs text-destructive">{t('settings.foodPrefs.saveError')}</span>}
      </li>
    )
  }

  return (
    <li className="group flex items-center gap-1.5 py-1.5">
      <span className="flex-1 text-sm text-foreground">{item.label}</span>
      <button
        type="button"
        aria-label={t('settings.foodPrefs.rename')}
        onClick={() => setEditing(true)}
        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={t('settings.foodPrefs.delete')}
        disabled={remove.isPending}
        onClick={() => remove.mutate(item.id)}
        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  )
}
