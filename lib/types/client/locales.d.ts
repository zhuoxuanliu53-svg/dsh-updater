/**
 * dsh-updater user-facing copy. Product copy is Chinese; English mirrors it.
 * Imported by the client plugin and registered under the 'dsh-updater'
 * locale namespace.
 */
/** Copy message keys for the dsh-updater settings card. */
export type UpdaterKey = 'nav' | 'repoPathLabel' | 'repoPathHint' | 'repoPathPlaceholder' | 'check' | 'checking' | 'update' | 'updating' | 'rebuildToggle' | 'rebuildHint' | 'notChecked' | 'current' | 'remote' | 'behind' | 'upToDate' | 'hasUpdate' | 'networkError' | 'notARepo' | 'dirty' | 'conflict' | 'gitError' | 'unknownError' | 'updatedHint' | 'updateNoChange' | 'rebuildDone' | 'rebuildSkipped' | 'logTitle' | 'configError';
/** A locale dictionary mapping every key to a string. */
export type UpdaterDict = Record<UpdaterKey, string>;
/** Chinese copy. */
export declare const zh: UpdaterDict;
/** English copy. */
export declare const en: UpdaterDict;
