import { describe, it, expect } from 'vitest'
import { parseServerEnv } from './env'

const base = {
  DATABASE_URL: 'postgresql://user:pass@host/db',
  SESSION_SECRET: 'x'.repeat(32),
}

describe('serverEnvSchema', () => {
  it('parses a valid minimal env and applies defaults', () => {
    const env = parseServerEnv(base)
    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(5000)
    expect(env.APP_URL).toBe('http://localhost:5000')
    expect(env.ANTHROPIC_API_KEY).toBe('')
  })

  it('fails when SESSION_SECRET is missing', () => {
    expect(() => parseServerEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow()
  })

  it('fails when SESSION_SECRET is too short', () => {
    expect(() => parseServerEnv({ ...base, SESSION_SECRET: 'short' })).toThrow()
  })

  it('fails when DATABASE_URL is missing', () => {
    expect(() => parseServerEnv({ SESSION_SECRET: base.SESSION_SECRET })).toThrow()
  })

  it('rejects the shared USDA DEMO_KEY', () => {
    expect(() => parseServerEnv({ ...base, USDA_API_KEY: 'DEMO_KEY' })).toThrow(/DEMO_KEY/)
  })

  it('coerces PORT to a number', () => {
    expect(parseServerEnv({ ...base, PORT: '8080' }).PORT).toBe(8080)
  })
})
