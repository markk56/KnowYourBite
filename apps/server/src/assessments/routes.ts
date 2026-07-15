import { Router, type Request, type Response } from 'express'
import { approveTargetsSchema, assessmentDraftSchema, err, ok, statusForCode } from '@kyb/shared'
import { clientsRepository } from '../clients/repository'
import { assessmentsRepository, toAssessmentDto, toTargetsDto } from './repository'
import { approveAssessment, finishWithAi, ServiceError } from './service'

/**
 * Assessments router — mounted at `/api/v1/clients/:clientId/assessments` behind
 * requireAuth (mergeParams to read :clientId). Every handler first confirms the
 * parent client belongs to the tenant, so a cross-tenant client id resolves to
 * 404 (never 403); assessment ids are additionally tenant-scoped in the repo.
 */
export function createAssessmentsRouter(): Router {
  const router = Router({ mergeParams: true })

  /** Guard: load the tenant's client or 404. Returns null after responding. */
  async function requireClient(req: Request, res: Response) {
    const clientId = (req.params as { clientId?: string }).clientId ?? ''
    const client = await clientsRepository.findById(req.tenantId!, clientId)
    if (!client) {
      res.status(404).json(err('NOT_FOUND', 'Client not found'))
      return null
    }
    return client
  }

  router.get('/', (req, res, next) => {
    void (async () => {
      const client = await requireClient(req, res)
      if (!client) return
      const rows = await assessmentsRepository.listForClient(req.tenantId!, client.id)
      res.json(ok({ assessments: rows.map(toAssessmentDto) }))
    })().catch(next)
  })

  router.get('/current', (req, res, next) => {
    void (async () => {
      const client = await requireClient(req, res)
      if (!client) return
      const row = await assessmentsRepository.findCurrent(req.tenantId!, client.id)
      if (!row) {
        res.status(404).json(err('NOT_FOUND', 'No assessment yet'))
        return
      }
      res.json(ok({ assessment: toAssessmentDto(row) }))
    })().catch(next)
  })

  router.post('/', (req, res, next) => {
    void (async () => {
      const client = await requireClient(req, res)
      if (!client) return
      const row = await assessmentsRepository.createDraft(req.tenantId!, client.id, client.clientType)
      res.status(201).json(ok({ assessment: toAssessmentDto(row) }))
    })().catch(next)
  })

  router.get('/:id', (req, res, next) => {
    void (async () => {
      const client = await requireClient(req, res)
      if (!client) return
      const row = await assessmentsRepository.findById(req.tenantId!, req.params.id)
      if (!row || row.clientId !== client.id) {
        res.status(404).json(err('NOT_FOUND', 'Assessment not found'))
        return
      }
      res.json(ok({ assessment: toAssessmentDto(row) }))
    })().catch(next)
  })

  router.get('/:id/targets', (req, res, next) => {
    void (async () => {
      const client = await requireClient(req, res)
      if (!client) return
      const targets = await assessmentsRepository.findTargets(req.tenantId!, req.params.id)
      if (!targets || targets.clientId !== client.id) {
        res.status(404).json(err('NOT_FOUND', 'No approved targets'))
        return
      }
      res.json(ok({ targets: toTargetsDto(targets) }))
    })().catch(next)
  })

  router.patch('/:id', (req, res, next) => {
    void (async () => {
      const client = await requireClient(req, res)
      if (!client) return
      const parsed = assessmentDraftSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid assessment draft', parsed.error.flatten()))
        return
      }
      const existing = await assessmentsRepository.findById(req.tenantId!, req.params.id)
      if (!existing || existing.clientId !== client.id) {
        res.status(404).json(err('NOT_FOUND', 'Assessment not found'))
        return
      }
      const row = await assessmentsRepository.updateDraft(req.tenantId!, req.params.id, parsed.data)
      if (!row) {
        res.status(409).json(err('CONFLICT', 'Assessment is no longer editable'))
        return
      }
      res.json(ok({ assessment: toAssessmentDto(row) }))
    })().catch(next)
  })

  router.post('/:id/finish-with-ai', (req, res, next) => {
    void (async () => {
      const client = await requireClient(req, res)
      if (!client) return
      const row = await assessmentsRepository.findById(req.tenantId!, req.params.id)
      if (!row || row.clientId !== client.id) {
        res.status(404).json(err('NOT_FOUND', 'Assessment not found'))
        return
      }
      try {
        const result = await finishWithAi(req.tenantId!, row)
        res.json(ok(result))
      } catch (e) {
        if (e instanceof ServiceError) {
          res.status(statusForCode(e.code)).json(err(e.code, e.message))
          return
        }
        throw e
      }
    })().catch(next)
  })

  router.post('/:id/approve', (req, res, next) => {
    void (async () => {
      const client = await requireClient(req, res)
      if (!client) return
      const parsed = approveTargetsSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid targets', parsed.error.flatten()))
        return
      }
      const row = await assessmentsRepository.findById(req.tenantId!, req.params.id)
      if (!row || row.clientId !== client.id) {
        res.status(404).json(err('NOT_FOUND', 'Assessment not found'))
        return
      }
      try {
        const { targets } = await approveAssessment(req.tenantId!, row, req.tenantId!, parsed.data)
        const updated = await assessmentsRepository.findById(req.tenantId!, row.id)
        res.json(ok({ targets, assessment: updated ? toAssessmentDto(updated) : null }))
      } catch (e) {
        if (e instanceof ServiceError) {
          res.status(statusForCode(e.code)).json(err(e.code, e.message))
          return
        }
        throw e
      }
    })().catch(next)
  })

  router.delete('/:id', (req, res, next) => {
    void (async () => {
      const client = await requireClient(req, res)
      if (!client) return
      const existing = await assessmentsRepository.findById(req.tenantId!, req.params.id)
      if (!existing || existing.clientId !== client.id) {
        res.status(404).json(err('NOT_FOUND', 'Assessment not found'))
        return
      }
      await assessmentsRepository.discard(req.tenantId!, req.params.id)
      res.json(ok({ success: true }))
    })().catch(next)
  })

  return router
}
