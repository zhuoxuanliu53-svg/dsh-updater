/**
 * dsh-updater - host half. Serves the loopback-only
 * /api/dsh-updater/check and /api/dsh-updater/update routes that inspect and
 * fast-forward the local DeepSeek Harness git checkout against the official
 * remote (origin = https://github.com/deepseek-ai/deepseek-harness), and
 * optionally rebuilds after pulling. The browser half (./client) renders a
 * small settings card with "check update" / "update" buttons and a rebuild
 * toggle. DSH itself is never restarted by this plugin - it only reports and
 * asks the user to restart to take effect.
 *
 * Everything rides official NPM SDK packages - no dsh source changes.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import { type ConfigPatch, type ConfigView } from './protocol.ts';
export { checkUpdate } from './api.ts';
export { applyUpdate } from './update.ts';
export type { CheckOptions } from './api.ts';
export type { UpdateOptions } from './update.ts';
export { UPDATER_API } from './protocol.ts';
export type { CheckOutcome, UpdateOutcome, CheckResult, UpdateAppliedResult, FailureResult, ConfigView, ConfigPatch, ConfigOutcome } from './protocol.ts';
/** Stable cordis plugin name. */
export declare const name = "dsh-updater";
/** Services required before the routes can mount. */
export declare const inject: string[];
/** Settings namespace of the dsh-updater capability. */
export declare const UPDATER_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Default git checkout this plugin manages. Empty: the user points it at their own clone. */
export declare const DEFAULT_REPO_PATH = "";
export declare const DEFAULT_REMOTE = "origin";
export declare const DEFAULT_BRANCH = "master";
/** Plugin config, validated by the matched schemastery schema. */
export interface Config {
    /** Absolute path of the DeepSeek Harness git checkout. */
    repoPath?: string;
    /** Git remote name (the official upstream, normally `origin`). */
    remote?: string;
    /** Branch to track (normally `master`). */
    branch?: string;
    /** Timeout (ms) for the git fetch during a check. */
    fetchTimeoutMs?: number;
    /** Timeout (ms) for the git merge during an update. */
    gitTimeoutMs?: number;
    /** Timeout (ms) for each rebuild command (pnpm install / build). */
    rebuildTimeoutMs?: number;
    /** Run `pnpm install && pnpm run build` after pulling when an update applies. Default off. */
    rebuildAfterUpdate?: boolean;
    /** Git TLS backend: `openssl` (default) or `schannel`. OpenSSL is required on hosts whose schannel credential store is unavailable. */
    sslBackend?: string;
}
/** Plugin config schema (also the settings namespace schema). */
export declare const Config: z<Config>;
/** Schema default for the rebuild toggle (off: pull only, then prompt to restart). */
export declare const DEFAULT_REBUILD = false;
/**
 * Mount the two routes, gated on the composition entry config. Settings
 * writes (from the card) re-point the source thunk and stay live.
 * @param ctx - host plugin context carrying webServer/settings.
 * @param config - resolved plugin config.
 */
export declare const apply: typeof applyImpl;
declare function applyImpl(ctx: Context, config?: Config): void;
/** Route-family config, read at call time from the live settings source. */
export interface UpdateRoutesConfig {
    repoPath: string;
    remote: string;
    branch: string;
    fetchTimeoutMs: number;
    gitTimeoutMs: number;
    rebuildTimeoutMs: number;
    rebuildAfterUpdate: boolean;
    sslBackend: string;
}
/** Persist a config patch and answer the freshly-resolved view; provided by the plugin body so the route stays testable. */
export type WriteConfig = (patch: ConfigPatch) => Promise<ConfigView>;
/** Build the /api/dsh-updater route family. */
export declare function makeRoutes(cfg: UpdateRoutesConfig, writeConfig: WriteConfig): WebRoute[];
