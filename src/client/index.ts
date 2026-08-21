/**
 * dsh-updater - browser half. Registers a small settings section card that
 * checks the local git checkout against the official remote, applies an
 * update, and toggles a "rebuild after update" switch. The card reads/writes
 * its two editable fields through the plugin's own loopback config route (not
 * a settings scope), because rc.6 host-apiproxy refuses every third-party
 * settings namespace at the RPC boundary.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface SlotMap merge (settings.section).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { UpdaterCard } from './UpdaterCard.tsx'
import { en, zh, type UpdaterKey } from './locales.ts'

export { UpdaterCard } from './UpdaterCard.tsx'
export type { UpdaterCardProps } from './UpdaterCard.tsx'
export type { UpdaterKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-updater settings-card copy. */
    'dsh-updater': UpdaterKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'dsh-updater'

/** Services required by this plugin. */
export const inject = ['slots', 'locale']

/**
 * Register the dsh-updater settings section card.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-updater: dictionaries')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-updater',
    order: 900,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
  }, UpdaterCard))
}
