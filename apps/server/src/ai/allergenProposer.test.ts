import { describe, it, expect } from 'vitest'
import { MalformedAllergenProposalError, parseAllergenProposal } from './allergenProposer'

describe('parseAllergenProposal', () => {
  it('accepts a well-formed additive proposal', () => {
    const proposal = parseAllergenProposal({ additions: ['milk', 'soy'], rationale: 'contains cheese and tofu' })
    expect(proposal.additions).toEqual(['milk', 'soy'])
  })

  it('drops any removals field structurally (additive-only)', () => {
    const proposal = parseAllergenProposal({ additions: ['eggs'], removals: ['gluten'], rationale: '' })
    expect(proposal).not.toHaveProperty('removals')
  })

  it('defaults additions to empty', () => {
    expect(parseAllergenProposal({ rationale: 'nothing to add' }).additions).toEqual([])
  })

  it('rejects an unknown allergen', () => {
    expect(() => parseAllergenProposal({ additions: ['fish'], rationale: '' })).toThrow(
      MalformedAllergenProposalError,
    )
  })

  it('rejects a non-object', () => {
    expect(() => parseAllergenProposal(null)).toThrow(MalformedAllergenProposalError)
  })
})
