import { useMemo, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { useTranslation } from 'react-i18next'
import { BookOpen, Plus, Search } from 'lucide-react'
import { ALLERGENS, type Allergen, type RecipeListQuery, type RecipeSummaryDto } from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useCategories, useRecipes } from './queries'

function RecipeCard({ recipe }: { recipe: RecipeSummaryDto }) {
  const { t, i18n } = useTranslation()
  const kcal = recipe.perServing?.kcal
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate font-semibold text-foreground">{recipe.title}</p>
        <span className="flex-shrink-0 text-xs text-muted-foreground">
          {t('recipes.card.servings', { count: recipe.servings })}
        </span>
      </div>

      {kcal != null ? (
        <p className="text-sm text-muted-foreground">
          {new Intl.NumberFormat(i18n.language).format(kcal)} {t('recipes.card.kcalPerServing')}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('recipes.card.noNutrition')}</p>
      )}

      {recipe.allergens.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {recipe.allergens.map((a) => (
            <span key={a} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {t(`recipes.allergen.${a}`)}
            </span>
          ))}
        </div>
      )}

      {recipe.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {recipe.categories.map((c) => (
            <span key={c.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              {c.nameEn}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}

export function RecipeListPage() {
  const { t } = useTranslation()
  const [, setLocation] = useLocation()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [excludeAllergens, setExcludeAllergens] = useState<Allergen[]>([])

  const { data: categories } = useCategories()

  const query = useMemo<RecipeListQuery>(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(excludeAllergens.length ? { excludeAllergens } : {}),
    }),
    [search, categoryId, excludeAllergens],
  )
  const { data: recipes, isPending, isError } = useRecipes(query)
  const hasFilters = !!search.trim() || !!categoryId || excludeAllergens.length > 0

  const toggleAllergen = (a: Allergen) =>
    setExcludeAllergens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('recipes.title')}</h2>
        <Button onClick={() => setLocation('/recipes/new')}>
          <Plus className="h-4 w-4" />
          {t('recipes.new')}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t('recipes.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('recipes.searchPlaceholder')}
            />
          </div>
          <Select
            className="w-auto"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label={t('recipes.filter.category')}
          >
            <option value="">{t('recipes.filter.allCategories')}</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('recipes.filter.excludeAllergens')}
          </span>
          {ALLERGENS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAllergen(a)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                excludeAllergens.includes(a)
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50',
              )}
              aria-pressed={excludeAllergens.includes(a)}
            >
              {t(`recipes.allergen.${a}`)}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <p className="text-muted-foreground">{t('recipes.loading')}</p>
      ) : isError ? (
        <p className="text-destructive">{t('recipes.loadError')}</p>
      ) : recipes.length === 0 ? (
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          {hasFilters ? (
            <>
              <h3 className="text-lg font-semibold text-foreground">{t('recipes.emptySearch.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('recipes.emptySearch.body')}</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-foreground">{t('recipes.empty.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('recipes.empty.body')}</p>
              <Button className="mt-4" onClick={() => setLocation('/recipes/new')}>
                <Plus className="h-4 w-4" />
                {t('recipes.empty.cta')}
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  )
}
