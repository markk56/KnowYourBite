import { useTranslation } from 'react-i18next'
import type { AssessmentField, AssessmentSection, LocalizedText } from '@kyb/shared'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type UiLocale = 'en' | 'hu' | 'ro'

function useLocale(): UiLocale {
  const { i18n } = useTranslation()
  const code = (i18n.language || 'en').slice(0, 2)
  return code === 'hu' || code === 'ro' ? code : 'en'
}

const tx = (l: LocalizedText, locale: UiLocale) => l[locale]

interface FieldProps {
  field: AssessmentField
  locale: UiLocale
  value: string
  onChange: (field: AssessmentField, value: string) => void
  disabled?: boolean
}

function FieldControl({ field, locale, value, onChange, disabled }: FieldProps) {
  const id = `af-${field.key}`
  const label = tx(field.label, locale)
  const placeholder = field.placeholder ? tx(field.placeholder, locale) : undefined

  const control = (() => {
    switch (field.kind) {
      case 'textarea':
        return (
          <Textarea
            id={id}
            rows={3}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(field, e.target.value)}
          />
        )
      case 'select':
        return (
          <Select id={id} value={value} disabled={disabled} onChange={(e) => onChange(field, e.target.value)}>
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
                aria-pressed={value === String(n)}
                onClick={() => onChange(field, value === String(n) ? '' : String(n))}
                className={cn(
                  'h-9 w-9 rounded-md border text-sm font-medium transition-colors',
                  value === String(n)
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
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(field, e.target.value)}
              className="max-w-40"
            />
            {field.unit && <span className="text-sm text-muted-foreground">{field.unit}</span>}
          </div>
        )
      case 'time':
        return (
          <Input
            id={id}
            type="time"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(field, e.target.value)}
            className="max-w-40"
          />
        )
      default:
        return (
          <Input
            id={id}
            value={value}
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
  getValue: (field: AssessmentField) => string
  onChange: (field: AssessmentField, value: string) => void
  disabled?: boolean
}

/** Schema-driven renderer: turns the `@kyb/shared` field registry into a form. */
export function FormEngine({ sections, getValue, onChange, disabled }: FormEngineProps) {
  const locale = useLocale()

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
              {(section.fields ?? []).map((f) => (
                <FieldControl
                  key={f.key}
                  field={f}
                  locale={locale}
                  value={getValue(f)}
                  onChange={onChange}
                  disabled={disabled}
                />
              ))}

              {(section.subgroups ?? []).map((group) => (
                <fieldset key={group.key} className="rounded-lg border border-border/70 p-4">
                  <legend className="px-1 text-sm font-medium text-muted-foreground">
                    {tx(group.label, locale)}
                  </legend>
                  <div className="space-y-4">
                    {group.fields.map((f) => (
                      <FieldControl
                        key={f.key}
                        field={f}
                        locale={locale}
                        value={getValue(f)}
                        onChange={onChange}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
