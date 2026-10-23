/**
 * Reviewer preferences shared by both halves.
 *
 * The values themselves live in the active profile's DSH configuration: the
 * Host declares them as volatile `Config` fields, the settings service projects
 * them into a browser form, and the panel reads that form through
 * `ctx.configForms`. This module carries only the entry identity, the bounds,
 * and the normalization both faces agree on, so neither half imports the other.
 *
 * @module dsh-anti-blind-approval/settings-shared
 */

import { DEFAULT_REVIEW_TIMEOUT_MS as DEFAULT_REVIEW_TIMEOUT_MS_ORIG } from './prompt.ts'

/**
 * Profile entry id. Also the settings namespace the browser form is requested
 * by, so a composition that renames the entry would have to change it here.
 */
export const SETTINGS_NAMESPACE = 'dsh-anti-blind-approval'

/** Cool-down used when the configured value is missing or invalid. */
export const DEFAULT_DELAY_SECONDS = 3

/** Longest cool-down the schema and the settings page accept. */
export const MAX_DELAY_SECONDS = 30

/** Default review timeout in milliseconds. */
export const DEFAULT_REVIEW_TIMEOUT_MS = DEFAULT_REVIEW_TIMEOUT_MS_ORIG

/** Shortest review timeout the schema and the settings page accept. */
export const MIN_REVIEW_TIMEOUT_MS = 5_000

/** Longest review timeout the schema and the settings page accept. */
export const MAX_REVIEW_TIMEOUT_MS = 300_000

/** One profile's reviewer preferences. */
export interface ReviewSettings {
  /** Whether the panel takes over from the stock approval UI. */
  readonly enabled: boolean
  /** `provider::model` override; empty follows the current session route. */
  readonly model: string
  /** Seconds the Allow button stays locked after an unsafe verdict or a failure. */
  readonly delaySeconds: number
  /** Replacement reviewer policy; empty uses the built-in prompt. */
  readonly prompt: string
  /** Maximum milliseconds one review may take before it fails with TIMEOUT. */
  readonly reviewTimeoutMs: number
}

/**
 * Read one raw preference section into its valid range.
 * @param raw - resolved config value, which may be absent or partial.
 * @returns complete preferences with a bounded cool-down.
 */
export function normalizeSettings(raw: unknown): ReviewSettings {
  const value = raw !== null && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const stored = Number(value.delaySeconds)
  const delaySeconds = Number.isFinite(stored)
    ? Math.max(0, Math.min(MAX_DELAY_SECONDS, Math.round(stored)))
    : DEFAULT_DELAY_SECONDS
  const storedTimeout = Number(value.reviewTimeoutMs)
  const reviewTimeoutMs = Number.isFinite(storedTimeout)
    ? Math.max(MIN_REVIEW_TIMEOUT_MS, Math.min(MAX_REVIEW_TIMEOUT_MS, Math.round(storedTimeout)))
    : DEFAULT_REVIEW_TIMEOUT_MS
  return {
    enabled: value.enabled !== false,
    model: typeof value.model === 'string' ? value.model : '',
    delaySeconds,
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    reviewTimeoutMs,
  }
}
