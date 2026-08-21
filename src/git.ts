/**
 * Thin wrapper over child_process.execFile for running git (and optionally
 * pnpm) against a fixed repository without ever changing the process cwd.
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Captured result of one spawned command. */
export interface CommandResult {
  /** Process exit code; null when the spawn itself failed. */
  code: number | null
  /** Captured stdout. */
  stdout: string
  /** Captured stderr. */
  stderr: string
}

/** Spawn `file args` with a timeout cap, silently capturing output. */
export async function run(
  file: string,
  args: readonly string[],
  timeoutMs: number,
  cwd?: string,
): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync(file, [...args], {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      ...(cwd === undefined ? {} : { cwd }),
    })
    return { code: 0, stdout, stderr }
  } catch (error) {
    const err = error as { code?: unknown; stdout?: unknown; stderr?: unknown }
    return {
      code: typeof err.code === 'number' ? err.code : null,
      stdout: typeof err.stdout === 'string' ? err.stdout : '',
      stderr: typeof err.stderr === 'string' ? err.stderr : (error instanceof Error ? error.message : String(error)),
    }
  }
}

/** A command runner injectable by tests. */
export type CommandRunner = (file: string, args: readonly string[], timeoutMs: number, cwd?: string) => Promise<CommandResult>

/** The default runner: child_process.execFile. */
export const defaultRun: CommandRunner = run

/** Whether a path exists and is a directory (cheap git-repo probe). */
export function pathExists(path: string): boolean {
  return existsSync(path)
}

/**
 * Build the argv for one `git` invocation inside `repoPath`, with the TLS
 * backend pinned when `sslBackend` is set. Windows machines whose schannel
 * credential store is unavailable (SEC_E_NO_CREDENTIALS) need the OpenSSL
 * backend; `-c http.sslBackend=openssl` fixes that without a persistent
 * config edit.
 */
export function gitArgs(repoPath: string, sslBackend: string | undefined, args: string[]): string[] {
  const argv = ['-C', repoPath]
  if (sslBackend !== undefined && sslBackend !== '') {
    argv.push('-c', `http.sslBackend=${sslBackend}`)
  }
  argv.push(...args)
  return argv
}
