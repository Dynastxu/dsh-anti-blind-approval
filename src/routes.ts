/**
 * The plugin's four `/api` routes.
 *
 * Each handler receives an already-authenticated request from the Host
 * Connection service, so it owns only body validation, the preset check, and
 * the response body. Nothing here writes to the session log.
 *
 * @module dsh-ai-approval-review/routes
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  ActionProbeResponse, ReviewCatalogProvider, ReviewCatalogResponse, ReviewErrorCode,
  ReviewResponse, TestReviewRequest, TestReviewResponse,
} from './types.ts'
import { DEFAULT_PROMPT, MAX_PROMPT_CHARS, REVIEWED_PRESET, normalizeLanguage, reviewSystem } from './prompt.ts'
import {
  ReviewFailure, findAction, previewOf, resolveRoute, reviewOnce, runReview, type ReviewOutcome,
} from './review.ts'
import { brand, clip, isRecord } from './util.ts'

/** Fields every panel request may carry, read only when they are strings. */
const REVIEW_FIELDS = [
  'sessionId', 'callId', 'toolName', 'reason', 'displayReason', 'userLanguage', 'prompt', 'model',
] as const

/** Fields only the connectivity test may carry. */
const TEST_FIELDS = ['model', 'prompt', 'userLanguage'] as const

/** Whether one settled review succeeded; the failure arm keeps the thrown value. */
type SettledReview =
  | { readonly ok: true; readonly value: ReviewOutcome & { readonly preview: string } }
  | { readonly ok: false; readonly error: unknown }

/** Structural view of one live review, keyed by the facts that produced it. */
export type InflightReviews = Map<string, Promise<SettledReview>>

/** The permission-preset query this plugin reads, when the service is composed. */
interface PermissionPresetQuery {
  current(session: Session): string
}

/**
 * Build one JSON response.
 * @param value - body to serialize.
 * @param status - HTTP status.
 * @returns an uncached JSON response.
 */
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * Read one request body as a record.
 * @param request - incoming request.
 * @returns the parsed record, or undefined when the body is not a JSON object.
 */
async function readBody(request: Request): Promise<Record<string, unknown> | undefined> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return undefined
  }
  return isRecord(body) ? body : undefined
}

/**
 * Copy the string-valued fields of a request body.
 *
 * A request body is a wire boundary: every field arrives untyped, and a field
 * of another type is dropped rather than coerced.
 * @param body - parsed request body.
 * @param keys - fields this route reads.
 * @returns the fields that were present as strings.
 */
function stringFields<K extends string>(body: Record<string, unknown>, keys: readonly K[]): Partial<Record<K, string>> {
  const output: Partial<Record<K, string>> = {}
  for (const key of keys) {
    const value = body[key]
    if (typeof value === 'string') output[key] = value
  }
  return output
}

/**
 * Resolve one live session.
 * @param ctx - Host context carrying the session store.
 * @param sessionId - raw id from the request body.
 * @returns the live session, or undefined when the id names none.
 */
function getSession(ctx: Context, sessionId: unknown): Session | undefined {
  if (typeof sessionId !== 'string' || sessionId === '') return undefined
  return ctx.sessions.get(brand<SessionId>(sessionId))
}

/**
 * The session's effective permission preset, when the service is composed.
 * @param ctx - Host context that may carry the preset service.
 * @param session - session whose preset is read.
 * @returns the preset name, or undefined when no service answers.
 */
function presetOf(ctx: Context, session: Session): string | undefined {
  const service = ctx.get('permissionPresets') as PermissionPresetQuery | undefined
  if (service === undefined || typeof service.current !== 'function') return undefined
  return service.current(session)
}

/**
 * Map any thrown value to the response's failure fields.
 * @param error - thrown value from a review.
 * @returns the localized code plus clipped diagnostic detail.
 */
function failureOf(error: unknown): { readonly errorCode: ReviewErrorCode; readonly detail: string } {
  if (error instanceof ReviewFailure) {
    return { errorCode: error.code, detail: clip(error.message, 500) }
  }
  return { errorCode: 'REVIEW_FAILED', detail: clip(error instanceof Error ? error.message : String(error), 500) }
}

/**
 * `POST /action` — scope and preview, no model call.
 * @param ctx - Host context.
 * @param request - incoming request carrying the approval facts.
 * @returns whether this session is reviewed plus the pending action preview.
 */
export async function handleAction(ctx: Context, request: Request): Promise<Response> {
  const input = await readBody(request)
  if (input === undefined) return json({ active: false, errorCode: 'BAD_REQUEST' } satisfies ActionProbeResponse, 400)
  const session = getSession(ctx, input.sessionId)
  if (session === undefined) return json({ active: false, errorCode: 'NO_SESSION' } satisfies ActionProbeResponse)
  const preset = presetOf(ctx, session)
  if (preset !== REVIEWED_PRESET) return json({ active: false, preset: preset ?? null } satisfies ActionProbeResponse)
  const callId = typeof input.callId === 'string' ? input.callId : undefined
  const action = findAction(session, callId)
  return json({
    active: true,
    preset,
    preview: previewOf(action),
    hasAction: action !== undefined,
  } satisfies ActionProbeResponse)
}

