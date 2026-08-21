/**
 * Host logic for applying an official update: fast-forward the local
 * checkout to the tracked remote with `--ff-only`, then optionally rebuild
 * (`pnpm install && pnpm run build`). Never auto-restarts - it only reports
 * what changed and that a restart is required.
 */

import type { CommandRunner } from './git.ts'
import { defaultRun, gitArgs } from './git.ts'
import type { UpdateOutcome, UpdateAppliedResult } from './protocol.ts'

/** Options configuring one update. */
export interface UpdateOptions {
  /** Absolute path of the git checkout. */
  repoPath: string
  /** Git remote name. */
  remote: string
  /** Branch to track. */
  branch: string
  /** Timeout for the git merge, in ms. */
  gitTimeoutMs: number
  /** Timeout for each rebuild command, in ms. */
  rebuildTimeoutMs: number
  /** Whether to run `pnpm install && pnpm run build` after pulling. */
  rebuildAfterUpdate: boolean
  /** Git TLS backend (openssl on Windows hosts with a broken schannel store). */
  sslBackend?: string
  /** Command runner (test seam). */
  run?: CommandRunner
}

/** Capture a command and append to the running log; returns exit code. */
async function logRun(
  log: string[],
  run: CommandRunner,
  file: string,
  args: readonly string[],
  timeoutMs: number,
  cwd?: string,
  label?: string,
): Promise<number> {
  const result = await run(file, args, timeoutMs, cwd)
  log.push(`$ ${label ?? `${file} ${args.join(' ')}`}`)
  if (result.stdout.trim()) log.push(result.stdout.trim())
  if (result.stderr.trim()) log.push(result.stderr.trim())
  return result.code ?? -1
}

/**
 * Build the argv for one `pnpm` invocation that works cross-platform. On
 * Windows `pnpm` is a `.CMD` shim that `execFile` cannot spawn directly
 * (it fails with ENOENT/EINVAL), so route it through `cmd.exe /d /s /c`.
 * On macOS/Linux the `pnpm` shebang script is executable directly.
 */
function pnpmCommand(sub: readonly string[]): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return { file: 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm', ...sub] }
  }
  return { file: 'pnpm', args: [...sub] }
}

/**
 * Apply the official update. The local checkout must be clean enough for a
 * fast-forward merge; a dirty working tree or a diverged history returns a
 * typed failure instead of trying to stash/merge for the user.
 * @returns an UpdateOutcome describing the result.
 */
export async function applyUpdate(opts: UpdateOptions): Promise<UpdateOutcome> {
  const run = opts.run ?? defaultRun
  const { repoPath, remote, branch, sslBackend } = opts
  const ref = `${remote}/${branch}`
  const log: string[] = []

  // Current HEAD before the merge.
  const beforeRaw = await run('git', gitArgs(repoPath, sslBackend, ['rev-parse', 'HEAD']), 10_000)
  if (beforeRaw.code !== 0) {
    return { ok: false, code: 'git', message: '无法解析本地 HEAD', detail: beforeRaw.stderr.trim() }
  }
  const before = beforeRaw.stdout.trim()

  // Require a clean working tree over TRACKED files only. Untracked files and
  // directories are deliberately ignored: a fast-forward merge leaves them
  // alone, so a stray scratch dir (e.g. _tmp_plugin_market/) must not block an
  // update. If an untracked path collides with the incoming tree, the merge
  // below fails with its own clear error instead.
  const workDiff = await run('git', gitArgs(repoPath, sslBackend, ['diff', '--quiet']), 10_000)
  if (workDiff.code !== 0 && workDiff.code !== 1) {
    return { ok: false, code: 'git', message: '无法读取工作区状态', detail: workDiff.stderr.trim() }
  }
  const indexDiff = await run('git', gitArgs(repoPath, sslBackend, ['diff', '--cached', '--quiet']), 10_000)
  if (indexDiff.code !== 0 && indexDiff.code !== 1) {
    return { ok: false, code: 'git', message: '无法读取暂存区状态', detail: indexDiff.stderr.trim() }
  }
  if (workDiff.code === 1 || indexDiff.code === 1) {
    const parts: string[] = []
    if (workDiff.code === 1) parts.push('working tree: tracked files modified')
    if (indexDiff.code === 1) parts.push('index: staged changes')
    return {
      ok: false,
      code: 'dirty',
      message: '工作区有未提交的改动（已跟踪文件），请先提交或暂存后再更新（插件不会自动 stash/丢弃）',
      detail: parts.join('; '),
    }
  }

  // The remote ref must exist (the check step normally fetches it).
  const refExists = await run('git', gitArgs(repoPath, sslBackend, ['rev-parse', '--verify', `refs/remotes/${ref}`]), 10_000)
  if (refExists.code !== 0) {
    return { ok: false, code: 'git', message: `远程引用 ${ref} 不存在，请先「检查更新」`, detail: refExists.stderr.trim() }
  }

  // Fast-forward merge only: if the histories diverged, report and stop.
  const mergeCode = await logRun(log, run, 'git', gitArgs(repoPath, sslBackend, ['merge', '--ff-only', ref]), opts.gitTimeoutMs)
  if (mergeCode !== 0) {
    return {
      ok: false,
      code: 'conflict',
      message: '无法快进合并（可能是分叉或本地独有提交）。请人工运行 git pull --rebase 处理，插件不会自动合并。',
      detail: log.join('\n'),
    }
  }

  const afterRaw = await run('git', gitArgs(repoPath, sslBackend, ['rev-parse', 'HEAD']), 10_000)
  const after = afterRaw.code === 0 ? afterRaw.stdout.trim() : before
  const applied = after !== before

  // Optional rebuild. Any failure is surfaced but does not roll back the pull.
  let rebuilt = false
  if (opts.rebuildAfterUpdate) {
    log.push('-- rebuild --')
    const install = pnpmCommand(['install'])
    const installCode = await logRun(log, run, install.file, install.args, opts.rebuildTimeoutMs, repoPath, 'pnpm install')
    if (installCode === 0) {
      const build = pnpmCommand(['run', 'build'])
      const buildCode = await logRun(log, run, build.file, build.args, opts.rebuildTimeoutMs, repoPath, 'pnpm run build')
      rebuilt = buildCode === 0
      if (!rebuilt) log.push('rebuild: pnpm run build 未成功')
    } else {
      log.push('rebuild: pnpm install 未成功')
    }
  }

  const result: UpdateAppliedResult = {
    ok: true,
    applied,
    before,
    after,
    rebuilt,
    log: log.join('\n'),
  }
  return result
}
