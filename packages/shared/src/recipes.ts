import { z } from 'zod'
import type { NutrientsDto } from './usda'

/**
 * Recipe library contract (Milestone 3) — the recipe-integrity module. Pure Zod +
 * DTOs shared by the server router and web client. The nutrition numbers are
 * always derived server-side from the frozen per-100g ingredient snapshots
 * (`@kyb/domain`); the client never sends nutrient values, only the `fdcId` +
 * authored amount, so nothing downstream can inject a number a dietitian didn't
 * review.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export const ALLERGENS = ['milk', 'gluten', 'eggs', 'peanuts', 'soy', 'tree_nuts', 'shellfish'] as const
export type Allergen = (typeof ALLERGENS)[number]

/** Provenance of an allergen flag; a `deterministic` flag can never be removed. */
export const ALLERGEN_SOURCES = ['deterministic', 'ai', 'dietitian'] as const
export type AllergenSource = (typeof ALLERGEN_SOURCES)[number]

export const RECIPE_CATEGORY_KINDS = ['category', 'meal_category'] as const
export type RecipeCategoryKind = (typeof RECIPE_CATEGORY_KINDS)[number]

/** Authored-amount units — must stay in sync with `@kyb/domain` QuantityUnit. */
export const INGREDIENT_UNITS = ['g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece'] as const
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number]

/** Units that need extra context (density or grams-per-piece) to reach grams. */
export const VOLUME_UNITS: readonly IngredientUnit[] = ['ml', 'l', 'tsp', 'tbsp', 'cup']

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface RecipeIngredientDto {
  id: string
  fdcId: number
  canonicalNameEn: string
  amount: number
  unit: IngredientUnit
  gramsResolved: number
  /** Frozen per-100g snapshot captured at add-time (immutable). */
  per100g: NutrientsDto
  /** Deterministic contribution = per100g × gramsResolved / 100. */
  contribution: NutrientsDto
  sortOrder: number
}

export interface RecipeAllergenDto {
  allergen: Allergen
  source: AllergenSource
  isConfirmed: boolean
}

export interface RecipeCategoryDto {
  id: string
  kind: RecipeCategoryKind
  nameEn: string
}

export interface RecipeNutritionDto {
  servings: number
  total: NutrientsDto
  perServing: NutrientsDto
}

/** Lightweight row for the recipe dashboard. */
export interface RecipeSummaryDto {
  id: string
  title: string
  servings: number
  imageUrl: string | null
  total: NutrientsDto | null
  perServing: NutrientsDto | null
  allergens: Allergen[]
  categories: RecipeCategoryDto[]
  ingredientCount: number
  createdAt: string
  updatedAt: string
}

/** Full recipe with ingredients, allergens, categories and deterministic nutrition. */
export interface RecipeDto {
  id: string
  title: string
  servings: number
  imageUrl: string | null
  instructions: string | null
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  notes: string | null
  storageRecommendation: string | null
  ingredients: RecipeIngredientDto[]
  allergens: RecipeAllergenDto[]
  categories: RecipeCategoryDto[]
  nutrition: RecipeNutritionDto
  createdAt: string
  updatedAt: string
}

// ── Input schemas ─────────────────────────────────────────────────────────────

const optionalText = (max: number) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().max(max).optional())

const optionalMinutes = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.number().int().min(0).max(6000).optional(),
)

export const recipeCreateInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  servings: z.number().int().min(1).max(100).default(1),
  instructions: optionalText(20000),
  prepTimeMinutes: optionalMinutes,
  cookTimeMinutes: optionalMinutes,
  notes: optionalText(5000),
  storageRecommendation: optionalText(2000),
})
export type RecipeCreateInput = z.infer<typeof recipeCreateInputSchema>

export const recipeUpdateInputSchema = recipeCreateInputSchema.partial()
export type RecipeUpdateInput = z.infer<typeof recipeUpdateInputSchema>

/**
 * Add an ingredient. The client sends only the identity + authored quantity; the
 * server resolves the canonical name + frozen snapshot from the USDA cache and
 * deterministically converts to grams (density/gramsPerPiece supplied for
 * volume/piece units).
 */
export const addIngredientInputSchema = z
  .object({
    fdcId: z.number().int().positive(),
    amount: z.number().positive().max(1_000_000),
    unit: z.enum(INGREDIENT_UNITS),
    densityGPerMl: z.number().positive().max(20).optional(),
    gramsPerPiece: z.number().positive().max(1_000_000).optional(),
  })
  .refine((v) => !(VOLUME_UNITS.includes(v.unit) && v.densityGPerMl === undefined), {
    message: 'A density (g/ml) is required for volume units',
    path: ['densityGPerMl'],
  })
  .refine((v) => !(v.unit === 'piece' && v.gramsPerPiece === undefined), {
    message: 'A grams-per-piece is required for the "piece" unit',
    path: ['gramsPerPiece'],
  })
export type AddIngredientInput = z.infer<typeof addIngredientInputSchema>

export const updateIngredientInputSchema = z
  .object({
    amount: z.number().positive().max(1_000_000).optional(),
    unit: z.enum(INGREDIENT_UNITS).optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    densityGPerMl: z.number().positive().max(20).optional(),
    gramsPerPiece: z.number().positive().max(1_000_000).optional(),
  })
  .refine((v) => v.amount !== undefined || v.unit !== undefined || v.sortOrder !== undefined, {
    message: 'Nothing to update',
  })
export type UpdateIngredientInput = z.infer<typeof updateIngredientInputSchema>

/** Add a dietitian-authored allergen (never a deterministic one — that is the floor). */
export const addAllergenInputSchema = z.object({
  allergen: z.enum(ALLERGENS),
})
export type AddAllergenInput = z.infer<typeof addAllergenInputSchema>

export const confirmAllergenInputSchema = z.object({
  isConfirmed: z.boolean(),
})
export type ConfirmAllergenInput = z.infer<typeof confirmAllergenInputSchema>

export const createCategoryInputSchema = z.object({
  kind: z.enum(RECIPE_CATEGORY_KINDS),
  nameEn: z.string().trim().min(1).max(80),
})
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>

export const setRecipeCategoriesInputSchema = z.object({
  categoryIds: z.array(z.string().uuid()).max(50),
})
export type SetRecipeCategoriesInput = z.infer<typeof setRecipeCategoriesInputSchema>

export const recipeExportInputSchema = z.object({
  servings: z.number().positive().max(100),
  locale: z.enum(['en', 'ro', 'hu']).optional(),
})
export type RecipeExportInput = z.infer<typeof recipeExportInputSchema>

export interface RecipeListQuery {
  search?: string
  categoryId?: string
  /** Exclude recipes that carry any of these allergens (the reference filter). */
  excludeAllergens?: Allergen[]
}

/**
 * The immutable additive AI allergen proposal (haiku). Structurally cannot remove
 * an allergen — there is no `removals` field, only `additions` (ADR §6).
 */
export const aiAllergenProposalSchema = z.object({
  additions: z.array(z.enum(ALLERGENS)).max(7).default([]),
  rationale: z.string().max(2000).default(''),
})
export type AiAllergenProposal = z.infer<typeof aiAllergenProposalSchema>

export interface AllergenSuggestResult {
  /** Newly suggested allergens not already on the recipe (added as source=ai, unconfirmed). */
  added: Allergen[]
  status: 'suggested' | 'unavailable'
}
