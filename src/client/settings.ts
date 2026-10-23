/**
 * The browser face of this plugin's configuration form.
 *
 * The values live in the active profile's DSH configuration: the Host entry's
 * volatile `Config` fields are projected by the settings service, and
 * `ctx.configForms` gives every browser one shared, revision-fenced form over
 * them. `localStorage` is read once, only to adopt preferences written by
 * versions that kept them in the browser.
 *
 * @module dsh-anti-blind-approval/client/settings
 */

import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_DELAY_SECONDS, MAX_DELAY_SECONDS, SETTINGS_NAMESPACE, normalizeSettings, type ReviewSettings,
} from '../settings-shared.ts'

export { DEFAULT_DELAY_SECONDS, MAX_DELAY_SECONDS, SETTINGS_NAMESPACE }
export type { ReviewSettings }

/** The prefixed section of the Host's projected form. */
export interface ReviewConfigSection {
  /** Whether the panel takes over from the stock approval UI. */
  readonly enabled?: boolean
  /** `provider::model` override; empty follows the current session route. */
  readonly model?: string
  /** Seconds Allow stays locked after an unsafe verdict or a failed review. */
  readonly delaySeconds?: number
  /** Replacement reviewer policy; empty uses the built-in prompt. */
  readonly prompt?: string
}

/** Editable field names, in the order legacy settings are adopted. */
export type SettingsField = 'enabled' | 'model' | 'delaySeconds' | 'prompt'

/** One observable view of the profile's form. */
export interface SettingsState {
  /** `loading` before the Host's first view, `unavailable` when the entry is not served. */
  readonly status: 'loading' | 'ready' | 'unavailable'
  /** Whether the active profile accepts writes at all. */
  readonly writable: boolean
  /** Effective preferences: schema defaults overlaid with the profile's overrides. */
  readonly settings: ReviewSettings
  /** Fields the profile explicitly overrides, so an inherited default stays inherited. */
  readonly overridden: ReadonlySet<string>
}

/** One browser's handle on the profile's reviewer configuration. */
export class SettingsHandle {
  /**
   * @param form - shared form for this plugin's profile entry.
   */
  constructor(private readonly form: ConfigForm<ReviewConfigSection>) {}

  /** @returns the current availability plus the effective preferences. */
  snapshot(): SettingsState {
    const raw = this.form.getSnapshot()
    const user = raw.user
    const overridden = new Set(
      user !== null && typeof user === 'object' && !Array.isArray(user) ? Object.keys(user) : [],
    )
    return {
      status: raw.status,
      writable: raw.writable,
      settings: normalizeSettings(raw.value),
      overridden,
    }
  }

  /**
   * Observe value and availability changes.
   * @param listener - invoked after each snapshot change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void {
    return this.form.subscribe(listener)
  }

  /**
   * Queue one field write into the profile's configuration.
   * @param field - field to overwrite.
   * @param value - new value, as the JSON-shaped form expects it.
   * @returns whether the Host accepted the write.
   */
  set(field: SettingsField, value: unknown): Promise<boolean> {
    return this.form.set(field, value)
  }

  /**
   * Clear one field so it inherits the composition default again.
   * @param field - field to clear.
   * @returns whether the Host accepted the clear.
   */
  unset(field: SettingsField): Promise<boolean> {
    return this.form.unset(field)
  }
}

/** `localStorage` key earlier versions wrote. */
const LEGACY_KEY = 'dsh-anti-blind-approval:v1'

/** Legacy fields in adoption order. */
const LEGACY_FIELDS: readonly SettingsField[] = ['enabled', 'model', 'delaySeconds', 'prompt']

/**
 * Read the legacy browser section, if one is present and readable.
 * @returns the stored subsection, or undefined when there is nothing to adopt.
 */
function readLegacy(): Record<string, unknown> | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null')
    return raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Adopt preferences written by versions that kept them in `localStorage`.
 *
 * Only fields the profile does not already override are written, so a
 * configuration file always wins. The legacy key is removed once every write
 * was accepted; a composition that serves no writable form keeps the key for a
 * later load instead of dropping values it could not persist.
 *
 * @param handle - this browser's form handle.
 * @returns a disposer ending the watcher.
 */
export function adoptLegacySettings(handle: SettingsHandle): () => void {
  const legacy = readLegacy()
  if (legacy === undefined) return () => {}
  const values = normalizeSettings(legacy)
  let stopped = false
  let running = false
  let stopWatch: (() => void) | undefined

  const stop = (remove: boolean): void => {
    stopped = true
    stopWatch?.()
    stopWatch = undefined
    if (!remove) return
    try {
      localStorage.removeItem(LEGACY_KEY)
    } catch {
      // A blocked storage keeps the key; the values are already persisted.
    }
  }

  const attempt = async (): Promise<void> => {
    if (stopped || running) return
    const state = handle.snapshot()
    if (state.status === 'loading') return
    // A composition that serves no writable form yet is left watching: the
    // mirror may still deliver the entry once the Host describe settles.
    if (state.status !== 'ready' || !state.writable) return
    running = true
    try {
      for (const field of LEGACY_FIELDS) {
        if (state.overridden.has(field) || legacy[field] === undefined) continue
        if (!(await handle.set(field, values[field]))) {
          stop(false)
          return
        }
      }
      stop(true)
    } catch {
      // A transport failure keeps the legacy value for the next load.
      stop(false)
    } finally {
      running = false
    }
  }

  stopWatch = handle.subscribe(() => { void attempt() })
  void attempt()
  return () => { stop(false) }
}
