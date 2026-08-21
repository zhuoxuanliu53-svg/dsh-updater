/**
 * dsh-updater user-facing copy. Product copy is Chinese; English mirrors it.
 * Imported by the client plugin and registered under the 'dsh-updater'
 * locale namespace.
 */

/** Copy message keys for the dsh-updater settings card. */
export type UpdaterKey =
  | 'nav'
  | 'repoPathLabel'
  | 'repoPathHint'
  | 'repoPathPlaceholder'
  | 'check'
  | 'checking'
  | 'update'
  | 'updating'
  | 'rebuildToggle'
  | 'rebuildHint'
  | 'notChecked'
  | 'current'
  | 'remote'
  | 'behind'
  | 'upToDate'
  | 'hasUpdate'
  | 'networkError'
  | 'notARepo'
  | 'dirty'
  | 'conflict'
  | 'gitError'
  | 'unknownError'
  | 'updatedHint'
  | 'updateNoChange'
  | 'rebuildDone'
  | 'rebuildSkipped'
  | 'logTitle'
  | 'configError'

/** A locale dictionary mapping every key to a string. */
export type UpdaterDict = Record<UpdaterKey, string>

/** Chinese copy. */
export const zh: UpdaterDict = {
  nav: '检查更新',
  repoPathLabel: '源码路径',
  repoPathHint: 'DeepSeek Harness 的 git 源码克隆路径（远程为官方 deepseek-ai/deepseek-harness）',
  repoPathPlaceholder: '请输入源码克隆的绝对路径',
  check: '检查更新',
  checking: '检查中…',
  update: '更新',
  updating: '更新中…',
  rebuildToggle: '更新后自动重编译',
  rebuildHint: '拉取后运行 pnpm install 与 pnpm run build（需要联网与完整工具链）',
  notChecked: '尚未检查',
  current: '当前提交',
  remote: '官方最新',
  behind: '落后',
  upToDate: '已是最新',
  hasUpdate: '有更新',
  networkError: '无法检查更新：网络不可达或无法连接远程仓库',
  notARepo: '路径不是有效的 Git 仓库',
  dirty: '工作区有未提交改动，请先提交或暂存后再更新',
  conflict: '无法快进合并（可能分叉），请人工运行 git pull --rebase',
  gitError: 'Git 操作失败',
  unknownError: '发生未知错误',
  updatedHint: '已更新到 {sha}。此插件不会自动重启，请重启 DSH 后生效。',
  updateNoChange: '当前已是最新，无需更新',
  rebuildDone: '重新编译已完成',
  rebuildSkipped: '重新编译未执行或未成功',
  logTitle: '执行日志',
  configError: '配置读取或保存失败',
}

/** English copy. */
export const en: UpdaterDict = {
  nav: 'Check updates',
  repoPathLabel: 'Source path',
  repoPathHint: 'Path to the DeepSeek Harness git checkout (remote is the official deepseek-ai/deepseek-harness)',
  repoPathPlaceholder: 'Absolute path to your harness checkout',
  check: 'Check update',
  checking: 'Checking…',
  update: 'Update',
  updating: 'Updating…',
  rebuildToggle: 'Rebuild after update',
  rebuildHint: 'Run pnpm install and pnpm run build after pulling (needs network and a full toolchain)',
  notChecked: 'Not checked yet',
  current: 'Current commit',
  remote: 'Official latest',
  behind: 'behind',
  upToDate: 'Up to date',
  hasUpdate: 'Update available',
  networkError: 'Cannot check: network unreachable or remote cannot be reached',
  notARepo: 'Path is not a valid git repository',
  dirty: 'Working tree has uncommitted changes; commit or stash before updating',
  conflict: 'Cannot fast-forward merge (diverged history); run git pull --rebase manually',
  gitError: 'Git operation failed',
  unknownError: 'An unknown error occurred',
  updatedHint: 'Updated to {sha}. This plugin does not auto-restart; please restart DSH to take effect.',
  updateNoChange: 'Already up to date',
  rebuildDone: 'Rebuild finished',
  rebuildSkipped: 'Rebuild was not run or did not finish',
  logTitle: 'Log',
  configError: 'Failed to load or save settings',
}
