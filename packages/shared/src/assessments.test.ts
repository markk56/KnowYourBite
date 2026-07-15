import { describe, it, expect } from 'vitest'
import {
  aiAssessmentProposalSchema,
  approveTargetsSchema,
  assessmentDraftSchema,
  ASSESSMENT_SECTIONS,
  hbInputsSchema,
  sectionsForType,
} from './assessments'

describe('assessment field registry', () => {
  it('standard sees the shared sections but not the sports-only ones', () => {
    const standard = sectionsForType('standard').map((s) => s.id)
    expect(standard).toContain('basics')
    expect(standard).toContain('goals')
    expect(standard).not.toContain('training')
    expect(standard).not.toContain('supplements')
  })

  it('sports = standard sections + the three extra sports sections', () => {
    const standard = sectionsForType('standard')
    const sports = sectionsForType('sports')
    expect(sports.length).toBe(standard.length + 3)
    const sportsIds = sports.map((s) => s.id)
    expect(sportsIds).toEqual(expect.arrayContaining(['training', 'supplements', 'composition']))
  })

  it('captures the five Harris–Benedict inputs as first-class bound fields', () => {
    const binds = ASSESSMENT_SECTIONS.flatMap((s) => s.fields ?? [])
      .map((f) => f.bind)
      .filter(Boolean)
    expect(binds.sort()).toEqual(['activityFactor', 'ageYears', 'heightCm', 'sex', 'weightKg'])
  })

  it('every field/option carries all three locales', () => {
    for (const section of ASSESSMENT_SECTIONS) {
      const fields = [...(section.fields ?? []), ...(section.subgroups ?? []).flatMap((g) => g.fields)]
      for (const f of fields) {
        expect(f.label.en && f.label.hu && f.label.ro).toBeTruthy()
        for (const o of f.options ?? []) expect(o.label.en && o.label.hu && o.label.ro).toBeTruthy()
      }
    }
  })
})

describe('hbInputsSchema', () => {
  it('accepts plausible inputs and rejects out-of-range ones', () => {
    expect(
      hbInputsSchema.safeParse({ sex: 'male', ageYears: 30, heightCm: 180, weightKg: 80, activityFactor: 1.375 })
        .success,
    ).toBe(true)
    expect(hbInputsSchema.safeParse({ sex: 'male', ageYears: 30, heightCm: 180, weightKg: 5, activityFactor: 1.375 }).success).toBe(
      false,
    )
    expect(hbInputsSchema.safeParse({ sex: 'other', ageYears: 30, heightCm: 180, weightKg: 80, activityFactor: 1.375 }).success).toBe(
      false,
    )
  })
})

describe('assessmentDraftSchema', () => {
  it('accepts an empty draft (half-filled anamnesis is valid)', () => {
    expect(assessmentDraftSchema.safeParse({}).success).toBe(true)
  })

  it('accepts partial HB inputs + free-form payload', () => {
    const parsed = assessmentDraftSchema.safeParse({
      weightKg: 72,
      payload: { diseases: 'none', energyLevel: 7, breakfast: 'oats' },
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects an oversized payload value', () => {
    expect(assessmentDraftSchema.safeParse({ payload: { notes: 'x'.repeat(6000) } }).success).toBe(false)
  })
})

describe('aiAssessmentProposalSchema', () => {
  it('defaults focusAreas and requires prose', () => {
    const parsed = aiAssessmentProposalSchema.parse({
      summary: 'Balanced maintenance profile.',
      calorieAdjustmentPercent: -15,
      rationale: 'Modest deficit for gradual fat loss.',
    })
    expect(parsed.focusAreas).toEqual([])
  })

  it('rejects malformed output missing required prose', () => {
    expect(aiAssessmentProposalSchema.safeParse({ calorieAdjustmentPercent: -15 }).success).toBe(false)
  })
})

describe('approveTargetsSchema', () => {
  it('requires a decision provenance and sane numbers', () => {
    expect(
      approveTargetsSchema.safeParse({
        targetKcal: 2100,
        proteinG: 130,
        carbsG: 220,
        fatG: 65,
        decisionSummary: 'edited',
      }).success,
    ).toBe(true)
    expect(
      approveTargetsSchema.safeParse({ targetKcal: 2100, proteinG: 130, carbsG: 220, fatG: 65 }).success,
    ).toBe(false)
  })
})
