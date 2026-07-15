import type { AuthUser } from '@kyb/shared'

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUser {}

    interface Request {
      /** Derived from the session by requireAuth; scopes every tenant query. */
      tenantId?: string
    }
  }
}

export {}
