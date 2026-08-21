/**
 * The dsh-updater settings card: shows the current vs official remote commit,
 * a "check update" button, an "update" button, and a "rebuild after update"
 * toggle. Registers into the official `settings.section` slot.
 *
 * The component never touches ctx. Its two editable fields (repo path and the
 * rebuild toggle) are read from and written to the plugin's own loopback
 * config route (/api/dsh-updater/config) instead of a settings scope, because
 * rc.6 host-apiproxy refuses every third-party settings namespace at the RPC
 * boundary (`settings-not-exposed`) and thus a bound scope never becomes
 * ready.
 */

import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { CheckOutcome, UpdateOutcome } from '../protocol.ts'
import { applyUpdate, checkUpdate, getConfig, setConfig, type UpdaterConfig } from './api.ts'
import css from './UpdaterCard.module.css'

/** Props the renderer binds for the dsh-updater card. */
export type UpdaterCardProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'dsh-updater'>

/** t() bound to the dsh-updater dictionary. */
type T = TranslateNS<'dsh-updater'>

/** Map a typed failure to localized copy. */
function failureText(t: T, outcome: { code: string; message: string }): string {
  switch (outcome.code) {
    case 'network': return t('networkError')
    case 'not-a-repo': return `${t('notARepo')}: ${outcome.message}`
    case 'dirty': return t('dirty')
    case 'conflict': return t('conflict')
    case 'git': return `${t('gitError')}: ${outcome.message}`
    default: return t('unknownError')
  }
}

/**
 * Render the dsh-updater settings card.
 * @param props - locale copy and the runtime section props.
 * @returns the card.
 */
export function UpdaterCard(props: UpdaterCardProps) {
  const { t } = props
  const [config, setConfigState] = useState<UpdaterConfig | undefined>(undefined)
  const [configError, setConfigError] = useState<string | undefined>(undefined)
  const [repoDraft, setRepoDraft] = useState<string | undefined>(undefined)
  const [check, setCheck] = useState<CheckOutcome | undefined>(undefined)
  const [update, setUpdate] = useState<UpdateOutcome | undefined>(undefined)
  const [busy, setBusy] = useState<'check' | 'update' | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void getConfig().then(
      (value) => { if (!cancelled) { setConfigState(value); setConfigError(undefined) } },
      (error: unknown) => { if (!cancelled) setConfigError(error instanceof Error ? error.message : String(error)) },
    )
    return () => { cancelled = true }
  }, [])

  const ready = config !== undefined
  const repoPath = repoDraft ?? config?.repoPath ?? ''
  const rebuild = config?.rebuildAfterUpdate ?? false

  const commitRepoPath = async (): Promise<void> => {
    const draft = repoDraft?.trim()
    setRepoDraft(undefined)
    if (draft === undefined || draft === '' || draft === config?.repoPath) return
    const previous = config
    setConfigState((value) => (value ? { ...value, repoPath: draft } : value))
    try {
      const accepted = await setConfig({ repoPath: draft })
      setConfigState((value) => (value ? { ...value, ...accepted } : accepted))
      setConfigError(undefined)
    } catch (error) {
      setConfigState(previous)
      setConfigError(error instanceof Error ? error.message : String(error))
    }
  }

  const toggleRebuild = async (next: boolean): Promise<void> => {
    const previous = config
    setConfigState((value) => (value ? { ...value, rebuildAfterUpdate: next } : value))
    try {
      const accepted = await setConfig({ rebuildAfterUpdate: next })
      setConfigState((value) => (value ? { ...value, ...accepted } : accepted))
      setConfigError(undefined)
    } catch (error) {
      setConfigState(previous)
      setConfigError(error instanceof Error ? error.message : String(error))
    }
  }

  const onCheck = async (): Promise<void> => {
    setBusy('check')
    setCheck(undefined)
    try {
      setCheck(await checkUpdate())
    } catch (error) {
      setCheck({ ok: false, code: 'unknown', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(undefined)
    }
  }

  const onUpdate = async (): Promise<void> => {
    setBusy('update')
    setUpdate(undefined)
    try {
      setUpdate(await applyUpdate())
    } catch (error) {
      setUpdate({ ok: false, code: 'unknown', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(undefined)
    }
  }

  const status = (): string => {
    if (update !== undefined && !update.ok) return failureText(t, update)
    if (check !== undefined && !check.ok) return failureText(t, check)
    if (update !== undefined && update.ok) {
      if (!update.applied) return t('updateNoChange')
      const hint = t('updatedHint').replace('{sha}', update.after.slice(0, 7))
      const rebuildNote = update.rebuilt
        ? ` ${t('rebuildDone')}`
        : (update.log.includes('-- rebuild --') ? ` ${t('rebuildSkipped')}` : '')
      return `${hint}${rebuildNote}`
    }
    if (check !== undefined && check.ok) {
      if (check.hasUpdate) {
        return `${t('hasUpdate')} · ${t('current')} ${check.currentShort} · ${t('remote')} ${check.remoteShort} · ${t('behind')} ${check.behind}`
      }
      return `${t('upToDate')} · ${t('current')} ${check.currentShort}`
    }
    return t('notChecked')
  }

  return (
    <section className={css.card} aria-label={t('nav')}>
      <h3 className={css.title}>{t('nav')}</h3>
      <p className={css.status} role="status">{status()}</p>

      <label className={css.field}>
        <span>{t('repoPathLabel')}</span>
        <input
          type="text"
          className={css.input}
          value={repoPath}
          disabled={!ready || busy !== undefined}
          onBlur={() => { void commitRepoPath() }}
          onChange={(event) => setRepoDraft(event.target.value)}
          placeholder="D:\DSH\deepseek-harness"
        />
        <small>{t('repoPathHint')}</small>
      </label>

      <label className={css.toggle}>
        <input
          type="checkbox"
          checked={rebuild}
          disabled={!ready || busy !== undefined}
          onChange={(event) => { void toggleRebuild(event.target.checked) }}
        />
        <span>{t('rebuildToggle')}</span>
        <small>{t('rebuildHint')}</small>
      </label>

      {configError !== undefined && (
        <p className={css.status} role="alert">{t('configError')}: {configError}</p>
      )}

      <div className={css.actions}>
        <button type="button" className={css.primary} disabled={busy !== undefined} onClick={() => { void onCheck() }}>
          {busy === 'check' ? t('checking') : t('check')}
        </button>
        <button
          type="button"
          className={css.danger}
          disabled={busy !== undefined || (check !== undefined && check.ok && !check.hasUpdate)}
          onClick={() => { void onUpdate() }}
        >
          {busy === 'update' ? t('updating') : t('update')}
        </button>
      </div>

      {update !== undefined && update.ok && update.log.trim() !== '' && (
        <details className={css.log}>
          <summary>{t('logTitle')}</summary>
          <pre>{update.log}</pre>
        </details>
      )}
    </section>
  )
}
