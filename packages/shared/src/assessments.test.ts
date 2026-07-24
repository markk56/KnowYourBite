import { describe, it, expect } from 'vitest'
import {
  aiAssessmentProposalSchema,
  approveTargetsSchema,
  assessmentDraftSchema,
  assessmentPayloadSchema,
  ASSESSMENT_SECTIONS,
  hbInputsSchema,
  isEmptyPayloadValue,
  pruneAssessmentPayload,
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

  it('every field/option/column carries all three locales', () => {
    for (const section of ASSESSMENT_SECTIONS) {
      const fields = [...(section.fields ?? []), ...(section.subgroups ?? []).flatMap((g) => g.fields)]
      for (const f of fields) {
        expect(f.label.en && f.label.hu && f.label.ro).toBeTruthy()
        for (const o of f.options ?? []) expect(o.label.en && o.label.hu && o.label.ro).toBeTruthy()
        for (const c of f.columns ?? []) expect(c.label.en && c.label.hu && c.label.ro).toBeTruthy()
      }
    }
  })

  it('orders daily routine before the 24h recall, then meal preferences', () => {
    const ids = sectionsForType('standard').map((s) => s.id)
    expect(ids.indexOf('routine')).toBeGreaterThan(ids.indexOf('eating'))
    expect(ids.indexOf('recall')).toBeGreaterThan(ids.indexOf('routine'))
    expect(ids.indexOf('mealPreferences')).toBe(ids.indexOf('recall') + 1)
  })

  it('dropped the avoided-foods question', () => {
    const keys = ASSESSMENT_SECTIONS.flatMap((s) => [
      ...(s.fields ?? []),
      ...(s.subgroups ?? []).flatMap((g) => g.fields),
    ]).map((f) => f.key)
    expect(keys).not.toContain('avoidedFoods')
    expect(keys).not.toContain('waterGlasses')
    expect(keys).not.toContain('waterLiters')
  })
})

describe('assessmentPayloadSchema (structured values)', () => {
  it('accepts every structured shape alongside primitives', () => {
    const parsed = assessmentPayloadSchema.safeParse({
      diseases: 'none',
      energyLevel: 7,
      foodAllergyHas: true,
      foodAllergyItems: { selected: ['gluten', 'lactose'], other: 'kiwi' },
      waterIntake: { value: 2, unit: 'l' },
      breakfast: { time: '07:30', text: 'oats with fruit' },
      hospitalizations: [{ treatment: 'appendectomy', date: '2019-04-02' }],
      consumptionFrequency: [{ item: 'coffee', times: 2, period: 'day', note: null, custom: false }],
    })
    expect(parsed.success).toBe(true)
  })

  it('keeps legacy free-text answers valid for reworked questions', () => {
    expect(assessmentPayloadSchema.safeParse({ hospitalizations: 'gallbladder 2015' }).success).toBe(true)
  })

  it('rejects unbounded rows', () => {
    const rows = Array.from({ length: 101 }, () => ({ dish: 'soup' }))
    expect(assessmentPayloadSchema.safeParse({ repeatedDishes: rows }).success).toBe(false)
  })
})

describe('isEmptyPayloadValue', () => {
  it('treats blank structured answers as empty', () => {
    expect(isEmptyPayloadValue({ selected: [], other: '' })).toBe(true)
    expect(isEmptyPayloadValue({ value: null, unit: 'l' })).toBe(true)
    expect(isEmptyPayloadValue({ time: '', text: '' })).toBe(true)
    expect(isEmptyPayloadValue([{ treatment: '' }])).toBe(true)
    expect(isEmptyPayloadValue(false)).toBe(false)
    expect(isEmptyPayloadValue({ selected: ['gluten'] })).toBe(false)
  })
})

describe('pruneAssessmentPayload', () => {
  const womens = {
    pmsSymptoms: { selected: ['cramps'] },
    menopauseEntered: true,
    menopauseDate: '2020-01-01',
    menopause: 'legacy answer',
  }

  it('drops all women\'s-health answers for a male client', () => {
    const pruned = pruneAssessmentPayload({ ...womens, diseases: 'none' }, 'male')
    expect(Object.keys(pruned)).toEqual(['diseases'])
  })

  it('keeps women\'s-health answers for a female client', () => {
    const pruned = pruneAssessmentPayload({ ...womens }, 'female')
    expect(pruned.pmsSymptoms).toEqual({ selected: ['cramps'] })
    expect(pruned.menopauseDate).toBe('2020-01-01')
  })

  it('drops the menopause date once the yes/no flips back to no', () => {
    const pruned = pruneAssessmentPayload({ menopauseEntered: false, menopauseDate: '2020-01-01' }, 'female')
    expect(pruned.menopauseDate).toBeUndefined()
    expect(pruned.menopauseEntered).toBe(false)
  })

  it('drops the allergen list when the client has no allergies', () => {
    const pruned = pruneAssessmentPayload(
      { foodAllergyHas: false, foodAllergyItems: { selected: ['gluten'] } },
      'female',
    )
    expect(pruned.foodAllergyItems).toBeUndefined()
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
