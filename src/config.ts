/**
 * Host half configuration.
 *
 * Every field is `.volatile()`, which is what lets `@deepseek-ai/dsh-settings`
 * project it into a browser form and lets `dsh-config-editor` write an edited
 * value into the active profile's patch without reloading the plugin. The
 * panel reads the same fields through `ctx.configForms`, so `cordis.yml`, the
 * settings page, and the profile patch are one source of truth.
 *
 * @module dsh-anti-blind-approval/config
 */

import z from '@deepseek-ai/schemastery'
import { DEFAULT_REVIEW_TIMEOUT_MS } from './prompt.ts'
import { DEFAULT_DELAY_SECONDS, MAX_DELAY_SECONDS } from './settings-shared.ts'

/** Live preference references the Host hands an activated plugin instance. */
export interface Config {
  /** Whether the panel takes over from the stock approval UI. */
  enabled: boolean
  /** `provider::model` override; empty follows the current session route. */
  model: string
  /** Seconds Allow stays locked after an unsafe verdict or a failed review. */
  delaySeconds: number
  /** Replacement reviewer policy; empty uses the built-in prompt. */
  prompt: string
  /** Maximum milliseconds one review may take before it fails with TIMEOUT. */
  reviewTimeoutMs: number
}

/** Editable preferences, exposed through the profile's settings form. */
export const Config = z.object({
  enabled: z.boolean().default(true).description(
    'Review workspace-write escalations with the session model. Off restores the stock approval panel.',
  ).volatile(),
  model: z.string().default('').description(
    'Provider and model for the review, as "provider::model". Empty follows the current session route.',
  ).volatile(),
  delaySeconds: z.number().step(1).min(0).max(MAX_DELAY_SECONDS).default(DEFAULT_DELAY_SECONDS).description(
    'Seconds the Allow button stays locked after an unsafe verdict or a failed review; 0 never locks it.',
  ).volatile(),
  prompt: z.string().default('').description(
    'Replacement reviewer policy. Empty uses the built-in English prompt; {language} is replaced with the UI language.',
  ).volatile(),
  reviewTimeoutMs: z.number().step(1000).min(5_000).max(300_000).default(DEFAULT_REVIEW_TIMEOUT_MS).description(
    'Maximum milliseconds one review may take before it fails with TIMEOUT.',
  ).volatile(),
})
