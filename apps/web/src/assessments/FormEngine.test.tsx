import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { sectionsForType, type AssessmentField } from '@kyb/shared'
import '@/i18n'
import { FormEngine } from './FormEngine'

function renderEngine(type: 'standard' | 'sports', onChange = vi.fn()) {
  const values: Record<string, string> = {}
  const getValue = (f: AssessmentField) => values[f.bind ?? f.key] ?? ''
  render(<FormEngine sections={sectionsForType(type)} getValue={getValue} onChange={onChange} />)
  return { onChange }
}

describe('FormEngine (schema-driven renderer)', () => {
  it('renders shared sections for a standard assessment but not the sports-only ones', () => {
    renderEngine('standard')
    expect(screen.getByText('Basic data')).toBeInTheDocument()
    expect(screen.getByText('Motivation & goals')).toBeInTheDocument()
    expect(screen.queryByText('Training characteristics')).not.toBeInTheDocument()
  })

  it('adds the sports sections for a sports assessment', () => {
    renderEngine('sports')
    expect(screen.getByText('Training characteristics')).toBeInTheDocument()
    expect(screen.getByText('Supplements & hydration')).toBeInTheDocument()
    expect(screen.getByText('Body-composition goals')).toBeInTheDocument()
  })

  it('emits onChange for a bound field (weight)', () => {
    const { onChange } = renderEngine('standard')
    fireEvent.change(screen.getByLabelText('Body weight'), { target: { value: '82' } })
    expect(onChange).toHaveBeenCalled()
    const [field, value] = onChange.mock.calls.at(-1)!
    expect(field.bind).toBe('weightKg')
    expect(value).toBe('82')
  })

  it('emits onChange when a 1–10 scale value is clicked', () => {
    const { onChange } = renderEngine('standard')
    // Energy level scale renders buttons 1..10 inside a labelled group.
    const group = screen.getByRole('group', { name: 'Daily energy level (1–10)' })
    fireEvent.click(within(group).getByText('7'))
    const [field, value] = onChange.mock.calls.at(-1)!
    expect(field.key).toBe('energyLevel')
    expect(value).toBe('7')
  })
})
