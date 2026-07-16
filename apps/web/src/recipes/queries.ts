import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AddIngredientInput,
  Allergen,
  RecipeCreateInput,
  RecipeDto,
  RecipeListQuery,
  RecipeUpdateInput,
  UpdateIngredientInput,
} from '@kyb/shared'
import { recipesApi, usdaApi } from './api'

/** Query-key factory; recipe mutations invalidate lists + set the detail cache. */
export const recipeKeys = {
  all: ['recipes'] as const,
  list: (q: RecipeListQuery) => ['recipes', 'list', q] as const,
  detail: (id: string) => ['recipes', 'detail', id] as const,
  categories: ['recipes', 'categories'] as const,
  usdaSearch: (query: string, branded: boolean) => ['usda', 'search', query, branded] as const,
}

export function useRecipes(q: RecipeListQuery) {
  return useQuery({ queryKey: recipeKeys.list(q), queryFn: () => recipesApi.list(q) })
}

export function useRecipe(id: string) {
  return useQuery({ queryKey: recipeKeys.detail(id), queryFn: () => recipesApi.get(id), enabled: !!id })
}

export function useCategories() {
  return useQuery({ queryKey: recipeKeys.categories, queryFn: () => recipesApi.listCategories() })
}

/** Debounced USDA type-ahead. Caller passes the debounced term; empty term = idle. */
export function useUsdaSearch(query: string, includeBranded: boolean) {
  return useQuery({
    queryKey: recipeKeys.usdaSearch(query, includeBranded),
    queryFn: () => usdaApi.search(query, includeBranded),
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  })
}

export function useCreateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RecipeCreateInput) => recipesApi.create(input),
    onSuccess: (recipe: RecipeDto) => {
      qc.setQueryData(recipeKeys.detail(recipe.id), recipe)
      void qc.invalidateQueries({ queryKey: recipeKeys.all })
    },
  })
}

/** Every recipe write returns the full recipe; cache it + invalidate lists. */
function useRecipeMutation<TVars>(mutationFn: (vars: TVars) => Promise<RecipeDto>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (recipe: RecipeDto) => {
      qc.setQueryData(recipeKeys.detail(recipe.id), recipe)
      void qc.invalidateQueries({ queryKey: recipeKeys.all })
    },
  })
}

export function useUpdateRecipe(id: string) {
  return useRecipeMutation((patch: RecipeUpdateInput) => recipesApi.update(id, patch))
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => recipesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: recipeKeys.all }),
  })
}

export function useAddIngredient(id: string) {
  return useRecipeMutation((input: AddIngredientInput) => recipesApi.addIngredient(id, input))
}

export function useUpdateIngredient(id: string) {
  return useRecipeMutation((vars: { ingredientId: string; patch: UpdateIngredientInput }) =>
    recipesApi.updateIngredient(id, vars.ingredientId, vars.patch),
  )
}

export function useRemoveIngredient(id: string) {
  return useRecipeMutation((ingredientId: string) => recipesApi.removeIngredient(id, ingredientId))
}

export function useAddAllergen(id: string) {
  return useRecipeMutation((allergen: Allergen) => recipesApi.addAllergen(id, allergen))
}

export function useConfirmAllergen(id: string) {
  return useRecipeMutation((vars: { allergen: Allergen; isConfirmed: boolean }) =>
    recipesApi.confirmAllergen(id, vars.allergen, vars.isConfirmed),
  )
}

export function useRemoveAllergen(id: string) {
  return useRecipeMutation((allergen: Allergen) => recipesApi.removeAllergen(id, allergen))
}

export function useSuggestAllergens(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => recipesApi.suggestAllergens(id),
    onSuccess: ({ recipe }) => {
      qc.setQueryData(recipeKeys.detail(id), recipe)
      void qc.invalidateQueries({ queryKey: recipeKeys.all })
    },
  })
}

export function useSetCategories(id: string) {
  return useRecipeMutation((categoryIds: string[]) => recipesApi.setCategories(id, categoryIds))
}
