/**
 * dsh-ai-approval-review — browser half.
 *
 * Two contributions:
 *   1. `conversation.composer` takeover for pending approvals. For a
 *      `workspace-write` session it probes the host, shows the pending action,
 *      asks the host for one JSON safety verdict, keeps Allow disabled while
 *      the review runs, and (on "unsafe" / failure) keeps it disabled for the
 *      configured cool-down. The human still makes the final decision.
 *   2. `settings.section` page: enable switch, reviewer model, cool-down, and
 *      the custom prompt, persisted in localStorage.
 *
 * Loaded through the shell's module table, so only baseline modules are
 * required: react and (optionally) the UI primitives.
 */
(function (root) {
  if (!root || !root.__ModuleLoader__ || typeof root.__ModuleLoader__.load !== 'function') return

  root.__ModuleLoader__.load({
    id: 'dsh-ai-approval-review',
    factory: function (require) {
      var module = { exports: {} }
      var exports = module.exports
      Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

      var React = require('react')
      var primitives = null
      try {
        primitives = require('@deepseek-ai/dsh-client-ui-primitives')
      } catch (error) {
        primitives = null
      }

      var h = React.createElement
      var PLUGIN_ID = 'dsh-ai-approval-review'
      var NS = 'ai-approval-review'
      var STORAGE_KEY = 'dsh-ai-approval-review:v1'
      var BASE = '/api/ai-approval-review'
      /** Verdicts already paid for in this page, keyed by session + call id. */
      var reviewCache = new Map()

      // ───────────────────────────── styles ─────────────────────────────
      var CSS = [
        '@keyframes aiar-spin{to{transform:rotate(360deg)}}',
        '.aiar-root{padding:8px calc(var(--dsh-composer-side-clearance) + 16px) 12px;flex-direction:column;align-items:center;display:flex}',
        '.aiar-card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);border-radius:var(--dsw-radius-xl,var(--dsw-radius-lg));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1));box-shadow:var(--dsw-shadow-lv2);overflow:hidden}',
        '.aiar-strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}',
        '.aiar-strip[data-tone="ok"]{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}',
        '.aiar-strip[data-tone="bad"]{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}',
        '.aiar-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}',
        '.aiar-dot[data-pulse="true"]{animation:aiar-pulse 1.2s ease-in-out infinite}',
        '@keyframes aiar-pulse{0%,100%{opacity:.35}50%{opacity:1}}',
        '.aiar-body{box-sizing:border-box;max-height:var(--dsh-composer-text-max-height,320px);flex-direction:column;gap:6px;padding:12px 16px 0;display:flex;overflow-y:auto}',
        '.aiar-headline{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500;line-height:24px;overflow-wrap:anywhere}',
        '.aiar-command{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);word-break:break-all;font-size:13px;line-height:20px}',
        '.aiar-review{display:flex;flex-direction:column;gap:2px;font-size:13px;line-height:20px}',
        '.aiar-reviewTitle{font-weight:500;color:var(--dsw-alias-label-primary)}',
        '.aiar-review[data-tone="ok"] .aiar-reviewTitle{color:var(--dsw-alias-state-success-primary)}',
        '.aiar-review[data-tone="bad"] .aiar-reviewTitle{color:var(--dsw-alias-state-error-primary)}',
        '.aiar-review[data-tone="warn"] .aiar-reviewTitle{color:var(--dsw-alias-state-warn-primary)}',
        '.aiar-reviewBody{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere}',
        '.aiar-reviewMeta{color:var(--dsw-alias-label-tertiary);font-size:12px}',
        '.aiar-pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);max-height:180px;overflow:auto}',
        '.aiar-actionRow{align-items:center;justify-content:flex-end;gap:8px;padding:14px 16px;display:flex}',
        '.aiar-hold{margin-right:auto;color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:18px}',
        '.aiar-hold[data-tone="bad"]{color:var(--dsw-alias-state-error-primary)}',
        '.aiar-spinner{width:12px;height:12px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:aiar-spin .8s linear infinite;display:inline-block;vertical-align:-2px;flex:none}',
        '.aiar-btnLabel{align-items:center;gap:6px;display:inline-flex}',
        // settings page
        '.aiar-settings{max-width:760px;flex-direction:column;gap:12px;display:flex;color:var(--dsw-alias-label-primary)}',
        '.aiar-settingsTitle{margin:0;font-size:18px;font-weight:600}',
        '.aiar-settingsIntro{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}',
        '.aiar-panel{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);padding:0 14px;display:flex;flex-direction:column}',
        '.aiar-row{display:flex;align-items:center;gap:16px;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1)}',
        '.aiar-row:first-child{border-top:0}',
        '.aiar-rowText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
        '.aiar-rowLabel{font-size:14px;line-height:22px}',
        '.aiar-rowHint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
        '.aiar-column{display:flex;flex-direction:column;gap:6px;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1)}',
        '.aiar-columnTitle{font-size:14px;line-height:22px}',
        '.aiar-select,.aiar-number,.aiar-input{box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);padding:5px 8px;font:inherit;font-size:13px;line-height:20px}',
        '.aiar-select{min-width:260px;max-width:100%}',
        '.aiar-number{width:96px}',
        '.aiar-textarea{box-sizing:border-box;width:100%;min-height:220px;resize:vertical;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);padding:8px 10px;font-family:var(--ds-font-family-code);font-size:12px;line-height:18px}',
        '.aiar-textarea:focus,.aiar-select:focus,.aiar-number:focus{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}',
        '.aiar-toolbar{display:flex;align-items:center;gap:8px;padding-top:10px}',
        '.aiar-btn{font:inherit;font-size:13px;line-height:20px;padding:4px 12px;border-radius:var(--dsw-radius-md);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer}',
        '.aiar-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
        '.aiar-btn:disabled{opacity:.5;cursor:default}',
        '.aiar-btn[data-variant="primary"]{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground);border-color:transparent}',
        '.aiar-status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
        '.aiar-status[data-tone="ok"]{color:var(--dsw-alias-state-success-primary)}',
        '.aiar-status[data-tone="bad"]{color:var(--dsw-alias-state-error-primary)}',
        '.aiar-status[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary)}',
      ].join('')

      // ─────────────────────────── dictionaries ───────────────────────────
      var ZH = {
        nav: '反盲批',
        title: '反盲批',
        intro: '会话处于「工作区内修改」时，先把提权申请交给模型审核：审核期间「允许」不可点；判为不安全时再锁定一段时间。最终决定权仍在人。',
        enabled: '启用 AI 审核',
        enabledHint: '关闭后恢复原生审批面板',
        model: '审核模型',
        modelHint: '留空使用当前会话模型',
        modelCurrent: '当前会话模型（默认）',
        delay: '不安全时锁定时长（秒）',
        delayHint: '0 表示审核结果不锁定按钮',
        prompt: '审核提示词',
        promptHint: '留空使用内置默认提示词；JSON 输出格式由插件固定追加，不受此设置影响',
        promptReset: '恢复默认',
        promptDefault: '内置默认提示词',
        test: '测试审核',
        testing: '审核中…',
        testOk: '模型可用',
        testFail: '测试失败',
        saved: '已保存',
        catalogFail: '无法读取模型列表，将使用当前会话模型。',
        storageHint: '设置保存在当前浏览器（localStorage），不会写入 DSH 配置。',
        waiting: '等待审批',
        checking: '正在确认审批范围',
        reviewing: 'AI 审核中…',
        safe: 'AI 审核通过',
        unsafe: 'AI 审核未通过',
        error: 'AI 审核不可用',
        escalation: '工具 {toolName} 请求越权执行',
        detailAria: '审批详情',
        preview: '待审操作',
        allowOnce: '允许一次',
        reject: '拒绝',
        hold: '{seconds} 秒后可允许',
        verdictSafe: '模型判断此操作无明显安全风险，请确认后允许。',
        verdictUnsafe: '模型判断此操作存在安全风险：',
        verdictError: '审核未能完成，已按防误点策略短暂锁定：',
        'err.NO_SESSION': '找不到会话',
        'err.NO_MODEL': '没有可用的审核模型',
        'err.INVALID_OUTPUT': '模型返回格式不符合 JSON 约定',
        'err.TIMEOUT': '审核超时',
        'err.LLM_ERROR': '模型调用失败',
        'err.LLM_NO_FINISH': '模型没有正常结束',
        'err.REVIEW_FAILED': '审核失败',
        'err.BAD_REQUEST': '请求格式错误',
        'err.NETWORK': '网络或服务不可用',
        'err.ABORTED': '审核已取消',
      }
      var EN = {
        nav: 'Anti Blind Approval',
        title: 'Anti Blind Approval',
        intro: 'In a Workspace Write session, the escalation request is reviewed by a model before you decide: Allow stays disabled while the review runs, and for a while after an unsafe verdict. You still make the final call.',
        enabled: 'Enable AI review',
        enabledHint: 'Turn off to restore the stock approval panel',
        model: 'Review model',
        modelHint: 'Leave empty to use the current session model',
        modelCurrent: 'Current session model (default)',
        delay: 'Lock Allow for (seconds)',
        delayHint: '0 means the verdict never locks the buttons',
        prompt: 'Review prompt',
        promptHint: 'Empty uses the built-in prompt; the JSON output contract is appended by the plugin and is not editable',
        promptReset: 'Restore default',
        promptDefault: 'Built-in default prompt',
        test: 'Test review',
        testing: 'Reviewing…',
        testOk: 'Model is available',
        testFail: 'Test failed',
        saved: 'Saved',
        catalogFail: 'Could not load the model list; the current session model will be used.',
        storageHint: 'Settings live in this browser (localStorage); they are not written into the DSH configuration.',
        waiting: 'Waiting for approval',
        checking: 'Checking approval scope',
        reviewing: 'AI reviewing…',
        safe: 'AI review passed',
        unsafe: 'AI review failed',
        error: 'AI review unavailable',
        escalation: 'Tool {toolName} requests privileged execution',
        detailAria: 'Approval details',
        preview: 'Pending action',
        allowOnce: 'Allow once',
        reject: 'Reject',
        hold: 'Allow in {seconds}s',
        verdictSafe: 'The model found no obvious risk in this action. Confirm to allow.',
        verdictUnsafe: 'The model flagged this action: ',
        verdictError: 'The review did not finish; the anti-blind-click hold is active: ',
        'err.NO_SESSION': 'Session not found',
        'err.NO_MODEL': 'No review model is available',
        'err.INVALID_OUTPUT': 'The model output did not match the JSON contract',
        'err.TIMEOUT': 'The review timed out',
        'err.LLM_ERROR': 'The model call failed',
        'err.LLM_NO_FINISH': 'The model stream did not finish',
        'err.REVIEW_FAILED': 'The review failed',
        'err.BAD_REQUEST': 'Malformed request',
        'err.NETWORK': 'Network or service unavailable',
        'err.ABORTED': 'Review cancelled',
      }

      function fallbackT(key) {
        return (ZH[key] !== undefined ? ZH[key] : key)
      }

      function format(t, key, params) {
        var text = t(key)
        if (text === key) text = fallbackT(key)
        if (params === undefined || params === null) return text
        return String(text).replace(/\{([a-zA-Z0-9_.]+)\}/g, function (match, name) {
          return params[name] === undefined ? match : String(params[name])
        })
      }

      // ─────────────────────────── settings store ───────────────────────────
      function normalizeSettings(raw) {
        var value = raw !== null && typeof raw === 'object' ? raw : {}
        var delay = Number(value.delaySeconds)
        if (!isFinite(delay)) delay = 3
        delay = Math.max(0, Math.min(30, Math.round(delay)))
        return {
          enabled: value.enabled !== false,
          model: typeof value.model === 'string' ? value.model : '',
          delaySeconds: delay,
          prompt: typeof value.prompt === 'string' ? value.prompt : '',
        }
      }

      var settingsCache = null
      function readSettings() {
        if (settingsCache !== null) return settingsCache
        var raw = null
        try {
          raw = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || 'null')
        } catch (error) {
          raw = null
        }
        settingsCache = normalizeSettings(raw)
        return settingsCache
      }

      function writeSettings(patch) {
        var next = normalizeSettings(Object.assign({}, readSettings(), patch || {}))
        settingsCache = next
        try {
          root.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch (error) {
          /* private mode / quota: keep the in-memory value */
        }
      }

      // ─────────────────────────── http helpers ───────────────────────────
      function postJson(url, body, signal) {
        return fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: signal,
        }).then(function (response) {
          if (response.status === 404) {
            var missing = new Error('NOT_FOUND')
            missing.status = 404
            throw missing
          }
          if (!response.ok) {
            var failure = new Error('HTTP_' + String(response.status))
            failure.status = response.status
            throw failure
          }
          return response.json()
        })
      }

      function getJson(url) {
        return fetch(url, { method: 'GET', credentials: 'same-origin', headers: { accept: 'application/json' } }).then(function (response) {
          if (!response.ok) throw new Error('HTTP_' + String(response.status))
          return response.json()
        })
      }

      function errorText(t, failure) {
        var code = failure !== null && typeof failure === 'object' && typeof failure.errorCode === 'string' ? failure.errorCode : 'REVIEW_FAILED'
        var label = t('err.' + code)
        if (label === 'err.' + code) label = t('err.REVIEW_FAILED')
        var detail = failure !== null && typeof failure === 'object' && typeof failure.detail === 'string' ? failure.detail : ''
        return detail === '' ? label : label + ' (' + detail + ')'
      }

      // ─────────────────────────── shared UI ───────────────────────────
      var BaseButton = primitives !== null && typeof primitives.Button === 'function'
        ? primitives.Button
        : function FallbackButton(props) {
            var children = props.children
            return h('button', {
              type: 'button',
              className: props.className,
              disabled: props.disabled,
              onClick: props.onClick,
              'data-variant': props.variant,
            }, children)
          }

      function SwitchControl(props) {
        if (primitives !== null && typeof primitives.Switch === 'function') {
          return h(primitives.Switch, {
            checked: props.checked,
            label: props.label,
            disabled: props.disabled,
            onChange: props.onChange,
          })
        }
        return h('input', {
          type: 'checkbox',
          checked: props.checked,
          disabled: props.disabled,
          'aria-label': props.label,
          onChange: function (event) {
            props.onChange(event.currentTarget.checked)
          },
        })
      }

      function Dot(props) {
        return h('span', { className: 'aiar-dot', 'data-pulse': props.pulse ? 'true' : undefined })
      }

      // ─────────────────────────── approval panel ───────────────────────────
      function ApprovalPanel(props) {
        var pending = props.matched
        var t = typeof props.t === 'function' ? props.t : fallbackT

        var phaseState = React.useState('checking')
        var phase = phaseState[0]
        var setPhase = phaseState[1]

        var previewState = React.useState('')
        var preview = previewState[0]
        var setPreview = previewState[1]

        var verdictState = React.useState(null)
        var verdict = verdictState[0]
        var setVerdict = verdictState[1]

        var failureState = React.useState(null)
        var failure = failureState[0]
        var setFailure = failureState[1]

        var answeredState = React.useState(false)
        var answered = answeredState[0]
        var setAnswered = answeredState[1]

        var countdownState = React.useState({ until: 0, left: 0 })
        var countdown = countdownState[0]
        var setCountdown = countdownState[1]

        var waitingRef = React.useRef(false)
        var aliveRef = React.useRef(true)
        var allowRef = React.useRef(false)

        var reasonText = pending.reason
        if (pending.displayReason !== undefined && typeof props.resolveReason === 'function') {
          try {
            reasonText = props.resolveReason(pending.displayReason)
          } catch (error) {
            reasonText = pending.reason
          }
        }
        if (typeof reasonText !== 'string' || reasonText === '') {
          reasonText = format(t, 'escalation', { toolName: String(pending.toolName || '') })
        }

        function beginHold(seconds) {
          var value = Number(seconds)
          if (!isFinite(value) || value <= 0) {
            setCountdown({ until: 0, left: 0 })
            return
          }
          setCountdown({ until: Date.now() + value * 1000, left: Math.ceil(value) })
        }

        React.useEffect(function () {
          if (countdown.until === 0) return undefined
          var timer = setInterval(function () {
            var left = Math.max(0, Math.ceil((countdown.until - Date.now()) / 1000))
            setCountdown(function (previous) {
              if (previous.until !== countdown.until) return previous
              return { until: previous.until, left: left }
            })
            if (left <= 0) clearInterval(timer)
          }, 200)
          return function () {
            clearInterval(timer)
          }
        }, [countdown.until])

        React.useEffect(function () {
          aliveRef.current = true
          return function () {
            aliveRef.current = false
          }
        }, [])

        React.useEffect(function () {
          var settings = readSettings()
          if (!settings.enabled) {
            setPhase('off')
            return undefined
          }
          var cacheKey = typeof pending.callId === 'string' && pending.callId !== ''
            ? String(pending.sessionId || '') + '\u0000' + pending.callId
            : ''
          var cached = cacheKey === '' ? undefined : reviewCache.get(cacheKey)
          if (cached !== undefined) {
            if (typeof cached.preview === 'string') setPreview(cached.preview)
            setVerdict({ safe: cached.safe, reason: cached.reason, model: cached.model })
            if (cached.safe) {
              setPhase('safe')
            } else {
              setPhase('unsafe')
              beginHold(settings.delaySeconds)
            }
            return undefined
          }
          var controller = new AbortController()
          var base = {
            sessionId: pending.sessionId,
            toolName: pending.toolName,
            callId: pending.callId,
            reason: pending.reason,
            displayReason: typeof pending.displayReason === 'string' ? pending.displayReason : undefined,
          }

          postJson(BASE + '/action', base, controller.signal)
            .then(function (action) {
              if (!aliveRef.current) return undefined
              if (action === null || typeof action !== 'object' || action.active !== true) {
                setPhase('off')
                return undefined
              }
              if (typeof action.preview === 'string') setPreview(action.preview)
              setPhase('reviewing')
              return postJson(BASE + '/review', Object.assign({}, base, {
                prompt: settings.prompt || '',
                model: settings.model || '',
              }), controller.signal).then(function (result) {
                if (!aliveRef.current) return
                if (result === null || typeof result !== 'object') {
                  setFailure({ errorCode: 'REVIEW_FAILED' })
                  setPhase('error')
                  beginHold(settings.delaySeconds)
                  return
                }
                if (typeof result.errorCode === 'string') {
                  setFailure(result)
                  setPhase('error')
                  beginHold(settings.delaySeconds)
                  return
                }
                if (typeof result.preview === 'string' && result.preview !== '') setPreview(result.preview)
                var safe = result.safe === true
                var verdictValue = { safe: safe, reason: typeof result.reason === 'string' ? result.reason : '', model: typeof result.model === 'string' ? result.model : '' }
                setVerdict(verdictValue)
                if (cacheKey !== '') {
                  if (reviewCache.size >= 64) reviewCache.clear()
                  reviewCache.set(cacheKey, {
                    safe: verdictValue.safe,
                    reason: verdictValue.reason,
                    model: verdictValue.model,
                    preview: typeof result.preview === 'string' ? result.preview : '',
                  })
                }
                if (safe) {
                  setPhase('safe')
                } else {
                  setPhase('unsafe')
                  beginHold(settings.delaySeconds)
                }
              })
            })
            .catch(function (error) {
              if (!aliveRef.current || controller.signal.aborted) return
              if (error !== null && error !== undefined && error.status === 404) {
                // No host route: the host half is not composed. Keep the native
                // approval experience instead of blocking on a missing review.
                setPhase('off')
                return
              }
              setFailure({ errorCode: 'NETWORK', detail: String(error && error.message ? error.message : error) })
              setPhase('error')
              beginHold(settings.delaySeconds)
            })

          return function () {
            controller.abort()
          }
        }, [pending.key])

        var reviewing = phase === 'checking' || phase === 'reviewing'
        var holdActive = (phase === 'unsafe' || phase === 'error') && countdown.left > 0
        var allowEnabled = !answered && !reviewing && !holdActive
        allowRef.current = allowEnabled

        function answer(outcome) {
          var current = pending
          if (waitingRef.current || current === undefined || current === null) return
          if (current.answerable === false) return
          if (outcome === 'allowed-once' && !allowRef.current) return
          waitingRef.current = true
          setAnswered(true)
          try {
            Promise.resolve(current.answer(outcome)).catch(function () {
              if (!aliveRef.current || current.answerable === false) return
              waitingRef.current = false
              setAnswered(false)
            })
          } catch (error) {
            waitingRef.current = false
            setAnswered(false)
          }
        }

        function onKeyDown(event) {
          var element = event.target
          if (event.defaultPrevented) return
          if (!event.currentTarget.contains(document.activeElement)) return
          if (element !== null && element !== undefined && typeof element.closest === 'function' && element.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]') !== null) return
          if (event.key !== 'Enter' && event.key !== 'Escape') return
          if (event.key === 'Enter' && element !== null && element !== undefined && typeof element.closest === 'function' && element.closest('button, a[href], [role="button"]') !== null) return
          if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
          event.preventDefault()
          event.stopPropagation()
          if (event.repeat || (event.nativeEvent !== undefined && event.nativeEvent.isComposing) || event.keyCode === 229) return
          answer(event.key === 'Enter' ? 'allowed-once' : 'rejected')
        }

        var stripText = format(t, 'waiting')
        var tone = 'warn'
        if (phase === 'checking') {
          stripText = format(t, 'checking')
        } else if (phase === 'reviewing') {
          stripText = format(t, 'reviewing')
        } else if (phase === 'safe') {
          stripText = format(t, 'safe')
          tone = 'ok'
        } else if (phase === 'unsafe') {
          stripText = format(t, 'unsafe')
          tone = 'bad'
        } else if (phase === 'error') {
          stripText = format(t, 'error')
          tone = 'warn'
        }

        var reviewBox = null
        if (phase === 'safe' && verdict !== null) {
          reviewBox = h('div', { className: 'aiar-review', 'data-tone': 'ok' }, [
            h('div', { className: 'aiar-reviewTitle', key: 'title' }, format(t, 'verdictSafe')),
            h('div', { className: 'aiar-reviewBody', key: 'body' }, verdict.reason),
            verdict.model !== '' ? h('div', { className: 'aiar-reviewMeta', key: 'meta' }, verdict.model) : null,
          ])
        } else if (phase === 'unsafe' && verdict !== null) {
          reviewBox = h('div', { className: 'aiar-review', 'data-tone': 'bad' }, [
            h('div', { className: 'aiar-reviewTitle', key: 'title' }, format(t, 'verdictUnsafe')),
            h('div', { className: 'aiar-reviewBody', key: 'body' }, verdict.reason),
            verdict.model !== '' ? h('div', { className: 'aiar-reviewMeta', key: 'meta' }, verdict.model) : null,
          ])
        } else if (phase === 'error') {
          reviewBox = h('div', { className: 'aiar-review', 'data-tone': 'warn' }, [
            h('div', { className: 'aiar-reviewTitle', key: 'title' }, format(t, 'verdictError')),
            h('div', { className: 'aiar-reviewBody', key: 'body' }, errorText(t, failure)),
          ])
        }

        var previewBox = preview === '' ? null : h('div', { className: 'aiar-command' }, [
          h('div', { className: 'aiar-reviewMeta', key: 'label' }, format(t, 'preview')),
          h('pre', { className: 'aiar-pre', key: 'pre' }, preview),
        ])

        var holdNote = holdActive
          ? h('span', { className: 'aiar-hold', 'data-tone': tone === 'bad' ? 'bad' : undefined, role: 'status' }, format(t, 'hold', { seconds: countdown.left }))
          : null

        return h('div', {
          className: 'aiar-root',
          'data-approval-key': pending.key,
          'data-phase': phase,
          'aria-busy': answered || reviewing ? 'true' : 'false',
          tabIndex: 0,
          onKeyDown: onKeyDown,
        }, h('div', { className: 'aiar-card' }, [
          h('div', { className: 'aiar-strip', 'data-tone': tone, key: 'strip' }, [
            h(Dot, { pulse: reviewing, key: 'dot' }),
            h('span', { key: 'text' }, stripText),
          ]),
          h('div', { className: 'aiar-body', 'data-approval-scroll': '', tabIndex: 0, role: 'group', 'aria-label': format(t, 'detailAria'), key: 'body' }, [
            h('div', { className: 'aiar-headline', key: 'headline' }, reasonText),
            reviewBox,
            previewBox,
          ]),
          h('div', { className: 'aiar-actionRow', key: 'actions' }, [
            holdNote,
            h(BaseButton, {
              key: 'reject',
              variant: 'outline',
              disabled: answered,
              onClick: function () {
                answer('rejected')
              },
            }, h('span', { className: 'aiar-btnLabel' }, format(t, 'reject'))),
            h(BaseButton, {
              key: 'allow',
              variant: 'primary',
              disabled: !allowEnabled,
              onClick: function () {
                answer('allowed-once')
              },
            }, h('span', { className: 'aiar-btnLabel' }, [
              reviewing ? h('span', { className: 'aiar-spinner', 'aria-hidden': 'true', key: 'spin' }) : null,
              h('span', { key: 'text' }, format(t, 'allowOnce')),
            ])),
          ]),
        ]))
      }

      // ─────────────────────────── settings page ───────────────────────────
      function SettingsSection(props) {
        var t = typeof props.t === 'function' ? props.t : fallbackT
        var settingsState = React.useState(readSettings)
        var settings = settingsState[0]
        var setSettings = settingsState[1]
        var catalogState = React.useState(null)
        var catalog = catalogState[0]
        var setCatalog = catalogState[1]
        var catalogErrorState = React.useState('')
        var catalogError = catalogErrorState[0]
        var setCatalogError = catalogErrorState[1]
        var draftState = React.useState(settings.prompt)
        var draft = draftState[0]
        var setDraft = draftState[1]
        var savedState = React.useState(false)
        var saved = savedState[0]
        var setSaved = savedState[1]
        var testState = React.useState(null)
        var test = testState[0]
        var setTest = testState[1]
        var settingsRef = React.useRef(settings)
        settingsRef.current = settings
        var savedTimer = React.useRef(0)

        React.useEffect(function () {
          var alive = true
          getJson(BASE + '/catalog')
            .then(function (data) {
              if (!alive) return
              setCatalog(data)
              if (settingsRef.current.prompt === '' && data !== null && typeof data === 'object' && typeof data.defaultPrompt === 'string') {
                setDraft(data.defaultPrompt)
              }
            })
            .catch(function (error) {
              if (alive) setCatalogError(String(error && error.message ? error.message : error))
            })
          return function () {
            alive = false
          }
        }, [])

        React.useEffect(function () {
          return function () {
            if (savedTimer.current !== 0) clearTimeout(savedTimer.current)
          }
        }, [])

        function patch(next) {
          writeSettings(next)
          setSettings(readSettings())
          setSaved(true)
          if (savedTimer.current !== 0) clearTimeout(savedTimer.current)
          savedTimer.current = setTimeout(function () {
            setSaved(false)
            savedTimer.current = 0
          }, 1600)
        }

        function runTest() {
          setTest({ status: 'running', text: format(t, 'testing') })
          postJson(BASE + '/test', { prompt: draft || '', model: settings.model || '' }, undefined)
            .then(function (data) {
              if (data !== null && typeof data === 'object' && data.ok === true) {
                setTest({ status: 'ok', text: format(t, 'testOk') + ' · ' + String(data.model || '') + ' · ' + (data.safe === true ? 'safe=true' : 'safe=false') })
              } else {
                setTest({ status: 'fail', text: format(t, 'testFail') + ' · ' + errorText(t, data) })
              }
            })
            .catch(function (error) {
              setTest({ status: 'fail', text: format(t, 'testFail') + ' · ' + String(error && error.message ? error.message : error) })
            })
        }

        var providers = catalog !== null && typeof catalog === 'object' && Array.isArray(catalog.providers) ? catalog.providers : []
        var modelOptions = [h('option', { value: '', key: '__current' }, format(t, 'modelCurrent'))]
        providers.forEach(function (provider) {
          if (provider === null || typeof provider !== 'object' || !Array.isArray(provider.models)) return
          var options = []
          provider.models.forEach(function (model) {
            if (model === null || typeof model !== 'object' || typeof model.id !== 'string') return
            options.push(h('option', { value: String(provider.id) + '::' + model.id, key: String(provider.id) + '::' + model.id }, model.name || model.id))
          })
          if (options.length === 0) return
          modelOptions.push(h('optgroup', { label: String(provider.name || provider.id), key: String(provider.id) }, options))
        })

        var testText = test === null ? '' : test.text
        var testTone = test === null ? undefined : test.status === 'ok' ? 'ok' : test.status === 'fail' ? 'bad' : undefined

        return h('div', { className: 'aiar-settings' }, [
          h('h2', { className: 'aiar-settingsTitle', key: 'title' }, format(t, 'title')),
          h('p', { className: 'aiar-settingsIntro', key: 'intro' }, format(t, 'intro')),
          h('div', { className: 'aiar-panel', key: 'panel' }, [
            h('div', { className: 'aiar-row', key: 'enabled' }, [
              h('div', { className: 'aiar-rowText' }, [
                h('div', { className: 'aiar-rowLabel', key: 'label' }, format(t, 'enabled')),
                h('div', { className: 'aiar-rowHint', key: 'hint' }, format(t, 'enabledHint')),
              ]),
              h(SwitchControl, {
                checked: settings.enabled,
                label: format(t, 'enabled'),
                onChange: function (next) {
                  patch({ enabled: next === true })
                },
              }),
            ]),
            h('div', { className: 'aiar-row', key: 'model' }, [
              h('div', { className: 'aiar-rowText' }, [
                h('div', { className: 'aiar-rowLabel', key: 'label' }, format(t, 'model')),
                h('div', { className: 'aiar-rowHint', key: 'hint' }, format(t, 'modelHint')),
              ]),
              h('select', {
                className: 'aiar-select',
                value: settings.model,
                'aria-label': format(t, 'model'),
                onChange: function (event) {
                  patch({ model: event.currentTarget.value })
                },
              }, modelOptions),
            ]),
            h('div', { className: 'aiar-row', key: 'delay' }, [
              h('div', { className: 'aiar-rowText' }, [
                h('div', { className: 'aiar-rowLabel', key: 'label' }, format(t, 'delay')),
                h('div', { className: 'aiar-rowHint', key: 'hint' }, format(t, 'delayHint')),
              ]),
              h('input', {
                className: 'aiar-number',
                type: 'number',
                min: 0,
                max: 30,
                step: 1,
                value: settings.delaySeconds,
                'aria-label': format(t, 'delay'),
                onChange: function (event) {
                  var value = Number(event.currentTarget.value)
                  if (!isFinite(value)) value = 0
                  patch({ delaySeconds: Math.max(0, Math.min(30, Math.round(value))) })
                },
              }),
            ]),
          ]),
          h('div', { className: 'aiar-panel', key: 'prompt-panel' }, [
            h('div', { className: 'aiar-column' }, [
              h('div', { className: 'aiar-columnTitle', key: 'label' }, format(t, 'prompt')),
              h('textarea', {
                className: 'aiar-textarea',
                value: draft,
                spellCheck: false,
                'aria-label': format(t, 'prompt'),
                placeholder: format(t, 'promptDefault'),
                onChange: function (event) {
                  var value = event.currentTarget.value
                  setDraft(value)
                  patch({ prompt: value })
                },
              }),
              h('div', { className: 'aiar-rowHint' }, format(t, 'promptHint')),
              catalogError !== '' ? h('div', { className: 'aiar-status', 'data-tone': 'warn' }, format(t, 'catalogFail')) : null,
              h('div', { className: 'aiar-toolbar' }, [
                h('button', {
                  type: 'button',
                  className: 'aiar-btn',
                  onClick: function () {
                    var fallback = catalog !== null && typeof catalog === 'object' && typeof catalog.defaultPrompt === 'string' ? catalog.defaultPrompt : ''
                    setDraft(fallback)
                    patch({ prompt: '' })
                  },
                }, format(t, 'promptReset')),
                h('button', {
                  type: 'button',
                  className: 'aiar-btn',
                  'data-variant': 'primary',
                  disabled: test !== null && test.status === 'running',
                  onClick: runTest,
                }, format(t, 'test')),
                saved ? h('span', { className: 'aiar-status', 'data-tone': 'ok' }, format(t, 'saved')) : null,
                testText !== '' ? h('span', { className: 'aiar-status', 'data-tone': testTone }, testText) : null,
              ]),
            ]),
          ]),
          h('p', { className: 'aiar-rowHint', key: 'storage' }, format(t, 'storageHint')),
        ])
      }

      // ─────────────────────────── plugin entry ───────────────────────────
      function apply(ctx) {
        ctx.effect(function () {
          var style = document.createElement('style')
          style.dataset.plugin = PLUGIN_ID
          style.textContent = CSS
          document.head.appendChild(style)
          return function () {
            style.remove()
          }
        }, 'ai-approval-review: styles')

        try {
          ctx.effect(function () {
            return ctx.locale.register(NS, { zh: ZH, en: EN })
          }, 'ai-approval-review: dictionaries')
        } catch (error) {
          /* an older host without locale still gets the English fallback */
        }

        var t = fallbackT
        try {
          t = ctx.locale.bind(NS)
        } catch (error) {
          t = fallbackT
        }

        function resolveReason(value) {
          try {
            return ctx.locale.resolveText(value)
          } catch (error) {
            if (value !== null && typeof value === 'object') return String(value.zh || value.en || '')
            return String(value)
          }
        }

        ctx.slots.inject('conversation.composer', function () {
          return ctx.slots.register({
            name: 'conversation.composer',
            priority: 0,
            select: function (owner) {
              var pending = owner === null || owner === undefined ? undefined : owner.pendingInteraction
              if (pending === undefined || pending === null || pending.kind !== 'approval') return null
              // Disabled means "restore the stock panel", not "render a plain copy".
              if (!readSettings().enabled) return null
              return pending
            },
            locale: NS,
            inject: function () {
              return { resolveReason: resolveReason }
            },
          }, ApprovalPanel)
        })

        ctx.slots.inject('settings.section', function () {
          return ctx.slots.register({
            name: 'settings.section',
            id: 'ai-approval-review',
            order: 90,
            label: function () {
              return t('nav')
            },
            locale: NS,
            inject: function () {
              return { t: t }
            },
          }, SettingsSection)
        })
      }

      exports.apply = apply
      exports.inject = ['slots', 'locale']
      return module.exports
    },
  })
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : null)
