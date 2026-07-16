import {
  detectAllergenFloor,
  rollUpRecipe,
  roundNutrients,
  toGrams,
  type Nutrients,
  type QuantityUnit,
} from '@kyb/domain'
import type {
  AddIngredientInput,
  Allergen,
  AllergenSuggestResult,
  ErrorCode,
  Locale,
  RecipeCategoryDto,
  RecipeCategoryKind,
  RecipeCreateInput,
  RecipeDto,
  RecipeExportInput,
  RecipeListQuery,
  RecipeSummaryDto,
  RecipeUpdateInput,
  UpdateIngredientInput,
} from '@kyb/shared'
import { buildRecipeDocDefinition, type RecipeExportSnapshot } from '../pdf/recipeDoc'
import { renderPdf } from '../pdf/render'
import { resolveFood, UsdaNormalizationError } from '../usda/cache'
import { ALLERGEN_MODEL, ALLERGEN_PROMPT_VERSION, isAiEnabled } from '../ai/anthropic'
import {
  AllergenUpstreamUnavailableError,
  MalformedAllergenProposalError,
  proposeAllergens,
} from '../ai/allergenProposer'
import { recordAiInteraction } from '../ai/audit'
import {
  assembleRecipeDto,
  assembleSummaryDto,
  recipesRepository,
} from './repository'
import type { RecipeCategoryRow } from '../db/schema'

/** A service-level error the router maps directly onto the response envelope. */
export class ServiceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

const repo = recipesRepository

/** Load and assemble a full recipe DTO or throw NOT_FOUND. */
export async function getRecipe(tenantId: string, id: string): Promise<RecipeDto> {
  const row = await repo.findRecipeRow(tenantId, id)
  if (!row) throw new ServiceError('NOT_FOUND', 'Recipe not found')
  const [ingredients, allergens, categories] = await Promise.all([
    repo.listIngredients(tenantId, id),
    repo.listAllergens(tenantId, id),
    repo.listCategoriesForRecipe(tenantId, id),
  ])
  return assembleRecipeDto(row, ingredients, allergens, categories)
}

export async function createRecipe(tenantId: string, input: RecipeCreateInput): Promise<RecipeDto> {
  const row = await repo.createRecipe(tenantId, input)
  return assembleRecipeDto(row, [], [], [])
}

export async function updateRecipe(
  tenantId: string,
  id: string,
  patch: RecipeUpdateInput,
): Promise<RecipeDto> {
  const existing = await repo.findRecipeRow(tenantId, id)
  if (!existing) throw new ServiceError('NOT_FOUND', 'Recipe not found')
  const set: Record<string, unknown> = {}
  if (patch.title !== undefined) set.title = patch.title
  if (patch.servings !== undefined) set.servings = patch.servings
  if (patch.imageUrl !== undefined) set.imageUrl = patch.imageUrl // string sets it, null clears it
  if ('instructions' in patch) set.instructions = patch.instructions ?? null
  if ('prepTimeMinutes' in patch) set.prepTimeMinutes = patch.prepTimeMinutes ?? null
  if ('cookTimeMinutes' in patch) set.cookTimeMinutes = patch.cookTimeMinutes ?? null
  if ('notes' in patch) set.notes = patch.notes ?? null
  if ('storageRecommendation' in patch) set.storageRecommendation = patch.storageRecommendation ?? null
  await repo.updateRecipe(tenantId, id, set)
  return getRecipe(tenantId, id)
}

export async function deleteRecipe(tenantId: string, id: string): Promise<void> {
  const deleted = await repo.softDeleteRecipe(tenantId, id)
  if (!deleted) throw new ServiceError('NOT_FOUND', 'Recipe not found')
}

// ── Ingredients ────────────────────────────────────────────────────────────────

function resolveGrams(input: {
  amount: number
  unit: string
  densityGPerMl?: number
  gramsPerPiece?: number
}): number {
  try {
    return toGrams(input.amount, input.unit as QuantityUnit, {
      densityGPerMl: input.densityGPerMl,
      gramsPerPiece: input.gramsPerPiece,
    })
  } catch (e) {
    throw new ServiceError('VALIDATION_ERROR', e instanceof Error ? e.message : 'Could not convert to grams')
  }
}

