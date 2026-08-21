/**
 * Real end-to-end test: run the built dsh-updater host logic against a real
 * clone of deepseek-harness (clone lives in this workspace). Uses the real
 * git runner (no fake seam), with the openssl TLS backend this host needs.
 */
import { checkUpdate, applyUpdate } from '../lib/index.js'
import { fileURLToPath } from 'node:url'

const repoPath = fileURLToPath(new URL('../../harness-test', import.meta.url))
const base = { repoPath, remote: 'origin', branch: 'master', sslBackend: 'openssl' }

console.log('repoPath:', repoPath)

console.log('\n--- checkUpdate ---')
const check = await checkUpdate({ ...base, fetchTimeoutMs: 60000 })
console.log(JSON.stringify(check, null, 2))

if (check.ok && check.hasUpdate) {
  console.log('\n--- applyUpdate ---')
  const upd = await applyUpdate({ ...base, gitTimeoutMs: 60000, rebuildTimeoutMs: 60000, rebuildAfterUpdate: false })
  console.log(JSON.stringify(upd, null, 2))
} else {
  console.log('\n(no update available; skipping applyUpdate)')
}
