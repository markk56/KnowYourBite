import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { resolveAssessmentTargets } from '@kyb/domain'
import { getDb } from '../db/client'
import { aiInteractions, assessmentTargets, clientAssessments, clients } from '../db/schema'
import { clientsRepository } from '../clients/repository'
import { assessmentsRepository } from './repository'

/**
 * DB integration tests — SKIPPED unless RUN_DB_TESTS=1 (CI has only a dummy
 * DATABASE_URL). Run on Replit against live Postgres: `RUN_DB_TESTS=1 npm test`.
 */
describe.skipIf(!process.env.RUN_DB_TESTS)('assessments repository (DB)', () => {
  const tenantA = uuidv7()
  const tenantB = uuidv7()

  async function cleanup() {
    const db = getDb()
    for (const tid of [tenantA, tenantB]) {
      await db.delete(assessmentTargets).where(eq(assessmentTargets.tenantId, tid))
      await db.delete(aiInteractions).where(eq(aiInteractions.tenantId, tid))
      await db.delete(clientAssessments).where(eq(clientAssessments.tenantId, tid))
      await db.delete(clients).where(eq(clients.tenantId, tid))
    }
  }

  beforeAll(cleanup)
  afterAll(cleanup)

  it('creates version-incrementing drafts scoped to a client', async () => {
    const client = await clientsRepository.create(tenantA, { fullName: 'Alice', clientType: 'standard' })
    const a1 = await assessmentsRepository.createDraft(tenantA, client.id, 'standard')
    const a2 = await assessmentsRepository.createDraft(tenantA, client.id, 'standard')
    expect(a1.version).toBe(1)
    expect(a2.version).toBe(2)
    expect(a1.status).toBe('unfinished')

    const list = await assessmentsRepository.listForClient(tenantA, client.id)
    expect(list.map((r) => r.version)).toEqual([2, 1]) // newest first
  })

  it('saves draft HB inputs + payload, then proposes, then approves human-final targets', async () => {
    const client = await clientsRepository.create(tenantA, { fullName: 'Bob', clientType: 'sports' })
    const draft = await assessmentsRepository.createDraft(tenantA, client.id, 'sports')

    const saved = await assessmentsRepository.updateDraft(tenantA, draft.id, {
      sex: 'male',
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      activityFactor: 1.725,
      payload: { sportType: 'weights', energyLevel: 7 },
    })
    expect(saved?.sex).toBe('male')
    expect(Number(saved?.weightKg)).toBe(80)

    const proposed = await assessmentsRepository.setAiProposed(
      tenantA,
      draft.id,
      { summary: 's', calorieAdjustmentPercent: 10, rationale: 'r', focusAreas: [] },
      'assessment-v1',
    )
    expect(proposed?.status).toBe('ai_proposed')

    const det = resolveAssessmentTargets(
      { sex: 'male', ageYears: 30, heightCm: 180, weightKg: 80, activityFactor: 1.725 },
      'sports',
    )
    const targets = await assessmentsRepository.approve(
      tenantA,
      { ...proposed! },
      tenantA,
      { bmrKcal: det.bmrKcal, maintenanceTdeeKcal: det.maintenanceTdeeKcal },
      { targetKcal: 2500, proteinG: 160, carbsG: 250, fatG: 80, decisionSummary: 'edited' },
    )
    expect(Number(targets.targetKcal)).toBe(2500)

    // Assessment + client both flip to completed.
    const done = await assessmentsRepository.findById(tenantA, draft.id)
    expect(done?.status).toBe('completed')
    expect(done?.completedAt).not.toBeNull()
    const c = await clientsRepository.findById(tenantA, client.id)
    expect(c?.assessmentStatus).toBe('completed')

    const foundTargets = await assessmentsRepository.findTargets(tenantA, draft.id)
    expect(foundTargets?.id).toBe(targets.id)
  })

  it('isolates tenants: B cannot read, edit, discard, or see A’s assessment (→ null/false)', async () => {
    const client = await clientsRepository.create(tenantA, { fullName: 'Carol', clientType: 'standard' })
    const a = await assessmentsRepository.createDraft(tenantA, client.id, 'standard')

    expect(await assessmentsRepository.findById(tenantB, a.id)).toBeNull()
    expect(await assessmentsRepository.updateDraft(tenantB, a.id, { weightKg: 99 })).toBeNull()
    expect(await assessmentsRepository.discard(tenantB, a.id)).toBe(false)
    expect(await assessmentsRepository.findTargets(tenantB, a.id)).toBeNull()

    // Still intact for its owner.
    expect((await assessmentsRepository.findById(tenantA, a.id))?.id).toBe(a.id)
  })

  it('discard hides the assessment from the current lookup', async () => {
    const client = await clientsRepository.create(tenantA, { fullName: 'Dan', clientType: 'standard' })
    const a = await assessmentsRepository.createDraft(tenantA, client.id, 'standard')
    expect((await assessmentsRepository.findCurrent(tenantA, client.id))?.id).toBe(a.id)
    expect(await assessmentsRepository.discard(tenantA, a.id)).toBe(true)
    expect(await assessmentsRepository.findCurrent(tenantA, client.id)).toBeNull()
  })
})
