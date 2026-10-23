/**
 * The browser face of this plugin's configuration form.
 *
 * The values live in the active profile's DSH configuration: the Host entry's
 * volatile `Config` fields are projected by the settings service, and
 * `ctx.configForms` gives every browser one shared, revision-fenced form over
 * them.
 *
 * @module dsh-anti-blind-approval/client/settings
 */

import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_DELAY_SECONDS, DEFAULT_REVIEW_TIMEOUT_MS, MAX_DELAY_SECONDS, MIN_REVIEW_TIMEOUT_MS,
  MAX_REVIEW_TIMEOUT_MS, SETTINGS_NAMESPACE, normalizeSettings, type ReviewSettings,
} from '../settings-shared.ts'

export {
  DEFAULT_DELAY_SECONDS, DEFAULT_REVIEW_TIMEOUT_MS, MAX_DELAY_SECONDS, MIN_REVIEW_TIMEOUT_MS,
  MAX_REVIEW_TIMEOUT_MS, SETTINGS_NAMESPACE,
}
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
  /** Maximum milliseconds one review may take before it fails with TIMEOUT. */
  readonly reviewTimeoutMs?: number
}

/** Editable field names, in the order legacy settings are adopted. */
export type SettingsField = 'enabled' | 'model' | 'delaySeconds' | 'prompt' | 'reviewTimeoutMs'

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
