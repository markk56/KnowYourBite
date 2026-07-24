import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { idColumn, timestamps } from '../columns'

/**
 * Food-preference nomenclator — tenant-curated lists of typical breakfasts /
 * lunches / dinners / snacks / desserts ticked off in the anamnesis. Rows are
 * HARD-deleted (assessments snapshot the label, not the id, so history never
 * dangles) and (tenant, category, label) is unique so the list stays clean.
 */

export const foodPreferenceCategoryEnum = pgEnum('food_preference_category', [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
])

export const foodPreferenceItems = pgTable(
  'food_preference_items',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    category: foodPreferenceCategoryEnum('category').notNull(),
    label: text('label').notNull(),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index('food_pref_tenant_idx').on(t.tenantId, t.category),
    // Case-insensitive uniqueness: "Pizza" and "pizza" are the same item.
    labelUniq: uniqueIndex('food_pref_label_uniq').on(t.tenantId, t.category, sql`lower(${t.label})`),
  }),
)

/**
 * One row per tenant that has received the starter lists. Seeding keys off this
 * marker (not off list emptiness), so a dietitian who deletes every item keeps
 * an empty list instead of having the defaults resurrected on the next read.
 */
export const foodPreferenceSeeds = pgTable('food_preference_seeds', {
  tenantId: uuid('tenant_id').primaryKey(),
  seededAt: timestamp('seeded_at', { withTimezone: true }).notNull().defaultNow(),
})

export type FoodPreferenceItemRow = typeof foodPreferenceItems.$inferSelect
export type NewFoodPreferenceItemRow = typeof foodPreferenceItems.$inferInsert
