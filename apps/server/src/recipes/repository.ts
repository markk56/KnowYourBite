import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { nutrientsForGrams, roundNutrients, type Nutrients } from '@kyb/domain'
import type {
  Allergen,
  AllergenSource,
  NutrientsDto,
  RecipeAllergenDto,
  RecipeCategoryDto,
  RecipeCategoryKind,
  RecipeDto,
  RecipeIngredientDto,
  RecipeSummaryDto,
  IngredientUnit,
} from '@kyb/shared'
import { getDb } from '../db/client'
import {
  generatedDocuments,
  recipeAllergens,
  recipeCategories,
  recipeCategoriesMap,
  recipeIngredients,
  recipes,
  type NewRecipeIngredientRow,
  type RecipeAllergenRow,
  type RecipeCategoryRow,
  type RecipeIngredientRow,
  type RecipeRow,
} from '../db/schema'
import { activeForTenant } from '../db/tenantScope'

/**
 * Tenant-scoped recipes repository. Data access + DTO assembly only; the
 * deterministic nutrition/allergen computation lives in the service (which calls
 * `@kyb/domain`). Every method scopes to `tenantId`; unknown/other-tenant ids
 * resolve to null so routes emit 404.
 */

const num = (v: string | null): number => (v == null ? 0 : Number(v))

function per100gFromRow(row: RecipeIngredientRow): Nutrients {
  return {
    kcal: num(row.kcalPer100g),
    proteinG: num(row.proteinPer100g),
    fatG: num(row.fatPer100g),
    carbG: num(row.carbsPer100g),
    fiberG: num(row.fiberPer100g),
    saltG: num(row.saltPer100g),
  }
}

function nutrientsToDto(n: Nutrients): NutrientsDto {
  return roundNutrients(n)
}

function toIngredientDto(row: RecipeIngredientRow): RecipeIngredientDto {
  const per100g = per100gFromRow(row)
  const grams = num(row.gramsResolved)
  return {
    id: row.id,
    fdcId: row.fdcId,
    canonicalNameEn: row.canonicalNameEn,
    amount: num(row.amount),
    unit: row.unit as IngredientUnit,
    gramsResolved: grams,
    per100g: nutrientsToDto(per100g),
    contribution: nutrientsToDto(nutrientsForGrams(per100g, grams)),
    sortOrder: row.sortOrder,
  }
}

function toAllergenDto(row: RecipeAllergenRow): RecipeAllergenDto {
  return { allergen: row.allergen, source: row.source, isConfirmed: row.isConfirmed }
}

function toCategoryDto(row: RecipeCategoryRow): RecipeCategoryDto {
  return { id: row.id, kind: row.kind as RecipeCategoryKind, nameEn: row.nameEn }
}

function totalsFromRow(row: RecipeRow): NutrientsDto | null {
  if (row.totalKcal == null) return null
  return {
    kcal: num(row.totalKcal),
    proteinG: num(row.totalProteinG),
    fatG: num(row.totalFatG),
    carbG: num(row.totalCarbsG),
    fiberG: num(row.totalFiberG),
    saltG: num(row.totalSaltG),
  }
}

