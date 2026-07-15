import { describe, it, expect } from 'vitest'
import { MalformedProposalError, parseProposal } from './assessmentProposer'
import { assertNoDirectIdentifiers, PseudonymizationError } from './pseudonymize'

describe('parseProposal (server-side re-validation)', () => {
  it('accepts a well-formed proposal and clamps the percentage into the safe band', () => {
    const p = parseProposal({
      summary: 'Balanced maintenance profile with good sleep.',
      calorieAdjustmentPercent: -55, // out of band
      rationale: 'Aggressive request clamped to the safe floor.',
      focusAreas: ['protein variety'],
    })
    expect(p.calorieAdjustmentPercent).toBe(-30)
    expect(p.focusAreas).toEqual(['protein variety'])
  })

  it('rejects malformed output (never persisted)', () => {
    expect(() => parseProposal({ calorieAdjustmentPercent: -10 })).toThrow(MalformedProposalError)
    expect(() => parseProposal('not an object')).toThrow(MalformedProposalError)
    expect(() => parseProposal(null)).toThrow(MalformedProposalError)
  })

  it('attaches the raw output to the rejection for auditing', () => {
    const raw = { calorieAdjustmentPercent: 999 }
    try {
      parseProposal(raw)
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(MalformedProposalError)
      expect((e as MalformedProposalError).rawOutput).toBe(raw)
    }
  })
})

describe('assertNoDirectIdentifiers (fail-closed)', () => {
  it('passes a clinical payload through unchanged', () => {
    const payload = { diseases: 'none', energyLevel: 7, breakfast: 'oats' }
    expect(assertNoDirectIdentifiers(payload)).toBe(payload)
  })

  it('throws if a payload key looks like a direct identifier', () => {
    expect(() => assertNoDirectIdentifiers({ fullName: 'Jane' })).toThrow(PseudonymizationError)
    expect(() => assertNoDirectIdentifiers({ email: 'a@b.co' })).toThrow(PseudonymizationError)
    expect(() => assertNoDirectIdentifiers({ phoneNumber: '123' })).toThrow(PseudonymizationError)
  })
})
