import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical, Search } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import type { RecipeListQuery, RecipeSummaryDto } from '@kyb/shared'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useRecipes } from '@/recipes/queries'

/** dnd-kit draggable id + payload for a recipe dragged out of the palette. */
const paletteDragId = (recipeId: string) => `palette:${recipeId}`

function PaletteItem({ recipe }: { recipe: RecipeSummaryDto }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: paletteDragId(recipe.id),
    data: { kind: 'palette', recipeId: recipe.id, title: recipe.title },
  })
  const kcal = recipe.perServing?.kcal
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary/50',
        'cursor-grab touch-none active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'opacity-40',
      )}
    >
      <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-foreground">{recipe.title}</span>
      {kcal != null && (
        <span className="flex-shrink-0 tabular-nums text-xs text-muted-foreground">{Math.round(kcal)}</span>
      )}
    </button>
  )
}

/**
 * The recipe drag source. Each recipe is a keyboard-operable draggable (space to
 * pick up, arrows to move, space to drop) — dnd-kit's KeyboardSensor makes the
 * whole board accessible without a mouse.
 */
export function RecipePalette() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const query = useMemo<RecipeListQuery>(() => (search.trim() ? { search: search.trim() } : {}), [search])
  const { data: recipes, isPending } = useRecipes(query)

  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('planner.palette.title')}
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t('planner.palette.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('planner.palette.search')}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('planner.palette.hint')}</p>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {isPending ? (
          <p className="text-sm text-muted-foreground">{t('planner.palette.loading')}</p>
        ) : (recipes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('planner.palette.empty')}</p>
        ) : (
          (recipes ?? []).map((r) => <PaletteItem key={r.id} recipe={r} />)
        )}
      </div>
    </div>
  )
}
