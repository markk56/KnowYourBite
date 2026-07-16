import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { idColumn, softDelete, timestamps } from '../columns'

/**
 * Recipe Library cluster (Milestone 3) — where recipe integrity (ADR §5) is
 * enforced *structurally*. `recipe_ingredients` carries a FROZEN per-100g nutrient
 * snapshot captured at add-time; recipe nutrition is always computed from that
 * snapshot, never live from the mutable `usda_food_cache`. There is deliberately
 * NO table or column that lets a meal plan or the AI change an ingredient amount.
 */

export const allergenEnum = pgEnum('allergen', [
  'milk',
  'gluten',
  'eggs',
  'peanuts',
  'soy',
  'tree_nuts',
  'shellfish',
])
export const allergenSourceEnum = pgEnum('allergen_source', ['deterministic', 'ai', 'dietitian'])

export const recipes = pgTable(
  'recipes',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    title: text('title').notNull(),
    imageUrl: text('image_url'), // DEFERRED: Object Storage upload lands later (like clients.avatarUrl).
    instructions: text('instructions'), // authored, NOT auto-translated (ADR §7)
    prepTimeMinutes: integer('prep_time_minutes'),
    cookTimeMinutes: integer('cook_time_minutes'),
    notes: text('notes'),
    storageRecommendation: text('storage_recommendation'),
    servings: integer('servings').notNull().default(1),

    // DERIVED deterministic totals (@kyb/domain), cached for list/filter speed and
    // recomputed from recipe_ingredients on every ingredient change. Nullable until
    // the recipe has ingredients. Per-serving is NEVER stored — it's total/servings.
    totalKcal: numeric('total_kcal', { precision: 8, scale: 1 }),
    totalProteinG: numeric('total_protein_g', { precision: 7, scale: 1 }),
    totalCarbsG: numeric('total_carbs_g', { precision: 7, scale: 1 }),
    totalFatG: numeric('total_fat_g', { precision: 7, scale: 1 }),
    totalFiberG: numeric('total_fiber_g', { precision: 7, scale: 1 }),
    totalSaltG: numeric('total_salt_g', { precision: 7, scale: 2 }),
    nutritionComputedAt: timestamp('nutrition_computed_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (t) => ({
    tenantIdx: index('recipes_tenant_idx').on(t.tenantId),
    tenantTitleIdx: index('recipes_tenant_title_idx').on(t.tenantId, t.title),
    // TODO(M5): diacritic-insensitive trigram title index (needs pg_trgm + unaccent).
  }),
)

/**
 * The immutable USDA snapshot (integrity anchor). `fdcId` is kept only to power an
 * explicit, diff-previewed "refresh from USDA". CASCADE is intentional and
 * permitted here: ingredients are wholly-owned children of a recipe, not a
 * clinical entity (the CASCADE ban applies to clients/recipes/plans/assessments).
 */
export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),

    fdcId: integer('fdc_id').notNull(),
    canonicalNameEn: text('canonical_name_en').notNull(), // English canonical (clinical logic)

    amount: numeric('amount', { precision: 9, scale: 2 }).notNull(),
    unit: text('unit').notNull(), // g | ml | piece | tbsp | ...
    gramsResolved: numeric('grams_resolved', { precision: 9, scale: 2 }).notNull(),

    // FROZEN per-100g snapshot (source of all nutrition math). Immutable after write.
    kcalPer100g: numeric('kcal_per_100g', { precision: 8, scale: 2 }).notNull(),
    proteinPer100g: numeric('protein_per_100g', { precision: 7, scale: 2 }).notNull(),
    carbsPer100g: numeric('carbs_per_100g', { precision: 7, scale: 2 }).notNull(),
    fatPer100g: numeric('fat_per_100g', { precision: 7, scale: 2 }).notNull(),
    fiberPer100g: numeric('fiber_per_100g', { precision: 7, scale: 2 }).notNull().default('0'),
    saltPer100g: numeric('salt_per_100g', { precision: 7, scale: 2 }).notNull().default('0'),
    basisUnit: text('basis_unit').notNull().default('100g'),
    snapshotJson: jsonb('snapshot_json'), // full frozen nutrient vector
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index('recipe_ingredients_tenant_idx').on(t.tenantId),
    recipeIdx: index('recipe_ingredients_recipe_idx').on(t.recipeId, t.sortOrder),
    kcalPlausible: check(
      'recipe_ingredients_kcal_plausible',
      sql`${t.kcalPer100g} >= 0 AND ${t.kcalPer100g} <= 900`,
    ),
  }),
)

/**
 * Deterministic floor + additive AI suggestions; a dietitian confirms the final
 * list. AI may flag, never silently remove (ADR §6). The unique index makes each
 * allergen appear at most once per recipe.
 */
export const recipeAllergens = pgTable(
  'recipe_allergens',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    allergen: allergenEnum('allergen').notNull(),
    source: allergenSourceEnum('source').notNull(),
    isConfirmed: boolean('is_confirmed').notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    recipeAllergenUniq: uniqueIndex('recipe_allergen_uniq').on(t.recipeId, t.allergen),
    tenantIdx: index('recipe_allergens_tenant_idx').on(t.tenantId),
  }),
)

/** Two tag dimensions (`category` / `meal_category`) as a per-tenant tag table + join. */
export const recipeCategories = pgTable(
  'recipe_categories',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    kind: text('kind').notNull(), // "category" | "meal_category"
    nameEn: text('name_en').notNull(),
    ...timestamps,
  },
  (t) => ({
    tenantKindNameUniq: uniqueIndex('recipe_categories_uniq').on(t.tenantId, t.kind, t.nameEn),
    tenantIdx: index('recipe_categories_tenant_idx').on(t.tenantId),
  }),
)

export const recipeCategoriesMap = pgTable(
  'recipe_categories_map',
  {
    tenantId: uuid('tenant_id').notNull(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => recipeCategories.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.recipeId, t.categoryId] }),
    categoryIdx: index('recipe_cat_map_category_idx').on(t.tenantId, t.categoryId),
  }),
)

export type RecipeRow = typeof recipes.$inferSelect
export type NewRecipeRow = typeof recipes.$inferInsert
export type RecipeIngredientRow = typeof recipeIngredients.$inferSelect
export type NewRecipeIngredientRow = typeof recipeIngredients.$inferInsert
export type RecipeAllergenRow = typeof recipeAllergens.$inferSelect
export type NewRecipeAllergenRow = typeof recipeAllergens.$inferInsert
export type RecipeCategoryRow = typeof recipeCategories.$inferSelect
export type NewRecipeCategoryRow = typeof recipeCategories.$inferInsert
export type RecipeCategoryMapRow = typeof recipeCategoriesMap.$inferSelect
