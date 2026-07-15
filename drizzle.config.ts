import { defineConfig } from 'drizzle-kit'

// In dev, `npm run db:push` syncs the schema to your Replit Postgres. For prod,
// `db:generate` + `db:migrate` (forward-only) is the path (ADR-000 §11).
export default defineConfig({
  schema: './apps/server/src/db/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})
