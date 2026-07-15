import { and, eq, isNull, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

/**
 * The single tenant-isolation primitive. Predicate: rows owned by `tenantId`
 * that are not soft-deleted. Every tenant-scoped query composes it, so a
 * forgotten WHERE fails closed and cross-tenant access resolves to 404 (not
 * 403) in the handlers. `tenantId` comes only from `req.tenantId` (the session),
 * never from client input. Reused by every future module's repository.
 */
export function activeForTenant(
  cols: { tenantId: PgColumn; deletedAt: PgColumn },
  tenantId: string,
): SQL {
  return and(eq(cols.tenantId, tenantId), isNull(cols.deletedAt))!
}
