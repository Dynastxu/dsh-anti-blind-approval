// Smoke-test the browser half without a DOM: fake module loader, fake React,
// a stubbed fetch for the plugin's own routes, and a fake `configForms` service
// standing in for the Host settings document.
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
    removeItem: (key) => { storage.delete(key) },
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
  '/api/anti-blind-approval/catalog': { providers: [], defaultPrompt: 'built-in prompt' },
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
const primitives = {
  Button: function Button(props) { return h('button', props) },
  Switch: function Switch(props) { return h('input', { type: 'checkbox', ...props }) },
}
const requireStub = (id) => {
  if (id === 'react') return React
  if (id === 'react/jsx-runtime') return jsxRuntime
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives
  throw new Error('unexpected require ' + id)
}

await import('../lib/client.js')
if (!captured) throw new Error('module was not registered')
if (captured.id !== 'dsh-anti-blind-approval') throw new Error('loader id must be the package name')

const tick = () => new Promise((resolve) => setTimeout(resolve, 20))

/** Depth-first walk over the fake React tree. */
function walk(node, visit) {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  visit(node)
  walk(node.props?.children, visit)
}

/** One browser stand-in for the shared Host settings form. */
function makeConfigForm(initial) {
  const listeners = new Set()
  const state = {
    status: 'ready', writable: true, revision: 0,
    value: { enabled: true, model: '', delaySeconds: 3, prompt: '' },
    user: {},
    ...initial,
  }
  const writes = []
  const form = {
    getSnapshot: () => ({
      status: state.status, value: state.value, base: {}, user: state.user,
      revision: state.revision, writable: state.writable,
    }),
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async set(field, value) {
      writes.push([field, value])
      if (state.accept === false) return false
      state.value = { ...state.value, [field]: value }
      state.user = { ...state.user, [field]: value }
      state.revision += 1
      for (const listener of listeners) listener()
      return true
    },
    async unset(field) {
      writes.push(['unset', field])
      if (state.accept === false) return false
      state.value = { ...state.value, [field]: undefined }
      const user = { ...state.user }
      delete user[field]
      state.user = user
      state.revision += 1
      for (const listener of listeners) listener()
      return true
    },
  }
  return { form, state, writes }
}

/** One fake client context; `slots.inject` runs the registration eagerly. */
function makeCtx(form) {
  const registered = []
  const dicts = {}
  let namespace = null
  const ctx = {
    effect(fn) { return fn() },
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
    configForms: {
      get(ns) { namespace = ns; return form },
    },
  }
  const fakeT = (key, params) => {
    let text = dicts.zh[key] ?? key
    for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll('{' + name + '}', String(value))
    return text
  }
  return { ctx, registered, namespace: () => namespace, t: fakeT }
}

// ---------------------------------------------------------------------------
// Main composition: a writable, ready form.
const config = makeConfigForm()
const main = makeCtx(config.form)
const mod = captured.factory(requireStub)
mod.apply(main.ctx)

if (styleTags.length !== 3) throw new Error('stylesheet was not injected once per apply')
console.log('exports:', Object.keys(mod).join(','))
console.log('client inject:', JSON.stringify(mod.inject))
console.log('registered:', main.registered.map((r) => r.opts.name + '#' + (r.opts.id || '')).join(' | '))

const composer = main.registered.find((r) => r.opts.name === 'conversation.composer')
if (!composer) throw new Error('composer slot missing')
if (composer.opts.priority !== 0) throw new Error('composer priority must precede the stock panel')
const select = composer.opts.select
const approval = { kind: 'approval', key: 'approval:1', toolName: 'bash', reason: 'r', sessionId: 's1', answerable: true }
if (select({ pendingInteraction: approval }) !== approval) throw new Error('approval not selected')
if (select({ pendingInteraction: { kind: 'question' } }) !== null) throw new Error('question wrongly selected')
if (select({ pendingInteraction: undefined }) !== null) throw new Error('absent interaction wrongly selected')
config.state.value = { ...config.state.value, enabled: false }
config.state.revision += 1
if (select({ pendingInteraction: approval }) !== null) throw new Error('a disabled panel must restore the stock approval UI')
config.state.value = { ...config.state.value, enabled: true }
config.state.revision += 1
console.log('composer select ok')

