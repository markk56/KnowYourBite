import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { sectionsForType, type AssessmentField } from '@kyb/shared'
import '@/i18n'
import { FormEngine } from './FormEngine'

function renderEngine(type: 'standard' | 'sports', values: Record<string, unknown> = {}, onChange = vi.fn()) {
  const getValue = (f: AssessmentField) => values[f.bind ?? f.key] ?? ''
  const valueForKey = (key: string) => values[key]
  render(
    <FormEngine
      sections={sectionsForType(type)}
      getValue={getValue}
      onChange={onChange}
      valueForKey={valueForKey}
    />,
  )
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

  it("hides the women's-health block unless the client is female", () => {
    renderEngine('standard', { sex: 'male' })
    expect(screen.queryByText("Women's health")).not.toBeInTheDocument()
  })

  it("shows the women's-health block for a female client", () => {
    renderEngine('standard', { sex: 'female' })
    expect(screen.getByText("Women's health")).toBeInTheDocument()
    expect(screen.getByText('PMS symptoms')).toBeInTheDocument()
  })

  it('reveals the allergen checklist only after a "yes"', () => {
    renderEngine('standard')
    expect(screen.queryByText('Gluten')).not.toBeInTheDocument()
  })

  it('lists allergen chips once the yes/no is true', () => {
    const { onChange } = renderEngine('standard', { foodAllergyHas: true })
    fireEvent.click(screen.getByRole('button', { name: 'Gluten' }))
    const [field, value] = onChange.mock.calls.at(-1)!
    expect(field.key).toBe('foodAllergyItems')
    expect(value).toEqual({ selected: ['gluten'], other: undefined })
  })

  it('emits a structured frequency row when an item chip is toggled', () => {
    const { onChange } = renderEngine('standard')
    fireEvent.click(screen.getByRole('button', { name: 'Coffee' }))
    const [field, value] = onChange.mock.calls.at(-1)!
    expect(field.key).toBe('consumptionFrequency')
    expect(value).toEqual([{ item: 'coffee', times: null, period: 'week', custom: false }])
  })

  it('emits a quantity+unit answer for daily water', () => {
    const { onChange } = renderEngine('standard')
    const inputs = screen.getAllByLabelText('How much water per day?')
    fireEvent.change(inputs[0]!, { target: { value: '2' } })
    const [field, value] = onChange.mock.calls.at(-1)!
    expect(field.key).toBe('waterIntake')
    expect(value).toEqual({ value: 2, unit: 'glass' })
  })

  it('renders the 24h recall rows with a time picker', () => {
    const { onChange } = renderEngine('standard')
    fireEvent.change(screen.getByLabelText('Breakfast — Time'), { target: { value: '07:30' } })
    const [field, value] = onChange.mock.calls.at(-1)!
    expect(field.key).toBe('breakfast')
    expect(value).toEqual({ time: '07:30', text: '' })
  })
})
