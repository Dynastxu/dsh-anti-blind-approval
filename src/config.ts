/**
 * Host half configuration.
 *
 * Every field is `.volatile()`, which is what lets `@deepseek-ai/dsh-settings`
 * project it into a browser form and lets `dsh-config-editor` write an edited
 * value into the active profile's patch without reloading the plugin. The
 * panel reads the same fields through `ctx.configForms`, so `cordis.yml`, the
 * settings page, and the profile patch are one source of truth.
 *
 * A volatile field validates to a stable reference, not to the plain value:
 * Cordis commits an update to the running reference and notifies the plugin,
 * and the Host reads it with `.get()`. `Config` below is therefore the schema
 * value, while the same name in type position is derived from it, which is the
 * official pattern for volatile preferences.
 *
 * @module dsh-anti-blind-approval/config
 */

import z from '@deepseek-ai/schemastery'
import { DEFAULT_REVIEW_TIMEOUT_MS } from './prompt.ts'
import { DEFAULT_DELAY_SECONDS, MAX_DELAY_SECONDS } from './settings-shared.ts'

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

/**
 * What `apply` receives: one stable reference per volatile field.
 *
 * Derived from the schema rather than restated, so a field added or retyped
 * above cannot drift from the Host's view of it.
 */
export type Config = ReturnType<typeof Config>