export const recipesRepository = {
  // ── Recipes ────────────────────────────────────────────────────────────────
  async findRecipeRow(tenantId: string, id: string): Promise<RecipeRow | null> {
    const [row] = await getDb()
      .select()
      .from(recipes)
      .where(and(activeForTenant(recipes, tenantId), eq(recipes.id, id)))
      .limit(1)
    return row ?? null
  },

  async createRecipe(
    tenantId: string,
    input: {
      title: string
      servings: number
      instructions?: string
      prepTimeMinutes?: number
      cookTimeMinutes?: number
      notes?: string
      storageRecommendation?: string
    },
  ): Promise<RecipeRow> {
    const [row] = await getDb()
      .insert(recipes)
      .values({
        tenantId,
        title: input.title,
        servings: input.servings,
        instructions: input.instructions ?? null,
        prepTimeMinutes: input.prepTimeMinutes ?? null,
        cookTimeMinutes: input.cookTimeMinutes ?? null,
        notes: input.notes ?? null,
        storageRecommendation: input.storageRecommendation ?? null,
      })
      .returning()
    if (!row) throw new Error('Failed to create recipe')
    return row
  },

  async updateRecipe(
    tenantId: string,
    id: string,
    patch: Partial<{
      title: string
      servings: number
      instructions: string | null
      prepTimeMinutes: number | null
      cookTimeMinutes: number | null
      notes: string | null
      storageRecommendation: string | null
    }>,
  ): Promise<RecipeRow | null> {
    const [row] = await getDb()
      .update(recipes)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(activeForTenant(recipes, tenantId), eq(recipes.id, id)))
      .returning()
    return row ?? null
  },

  async softDeleteRecipe(tenantId: string, id: string): Promise<boolean> {
    const rows = await getDb()
      .update(recipes)
      .set({ deletedAt: new Date() })
      .where(and(activeForTenant(recipes, tenantId), eq(recipes.id, id)))
      .returning({ id: recipes.id })
    return rows.length > 0
  },

  async setRecipeTotals(tenantId: string, id: string, total: Nutrients | null): Promise<void> {
    const set =
      total == null
        ? {
            totalKcal: null,
            totalProteinG: null,
            totalCarbsG: null,
            totalFatG: null,
            totalFiberG: null,
            totalSaltG: null,
            nutritionComputedAt: new Date(),
            updatedAt: new Date(),
          }
        : {
            totalKcal: String(round1(total.kcal)),
            totalProteinG: String(round1(total.proteinG)),
            totalCarbsG: String(round1(total.carbG)),
            totalFatG: String(round1(total.fatG)),
            totalFiberG: String(round1(total.fiberG)),
            totalSaltG: String(round2(total.saltG)),
            nutritionComputedAt: new Date(),
            updatedAt: new Date(),
          }
    await getDb()
      .update(recipes)
      .set(set)
      .where(and(activeForTenant(recipes, tenantId), eq(recipes.id, id)))
  },

  // ── Ingredients ──────────────────────────────────────────────────────────────
  async listIngredients(tenantId: string, recipeId: string): Promise<RecipeIngredientRow[]> {
    return getDb()
      .select()
      .from(recipeIngredients)
      .where(and(eq(recipeIngredients.tenantId, tenantId), eq(recipeIngredients.recipeId, recipeId)))
      .orderBy(asc(recipeIngredients.sortOrder), asc(recipeIngredients.createdAt))
  },

  async insertIngredient(values: NewRecipeIngredientRow): Promise<RecipeIngredientRow> {
    const [row] = await getDb().insert(recipeIngredients).values(values).returning()
    if (!row) throw new Error('Failed to add ingredient')
    return row
  },

  async findIngredient(tenantId: string, id: string): Promise<RecipeIngredientRow | null> {
    const [row] = await getDb()
      .select()
      .from(recipeIngredients)
      .where(and(eq(recipeIngredients.tenantId, tenantId), eq(recipeIngredients.id, id)))
      .limit(1)
    return row ?? null
  },

  /** Update ONLY authored quantity fields — the frozen per-100g snapshot is never touched. */
  async updateIngredientQuantity(
    tenantId: string,
    id: string,
    patch: Partial<{ amount: number; unit: string; gramsResolved: number; sortOrder: number }>,
  ): Promise<RecipeIngredientRow | null> {
    const set: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.amount !== undefined) set.amount = String(patch.amount)
    if (patch.unit !== undefined) set.unit = patch.unit
    if (patch.gramsResolved !== undefined) set.gramsResolved = String(patch.gramsResolved)
    if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
    const [row] = await getDb()
      .update(recipeIngredients)
      .set(set)
      .where(and(eq(recipeIngredients.tenantId, tenantId), eq(recipeIngredients.id, id)))
      .returning()
    return row ?? null
  },

  async deleteIngredient(tenantId: string, id: string): Promise<boolean> {
    const rows = await getDb()
      .delete(recipeIngredients)
      .where(and(eq(recipeIngredients.tenantId, tenantId), eq(recipeIngredients.id, id)))
      .returning({ id: recipeIngredients.id })
    return rows.length > 0
  },

  // ── Allergens ────────────────────────────────────────────────────────────────
  async listAllergens(tenantId: string, recipeId: string): Promise<RecipeAllergenRow[]> {
    return getDb()
      .select()
      .from(recipeAllergens)
      .where(and(eq(recipeAllergens.tenantId, tenantId), eq(recipeAllergens.recipeId, recipeId)))
  },

  /**
   * Reconcile the deterministic allergen floor: ensure a `deterministic` row for
   * every implied allergen, and drop `deterministic` rows no longer implied. Rows
   * added by AI or the dietitian are never touched here (additive-only).
   */
  async syncDeterministicAllergens(
    tenantId: string,
    recipeId: string,
    floor: readonly Allergen[],
  ): Promise<void> {
    const db = getDb()
    const existing = await this.listAllergens(tenantId, recipeId)
    const floorSet = new Set(floor)

    // Remove deterministic rows no longer in the floor.
    const stale = existing.filter((r) => r.source === 'deterministic' && !floorSet.has(r.allergen))
    if (stale.length > 0) {
      await db.delete(recipeAllergens).where(
        inArray(
          recipeAllergens.id,
          stale.map((r) => r.id),
        ),
      )
    }

    // Insert deterministic rows for newly-implied allergens (skip any that already
    // exist under ANY source — the unique index is (recipeId, allergen)).
    const present = new Set(existing.map((r) => r.allergen))
    const toAdd = floor.filter((a) => !present.has(a))
    if (toAdd.length > 0) {
      await db.insert(recipeAllergens).values(
        toAdd.map((allergen) => ({
          tenantId,
          recipeId,
          allergen,
          source: 'deterministic' as AllergenSource,
          isConfirmed: false,
        })),
      )
    }
  },

  /** Add an allergen with a given source if not already present (unique per recipe). */
  async addAllergenIfAbsent(
    tenantId: string,
    recipeId: string,
    allergen: Allergen,
    source: AllergenSource,
  ): Promise<boolean> {
    const rows = await getDb()
      .insert(recipeAllergens)
      .values({ tenantId, recipeId, allergen, source, isConfirmed: false })
      .onConflictDoNothing({ target: [recipeAllergens.recipeId, recipeAllergens.allergen] })
      .returning({ id: recipeAllergens.id })
    return rows.length > 0
  },

  async setAllergenConfirmed(
    tenantId: string,
    recipeId: string,
    allergen: Allergen,
    isConfirmed: boolean,
  ): Promise<RecipeAllergenRow | null> {
    const [row] = await getDb()
      .update(recipeAllergens)
      .set({ isConfirmed, updatedAt: new Date() })
      .where(
        and(
          eq(recipeAllergens.tenantId, tenantId),
          eq(recipeAllergens.recipeId, recipeId),
          eq(recipeAllergens.allergen, allergen),
        ),
      )
      .returning()
    return row ?? null
  },

  async findAllergen(
    tenantId: string,
    recipeId: string,
    allergen: Allergen,
  ): Promise<RecipeAllergenRow | null> {
    const [row] = await getDb()
      .select()
      .from(recipeAllergens)
      .where(
        and(
          eq(recipeAllergens.tenantId, tenantId),
          eq(recipeAllergens.recipeId, recipeId),
          eq(recipeAllergens.allergen, allergen),
        ),
      )
      .limit(1)
    return row ?? null
  },

  async deleteAllergen(tenantId: string, recipeId: string, allergen: Allergen): Promise<boolean> {
    const rows = await getDb()
      .delete(recipeAllergens)
      .where(
        and(
          eq(recipeAllergens.tenantId, tenantId),
          eq(recipeAllergens.recipeId, recipeId),
          eq(recipeAllergens.allergen, allergen),
        ),
      )
      .returning({ id: recipeAllergens.id })
    return rows.length > 0
  },

  // ── Categories ───────────────────────────────────────────────────────────────
  async listCategories(tenantId: string): Promise<RecipeCategoryRow[]> {
    return getDb()
      .select()
      .from(recipeCategories)
      .where(eq(recipeCategories.tenantId, tenantId))
      .orderBy(asc(recipeCategories.kind), asc(recipeCategories.nameEn))
  },

  async createCategory(
    tenantId: string,
    kind: RecipeCategoryKind,
    nameEn: string,
  ): Promise<RecipeCategoryRow> {
    const [row] = await getDb()
      .insert(recipeCategories)
      .values({ tenantId, kind, nameEn })
      .onConflictDoNothing({
        target: [recipeCategories.tenantId, recipeCategories.kind, recipeCategories.nameEn],
      })
      .returning()
    if (row) return row
    // Already existed — return the current row.
    const [existing] = await getDb()
      .select()
      .from(recipeCategories)
      .where(
        and(
          eq(recipeCategories.tenantId, tenantId),
          eq(recipeCategories.kind, kind),
          eq(recipeCategories.nameEn, nameEn),
        ),
      )
      .limit(1)
    if (!existing) throw new Error('Failed to create category')
    return existing
  },

  async listCategoriesForRecipe(tenantId: string, recipeId: string): Promise<RecipeCategoryRow[]> {
    return getDb()
      .select({
        id: recipeCategories.id,
        tenantId: recipeCategories.tenantId,
        kind: recipeCategories.kind,
        nameEn: recipeCategories.nameEn,
        createdAt: recipeCategories.createdAt,
        updatedAt: recipeCategories.updatedAt,
      })
      .from(recipeCategoriesMap)
      .innerJoin(recipeCategories, eq(recipeCategoriesMap.categoryId, recipeCategories.id))
      .where(
        and(eq(recipeCategoriesMap.tenantId, tenantId), eq(recipeCategoriesMap.recipeId, recipeId)),
      )
      .orderBy(asc(recipeCategories.kind), asc(recipeCategories.nameEn))
  },

  async setRecipeCategories(tenantId: string, recipeId: string, categoryIds: string[]): Promise<void> {
    const db = getDb()
    await db
      .delete(recipeCategoriesMap)
      .where(
        and(eq(recipeCategoriesMap.tenantId, tenantId), eq(recipeCategoriesMap.recipeId, recipeId)),
      )
    if (categoryIds.length === 0) return
    // Only attach categories that belong to this tenant.
    const owned = await db
      .select({ id: recipeCategories.id })
      .from(recipeCategories)
      .where(and(eq(recipeCategories.tenantId, tenantId), inArray(recipeCategories.id, categoryIds)))
    if (owned.length === 0) return
    await db
      .insert(recipeCategoriesMap)
      .values(owned.map((c) => ({ tenantId, recipeId, categoryId: c.id })))
      .onConflictDoNothing()
  },

  // ── List / assembly ──────────────────────────────────────────────────────────
  async listRecipeRows(tenantId: string): Promise<RecipeRow[]> {
    return getDb()
      .select()
      .from(recipes)
      .where(activeForTenant(recipes, tenantId))
      .orderBy(desc(recipes.createdAt))
  },

  /** Batch: all allergen rows for a set of recipes (avoids N+1 on the dashboard). */
  async allergensForRecipes(tenantId: string, recipeIds: string[]): Promise<RecipeAllergenRow[]> {
    if (recipeIds.length === 0) return []
    return getDb()
      .select()
      .from(recipeAllergens)
      .where(and(eq(recipeAllergens.tenantId, tenantId), inArray(recipeAllergens.recipeId, recipeIds)))
  },

  /** Batch: category rows joined to their recipe id for a set of recipes. */
  async categoriesForRecipes(
    tenantId: string,
    recipeIds: string[],
  ): Promise<Array<{ recipeId: string; category: RecipeCategoryRow }>> {
    if (recipeIds.length === 0) return []
    const rows = await getDb()
      .select({
        recipeId: recipeCategoriesMap.recipeId,
        id: recipeCategories.id,
        tenantId: recipeCategories.tenantId,
        kind: recipeCategories.kind,
        nameEn: recipeCategories.nameEn,
        createdAt: recipeCategories.createdAt,
        updatedAt: recipeCategories.updatedAt,
      })
      .from(recipeCategoriesMap)
      .innerJoin(recipeCategories, eq(recipeCategoriesMap.categoryId, recipeCategories.id))
      .where(
        and(eq(recipeCategoriesMap.tenantId, tenantId), inArray(recipeCategoriesMap.recipeId, recipeIds)),
      )
    return rows.map((r) => ({
      recipeId: r.recipeId,
      category: {
        id: r.id,
        tenantId: r.tenantId,
        kind: r.kind,
        nameEn: r.nameEn,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    }))
  },

  /** Persist the frozen export snapshot (immutable history record). */
  async recordGeneratedDocument(input: {
    tenantId: string
    recipeId: string
    locale: 'en' | 'ro' | 'hu'
    servingsRequested: number
    snapshot: unknown
    generatedByUserId: string
  }): Promise<string> {
    const [row] = await getDb()
      .insert(generatedDocuments)
      .values({
        tenantId: input.tenantId,
        kind: 'recipe',
        recipeId: input.recipeId,
        locale: input.locale,
        servingsRequested: input.servingsRequested,
        snapshot: input.snapshot as object,
        generatedByUserId: input.generatedByUserId,
      })
      .returning({ id: generatedDocuments.id })
    if (!row) throw new Error('Failed to record export')
    return row.id
  },

  /** Batch: ingredient counts per recipe. */
  async ingredientCounts(tenantId: string, recipeIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    if (recipeIds.length === 0) return counts
    const rows = await getDb()
      .select({ recipeId: recipeIngredients.recipeId, id: recipeIngredients.id })
      .from(recipeIngredients)
      .where(and(eq(recipeIngredients.tenantId, tenantId), inArray(recipeIngredients.recipeId, recipeIds)))
    for (const r of rows) counts.set(r.recipeId, (counts.get(r.recipeId) ?? 0) + 1)
    return counts
  },
}

