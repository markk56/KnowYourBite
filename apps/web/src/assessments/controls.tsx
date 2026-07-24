import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import {
  FREQUENCY_PERIODS,
  isEntryRowArray,
  isQuantityValue,
  isSelectionValue,
  isTimedTextValue,
  type AssessmentField,
  type AssessmentPayloadValue,
  type EntryRow,
  type LocalizedText,
  type QuantityValue,
  type RepeaterColumn,
  type SelectionValue,
  type TimedTextValue,
} from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/**
 * Composite anamnesis controls (chips, repeating rows, frequency pickers…).
 * Every control tolerates ANY stored value shape — a legacy free-text answer for
 * a reworked question renders sensibly instead of crashing — and emits only the
 * bounded structured shapes declared in `@kyb/shared`.
 */

export type UiLocale = 'en' | 'hu' | 'ro'
const tx = (l: LocalizedText, locale: UiLocale) => l[locale]

export interface ControlProps {
  field: AssessmentField
  locale: UiLocale
  value: unknown
  onChange: (value: AssessmentPayloadValue) => void
  disabled?: boolean
}

// ── Shared chip button ───────────────────────────────────────────────────────

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-primary bg-primary font-medium text-primary-foreground'
          : 'border-input bg-background text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

// ── Yes / No ─────────────────────────────────────────────────────────────────

export function YesNoControl({ value, onChange, disabled }: ControlProps) {
  const { t } = useTranslation()
  const current = typeof value === 'boolean' ? value : null
  const pick = (v: boolean) => onChange(current === v ? null : v)
  return (
    <div className="flex gap-2">
      <Chip active={current === true} disabled={disabled} onClick={() => pick(true)}>
        {t('assessments.engine.yes')}
      </Chip>
      <Chip active={current === false} disabled={disabled} onClick={() => pick(false)}>
        {t('assessments.engine.no')}
      </Chip>
    </div>
  )
}

// ── Multi-select chips (+ optional free-text "other") ────────────────────────

function asSelection(value: unknown): SelectionValue {
  if (isSelectionValue(value)) return value
  // Legacy free-text answer → keep it visible in the "other" slot.
  if (typeof value === 'string' && value.trim() !== '') return { selected: [], other: value }
  return { selected: [], other: undefined }
}

/** Chips from static localized options, or plain-string options (meal picker). */
export function MultiSelectControl({
  field,
  locale,
  value,
  onChange,
  disabled,
  stringOptions,
  loading,
}: ControlProps & { stringOptions?: string[]; loading?: boolean }) {
  const { t } = useTranslation()
  const sel = asSelection(value)

  // Options: static registry chips (value≠label) or nomenclator labels (value=label).
  const chips: { value: string; label: string }[] = stringOptions
    ? stringOptions.map((s) => ({ value: s, label: s }))
    : (field.options ?? []).map((o) => ({ value: o.value, label: tx(o.label, locale) }))
  // Previously ticked entries that were since removed from the nomenclator stay visible.
  const known = new Set(chips.map((c) => c.value))
  const extra = sel.selected.filter((s) => !known.has(s)).map((s) => ({ value: s, label: s }))
  const all = [...chips, ...extra]

  const toggle = (v: string) => {
    const selected = sel.selected.includes(v) ? sel.selected.filter((s) => s !== v) : [...sel.selected, v]
    onChange({ ...sel, selected })
  }
  const otherActive = sel.other != null
  const toggleOther = () => onChange({ ...sel, other: otherActive ? undefined : '' })

  if (loading) return <p className="text-sm text-muted-foreground">{t('assessments.engine.loading')}</p>

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {all.map((c) => (
          <Chip key={c.value} active={sel.selected.includes(c.value)} disabled={disabled} onClick={() => toggle(c.value)}>
            {c.label}
          </Chip>
        ))}
        {(field.allowOther || stringOptions) && (
          <Chip active={otherActive} disabled={disabled} onClick={toggleOther}>
            {t('assessments.engine.other')}
          </Chip>
        )}
      </div>
      {otherActive && (
        <Input
          value={sel.other ?? ''}
          disabled={disabled}
          placeholder={t('assessments.engine.otherPlaceholder')}
          aria-label={t('assessments.engine.other')}
          onChange={(e) => onChange({ ...sel, other: e.target.value })}
        />
      )}
    </div>
  )
}

// ── Quantity + unit (e.g. daily water) ───────────────────────────────────────

function asQuantity(value: unknown, defaultUnit: string): QuantityValue {
  if (isQuantityValue(value)) return value
  if (typeof value === 'number') return { value, unit: defaultUnit }
  return { value: null, unit: defaultUnit }
}

