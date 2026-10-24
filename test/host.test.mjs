import * as plugin from '../lib/index.js'

const { apply } = plugin

const routes = new Map()
const calls = []
const configured = []

function makeCtx(preset, toolArguments, { hang = false } = {}) {
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
        if (hang) {
          // The real provider stream watches the signal; a stalled review only
          // settles because the timeout aborts it.
          return (async function* () {
            await new Promise((_, reject) => {
              options.signal.addEventListener('abort', () => reject(new Error('stream aborted')), { once: true })
            })
          })()
        }
        const text = globalThis.__NEXT_TEXT__ ?? '{"safe":true,"reason":"常规项目操作"}'
        return (async function* () {
          yield { type: 'text-delta', text }
          yield { type: 'finish', reason: { kind: 'stop' } }
        })()
      },
    },
    get: (name) => (name === 'permissionPresets' ? { current: () => preset } : undefined),
    fiber: {},
    connection: { fetch: { register: (route) => routes.set(route.path, route) } },
    effect: (fn) => fn(),
    inject: (deps, cb) => cb({
      connection: { fetch: { register: (route) => routes.set(route.path, route) } },
      effect: (fn) => fn(),
      settings: { configure: (policy, owner) => { configured.push(policy); return () => {} } },
    }),
  }
}

/**
 * A resolved plugin Config: every field is a volatile handle, as the Host hands
 * it to `apply`. Tests replace a handle when they need a non-default value.
 */
function makeConfig() {
  return new plugin.Config()
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
apply(ctx, makeConfig())
assert(typeof plugin.Config === 'function', 'Config schema is exported')
const defaults = new plugin.Config()
assert(
  defaults.enabled.get() === true && defaults.delaySeconds.get() === 3 && defaults.reviewTimeoutMs.get() === 10000,
  'Config defaults are live references',
)
assert(configured.length === 1 && configured[0].auto === false, 'the plugin opts out of the automatic settings page')
assert(routes.has('/api/anti-blind-approval/action'), 'action route registered')
assert(routes.has('/api/anti-blind-approval/review'), 'review route registered')
assert(routes.has('/api/anti-blind-approval/catalog'), 'catalog route registered')
assert(routes.has('/api/anti-blind-approval/test'), 'test route registered')

const catalog = await routes.get('/api/anti-blind-approval/catalog').fetch(new Request('http://x/api/anti-blind-approval/catalog'))
const cat = await catalog.json()
assert(typeof cat.defaultPrompt === 'string' && cat.defaultPrompt.includes('JSON') === false, 'catalog default prompt')
assert(cat.defaultPrompt.startsWith('You are the approval safety reviewer'), 'default prompt is English')
assert(cat.defaultPrompt.includes('{language}'), 'default prompt carries the language placeholder')
assert(!/[\u4e00-\u9fff]/u.test(cat.defaultPrompt), 'default prompt carries no Chinese prose')
assert(cat.providers[0].models[0].id === 'fake-1', 'catalog models')

const action = await call('/api/anti-blind-approval/action', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r' })
assert(action.value.active === true, 'action active in workspace-write')
assert(action.value.preview.includes('rm -rf /tmp/x'), 'action preview has command')

const safe = await call('/api/anti-blind-approval/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r', userLanguage: 'zh-CN' })
assert(safe.value.safe === true && safe.value.reason === '常规项目操作', 'safe verdict parsed')
assert(safe.value.model === 'fake/fake-1', 'review uses session model')
assert(calls.at(-1).temperature === 0, 'temperature 0')
assert(calls.at(-1).system.includes('Chinese (zh-CN)'), 'placeholder resolves to the user language')
assert(!calls.at(-1).system.includes('{language}'), 'no unresolved placeholder reaches the model')
const sentFacts = calls.at(-1).messages[0].content[0].text
assert(sentFacts.includes('"userLanguage": "zh-CN"'), 'review facts carry the user language')

const noLanguage = await call('/api/anti-blind-approval/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r' })
assert(noLanguage.value.safe === true, 'review without a language still runs')
assert(calls.at(-1).system.includes('English'), 'missing language falls back to English')
assert(!calls.at(-1).system.includes('{language}'), 'fallback still resolves the placeholder')

