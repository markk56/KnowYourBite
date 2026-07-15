import { index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { idColumn, softDelete, timestamps } from '../columns'
import { assessmentStatusEnum, clients } from './clients'

/**
 * Assessments cluster (Milestone 2) — the schema-driven anamnesis engine plus the
 * deterministic-↔-AI boundary. `client_assessments` is a versioned envelope: the
 * five Harris–Benedict inputs are first-class columns (deterministic math never
 * parses JSONB), everything else is a Zod-validated `payload`. `Finish with AI`
 * writes `status='ai_proposed'` + an immutable `ai_proposal`; it never writes
 * clinical targets. Only human approval materializes `assessment_targets`.
 */

export const assessmentTypeEnum = pgEnum('assessment_type', ['standard', 'sports'])
export const sexEnum = pgEnum('sex', ['male', 'female'])
export const aiDecisionEnum = pgEnum('ai_decision', ['accepted', 'edited', 'rejected'])
export const aiFeatureEnum = pgEnum('ai_feature', [
  'clinical_narrative',
  'allergen_suggestion',
  'mealplan_chat',
  'patient_friendly',
  'food_translation',
])

export const clientAssessments = pgTable(
  'client_assessments',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(), // 1,2,3… per client
    type: assessmentTypeEnum('type').notNull(),
    status: assessmentStatusEnum('status').notNull().default('unfinished'),

    // Guaranteed Harris–Benedict inputs are FIRST-CLASS columns (ADR D4).
    sex: sexEnum('sex'),
    ageYears: integer('age_years'),
    heightCm: numeric('height_cm', { precision: 5, scale: 1 }),
    weightKg: numeric('weight_kg', { precision: 5, scale: 1 }),
    activityFactor: numeric('activity_factor', { precision: 4, scale: 3 }), // e.g. 1.375

    // Per-type questionnaire answers — validated by a Zod schema in @kyb/shared.
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),

    // Immutable AI proposal (prose + optional bounded calorie suggestion).
    aiProposal: jsonb('ai_proposal'),
    promptVersion: text('prompt_version'),

    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (t) => ({
    tenantIdx: index('assessments_tenant_idx').on(t.tenantId),
    clientIdx: index('assessments_client_idx').on(t.tenantId, t.clientId),
    versionUniq: uniqueIndex('assessments_client_version_uniq').on(t.clientId, t.version),
  }),
)

export const assessmentTargets = pgTable(
  'assessment_targets',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .unique()
      .references(() => clientAssessments.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),

    // Deterministic (@kyb/domain) — Harris–Benedict maintenance TDEE.
    bmrKcal: numeric('bmr_kcal', { precision: 7, scale: 1 }).notNull(),
    maintenanceTdeeKcal: numeric('maintenance_tdee_kcal', { precision: 7, scale: 1 }).notNull(),

    // Final APPROVED targets (human authority). May equal the AI suggestion or be edited.
    targetKcal: numeric('target_kcal', { precision: 7, scale: 1 }).notNull(),
    proteinG: numeric('protein_g', { precision: 6, scale: 1 }).notNull(),
    carbsG: numeric('carbs_g', { precision: 6, scale: 1 }).notNull(),
    fatG: numeric('fat_g', { precision: 6, scale: 1 }).notNull(),

    decisionSummary: aiDecisionEnum('decision_summary').notNull(),
    approvedByUserId: uuid('approved_by_user_id').notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index('targets_tenant_idx').on(t.tenantId),
    clientIdx: index('targets_client_idx').on(t.tenantId, t.clientId),
  }),
)

/**
 * Clinical audit — one row per AI proposal (ADR §6, §12). `system_decision`
 * records machine outcomes (proposed / rejected_malformed / unavailable) so a
 * rejected malformed output is still audited even though it is never persisted as
 * a proposal; `human_decision` is filled in on approval.
 */
export const aiInteractions = pgTable(
  'ai_interactions',
  {
    id: idColumn(),
    tenantId: uuid('tenant_id').notNull(),
    clientId: uuid('client_id'),
    assessmentId: uuid('assessment_id'),
    feature: aiFeatureEnum('feature').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version'),
    inputHash: text('input_hash'),
    rawOutput: jsonb('raw_output'),
    proposedValues: jsonb('proposed_values'),
    systemDecision: text('system_decision'), // proposed | rejected_malformed | unavailable
    humanDecision: aiDecisionEnum('human_decision'),
    finalValues: jsonb('final_values'),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index('ai_interactions_tenant_idx').on(t.tenantId),
    assessmentIdx: index('ai_interactions_assessment_idx').on(t.assessmentId),
  }),
)

export type ClientAssessmentRow = typeof clientAssessments.$inferSelect
export type NewClientAssessmentRow = typeof clientAssessments.$inferInsert
export type AssessmentTargetRow = typeof assessmentTargets.$inferSelect
export type NewAssessmentTargetRow = typeof assessmentTargets.$inferInsert
export type AiInteractionRow = typeof aiInteractions.$inferSelect
export type NewAiInteractionRow = typeof aiInteractions.$inferInsert
