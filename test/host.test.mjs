import { apply } from '../lib/index.js'

const routes = new Map()
const calls = []

function makeCtx(preset, toolArguments) {
  const session = {
    id: 's1',
    header: { cwd: 'C:/work' },
    requestHeader: () => ({ config: { provider: 'fake', model: 'fake-1' } }),
    snapshotEvents: () => [
      { type: 'tool/call', data: { callId: 'c1', name: 'bash', arguments: toolArguments ?? '{"command":"rm -rf /tmp/x"}' } },
    ],
  }
  return {
    sessions: { get: (id) => (id === 's1' ? session : undefined) },
    llm: {
      listProviders: () => [{ id: 'fake', name: 'Fake' }],
      listModels: async () => [{ id: 'fake-1', name: 'Fake One' }],
      stream: (options) => {
        calls.push(options)
        const text = globalThis.__NEXT_TEXT__ ?? '{"safe":true,"reason":"常规项目操作"}'
        return (async function* () {
          yield { type: 'text-delta', text }
          yield { type: 'finish', reason: { kind: 'stop' } }
        })()
      },
    },
    get: (name) => (name === 'permissionPresets' ? { current: () => preset } : undefined),
    connection: { fetch: { register: (route) => routes.set(route.path, route) } },
    effect: (fn) => fn(),
    inject: (deps, cb) => cb({ connection: { fetch: { register: (route) => routes.set(route.path, route) } } }),
  }
}

async function call(path, body) {
  const route = routes.get(path)
  if (!route) throw new Error('missing route ' + path)
  const request = new Request('http://127.0.0.1/api' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const response = await route.fetch(request)
  return { status: response.status, value: await response.json() }
}

function assert(cond, message) {
  if (!cond) throw new Error('ASSERT: ' + message)
  console.log('ok -', message)
}

const ctx = makeCtx('workspace-write')
apply(ctx)
assert(routes.has('/api/ai-approval-review/action'), 'action route registered')
assert(routes.has('/api/ai-approval-review/review'), 'review route registered')
assert(routes.has('/api/ai-approval-review/catalog'), 'catalog route registered')
assert(routes.has('/api/ai-approval-review/test'), 'test route registered')

const catalog = await routes.get('/api/ai-approval-review/catalog').fetch(new Request('http://x/api/ai-approval-review/catalog'))
const cat = await catalog.json()
assert(typeof cat.defaultPrompt === 'string' && cat.defaultPrompt.includes('JSON') === false, 'catalog default prompt')
assert(cat.providers[0].models[0].id === 'fake-1', 'catalog models')

const action = await call('/api/ai-approval-review/action', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r' })
assert(action.value.active === true, 'action active in workspace-write')
assert(action.value.preview.includes('rm -rf /tmp/x'), 'action preview has command')

const safe = await call('/api/ai-approval-review/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r' })
assert(safe.value.safe === true && safe.value.reason === '常规项目操作', 'safe verdict parsed')
assert(safe.value.model === 'fake/fake-1', 'review uses session model')
assert(calls.at(-1).temperature === 0, 'temperature 0')
assert(calls.at(-1).system.includes('JSON'), 'JSON contract appended')

globalThis.__NEXT_TEXT__ = '```json\n{"safe":false,"reason":"删除系统目录"}\n```'
const unsafe = await call('/api/ai-approval-review/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r' })
assert(unsafe.value.safe === false && unsafe.value.reason === '删除系统目录', 'fenced unsafe verdict parsed')

globalThis.__NEXT_TEXT__ = '{"safe":"yes","reason":"bad"}'
const bad = await call('/api/ai-approval-review/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r' })
assert(bad.value.errorCode === 'INVALID_OUTPUT', 'invalid output rejected')

globalThis.__NEXT_TEXT__ = '{"safe":true,"reason":"ok"}'
const test = await call('/api/ai-approval-review/test', {})
assert(test.value.ok === true, 'test route runs a review')

const huge = makeCtx('workspace-write', JSON.stringify({ path: 'big.txt', content: 'x'.repeat(200000) }))
routes.clear()
apply(huge)
globalThis.__NEXT_TEXT__ = '{"safe":true,"reason":"ok"}'
const clipped = await call('/api/ai-approval-review/review', { sessionId: 's1', callId: 'c1', toolName: 'write', reason: 'r' })
assert(clipped.value.safe === true, 'huge-argument review succeeds')
const sent = calls.at(-1).messages[0].content[0].text
assert(sent.length < 24000, 'review input is clipped')
assert(sent.includes('x'.repeat(100)), 'review input keeps a content prefix')

const other = makeCtx('danger-full-access')
routes.clear()
apply(other)
const skipped = await call('/api/ai-approval-review/action', { sessionId: 's1', callId: 'c1' })
assert(skipped.value.active === false && skipped.value.preset === 'danger-full-access', 'non workspace-write skipped')

console.log('ALL PASS')
