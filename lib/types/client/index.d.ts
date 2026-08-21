/**
 * dsh-updater - browser half. Registers a small settings section card that
 * checks the local git checkout against the official remote, applies an
 * update, and toggles a "rebuild after update" switch. The card reads/writes
 * its two editable fields through the plugin's own loopback config route (not
 * a settings scope), because rc.6 host-apiproxy refuses every third-party
 * settings namespace at the RPC boundary.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type UpdaterKey } from './locales.ts';
export { UpdaterCard } from './UpdaterCard.tsx';
export type { UpdaterCardProps } from './UpdaterCard.tsx';
export type { UpdaterKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** dsh-updater settings-card copy. */
        'dsh-updater': UpdaterKey;
    }
}
/** Services required by this plugin. */
export declare const inject: string[];
/**
 * Register the dsh-updater settings section card.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