/**
 * Add an ingredient: resolve the food cache-first, freeze a per-100g snapshot at
 * add-time, deterministically convert the authored amount to grams, persist, then
 * recompute totals + the deterministic allergen floor. Recipe nutrition is only
 * ever built from these frozen snapshots (integrity).
 */
export async function addIngredient(
  tenantId: string,
  recipeId: string,
  input: AddIngredientInput,
): Promise<RecipeDto> {
  const recipe = await repo.findRecipeRow(tenantId, recipeId)
  if (!recipe) throw new ServiceError('NOT_FOUND', 'Recipe not found')

  let resolved
  try {
    resolved = await resolveFood(input.fdcId)
  } catch (e) {
    if (e instanceof UsdaNormalizationError) {
      throw new ServiceError('VALIDATION_ERROR', 'Food data could not be used')
    }
    throw e
  }
  if (!resolved) throw new ServiceError('NOT_FOUND', 'Food unavailable')

  const grams = resolveGrams(input)
  const per100g = resolved.food.per100g
  const nextSort = (await repo.listIngredients(tenantId, recipeId)).length

  await repo.insertIngredient({
    tenantId,
    recipeId,
    sortOrder: nextSort,
    fdcId: resolved.food.fdcId,
    canonicalNameEn: resolved.food.descriptionEn,
    amount: String(input.amount),
    unit: input.unit,
    gramsResolved: String(round2(grams)),
    kcalPer100g: String(per100g.kcal),
    proteinPer100g: String(per100g.proteinG),
    carbsPer100g: String(per100g.carbG),
    fatPer100g: String(per100g.fatG),
    fiberPer100g: String(per100g.fiberG),
    saltPer100g: String(per100g.saltG),
    basisUnit: resolved.food.basisUnit,
    snapshotJson: per100g,
    fetchedAt: new Date(),
  })

  await recomputeRecipe(tenantId, recipeId)
  return getRecipe(tenantId, recipeId)
}

export async function updateIngredient(
  tenantId: string,
  recipeId: string,
  ingredientId: string,
  input: UpdateIngredientInput,
): Promise<RecipeDto> {
  const recipe = await repo.findRecipeRow(tenantId, recipeId)
  if (!recipe) throw new ServiceError('NOT_FOUND', 'Recipe not found')
  const ingredient = await repo.findIngredient(tenantId, ingredientId)
  if (!ingredient || ingredient.recipeId !== recipeId) {
    throw new ServiceError('NOT_FOUND', 'Ingredient not found')
  }

  const patch: { amount?: number; unit?: string; gramsResolved?: number; sortOrder?: number } = {}
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder

  const amountChanged = input.amount !== undefined || input.unit !== undefined
  if (amountChanged) {
    const amount = input.amount ?? Number(ingredient.amount)
    const unit = input.unit ?? ingredient.unit
    const grams = resolveGrams({
      amount,
      unit,
      densityGPerMl: input.densityGPerMl,
      gramsPerPiece: input.gramsPerPiece,
    })
    patch.amount = amount
    patch.unit = unit
    patch.gramsResolved = round2(grams)
  }

  await repo.updateIngredientQuantity(tenantId, ingredientId, patch)
  // The snapshot (per-100g) is never mutated — only the authored quantity — so the
  // recipe stays integrity-stable. Totals recompute from the frozen snapshots.
  if (amountChanged) await recomputeRecipe(tenantId, recipeId)
  return getRecipe(tenantId, recipeId)
}

export async function removeIngredient(
  tenantId: string,
  recipeId: string,
  ingredientId: string,
): Promise<RecipeDto> {
  const ingredient = await repo.findIngredient(tenantId, ingredientId)
  if (!ingredient || ingredient.recipeId !== recipeId) {
    throw new ServiceError('NOT_FOUND', 'Ingredient not found')
  }
  await repo.deleteIngredient(tenantId, ingredientId)
  await recomputeRecipe(tenantId, recipeId)
  return getRecipe(tenantId, recipeId)
}

