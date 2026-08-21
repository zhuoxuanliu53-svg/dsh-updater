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

import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { checkUpdate } from './api.ts'
import { applyUpdate } from './update.ts'
import { isLoopbackRequest } from './loopback.ts'
import { mountOnce } from './mount-once.ts'
import { UPDATER_API, type CheckOutcome, type UpdateOutcome, type ConfigPatch, type ConfigView } from './protocol.ts'

// Re-export the pure host logic so the check/update steps are testable and
// reusable without mounting the cordis plugin.
export { checkUpdate } from './api.ts'
export { applyUpdate } from './update.ts'
export type { CheckOptions } from './api.ts'
export type { UpdateOptions } from './update.ts'
export { UPDATER_API } from './protocol.ts'
export type { CheckOutcome, UpdateOutcome, CheckResult, UpdateAppliedResult, FailureResult, ConfigView, ConfigPatch, ConfigOutcome } from './protocol.ts'

/** Stable cordis plugin name. */
export const name = 'dsh-updater'

/** Services required before the routes can mount. */
export const inject = ['webServer', 'settings']

/** Settings namespace of the dsh-updater capability. */
export const UPDATER_SETTINGS_NAMESPACE = settingsNamespace('dsh-updater')

/** Default git checkout this plugin manages. */
export const DEFAULT_REPO_PATH = 'D:\\DSH\\deepseek-harness'
export const DEFAULT_REMOTE = 'origin'
export const DEFAULT_BRANCH = 'master'
const DEFAULT_FETCH_TIMEOUT_MS = 30_000
const DEFAULT_GIT_TIMEOUT_MS = 60_000
const DEFAULT_REBUILD_TIMEOUT_MS = 600_000
const DEFAULT_SSL_BACKEND = 'openssl'

/** Plugin config, validated by the matched schemastery schema. */
export interface Config {
  /** Absolute path of the DeepSeek Harness git checkout. */
  repoPath?: string
  /** Git remote name (the official upstream, normally `origin`). */
  remote?: string
  /** Branch to track (normally `master`). */
  branch?: string
  /** Timeout (ms) for the git fetch during a check. */
  fetchTimeoutMs?: number
  /** Timeout (ms) for the git merge during an update. */
  gitTimeoutMs?: number
  /** Timeout (ms) for each rebuild command (pnpm install / build). */
  rebuildTimeoutMs?: number
  /** Run `pnpm install && pnpm run build` after pulling when an update applies. Default off. */
  rebuildAfterUpdate?: boolean
  /** Git TLS backend: `openssl` (default) or `schannel`. OpenSSL is required on hosts whose schannel credential store is unavailable. */
  sslBackend?: string
}

/** Plugin config schema (also the settings namespace schema). */
export const Config: z<Config> = z.object({
  repoPath: z.string().default(DEFAULT_REPO_PATH),
  remote: z.string().default(DEFAULT_REMOTE),
  branch: z.string().default(DEFAULT_BRANCH),
  fetchTimeoutMs: z.number().default(DEFAULT_FETCH_TIMEOUT_MS),
  gitTimeoutMs: z.number().default(DEFAULT_GIT_TIMEOUT_MS),
  rebuildTimeoutMs: z.number().default(DEFAULT_REBUILD_TIMEOUT_MS),
  rebuildAfterUpdate: z.boolean().default(false),
  sslBackend: z.string().default(DEFAULT_SSL_BACKEND),
})

/** Schema default for the rebuild toggle (off: pull only, then prompt to restart). */
export const DEFAULT_REBUILD = false

/** Render one JSON response. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

/** Read a small JSON request body, returning undefined when absent/unparseable. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let text = ''
  for await (const chunk of req) text += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  if (text.trim() === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/**
 * Mount the two routes, gated on the composition entry config. Settings
 * writes (from the card) re-point the source thunk and stay live.
 * @param ctx - host plugin context carrying webServer/settings.
 * @param config - resolved plugin config.
 */
export const apply = mountOnce('dsh-updater', applyImpl)

