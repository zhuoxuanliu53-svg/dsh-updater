/**
 * Smoke test for dsh-updater host logic, offline via the injected `run`
 * command seam (real cross-repo git transport is blocked in this sandbox).
 * Run from the plugin dir with the local node_modules present:
 *   node scripts/smoke-test.mjs
 */
import assert from 'node:assert/strict'
import { checkUpdate, applyUpdate } from '../lib/index.js'

/** Build a fake runner keyed by argv tails. */
function fakeRun(behaviors) {
  return async (file, args, timeoutMs) => {
    const key = [...args].slice(2).join(' ') // drop ['-C', repo]
    const behavior = behaviors[key] ?? behaviors.default
    if (behavior == null) throw new Error(`no behavior for: ${key}`)
    if (typeof behavior === 'function') return behavior(...args)
    return { code: behavior.code ?? 0, stdout: behavior.stdout ?? '', stderr: behavior.stderr ?? '' }
  }
}

const repo = 'C:/fake/deepseek-harness'
const common = { repoPath: repo, remote: 'origin', branch: 'master', fetchTimeoutMs: 10000 }

// --- check: up to date -----------------------------------------------------
{
  const r = fakeRun({
    'rev-parse --git-dir': { stdout: '.git\n' },
    'rev-parse HEAD': { stdout: 'aaa1111aaaa\n' },
    'rev-parse --abbrev-ref HEAD': { stdout: 'master\n' },
    'fetch origin master': { stdout: '' },
    'rev-parse origin/master': { stdout: 'aaa1111aaaa\n' },
    'rev-list --count aaa1111aaaa..origin/master': { stdout: '0\n' },
    'rev-list --count origin/master..aaa1111aaaa': { stdout: '0\n' },
  })
  const out = await checkUpdate({ ...common, run: r })
  assert.equal(out.ok, true)
  assert.equal(out.hasUpdate, false)
  assert.equal(out.behind, 0)
  console.log('check (up to date): ok', out.currentShort, 'behind', out.behind)
}

// --- check: update available ----------------------------------------------
{
  const r = fakeRun({
    'rev-parse --git-dir': { stdout: '.git\n' },
    'rev-parse HEAD': { stdout: 'aaa1111aaaa\n' },
    'rev-parse --abbrev-ref HEAD': { stdout: 'master\n' },
    'fetch origin master': { stdout: '' },
    'rev-parse origin/master': { stdout: 'bbb2222bbbb\n' },
    'rev-list --count aaa1111aaaa..origin/master': { stdout: '3\n' },
    'rev-list --count origin/master..aaa1111aaaa': { stdout: '0\n' },
  })
  const out = await checkUpdate({ ...common, run: r })
  assert.equal(out.ok, true)
  assert.equal(out.hasUpdate, true)
  assert.equal(out.behind, 3)
  assert.equal(out.remoteShort, 'bbb2222')
  console.log('check (update available): ok behind', out.behind)
}

// --- check: network failure ------------------------------------------------
{
  const r = fakeRun({
    'rev-parse --git-dir': { stdout: '.git\n' },
    'rev-parse HEAD': { stdout: 'aaa1111aaaa\n' },
    'rev-parse --abbrev-ref HEAD': { stdout: 'master\n' },
    'fetch origin master': { code: 128, stderr: 'fatal: unable to access \'https://github.com/...\': schannel: AcquireCredentialsHandle failed' },
  })
  const out = await checkUpdate({ ...common, run: r })
  assert.equal(out.ok, false)
  assert.equal(out.code, 'network')
  console.log('check (network fail): code !=', out.code || Object.keys(out))
}

// --- check: not a repo -----------------------------------------------------
{
  const r = fakeRun({ 'rev-parse --git-dir': { code: 128, stderr: 'fatal: not a git repository' } })
  const out = await checkUpdate({ ...common, run: r })
  assert.equal(out.ok, false)
  assert.equal(out.code, 'not-a-repo')
  console.log('check (not-a-repo): code ==', out.code)
}

// --- update: applied -------------------------------------------------------
{
  let headCalls = 0
  const r = fakeRun({
    'rev-parse HEAD': () => ({ code: 0, stdout: `${headCalls++ === 0 ? 'aaa1111aaaa' : 'bbb2222bbbb'}\n`, stderr: '' }),
    'diff --quiet': { code: 0 },
    'diff --cached --quiet': { code: 0 },
    'rev-parse --verify refs/remotes/origin/master': { stdout: 'bbb2222bbbb\n' },
    'merge --ff-only origin/master': { stdout: 'Fast-forward\n' },
  })
  const out = await applyUpdate({
    ...common, gitTimeoutMs: 10000, rebuildTimeoutMs: 10000, rebuildAfterUpdate: false, run: r,
  })
  assert.equal(out.ok, true)
  assert.equal(out.applied, true)
  assert.equal(out.rebuilt, false)
  console.log('update (applied): ok applied', out.applied)
}

// --- update: dirty working tree (tracked files) ----------------------------
{
  const r = fakeRun({
    'rev-parse HEAD': { stdout: 'aaa1111aaaa\n' },
    'diff --quiet': { code: 1 },
    'diff --cached --quiet': { code: 0 },
  })
  const out = await applyUpdate({
    ...common, gitTimeoutMs: 10000, rebuildTimeoutMs: 10000, rebuildAfterUpdate: false, run: r,
  })
  assert.equal(out.ok, false)
  assert.equal(out.code, 'dirty')
  console.log('update (dirty tracked): code ==', out.code)
}

// --- update: untracked scratch dir must NOT block --------------------------
{
  let headCalls = 0
  const r = fakeRun({
    // Clean tracked tree (diff --quiet exits 0); an untracked dir is invisible
    // to git diff, exactly like _tmp_plugin_market/ in the real checkout.
    'rev-parse HEAD': () => ({ code: 0, stdout: `${headCalls++ === 0 ? 'aaa1111aaaa' : 'bbb2222bbbb'}\n`, stderr: '' }),
    'diff --quiet': { code: 0 },
    'diff --cached --quiet': { code: 0 },
    'rev-parse --verify refs/remotes/origin/master': { stdout: 'bbb2222bbbb\n' },
    'merge --ff-only origin/master': { stdout: 'Fast-forward\n' },
  })
  const out = await applyUpdate({
    ...common, gitTimeoutMs: 10000, rebuildTimeoutMs: 10000, rebuildAfterUpdate: false, run: r,
  })
  assert.equal(out.ok, true)
  assert.equal(out.applied, true)
  console.log('update (untracked ignored): ok applied', out.applied)
}

console.log('\nAll smoke tests passed.')
