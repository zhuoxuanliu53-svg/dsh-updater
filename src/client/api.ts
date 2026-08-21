/**
 * Browser-side API client for /api/dsh-updater - plain same-origin fetch,
 * the only data path the settings card uses.
 */
import { UPDATER_API, type CheckOutcome, type UpdateOutcome, type ConfigPatch, type ConfigView } from '../protocol.ts'

/** Error carrying the route's message. */
export class UpdaterApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UpdaterApiError'
  }
}

/** The card's editable config fields, as served by the host. */
export type UpdaterConfig = Omit<ConfigView, 'ok'>

/** Ask the host to check the git checkout against the official remote. */
export async function checkUpdate(): Promise<CheckOutcome> {
  const response = await fetch(UPDATER_API.check, { method: 'POST' })
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new UpdaterApiError(`HTTP ${response.status}: invalid JSON response`)
  }
  return body as CheckOutcome
}

/** Ask the host to fast-forward the git checkout to the official remote. */
export async function applyUpdate(): Promise<UpdateOutcome> {
  const response = await fetch(UPDATER_API.update, { method: 'POST' })
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new UpdaterApiError(`HTTP ${response.status}: invalid JSON response`)
  }
  return body as UpdateOutcome
}

/** Read the current config from the host. */
export async function getConfig(): Promise<UpdaterConfig> {
  const response = await fetch(UPDATER_API.config, { method: 'GET' })
  const body = await parseJson(response)
  if (body === undefined || !body.ok) {
    throw new UpdaterApiError(body?.message ?? `HTTP ${response.status}`)
  }
  return { repoPath: body.repoPath, rebuildAfterUpdate: body.rebuildAfterUpdate }
}

/** Persist one config patch and return the host-accepted view. */
export async function setConfig(patch: ConfigPatch): Promise<UpdaterConfig> {
  const response = await fetch(UPDATER_API.config, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const body = await parseJson(response)
  if (body === undefined || !body.ok) {
    throw new UpdaterApiError(body?.message ?? `HTTP ${response.status}`)
  }
  return { repoPath: body.repoPath, rebuildAfterUpdate: body.rebuildAfterUpdate }
}

/** Parse one JSON body into a loose record, or throw a typed error. */
async function parseJson(response: Response): Promise<(ConfigView & { ok: boolean; message?: string }) | undefined> {
  try {
    return (await response.json()) as (ConfigView & { ok: boolean; message?: string }) | undefined
  } catch {
    throw new UpdaterApiError(`HTTP ${response.status}: invalid JSON response`)
  }
}
