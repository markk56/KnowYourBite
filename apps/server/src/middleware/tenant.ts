import type { NextFunction, Request, Response } from 'express'
import { err, type AuthUser } from '@kyb/shared'

/**
 * Gate + tenant derivation. The tenant id is taken ONLY from the authenticated
 * session (never from client input). Every downstream query scopes to it
 * (ADR-000 §3). Unauthenticated requests get 401; cross-tenant access to a
 * scoped resource must resolve to 404 in the handlers, not 403.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user) {
    req.tenantId = (req.user as AuthUser).id
    next()
    return
  }
  res.status(401).json(err('UNAUTHENTICATED', 'Authentication required'))
}
