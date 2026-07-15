import { describe, it, expect } from 'vitest'
import { loginInputSchema, passwordSchema, registerInputSchema } from './auth'

describe('auth input schemas', () => {
  it('accepts a valid registration', () => {
    const result = registerInputSchema.safeParse({
      email: 'dietitian@example.com',
      password: 'a-strong-passphrase',
      fullName: 'Dr. Sarah Wilson',
    })
    expect(result.success).toBe(true)
  })

  it('rejects passwords shorter than 10 characters', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false)
    expect(passwordSchema.safeParse('exactlyten').success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = registerInputSchema.safeParse({
      email: 'not-an-email',
      password: 'a-strong-passphrase',
      fullName: 'X',
    })
    expect(result.success).toBe(false)
  })

  it('login requires a non-empty password', () => {
    expect(loginInputSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
    expect(loginInputSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })
})
