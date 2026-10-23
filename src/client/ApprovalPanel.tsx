/**
 * The approval takeover: for a `workspace-write` session it probes the Host,
 * shows the pending action, asks for one JSON safety verdict, keeps Allow
 * disabled while the review runs, and — on an unsafe verdict or a failed review
 * — keeps it disabled for the configured cool-down.
 *
 * The human still decides. A failed review never allows by itself, and an
 * allowed review still needs a click.
 * @module dsh-ai-approval-review/client/ApprovalPanel
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { ApprovalDecision, PendingApproval } from '@deepseek-ai/dsh-client-ui-approval/client'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { ActionProbeResponse, ReviewResponse, Verdict } from '../types.ts'
import { ROUTE_BASE } from '../contract.ts'
import { HttpError, postJson } from './http.ts'
import { NS, errorKey, type ApprovalKey } from './locales.ts'
import { readSettings } from './settings.ts'

/** One verdict this page already paid for. */
export interface CachedVerdict {
  readonly safe: boolean
  readonly reason: string
  readonly model: string
  readonly preview: string
}

/** Verdicts this page has already paid for, owned by the plugin instance. */
export interface ReviewCache {
  /**
   * Read the verdict already obtained for one approval.
   * @param key - session and call identity.
   * @returns the cached verdict, or undefined when this page has none.
   */
  lookup(key: string): CachedVerdict | undefined

  /**
   * Store one verdict for the rest of this page's life.
   * @param key - session and call identity.
   * @param verdict - what the reviewer answered.
   */
  remember(key: string, verdict: CachedVerdict): void
}

/** Business values the registrant injects into the panel. */
export interface ApprovalPanelInjected {
  /**
   * Resolve requester-owned copy in the current UI language.
   * @param reason - localized presentation text with an English fallback.
   * @returns text for the active UI language.
   */
  resolveReason(reason: NonNullable<PendingApproval['displayReason']>): string

  /**
   * The language the user reads this UI in, so the reviewer answers in it.
   * @returns a BCP 47-style tag, or `''` when the UI has none.
   */
  userLanguage(): string

  /** Verdicts already paid for in this page. */
  reviews: ReviewCache
}

/** Full props of the approval takeover. */
export type ApprovalPanelProps =
  PropsRuntime<'conversation.composer'>
  & { matched: PendingApproval }
  & PropsLocale<typeof NS>
  & ApprovalPanelInjected

/** What the panel is showing right now. */
type Phase = 'checking' | 'off' | 'reviewing' | 'safe' | 'unsafe' | 'error'

/** Remaining cool-down before Allow unlocks. */
interface Countdown {
  readonly until: number
  readonly left: number
}

/** Failure fields a route response carried. */
interface Failure {
  readonly errorCode?: unknown
  readonly detail?: unknown
}

/** Poll interval of the cool-down label. */
const TICK_MS = 200

/**
 * Render one pending approval, gated on the Host's review.
 * @param props - owner, locale, and registrant-injected shares.
 * @returns the approval card.
 */
