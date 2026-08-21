/**
 * Host logic for checking the local git checkout against the official
 * remote: verify the repository, fetch the tracked branch, and report how far
 * the local checkout has drifted. Network failures are surfaced explicitly
 * (never reported as "up to date").
 */

import type { CommandRunner } from './git.ts'
import { defaultRun, gitArgs } from './git.ts'
import type { CheckOutcome, CheckResult } from './protocol.ts'

/** Options configuring a single check. */
export interface CheckOptions {
  /** Absolute path of the git checkout (default D:\DSH\deepseek-harness). */
  repoPath: string
  /** Git remote name (default origin = https://github.com/deepseek-ai/deepseek-harness). */
  remote: string
  /** Branch to track (default master). */
  branch: string
  /** Timeout for the git fetch, in ms. */
  fetchTimeoutMs: number
  /** Git TLS backend (openssl on Windows hosts with a broken schannel store). */
  sslBackend?: string
  /** Command runner (test seam). */
  run?: CommandRunner
}

/** True when an error message looks like a network / credential failure. */
function isNetworkish(message: string): boolean {
  const lower = message.toLowerCase()
  return /(unable to access|could not resolve host|operation timed out|network is unreachable|failed to connect|schannel|acquirecredentials|ssl|certificate|refused|econnrefused|timeout|no route to host)/.test(lower)
}

/** Shorten a full sha to the conventional 7 characters. */
function short(sha: string): string {
  return sha.length <= 7 ? sha : sha.slice(0, 7)
}

/**
 * Compare the local checkout to the official remote. Refreshes the remote
 * tracking ref with `git fetch` first, then reports the drift.
 * @returns a CheckOutcome: success with drift, or a typed failure.
 */
export async function checkUpdate(opts: CheckOptions): Promise<CheckOutcome> {
  const run = opts.run ?? defaultRun
  const { repoPath, remote, branch, fetchTimeoutMs, sslBackend } = opts
  const ref = `${remote}/${branch}`

  // Verify the checkout is a git repository (git-dir resolution fails otherwise).
  const gitDir = await run('git', gitArgs(repoPath, sslBackend, ['rev-parse', '--git-dir']), 10_000)
  if (gitDir.code !== 0) {
    return {
      ok: false,
      code: 'not-a-repo',
      message: `不是 Git 仓库或路径不存在: ${repoPath}`,
      detail: gitDir.stderr.trim(),
    }
  }

  // Resolve the local HEAD and branch.
  const currentRaw = await run('git', gitArgs(repoPath, sslBackend, ['rev-parse', 'HEAD']), 10_000)
  if (currentRaw.code !== 0) {
    return {
      ok: false,
      code: 'git',
      message: '无法解析本地 HEAD',
      detail: currentRaw.stderr.trim(),
    }
  }
  const current = currentRaw.stdout.trim()

  const branchRaw = await run('git', gitArgs(repoPath, sslBackend, ['rev-parse', '--abbrev-ref', 'HEAD']), 10_000)
  const branchName = branchRaw.code === 0 ? (branchRaw.stdout.trim() || 'HEAD') : branch

  // Refetch the tracked branch; this is where network failures surface.
  const fetch = await run('git', gitArgs(repoPath, sslBackend, ['fetch', remote, branch]), fetchTimeoutMs)
  if (fetch.code !== 0) {
    const message = `无法从远程 ${remote} 获取更新（网络或凭据问题）`
    return {
      ok: false,
      code: isNetworkish(fetch.stderr) ? 'network' : 'git',
      message,
      detail: fetch.stderr.trim(),
    }
  }

  // Resolve the official remote sha for the tracked branch.
  const remoteRaw = await run('git', gitArgs(repoPath, sslBackend, ['rev-parse', ref]), 10_000)
  if (remoteRaw.code !== 0) {
    return {
      ok: false,
      code: 'git',
      message: `远程引用 ${ref} 不存在`,
      detail: remoteRaw.stderr.trim(),
    }
  }
  const remoteSha = remoteRaw.stdout.trim()

  // Drift: behind = commits local is missing from remote; ahead = local-only commits.
  const behindRaw = await run('git', gitArgs(repoPath, sslBackend, ['rev-list', '--count', `${current}..${ref}`]), 10_000)
  const aheadRaw = await run('git', gitArgs(repoPath, sslBackend, ['rev-list', '--count', `${ref}..${current}`]), 10_000)
  const behind = behindRaw.code === 0 ? Number(behindRaw.stdout.trim() || '0') : 0
  const ahead = aheadRaw.code === 0 ? Number(aheadRaw.stdout.trim() || '0') : 0

  const result: CheckResult = {
    ok: true,
    repoPath,
    branch: branchName,
    current,
    currentShort: short(current),
    remote: remoteSha,
    remoteShort: short(remoteSha),
    behind,
    ahead,
    hasUpdate: behind > 0,
  }
  return result
}