// ── DTO assembly (exported for the service/routes) ──────────────────────────────

export function assembleRecipeDto(
  row: RecipeRow,
  ingredientRows: RecipeIngredientRow[],
  allergenRows: RecipeAllergenRow[],
  categoryRows: RecipeCategoryRow[],
): RecipeDto {
  const ingredients = ingredientRows.map(toIngredientDto)
  const total = ingredients.reduce<Nutrients>(
    (acc, ing) => ({
      kcal: acc.kcal + ing.contribution.kcal,
      proteinG: acc.proteinG + ing.contribution.proteinG,
      fatG: acc.fatG + ing.contribution.fatG,
      carbG: acc.carbG + ing.contribution.carbG,
      fiberG: acc.fiberG + ing.contribution.fiberG,
      saltG: acc.saltG + ing.contribution.saltG,
    }),
    { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, fiberG: 0, saltG: 0 },
  )
  const servings = row.servings > 0 ? row.servings : 1
  const perServing: Nutrients = {
    kcal: total.kcal / servings,
    proteinG: total.proteinG / servings,
    fatG: total.fatG / servings,
    carbG: total.carbG / servings,
    fiberG: total.fiberG / servings,
    saltG: total.saltG / servings,
  }
  return {
    id: row.id,
    title: row.title,
    servings: row.servings,
    imageUrl: row.imageUrl,
    instructions: row.instructions,
    prepTimeMinutes: row.prepTimeMinutes,
    cookTimeMinutes: row.cookTimeMinutes,
    notes: row.notes,
    storageRecommendation: row.storageRecommendation,
    ingredients,
    allergens: allergenRows.map(toAllergenDto),
    categories: categoryRows.map(toCategoryDto),
    nutrition: { servings: row.servings, total: nutrientsToDto(total), perServing: nutrientsToDto(perServing) },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function assembleSummaryDto(
  row: RecipeRow,
  ingredientCount: number,
  allergenRows: RecipeAllergenRow[],
  categoryRows: RecipeCategoryRow[],
): RecipeSummaryDto {
  const total = totalsFromRow(row)
  const servings = row.servings > 0 ? row.servings : 1
  const perServing =
    total == null
      ? null
      : {
          kcal: Math.round(total.kcal / servings),
          proteinG: round1(total.proteinG / servings),
          fatG: round1(total.fatG / servings),
          carbG: round1(total.carbG / servings),
          fiberG: round1(total.fiberG / servings),
          saltG: round2(total.saltG / servings),
        }
  return {
    id: row.id,
    title: row.title,
    servings: row.servings,
    imageUrl: row.imageUrl,
    total,
    perServing,
    allergens: allergenRows.map((r) => r.allergen),
    categories: categoryRows.map(toCategoryDto),
    ingredientCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}
function round2(v: number): number {
  return Math.round(v * 100) / 100
}
