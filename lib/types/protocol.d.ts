/**
 * Wire contract between the host half (api.ts / update.ts) and the browser
 * half (client/api.ts) - pure types plus one path constant, imported by both
 * halves and bundled into each, with no runtime identity to share.
 */
/** Route family of the dsh-updater host API. */
export declare const UPDATER_API: {
    /** Check the local git checkout against the official remote. */
    readonly check: "/api/dsh-updater/check";
    /** Fast-forward the local git checkout to the official remote. */
    readonly update: "/api/dsh-updater/update";
    /** Read (GET) and write (POST) the card's editable config fields. */
    readonly config: "/api/dsh-updater/config";
};
/** Result of a check: local vs official remote commit. */
export interface CheckResult {
    /** True when the check completed (update available or already current). */
    ok: true;
    /** Absolute path of the git checkout that was checked. */
    repoPath: string;
    /** Local branch, e.g. `master`. */
    branch: string;
    /** Full local HEAD sha. */
    current: string;
    /** Short (7-char) local HEAD sha. */
    currentShort: string;
    /** Full official remote sha (origin/<branch>). */
    remote: string;
    /** Short official remote sha. */
    remoteShort: string;
    /** Commits the local checkout is behind the official remote. */
    behind: number;
    /** Commits the local checkout is ahead of the official remote. */
    ahead: number;
    /** Whether an update is available (behind > 0). */
    hasUpdate: boolean;
}
/** Failure of a check/update call, carrying a stable machine code. */
export interface FailureResult {
    ok: false;
    /** Stable outcome code: network | not-a-repo | dirty | conflict | git | unknown. */
    code: 'network' | 'not-a-repo' | 'dirty' | 'conflict' | 'git' | 'unknown';
    /** Human-readable (locale-agnostic) error message. */
    message: string;
    /** Raw stderr tail, when available. */
    detail?: string;
}
/** Union of every check/update outcome the browser can render. */
export type CheckOutcome = CheckResult | FailureResult;
/** Result of an update that was applied or is already current. */
export interface UpdateAppliedResult {
    ok: true;
    /** True when the checkout was actually fast-forwarded. */
    applied: boolean;
    /** Full sha before the update. */
    before: string;
    /** Full sha after the update. */
    after: string;
    /** Whether the optional rebuild step ran. */
    rebuilt: boolean;
    /** Output log (git +/- optional rebuild), for display. */
    log: string;
}
/** Union of every update outcome. */
export type UpdateOutcome = UpdateAppliedResult | FailureResult;
/** The config fields the card reads and edits (the web-exposed subset). */
export interface ConfigView {
    ok: true;
    /** Absolute path of the git checkout. */
    repoPath: string;
    /** Whether to rebuild after pulling. */
    rebuildAfterUpdate: boolean;
}
/** Partial config write from the card. */
export interface ConfigPatch {
    repoPath?: string;
    rebuildAfterUpdate?: boolean;
}
/** Union of every config read/write outcome. */
export type ConfigOutcome = ConfigView | FailureResult;