export function QuantityUnitControl({ field, locale, value, onChange, disabled }: ControlProps) {
  const units = field.options ?? []
  const q = asQuantity(value, units[0]?.value ?? '')
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        value={q.value ?? ''}
        disabled={disabled}
        aria-label={tx(field.label, locale)}
        onChange={(e) => onChange({ ...q, value: e.target.value === '' ? null : Number(e.target.value) })}
        className="max-w-28"
      />
      <Select
        value={q.unit}
        disabled={disabled}
        aria-label={tx(field.label, locale)}
        onChange={(e) => onChange({ ...q, unit: e.target.value })}
        className="max-w-40"
      >
        {units.map((u) => (
          <option key={u.value} value={u.value}>
            {tx(u.label, locale)}
          </option>
        ))}
      </Select>
    </div>
  )
}

// ── Timed text (24h recall row: when + what) ─────────────────────────────────

function asTimedText(value: unknown): TimedTextValue {
  if (isTimedTextValue(value)) return value
  if (typeof value === 'string') return { time: '', text: value }
  return { time: '', text: '' }
}

export function TimedTextControl({ field, locale, value, onChange, disabled }: ControlProps) {
  const { t } = useTranslation()
  const v = asTimedText(value)
  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        value={v.time}
        disabled={disabled}
        aria-label={`${tx(field.label, locale)} — ${t('assessments.engine.time')}`}
        onChange={(e) => onChange({ ...v, time: e.target.value })}
        className="max-w-32"
      />
      <Input
        value={v.text}
        disabled={disabled}
        aria-label={tx(field.label, locale)}
        placeholder={field.placeholder ? tx(field.placeholder, locale) : undefined}
        onChange={(e) => onChange({ ...v, text: e.target.value })}
        className="flex-1"
      />
    </div>
  )
}

// ── Repeater (dynamic rows, e.g. surgeries: text → date reveals) ─────────────

function asRows(value: unknown, columns: RepeaterColumn[]): EntryRow[] {
  if (isEntryRowArray(value)) return value
  // Legacy free-text answer → seed the first row's text column.
  if (typeof value === 'string' && value.trim() !== '') {
    const firstText = columns.find((c) => c.kind === 'text')
    if (firstText) return [{ [firstText.key]: value }]
  }
  return []
}

const cellFilled = (row: EntryRow, key: string | undefined): boolean =>
  !key || String(row[key] ?? '').trim() !== ''

// Client-side row identity for React keys (never persisted into the payload).
let nextRepeaterRowId = 0

