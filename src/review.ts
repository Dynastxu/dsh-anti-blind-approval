/**
 * One approval review: route resolution, request facts, the model call, and the
 * strict JSON verdict.
 *
 * Everything here is an auxiliary call. It never appends to the session log, so
 * a review cannot reach model-visible context and costs the conversation no
 * tokens.
 *
 * @module dsh-ai-approval-review/review
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: the ctx.sessions and ctx.llm service merges plus their payload types.
import type { Session } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-llm'
import type { ReviewErrorCode, ReviewRequestBase, Verdict } from './types.ts'
import {
  DEFAULT_PROMPT, MAX_PREVIEW_CHARS, MAX_PROMPT_CHARS, MAX_VERDICT_REASON_CHARS,
  REVIEW_TIMEOUT_MS, normalizeLanguage, reviewSystem,
} from './prompt.ts'
import { clip, isRecord } from './util.ts'

/** One route the reviewer may call. */
export interface ReviewRoute {
  readonly provider: string
  readonly model: string
}

/** The logged tool action behind a pending approval. */
export interface LoggedAction {
  /** Whether the action is a top-level tool call or a PTC-inner dispatch. */
  readonly kind: 'tool-call' | 'ptc-inner'
  readonly name: string
  /** Parsed argument value, or the raw string when it was not JSON. */
  readonly arguments: unknown
}

/** Facts one review sends to the model, after clipping. */
export interface ReviewFacts {
  readonly preset: string
  readonly cwd: string
  readonly userLanguage: string
  readonly approval: {
    readonly toolName: string
    readonly callId: string
    readonly reason: string
    readonly displayReason: string
  }
  readonly action: {
    readonly kind: LoggedAction['kind']
    readonly name: string
    readonly arguments: unknown
  } | null
}

/** One parsed verdict plus the route that answered and how long it took. */
export interface ReviewOutcome extends Verdict {
  /** Route that answered, as `provider/model`. */
  readonly route: string
  /** Wall-clock duration of the review. */
  readonly elapsedMs: number
}

/** Terminal review failure carrying the code the panel localizes. */
export class ReviewFailure extends Error {
  /** Stable code the panel maps to a message. */
  readonly code: ReviewErrorCode

  /**
   * @param code - stable failure code.
   * @param message - diagnostic detail; never shown in place of the code.
   */
  constructor(code: ReviewErrorCode, message: string = code) {
    super(message)
    this.name = 'ReviewFailure'
    this.code = code
  }
}

/**
 * Parse a logged argument string without turning malformed JSON into data loss.
 * @param raw - the raw `arguments` string from a `tool/call` event.
 * @returns the parsed value, `{}` for an empty string, or the raw string.
 */
function parseArguments(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  if (raw.trim() === '') return {}
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/**
 * Find the logged action behind an approval call id: the native `tool/call` for
 * a top-level call, or the PTC dispatch start for an inner call.
 * @param session - session whose log holds the call.
 * @param callId - approval's correlated tool-call id.
 * @returns the logged action, or undefined when the log holds none.
 */
export function findAction(session: Session, callId: string | undefined): LoggedAction | undefined {
  if (callId === undefined || callId === '') return undefined
  const events = session.snapshotEvents()
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event === undefined) continue
    if (event.type === 'tool/call') {
      const data = event.data
      if (data.callId !== callId) continue
      return { kind: 'tool-call', name: data.name, arguments: parseArguments(data.arguments) }
    }
    // `tool/ptc-dispatch-start` arrives through the merge-extensible event map,
    // so its payload is read structurally rather than narrowed by discriminant.
    const type: string = event.type
    if (type !== 'tool/ptc-dispatch-start') continue
    const data: unknown = event.data
    if (!isRecord(data)) continue
    if (data.subCallId !== callId && data.callId !== callId) continue
    return {
      kind: 'ptc-inner',
      name: typeof data.name === 'string' ? data.name : '',
      arguments: parseArguments(data.arguments),
    }
  }
  return undefined
}

/**
 * Render the pending action for the panel; clipped so one huge write stays readable.
 * @param action - logged action, or undefined when the log holds none.
 * @returns the rendered preview, `''` without an action.
 */
export function previewOf(action: LoggedAction | undefined): string {
  if (action === undefined) return ''
  let rendered: string
  if (typeof action.arguments === 'string') {
    rendered = action.arguments
  } else {
    try {
      rendered = JSON.stringify(action.arguments, null, 2)
    } catch {
      rendered = String(action.arguments)
    }
  }
  return clip(`${action.name}\n${rendered}`, MAX_PREVIEW_CHARS)
}