function applyImpl(ctx: Context, config?: Config): void {
  let current: () => Config = () => config ?? {}
  let disposeRoutes: (() => void) | undefined

  /** Persist a config patch into the host settings seam and answer the resolved view. */
  const writeConfig = async (patch: ConfigPatch): Promise<ConfigView> => {
    await ctx.settings.update(UPDATER_SETTINGS_NAMESPACE, patch)
    const resolved = ctx.settings.get(UPDATER_SETTINGS_NAMESPACE) as Config | undefined
    return {
      ok: true,
      repoPath: resolved?.repoPath ?? DEFAULT_REPO_PATH,
      rebuildAfterUpdate: resolved?.rebuildAfterUpdate ?? DEFAULT_REBUILD,
    }
  }

  /** (Re)register the route family to match the current source. */
  const sync = (): void => {
    if (disposeRoutes !== undefined) {
      disposeRoutes()
      disposeRoutes = undefined
    }
    const value = current() ?? {}
    disposeRoutes = ctx.effect(
      () => {
        const routes = makeRoutes({
          repoPath: value.repoPath ?? DEFAULT_REPO_PATH,
          remote: value.remote ?? DEFAULT_REMOTE,
          branch: value.branch ?? DEFAULT_BRANCH,
          fetchTimeoutMs: value.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
          gitTimeoutMs: value.gitTimeoutMs ?? DEFAULT_GIT_TIMEOUT_MS,
          rebuildTimeoutMs: value.rebuildTimeoutMs ?? DEFAULT_REBUILD_TIMEOUT_MS,
          rebuildAfterUpdate: value.rebuildAfterUpdate ?? DEFAULT_REBUILD,
          sslBackend: value.sslBackend ?? DEFAULT_SSL_BACKEND,
        }, writeConfig)
        const disposers = routes.map(route => ctx.webServer.register(route))
        return () => { for (const dispose of disposers) dispose() }
      },
      'dsh-updater: routes',
    )
  }

  installSettingsSection(ctx, UPDATER_SETTINGS_NAMESPACE, Config, config ?? {}, {
    setSource: (source) => { current = source; sync() },
    onChange: sync,
  })

  // Initial registration from the composition entry (deployments with no
  // settings service, whose installSettingsSection never fires its hooks).
  sync()
}

/** Route-family config, read at call time from the live settings source. */
export interface UpdateRoutesConfig {
  repoPath: string
  remote: string
  branch: string
  fetchTimeoutMs: number
  gitTimeoutMs: number
  rebuildTimeoutMs: number
  rebuildAfterUpdate: boolean
  sslBackend: string
}

/** Persist a config patch and answer the freshly-resolved view; provided by the plugin body so the route stays testable. */
export type WriteConfig = (patch: ConfigPatch) => Promise<ConfigView>

/** Build the /api/dsh-updater route family. */
export function makeRoutes(cfg: UpdateRoutesConfig, writeConfig: WriteConfig): WebRoute[] {
  const checkRoute: WebRoute = {
    kind: 'exact',
    path: UPDATER_API.check,
    handler: async (req, res) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, code: 'forbidden', message: 'forbidden: loopback-only' })
        return
      }
      if ((req.method ?? 'GET') !== 'POST' && req.method !== 'GET') {
        writeJson(res, 405, { ok: false, code: 'git', message: `method not allowed: ${req.method}` })
        return
      }
      try {
        const outcome: CheckOutcome = await checkUpdate({
          repoPath: cfg.repoPath,
          remote: cfg.remote,
          branch: cfg.branch,
          fetchTimeoutMs: cfg.fetchTimeoutMs,
          sslBackend: cfg.sslBackend,
        })
        writeJson(res, 200, outcome)
      } catch (error) {
        writeJson(res, 200, {
          ok: false,
          code: 'unknown',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }

  const updateRoute: WebRoute = {
    kind: 'exact',
    path: UPDATER_API.update,
    handler: async (req, res) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, code: 'forbidden', message: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, code: 'git', message: `method not allowed: ${req.method}` })
        return
      }
      try {
        const outcome: UpdateOutcome = await applyUpdate({
          repoPath: cfg.repoPath,
          remote: cfg.remote,
          branch: cfg.branch,
          gitTimeoutMs: cfg.gitTimeoutMs,
          rebuildTimeoutMs: cfg.rebuildTimeoutMs,
          rebuildAfterUpdate: cfg.rebuildAfterUpdate,
          sslBackend: cfg.sslBackend,
        })
        writeJson(res, 200, outcome)
      } catch (error) {
        writeJson(res, 200, {
          ok: false,
          code: 'unknown',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }

  const configRoute: WebRoute = {
    kind: 'exact',
    path: UPDATER_API.config,
    handler: async (req, res) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, code: 'forbidden', message: 'forbidden: loopback-only' })
        return
      }
      if (req.method === 'GET') {
        const view: ConfigView = {
          ok: true,
          repoPath: cfg.repoPath,
          rebuildAfterUpdate: cfg.rebuildAfterUpdate,
        }
        writeJson(res, 200, view)
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, code: 'git', message: `method not allowed: ${req.method}` })
        return
      }
      try {
        const raw = await readJsonBody(req)
        const patch: ConfigPatch = {}
        if (typeof raw === 'object' && raw !== null) {
          const record = raw as Record<string, unknown>
          if (typeof record.repoPath === 'string') patch.repoPath = record.repoPath
          if (typeof record.rebuildAfterUpdate === 'boolean') patch.rebuildAfterUpdate = record.rebuildAfterUpdate
        }
        if (patch.repoPath === undefined && patch.rebuildAfterUpdate === undefined) {
          writeJson(res, 400, { ok: false, code: 'git', message: 'no config fields to write' })
          return
        }
        const view = await writeConfig(patch)
        writeJson(res, 200, view)
      } catch (error) {
        writeJson(res, 200, {
          ok: false,
          code: 'unknown',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }

  return [checkRoute, updateRoute, configRoute]
}
