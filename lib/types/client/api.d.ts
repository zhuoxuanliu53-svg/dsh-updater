/**
 * Browser-side API client for /api/dsh-updater - plain same-origin fetch,
 * the only data path the settings card uses.
 */
import { type CheckOutcome, type UpdateOutcome, type ConfigPatch, type ConfigView } from '../protocol.ts';
/** Error carrying the route's message. */
export declare class UpdaterApiError extends Error {
    constructor(message: string);
}
/** The card's editable config fields, as served by the host. */
export type UpdaterConfig = Omit<ConfigView, 'ok'>;
/** Ask the host to check the git checkout against the official remote. */
export declare function checkUpdate(): Promise<CheckOutcome>;
/** Ask the host to fast-forward the git checkout to the official remote. */
export declare function applyUpdate(): Promise<UpdateOutcome>;
/** Read the current config from the host. */
export declare function getConfig(): Promise<UpdaterConfig>;
/** Persist one config patch and return the host-accepted view. */
export declare function setConfig(patch: ConfigPatch): Promise<UpdaterConfig>;
