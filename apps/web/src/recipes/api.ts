import type {
  AddIngredientInput,
  Allergen,
  AllergenSuggestResult,
  CreateCategoryInput,
  RecipeCategoryDto,
  RecipeCreateInput,
  RecipeDto,
  RecipeExportInput,
  RecipeListQuery,
  RecipeSummaryDto,
  RecipeUpdateInput,
  UpdateIngredientInput,
  UsdaFoodDto,
  UsdaSearchResult,
} from '@kyb/shared'
import { apiFetch } from '@/lib/api'

function recipeListQuery(q: RecipeListQuery): string {
  const p = new URLSearchParams()
  if (q.search) p.set('search', q.search)
  if (q.categoryId) p.set('categoryId', q.categoryId)
  if (q.excludeAllergens?.length) p.set('excludeAllergens', q.excludeAllergens.join(','))
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}

export const recipesApi = {
  list: (q: RecipeListQuery = {}) =>
    apiFetch<{ recipes: RecipeSummaryDto[] }>(`/recipes${recipeListQuery(q)}`).then((r) => r.recipes),
  get: (id: string) => apiFetch<{ recipe: RecipeDto }>(`/recipes/${id}`).then((r) => r.recipe),
  create: (input: RecipeCreateInput) =>
    apiFetch<{ recipe: RecipeDto }>('/recipes', { method: 'POST', body: JSON.stringify(input) }).then(
      (r) => r.recipe,
    ),
  update: (id: string, patch: RecipeUpdateInput) =>
    apiFetch<{ recipe: RecipeDto }>(`/recipes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(
      (r) => r.recipe,
    ),
  remove: (id: string) => apiFetch<{ success: boolean }>(`/recipes/${id}`, { method: 'DELETE' }),

  addIngredient: (id: string, input: AddIngredientInput) =>
    apiFetch<{ recipe: RecipeDto }>(`/recipes/${id}/ingredients`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.recipe),
  updateIngredient: (id: string, ingredientId: string, patch: UpdateIngredientInput) =>
    apiFetch<{ recipe: RecipeDto }>(`/recipes/${id}/ingredients/${ingredientId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => r.recipe),
  removeIngredient: (id: string, ingredientId: string) =>
    apiFetch<{ recipe: RecipeDto }>(`/recipes/${id}/ingredients/${ingredientId}`, {
      method: 'DELETE',
    }).then((r) => r.recipe),

  addAllergen: (id: string, allergen: Allergen) =>
    apiFetch<{ recipe: RecipeDto }>(`/recipes/${id}/allergens`, {
      method: 'POST',
      body: JSON.stringify({ allergen }),
    }).then((r) => r.recipe),
  confirmAllergen: (id: string, allergen: Allergen, isConfirmed: boolean) =>
    apiFetch<{ recipe: RecipeDto }>(`/recipes/${id}/allergens/${allergen}`, {
      method: 'PATCH',
      body: JSON.stringify({ isConfirmed }),
    }).then((r) => r.recipe),
  removeAllergen: (id: string, allergen: Allergen) =>
    apiFetch<{ recipe: RecipeDto }>(`/recipes/${id}/allergens/${allergen}`, { method: 'DELETE' }).then(
      (r) => r.recipe,
    ),
  suggestAllergens: (id: string) =>
    apiFetch<{ result: AllergenSuggestResult; recipe: RecipeDto }>(`/recipes/${id}/allergens/suggest`, {
      method: 'POST',
    }),

  listCategories: () =>
    apiFetch<{ categories: RecipeCategoryDto[] }>('/recipes/categories').then((r) => r.categories),
  createCategory: (input: CreateCategoryInput) =>
    apiFetch<{ category: RecipeCategoryDto }>('/recipes/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.category),
  setCategories: (id: string, categoryIds: string[]) =>
    apiFetch<{ recipe: RecipeDto }>(`/recipes/${id}/categories`, {
      method: 'PUT',
      body: JSON.stringify({ categoryIds }),
    }).then((r) => r.recipe),

  /** Download a scaled PDF; unwraps the binary and triggers a browser save. */
  async export(id: string, input: RecipeExportInput, fallbackName: string): Promise<void> {
    const res = await fetch(`/api/v1/recipes/${id}/export`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      throw new Error(body?.error?.message ?? `Export failed (${res.status})`)
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const match = /filename="?([^"]+)"?/.exec(disposition)
    const filename = match?.[1] ?? fallbackName
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}

export const usdaApi = {
  search: (query: string, includeBranded?: boolean) => {
    const p = new URLSearchParams({ query })
    if (includeBranded) p.set('includeBranded', 'true')
    return apiFetch<UsdaSearchResult>(`/usda/search?${p.toString()}`)
  },
  getFood: (fdcId: number) =>
    apiFetch<{ food: UsdaFoodDto }>(`/usda/food/${fdcId}`).then((r) => r.food),
}
