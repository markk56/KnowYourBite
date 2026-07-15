import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { eq } from 'drizzle-orm'
import type { AuthUser } from '@kyb/shared'
import { getDb } from '../db/client'
import { users, type UserRow } from '../db/schema'
import { verifyPassword } from './password'

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    emailVerified: row.emailVerifiedAt !== null,
  }
}

passport.use(
  new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, (email, password, done) => {
    void (async () => {
      try {
        const db = getDb()
        const [row] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1)
        if (!row) return done(null, false)
        const valid = await verifyPassword(row.passwordHash, password)
        if (!valid) return done(null, false)
        return done(null, toAuthUser(row))
      } catch (error) {
        return done(error)
      }
    })()
  }),
)

passport.serializeUser((user, done) => {
  done(null, (user as AuthUser).id)
})

passport.deserializeUser((id, done) => {
  void (async () => {
    try {
      const db = getDb()
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, String(id)))
        .limit(1)
      if (!row) return done(null, false)
      done(null, toAuthUser(row))
    } catch (error) {
      done(error)
    }
  })()
})

export { passport }
