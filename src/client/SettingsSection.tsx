/**
 * The plugin's settings page: the master switch, the reviewer model, the
 * cool-down, and the reviewer policy.
 *
 * The values are the Host entry's volatile `Config` fields projected through
 * `ctx.configForms`, so they are written into the active profile's DSH
 * configuration (and can also be supplied from `cordis.yml`) instead of living
 * in one browser. A profile that serves no writable form gets a read-only page.
 *
 * @module dsh-anti-blind-approval/client/SettingsSection
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ReviewCatalogResponse, TestReviewResponse,
} from '../types.ts'
import { ROUTE_BASE } from '../contract.ts'
import { getJson, postJson } from './http.ts'
import { NS, errorKey } from './locales.ts'
import { MAX_DELAY_SECONDS, type SettingsField, type SettingsHandle } from './settings.ts'

/** Business values the registrant injects into the settings page. */
export interface SettingsSectionInjected {
  /**
   * The language the user reads this UI in, so the connectivity test answers in it.
   * @returns a BCP 47-style tag, or `''` when the UI has none.
   */
  userLanguage(): string

  /** The profile's configuration form, shared with the panel. */
  settings: SettingsHandle
}

/** Full props of the settings page. */
export type SettingsSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<typeof NS>
  & InjectFace<SettingsSectionInjected>

/** Outcome of the last connectivity test. */
interface TestState {
  readonly status: 'running' | 'ok' | 'fail'
  readonly text: string
}

/** How long the "saved" acknowledgement stays visible. */
const SAVED_MS = 1_600

/** Idle time before a prompt edit is written, so typing does not write per key. */
const PROMPT_WRITE_MS = 600

/**
 * Render the anti-blind-approval settings page.
 * @param props - owner, locale, and registrant-injected shares.
 * @returns the settings page.
 */
