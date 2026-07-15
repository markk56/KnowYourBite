import { z } from 'zod'

/**
 * Server environment contract. Parsed once at boot (apps/server/src/config/env.ts)
 * so a missing/invalid secret crashes loudly and immediately (M0.5, fail-fast).
 * Kept as a pure schema here (no `process` access) so it is trivially testable.
 *
 * Required-but-not-yet-wired vars (DATABASE_URL) are already declared so the
 * contract is stable; features that need ANTHROPIC/USDA keys validate them when
 * they ship (M2/M3).
 */

const optionalString = z
  .string()
  .optional()
  .transform((v) => v ?? '')

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Required. On Replit, DATABASE_URL is provisioned by the PostgreSQL module.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  // Optional until their feature ships; rejected only when clearly wrong.
  ANTHROPIC_API_KEY: optionalString,
  USDA_API_KEY: z
    .string()
    .refine((v) => v !== 'DEMO_KEY', 'USDA_API_KEY must not be the shared "DEMO_KEY"')
    .optional()
    .transform((v) => v ?? ''),

  SENTRY_DSN: z
    .union([z.string().url(), z.literal('')])
    .optional()
    .transform((v) => v ?? ''),

  APP_URL: z.string().url().default('http://localhost:5000'),
  PORT: z.coerce.number().int().positive().default(5000),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

/** Parse an arbitrary source (usually process.env). Throws a ZodError on failure. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(source)
}
