import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { err, loginInputSchema, ok, registerInputSchema, type AuthUser } from '@kyb/shared'
import { getDb } from '../db/client'
import { users } from '../db/schema'
import { requireAuth } from '../middleware/tenant'
import { hashPassword } from './password'
import { passport } from './passport'

export function createAuthRouter(): Router {
  const router = Router()

  // Create a professional account. tenant_id = the new user's own id.
  router.post('/register', (req, res, next) => {
    void (async () => {
      const parsed = registerInputSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json(err('VALIDATION_ERROR', 'Invalid registration details', parsed.error.flatten()))
        return
      }

      const email = parsed.data.email.toLowerCase()
      const db = getDb()
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
      if (existing) {
        res.status(409).json(err('CONFLICT', 'An account with this email already exists'))
        return
      }

      const id = uuidv7()
      const passwordHash = await hashPassword(parsed.data.password)
      await db.insert(users).values({ id, tenantId: id, email, passwordHash, fullName: parsed.data.fullName })

      const user: AuthUser = { id, email, fullName: parsed.data.fullName, emailVerified: false }
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr)
        res.status(201).json(ok({ user }))
      })
    })().catch(next)
  })

  router.post('/login', (req, res, next) => {
    const parsed = loginInputSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json(err('VALIDATION_ERROR', 'Invalid credentials'))
      return
    }

    passport.authenticate('local', (authErr: unknown, user?: Express.User | false | null) => {
      if (authErr) return next(authErr)
      if (!user) {
        res.status(401).json(err('UNAUTHENTICATED', 'Invalid email or password'))
        return
      }
      // Regenerate the session id on login to prevent fixation.
      req.session.regenerate((regenErr) => {
        if (regenErr) return next(regenErr)
        req.login(user, (loginErr) => {
          if (loginErr) return next(loginErr)
          res.json(ok({ user }))
        })
      })
    })(req, res, next)
  })

  router.post('/logout', (req, res, next) => {
    req.logout((logoutErr) => {
      if (logoutErr) return next(logoutErr)
      req.session.destroy(() => {
        res.clearCookie('kyb.sid')
        res.json(ok({ success: true }))
      })
    })
  })

  router.get('/me', requireAuth, (req, res) => {
    res.json(ok({ user: req.user }))
  })

  return router
}
