import { describe, it, expect } from 'vitest'
import { extractProposals } from './plannerProposer'

const ENTRY = '11111111-1111-1111-1111-111111111111'
const WINDOW = '22222222-2222-2222-2222-222222222222'

describe('extractProposals — propose-only, contract-enforced', () => {
  it('concatenates text blocks into the reply', () => {
    const { reply, proposals } = extractProposals([
      { type: 'text', text: 'Your dinner is a bit low on protein. ' },
      { type: 'text', text: 'Consider bumping the chicken.' },
    ])
    expect(reply).toBe('Your dinner is a bit low on protein. Consider bumping the chicken.')
    expect(proposals).toEqual([])
  })

  it('accepts a valid setServingMultiplier tool call', () => {
    const { proposals } = extractProposals([
      {
        type: 'tool_use',
        name: 'setServingMultiplier',
        input: { entryId: ENTRY, servingMultiplier: 1.5, rationale: 'more protein' },
      },
    ])
    expect(proposals).toHaveLength(1)
    expect(proposals[0]).toMatchObject({ tool: 'setServingMultiplier', entryId: ENTRY, servingMultiplier: 1.5 })
  })

  it('accepts a valid addExtraFood tool call', () => {
    const { proposals } = extractProposals([
      {
        type: 'tool_use',
        name: 'addExtraFood',
        input: { windowId: WINDOW, foodQuery: 'greek yogurt', amount: 150, unit: 'g', rationale: 'protein' },
      },
    ])
    expect(proposals).toHaveLength(1)
    expect(proposals[0]).toMatchObject({ tool: 'addExtraFood', windowId: WINDOW, foodQuery: 'greek yogurt' })
  })

  it('drops a multiplier outside the allowed set', () => {
    const { proposals } = extractProposals([
      {
        type: 'tool_use',
        name: 'setServingMultiplier',
        input: { entryId: ENTRY, servingMultiplier: 1.3, rationale: 'x' },
      },
    ])
    expect(proposals).toEqual([])
  })

  it('drops an unknown tool name (out of contract)', () => {
    const { proposals } = extractProposals([
      {
        type: 'tool_use',
        name: 'setIngredientGrams',
        input: { ingredientId: 'x', grams: 200 },
      },
    ])
    expect(proposals).toEqual([])
  })

  it('drops a call missing a required field', () => {
    const { proposals } = extractProposals([
      { type: 'tool_use', name: 'addExtraFood', input: { windowId: WINDOW, amount: 100 } },
    ])
    expect(proposals).toEqual([])
  })

  it('keeps valid proposals alongside a reply and drops invalid ones', () => {
    const { reply, proposals } = extractProposals([
      { type: 'text', text: 'Two suggestions:' },
      { type: 'tool_use', name: 'setServingMultiplier', input: { entryId: ENTRY, servingMultiplier: 2, rationale: 'a' } },
      { type: 'tool_use', name: 'deleteRecipe', input: { recipeId: 'x' } },
    ])
    expect(reply).toBe('Two suggestions:')
    expect(proposals).toHaveLength(1)
    expect(proposals[0]!.tool).toBe('setServingMultiplier')
  })
})
