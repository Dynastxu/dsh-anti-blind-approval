/**
 * dsh-anti-blind-approval — browser half.
 *
 * Two contributions:
 *   1. `conversation.composer` takeover for pending approvals, ahead of the
 *      stock panel. For a `workspace-write` session the panel probes the Host,
 *      shows the pending action, asks for one JSON safety verdict, and keeps
 *      Allow disabled while the review runs and through the cool-down after an
 *      unsafe verdict. The human still makes the final decision.
 *   2. `settings.section` page: master switch, reviewer model, cool-down, and
 *      the custom policy, persisted in this browser.
 *
 * Loaded through the shell's module table: `react`, `react/jsx-runtime`, and
 * the UI primitives are module-table entries, so this bundle carries no copy.
 * @module dsh-anti-blind-approval/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the ctx.slots service merge.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the ctx.locale service merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the `conversation.composer` SlotMap merge and its owner props.
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the `settings.section` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the approval pending-interaction declaration.
import type { PendingApproval } from '@deepseek-ai/dsh-client-ui-approval/client'
import { ApprovalPanel, type CachedVerdict, type ReviewCache } from './ApprovalPanel.tsx'
import { SettingsSection } from './SettingsSection.tsx'
import { NS, en, zh } from './locales.ts'
import { readSettings } from './settings.ts'
import { CSS, STYLE_MARKER } from './styles.ts'

/** Required services: the slot registry and the dictionary registry. */
export const inject = ['slots', 'locale']

/** Verdicts one page keeps before it starts over. */
const CACHE_LIMIT = 64

/**
 * Create the page's verdict cache.
 *
 * One handle per plugin instance, passed to the panel through its inject face,
 * so a remount reuses the verdict instead of paying for a second review.
 * @returns the cache handle the panel holds.
 */
function createReviewCache(): ReviewCache {
  const entries = new Map<string, CachedVerdict>()
  return {
    lookup(key: string): CachedVerdict | undefined {
      return entries.get(key)
    },
    remember(key: string, verdict: CachedVerdict): void {
      if (entries.size >= CACHE_LIMIT) entries.clear()
      entries.set(key, verdict)
    },
  }
}

/**
 * Install the stylesheet, the dictionaries, and both surfaces.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = STYLE_MARKER
    style.textContent = CSS
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'anti-blind-approval: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'anti-blind-approval: dictionaries')
  const t = ctx.locale.bind(NS)
  const reviews = createReviewCache()

  /**
   * The language the user reads this UI in. The reviewer writes its
   * one-sentence reason in that language, so a Chinese user keeps a Chinese
   * verdict while the policy prompt itself stays English.
   * @returns the active locale tag, the browser language, or `''`.
   */
  const userLanguage = (): string => {
    const active = ctx.locale.getSnapshot().active
    if (active !== '') return active
    return typeof navigator === 'undefined' ? '' : navigator.language
  }

  ctx.slots.inject('conversation.composer', () => ctx.slots.register({
    name: 'conversation.composer',
    // Below the stock panel's 1: this takeover must be tried first.
    priority: 0,
    select: (owner: ComposerChainProps): PendingApproval | null => {
      const pending = owner.pendingInteraction
      if (pending === undefined || pending.kind !== 'approval') return null
      // Disabled means "restore the stock panel", not "render a plain copy".
      if (!readSettings().enabled) return null
      return pending
    },
    locale: NS,
    inject: () => ({
      resolveReason: (reason: NonNullable<PendingApproval['displayReason']>) => ctx.locale.resolveText(reason),
      userLanguage,
      reviews,
    }),
  }, ApprovalPanel))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'anti-blind-approval',
    order: 90,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ userLanguage }),
  }, SettingsSection))
}
