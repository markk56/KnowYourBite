import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { RECIPE_CATEGORY_KINDS, type RecipeCategoryKind, type RecipeDto } from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { recipesApi } from './api'
import { recipeKeys, useCategories, useSetCategories } from './queries'

/** Attach/detach per-tenant categories to a recipe, and create new ones inline. */
export function CategoryManager({ recipe }: { recipe: RecipeDto }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: categories } = useCategories()
  const setCategories = useSetCategories(recipe.id)

  const [newKind, setNewKind] = useState<RecipeCategoryKind>('category')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const attached = new Set(recipe.categories.map((c) => c.id))

  const toggle = (categoryId: string) => {
    const next = attached.has(categoryId)
      ? [...attached].filter((x) => x !== categoryId)
      : [...attached, categoryId]
    setCategories.mutate(next)
  }

  const createCategory = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const created = await recipesApi.createCategory({ kind: newKind, nameEn: name })
      await qc.invalidateQueries({ queryKey: recipeKeys.categories })
      setNewName('')
      // Auto-attach the newly created category.
      setCategories.mutate([...attached, created.id])
    } finally {
      setCreating(false)
    }
  }

  const byKind = (kind: RecipeCategoryKind) => (categories ?? []).filter((c) => c.kind === kind)

  return (
    <div className="space-y-4">
      {RECIPE_CATEGORY_KINDS.map((kind) => (
        <div key={kind}>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t(`recipes.categories.kind.${kind}`)}
          </p>
          <div className="flex flex-wrap gap-2">
            {byKind(kind).length === 0 && (
              <span className="text-sm text-muted-foreground">{t('recipes.categories.none')}</span>
            )}
            {byKind(kind).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                disabled={setCategories.isPending}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  attached.has(c.id)
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                )}
                aria-pressed={attached.has(c.id)}
              >
                {c.nameEn}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t('recipes.categories.newKind')}</label>
          <Select value={newKind} onChange={(e) => setNewKind(e.target.value as RecipeCategoryKind)} className="w-40">
            {RECIPE_CATEGORY_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`recipes.categories.kind.${k}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">{t('recipes.categories.newName')}</label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('recipes.categories.newNamePlaceholder')} />
        </div>
        <Button variant="outline" onClick={createCategory} disabled={creating || !newName.trim()}>
          <Plus className="h-4 w-4" />
          {t('recipes.categories.create')}
        </Button>
      </div>
    </div>
  )
}
