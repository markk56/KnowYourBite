import { timestamp, uuid } from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'

/**
 * Shared column helpers (ADR-000 §7). UUIDv7 keys are generated app-side so IDs
 * are opaque, non-enumerable, and time-sortable. Timestamps are timezone-aware.
 */
export const idColumn = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7())

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}
