/**
 * Panel preferences, kept in this browser's `localStorage` and never written
 * into the DSH configuration.
 * @module dsh-anti-blind-approval/client/settings
 */

/** One browser's reviewer preferences. */
export interface ReviewSettings {
  /** Whether the panel takes over from the stock approval UI. */
  readonly enabled: boolean
  /** `provider::model` override; empty follows the current session route. */
  readonly model: string
  /** Seconds the Allow button stays locked after an unsafe verdict or a failure. */
  readonly delaySeconds: number
  /** Replacement reviewer policy; empty uses the built-in prompt. */
  readonly prompt: string
}

/** `localStorage` key holding {@link ReviewSettings}. */
const STORAGE_KEY = 'dsh-anti-blind-approval:v1'

/** Cool-down used when nothing valid is stored. */
export const DEFAULT_DELAY_SECONDS = 3

/** Longest cool-down the settings page accepts. */
export const MAX_DELAY_SECONDS = 30

/**
 * Read stored preferences into their valid range.
 * @param raw - parsed `localStorage` value, which may be absent or corrupt.
 * @returns complete preferences with a bounded cool-down.
 */
function normalizeSettings(raw: unknown): ReviewSettings {
  const value = raw !== null && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const stored = Number(value.delaySeconds)
  const delaySeconds = Number.isFinite(stored)
    ? Math.max(0, Math.min(MAX_DELAY_SECONDS, Math.round(stored)))
    : DEFAULT_DELAY_SECONDS
  return {
    enabled: value.enabled !== false,
    model: typeof value.model === 'string' ? value.model : '',
    delaySeconds,
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
  }
}

/**
 * Read this browser's preferences.
 * @returns current preferences; defaults when nothing valid is stored.
 */
export function readSettings(): ReviewSettings {
  let raw: unknown = null
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    // A corrupt entry must not disable the panel: fall back to defaults.
    raw = null
  }
  return normalizeSettings(raw)
}

/**
 * Write one patch of preferences.
 * @param patch - fields to change.
 * @returns the complete preferences after the write.
 */
export function writeSettings(patch: Partial<ReviewSettings>): ReviewSettings {
  const next = normalizeSettings({ ...readSettings(), ...patch })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode or a full quota keeps the in-memory value the caller renders.
  }
  return next
}