/**
 * Recompute the cached totals and reconcile the deterministic allergen floor from
 * the current ingredient snapshots. Deterministic and pure — the only source of a
 * recipe's nutrition numbers.
 */
export async function recomputeRecipe(tenantId: string, recipeId: string): Promise<void> {
  const ingredients = await repo.listIngredients(tenantId, recipeId)
  if (ingredients.length === 0) {
    await repo.setRecipeTotals(tenantId, recipeId, null)
    await repo.syncDeterministicAllergens(tenantId, recipeId, [])
    return
  }
  const rollup = rollUpRecipe(
    ingredients.map((ing) => ({
      per100g: snapshotOf(ing),
      gramsResolved: Number(ing.gramsResolved),
    })),
    1,
  )
  await repo.setRecipeTotals(tenantId, recipeId, rollup.total)
  const floor = detectAllergenFloor(ingredients.map((ing) => ing.canonicalNameEn))
  await repo.syncDeterministicAllergens(tenantId, recipeId, floor)
}

function snapshotOf(ing: { kcalPer100g: string; proteinPer100g: string; carbsPer100g: string; fatPer100g: string; fiberPer100g: string; saltPer100g: string }): Nutrients {
  return {
    kcal: Number(ing.kcalPer100g),
    proteinG: Number(ing.proteinPer100g),
    fatG: Number(ing.fatPer100g),
    carbG: Number(ing.carbsPer100g),
    fiberG: Number(ing.fiberPer100g),
    saltG: Number(ing.saltPer100g),
  }
}

// ── Allergens ────────────────────────────────────────────────────────────────

export async function addDietitianAllergen(
  tenantId: string,
  recipeId: string,
  allergen: Allergen,
): Promise<RecipeDto> {
  const recipe = await repo.findRecipeRow(tenantId, recipeId)
  if (!recipe) throw new ServiceError('NOT_FOUND', 'Recipe not found')
  await repo.addAllergenIfAbsent(tenantId, recipeId, allergen, 'dietitian')
  return getRecipe(tenantId, recipeId)
}

export async function confirmAllergen(
  tenantId: string,
  recipeId: string,
  allergen: Allergen,
  isConfirmed: boolean,
): Promise<RecipeDto> {
  const updated = await repo.setAllergenConfirmed(tenantId, recipeId, allergen, isConfirmed)
  if (!updated) throw new ServiceError('NOT_FOUND', 'Allergen not found on this recipe')
  return getRecipe(tenantId, recipeId)
}

/** Remove an allergen. The deterministic floor cannot be removed (→ CONFLICT). */
export async function removeAllergen(
  tenantId: string,
  recipeId: string,
  allergen: Allergen,
): Promise<RecipeDto> {
  const existing = await repo.findAllergen(tenantId, recipeId, allergen)
  if (!existing) throw new ServiceError('NOT_FOUND', 'Allergen not found on this recipe')
  if (existing.source === 'deterministic') {
    throw new ServiceError('CONFLICT', 'A detected allergen cannot be removed')
  }
  await repo.deleteAllergen(tenantId, recipeId, allergen)
  return getRecipe(tenantId, recipeId)
}

/**
 * Additive AI allergen suggestion (haiku). Runs on canonical English ingredient
 * names; persists new allergens as `source=ai`, unconfirmed. Never removes.
 * Degrades gracefully when the API is off/unavailable/malformed.
 */
