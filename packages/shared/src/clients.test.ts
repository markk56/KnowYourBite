import { describe, it, expect } from 'vitest'
import { clientCreateInputSchema, clientUpdateInputSchema } from './clients'

describe('client create schema', () => {
  it('accepts a minimal valid client', () => {
    const result = clientCreateInputSchema.safeParse({ fullName: 'Jane Doe', clientType: 'standard' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty full name', () => {
    expect(clientCreateInputSchema.safeParse({ fullName: '', clientType: 'standard' }).success).toBe(false)
    expect(clientCreateInputSchema.safeParse({ fullName: '   ', clientType: 'standard' }).success).toBe(
      false,
    )
  })

  it('rejects an unknown client type', () => {
    expect(clientCreateInputSchema.safeParse({ fullName: 'Jane', clientType: 'vip' }).success).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(
      clientCreateInputSchema.safeParse({ fullName: 'Jane', clientType: 'sports', email: 'nope' }).success,
    ).toBe(false)
  })

  it('coerces empty optional text fields to undefined', () => {
    const result = clientCreateInputSchema.safeParse({
      fullName: 'Jane',
      clientType: 'standard',
      email: '',
      phone: '',
      notes: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeUndefined()
      expect(result.data.phone).toBeUndefined()
      expect(result.data.notes).toBeUndefined()
    }
  })

  it('rejects a malformed clientSince and accepts an ISO date', () => {
    expect(
      clientCreateInputSchema.safeParse({ fullName: 'Jane', clientType: 'standard', clientSince: '2026/07/15' })
        .success,
    ).toBe(false)
    expect(
      clientCreateInputSchema.safeParse({ fullName: 'Jane', clientType: 'standard', clientSince: '2026-07-15' })
        .success,
    ).toBe(true)
  })
})

describe('client update schema', () => {
  it('accepts an empty patch (all fields optional)', () => {
    expect(clientUpdateInputSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a completed assessment status', () => {
    expect(clientUpdateInputSchema.safeParse({ assessmentStatus: 'completed' }).success).toBe(true)
  })

  it('rejects assessment statuses outside the M1 subset', () => {
    expect(clientUpdateInputSchema.safeParse({ assessmentStatus: 'ai_proposed' }).success).toBe(false)
  })
})
