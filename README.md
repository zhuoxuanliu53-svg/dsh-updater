# dsh-updater

一个很小的 DSH Web GUI 插件：在「设置」里放一张小卡片，点击「检查更新」查看官方
`deepseek-ai/deepseek-harness` 是否有更新，点击「更新」把本地源码克隆快进到官方最新。
DSH 本身**不会被自动重启**——更新后只提示用户重启生效。

dsh-updater 是**热插拔**的：通过 profile 装配，不改任何 dsh 源码。

## 它能做什么

- **检查更新**：对本地 git 源码克隆（默认 `D:\DSH\deepseek-harness`，其 `origin` 即官方
  `https://github.com/deepseek-ai/deepseek-harness`）执行 `git fetch`，对比本地 `HEAD` 与
  官方 `origin/master`，显示 当前提交 / 官方最新 / 落后 N 个提交。
- **更新**：执行 `git merge --ff-only origin/master` 拉取官方最新并显示日志。
- **离线/不可达**：连不上远程（网络不可达、SSL/凭据失败、超时）时明确提示
  「无法检查更新（网络不可达）」，绝不假装「已是最新」。
- **更新后自动重编译**（可选小开关，默认关）：拉取后再跑 `pnpm install` 与
  `pnpm run build`，完成后仍只是提示需要重启。
- **只提示、不自动重启**：更新/重编译完成后仅提示「请重启 DSH 后生效」。

## 安装（接线到 `web` profile）

> ⚠️ 完整打进运行中的 Web GUI 需要联网（装/重建依赖）与 web 产物重编译。
> 当前机器网络受限时，插件仍可用，只是「检查更新」会进入**离线/不可达**分支。

三种方式任选其一：

1. **脚本自动接线**（本机 Windows）：在插件目录运行
   ```powershell
   ./scripts/install-profile.ps1
   ```
   该脚本会：把构建产物以 junction 链接到 `~/.dsh/profiles/web/node_modules/dsh-updater`，
   并在 profile 的 `package.json` 里加入依赖与 `dsh.profile.bundles` 条目，随后需要
   `dsh plugin install` / 重建 profile 并刷新 Web GUI 使 bundle 行生效。

2. **官方插件命令**（推荐，联网时）：
   ```sh
   dsh plugin --profile web add link:<本插件目录绝对路径>
   ```
   （等价于 DESKTOP-LAUNCHER 等插件族的安装口令。）

3. **手动**：编辑 `~/.dsh/profiles/web`
   - `package.json`：`dependencies` 加 `"dsh-updater": "link:<绝对路径>"`；
     `dsh.profile.bundles` 加 `"dsh-updater"`。
   - 把构建产物链接到 `node_modules/dsh-updater`（junction/符号链接）。

安装后，打开 Web GUI → 设置 → 滚动到「检查更新」分区即可看到卡片。

## 使用

1. 打开「设置 → 检查更新」。
2. 点「检查更新」：显示当前提交 vs 官方最新 + 落后数；有更新时「更新」按钮可点。
3. 点「更新」：快进到官方最新，显示日志。
4. 「更新后自动重编译」开关（默认关）：开启后更新会顺手 `pnpm install && pnpm run build`。
5. 完成后按提示重启 DSH 生效。

## 配置（设置卡片 / Host Config）

| 字段 | 默认 | 说明 |
|---|---|---|
| `repoPath` | `D:\DSH\deepseek-harness` | git 源码克隆的绝对路径 |
| `remote` | `origin` | 远程名（官方上游） |
| `branch` | `master` | 跟踪分支 |
| `fetchTimeoutMs` | 30000 | 检查时 git fetch 超时 |
| `gitTimeoutMs` | 60000 | 更新时 git merge 超时 |
| `rebuildTimeoutMs` | 600000 | 每个重编译命令超时 |
| `rebuildAfterUpdate` | false | 更新后是否自动重编译 |
| `sslBackend` | openssl | git TLS 后端：`openssl`（默认）或 `schannel`；Windows 上 schannel 凭据库不可用时必须用 `openssl` |

## 构建

```sh
# 离线编译（依赖本机 base/web profile 已装的 SDK 包，通过仓库内 node_modules junction 解析）
node "D:\DSH\deepseek-harness\node_modules\.bin\tsc.cmd" -p tsconfig.build.json   # 产出 lib/types/**/*.d.ts
node "D:\DSH\deepseek-harness\node_modules\.bin\tsdown.cmd"                       # 产出 lib/index.js + lib/client.js
```

产物：
- `lib/index.js`   —— Host 半边（Node ESM），跑 `git`/`pnpm` 并暴露 loopback 路由
- `lib/client.js`  —— 浏览器半边（CJS bundle，经 `window.__ModuleLoader__.load` 加载），设置卡片
- `lib/types/**`   —— 类型声明

## 架构

独立双面 npm 插件，模式与已安装的 `@linxin666/dsh-desktop-launcher` / `dsh-ssh` 完全一致：

- **Host**：`src/index.ts` 用 `installSettingsSection` 注册 `dsh-updater` 设置名字空间，
  经 `ctx.webServer` 挂载 `/api/dsh-updater/check`、`/api/dsh-updater/update` 与
  `/api/dsh-updater/config`（loopback-only）。`src/api.ts` 做 git 对比，`src/update.ts`
  做 ff 合并 + 可选重编译。
- **Client**：`src/client/index.ts` 用官方 `settings.section` 槽注册设置卡片
  （`src/client/UpdaterCard.tsx`），不依赖任何兄弟 UI 组。卡片两个可编辑字段
  （源码路径、重编译开关）走插件自己的 `/api/dsh-updater/config` 路由读写，
  因为 rc.6 的 `dsh-host-apiproxy` 对第三方设置名字空间一律返回
  `settings-not-exposed`，绑定 `ctx.settingsScope` 永远不会 ready。
- `mountOnce` 防重复挂载；`loopback.ts` 信任围栏防 LAN 暴露时被外部触发。

## 限制

- 更新对象必须是 git 克隆（`repoPath` 指向一个 git 仓库）；非仓库会提示 `not-a-repo`。
- 工作区有**已跟踪文件**的未提交改动 / 分叉时**不会自动 stash 或合并**，只提示先处理
  （`dirty` / `conflict`）。未跟踪的文件/目录（如临时目录）不拦截 —— 快进合并不会触碰它们。
- 重编译需要联网与完整工具链；失败不回滚已拉取的提交，只提示。
- 检查/更新路由仅限 loopback。
- 只提示，不自动重启。
