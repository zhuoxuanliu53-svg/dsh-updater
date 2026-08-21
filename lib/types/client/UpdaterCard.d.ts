/**
 * The dsh-updater settings card: shows the current vs official remote commit,
 * a "check update" button, an "update" button, and a "rebuild after update"
 * toggle. Registers into the official `settings.section` slot.
 *
 * The component never touches ctx. Its two editable fields (repo path and the
 * rebuild toggle) are read from and written to the plugin's own loopback
 * config route (/api/dsh-updater/config) instead of a settings scope, because
 * rc.6 host-apiproxy refuses every third-party settings namespace at the RPC
 * boundary (`settings-not-exposed`) and thus a bound scope never becomes
 * ready.
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Props the renderer binds for the dsh-updater card. */
export type UpdaterCardProps = PropsRuntime<'settings.section'> & PropsLocale<'dsh-updater'>;
/**
 * Render the dsh-updater settings card.
 * @param props - locale copy and the runtime section props.
 * @returns the card.
 */
export declare function UpdaterCard(props: UpdaterCardProps): import("react").JSX.Element;
