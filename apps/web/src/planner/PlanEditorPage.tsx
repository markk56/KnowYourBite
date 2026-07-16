import { useState } from 'react'
import { Link, useParams } from 'wouter'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, Clock, GripVertical, Plus, Trash2, Utensils } from 'lucide-react'
import type {
  MealEntryDto,
  MealExtraDto,
  MealPlanDayDto,
  MealPlanDto,
  MealWindowDto,
  ServingMultiplier,
} from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  useAddEntry,
  useAddExtra,
  useAddWindow,
  useMealPlan,
  useRemoveEntry,
  useRemoveExtra,
  useRemoveWindow,
  useUpdateEntry,
} from './queries'
import { MultiplierControl } from './MultiplierControl'
import { NutritionDashboard } from './NutritionDashboard'
import { RecipePalette } from './RecipePalette'
import { AddExtraDialog } from './AddExtraDialog'

// ── dnd-kit id helpers ──────────────────────────────────────────────────────
const entryDragId = (entryId: string) => `entry:${entryId}`
const windowDropId = (windowId: string) => `window:${windowId}`

type DragData =
  | { kind: 'palette'; recipeId: string; title: string }
  | { kind: 'entry'; entryId: string; windowId: string }
  | { kind: 'window'; windowId: string }

function resolveWindowId(data: DragData | undefined): string | null {
  if (!data) return null
  if (data.kind === 'window') return data.windowId
  if (data.kind === 'entry') return data.windowId
  return null
}

// ── Entry card (sortable) ────────────────────────────────────────────────────
function EntryCard({
  entry,
  windowId,
  planId,
}: {
  entry: MealEntryDto
  windowId: string
  planId: string
}) {
  const { t, i18n } = useTranslation()
  const updateEntry = useUpdateEntry(planId)
  const removeEntry = useRemoveEntry(planId)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entryDragId(entry.id),
    data: { kind: 'entry', entryId: entry.id, windowId } satisfies DragData,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const fmt = new Intl.NumberFormat(i18n.language)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        'rounded-lg border border-border bg-background p-2.5',
        isDragging && 'opacity-40',
        entry.recipeMissing && 'border-destructive/50',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...listeners}
          aria-label={t('planner.entry.drag')}
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{entry.recipeTitle}</p>
          <p className="text-xs text-muted-foreground">
            {entry.recipeMissing
              ? t('planner.entry.missing')
              : t('planner.entry.kcal', { kcal: fmt.format(entry.contribution.kcal) })}
          </p>
          {entry.allergens.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {entry.allergens.map((a) => (
                <span key={a} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {t(`recipes.allergen.${a}`)}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => removeEntry.mutate(entry.id)}
          disabled={removeEntry.isPending}
          aria-label={t('planner.entry.remove')}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <MultiplierControl
          value={entry.servingMultiplier}
          disabled={entry.recipeMissing || updateEntry.isPending}
          label={t('planner.entry.multiplier')}
          onChange={(m: ServingMultiplier) =>
            updateEntry.mutate({ entryId: entry.id, patch: { servingMultiplier: m } })
          }
        />
      </div>
    </div>
  )
}

// ── Extra card (static, not draggable) ───────────────────────────────────────
function ExtraCard({ extra, planId }: { extra: MealExtraDto; planId: string }) {
  const { t, i18n } = useTranslation()
  const removeExtra = useRemoveExtra(planId)
  const fmt = new Intl.NumberFormat(i18n.language)
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-2.5">
      <Utensils className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{extra.canonicalNameEn}</p>
        <p className="text-xs text-muted-foreground">
          {fmt.format(extra.gramsResolved)} g · {t('planner.entry.kcal', { kcal: fmt.format(extra.contribution.kcal) })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => removeExtra.mutate(extra.id)}
        disabled={removeExtra.isPending}
        aria-label={t('planner.entry.remove')}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Window column (droppable) ────────────────────────────────────────────────
function WindowColumn({
  win,
  planId,
  onAddExtra,
}: {
  win: MealWindowDto
  planId: string
  onAddExtra: (windowId: string, windowName: string) => void
}) {
  const { t, i18n } = useTranslation()
  const removeWindow = useRemoveWindow(planId)
  const { setNodeRef, isOver } = useDroppable({
    id: windowDropId(win.id),
    data: { kind: 'window', windowId: win.id } satisfies DragData,
  })
  const fmt = new Intl.NumberFormat(i18n.language)
  const entryIds = win.entries.map((e) => entryDragId(e.id))

  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{win.name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {win.timeOfDay && (
              <>
                <Clock className="h-3 w-3" aria-hidden />
                {win.timeOfDay}
                <span aria-hidden>·</span>
              </>
            )}
            {fmt.format(win.nutrition.kcal)} kcal
          </p>
        </div>
        <button
          type="button"
          onClick={() => removeWindow.mutate(win.id)}
          disabled={removeWindow.isPending}
          aria-label={t('planner.window.remove')}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'min-h-24 flex-1 space-y-2 p-2.5 transition-colors',
          isOver && 'bg-primary/5 ring-1 ring-inset ring-primary/40',
        )}
      >
        <SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
          {win.entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} windowId={win.id} planId={planId} />
          ))}
        </SortableContext>
        {win.extras.map((extra) => (
          <ExtraCard key={extra.id} extra={extra} planId={planId} />
        ))}
        {win.entries.length === 0 && win.extras.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">{t('planner.window.dropHint')}</p>
        )}
      </div>

      <div className="border-t border-border p-2">
        <Button variant="ghost" size="sm" className="w-full" onClick={() => onAddExtra(win.id, win.name)}>
          <Plus className="h-4 w-4" />
          {t('planner.window.addFood')}
        </Button>
      </div>
    </div>
  )
}

