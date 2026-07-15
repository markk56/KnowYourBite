import { integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { idColumn, timestamps } from '../columns'

/**
 * Auth cluster (ADR-001 schema freeze). `tenant_id === users.id` for a single
 * dietitian tenant — modeled as a distinct column so multi-seat clinics are a
 * later addition with no backfill. MFA/lockout columns are provisioned now,
 * wired later. The session table (`user_sessions`) is managed by
 * connect-pg-simple, not declared here.
 */
export const users = pgTable('users', {
  id: idColumn(),
  tenantId: uuid('tenant_id').notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: varchar('full_name', { length: 200 }).notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  totpSecret: text('totp_secret'),
  mfaEnabledAt: timestamp('mfa_enabled_at', { withTimezone: true }),
  ...timestamps,
})

export const authTokenPurpose = pgEnum('auth_token_purpose', ['email_verify', 'password_reset'])

export const authTokens = pgTable('auth_tokens', {
  id: idColumn(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purpose: authTokenPurpose('purpose').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  ...timestamps,
})

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
