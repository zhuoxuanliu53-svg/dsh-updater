/**
 * Host logic for checking the local git checkout against the official
 * remote: verify the repository, fetch the tracked branch, and report how far
 * the local checkout has drifted. Network failures are surfaced explicitly
 * (never reported as "up to date").
 */
import type { CommandRunner } from './git.ts';
import type { CheckOutcome } from './protocol.ts';
/** Options configuring a single check. */
export interface CheckOptions {
    /** Absolute path of the git checkout (default D:\DSH\deepseek-harness). */
    repoPath: string;
    /** Git remote name (default origin = https://github.com/deepseek-ai/deepseek-harness). */
    remote: string;
    /** Branch to track (default master). */
    branch: string;
    /** Timeout for the git fetch, in ms. */
    fetchTimeoutMs: number;
    /** Git TLS backend (openssl on Windows hosts with a broken schannel store). */
    sslBackend?: string;
    /** Command runner (test seam). */
    run?: CommandRunner;
}
/**
 * Compare the local checkout to the official remote. Refreshes the remote
 * tracking ref with `git fetch` first, then reports the drift.
 * @returns a CheckOutcome: success with drift, or a typed failure.
 */
export declare function checkUpdate(opts: CheckOptions): Promise<CheckOutcome>;
