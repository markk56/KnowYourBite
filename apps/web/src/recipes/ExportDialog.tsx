import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { LOCALES, type Locale, type RecipeDto } from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { recipesApi } from './api'

/** Recipe PDF export — pick servings + language, then download the scaled PDF. */
export function ExportDialog({
  recipe,
  open,
  onClose,
}: {
  recipe: RecipeDto
  open: boolean
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [servings, setServings] = useState(String(recipe.servings))
  const [locale, setLocale] = useState<Locale>((i18n.language as Locale) ?? 'en')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const n = Number(servings)
    if (!Number.isFinite(n) || n <= 0) {
      setError(t('recipes.export.invalidServings'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await recipesApi.export(recipe.id, { servings: n, locale }, `${recipe.title}.pdf`)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('recipes.export.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('recipes.export.title')}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">{t('recipes.export.servings')}</label>
          <Input
            type="number"
            min="1"
            step="1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="w-32"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">{t('recipes.export.language')}</label>
          <Select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="w-40">
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {t(`language.${l}`)}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('recipes.form.cancel')}
          </Button>
          <Button onClick={submit} disabled={busy}>
            <Download className="h-4 w-4" />
            {busy ? t('recipes.export.generating') : t('recipes.export.download')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
