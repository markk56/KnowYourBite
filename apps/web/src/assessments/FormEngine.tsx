import { useTranslation } from 'react-i18next'
import type {
  AssessmentField,
  AssessmentPayloadValue,
  AssessmentSection,
  FoodPreferenceCategory,
  LocalizedText,
  VisibleIf,
} from '@kyb/shared'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  FrequencyControl,
  MultiSelectControl,
  QuantityUnitControl,
  RepeaterControl,
  TimedTextControl,
  YesNoControl,
  type UiLocale,
} from './controls'

function useLocale(): UiLocale {
  const { i18n } = useTranslation()
  const code = (i18n.language || 'en').slice(0, 2)
  return code === 'hu' || code === 'ro' ? code : 'en'
}

const tx = (l: LocalizedText, locale: UiLocale) => l[locale]

/** English unit codes from the registry that need localized display text. */
const UNIT_TEXT: Record<string, LocalizedText> = {
  yr: { en: 'yr', hu: 'év', ro: 'ani' },
  days: { en: 'days', hu: 'nap', ro: 'zile' },
}
const unitText = (unit: string, locale: UiLocale) => {
  const localized = UNIT_TEXT[unit]
  return localized ? tx(localized, locale) : unit
}

/** Simple inputs render whatever primitive is stored; structured values fall back to ''. */
const asText = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''

interface FieldProps {
  field: AssessmentField
  locale: UiLocale
  value: unknown
  onChange: (field: AssessmentField, value: AssessmentPayloadValue) => void
  disabled?: boolean
  /** Nomenclator labels per category (mealPicker); undefined while loading. */
  foodOptions?: Partial<Record<FoodPreferenceCategory, string[]>>
}

function FieldControl({ field, locale, value, onChange, disabled, foodOptions }: FieldProps) {
  const id = `af-${field.key}`
  const label = tx(field.label, locale)
  const placeholder = field.placeholder ? tx(field.placeholder, locale) : undefined
  const emit = (v: AssessmentPayloadValue) => onChange(field, v)
  const str = asText(value)

  const composite = (() => {
    switch (field.kind) {
      case 'yesno':
        return <YesNoControl field={field} locale={locale} value={value} onChange={emit} disabled={disabled} />
      case 'multiselect':
        return <MultiSelectControl field={field} locale={locale} value={value} onChange={emit} disabled={disabled} />
      case 'mealPicker': {
        const options = field.nomenclatorCategory ? foodOptions?.[field.nomenclatorCategory] : []
        return (
          <MultiSelectControl
            field={field}
            locale={locale}
            value={value}
            onChange={emit}
            disabled={disabled}
            stringOptions={options ?? []}
            loading={foodOptions === undefined}
          />
        )
      }
      case 'quantityUnit':
        return <QuantityUnitControl field={field} locale={locale} value={value} onChange={emit} disabled={disabled} />
      case 'timedText':
        return <TimedTextControl field={field} locale={locale} value={value} onChange={emit} disabled={disabled} />
      case 'repeater':
        return <RepeaterControl field={field} locale={locale} value={value} onChange={emit} disabled={disabled} />
      case 'frequency':
        return <FrequencyControl field={field} locale={locale} value={value} onChange={emit} disabled={disabled} />
      default:
        return null
    }
  })()

  if (composite) {
    return (
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {field.placeholder && field.kind === 'repeater' && (
          <p className="text-xs text-muted-foreground">{placeholder}</p>
        )}
        {composite}
      </div>
    )
  }

  const control = (() => {
    switch (field.kind) {
      case 'textarea':
        return (
          <Textarea
            id={id}
            rows={3}
            value={str}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(field, e.target.value)}
          />
        )
      case 'select':
        return (
          <Select id={id} value={str} disabled={disabled} onChange={(e) => onChange(field, e.target.value)}>
            <option value="">—</option>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {tx(o.label, locale)}
              </option>
            ))}
          </Select>
        )
      case 'scale': {
        const min = field.scaleMin ?? 1
        const max = field.scaleMax ?? 10
        const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i)
        return (
          <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
            {nums.map((n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                aria-pressed={str === String(n)}
                onClick={() => onChange(field, str === String(n) ? '' : String(n))}
                className={cn(
                  'h-9 w-9 rounded-md border text-sm font-medium transition-colors',
                  str === String(n)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-foreground hover:bg-muted',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        )
      }
      case 'number':
        return (
          <div className="flex items-center gap-2">
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              value={str}
              disabled={disabled}
              onChange={(e) => onChange(field, e.target.value)}
              className="max-w-40"
            />
            {field.unit && <span className="text-sm text-muted-foreground">{unitText(field.unit, locale)}</span>}
          </div>
        )
      case 'time':
        return (
          <Input
            id={id}
            type="time"
            value={str}
            disabled={disabled}
            onChange={(e) => onChange(field, e.target.value)}
            className="max-w-40"
          />
        )
      case 'date':
        return (
          <Input
            id={id}
            type="date"
            value={str}
            disabled={disabled}
            onChange={(e) => onChange(field, e.target.value)}
            className="max-w-40"
          />
        )
      default:
        return (
          <Input
            id={id}
            value={str}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(field, e.target.value)}
          />
        )
    }
  })()

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {control}
    </div>
  )
}

interface FormEngineProps {
  sections: AssessmentSection[]
  getValue: (field: AssessmentField) => unknown
  onChange: (field: AssessmentField, value: AssessmentPayloadValue) => void
  disabled?: boolean
  /** Resolve any answer by key ('sex' or a payload key) for `visibleIf` conditions. */
  valueForKey?: (key: string) => unknown
  foodOptions?: Partial<Record<FoodPreferenceCategory, string[]>>
}

/** Schema-driven renderer: turns the `@kyb/shared` field registry into a form. */
export function FormEngine({ sections, getValue, onChange, disabled, valueForKey, foodOptions }: FormEngineProps) {
  const locale = useLocale()

  const isVisible = (cond?: VisibleIf): boolean => {
    if (!cond) return true
    if (!valueForKey) return true
    return valueForKey(cond.key) === cond.equals
  }

  const renderField = (f: AssessmentField) =>
    isVisible(f.visibleIf) ? (
      <FieldControl
        key={f.key}
        field={f}
        locale={locale}
        value={getValue(f)}
        onChange={onChange}
        disabled={disabled}
        foodOptions={foodOptions}
      />
    ) : null

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.id} className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
            <span aria-hidden>{section.icon}</span>
            {tx(section.title, locale)}
          </h3>

          {section.note ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{tx(section.note, locale)}</p>
          ) : (
            <div className="space-y-4">
              {(section.fields ?? []).map(renderField)}

              {(section.subgroups ?? [])
                .filter((group) => isVisible(group.visibleIf))
                .map((group) => (
                  <fieldset key={group.key} className="rounded-lg border border-border/70 p-4">
                    <legend className="px-1 text-sm font-medium text-muted-foreground">
                      {tx(group.label, locale)}
                    </legend>
                    <div className="space-y-4">{group.fields.map(renderField)}</div>
                  </fieldset>
                ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