const custom = await call('/api/anti-blind-approval/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r', prompt: 'Always answer in {language}.', userLanguage: 'zh' })
assert(custom.value.safe === true, 'custom prompt review runs')
assert(calls.at(-1).system.startsWith('Always answer in Chinese (zh).'), 'custom prompt placeholder is substituted')
assert(calls.at(-1).system.split('{language}').length === 1, 'contract placeholder is substituted too')

const junk = await call('/api/anti-blind-approval/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r', userLanguage: 'zh; rm -rf /' })
assert(junk.value.safe === true, 'malformed language does not fail the review')
assert(calls.at(-1).messages[0].content[0].text.includes('"userLanguage": ""'), 'malformed language is dropped')
assert(calls.at(-1).system.includes('English'), 'malformed language falls back to English')

globalThis.__NEXT_TEXT__ = '```json\n{"safe":false,"reason":"删除系统目录"}\n```'
const unsafe = await call('/api/anti-blind-approval/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r' })
assert(unsafe.value.safe === false && unsafe.value.reason === '删除系统目录', 'fenced unsafe verdict parsed')

globalThis.__NEXT_TEXT__ = '{"safe":"yes","reason":"bad"}'
const bad = await call('/api/anti-blind-approval/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r' })
assert(bad.value.errorCode === 'INVALID_OUTPUT', 'invalid output rejected')

globalThis.__NEXT_TEXT__ = '{"safe":true,"reason":"ok"}'
const test = await call('/api/anti-blind-approval/test', {})
assert(test.value.ok === true, 'test route runs a review')
const testAgain = await call('/api/anti-blind-approval/test', { userLanguage: 'en' })
assert(testAgain.value.ok === true, 'test route accepts a language')
assert(calls.at(-1).messages[0].content[0].text.includes('"userLanguage": "en"'), 'test facts carry the user language')

const huge = makeCtx('workspace-write', JSON.stringify({ path: 'big.txt', content: 'x'.repeat(200000) }))
routes.clear()
apply(huge, makeConfig())
globalThis.__NEXT_TEXT__ = '{"safe":true,"reason":"ok"}'
const clipped = await call('/api/anti-blind-approval/review', { sessionId: 's1', callId: 'c1', toolName: 'write', reason: 'r' })
assert(clipped.value.safe === true, 'huge-argument review succeeds')
const sent = calls.at(-1).messages[0].content[0].text
assert(sent.length < 24000, 'review input is clipped')
assert(sent.includes('x'.repeat(100)), 'review input keeps a content prefix')

// The configured timeout is a live handle: it must be honored, and read per
// request rather than once when the routes were registered.
let timeoutReads = 0
const timeoutConfig = makeConfig()
timeoutConfig.reviewTimeoutMs = { get: () => { timeoutReads += 1; return 60 } }
routes.clear()
apply(makeCtx('workspace-write', undefined, { hang: true }), timeoutConfig)
const stalled = await call('/api/anti-blind-approval/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r' })
assert(stalled.value.errorCode === 'TIMEOUT', 'configured review timeout aborts a stalled review')
routes.clear()
apply(makeCtx('workspace-write'), timeoutConfig)
const afterTimeout = await call('/api/anti-blind-approval/review', { sessionId: 's1', callId: 'c1', toolName: 'bash', reason: 'r' })
assert(afterTimeout.value.safe === true, 'a review still runs with the configured timeout')
assert(timeoutReads === 2, 'the timeout is read from the live config per request')

const other = makeCtx('danger-full-access')
routes.clear()
apply(other, makeConfig())
const skipped = await call('/api/anti-blind-approval/action', { sessionId: 's1', callId: 'c1' })
assert(skipped.value.active === false && skipped.value.preset === 'danger-full-access', 'non workspace-write skipped')

console.log('ALL PASS')