/**
 * Resolve the review route: explicit selection first, else the session's own.
 * @param ctx - Host context carrying the model registry.
 * @param session - session whose route is the default, when it already has one.
 * @param preferred - `provider::model` selection from the settings page.
 * @returns the route to call, or undefined when no provider offers a model.
 */
export async function resolveRoute(
  ctx: Context,
  session: Session | undefined,
  preferred: unknown,
): Promise<ReviewRoute | undefined> {
  if (typeof preferred === 'string' && preferred.includes('::')) {
    const index = preferred.indexOf('::')
    const provider = preferred.slice(0, index)
    const model = preferred.slice(index + 2)
    if (provider !== '' && model !== '') return { provider, model }
  }
  const config = session?.requestHeader()?.config
  if (config !== undefined && config.provider !== '' && config.model !== '') {
    return { provider: config.provider, model: config.model }
  }
  // Before the first request header exists, fall back to the first catalog entry.
  for (const provider of ctx.llm.listProviders()) {
    if (provider.id === '') continue
    const models = await ctx.llm.listModels(provider.id).catch(() => [])
    for (const model of models) {
      if (model.id !== '') return { provider: provider.id, model: model.id }
    }
  }
  return undefined
}

/**
 * Read one strict `{ safe, reason }` object out of the reviewer's text.
 * @param text - the reviewer's complete answer.
 * @returns the parsed verdict, with the reason clipped.
 * @throws {ReviewFailure} with code `INVALID_OUTPUT` for anything else.
 */
export function parseVerdict(text: string): Verdict {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new ReviewFailure('INVALID_OUTPUT')
  let value: unknown
  try {
    value = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new ReviewFailure('INVALID_OUTPUT')
  }
  if (!isRecord(value)) throw new ReviewFailure('INVALID_OUTPUT')
  if (typeof value.safe !== 'boolean') throw new ReviewFailure('INVALID_OUTPUT')
  if (typeof value.reason !== 'string' || value.reason.trim() === '') throw new ReviewFailure('INVALID_OUTPUT')
  return { safe: value.safe, reason: clip(value.reason.trim(), MAX_VERDICT_REASON_CHARS) }
}

/**
 * Clamp a value for review input: long strings, big arrays, and deep objects.
 * @param value - logged argument value.
 * @param depth - current nesting depth; deeper records are left as they are.
 * @returns the same value with each string and collection bounded.
 */
function clipForReview(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return clip(value, 2_000)
  if (Array.isArray(value)) return value.slice(0, 40).map(item => clipForReview(item, depth + 1))
  if (isRecord(value) && depth < 5) {
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value).slice(0, 60)) {
      output[clip(key, 120)] = clipForReview(item, depth + 1)
    }
    return output
  }
  return value
}

/**
 * Build the user-role review input from durable, already-retained facts.
 * @param session - session owning the approval.
 * @param input - request facts from the panel.
 * @param preset - effective permission preset.
 * @param action - logged action behind the call id.
 * @param language - normalized reader language tag.
 * @returns the JSON text of the facts sent as the user message.
 */
export function reviewInput(
  session: Session,
  input: ReviewRequestBase,
  preset: string,
  action: LoggedAction | undefined,
  language: string,
): string {
  const facts: ReviewFacts = {
    preset,
    cwd: session.header.cwd ?? '',
    userLanguage: language,
    approval: {
      toolName: typeof input.toolName === 'string' ? clip(input.toolName, 200) : '',
      callId: typeof input.callId === 'string' ? clip(input.callId, 200) : '',
      reason: typeof input.reason === 'string' ? clip(input.reason, 1_500) : '',
      displayReason: typeof input.displayReason === 'string' ? clip(input.displayReason, 1_500) : '',
    },
    action: action === undefined
      ? null
      : { kind: action.kind, name: clip(action.name, 200), arguments: clipForReview(action.arguments) },
  }
  const rendered = JSON.stringify(facts, null, 2)
  if (rendered.length <= 24_000) return rendered
  // The clipped form drops the argument payload, which is what made it too big.
  return JSON.stringify({
    preset: facts.preset,
    cwd: facts.cwd,
    userLanguage: facts.userLanguage,
    approval: facts.approval,
    action: action === undefined ? null : { kind: action.kind, name: clip(action.name, 200) },
  })
}

