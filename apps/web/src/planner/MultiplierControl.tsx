import { SERVING_MULTIPLIERS, type ServingMultiplier } from '@kyb/shared'
import { cn } from '@/lib/utils'

/**
 * The ONLY control that changes a recipe entry's magnitude — a segmented control
 * bound to the fixed allowed set {1, 1.25, 1.5, 2}. There is deliberately no free
 * numeric input and no way to reach an ingredient gram (recipe integrity).
 */
export function MultiplierControl({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number
  onChange: (m: ServingMultiplier) => void
  disabled?: boolean
  label: string
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border border-border"
      role="group"
      aria-label={label}
    >
      {SERVING_MULTIPLIERS.map((m) => {
        const active = Math.abs(value - m) < 1e-9
        return (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m)}
            aria-pressed={active}
            className={cn(
              'px-2 py-0.5 text-xs font-medium tabular-nums transition-colors disabled:opacity-50',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            ×{m}
          </button>
        )
      })}
    </div>
  )
}
