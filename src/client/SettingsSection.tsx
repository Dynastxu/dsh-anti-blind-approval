/**
 * The plugin's settings page: the master switch, the reviewer model, the
 * cool-down, and the reviewer policy. Preferences live in this browser, so the
 * page writes `localStorage` and never the DSH configuration.
 * @module dsh-ai-approval-review/client/SettingsSection
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
import { MAX_DELAY_SECONDS, readSettings, writeSettings, type ReviewSettings } from './settings.ts'

/** Business values the registrant injects into the settings page. */
export interface SettingsSectionInjected {
  /**
   * The language the user reads this UI in, so the connectivity test answers in it.
   * @returns a BCP 47-style tag, or `''` when the UI has none.
   */
  userLanguage(): string
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

/**
 * Render the anti-blind-approval settings page.
 * @param props - owner, locale, and registrant-injected shares.
 * @returns the settings page.
 */
export function SettingsSection(props: SettingsSectionProps): ReactNode {
  const { t, userLanguage } = props
  const [settings, setSettings] = useState(readSettings)
  const [catalog, setCatalog] = useState<ReviewCatalogResponse | null>(null)
  const [catalogFailed, setCatalogFailed] = useState(false)
  const [draft, setDraft] = useState(settings.prompt)
  const [saved, setSaved] = useState(false)
  const [test, setTest] = useState<TestState | null>(null)
  const savedTimer = useRef(0)
  const promptRef = useRef(settings.prompt)
  promptRef.current = settings.prompt

  useEffect(() => {
    let alive = true
    void getJson<ReviewCatalogResponse>(`${ROUTE_BASE}/catalog`)
      .then((data) => {
        if (!alive) return
        setCatalog(data)
        if (promptRef.current === '' && typeof data.defaultPrompt === 'string') setDraft(data.defaultPrompt)
      })
      .catch(() => {
        if (alive) setCatalogFailed(true)
      })
    return () => { alive = false }
  }, [])

  useEffect(() => () => {
    if (savedTimer.current !== 0) clearTimeout(savedTimer.current)
  }, [])

  const patch = (next: Partial<ReviewSettings>): void => {
    setSettings(writeSettings(next))
    setSaved(true)
    if (savedTimer.current !== 0) clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => {
      setSaved(false)
      savedTimer.current = 0
    }, SAVED_MS)
  }

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
      <div className="aiar-panel">
        <div className="aiar-row">
          <div className="aiar-rowText">
            <div className="aiar-rowLabel">{t('enabled')}</div>
            <div className="aiar-rowHint">{t('enabledHint')}</div>
          </div>
          <Switch
            checked={settings.enabled}
            label={t('enabled')}
            onChange={(next) => { patch({ enabled: next }) }}
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
            onChange={(event) => { patch({ model: event.currentTarget.value }) }}
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
            onChange={(event) => {
              const value = Number(event.currentTarget.value)
              patch({ delaySeconds: Number.isFinite(value) ? Math.max(0, Math.min(MAX_DELAY_SECONDS, Math.round(value))) : 0 })
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
            onChange={(event) => {
              const value = event.currentTarget.value
              setDraft(value)
              patch({ prompt: value })
            }}
          />
          <div className="aiar-rowHint">{t('promptHint')}</div>
          {catalogFailed ? <div className="aiar-status" data-tone="warn">{t('catalogFail')}</div> : null}
          <div className="aiar-toolbar">
            <Button
              variant="outline"
              onClick={() => {
                setDraft(catalog?.defaultPrompt ?? '')
                patch({ prompt: '' })
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
