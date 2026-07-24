import { describe, it, expect } from 'vitest'
import { formatPayloadValue, MalformedProposalError, parseProposal } from './assessmentProposer'
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

describe('formatPayloadValue (structured answers → prompt prose)', () => {
  it('passes primitives through', () => {
    expect(formatPayloadValue('none')).toBe('none')
    expect(formatPayloadValue(7)).toBe('7')
    expect(formatPayloadValue(true)).toBe('true')
  })

  it('renders selections, quantities and timed entries readably', () => {
    expect(formatPayloadValue({ selected: ['gluten', 'lactose'], other: 'kiwi' })).toBe(
      'gluten, lactose, other: kiwi',
    )
    expect(formatPayloadValue({ value: 2, unit: 'l' })).toBe('2 l')
    expect(formatPayloadValue({ time: '07:30', text: 'oats' })).toBe('07:30 — oats')
  })

  it('renders repeater/frequency rows as compact tuples', () => {
    expect(
      formatPayloadValue([
        { treatment: 'appendectomy', date: '2019-04-02' },
        { treatment: '', date: null }, // empty row is skipped
      ]),
    ).toBe('(treatment: appendectomy, date: 2019-04-02)')
    expect(formatPayloadValue([{ item: 'coffee', times: 2, period: 'day' }])).toBe(
      '(item: coffee, times: 2, period: day)',
    )
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