export function RepeaterControl({ field, locale, value, onChange, disabled }: ControlProps) {
  const { t } = useTranslation()
  const columns = field.columns ?? []
  const rows = asRows(value, columns)
  // Always present at least one editable row — no "add" click before typing.
  const display: EntryRow[] = rows.length > 0 ? rows : [{}]

  // Stable keys per visual row so removing a row doesn't re-associate the
  // following rows' focus/input state with the wrong DOM nodes.
  const rowIds = useRef<number[]>([])
  while (rowIds.current.length < display.length) rowIds.current.push(++nextRepeaterRowId)
  if (rowIds.current.length > display.length) rowIds.current.length = display.length

  const setCell = (idx: number, key: string, cell: string | number | null) => {
    const next = display.map((r, i) => {
      if (i !== idx) return r
      const updated = { ...r, [key]: cell }
      // Clearing a trigger cell also clears (and re-hides) its dependent cells,
      // so no orphaned hidden values persist or reach the AI prompt.
      if (cell == null || String(cell).trim() === '') {
        for (const col of columns) if (col.showWhenFilled === key) delete updated[col.key]
      }
      return updated
    })
    onChange(next)
  }
  const removeRow = (idx: number) => {
    rowIds.current = rowIds.current.filter((_, i) => i !== idx)
    onChange(display.filter((_, i) => i !== idx))
  }
  const addRow = () => onChange([...display, {}])

  return (
    <div className="space-y-2">
      {display.map((row, idx) => (
        <div key={rowIds.current[idx]} className="flex items-center gap-2">
          {columns.map((col) => {
            if (col.showWhenFilled && !cellFilled(row, col.showWhenFilled)) return null
            const raw = row[col.key]
            const str = raw == null ? '' : String(raw)
            const label = tx(col.label, locale)
            if (col.kind === 'date') {
              return (
                <Input
                  key={col.key}
                  type="date"
                  value={str}
                  disabled={disabled}
                  aria-label={label}
                  onChange={(e) => setCell(idx, col.key, e.target.value)}
                  className="max-w-40"
                />
              )
            }
            if (col.kind === 'number') {
              return (
                <span key={col.key} className="flex items-center gap-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={str}
                    disabled={disabled}
                    aria-label={label}
                    placeholder={label}
                    onChange={(e) => setCell(idx, col.key, e.target.value === '' ? null : Number(e.target.value))}
                    className="w-24"
                  />
                  {col.unit && <span className="text-sm text-muted-foreground">{col.unit}</span>}
                </span>
              )
            }
            return (
              <Input
                key={col.key}
                value={str}
                disabled={disabled}
                aria-label={label}
                placeholder={col.placeholder ? tx(col.placeholder, locale) : label}
                onChange={(e) => setCell(idx, col.key, e.target.value)}
                className="flex-1"
              />
            )
          })}
          {(display.length > 1 || cellFilled(row, columns[0]?.key)) && (
            <button
              type="button"
              disabled={disabled}
              aria-label={t('assessments.engine.removeRow')}
              onClick={() => removeRow(idx)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addRow}>
        <Plus className="h-4 w-4" />
        {t('assessments.engine.addRow')}
      </Button>
    </div>
  )
}

// ── Frequency (pick items → each gets times × day/week/month/other) ──────────

// Intersection (not `interface extends`): optional props would violate the
// inherited string index signature of EntryRow under strict mode (TS2411).
type FrequencyRow = EntryRow & {
  item: string
  times: number | null
  period: string
  note?: string | null
  custom?: boolean
}

function asFrequencyRows(value: unknown): FrequencyRow[] {
  // Legacy free-text answer → keep it visible (and preserved) as a custom row.
  if (typeof value === 'string' && value.trim() !== '') {
    return [{ item: value, times: null, period: 'other', note: null, custom: true }]
  }
  if (!isEntryRowArray(value)) return []
  return value
    .filter((r) => typeof r.item === 'string' && r.item !== '')
    .map((r) => ({
      item: String(r.item),
      times: typeof r.times === 'number' ? r.times : null,
      period: typeof r.period === 'string' ? r.period : 'week',
      note: typeof r.note === 'string' ? r.note : null,
      custom: r.custom === true,
    }))
}

export function FrequencyControl({ field, locale, value, onChange, disabled }: ControlProps) {
  const { t } = useTranslation()
  const [draftItem, setDraftItem] = useState('')
  const rows = asFrequencyRows(value)
  const options = field.options ?? []
  const optionLabel = (item: string) => {
    const opt = options.find((o) => o.value === item)
    return opt ? tx(opt.label, locale) : item
  }

  const emit = (next: FrequencyRow[]) => onChange(next as EntryRow[])
  const toggle = (item: string, custom = false) => {
    if (rows.some((r) => r.item === item)) emit(rows.filter((r) => r.item !== item))
    else emit([...rows, { item, times: null, period: 'week', custom }])
  }
  const patchRow = (item: string, patch: Partial<FrequencyRow>) =>
    emit(rows.map((r) => (r.item === item ? { ...r, ...patch } : r)))
  const addCustom = () => {
    const name = draftItem.trim()
    if (name === '' || rows.some((r) => r.item === name)) return
    emit([...rows, { item: name, times: null, period: 'week', custom: true }])
    setDraftItem('')
  }

  const customRows = rows.filter((r) => r.custom && !options.some((o) => o.value === r.item))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o.value} active={rows.some((r) => r.item === o.value)} disabled={disabled} onClick={() => toggle(o.value)}>
            {tx(o.label, locale)}
          </Chip>
        ))}
        {customRows.map((r) => (
          <Chip key={r.item} active disabled={disabled} onClick={() => toggle(r.item, true)}>
            {r.item}
          </Chip>
        ))}
      </div>

      {field.allowCustomItems && (
        <div className="flex gap-2">
          <Input
            value={draftItem}
            disabled={disabled}
            placeholder={t('assessments.engine.customItemPlaceholder')}
            aria-label={t('assessments.engine.customItemPlaceholder')}
            onChange={(e) => setDraftItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
            className="max-w-64"
          />
          <Button type="button" variant="outline" size="sm" disabled={disabled || draftItem.trim() === ''} onClick={addCustom}>
            <Plus className="h-4 w-4" />
            {t('assessments.engine.add')}
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border/70 p-3">
          {rows.map((r) => (
            <div key={r.item} className="flex flex-wrap items-center gap-2">
              <span className="min-w-28 text-sm font-medium text-foreground">{optionLabel(r.item)}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={r.times ?? ''}
                disabled={disabled}
                aria-label={`${optionLabel(r.item)} — ${t('assessments.engine.times')}`}
                onChange={(e) => patchRow(r.item, { times: e.target.value === '' ? null : Number(e.target.value) })}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">×</span>
              <Select
                value={FREQUENCY_PERIODS.includes(r.period as (typeof FREQUENCY_PERIODS)[number]) ? r.period : 'other'}
                disabled={disabled}
                aria-label={`${optionLabel(r.item)} — ${t('assessments.engine.period')}`}
                onChange={(e) => patchRow(r.item, { period: e.target.value })}
                className="w-36"
              >
                <option value="day">{t('assessments.engine.periodDay')}</option>
                <option value="week">{t('assessments.engine.periodWeek')}</option>
                <option value="month">{t('assessments.engine.periodMonth')}</option>
                <option value="other">{t('assessments.engine.periodOther')}</option>
              </Select>
              {r.period === 'other' && (
                <Input
                  value={r.note ?? ''}
                  disabled={disabled}
                  placeholder={t('assessments.engine.periodOtherPlaceholder')}
                  aria-label={`${optionLabel(r.item)} — ${t('assessments.engine.periodOther')}`}
                  onChange={(e) => patchRow(r.item, { note: e.target.value })}
                  className="w-44 flex-1"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
