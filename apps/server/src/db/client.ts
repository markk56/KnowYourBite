import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import { getEnv } from '../config/env'
import * as schema from './schema'

// Neon serverless needs a WebSocket constructor in Node.
neonConfig.webSocketConstructor = ws

let pool: Pool | undefined
let db: NeonDatabase<typeof schema> | undefined

/** Pooled Neon connection (bounded `max` for the single-VM process). */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getEnv().DATABASE_URL, max: 3 })
  }
  return pool
}

/** Drizzle client bound to the full schema. */
export function getDb(): NeonDatabase<typeof schema> {
  if (!db) {
    db = drizzle(getPool(), { schema })
  }
  return db
}
