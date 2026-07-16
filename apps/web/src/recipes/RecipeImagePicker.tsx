import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string | null
  onChange: (value: string | null) => void
  className?: string
}

/** Longest-edge cap + JPEG quality for the compressed data URL we persist inline. */
const MAX_EDGE = 720
const QUALITY = 0.82

/**
 * Downscale + re-encode a picked image to a compact JPEG data URL entirely in the
 * browser — no Object Storage needed yet (the recipe `imageUrl` column takes the
 * data URL directly). Transparent PNGs get a white matte so JPEG doesn't blacken.
 */
function compressToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('no-canvas'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', QUALITY))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode-failed'))
    }
    img.src = url
  })
}

/**
 * A recipe cover-photo picker — click to add/change/remove, profile-photo style.
 * Controls sit below the preview and are always visible (not hover-only), so they
 * stay reachable by keyboard focus and on touch.
 */
export function RecipeImagePicker({ value, onChange, className }: Props) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = () => inputRef.current?.click()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked after a remove
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('recipes.form.photoInvalid'))
      return
    }
    setError(null)
    setBusy(true)
    try {
      onChange(await compressToDataUrl(file))
    } catch {
      setError(t('recipes.form.photoError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-foreground">{t('recipes.form.photo')}</label>
      <div
        className={cn(
          'relative flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-xl border bg-muted/40',
          value ? 'border-border' : 'border-dashed border-border',
        )}
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImagePlus className="h-7 w-7" />}
            <span className="text-sm font-medium">{t('recipes.form.addPhoto')}</span>
            <span className="text-xs text-muted-foreground">{t('recipes.form.photoHint')}</span>
          </button>
        )}
        {busy && value && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          </div>
        )}
      </div>

      {value && (
        <div className="mt-2 flex items-center gap-4">
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {t('recipes.form.changePhoto')}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null)
              onChange(null)
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-destructive transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {t('recipes.form.removePhoto')}
          </button>
        </div>
      )}

      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  )
}
