import { Router } from 'express'
import {
  clientCreateInputSchema,
  clientUpdateInputSchema,
  CLIENT_TYPES,
  err,
  ok,
  type ClientListQuery,
  type ClientType,
} from '@kyb/shared'
import { clientsRepository, toClientDto } from './repository'

/**
 * Clients CRUD router. Mounted at `/api/v1/clients` behind `requireAuth`, so
 * `req.tenantId` is always populated. Every handler scopes to that tenant;
 * unknown or other-tenant ids resolve to 404 (never 403) because the repository
 * filters on `activeForTenant`.
 */
export function createClientsRouter(): Router {
  const router = Router()

  router.post('/', (req, res, next) => {
    void (async () => {
      const parsed = clientCreateInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid client details', parsed.error.flatten()))
        return
      }
      const row = await clientsRepository.create(req.tenantId!, parsed.data)
      res.status(201).json(ok({ client: toClientDto(row) }))
    })().catch(next)
  })

  router.get('/', (req, res, next) => {
    void (async () => {
      const q: ClientListQuery = {}
      const search = req.query.search
      if (typeof search === 'string' && search.trim()) q.search = search.trim()
      const type = req.query.type
      if (typeof type === 'string' && type) {
        if (!(CLIENT_TYPES as readonly string[]).includes(type)) {
          res.status(400).json(err('VALIDATION_ERROR', 'Invalid client type filter'))
          return
        }
        q.type = type as ClientType
      }
      const rows = await clientsRepository.list(req.tenantId!, q)
      res.json(ok({ clients: rows.map(toClientDto) }))
    })().catch(next)
  })

  router.get('/:id', (req, res, next) => {
    void (async () => {
      const row = await clientsRepository.findById(req.tenantId!, req.params.id)
      if (!row) {
        res.status(404).json(err('NOT_FOUND', 'Client not found'))
        return
      }
      res.json(ok({ client: toClientDto(row) }))
    })().catch(next)
  })

  router.patch('/:id', (req, res, next) => {
    void (async () => {
      const parsed = clientUpdateInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid client details', parsed.error.flatten()))
        return
      }
      const row = await clientsRepository.update(req.tenantId!, req.params.id, parsed.data)
      if (!row) {
        res.status(404).json(err('NOT_FOUND', 'Client not found'))
        return
      }
      res.json(ok({ client: toClientDto(row) }))
    })().catch(next)
  })

  router.delete('/:id', (req, res, next) => {
    void (async () => {
      const deleted = await clientsRepository.softDelete(req.tenantId!, req.params.id)
      if (!deleted) {
        res.status(404).json(err('NOT_FOUND', 'Client not found'))
        return
      }
      res.json(ok({ success: true }))
    })().catch(next)
  })

  return router
}
