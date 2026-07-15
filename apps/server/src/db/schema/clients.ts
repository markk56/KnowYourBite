import { date, index, pgEnum, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { idColumn, softDelete, timestamps } from '../columns'

/**
 * Clients cluster (Milestone 1 — first tenant-scoped product module). Every row
 * carries `tenant_id`; all queries scope to it via the tenantScope helper, so a
 * forgotten WHERE fails closed and cross-tenant reads resolve to 404.
 */
export const clientTypeEnum = pgEnum('client_type', ['standard', 'sports'])
// Canonical assessment_status enum. M1 shipped ['unfinished','completed']; M2
// appends 'ai_proposed' and 'discarded' AFTER them so `db:push` can express the
// change as plain ALTER TYPE ... ADD VALUE (append-only — no type recreate).
// Ordinal order is irrelevant: no code does ordered comparisons on status.
// The `clients` column only ever holds unfinished|completed;
// `client_assessments.status` uses all four.
export const assessmentStatusEnum = pgEnum('assessment_status', [
  'unfinished',
  'completed',
  'ai_proposed',
  'discarded',
])

export const clients = pgTable(
  'clients',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    email: varchar('email', { length: 320 }),
    phone: varchar('phone', { length: 40 }),
    clientType: clientTypeEnum('client_type').notNull(),
    clientSince: date('client_since').notNull().defaultNow(),
    assessmentStatus: assessmentStatusEnum('assessment_status').notNull().default('unfinished'),
    avatarUrl: text('avatar_url'), // DEFERRED: no upload UI/endpoint in M1 (needs Object Storage).
    notes: text('notes'),
    ...timestamps,
    ...softDelete,
  },
  (t) => ({
    tenantIdx: index('clients_tenant_idx').on(t.tenantId),
    tenantNameIdx: index('clients_tenant_name_idx').on(t.tenantId, t.fullName),
    // TODO(M2): diacritic-insensitive trigram search index (needs pg_trgm + unaccent extensions).
  }),
)

export type ClientRow = typeof clients.$inferSelect
export type NewClientRow = typeof clients.$inferInsert
