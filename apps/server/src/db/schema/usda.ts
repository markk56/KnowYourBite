import { index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { idColumn, timestamps } from '../columns'

/**
 * USDA reference cache + export artifacts (Milestone 3).
 *
 * `usda_food_cache` is a GLOBAL, read-mostly reference table — no `tenant_id`, no
 * RLS (ADR §7 "reference spine"). Clinical logic and allergen detection always
 * read this canonical English record. It is the durable half of the cache-first
 * pipeline; recipe ingredients copy a FROZEN snapshot from it, so mutating a cache
 * row never changes existing recipe nutrition.
 */

export const usdaDataTypeEnum = pgEnum('usda_data_type', ['foundation', 'sr_legacy', 'branded'])
export const localeEnum = pgEnum('locale', ['en', 'ro', 'hu'])

export const usdaFoodCache = pgTable(
  'usda_food_cache',
  {
    fdcId: integer('fdc_id').primaryKey(),
    dataType: usdaDataTypeEnum('data_type').notNull(),
    descriptionEn: text('description_en').notNull(),
    // Normalized per-100g nutrients (Branded converted from labelNutrients/servingSize).
    kcalPer100g: numeric('kcal_per_100g', { precision: 8, scale: 2 }),
    proteinPer100g: numeric('protein_per_100g', { precision: 7, scale: 2 }),
    carbsPer100g: numeric('carbs_per_100g', { precision: 7, scale: 2 }),
    fatPer100g: numeric('fat_per_100g', { precision: 7, scale: 2 }),
    fiberPer100g: numeric('fiber_per_100g', { precision: 7, scale: 2 }),
    saltPer100g: numeric('salt_per_100g', { precision: 7, scale: 2 }),
    basisUnit: text('basis_unit').notNull().default('100g'),
    rawJson: jsonb('raw_json').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dataTypeIdx: index('usda_data_type_idx').on(t.dataType),
    // TODO(M5): diacritic-insensitive trigram description index (needs pg_trgm + unaccent).
    descIdx: index('usda_desc_idx').on(t.descriptionEn),
  }),
)

/**
 * Frozen export snapshot + history (ADR §5.5). On export the recipe (later: meal
 * plan) freezes into an immutable snapshot so later edits never alter a delivered
 * PDF. `pdfObjectId` / `templateId` are DEFERRED (Object Storage + export
 * templates land in M5); the PDF is streamed to the browser for now and the
 * snapshot row is the durable history record.
 */
export const generatedDocuments = pgTable(
  'generated_documents',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    kind: text('kind').notNull(), // "recipe" | "meal_plan"
    clientId: uuid('client_id'),
    recipeId: uuid('recipe_id'),
    mealPlanId: uuid('meal_plan_id'),
    locale: localeEnum('locale').notNull().default('en'),
    servingsRequested: integer('servings_requested'),
    // Immutable frozen content validated by a Zod snapshot schema.
    snapshot: jsonb('snapshot').notNull(),
    pdfObjectId: uuid('pdf_object_id'), // DEFERRED: Object Storage (M5).
    templateId: uuid('template_id'), // DEFERRED: export_templates (M5).
    generatedByUserId: uuid('generated_by_user_id').notNull(),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index('generated_docs_tenant_idx').on(t.tenantId),
    recipeIdx: index('generated_docs_recipe_idx').on(t.tenantId, t.recipeId),
    clientIdx: index('generated_docs_client_idx').on(t.tenantId, t.clientId),
  }),
)

export type UsdaFoodCacheRow = typeof usdaFoodCache.$inferSelect
export type NewUsdaFoodCacheRow = typeof usdaFoodCache.$inferInsert
export type GeneratedDocumentRow = typeof generatedDocuments.$inferSelect
export type NewGeneratedDocumentRow = typeof generatedDocuments.$inferInsert
