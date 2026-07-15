import { z } from 'zod'

/** Password policy (min length; strength rules can tighten later). */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200, 'Password is too long')

export const registerInputSchema = z.object({
  email: z.string().email('Enter a valid email').max(320),
  password: passwordSchema,
  fullName: z.string().min(1, 'Name is required').max(200),
})

export const loginInputSchema = z.object({
  email: z.string().email('Enter a valid email').max(320),
  password: z.string().min(1, 'Password is required'),
})

export type RegisterInput = z.infer<typeof registerInputSchema>
export type LoginInput = z.infer<typeof loginInputSchema>

/** The shape of the authenticated user shared between server session and client. */
export interface AuthUser {
  id: string
  email: string
  fullName: string
  emailVerified: boolean
}
