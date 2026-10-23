/**
 * Small boundary helpers shared by the Host half.
 * @module dsh-anti-blind-approval/util
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/**
 * Whether a value is a plain object record.
 * @param value - value parsed from a request body or a logged event.
 * @returns true for a non-null, non-array object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Clamp a value to a character budget.
 * @param value - value rendered for display or for the reviewer.
 * @param max - maximum characters kept, before the ellipsis.
 * @returns the text, truncated with `…` when it exceeded the budget.
 */
export function clip(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value : String(value ?? '')
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * Apply a compile-time string brand to a value the caller has already validated.
 *
 * Mirrors `brandString` from `@deepseek-ai/dsh-brand`, which this package cannot
 * import at runtime: the bundle is installed without its own `node_modules`, so
 * every workspace value import would have to be bundled.
 * @param value - raw string from a validated boundary.
 * @returns the same string carrying the requested brand.
 */
export function brand<T extends Branded<string>>(value: string | T): T {
  return value as T
}
