import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { getDb } from '../db/client'
import { clients } from '../db/schema'
import { clientsRepository } from './repository'

/**
 * DB integration tests. CI has only a dummy DATABASE_URL (the Neon serverless
 * driver cannot reach it), so these are SKIPPED unless RUN_DB_TESTS=1 — run them
 * on Replit with a live Postgres: `RUN_DB_TESTS=1 npm run test`.
 */
describe.skipIf(!process.env.RUN_DB_TESTS)('clients repository (DB)', () => {
  const tenantA = uuidv7()
  const tenantB = uuidv7()
  const today = new Date().toISOString().slice(0, 10)

  // Hard-delete every row these tenants created (soft-delete would leave rows behind).
  async function cleanup() {
    const db = getDb()
    await db.delete(clients).where(eq(clients.tenantId, tenantA))
    await db.delete(clients).where(eq(clients.tenantId, tenantB))
  }

  beforeAll(cleanup)
  afterAll(cleanup)

  it('creates a client with defaults and reads it back', async () => {
    const created = await clientsRepository.create(tenantA, {
      fullName: 'Alice Anderson',
      clientType: 'standard',
      email: 'alice@example.com',
    })
    expect(created.assessmentStatus).toBe('unfinished')
    expect(created.clientSince).toBe(today)
    expect(created.deletedAt).toBeNull()

    const found = await clientsRepository.findById(tenantA, created.id)
    expect(found?.id).toBe(created.id)
    expect(found?.fullName).toBe('Alice Anderson')
  })

  it('lists newest-first and honors search + type filters', async () => {
    await clientsRepository.create(tenantB, { fullName: 'Bob Runner', clientType: 'sports', email: 'bob@run.io' })
    await clientsRepository.create(tenantB, { fullName: 'Carol Casual', clientType: 'standard' })

    const all = await clientsRepository.list(tenantB)
    expect(all.map((c) => c.fullName)).toEqual(['Carol Casual', 'Bob Runner']) // newest first

    const byName = await clientsRepository.list(tenantB, { search: 'runner' })
    expect(byName.map((c) => c.fullName)).toEqual(['Bob Runner'])

    const byEmail = await clientsRepository.list(tenantB, { search: 'bob@run' })
    expect(byEmail.map((c) => c.fullName)).toEqual(['Bob Runner'])

    const sports = await clientsRepository.list(tenantB, { type: 'sports' })
    expect(sports.map((c) => c.fullName)).toEqual(['Bob Runner'])
  })

  it('applies a partial update and bumps updatedAt', async () => {
    const created = await clientsRepository.create(tenantA, { fullName: 'Dana Diet', clientType: 'standard' })
    const before = created.updatedAt.getTime()
    await new Promise((r) => setTimeout(r, 5))

    const updated = await clientsRepository.update(tenantA, created.id, {
      phone: '+40 700 000 000',
      assessmentStatus: 'completed',
    })
    expect(updated?.phone).toBe('+40 700 000 000')
    expect(updated?.assessmentStatus).toBe('completed')
    expect(updated?.fullName).toBe('Dana Diet') // untouched field preserved
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(before)
  })

  it('soft-deletes and then hides the row from list/findById', async () => {
    const created = await clientsRepository.create(tenantA, { fullName: 'Erin Gone', clientType: 'standard' })
    expect(await clientsRepository.softDelete(tenantA, created.id)).toBe(true)

    expect(await clientsRepository.findById(tenantA, created.id)).toBeNull()
    const list = await clientsRepository.list(tenantA)
    expect(list.find((c) => c.id === created.id)).toBeUndefined()

    // The row still exists physically with deletedAt set.
    const [raw] = await getDb().select().from(clients).where(eq(clients.id, created.id)).limit(1)
    expect(raw).toBeTruthy()
    expect(raw!.deletedAt).not.toBeNull()
  })

  it('isolates tenants: cross-tenant access resolves to not-found (404), never 403', async () => {
    const aClient = await clientsRepository.create(tenantA, { fullName: 'Frank Private', clientType: 'standard' })

    // Tenant B cannot see, update, or delete tenant A's client.
    expect(await clientsRepository.findById(tenantB, aClient.id)).toBeNull()
    expect(await clientsRepository.update(tenantB, aClient.id, { fullName: 'Hacked' })).toBeNull()
    expect(await clientsRepository.softDelete(tenantB, aClient.id)).toBe(false)

    // The row remains visible and unchanged to its owner.
    const stillThere = await clientsRepository.findById(tenantA, aClient.id)
    expect(stillThere?.fullName).toBe('Frank Private')
    expect(stillThere?.deletedAt).toBeNull()

    // Sanity: the scoping predicate really did match by tenant.
    const [rawForA] = await getDb()
      .select()
      .from(clients)
      .where(and(eq(clients.id, aClient.id), eq(clients.tenantId, tenantA)))
      .limit(1)
    expect(rawForA).toBeTruthy()
  })
})
