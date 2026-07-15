import { serverEnvSchema, type ServerEnv } from '@kyb/shared'

/**
 * Boot-time environment validation (M0.5). Reads process.env through the shared
 * schema and exits(1) with a precise message if anything required is missing or
 * invalid — a fail-fast contract, not a runtime surprise. Memoized so repeated
 * calls are cheap.
 */
let cached: ServerEnv | undefined

export function getEnv(): ServerEnv {
  if (cached) return cached

  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('✗ Invalid or missing environment configuration:\n')
    for (const issue of parsed.error.issues) {
      console.error(`  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
    console.error('\nSee .env.example, set the required secrets, then restart.')
    process.exit(1)
  }

  cached = parsed.data
  return cached
}
