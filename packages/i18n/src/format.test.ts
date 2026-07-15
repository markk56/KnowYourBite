import { describe, it, expect } from 'vitest'
import { formatNumber, formatPercent } from './format'

describe('format helpers', () => {
  it('formats numbers deterministically in en-US', () => {
    expect(formatNumber('en-US', 1234.5)).toBe('1,234.5')
  })

  it('formats percents', () => {
    expect(formatPercent('en-US', 0.86)).toBe('86%')
    expect(formatPercent('en-US', 0.865, 1)).toBe('86.5%')
  })

  it('produces locale-specific output', () => {
    // Node 20 ships full ICU; hu-HU groups/decimals differ from en-US.
    expect(formatNumber('hu-HU', 1234.5)).not.toBe(formatNumber('en-US', 1234.5))
  })
})
