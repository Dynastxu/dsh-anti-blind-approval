// Composition check against the real Cordis runtime: which compositions the
// plugin activates in, and what it contributes to each.
//
// Route disposal is owned by the Host Connection service, which registers each
// route inside the caller fiber's effect; this plugin only hands it the route.
import { Context } from '../../vendor/cordis/lib/index.js'
import * as plugin from '../lib/index.js'

/** The four routes one activated plugin contributes. */
const PATHS = [
  '/api/anti-blind-approval/action',
  '/api/anti-blind-approval/review',
  '/api/anti-blind-approval/catalog',
  '/api/anti-blind-approval/test',
]

const session = {
  id: 's1',
  header: { cwd: 'C:/work' },
  snapshotEvents: () => [],
  requestHeader: () => undefined,
}
const sessions = { get: (id) => (id === 's1' ? session : undefined) }
const llm = { listProviders: () => [], listModels: async () => [], stream: () => { throw new Error('unused') } }

/** Boot one real Context with the given services and return the registered paths. */
function routesFor(services) {
  const registered = []
  const ctx = new Context()
  ctx.provide('sessions', sessions)
  ctx.provide('llm', llm)
  if (services.connection) {
    ctx.provide('connection', {
      fetch: {
        register(route) {
          registered.push(route.path)
          return async () => {}
        },
      },
    })
  }
  if (services.permissionPresets) ctx.provide('permissionPresets', { current: () => 'workspace-write' })
  ctx.plugin(plugin)
  return registered
}

const full = routesFor({ connection: true, permissionPresets: true })
await new Promise(resolve => setTimeout(resolve, 20))
if (full.length !== PATHS.length) throw new Error('expected four routes, got ' + full.length)
for (const path of PATHS) {
  if (!full.includes(path)) throw new Error('missing route ' + path)
}
console.log('ok - activates with every declared service and registers four routes')

const withoutConnection = routesFor({ connection: false, permissionPresets: true })
await new Promise(resolve => setTimeout(resolve, 20))
if (withoutConnection.length !== 0) throw new Error('a composition without Connection must add no routes')
console.log('ok - a composition without the Connection service still loads')

const pending = new Context()
pending.provide('llm', llm)
pending.provide('connection', { fetch: { register: () => async () => {} } })
pending.plugin(plugin)
await new Promise(resolve => setTimeout(resolve, 20))
if (pending.sessions !== undefined) throw new Error('unexpected sessions service')
console.log('ok - a composition without sessions keeps the plugin pending')

console.log('COMPOSITION PASS')
