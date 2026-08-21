/**
 * Thin wrapper over child_process.execFile for running git (and optionally
 * pnpm) against a fixed repository without ever changing the process cwd.
 */
/** Captured result of one spawned command. */
export interface CommandResult {
    /** Process exit code; null when the spawn itself failed. */
    code: number | null;
    /** Captured stdout. */
    stdout: string;
    /** Captured stderr. */
    stderr: string;
}
/** Spawn `file args` with a timeout cap, silently capturing output. */
export declare function run(file: string, args: readonly string[], timeoutMs: number): Promise<CommandResult>;
/** A command runner injectable by tests. */
export type CommandRunner = (file: string, args: readonly string[], timeoutMs: number) => Promise<CommandResult>;
/** The default runner: child_process.execFile. */
export declare const defaultRun: CommandRunner;
/** Whether a path exists and is a directory (cheap git-repo probe). */
export declare function pathExists(path: string): boolean;
/**
 * Build the argv for one `git` invocation inside `repoPath`, with the TLS
 * backend pinned when `sslBackend` is set. Windows machines whose schannel
 * credential store is unavailable (SEC_E_NO_CREDENTIALS) need the OpenSSL
 * backend; `-c http.sslBackend=openssl` fixes that without a persistent
 * config edit.
 */
export declare function gitArgs(repoPath: string, sslBackend: string | undefined, args: string[]): string[];