export async function suggestAllergens(tenantId: string, recipeId: string): Promise<AllergenSuggestResult> {
  const recipe = await repo.findRecipeRow(tenantId, recipeId)
  if (!recipe) throw new ServiceError('NOT_FOUND', 'Recipe not found')
  const ingredients = await repo.listIngredients(tenantId, recipeId)
  const existing = await repo.listAllergens(tenantId, recipeId)
  const alreadyFlagged = existing.map((r) => r.allergen)

  if (!isAiEnabled() || ingredients.length === 0) {
    await recordSuggestionAudit(tenantId, recipeId, 'unavailable')
    return { added: [], status: 'unavailable' }
  }

  try {
    const { proposal, rawOutput } = await proposeAllergens(
      ingredients.map((ing) => ing.canonicalNameEn),
      alreadyFlagged,
    )
    const flaggedSet = new Set<Allergen>(alreadyFlagged)
    const added: Allergen[] = []
    for (const allergen of proposal.additions) {
      if (flaggedSet.has(allergen)) continue
      const inserted = await repo.addAllergenIfAbsent(tenantId, recipeId, allergen, 'ai')
      if (inserted) {
        added.push(allergen)
        flaggedSet.add(allergen)
      }
    }
    await recordSuggestionAudit(tenantId, recipeId, 'proposed', rawOutput, proposal)
    return { added, status: 'suggested' }
  } catch (e) {
    const decision = e instanceof MalformedAllergenProposalError ? 'rejected_malformed' : 'unavailable'
    await recordSuggestionAudit(
      tenantId,
      recipeId,
      decision,
      e instanceof MalformedAllergenProposalError ? e.rawOutput : undefined,
    )
    if (e instanceof AllergenUpstreamUnavailableError || e instanceof MalformedAllergenProposalError) {
      return { added: [], status: 'unavailable' }
    }
    throw e
  }
}

async function recordSuggestionAudit(
  tenantId: string,
  recipeId: string,
  systemDecision: 'proposed' | 'rejected_malformed' | 'unavailable',
  rawOutput?: unknown,
  proposedValues?: unknown,
): Promise<void> {
  await recordAiInteraction({
    tenantId,
    recipeId,
    feature: 'allergen_suggestion',
    model: ALLERGEN_MODEL,
    promptVersion: ALLERGEN_PROMPT_VERSION,
    systemDecision,
    rawOutput,
    proposedValues,
  })
}

// ── Categories ─────────────────────────────────────────────────────────────────

function toCategoryDto(row: RecipeCategoryRow): RecipeCategoryDto {
  return { id: row.id, kind: row.kind as RecipeCategoryKind, nameEn: row.nameEn }
}

export async function listCategories(tenantId: string): Promise<RecipeCategoryDto[]> {
  const rows = await repo.listCategories(tenantId)
  return rows.map(toCategoryDto)
}

export async function createCategory(
  tenantId: string,
  kind: RecipeCategoryKind,
  nameEn: string,
): Promise<RecipeCategoryDto> {
  const row = await repo.createCategory(tenantId, kind, nameEn)
  return toCategoryDto(row)
}

export async function setRecipeCategories(
  tenantId: string,
  recipeId: string,
  categoryIds: string[],
): Promise<RecipeDto> {
  const recipe = await repo.findRecipeRow(tenantId, recipeId)
  if (!recipe) throw new ServiceError('NOT_FOUND', 'Recipe not found')
  await repo.setRecipeCategories(tenantId, recipeId, categoryIds)
  return getRecipe(tenantId, recipeId)
}

// ── List / dashboard ─────────────────────────────────────────────────────────

export async function listRecipes(
  tenantId: string,
  query: RecipeListQuery = {},
): Promise<RecipeSummaryDto[]> {
  const rows = await repo.listRecipeRows(tenantId)
  const ids = rows.map((r) => r.id)
  const [allergenRows, categoryLinks, counts] = await Promise.all([
    repo.allergensForRecipes(tenantId, ids),
    repo.categoriesForRecipes(tenantId, ids),
    repo.ingredientCounts(tenantId, ids),
  ])

  const allergensByRecipe = new Map<string, typeof allergenRows>()
  for (const row of allergenRows) {
    const list = allergensByRecipe.get(row.recipeId) ?? []
    list.push(row)
    allergensByRecipe.set(row.recipeId, list)
  }
  const categoriesByRecipe = new Map<string, RecipeCategoryRow[]>()
  for (const link of categoryLinks) {
    const list = categoriesByRecipe.get(link.recipeId) ?? []
    list.push(link.category)
    categoriesByRecipe.set(link.recipeId, list)
  }

  const search = query.search?.trim().toLowerCase()
  const excludeSet = new Set(query.excludeAllergens ?? [])

  const summaries: RecipeSummaryDto[] = []
  for (const row of rows) {
    const recipeAllergenRows = allergensByRecipe.get(row.id) ?? []
    const recipeCategoryRows = categoriesByRecipe.get(row.id) ?? []

    if (search && !row.title.toLowerCase().includes(search)) continue
    if (query.categoryId && !recipeCategoryRows.some((c) => c.id === query.categoryId)) continue
    if (excludeSet.size > 0 && recipeAllergenRows.some((a) => excludeSet.has(a.allergen))) continue

    summaries.push(
      assembleSummaryDto(row, counts.get(row.id) ?? 0, recipeAllergenRows, recipeCategoryRows),
    )
  }
  return summaries
}