export function ApprovalPanel(props: ApprovalPanelProps): ReactNode {
  const { matched: pending, t, resolveReason, userLanguage: readUserLanguage, reviews } = props
  const [phase, setPhase] = useState<Phase>('checking')
  const [preview, setPreview] = useState('')
  const [verdict, setVerdict] = useState<Verdict & { readonly model: string } | null>(null)
  const [failure, setFailure] = useState<Failure>({})
  const [answered, setAnswered] = useState(false)
  const [countdown, setCountdown] = useState<Countdown>({ until: 0, left: 0 })
  const waitingRef = useRef(false)
  const aliveRef = useRef(true)

  const reasonText = ((): string => {
    if (pending.displayReason !== undefined) {
      try {
        const text = resolveReason(pending.displayReason)
        if (text !== '') return text
      } catch {
        // Requester-owned copy may be unusable; the audit reason still names the ask.
      }
    }
    if (pending.reason !== undefined && pending.reason !== '') return pending.reason
    return t('escalation', { toolName: pending.toolName })
  })()

  const beginHold = useCallback((seconds: number): void => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      setCountdown({ until: 0, left: 0 })
      return
    }
    setCountdown({ until: Date.now() + seconds * 1000, left: Math.ceil(seconds) })
  }, [])

  useEffect(() => {
    if (countdown.until === 0) return undefined
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((countdown.until - Date.now()) / 1000))
      setCountdown(previous => (previous.until !== countdown.until ? previous : { until: previous.until, left }))
      if (left <= 0) clearInterval(timer)
    }, TICK_MS)
    return () => { clearInterval(timer) }
  }, [countdown.until])

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  // Keyed on the request identity alone: a re-render or a locale switch must
  // never spend a second review for the same approval.
  useEffect(() => {
    const settings = readSettings()
    if (!settings.enabled) {
      setPhase('off')
      return undefined
    }
    const cacheKey = pending.callId === undefined ? '' : `${pending.sessionId}\u0000${pending.callId}`
    const cached = cacheKey === '' ? undefined : reviews.lookup(cacheKey)
    if (cached !== undefined) {
      if (cached.preview !== '') setPreview(cached.preview)
      setVerdict({ safe: cached.safe, reason: cached.reason, model: cached.model })
      if (cached.safe) {
        setPhase('safe')
      } else {
        setPhase('unsafe')
        beginHold(settings.delaySeconds)
      }
      return undefined
    }
    const controller = new AbortController()
    let language = ''
    try {
      language = readUserLanguage()
    } catch {
      // A UI without a locale answer still gets a review in the fallback language.
      language = ''
    }
    const base = {
      sessionId: pending.sessionId,
      toolName: pending.toolName,
      ...(pending.callId === undefined ? {} : { callId: pending.callId }),
      ...(pending.reason === undefined ? {} : { reason: pending.reason }),
      ...(pending.displayReason === undefined ? {} : { displayReason: pending.displayReason }),
      userLanguage: language,
    }
    const run = async (): Promise<void> => {
      const action = await postJson<ActionProbeResponse>(`${ROUTE_BASE}/action`, base, controller.signal)
      if (!aliveRef.current) return
      if (action.active !== true) {
        setPhase('off')
        return
      }
      if (typeof action.preview === 'string') setPreview(action.preview)
      setPhase('reviewing')
      const result = await postJson<ReviewResponse>(`${ROUTE_BASE}/review`, {
        ...base,
        prompt: settings.prompt,
        model: settings.model,
      }, controller.signal)
      if (!aliveRef.current) return
      if (typeof result.errorCode === 'string') {
        setFailure(result)
        setPhase('error')
        beginHold(settings.delaySeconds)
        return
      }
      if (typeof result.preview === 'string' && result.preview !== '') setPreview(result.preview)
      const value = {
        safe: result.safe === true,
        reason: typeof result.reason === 'string' ? result.reason : '',
        model: typeof result.model === 'string' ? result.model : '',
      }
      setVerdict(value)
      if (cacheKey !== '') {
        reviews.remember(cacheKey, { ...value, preview: typeof result.preview === 'string' ? result.preview : '' })
      }
      if (value.safe) {
        setPhase('safe')
      } else {
        setPhase('unsafe')
        beginHold(settings.delaySeconds)
      }
    }
    void run().catch((error: unknown) => {
      if (!aliveRef.current || controller.signal.aborted) return
      if (error instanceof HttpError && error.status === 404) {
        // No Host route: the Host half is not composed. Keep the stock approval
        // experience instead of blocking the approval on a missing review.
        setPhase('off')
        return
      }
      setFailure({ errorCode: 'NETWORK', detail: error instanceof Error ? error.message : String(error) })
      setPhase('error')
      beginHold(settings.delaySeconds)
    })
    return () => { controller.abort() }
    // Identity of the pending request is the only axis: `t`, the injected
    // callbacks, and the cache handle are stable for the plugin's lifetime.
  }, [pending.key])

  const reviewing = phase === 'checking' || phase === 'reviewing'
  const holdActive = (phase === 'unsafe' || phase === 'error') && countdown.left > 0
  const allowEnabled = !answered && !reviewing && !holdActive

  const answer = (outcome: ApprovalDecision): void => {
    if (waitingRef.current || pending.answerable === false) return
    if (outcome === 'allowed-once' && !allowEnabled) return
    waitingRef.current = true
    setAnswered(true)
    try {
      void pending.answer(outcome).catch(() => {
        if (!aliveRef.current || pending.answerable === false) return
        waitingRef.current = false
        setAnswered(false)
      })
    } catch {
      // A request that settled elsewhere refuses the answer synchronously; the
      // card returns to its unanswered state so the user can retry.
      waitingRef.current = false
      setAnswered(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented) return
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    const target = event.target instanceof HTMLElement ? event.target : null
    if (!event.currentTarget.contains(document.activeElement)) return
    if (target?.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]') != null) return
    if (event.key === 'Enter' && target?.closest('button, a[href], [role="button"]') != null) return
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    event.preventDefault()
    event.stopPropagation()
    if (event.repeat || event.nativeEvent.isComposing || event.keyCode === 229) return
    answer(event.key === 'Enter' ? 'allowed-once' : 'rejected')
  }

  const strip = stripState(phase, t)
  const holdNote = holdActive
    ? (
        <span className="aiar-hold" data-tone={holdTone(phase)} role="status">
          {t('hold', { seconds: countdown.left })}
        </span>
      )
    : null

  return (
    <div
      className="aiar-root"
      data-approval-key={pending.key}
      data-phase={phase}
      aria-busy={answered || reviewing ? 'true' : 'false'}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="aiar-card">
        <div className="aiar-strip" data-tone={strip.tone}>
          <span className="aiar-dot" data-pulse={reviewing ? 'true' : undefined} />
          <span>{strip.text}</span>
        </div>
        <div className="aiar-body" data-approval-scroll="" tabIndex={0} role="group" aria-label={t('detailAria')}>
          <div className="aiar-headline">{reasonText}</div>
          {reviewBox(phase, verdict, failure, t)}
          {preview === '' ? null : (
            <div className="aiar-command">
              <div className="aiar-reviewMeta">{t('preview')}</div>
              <pre className="aiar-pre">{preview}</pre>
            </div>
          )}
        </div>
        <div className="aiar-actionRow">
          {holdNote}
          <Button variant="outline" disabled={answered} onClick={() => { answer('rejected') }}>
            <span className="aiar-btnLabel">{t('reject')}</span>
          </Button>
          <Button variant="primary" disabled={!allowEnabled} onClick={() => { answer('allowed-once') }}>
            <span className="aiar-btnLabel">
              {reviewing ? <span className="aiar-spinner" aria-hidden="true" /> : null}
              <span>{t('allowOnce')}</span>
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Tone of the cool-down label: an unsafe verdict is the error tone. */
function holdTone(phase: Phase): 'bad' | undefined {
  return phase === 'unsafe' ? 'bad' : undefined
}

/** Strip text and tone for one phase. */
function stripState(phase: Phase, t: Translate<ApprovalKey>): { readonly text: string; readonly tone: string } {
  switch (phase) {
    case 'checking': return { text: t('checking'), tone: 'warn' }
    case 'reviewing': return { text: t('reviewing'), tone: 'warn' }
    case 'safe': return { text: t('safe'), tone: 'ok' }
    case 'unsafe': return { text: t('unsafe'), tone: 'bad' }
    case 'error': return { text: t('error'), tone: 'warn' }
    case 'off': return { text: t('waiting'), tone: 'warn' }
  }
}

/** Resolve one failure's localized label plus its diagnostic detail. */
function errorText(t: Translate<ApprovalKey>, failure: Failure): string {
  const label = t(errorKey(failure.errorCode))
  const detail = typeof failure.detail === 'string' ? failure.detail : ''
  return detail === '' ? label : `${label} (${detail})`
}

/** The verdict block for the current phase, or nothing while the panel decides. */
function reviewBox(
  phase: Phase,
  verdict: Verdict & { readonly model: string } | null,
  failure: Failure,
  t: Translate<ApprovalKey>,
): ReactNode {
  if (phase === 'safe' && verdict !== null) {
    return (
      <div className="aiar-review" data-tone="ok">
        <div className="aiar-reviewTitle">{t('verdictSafe')}</div>
        <div className="aiar-reviewBody">{verdict.reason}</div>
        {verdict.model === '' ? null : <div className="aiar-reviewMeta">{verdict.model}</div>}
      </div>
    )
  }
  if (phase === 'unsafe' && verdict !== null) {
    return (
      <div className="aiar-review" data-tone="bad">
        <div className="aiar-reviewTitle">{t('verdictUnsafe')}</div>
        <div className="aiar-reviewBody">{verdict.reason}</div>
        {verdict.model === '' ? null : <div className="aiar-reviewMeta">{verdict.model}</div>}
      </div>
    )
  }
  if (phase === 'error') {
    return (
      <div className="aiar-review" data-tone="warn">
        <div className="aiar-reviewTitle">{t('verdictError')}</div>
        <div className="aiar-reviewBody">{errorText(t, failure)}</div>
      </div>
    )
  }
  return null
}
