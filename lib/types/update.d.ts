/**
 * Host logic for applying an official update: fast-forward the local
 * checkout to the tracked remote with `--ff-only`, then optionally rebuild
 * (`pnpm install && pnpm run build`). Never auto-restarts - it only reports
 * what changed and that a restart is required.
 */
import type { CommandRunner } from './git.ts';
import type { UpdateOutcome } from './protocol.ts';
/** Options configuring one update. */
export interface UpdateOptions {
    /** Absolute path of the git checkout. */
    repoPath: string;
    /** Git remote name. */
    remote: string;
    /** Branch to track. */
    branch: string;
    /** Timeout for the git merge, in ms. */
    gitTimeoutMs: number;
    /** Timeout for each rebuild command, in ms. */
    rebuildTimeoutMs: number;
    /** Whether to run `pnpm install && pnpm run build` after pulling. */
    rebuildAfterUpdate: boolean;
    /** Git TLS backend (openssl on Windows hosts with a broken schannel store). */
    sslBackend?: string;
    /** Command runner (test seam). */
    run?: CommandRunner;
}
/**
 * Apply the official update. The local checkout must be clean enough for a
 * fast-forward merge; a dirty working tree or a diverged history returns a
 * typed failure instead of trying to stash/merge for the user.
 * @returns an UpdateOutcome describing the result.
 */
export declare function applyUpdate(opts: UpdateOptions): Promise<UpdateOutcome>;
