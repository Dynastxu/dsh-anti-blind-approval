/**
 * dsh-anti-blind-approval — Host half.
 *
 * The browser half owns the approval panel; this half answers four exact Fetch
 * routes under `/api`:
 *
 *   POST /api/anti-blind-approval/action
 *     Cheap scope probe: is this session in `workspace-write`, and what is the
 *     pending tool action behind the given approval call id? No model call.
 *
 *   POST /api/anti-blind-approval/review
 *     Runs one JSON-output review with the configured model (default: the
 *     session's current route) and returns `{ safe, reason }`.
 *
 *   GET  /api/anti-blind-approval/catalog
 *     Providers/models for the settings picker plus the built-in prompt.
 *
 *   POST /api/anti-blind-approval/test
 *     One review over synthetic facts, to check the model and credentials.
 *
 * The reviewer preferences live in this host entry's `Config`: every field is
 * volatile, so the settings service projects them into the browser form the
 * panel edits and `cordis.yml` can still supply them. The Host itself does not
 * read them; the browser half reads the projected values through
 * `ctx.configForms`.
 *
 * The routes are served through the Host Connection service, so they inherit
 * the authenticated browser Peer and the Host/Origin fence. Nothing here
 * reaches the model-visible session log: the review is an auxiliary call.
 *
 * @module dsh-anti-blind-approval
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only service merges: ctx.sessions, ctx.llm, and ctx.settings.
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-settings'
import type { InflightReviews } from './routes.ts'
import { ROUTE_BASE } from './contract.ts'
import { handleAction, handleCatalog, handleTest, makeReviewHandler } from './routes.ts'

export { Config } from './config.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-anti-blind-approval'

/**
 * Hard services. `connection` is looked up lazily so the package still loads in
 * compositions without a Web carrier; the panel then falls back to the stock
 * approval UI when its probe 404s.
 */
export const inject = ['sessions', 'llm']

/** One exact Fetch route as the Host Connection service accepts it. */
interface FetchRoute {
  readonly path: string
  readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
  readonly requestBody: 'buffered'
  readonly fetch: (request: Request) => Promise<Response>
}

/** The slice of the Connection service this plugin installs into. */
interface FetchRouteRegistry {
  readonly fetch: {
    register(route: FetchRoute): () => Promise<void>
  }
}

/**
 * Read the Connection service off a context.
 *
 * Structural rather than imported: this package is distributed on its own, so a
 * value or type dependency on the transport package would have to travel with
 * it. Registration is a no-op when the service is absent, which is what keeps
 * non-Web compositions loadable.
 * @param ctx - plugin context that may carry the service.
 * @returns the route registry, or undefined in a composition without one.
 */
function fetchRoutesOf(ctx: Context): FetchRouteRegistry | undefined {
  const service = Reflect.get(ctx, 'connection') as FetchRouteRegistry | undefined
  return service === undefined ? undefined : service
}

/**
 * Install the Fetch routes.
 * @param ctx - Host context carrying the session and model services.
 */
export function apply(ctx: Context): void {
  // The panel ships its own settings page; keeping the automatic page off means
  // a client that renders generated forms shows one page, not two.
  ctx.inject(['settings'], (scope) => {
    scope.effect(
      () => scope.settings.configure({ auto: false }, ctx.fiber),
      'dsh-anti-blind-approval: settings page policy',
    )
  })
  const inflight: InflightReviews = new Map()
  ctx.inject(['connection'], (scope) => {
    const routes = fetchRoutesOf(scope)
    if (routes === undefined) return
    routes.fetch.register({
      path: `${ROUTE_BASE}/action`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: request => handleAction(ctx, request),
    })
    routes.fetch.register({
      path: `${ROUTE_BASE}/review`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: makeReviewHandler(ctx, inflight),
    })
    routes.fetch.register({
      path: `${ROUTE_BASE}/catalog`,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: () => handleCatalog(ctx),
    })
    routes.fetch.register({
      path: `${ROUTE_BASE}/test`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: request => handleTest(ctx, request),
    })
  })
  ctx.effect(() => () => {
    inflight.clear()
  }, 'dsh-anti-blind-approval: in-flight reviews')
}