/**
 * Stream one review request and collect the reviewer's text.
 * @param ctx - Host context carrying the model registry.
 * @param route - resolved provider/model route.
 * @param system - policy plus the fixed output contract.
 * @param userText - JSON facts of the pending approval.
 * @param signal - cancellation for this review.
 * @returns the reviewer's complete text.
 * @throws {ReviewFailure} when the stream ends without a finish or reports a failure.
 */
async function callModel(
  ctx: Context,
  route: ReviewRoute,
  system: string,
  userText: string,
  signal: AbortSignal,
): Promise<string> {
  let text = ''
  let finished = false
  let failure: { readonly message: string; readonly code: string } | undefined
  const stream = ctx.llm.stream({
    provider: route.provider,
    model: route.model,
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
    temperature: 0,
    signal,
  })
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') {
      text += chunk.text
    } else if (chunk.type === 'finish') {
      finished = true
      const reason = chunk.reason
      if (reason.kind === 'error' || reason.kind === 'aborted') failure = reason.failure
    }
  }
  if (!finished) throw new ReviewFailure('LLM_NO_FINISH')
  if (failure !== undefined) {
    throw new ReviewFailure('LLM_ERROR', failure.message === '' ? failure.code : failure.message)
  }
  return text
}

/**
 * Run one reviewer request and return its parsed verdict plus route and timing.
 * @param ctx - Host context carrying the model registry.
 * @param route - resolved provider/model route.
 * @param system - policy plus the fixed output contract.
 * @param userText - JSON facts of the pending approval.
 * @param requestSignal - cancellation of the originating HTTP request.
 * @returns the verdict with the answering route and elapsed time.
 * @throws {ReviewFailure} with the localized failure code.
 */
export async function reviewOnce(
  ctx: Context,
  route: ReviewRoute,
  system: string,
  userText: string,
  requestSignal: AbortSignal | undefined,
): Promise<ReviewOutcome> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new ReviewFailure('TIMEOUT'))
  }, REVIEW_TIMEOUT_MS)
  const onAbort = (): void => { controller.abort(requestSignal?.reason) }
  requestSignal?.addEventListener('abort', onAbort, { once: true })
  const started = Date.now()
  try {
    const text = await callModel(ctx, route, system, userText, controller.signal)
    const verdict = parseVerdict(text)
    return { ...verdict, route: `${route.provider}/${route.model}`, elapsedMs: Date.now() - started }
  } catch (error) {
    if (requestSignal?.aborted === true) throw new ReviewFailure('ABORTED')
    if (controller.signal.aborted) throw new ReviewFailure('TIMEOUT')
    if (error instanceof ReviewFailure) throw error
    throw new ReviewFailure('REVIEW_FAILED', error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timer)
    requestSignal?.removeEventListener('abort', onAbort)
  }
}

/** One complete review: what the panel posted, plus the rendered pending action. */
export interface RunReviewOptions extends ReviewRequestBase {
  /** Replacement reviewer policy. */
  readonly prompt?: string
  /** `provider::model` override. */
  readonly model?: string
  /** Cancellation of the originating HTTP request. */
  readonly requestSignal?: AbortSignal
}

/**
 * Run one complete review.
 * @param ctx - Host context carrying the model registry.
 * @param session - session whose approval is pending.
 * @param input - request facts from the panel.
 * @param preset - effective permission preset.
 * @returns the verdict, the answering route, the timing, and the preview.
 * @throws {ReviewFailure} with `NO_MODEL` or any review failure code.
 */
export async function runReview(
  ctx: Context,
  session: Session,
  input: RunReviewOptions,
  preset: string,
): Promise<ReviewOutcome & { readonly preview: string }> {
  const route = await resolveRoute(ctx, session, input.model)
  if (route === undefined) throw new ReviewFailure('NO_MODEL')
  const language = normalizeLanguage(input.userLanguage)
  const custom = typeof input.prompt === 'string' ? input.prompt.trim() : ''
  const policy = custom === '' ? DEFAULT_PROMPT : clip(custom, MAX_PROMPT_CHARS)
  const action = findAction(session, input.callId)
  const userText = reviewInput(session, input, preset, action, language)
  const result = await reviewOnce(ctx, route, reviewSystem(policy, language), userText, input.requestSignal)
  return { ...result, preview: previewOf(action) }
}
