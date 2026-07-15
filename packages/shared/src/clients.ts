import { z } from 'zod'

/**
 * Clients / CRM contract (Milestone 1). Pure Zod + DTO types shared by the
 * server router and the web client so the wire format cannot drift. No server
 * imports here — this module runs in the browser bundle too.
 */

export const CLIENT_TYPES = ['standard', 'sports'] as const
export type ClientType = (typeof CLIENT_TYPES)[number]

// M1 subset of the canonical assessment_status enum (extended in M2).
export const ASSESSMENT_STATUSES = ['unfinished', 'completed'] as const
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Empty form field ('' | null) → undefined so optional text stays optional. */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  )

export const clientCreateInputSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(200),
  email: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().trim().email('Enter a valid email').max(320).optional(),
  ),
  phone: optionalText(40),
  clientType: z.enum(CLIENT_TYPES),
  clientSince: z.string().regex(ISO_DATE, 'Invalid date').optional(),
  notes: optionalText(5000),
})

export const clientUpdateInputSchema = clientCreateInputSchema
  .partial()
  .extend({ assessmentStatus: z.enum(ASSESSMENT_STATUSES).optional() })

export type ClientCreateInput = z.infer<typeof clientCreateInputSchema>
export type ClientUpdateInput = z.infer<typeof clientUpdateInputSchema>

/** Wire DTO the API returns (camelCase; tenantId/deletedAt omitted). */
export interface ClientDto {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  clientType: ClientType
  clientSince: string // 'YYYY-MM-DD'
  assessmentStatus: AssessmentStatus
  avatarUrl: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientListQuery {
  search?: string
  type?: ClientType
}