/**
 * Build the `POST /review` handler. Concurrent requests for the same facts share
 * one model call: a remount must not pay twice.
 * @param ctx - Host context.
 * @param inflight - reviews currently running, keyed by their facts.
 * @returns the route handler.
 */
export function makeReviewHandler(ctx: Context, inflight: InflightReviews): (request: Request) => Promise<Response> {
  return async function handleReview(request: Request): Promise<Response> {
    const input = await readBody(request)
    if (input === undefined) return json({ errorCode: 'BAD_REQUEST' } satisfies ReviewResponse, 400)
    const session = getSession(ctx, input.sessionId)
    if (session === undefined) return json({ errorCode: 'NO_SESSION' } satisfies ReviewResponse)
    const preset = presetOf(ctx, session)
    if (preset !== REVIEWED_PRESET) return json({ active: false, preset: preset ?? null } satisfies ReviewResponse)
    const facts = stringFields(input, REVIEW_FIELDS)
    const key = [
      session.id, facts.callId ?? '', facts.model ?? '', facts.prompt ?? '', facts.userLanguage ?? '',
    ].join('\u0000')
    let shared = inflight.get(key)
    if (shared === undefined) {
      const started: Promise<SettledReview> = runReview(
        ctx,
        session,
        { ...facts, requestSignal: request.signal },
        preset,
      ).then(
        value => ({ ok: true, value }),
        (error: unknown) => ({ ok: false, error }),
      )
      inflight.set(key, started)
      void started.finally(() => {
        if (inflight.get(key) === started) inflight.delete(key)
      })
      shared = started
    }
    const result = await shared
    if (result.ok) {
      return json({
        active: true,
        preset,
        safe: result.value.safe,
        reason: result.value.reason,
        model: result.value.route,
        elapsedMs: result.value.elapsedMs,
        preview: result.value.preview,
      } satisfies ReviewResponse)
    }
    return json({ active: true, preset, ...failureOf(result.error) } satisfies ReviewResponse)
  }
}

/**
 * `GET /catalog` — model picker data and the built-in prompt.
 * @param ctx - Host context carrying the model registry.
 * @returns providers with their models, plus the built-in policy.
 */
export async function handleCatalog(ctx: Context): Promise<Response> {
  const providers: ReviewCatalogProvider[] = []
  for (const provider of ctx.llm.listProviders()) {
    if (provider.id === '') continue
    const models = await ctx.llm.listModels(provider.id).catch(() => [])
    providers.push({
      id: provider.id,
      name: provider.name === '' ? provider.id : provider.name,
      models: models
        .filter(model => model.id !== '')
        .map(model => ({ id: model.id, name: model.name === '' ? model.id : model.name })),
    })
  }
  return json({ providers, defaultPrompt: DEFAULT_PROMPT } satisfies ReviewCatalogResponse)
}

/**
 * `POST /test` — one review over synthetic facts, to check the model and
 * credentials from the settings page.
 * @param ctx - Host context.
 * @param request - incoming request carrying the optional overrides.
 * @returns the verdict, or the failure code.
 */
export async function handleTest(ctx: Context, request: Request): Promise<Response> {
  const body = await readBody(request)
  const input: TestReviewRequest = stringFields(body ?? {}, TEST_FIELDS)
  const route = await resolveRoute(ctx, undefined, input.model)
  if (route === undefined) return json({ errorCode: 'NO_MODEL' } satisfies TestReviewResponse)
  const language = normalizeLanguage(input.userLanguage)
  const custom = typeof input.prompt === 'string' ? input.prompt.trim() : ''
  const policy = custom === '' ? DEFAULT_PROMPT : clip(custom, MAX_PROMPT_CHARS)
  const facts = JSON.stringify({
    preset: 'test',
    cwd: '',
    userLanguage: language,
    approval: {
      toolName: 'bash',
      callId: '',
      reason: 'escalate sandbox to danger-full-access: review connectivity test',
      displayReason: '',
    },
    action: {
      kind: 'tool-call',
      name: 'bash',
      arguments: { command: 'echo hello', sandbox_permissions: 'danger-full-access', justification: 'review connectivity test' },
    },
  }, null, 2)
  try {
    const result = await reviewOnce(ctx, route, reviewSystem(policy, language), facts, request.signal)
    return json({
      ok: true,
      safe: result.safe,
      reason: result.reason,
      model: result.route,
      elapsedMs: result.elapsedMs,
    } satisfies TestReviewResponse)
  } catch (error) {
    return json(failureOf(error) satisfies TestReviewResponse)
  }
}
