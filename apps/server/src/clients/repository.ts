import { and, desc, eq, ilike, or } from 'drizzle-orm'
import type {
  ClientCreateInput,
  ClientDto,
  ClientListQuery,
  ClientUpdateInput,
} from '@kyb/shared'
import { getDb } from '../db/client'
import { clients, type ClientRow, type NewClientRow } from '../db/schema'
import { activeForTenant } from '../db/tenantScope'

/** Serialize a DB row into the wire DTO (omits tenantId/deletedAt). */
export function toClientDto(row: ClientRow): ClientDto {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    clientType: row.clientType,
    clientSince: row.clientSince,
    // Invariant: the clients column only ever holds unfinished|completed
    // (see db/schema/clients.ts); narrow the wider enum for the M1 wire DTO.
    assessmentStatus: row.assessmentStatus === 'completed' ? 'completed' : 'unfinished',
    avatarUrl: row.avatarUrl,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Translate a validated patch into column updates; only provided keys are set. */
function mapPatch(patch: ClientUpdateInput): Partial<NewClientRow> {
  const set: Partial<NewClientRow> = {}
  if ('fullName' in patch && patch.fullName !== undefined) set.fullName = patch.fullName
  if ('email' in patch) set.email = patch.email ?? null
  if ('phone' in patch) set.phone = patch.phone ?? null
  if ('clientType' in patch && patch.clientType !== undefined) set.clientType = patch.clientType
  if ('clientSince' in patch && patch.clientSince !== undefined) set.clientSince = patch.clientSince
  if ('notes' in patch) set.notes = patch.notes ?? null
  if ('assessmentStatus' in patch && patch.assessmentStatus !== undefined)
    set.assessmentStatus = patch.assessmentStatus
  return set
}

/**
 * Tenant-scoped clients repository — the reusable isolation pattern for product
 * modules. Every method takes `tenantId` first and composes `activeForTenant`,
 * so unknown/other-tenant ids return null/false and routes emit 404.
 */
export const clientsRepository = {
  async list(tenantId: string, q: ClientListQuery = {}): Promise<ClientRow[]> {
    const filters = [activeForTenant(clients, tenantId)]
    if (q.type) filters.push(eq(clients.clientType, q.type))
    if (q.search) {
      const term = `%${q.search}%`
      filters.push(or(ilike(clients.fullName, term), ilike(clients.email, term))!)
    }
    return getDb()
      .select()
      .from(clients)
      .where(and(...filters))
      .orderBy(desc(clients.createdAt))
  },

  async findById(tenantId: string, id: string): Promise<ClientRow | null> {
    const [row] = await getDb()
      .select()
      .from(clients)
      .where(and(activeForTenant(clients, tenantId), eq(clients.id, id)))
      .limit(1)
    return row ?? null
  },

  async create(tenantId: string, input: ClientCreateInput): Promise<ClientRow> {
    const [row] = await getDb()
      .insert(clients)
      .values({
        tenantId,
        fullName: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        clientType: input.clientType,
        ...(input.clientSince ? { clientSince: input.clientSince } : {}),
        notes: input.notes ?? null,
      })
      .returning()
    // INSERT ... RETURNING always yields exactly one row; the guard satisfies
    // noUncheckedIndexedAccess (array-destructure widens to ClientRow | undefined).
    if (!row) throw new Error('Failed to create client')
    return row
  },

  async update(tenantId: string, id: string, patch: ClientUpdateInput): Promise<ClientRow | null> {
    const [row] = await getDb()
      .update(clients)
      .set({ ...mapPatch(patch), updatedAt: new Date() })
      .where(and(activeForTenant(clients, tenantId), eq(clients.id, id)))
      .returning()
    return row ?? null
  },

  async softDelete(tenantId: string, id: string): Promise<boolean> {
    const rows = await getDb()
      .update(clients)
      .set({ deletedAt: new Date() })
      .where(and(activeForTenant(clients, tenantId), eq(clients.id, id)))
      .returning({ id: clients.id })
    return rows.length > 0
  },
}
