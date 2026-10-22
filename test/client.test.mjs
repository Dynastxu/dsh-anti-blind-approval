// Smoke-test the browser half without a DOM: fake loader + fake React hooks.
let captured = null
globalThis.window = {
  __ModuleLoader__: { load: (def) => { captured = def } },
  localStorage: {
    _v: '',
    getItem() { return this._v || null },
    setItem(_k, v) { this._v = v },
  },
}
globalThis.document = {
  head: { appendChild() {} },
  createElement() { return { dataset: {}, remove() {} } },
}

function createElement(type, props, ...children) {
  return { type, props: { ...(props || {}), children } }
}

let stateSlots = []
globalThis.__resetHooks = () => { stateSlots = [] }
const React = {
  createElement,
  useState(initial) {
    const index = stateSlots.length
    const value = typeof initial === 'function' ? initial() : initial
    stateSlots.push(value)
    return [value, (next) => { stateSlots[index] = typeof next === 'function' ? next(stateSlots[index]) : next }]
  },
  useRef(value) { return { current: value } },
  useEffect() {},
}

const requireStub = (id) => {
  if (id === 'react') return React
  if (id === '@deepseek-ai/dsh-client-ui-primitives') {
    return {
      Button: function Button(props) { return createElement('button', props, props.children) },
      Switch: function Switch(props) { return createElement('input', { type: 'checkbox' }) },
    }
  }
  throw new Error('unexpected require ' + id)
}

await import('../lib/client.js')
if (!captured) throw new Error('module was not registered')

const mod = captured.factory(requireStub)
const registered = []
const dicts = {}
const fakeT = (key) => dicts.zh[key] ?? key
const ctx = {
  effect(fn) { fn() },
  locale: {
    register(ns, map) { dicts.zh = map.zh; return () => {} },
    bind() { return fakeT },
    resolveText(value) { return typeof value === 'string' ? value : value.zh || value.en || '' },
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

// Render the panel's initial state.
globalThis.__resetHooks()
const tree = composer.component({
  matched: approval,
  t: fakeT,
  resolveReason: (v) => v,
})
if (!tree || tree.type !== 'div') throw new Error('panel returned no root')
const flat = JSON.stringify(tree)
for (const needle of ['允许一次', '拒绝', '正在确认审批范围']) {
  if (!flat.includes(needle)) throw new Error('panel missing ' + needle)
}
if (flat.includes('aiar-spinner') === false) throw new Error('panel missing the loading ring')
console.log('panel initial render ok')

const settings = registered.find((r) => r.opts.name === 'settings.section')
if (!settings) throw new Error('settings slot missing')
if (settings.opts.id !== 'ai-approval-review') throw new Error('settings id wrong')
globalThis.__resetHooks()
const settingsTree = settings.component({ t: fakeT })
const settingsFlat = JSON.stringify(settingsTree)
for (const needle of ['AI 审批审核', '审核模型', '审核提示词', '测试审核']) {
  if (!settingsFlat.includes(needle)) throw new Error('settings missing ' + needle)
}
console.log('settings render ok')
console.log('CLIENT SMOKE PASS')
