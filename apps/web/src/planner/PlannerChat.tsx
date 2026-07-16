import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Send, Sparkles, Utensils, X } from 'lucide-react'
import type {
  IngredientUnit,
  MealPlanDto,
  PlannerChatMessage,
  PlannerProposal,
  ServingMultiplier,
} from '@kyb/shared'
import { Button } from '@/components/ui/button'
import { usePlannerChat } from './queries'

interface Turn {
  role: 'user' | 'assistant'
  content: string
  proposals?: PlannerProposal[]
  unavailable?: boolean
}

/** Look up an entry's recipe title from the current plan (or undefined if stale). */
function entryTitle(plan: MealPlanDto, entryId: string): string | undefined {
  for (const day of plan.days) {
    for (const w of day.windows) {
      const e = w.entries.find((x) => x.id === entryId)
      if (e) return e.recipeTitle
    }
  }
  return undefined
}

function windowName(plan: MealPlanDto, windowId: string): string | undefined {
  for (const day of plan.days) {
    const w = day.windows.find((x) => x.id === windowId)
    if (w) return w.name
  }
  return undefined
}

/**
 * The propose-only planning assistant (slice 4). The dietitian chats; the model may
 * return proposals rendered as Apply buttons that route through the SAME validated
 * mutations used by hand. Nothing is ever auto-applied. A non-streaming request per
 * turn (SSE streaming is a deferred UX enhancement).
 */
export function PlannerChat({
  planId,
  plan,
  onClose,
  onApplyMultiplier,
  onProposeExtra,
}: {
  planId: string
  plan: MealPlanDto
  onClose: () => void
  onApplyMultiplier: (entryId: string, m: ServingMultiplier) => void
  onProposeExtra: (windowId: string, foodQuery: string, amount: number, unit: IngredientUnit) => void
}) {
  const { t } = useTranslation()
  const chat = usePlannerChat(planId)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    })
  }

  const send = () => {
    const text = input.trim()
    if (!text || chat.isPending) return

    // Build a STRICTLY ALTERNATING history from successful exchanges only (the
    // Anthropic API rejects consecutive same-role messages). A failed/unavailable
    // turn drops its user question from the context so roles never double up.
    const history: PlannerChatMessage[] = []
    let pendingUser: string | null = null
    for (const turn of turns) {
      if (turn.role === 'user') {
        pendingUser = turn.content
      } else if (!turn.unavailable && turn.content && pendingUser) {
        history.push({ role: 'user', content: pendingUser })
        history.push({ role: 'assistant', content: turn.content })
        pendingUser = null
      } else {
        pendingUser = null
      }
    }
    history.push({ role: 'user', content: text })

    setTurns((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    scrollToEnd()

    chat.mutate(history, {
      onSuccess: (res) => {
        setTurns((prev) => [
          ...prev,
          res.status === 'unavailable'
            ? { role: 'assistant', content: '', unavailable: true }
            : { role: 'assistant', content: res.reply, proposals: res.proposals },
        ])
        scrollToEnd()
      },
      onError: () => {
        setTurns((prev) => [...prev, { role: 'assistant', content: '', unavailable: true }])
        scrollToEnd()
      },
    })
  }

  const applyKey = (turnIdx: number, propIdx: number) => `${turnIdx}:${propIdx}`

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[380px] flex-col border-l border-border bg-card shadow-xl">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">{t('planner.chat.title')}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('planner.chat.close')}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {turns.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <p>{t('planner.chat.intro')}</p>
            <p className="mt-2 text-xs">{t('planner.chat.disclaimer')}</p>
          </div>
        )}

        {turns.map((turn, turnIdx) =>
          turn.role === 'user' ? (
            <div key={turnIdx} className="ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
              {turn.content}
            </div>
          ) : (
            <div key={turnIdx} className="space-y-2">
              {turn.unavailable ? (
                <p className="text-sm text-muted-foreground">{t('planner.chat.unavailable')}</p>
              ) : (
                <>
                  {turn.content && (
                    <p className="whitespace-pre-wrap text-sm text-foreground">{turn.content}</p>
                  )}
                  {turn.proposals?.map((proposal, propIdx) => (
                    <ProposalCard
                      key={propIdx}
                      plan={plan}
                      proposal={proposal}
                      applied={applied.has(applyKey(turnIdx, propIdx))}
                      onApply={() => {
                        setApplied((prev) => new Set(prev).add(applyKey(turnIdx, propIdx)))
                        if (proposal.tool === 'setServingMultiplier') {
                          onApplyMultiplier(proposal.entryId, proposal.servingMultiplier as ServingMultiplier)
                        } else {
                          onProposeExtra(
                            proposal.windowId,
                            proposal.foodQuery,
                            proposal.amount,
                            proposal.unit,
                          )
                        }
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          ),
        )}

        {chat.isPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('planner.chat.thinking')}
          </p>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={2}
            placeholder={t('planner.chat.placeholder')}
            aria-label={t('planner.chat.placeholder')}
            className="min-h-0 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button size="icon" onClick={send} disabled={chat.isPending || !input.trim()} aria-label={t('planner.chat.send')}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}

function ProposalCard({
  plan,
  proposal,
  applied,
  onApply,
}: {
  plan: MealPlanDto
  proposal: PlannerProposal
  applied: boolean
  onApply: () => void
}) {
  const { t } = useTranslation()

  if (proposal.tool === 'setServingMultiplier') {
    const title = entryTitle(plan, proposal.entryId)
    const stale = title === undefined
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Utensils className="h-3.5 w-3.5 text-primary" aria-hidden />
          {t('planner.chat.setMultiplier', { title: title ?? t('planner.chat.staleEntry'), mult: proposal.servingMultiplier })}
        </p>
        {proposal.rationale && <p className="mt-1 text-xs text-muted-foreground">{proposal.rationale}</p>}
        <ApplyButton applied={applied} disabled={stale} onApply={onApply} label={t('planner.chat.apply')} />
      </div>
    )
  }

  const name = windowName(plan, proposal.windowId)
  const stale = name === undefined
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Utensils className="h-3.5 w-3.5 text-primary" aria-hidden />
        {t('planner.chat.addFood', {
          food: proposal.foodQuery,
          amount: proposal.amount,
          unit: proposal.unit,
          window: name ?? t('planner.chat.staleWindow'),
        })}
      </p>
      {proposal.rationale && <p className="mt-1 text-xs text-muted-foreground">{proposal.rationale}</p>}
      <ApplyButton applied={applied} disabled={stale} onApply={onApply} label={t('planner.chat.chooseFood')} />
    </div>
  )
}

function ApplyButton({
  applied,
  disabled,
  onApply,
  label,
}: {
  applied: boolean
  disabled: boolean
  onApply: () => void
  label: string
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-2">
      <Button
        size="sm"
        variant={applied ? 'outline' : 'default'}
        disabled={disabled || applied}
        onClick={onApply}
      >
        {applied ? t('planner.chat.applied') : label}
      </Button>
    </div>
  )
}