// The reviewer must learn the reader's language from the UI locale, not from the prompt.
const composerInject = typeof composer.opts.inject === 'function' ? composer.opts.inject() : {}
if (typeof composerInject.userLanguage !== 'function') throw new Error('composer inject exposes no userLanguage')
if (composerInject.userLanguage() !== 'zh') throw new Error('userLanguage must follow the active locale')
if (typeof composerInject.reviews?.lookup !== 'function') throw new Error('composer inject exposes no verdict cache')
if (typeof composerInject.settings?.snapshot !== 'function') throw new Error('composer inject exposes no settings handle')
console.log('composer userLanguage ok')

// Render the panel's initial state, then mount its effects.
requests.length = 0
config.state.value = { ...config.state.value, prompt: 'CUSTOM POLICY', model: 'fake::m' }
globalThis.__resetHooks()
const tree = composer.component({
  matched: approval,
  t: main.t,
  resolveReason: (v) => v,
  userLanguage: composerInject.userLanguage,
  reviews: composerInject.reviews,
  settings: composerInject.settings,
})
if (!tree || tree.type !== 'div') throw new Error('panel returned no root')
const flat = JSON.stringify(tree)
for (const needle of ['允许一次', '拒绝', '正在确认审批范围']) {
  if (!flat.includes(needle)) throw new Error('panel missing ' + needle)
}
if (flat.includes('aiar-spinner') === false) throw new Error('panel missing the loading ring')
console.log('panel initial render ok')

const cleanups = globalThis.__runEffects()
await tick()
if (requests.length !== 2) throw new Error('expected an action probe and a review, got ' + requests.length)
if (requests[0].url !== '/api/anti-blind-approval/action') throw new Error('first request must probe the scope')
if (requests[1].url !== '/api/anti-blind-approval/review') throw new Error('second request must run the review')
for (const request of requests) {
  if (request.body.userLanguage !== 'zh') throw new Error('the review must carry the UI language tag, got ' + JSON.stringify(request.body.userLanguage))
  if (request.body.sessionId !== 's1') throw new Error('the review must carry the session id')
  if (request.body.callId !== undefined) throw new Error('this approval has no call id')
}
if (requests[1].body.prompt !== 'CUSTOM POLICY' || requests[1].body.model !== 'fake::m') {
  throw new Error('the review must carry the profile\'s prompt and model: ' + JSON.stringify(requests[1].body))
}
console.log('panel request bodies ok')
for (const cleanup of cleanups) if (typeof cleanup === 'function') cleanup()

// ---------------------------------------------------------------------------
// Settings page: values come from the form and edits are queued through it.
const settings = main.registered.find((r) => r.opts.name === 'settings.section')
if (!settings) throw new Error('settings slot missing')
if (settings.opts.id !== 'anti-blind-approval') throw new Error('settings id wrong')
const settingsInject = typeof settings.opts.inject === 'function' ? settings.opts.inject() : {}
if (typeof settingsInject.settings?.snapshot !== 'function') throw new Error('settings inject exposes no handle')
globalThis.__resetHooks()
const settingsTree = settings.component({
  t: main.t,
  userLanguage: composerInject.userLanguage,
  settings: settingsInject.settings,
  close: () => {},
})
const settingsFlat = JSON.stringify(settingsTree)
for (const needle of ['反盲批', '审核模型', '审核提示词', '测试审核', 'cordis.patch.yml']) {
  if (!settingsFlat.includes(needle)) throw new Error('settings missing ' + needle)
}
console.log('settings render ok')

// Mount the page's effects (subscription + catalog read), then edit the switch.
globalThis.__runEffects()
await tick()
let switchNode = null
walk(settingsTree, (node) => {
  if (node.type === primitives.Switch) switchNode = node
})
if (switchNode === null) throw new Error('settings page renders no switch')
config.writes.length = 0
switchNode.props.onChange(false)
await tick()
if (config.writes.length !== 1 || config.writes[0][0] !== 'enabled' || config.writes[0][1] !== false) {
  throw new Error('the switch must write through configForms: ' + JSON.stringify(config.writes))
}
if (config.state.value.enabled !== false) throw new Error('the form was not updated')
console.log('settings write ok')

// The reset button clears the prompt override instead of writing an empty string.
let resetNode = null
walk(settingsTree, (node) => {
  if (node.type === primitives.Button && node.props?.children === '恢复默认') resetNode = node
})
if (resetNode === null) throw new Error('settings page renders no prompt reset')
config.writes.length = 0
resetNode.props.onClick()
await tick()
if (config.writes.length !== 1 || config.writes[0][0] !== 'unset' || config.writes[0][1] !== 'prompt') {
  throw new Error('reset must unset the prompt override: ' + JSON.stringify(config.writes))
}
console.log('settings reset ok')

console.log('CLIENT SMOKE PASS')