export function SettingsSection(props: SettingsSectionProps): ReactNode {
  const { t, userLanguage, settings: handle } = props
  const [state, setState] = useState(() => handle.snapshot())
  const settings = state.settings
  const editable = state.status === 'ready' && state.writable
  const [catalog, setCatalog] = useState<ReviewCatalogResponse | null>(null)
  const [catalogFailed, setCatalogFailed] = useState(false)
  const [draft, setDraft] = useState(settings.prompt)
  const [saved, setSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [test, setTest] = useState<TestState | null>(null)
  const savedTimer = useRef(0)
  const promptTimer = useRef(0)
  const pendingPrompt = useRef<string | null>(null)
  const lastStoredPrompt = useRef(settings.prompt)
  const alive = useRef(true)

  useEffect(() => handle.subscribe(() => { setState(handle.snapshot()) }), [handle])

  useEffect(() => {
    let live = true
    void getJson<ReviewCatalogResponse>(`${ROUTE_BASE}/catalog`)
      .then((data) => {
        if (!live) return
        setCatalog(data)
        if (settings.prompt === '' && typeof data.defaultPrompt === 'string') setDraft(data.defaultPrompt)
      })
      .catch(() => {
        if (live) setCatalogFailed(true)
      })
    return () => { live = false }
    // One read at mount; the form's current value seeds only that first draft.
  }, [])

  /** Show the saved or failed acknowledgement for the latest write. */
  const noteSaved = (ok: boolean): void => {
    if (!alive.current) return
    setSaved(ok)
    setSaveFailed(!ok)
    if (savedTimer.current !== 0) clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => {
      if (!alive.current) return
      setSaved(false)
      savedTimer.current = 0
    }, SAVED_MS)
  }

  /** Queue one configuration write and report its settlement. */
  const save = (field: SettingsField, value: unknown): void => {
    if (alive.current) setSaveFailed(false)
    void handle.set(field, value).then(
      (ok) => { noteSaved(ok) },
      () => { noteSaved(false) },
    )
  }

  /** Queue one field clear (back to the inherited default). */
  const clear = (field: SettingsField): void => {
    if (alive.current) setSaveFailed(false)
    void handle.unset(field).then(
      (ok) => { noteSaved(ok) },
      () => { noteSaved(false) },
    )
  }

  /** Write the pending prompt edit, if the debounce has not run yet. */
  const flushPrompt = (): void => {
    if (promptTimer.current !== 0) {
      clearTimeout(promptTimer.current)
      promptTimer.current = 0
    }
    const value = pendingPrompt.current
    pendingPrompt.current = null
    if (value !== null) save('prompt', value)
  }

  /** Keep the draft local while the user types, then write it once. */
  const editPrompt = (value: string): void => {
    setDraft(value)
    pendingPrompt.current = value
    if (promptTimer.current !== 0) clearTimeout(promptTimer.current)
    promptTimer.current = window.setTimeout(flushPrompt, PROMPT_WRITE_MS)
  }

  useEffect(() => () => {
    alive.current = false
    flushPrompt()
  }, [])

  // Another browser may change the prompt; follow it unless this one is editing.
  useEffect(() => {
    if (settings.prompt === lastStoredPrompt.current) return
    lastStoredPrompt.current = settings.prompt
    if (pendingPrompt.current !== null || settings.prompt === '') return
    setDraft(settings.prompt)
  }, [settings.prompt])

  /** One failure's localized label plus its diagnostic detail. */
  const failureText = (data: TestReviewResponse): string => {
    const label = t(errorKey(data.errorCode))
    return typeof data.detail === 'string' && data.detail !== '' ? `${label} (${data.detail})` : label
  }

  const runTest = (): void => {
    setTest({ status: 'running', text: t('testing') })
    let language = ''
    try {
      language = userLanguage()
    } catch {
      // A UI without a locale answer still runs the test in the fallback language.
      language = ''
    }
    void postJson<TestReviewResponse>(`${ROUTE_BASE}/test`, {
      prompt: draft,
      model: settings.model,
      userLanguage: language,
    }).then((data) => {
      if (data.ok === true) {
        setTest({
          status: 'ok',
          text: `${t('testOk')} · ${data.model ?? ''} · ${data.safe === true ? 'safe=true' : 'safe=false'}`,
        })
        return
      }
      setTest({ status: 'fail', text: `${t('testFail')} · ${failureText(data)}` })
    }).catch((error: unknown) => {
      setTest({
        status: 'fail',
        text: `${t('testFail')} · ${error instanceof Error ? error.message : String(error)}`,
      })
    })
  }

  const modelOptions: ReactNode[] = [<option value="" key="__current">{t('modelCurrent')}</option>]
  for (const provider of catalog?.providers ?? []) {
    if (provider.models.length === 0) continue
    modelOptions.push(
      <optgroup label={provider.name} key={provider.id}>
        {provider.models.map(model => (
          <option value={`${provider.id}::${model.id}`} key={`${provider.id}::${model.id}`}>{model.name}</option>
        ))}
      </optgroup>,
    )
  }

  return (
    <div className="aiar-settings">
      <h2 className="aiar-settingsTitle">{t('title')}</h2>
      <p className="aiar-settingsIntro">{t('intro')}</p>
      {state.status === 'unavailable' ? (
        <div className="aiar-status" data-tone="warn">{t('configUnavailable')}</div>
      ) : null}
      {state.status === 'ready' && !state.writable ? (
        <div className="aiar-status" data-tone="warn">{t('configReadonly')}</div>
      ) : null}
      <div className="aiar-panel">
        <div className="aiar-row">
          <div className="aiar-rowText">
            <div className="aiar-rowLabel">{t('enabled')}</div>
            <div className="aiar-rowHint">{t('enabledHint')}</div>
          </div>
          <Switch
            checked={settings.enabled}
            label={t('enabled')}
            disabled={!editable}
            onChange={(next) => { save('enabled', next) }}
          />
        </div>
        <div className="aiar-row">
          <div className="aiar-rowText">
            <div className="aiar-rowLabel">{t('model')}</div>
            <div className="aiar-rowHint">{t('modelHint')}</div>
          </div>
          <select
            className="aiar-select"
            value={settings.model}
            aria-label={t('model')}
            disabled={!editable}
            onChange={(event) => { save('model', event.currentTarget.value) }}
          >
            {modelOptions}
          </select>
        </div>
        <div className="aiar-row">
          <div className="aiar-rowText">
            <div className="aiar-rowLabel">{t('delay')}</div>
            <div className="aiar-rowHint">{t('delayHint')}</div>
          </div>
          <input
            className="aiar-number"
            type="number"
            min={0}
            max={MAX_DELAY_SECONDS}
            step={1}
            value={settings.delaySeconds}
            aria-label={t('delay')}
            disabled={!editable}
            onChange={(event) => {
              const value = Number(event.currentTarget.value)
              save('delaySeconds', Number.isFinite(value) ? Math.max(0, Math.min(MAX_DELAY_SECONDS, Math.round(value))) : 0)
            }}
          />
        </div>
      </div>
      <div className="aiar-panel">
        <div className="aiar-column">
          <div className="aiar-columnTitle">{t('prompt')}</div>
          <textarea
            className="aiar-textarea"
            value={draft}
            spellCheck={false}
            aria-label={t('prompt')}
            placeholder={t('promptDefault')}
            disabled={!editable}
            onChange={(event) => { editPrompt(event.currentTarget.value) }}
            onBlur={flushPrompt}
          />
          <div className="aiar-rowHint">{t('promptHint')}</div>
          {catalogFailed ? <div className="aiar-status" data-tone="warn">{t('catalogFail')}</div> : null}
          <div className="aiar-toolbar">
            <Button
              variant="outline"
              disabled={!editable}
              onClick={() => {
                pendingPrompt.current = null
                if (promptTimer.current !== 0) {
                  clearTimeout(promptTimer.current)
                  promptTimer.current = 0
                }
                setDraft(catalog?.defaultPrompt ?? '')
                clear('prompt')
              }}
            >
              {t('promptReset')}
            </Button>
            <Button
              variant="primary"
              disabled={test !== null && test.status === 'running'}
              onClick={runTest}
            >
              {t('test')}
            </Button>
            {saved ? <span className="aiar-status" data-tone="ok">{t('saved')}</span> : null}
            {saveFailed ? <span className="aiar-status" data-tone="warn">{t('saveFailed')}</span> : null}
            {test === null ? null : (
              <span className="aiar-status" data-tone={testTone(test.status)}>{test.text}</span>
            )}
          </div>
        </div>
      </div>
      <p className="aiar-rowHint">{t('storageHint')}</p>
    </div>
  )
}

/** Tone of the connectivity-test label. */
function testTone(status: TestState['status']): 'ok' | 'bad' | undefined {
  if (status === 'ok') return 'ok'
  if (status === 'fail') return 'bad'
  return undefined
}