// ── Export (scaled recipe PDF) ─────────────────────────────────────────────────

export interface RecipeExportResult {
  pdf: Buffer
  filename: string
  documentId: string
}

/**
 * Export a recipe as a scaled PDF. Nutrition + ingredient amounts are scaled
 * deterministically to `servings`; per-serving figures are invariant. The frozen
 * snapshot is persisted to `generated_documents` (immutable history) BEFORE
 * rendering, so the delivered document and the stored record always match.
 */
export async function exportRecipe(
  tenantId: string,
  recipeId: string,
  input: RecipeExportInput,
  userId: string,
): Promise<RecipeExportResult> {
  const row = await repo.findRecipeRow(tenantId, recipeId)
  if (!row) throw new ServiceError('NOT_FOUND', 'Recipe not found')
  const [ingredients, allergenRows] = await Promise.all([
    repo.listIngredients(tenantId, recipeId),
    repo.listAllergens(tenantId, recipeId),
  ])
  if (ingredients.length === 0) {
    throw new ServiceError('VALIDATION_ERROR', 'Add at least one ingredient before exporting')
  }

  const baseServings = row.servings > 0 ? row.servings : 1
  const requested = input.servings
  const factor = requested / baseServings
  const locale: Locale = input.locale ?? 'en'

  const rollup = rollUpRecipe(
    ingredients.map((ing) => ({ per100g: snapshotOf(ing), gramsResolved: Number(ing.gramsResolved) })),
    baseServings,
  )
  const perServing = roundNutrients(rollup.perServing)
  const total = roundNutrients({
    kcal: rollup.perServing.kcal * requested,
    proteinG: rollup.perServing.proteinG * requested,
    fatG: rollup.perServing.fatG * requested,
    carbG: rollup.perServing.carbG * requested,
    fiberG: rollup.perServing.fiberG * requested,
    saltG: rollup.perServing.saltG * requested,
  })

  const snapshot: RecipeExportSnapshot = {
    title: row.title,
    locale,
    baseServings,
    servingsRequested: requested,
    ingredients: ingredients.map((ing) => ({
      canonicalNameEn: ing.canonicalNameEn,
      amount: round2(Number(ing.amount) * factor),
      unit: ing.unit,
      gramsResolved: round2(Number(ing.gramsResolved) * factor),
    })),
    total,
    perServing,
    allergens: allergenRows.map((r) => r.allergen),
    instructions: row.instructions,
    notes: row.notes,
    storageRecommendation: row.storageRecommendation,
    prepTimeMinutes: row.prepTimeMinutes,
    cookTimeMinutes: row.cookTimeMinutes,
    clinicName: null, // DEFERRED: from user_settings (M5).
    generatedAtIso: new Date().toISOString(),
  }

  const documentId = await repo.recordGeneratedDocument({
    tenantId,
    recipeId,
    locale,
    servingsRequested: requested,
    snapshot,
    generatedByUserId: userId,
  })

  const pdf = await renderPdf(buildRecipeDocDefinition(snapshot))
  const filename = `${slugify(row.title)}-${requested}srv.pdf`
  return { pdf, filename, documentId }
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'recipe'
  )
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
