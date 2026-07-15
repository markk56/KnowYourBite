import type { RequestHandler } from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { getPool } from '../db/client'
import { getEnv } from '../config/env'

/**
 * Postgres-backed session middleware (connect-pg-simple; memorystore is banned).
 * Cookies are HttpOnly + SameSite=Lax, and Secure in production (behind the
 * Replit TLS proxy, with `trust proxy` set on the app).
 */
export function createSessionMiddleware(): RequestHandler {
  const env = getEnv()
  const PgStore = connectPgSimple(session)

  return session({
    name: 'kyb.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new PgStore({
      pool: getPool(),
      tableName: 'user_sessions',
      createTableIfMissing: true,
    }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
}
