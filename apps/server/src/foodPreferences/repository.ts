import { and, asc, eq, ne, sql } from 'drizzle-orm'
import type { FoodPreferenceCategory, FoodPreferenceItemDto } from '@kyb/shared'
import { getDb } from '../db/client'
import { foodPreferenceItems, foodPreferenceSeeds, type FoodPreferenceItemRow } from '../db/schema'

/**
 * Tenant-curated food nomenclator. A fresh tenant is lazily seeded with a
 * starter list of typical Central-European (Hungarian / Transylvanian) dishes on
 * first read; from then on the dietitian owns the list entirely. Labels are the
 * data (assessments snapshot them), so deletes are hard deletes.
 */

const seed = (category: FoodPreferenceCategory, labels: string[]) => labels.map((label) => ({ category, label }))

/** Starter lists — what an average Hungarian/Romanian-Hungarian client typically eats. */
export const DEFAULT_FOOD_PREFERENCES: { category: FoodPreferenceCategory; label: string }[] = [
  ...seed('breakfast', [
    'Rántotta',
    'Vajas-sonkás kenyér',
    'Sajtos szendvics',
    'Zabkása',
    'Joghurt müzlivel',
    'Bundáskenyér',
    'Körözött',
    'Virsli mustárral',
    'Lekváros kenyér',
    'Kifli tejjel / kakaóval',
    'Palacsinta',
    'Tükörtojás',
  ]),
  ...seed('lunch', [
    'Húsleves',
    'Gulyásleves',
    'Csorbaleves',
    'Rántott hús körettel',
    'Csirkepaprikás galuskával',
    'Töltött káposzta',
    'Paprikás krumpli',
    'Pörkölt',
    'Lecsó',
    'Főzelék fasírttal',
    'Rakott krumpli',
    'Töltött paprika',
    'Spagetti bolognai módra',
    'Sült csirke rizzsel',
    'Mititei (mics)',
    'Pizza',
  ]),
  ...seed('dinner', [
    'Szendvics felvágottal',
    'Rántotta',
    'Virsli',
    'Túrós csusza',
    'Zöldségsaláta csirkével',
    'Hidegtál (sajt, felvágott, zöldség)',
    'Sült kolbász',
    'Grillezett sajt',
    'Joghurt müzlivel',
    'Maradék ebéd',
    'Bundáskenyér',
  ]),
  ...seed('snack', [
    'Gyümölcs',
    'Joghurt / kefir',
    'Ropi / sós keksz',
    'Chips',
    'Popcorn',
    'Müzliszelet',
    'Diófélék, magvak',
    'Sajt',
    'Pogácsa',
    'Perec',
  ]),
  ...seed('dessert', [
    'Palacsinta',
    'Házi sütemény',
    'Csokoládé',
    'Fagylalt',
    'Kürtőskalács',
    'Kakaós csiga',
    'Keksz',
    'Torta',
    'Kalács',
    'Gofri',
  ]),
]

/** Postgres unique-constraint violation (SQLSTATE 23505), however the driver wraps it. */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { code?: unknown; cause?: { code?: unknown }; message?: unknown }
  return (
    e.code === '23505' ||
    e.cause?.code === '23505' ||
    (typeof e.message === 'string' && e.message.includes('duplicate key'))
  )
}

export function toFoodPreferenceDto(row: FoodPreferenceItemRow): FoodPreferenceItemDto {
  return {
    id: row.id,
    category: row.category as FoodPreferenceCategory,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
  }
}

export const foodPreferencesRepository = {
  async list(tenantId: string): Promise<FoodPreferenceItemRow[]> {
    return getDb()
      .select()
      .from(foodPreferenceItems)
      .where(eq(foodPreferenceItems.tenantId, tenantId))
      .orderBy(asc(foodPreferenceItems.category), asc(foodPreferenceItems.label))
  },

  /** Seed the starter lists for a fresh tenant. Conflict-safe (concurrent first loads). */
  async seedDefaults(tenantId: string): Promise<void> {
    const db = getDb()
    await db
      .insert(foodPreferenceItems)
      .values(DEFAULT_FOOD_PREFERENCES.map((d) => ({ ...d, tenantId })))
      .onConflictDoNothing()
    await db.insert(foodPreferenceSeeds).values({ tenantId }).onConflictDoNothing()
  },

  /**
   * List, seeding the defaults on a tenant's FIRST read only. The persisted seed
   * marker (not list emptiness) decides — a dietitian who deletes every item
   * keeps an empty list rather than getting the defaults resurrected.
   */
  async listSeeded(tenantId: string): Promise<FoodPreferenceItemRow[]> {
    const rows = await this.list(tenantId)
    if (rows.length > 0) return rows
    const [marker] = await getDb()
      .select({ tenantId: foodPreferenceSeeds.tenantId })
      .from(foodPreferenceSeeds)
      .where(eq(foodPreferenceSeeds.tenantId, tenantId))
      .limit(1)
    if (marker) return rows // intentionally empty
    await this.seedDefaults(tenantId)
    return this.list(tenantId)
  },

  /** Insert one item; null = duplicate label in this category (→ 409). */
  async create(
    tenantId: string,
    input: { category: FoodPreferenceCategory; label: string },
  ): Promise<FoodPreferenceItemRow | null> {
    const [row] = await getDb()
      .insert(foodPreferenceItems)
      .values({ tenantId, category: input.category, label: input.label })
      .onConflictDoNothing()
      .returning()
    return row ?? null
  },

  async findById(tenantId: string, id: string): Promise<FoodPreferenceItemRow | null> {
    const [row] = await getDb()
      .select()
      .from(foodPreferenceItems)
      .where(and(eq(foodPreferenceItems.tenantId, tenantId), eq(foodPreferenceItems.id, id)))
      .limit(1)
    return row ?? null
  },

  /** True when another item in the same category already uses this label (case-insensitive). */
  async labelTaken(tenantId: string, category: FoodPreferenceCategory, label: string, exceptId: string): Promise<boolean> {
    const [row] = await getDb()
      .select({ id: foodPreferenceItems.id })
      .from(foodPreferenceItems)
      .where(
        and(
          eq(foodPreferenceItems.tenantId, tenantId),
          eq(foodPreferenceItems.category, category),
          sql`lower(${foodPreferenceItems.label}) = lower(${label})`,
          ne(foodPreferenceItems.id, exceptId),
        ),
      )
      .limit(1)
    return !!row
  },

  /** Rename; 'duplicate' when the unique index rejects it (pre-check raced). */
  async rename(tenantId: string, id: string, label: string): Promise<FoodPreferenceItemRow | null | 'duplicate'> {
    try {
      const [row] = await getDb()
        .update(foodPreferenceItems)
        .set({ label, updatedAt: new Date() })
        .where(and(eq(foodPreferenceItems.tenantId, tenantId), eq(foodPreferenceItems.id, id)))
        .returning()
      return row ?? null
    } catch (error) {
      if (isUniqueViolation(error)) return 'duplicate'
      throw error
    }
  },

  async remove(tenantId: string, id: string): Promise<boolean> {
    const rows = await getDb()
      .delete(foodPreferenceItems)
      .where(and(eq(foodPreferenceItems.tenantId, tenantId), eq(foodPreferenceItems.id, id)))
      .returning({ id: foodPreferenceItems.id })
    return rows.length > 0
  },
}
