import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  recipeCreateInputSchema,
  type RecipeCreateInput,
  type RecipeDto,
} from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RecipeImagePicker } from './RecipeImagePicker'
import { useCreateRecipe, useUpdateRecipe } from './queries'

interface Props {
  mode: 'create' | 'edit'
  initial?: RecipeDto
  onCreated?: (recipe: RecipeDto) => void
  onSaved?: () => void
  onCancel?: () => void
}

/** Recipe metadata (title, servings, times, prose). Used for create + inline edit. */
export function RecipeMetaForm({ mode, initial, onCreated, onSaved, onCancel }: Props) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null)
  const [servings, setServings] = useState(String(initial?.servings ?? 1))
  const [prep, setPrep] = useState(initial?.prepTimeMinutes != null ? String(initial.prepTimeMinutes) : '')
  const [cook, setCook] = useState(initial?.cookTimeMinutes != null ? String(initial.cookTimeMinutes) : '')
  const [instructions, setInstructions] = useState(initial?.instructions ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [storage, setStorage] = useState(initial?.storageRecommendation ?? '')
  const [error, setError] = useState<string | null>(null)

  const create = useCreateRecipe()
  const update = useUpdateRecipe(initial?.id ?? '')
  const pending = create.isPending || update.isPending

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const raw: RecipeCreateInput = {
      title: title.trim(),
      servings: Number(servings) || 1,
      imageUrl, // string data URL, or null to clear
      instructions: instructions.trim() || undefined,
      prepTimeMinutes: prep ? Number(prep) : undefined,
      cookTimeMinutes: cook ? Number(cook) : undefined,
      notes: notes.trim() || undefined,
      storageRecommendation: storage.trim() || undefined,
    }
    const parsed = recipeCreateInputSchema.safeParse(raw)
    if (!parsed.success) {
      // Attribute the error to the offending field so a title-populated form
      // doesn't wrongly claim "Title is required".
      const field = parsed.error.issues[0]?.path[0]
      setError(field === 'title' || field === undefined ? t('recipes.form.titleRequired') : t('recipes.form.invalid'))
      return
    }
    if (mode === 'create') {
      create.mutate(parsed.data, {
        onSuccess: (recipe) => onCreated?.(recipe),
        onError: () => setError(t('recipes.form.saveError')),
      })
    } else {
      update.mutate(parsed.data, {
        onSuccess: () => onSaved?.(),
        onError: () => setError(t('recipes.form.saveError')),
      })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <RecipeImagePicker value={imageUrl} onChange={setImageUrl} />
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">{t('recipes.form.title')}</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="w-28">
          <label className="mb-1 block text-sm font-medium text-foreground">{t('recipes.form.servings')}</label>
          <Input type="number" min="1" max="100" step="1" value={servings} onChange={(e) => setServings(e.target.value)} />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-sm font-medium text-foreground">{t('recipes.form.prepTime')}</label>
          <Input type="number" min="0" max="6000" value={prep} onChange={(e) => setPrep(e.target.value)} />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-sm font-medium text-foreground">{t('recipes.form.cookTime')}</label>
          <Input type="number" min="0" max="6000" value={cook} onChange={(e) => setCook(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">{t('recipes.form.instructions')}</label>
        <Textarea rows={4} maxLength={20000} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-sm font-medium text-foreground">{t('recipes.form.notes')}</label>
          <Textarea rows={2} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-sm font-medium text-foreground">{t('recipes.form.storage')}</label>
          <Textarea rows={2} maxLength={2000} value={storage} onChange={(e) => setStorage(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            {t('recipes.form.cancel')}
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending
            ? t('recipes.form.saving')
            : mode === 'create'
              ? t('recipes.form.create')
              : t('recipes.form.save')}
        </Button>
      </div>
    </form>
  )
}
