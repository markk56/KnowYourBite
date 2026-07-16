import { useState } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, Download, Pencil, Trash2, X } from 'lucide-react'
import { VOLUME_UNITS, type RecipeDto, type RecipeIngredientDto } from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RecipeMetaForm } from './RecipeMetaForm'
import { IngredientSearch } from './IngredientSearch'
import { NutritionTable } from './NutritionTable'
import { AllergenReview } from './AllergenReview'
import { ExportDialog } from './ExportDialog'
import { CategoryManager } from './CategoryManager'
import { useAddIngredient, useDeleteRecipe, useRecipe, useRemoveIngredient, useUpdateIngredient } from './queries'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function isMassUnit(unit: string): boolean {
  return !(VOLUME_UNITS as readonly string[]).includes(unit) && unit !== 'piece'
}

function IngredientRow({ recipeId, ing }: { recipeId: string; ing: RecipeIngredientDto }) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(String(ing.amount))
  const update = useUpdateIngredient(recipeId)
  const remove = useRemoveIngredient(recipeId)
  const fmt = (v: number, d = 0) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: d }).format(v)

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{ing.canonicalNameEn}</p>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">{ing.unit}</span>
            <Button
              size="sm"
              onClick={() =>
                update.mutate(
                  { ingredientId: ing.id, patch: { amount: Number(amount) || ing.amount } },
                  { onSuccess: () => setEditing(false) },
                )
              }
              disabled={update.isPending}
              aria-label={t('recipes.form.save')}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} aria-label={t('recipes.form.cancel')}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {fmt(ing.amount, 2)} {ing.unit} · {fmt(ing.gramsResolved)} g · {fmt(ing.contribution.kcal)} kcal
          </p>
        )}
      </div>
      {!editing && (
        <div className="flex items-center gap-1">
          {isMassUnit(ing.unit) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAmount(String(ing.amount))
                setEditing(true)
              }}
              aria-label={t('recipes.ingredients.editAmount')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => remove.mutate(ing.id)}
            disabled={remove.isPending}
            aria-label={t('recipes.ingredients.remove')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </li>
  )
}

export function RecipeEditorPage() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const id = params.id ?? ''
  const [, setLocation] = useLocation()
  const [editMeta, setEditMeta] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: recipe, isPending, isError } = useRecipe(id)
  const addIngredient = useAddIngredient(id)
  const remove = useDeleteRecipe()

  const backLink = (
    <Link href="/recipes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      {t('recipes.editor.back')}
    </Link>
  )

  if (isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {backLink}
        <p className="text-muted-foreground">{t('recipes.loading')}</p>
      </div>
    )
  }
  if (isError || !recipe) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {backLink}
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <h3 className="text-lg font-semibold text-foreground">{t('recipes.editor.notFound')}</h3>
        </div>
      </div>
    )
  }

  const r: RecipeDto = recipe

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {backLink}

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{r.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('recipes.card.servings', { count: r.servings })}
              {r.prepTimeMinutes != null && ` · ${t('recipes.form.prepTime')} ${r.prepTimeMinutes}′`}
              {r.cookTimeMinutes != null && ` · ${t('recipes.form.cookTime')} ${r.cookTimeMinutes}′`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditMeta(true)}>
              <Pencil className="h-4 w-4" />
              {t('recipes.editor.edit')}
            </Button>
            <Button
              size="sm"
              onClick={() => setExportOpen(true)}
              disabled={r.ingredients.length === 0}
            >
              <Download className="h-4 w-4" />
              {t('recipes.editor.export')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Section title={t('recipes.editor.ingredients')}>
        <IngredientSearch
          isAdding={addIngredient.isPending}
          onAdd={(input) => addIngredient.mutate(input)}
        />
        {addIngredient.isError && (
          <p className="mt-2 text-sm text-destructive">{t('recipes.ingredients.addError')}</p>
        )}
        {r.ingredients.length > 0 && (
          <ul className="mt-4">
            {r.ingredients.map((ing) => (
              <IngredientRow key={ing.id} recipeId={r.id} ing={ing} />
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('recipes.editor.nutrition')}>
        {r.ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('recipes.editor.nutritionEmpty')}</p>
        ) : (
          <NutritionTable total={r.nutrition.total} perServing={r.nutrition.perServing} servings={r.servings} />
        )}
      </Section>

      <Section title={t('recipes.editor.allergens')}>
        <AllergenReview recipeId={r.id} allergens={r.allergens} />
      </Section>

      <Section title={t('recipes.editor.categories')}>
        <CategoryManager recipe={r} />
      </Section>

      {(r.instructions || r.notes || r.storageRecommendation) && (
        <Section title={t('recipes.editor.details')}>
          <div className="space-y-4 text-sm">
            {r.instructions && (
              <div>
                <p className="mb-1 font-medium text-foreground">{t('recipes.form.instructions')}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{r.instructions}</p>
              </div>
            )}
            {r.notes && (
              <div>
                <p className="mb-1 font-medium text-foreground">{t('recipes.form.notes')}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{r.notes}</p>
              </div>
            )}
            {r.storageRecommendation && (
              <div>
                <p className="mb-1 font-medium text-foreground">{t('recipes.form.storage')}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{r.storageRecommendation}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      <Dialog open={editMeta} onClose={() => setEditMeta(false)} title={t('recipes.form.editTitle')}>
        <RecipeMetaForm
          mode="edit"
          initial={r}
          onSaved={() => setEditMeta(false)}
          onCancel={() => setEditMeta(false)}
        />
      </Dialog>

      <ExportDialog recipe={r} open={exportOpen} onClose={() => setExportOpen(false)} />

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('recipes.delete.title')}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('recipes.delete.body', { title: r.title })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={remove.isPending}>
              {t('recipes.form.cancel')}
            </Button>
            <Button
              onClick={() => remove.mutate(r.id, { onSuccess: () => setLocation('/recipes') })}
              disabled={remove.isPending}
            >
              {t('recipes.delete.confirm')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export function RecipeCreatePage() {
  const { t } = useTranslation()
  const [, setLocation] = useLocation()
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/recipes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t('recipes.editor.back')}
      </Link>
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-xl font-bold text-foreground">{t('recipes.form.createTitle')}</h2>
        <RecipeMetaForm
          mode="create"
          onCreated={(recipe) => setLocation(`/recipes/${recipe.id}`)}
          onCancel={() => setLocation('/recipes')}
        />
      </div>
    </div>
  )
}
