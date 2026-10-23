// Smoke-test the browser half without a DOM: fake module loader, fake React,
// and a stubbed fetch for the plugin's own routes.
//
// The bundle registers a lazy factory; this harness materializes it, runs the
// plugin's `apply`, renders both surfaces, and mounts the panel's effects so
// the requests it sends are asserted rather than assumed.
let captured = null
const storage = new Map()
globalThis.window = {
  __ModuleLoader__: { load: (def) => { captured = def } },
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, value) },
  },
  setTimeout: () => 0,
}
globalThis.localStorage = window.localStorage
globalThis.navigator ??= { language: 'zh' }
const styleTags = []
globalThis.document = {
  head: { appendChild: (node) => { styleTags.push(node) } },
  createElement() {
    return { dataset: {}, remove() {} }
  },
}

const requests = []
const responses = {
  '/api/anti-blind-approval/action': { active: true, preset: 'workspace-write', preview: 'bash\n{"command":"rm -rf /tmp/x"}' },
  '/api/anti-blind-approval/review': { active: true, safe: false, reason: '删除系统目录', model: 'fake/fake-1' },
}
globalThis.fetch = async (url, init) => {
  requests.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined })
  const body = responses[url] ?? {}
  return { ok: true, status: 200, json: async () => body }
}

let stateSlots = []
let pendingEffects = []
globalThis.__resetHooks = () => { stateSlots = []; pendingEffects = [] }
globalThis.__runEffects = () => {
  const effects = pendingEffects
  pendingEffects = []
  return effects.map((effect) => effect())
}
const h = (type, props) => ({ type, props: props ?? {} })
const React = {
  createElement: (type, props, ...children) => h(type, { ...(props || {}), children }),
  useState(initial) {
    const index = stateSlots.length
    stateSlots.push(typeof initial === 'function' ? initial() : initial)
    return [stateSlots[index], (next) => { stateSlots[index] = typeof next === 'function' ? next(stateSlots[index]) : next }]
  },
  useRef(value) { return { current: value } },
  useCallback(fn) { return fn },
  useEffect(effect) { pendingEffects.push(effect) },
}
const jsxRuntime = { jsx: h, jsxs: h, Fragment: 'Fragment' }

const requireStub = (id) => {
  if (id === 'react') return React
  if (id === 'react/jsx-runtime') return jsxRuntime
  if (id === '@deepseek-ai/dsh-client-ui-primitives') {
    return {
      Button: function Button(props) { return h('button', props) },
      Switch: function Switch(props) { return h('input', { type: 'checkbox' }) },
    }
  }
  throw new Error('unexpected require ' + id)
}

await import('../lib/client.js')
if (!captured) throw new Error('module was not registered')
if (captured.id !== 'dsh-anti-blind-approval') throw new Error('loader id must be the package name')

const mod = captured.factory(requireStub)
const registered = []
const dicts = {}
const fakeT = (key, params) => {
  let text = dicts.zh[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll('{' + name + '}', String(value))
  return text
}
const ctx = {
  effect(fn) { fn() },
  locale: {
    register(ns, map) { dicts.zh = map.zh; return () => {} },
    bind() { return fakeT },
    resolveText(value) { return typeof value === 'string' ? value : value.zh || value.en || '' },
    getSnapshot() { return { active: 'zh', locales: [], revision: 0 } },
  },
  slots: {
    inject(_name, cb) { return cb() },
    register(opts, component) {
      registered.push({ opts, component })
      return { dispose() {} }
    },
  },
}
mod.apply(ctx)

if (styleTags.length !== 1) throw new Error('stylesheet was not injected once')
console.log('exports:', Object.keys(mod).join(','))
console.log('client inject:', JSON.stringify(mod.inject))
console.log('registered:', registered.map((r) => r.opts.name + '#' + (r.opts.id || '')).join(' | '))

const composer = registered.find((r) => r.opts.name === 'conversation.composer')
if (!composer) throw new Error('composer slot missing')
if (composer.opts.priority !== 0) throw new Error('composer priority must precede the stock panel')
const select = composer.opts.select
const approval = { kind: 'approval', key: 'approval:1', toolName: 'bash', reason: 'r', sessionId: 's1', answerable: true }
if (select({ pendingInteraction: approval }) !== approval) throw new Error('approval not selected')
if (select({ pendingInteraction: { kind: 'question' } }) !== null) throw new Error('question wrongly selected')
if (select({ pendingInteraction: undefined }) !== null) throw new Error('absent interaction wrongly selected')

// The reviewer must learn the reader's language from the UI locale, not from the prompt.
const composerInject = typeof composer.opts.inject === 'function' ? composer.opts.inject() : {}
if (typeof composerInject.userLanguage !== 'function') throw new Error('composer inject exposes no userLanguage')
if (composerInject.userLanguage() !== 'zh') throw new Error('userLanguage must follow the active locale')
if (typeof composerInject.reviews?.lookup !== 'function') throw new Error('composer inject exposes no verdict cache')
console.log('composer userLanguage ok')

// Render the panel's initial state, then mount its effects.
globalThis.__resetHooks()
const tree = composer.component({
  matched: approval,
  t: fakeT,
  resolveReason: (v) => v,
  userLanguage: composerInject.userLanguage,
  reviews: composerInject.reviews,
})
if (!tree || tree.type !== 'div') throw new Error('panel returned no root')
const flat = JSON.stringify(tree)
for (const needle of ['允许一次', '拒绝', '正在确认审批范围']) {
  if (!flat.includes(needle)) throw new Error('panel missing ' + needle)
}
if (flat.includes('aiar-spinner') === false) throw new Error('panel missing the loading ring')
console.log('panel initial render ok')

const cleanups = globalThis.__runEffects()
await new Promise((resolve) => setTimeout(resolve, 20))
if (requests.length !== 2) throw new Error('expected an action probe and a review, got ' + requests.length)
if (requests[0].url !== '/api/anti-blind-approval/action') throw new Error('first request must probe the scope')
if (requests[1].url !== '/api/anti-blind-approval/review') throw new Error('second request must run the review')
for (const request of requests) {
  if (request.body.userLanguage !== 'zh') throw new Error('the review must carry the UI language tag, got ' + JSON.stringify(request.body.userLanguage))
  if (request.body.sessionId !== 's1') throw new Error('the review must carry the session id')
  if (request.body.callId !== undefined) throw new Error('this approval has no call id')
}
if (requests[1].body.prompt !== '' || requests[1].body.model !== '') throw new Error('empty overrides must follow the session route')
console.log('panel request bodies ok')
for (const cleanup of cleanups) if (typeof cleanup === 'function') cleanup()

const settings = registered.find((r) => r.opts.name === 'settings.section')
if (!settings) throw new Error('settings slot missing')
if (settings.opts.id !== 'anti-blind-approval') throw new Error('settings id wrong')
globalThis.__resetHooks()
const settingsTree = settings.component({
  t: fakeT,
  userLanguage: composerInject.userLanguage,
  close: () => {},
})
const settingsFlat = JSON.stringify(settingsTree)
for (const needle of ['反盲批', '审核模型', '审核提示词', '测试审核']) {
  if (!settingsFlat.includes(needle)) throw new Error('settings missing ' + needle)
}
console.log('settings render ok')
console.log('CLIENT SMOKE PASS')