// ── Add-window inline form ────────────────────────────────────────────────────
function AddWindowCard({ planId, dayId }: { planId: string; dayId: string }) {
  const { t } = useTranslation()
  const addWindow = useAddWindow(planId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [time, setTime] = useState('')

  const submit = () => {
    if (!name.trim()) return
    addWindow.mutate(
      { dayId, name: name.trim(), ...(time ? { timeOfDay: time } : {}) },
      {
        onSuccess: () => {
          setName('')
          setTime('')
          setOpen(false)
        },
      },
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-72 flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        {t('planner.window.add')}
      </button>
    )
  }

  return (
    <div className="w-72 flex-shrink-0 space-y-2 rounded-xl border border-primary/40 bg-card p-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('planner.window.namePlaceholder')}
        aria-label={t('planner.window.name')}
      />
      <Input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        aria-label={t('planner.window.time')}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={addWindow.isPending || !name.trim()}>
          {t('planner.window.create')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          {t('planner.create.cancel')}
        </Button>
      </div>
    </div>
  )
}

// ── The board for one day ─────────────────────────────────────────────────────
function DayBoard({
  day,
  planId,
  onAddExtra,
}: {
  day: MealPlanDayDto
  planId: string
  onAddExtra: (windowId: string, windowName: string) => void
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {day.windows.map((win) => (
        <WindowColumn key={win.id} win={win} planId={planId} onAddExtra={onAddExtra} />
      ))}
      <AddWindowCard planId={planId} dayId={day.id} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function PlanEditorPage() {
  const { t, i18n } = useTranslation()
  const params = useParams<{ id: string }>()
  const planId = params.id ?? ''
  const { data: plan, isPending, isError } = useMealPlan(planId)

  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [activeDrag, setActiveDrag] = useState<{ title: string } | null>(null)
  const [extraTarget, setExtraTarget] = useState<{ windowId: string; windowName: string } | null>(null)

  const addEntry = useAddEntry(planId)
  const updateEntry = useUpdateEntry(planId)
  const addExtra = useAddExtra(planId)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeDay = plan?.days.find((d) => d.dayIndex === activeDayIndex) ?? plan?.days[0]

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined
    if (data?.kind === 'palette') setActiveDrag({ title: data.title })
    else if (data?.kind === 'entry') {
      const dto = findEntry(plan, data.entryId)
      setActiveDrag({ title: dto?.recipeTitle ?? '' })
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return
    const activeData = active.data.current as DragData | undefined
    const overData = over.data.current as DragData | undefined
    const targetWindowId = resolveWindowId(overData)
    if (!activeData || !targetWindowId) return

    if (activeData.kind === 'palette') {
      addEntry.mutate({ windowId: targetWindowId, recipeId: activeData.recipeId, servingMultiplier: 1 })
      return
    }
    if (activeData.kind === 'entry') {
      if (targetWindowId !== activeData.windowId) {
        // Move to another window (server appends to the end).
        updateEntry.mutate({ entryId: activeData.entryId, patch: { windowId: targetWindowId } })
      } else if (overData?.kind === 'entry' && overData.entryId !== activeData.entryId) {
        void reorderWithinWindow(targetWindowId, activeData.entryId, overData.entryId)
      }
    }
  }

  /** Reindex a window's entries after a within-window drag (sequential sortOrder patches). */
  const reorderWithinWindow = async (windowId: string, activeEntryId: string, overEntryId: string) => {
    const window = activeDay?.windows.find((w) => w.id === windowId)
    if (!window) return
    const ids = window.entries.map((e) => e.id)
    const from = ids.indexOf(activeEntryId)
    const to = ids.indexOf(overEntryId)
    if (from === -1 || to === -1) return
    const next = arrayMove(ids, from, to)
    // Patch only entries whose position changed (sequential — each returns the full plan).
    for (let i = 0; i < next.length; i++) {
      if (next[i] !== ids[i]) {
        await updateEntry.mutateAsync({ entryId: next[i]!, patch: { sortOrder: i } })
      }
    }
  }

  if (isPending) return <p className="text-muted-foreground">{t('planner.loading')}</p>
  if (isError || !plan) return <p className="text-destructive">{t('planner.loadError')}</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/planner" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t('planner.editor.back')}
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{plan.title}</h2>
          <p className="text-sm text-muted-foreground">
            {plan.clientName} · {t(`planner.period.${plan.period}`)} · {t(`planner.status.${plan.status}`)}
          </p>
        </div>
      </div>

      {plan.period === 'week' && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('planner.editor.days')}>
          {plan.days.map((day) => (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={day.dayIndex === activeDayIndex}
              onClick={() => setActiveDayIndex(day.dayIndex)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                day.dayIndex === activeDayIndex
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50',
              )}
            >
              {t('planner.editor.day', { n: day.dayIndex + 1 })}
            </button>
          ))}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[16rem_1fr_16rem]">
          <aside className="order-2 lg:order-1 lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)] rounded-xl border border-border bg-card p-4">
            <RecipePalette />
          </aside>

          <main className="order-1 min-w-0 lg:order-2">
            {activeDay ? (
              <DayBoard
                day={activeDay}
                planId={plan.id}
                onAddExtra={(windowId, windowName) => setExtraTarget({ windowId, windowName })}
              />
            ) : (
              <p className="text-muted-foreground">{t('planner.editor.noDays')}</p>
            )}
          </main>

          <aside className="order-3 lg:sticky lg:top-4 space-y-5">
            <div className="rounded-xl border border-border bg-card p-4">
              {activeDay && (
                <NutritionDashboard
                  nutrition={activeDay.nutrition}
                  comparison={activeDay.targetComparison}
                  labelKey="planner.dashboard.dayTitle"
                />
              )}
            </div>
            {plan.period === 'week' && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('planner.dashboard.weekTitle')}
                </p>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('planner.dashboard.weekTotal')}</dt>
                    <dd className="tabular-nums text-foreground">
                      {new Intl.NumberFormat(i18n.language).format(plan.total.kcal)} kcal
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('planner.dashboard.dayAverage')}</dt>
                    <dd className="tabular-nums text-foreground">
                      {new Intl.NumberFormat(i18n.language).format(plan.perDayAverage.kcal)} kcal
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </aside>
        </div>

        <DragOverlay>
          {activeDrag ? (
            <div className="rounded-lg border border-primary bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg">
              {activeDrag.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AddExtraDialog
        open={extraTarget != null}
        windowId={extraTarget?.windowId ?? null}
        windowName={extraTarget?.windowName ?? ''}
        isAdding={addExtra.isPending}
        onClose={() => setExtraTarget(null)}
        onAdd={(input) => {
          addExtra.mutate(input, { onSuccess: () => setExtraTarget(null) })
        }}
      />
    </div>
  )
}

function findEntry(plan: MealPlanDto | undefined, entryId: string): MealEntryDto | undefined {
  for (const day of plan?.days ?? []) {
    for (const w of day.windows) {
      const e = w.entries.find((x) => x.id === entryId)
      if (e) return e
    }
  }
  return undefined
}
