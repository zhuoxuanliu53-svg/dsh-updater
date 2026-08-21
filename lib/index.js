import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "schemastery";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
//#region src/git.ts
/**
* Thin wrapper over child_process.execFile for running git (and optionally
* pnpm) against a fixed repository without ever changing the process cwd.
*/
const execFileAsync = promisify(execFile);
/** Spawn `file args` with a timeout cap, silently capturing output. */
async function run(file, args, timeoutMs) {
	try {
		const { stdout, stderr } = await execFileAsync(file, [...args], {
			timeout: timeoutMs,
			windowsHide: true,
			maxBuffer: 8 * 1024 * 1024
		});
		return {
			code: 0,
			stdout,
			stderr
		};
	} catch (error) {
		const err = error;
		return {
			code: typeof err.code === "number" ? err.code : null,
			stdout: typeof err.stdout === "string" ? err.stdout : "",
			stderr: typeof err.stderr === "string" ? err.stderr : error instanceof Error ? error.message : String(error)
		};
	}
}
/** The default runner: child_process.execFile. */
const defaultRun = run;
/**
* Build the argv for one `git` invocation inside `repoPath`, with the TLS
* backend pinned when `sslBackend` is set. Windows machines whose schannel
* credential store is unavailable (SEC_E_NO_CREDENTIALS) need the OpenSSL
* backend; `-c http.sslBackend=openssl` fixes that without a persistent
* config edit.
*/
function gitArgs(repoPath, sslBackend, args) {
	const argv = ["-C", repoPath];
	if (sslBackend !== void 0 && sslBackend !== "") argv.push("-c", `http.sslBackend=${sslBackend}`);
	argv.push(...args);
	return argv;
}
//#endregion
//#region src/api.ts
/** True when an error message looks like a network / credential failure. */
function isNetworkish(message) {
	const lower = message.toLowerCase();
	return /(unable to access|could not resolve host|operation timed out|network is unreachable|failed to connect|schannel|acquirecredentials|ssl|certificate|refused|econnrefused|timeout|no route to host)/.test(lower);
}
/** Shorten a full sha to the conventional 7 characters. */
function short(sha) {
	return sha.length <= 7 ? sha : sha.slice(0, 7);
}
/**
* Compare the local checkout to the official remote. Refreshes the remote
* tracking ref with `git fetch` first, then reports the drift.
* @returns a CheckOutcome: success with drift, or a typed failure.
*/
async function checkUpdate(opts) {
	const run = opts.run ?? defaultRun;
	const { repoPath, remote, branch, fetchTimeoutMs, sslBackend } = opts;
	const ref = `${remote}/${branch}`;
	const gitDir = await run("git", gitArgs(repoPath, sslBackend, ["rev-parse", "--git-dir"]), 1e4);
	if (gitDir.code !== 0) return {
		ok: false,
		code: "not-a-repo",
		message: `不是 Git 仓库或路径不存在: ${repoPath}`,
		detail: gitDir.stderr.trim()
	};
	const currentRaw = await run("git", gitArgs(repoPath, sslBackend, ["rev-parse", "HEAD"]), 1e4);
	if (currentRaw.code !== 0) return {
		ok: false,
		code: "git",
		message: "无法解析本地 HEAD",
		detail: currentRaw.stderr.trim()
	};
	const current = currentRaw.stdout.trim();
	const branchRaw = await run("git", gitArgs(repoPath, sslBackend, [
		"rev-parse",
		"--abbrev-ref",
		"HEAD"
	]), 1e4);
	const branchName = branchRaw.code === 0 ? branchRaw.stdout.trim() || "HEAD" : branch;
	const fetch = await run("git", gitArgs(repoPath, sslBackend, [
		"fetch",
		remote,
		branch
	]), fetchTimeoutMs);
	if (fetch.code !== 0) {
		const message = `无法从远程 ${remote} 获取更新（网络或凭据问题）`;
		return {
			ok: false,
			code: isNetworkish(fetch.stderr) ? "network" : "git",
			message,
			detail: fetch.stderr.trim()
		};
	}
	const remoteRaw = await run("git", gitArgs(repoPath, sslBackend, ["rev-parse", ref]), 1e4);
	if (remoteRaw.code !== 0) return {
		ok: false,
		code: "git",
		message: `远程引用 ${ref} 不存在`,
		detail: remoteRaw.stderr.trim()
	};
	const remoteSha = remoteRaw.stdout.trim();
	const behindRaw = await run("git", gitArgs(repoPath, sslBackend, [
		"rev-list",
		"--count",
		`${current}..${ref}`
	]), 1e4);
	const aheadRaw = await run("git", gitArgs(repoPath, sslBackend, [
		"rev-list",
		"--count",
		`${ref}..${current}`
	]), 1e4);
	const behind = behindRaw.code === 0 ? Number(behindRaw.stdout.trim() || "0") : 0;
	const ahead = aheadRaw.code === 0 ? Number(aheadRaw.stdout.trim() || "0") : 0;
	return {
		ok: true,
		repoPath,
		branch: branchName,
		current,
		currentShort: short(current),
		remote: remoteSha,
		remoteShort: short(remoteSha),
		behind,
		ahead,
		hasUpdate: behind > 0
	};
}
//#endregion
//#region src/update.ts
/** Capture a command and append to the running log; returns exit code. */
async function logRun(log, run, file, args, timeoutMs) {
	const result = await run(file, args, timeoutMs);
	log.push(`$ ${file} ${args.join(" ")}`);
	if (result.stdout.trim()) log.push(result.stdout.trim());
	if (result.stderr.trim()) log.push(result.stderr.trim());
	return result.code ?? -1;
}
/**
* Apply the official update. The local checkout must be clean enough for a
* fast-forward merge; a dirty working tree or a diverged history returns a
* typed failure instead of trying to stash/merge for the user.
* @returns an UpdateOutcome describing the result.
*/
async function applyUpdate(opts) {
	const run = opts.run ?? defaultRun;
	const { repoPath, remote, branch, sslBackend } = opts;
	const ref = `${remote}/${branch}`;
	const log = [];
	const beforeRaw = await run("git", gitArgs(repoPath, sslBackend, ["rev-parse", "HEAD"]), 1e4);
	if (beforeRaw.code !== 0) return {
		ok: false,
		code: "git",
		message: "无法解析本地 HEAD",
		detail: beforeRaw.stderr.trim()
	};
	const before = beforeRaw.stdout.trim();
	const status = await run("git", gitArgs(repoPath, sslBackend, ["status", "--porcelain"]), 1e4);
	if (status.code !== 0) return {
		ok: false,
		code: "git",
		message: "无法读取工作区状态",
		detail: status.stderr.trim()
	};
	if (status.stdout.trim() !== "") return {
		ok: false,
		code: "dirty",
		message: "工作区有未提交的改动，请先提交或暂存后再更新（插件不会自动 stash/丢弃）",
		detail: status.stdout.trim()
	};
	const refExists = await run("git", gitArgs(repoPath, sslBackend, [
		"rev-parse",
		"--verify",
		`refs/remotes/${ref}`
	]), 1e4);
	if (refExists.code !== 0) return {
		ok: false,
		code: "git",
		message: `远程引用 ${ref} 不存在，请先「检查更新」`,
		detail: refExists.stderr.trim()
	};
	if (await logRun(log, run, "git", gitArgs(repoPath, sslBackend, [
		"merge",
		"--ff-only",
		ref
	]), opts.gitTimeoutMs) !== 0) return {
		ok: false,
		code: "conflict",
		message: "无法快进合并（可能是分叉或本地独有提交）。请人工运行 git pull --rebase 处理，插件不会自动合并。",
		detail: log.join("\n")
	};
	const afterRaw = await run("git", gitArgs(repoPath, sslBackend, ["rev-parse", "HEAD"]), 1e4);
	const after = afterRaw.code === 0 ? afterRaw.stdout.trim() : before;
	const applied = after !== before;
	let rebuilt = false;
	if (opts.rebuildAfterUpdate) {
		log.push("-- rebuild --");
		if (await logRun(log, run, "pnpm", ["install"], opts.rebuildTimeoutMs) === 0) {
			rebuilt = await logRun(log, run, "pnpm", ["run", "build"], opts.rebuildTimeoutMs) === 0;
			if (!rebuilt) log.push("rebuild: pnpm run build 未成功");
		} else log.push("rebuild: pnpm install 未成功");
	}
	return {
		ok: true,
		applied,
		before,
		after,
		rebuilt,
		log: log.join("\n")
	};
}
//#endregion
//#region src/loopback.ts
/** IPv4 127/8 predicate (four decimal octets, first == 127). */
function isIPv4Loopback(v4) {
	const parts = v4.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
function isLoopbackAddress(address) {
	if (address === void 0) return false;
	const normalized = address.toLowerCase();
	if (normalized === "::1") return true;
	if (normalized.startsWith("::ffff:")) return isIPv4Loopback(normalized.slice(7));
	return isIPv4Loopback(normalized);
}
/** Whether a normalized URL hostname names the loopback authority (localhost, [::1], 127/8). */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	return isIPv4Loopback(hostname);
}
/**
* Request-level trust fence: a loopback socket address AND a loopback Host
* header, plus browser same-origin markers. The socket address is
* authoritative; X-Forwarded-For is never trusted.
*/
function isLoopbackRequest(request) {
	if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL("http://" + host);
	} catch {
		return false;
	}
	if (!isLoopbackHostname(hostUrl.hostname)) return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/mount-once.ts
/**
* Host single-instance guard. If the same package were ever mounted twice
* (e.g. a standalone install plus a family bundle), the second apply would
* re-register the same webserver routes and settings namespace and fail the
* boot; mountOnce makes the second host apply a no-op for the lifetime of
* the first instance.
*
* The registry rides a global symbol so two module instances of the same
* package still share one verdict. cordis `ctx.effect` runs its callback
* immediately and treats the callback's return value as the fiber disposer,
* so the unmarker is returned, not run.
*/
const MOUNTED = Symbol.for("dsh-updater.mounted");
function mountedSet() {
	const registry = globalThis;
	return registry[MOUNTED] ??= /* @__PURE__ */ new Set();
}
/**
* Wrap a cordis plugin apply so the package runs at most once per process.
* @param packageName - npm package identity shared by every install source.
* @param fn - the original plugin apply.
* @returns an apply of the same shape.
*/
function mountOnce(packageName, fn) {
	return ((...args) => {
		const mounted = mountedSet();
		if (mounted.has(packageName)) return;
		mounted.add(packageName);
		args[0]?.effect?.(() => () => {
			mounted.delete(packageName);
		});
		return fn(...args);
	});
}
//#endregion
//#region src/protocol.ts
/**
* Wire contract between the host half (api.ts / update.ts) and the browser
* half (client/api.ts) - pure types plus one path constant, imported by both
* halves and bundled into each, with no runtime identity to share.
*/
/** Route family of the dsh-updater host API. */
const UPDATER_API = {
	/** Check the local git checkout against the official remote. */
	check: "/api/dsh-updater/check",
	/** Fast-forward the local git checkout to the official remote. */
	update: "/api/dsh-updater/update",
	/** Read (GET) and write (POST) the card's editable config fields. */
	config: "/api/dsh-updater/config"
};
//#endregion
//#region src/index.ts
/** Stable cordis plugin name. */
const name = "dsh-updater";
/** Services required before the routes can mount. */
const inject = ["webServer", "settings"];
/** Settings namespace of the dsh-updater capability. */
const UPDATER_SETTINGS_NAMESPACE = settingsNamespace("dsh-updater");
/** Default git checkout this plugin manages. */
const DEFAULT_REPO_PATH = "D:\\DSH\\deepseek-harness";
const DEFAULT_REMOTE = "origin";
const DEFAULT_BRANCH = "master";
const DEFAULT_FETCH_TIMEOUT_MS = 3e4;
const DEFAULT_GIT_TIMEOUT_MS = 6e4;
const DEFAULT_REBUILD_TIMEOUT_MS = 6e5;
const DEFAULT_SSL_BACKEND = "openssl";
/** Plugin config schema (also the settings namespace schema). */
const Config = z.object({
	repoPath: z.string().default(DEFAULT_REPO_PATH),
	remote: z.string().default(DEFAULT_REMOTE),
	branch: z.string().default(DEFAULT_BRANCH),
	fetchTimeoutMs: z.number().default(DEFAULT_FETCH_TIMEOUT_MS),
	gitTimeoutMs: z.number().default(DEFAULT_GIT_TIMEOUT_MS),
	rebuildTimeoutMs: z.number().default(DEFAULT_REBUILD_TIMEOUT_MS),
	rebuildAfterUpdate: z.boolean().default(false),
	sslBackend: z.string().default(DEFAULT_SSL_BACKEND)
});
/** Schema default for the rebuild toggle (off: pull only, then prompt to restart). */
const DEFAULT_REBUILD = false;
/** Render one JSON response. */
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(payload);
}
/** Read a small JSON request body, returning undefined when absent/unparseable. */
async function readJsonBody(req) {
	let text = "";
	for await (const chunk of req) text += typeof chunk === "string" ? chunk : chunk.toString("utf8");
	if (text.trim() === "") return void 0;
	try {
		return JSON.parse(text);
	} catch {
		return;
	}
}
/**
* Mount the two routes, gated on the composition entry config. Settings
* writes (from the card) re-point the source thunk and stay live.
* @param ctx - host plugin context carrying webServer/settings.
* @param config - resolved plugin config.
*/
const apply = mountOnce("dsh-updater", applyImpl);
function applyImpl(ctx, config) {
	let current = () => config ?? {};
	let disposeRoutes;
	/** Persist a config patch into the host settings seam and answer the resolved view. */
	const writeConfig = async (patch) => {
		await ctx.settings.update(UPDATER_SETTINGS_NAMESPACE, patch);
		const resolved = ctx.settings.get(UPDATER_SETTINGS_NAMESPACE);
		return {
			ok: true,
			repoPath: resolved?.repoPath ?? "D:\\DSH\\deepseek-harness",
			rebuildAfterUpdate: resolved?.rebuildAfterUpdate ?? false
		};
	};
	/** (Re)register the route family to match the current source. */
	const sync = () => {
		if (disposeRoutes !== void 0) {
			disposeRoutes();
			disposeRoutes = void 0;
		}
		const value = current() ?? {};
		disposeRoutes = ctx.effect(() => {
			const disposers = makeRoutes({
				repoPath: value.repoPath ?? "D:\\DSH\\deepseek-harness",
				remote: value.remote ?? "origin",
				branch: value.branch ?? "master",
				fetchTimeoutMs: value.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
				gitTimeoutMs: value.gitTimeoutMs ?? DEFAULT_GIT_TIMEOUT_MS,
				rebuildTimeoutMs: value.rebuildTimeoutMs ?? DEFAULT_REBUILD_TIMEOUT_MS,
				rebuildAfterUpdate: value.rebuildAfterUpdate ?? false,
				sslBackend: value.sslBackend ?? DEFAULT_SSL_BACKEND
			}, writeConfig).map((route) => ctx.webServer.register(route));
			return () => {
				for (const dispose of disposers) dispose();
			};
		}, "dsh-updater: routes");
	};
	installSettingsSection(ctx, UPDATER_SETTINGS_NAMESPACE, Config, config ?? {}, {
		setSource: (source) => {
			current = source;
			sync();
		},
		onChange: sync
	});
	sync();
}
/** Build the /api/dsh-updater route family. */
function makeRoutes(cfg, writeConfig) {
	return [
		{
			kind: "exact",
			path: UPDATER_API.check,
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) {
					writeJson(res, 403, {
						ok: false,
						code: "forbidden",
						message: "forbidden: loopback-only"
					});
					return;
				}
				if ((req.method ?? "GET") !== "POST" && req.method !== "GET") {
					writeJson(res, 405, {
						ok: false,
						code: "git",
						message: `method not allowed: ${req.method}`
					});
					return;
				}
				try {
					writeJson(res, 200, await checkUpdate({
						repoPath: cfg.repoPath,
						remote: cfg.remote,
						branch: cfg.branch,
						fetchTimeoutMs: cfg.fetchTimeoutMs,
						sslBackend: cfg.sslBackend
					}));
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "unknown",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: UPDATER_API.update,
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) {
					writeJson(res, 403, {
						ok: false,
						code: "forbidden",
						message: "forbidden: loopback-only"
					});
					return;
				}
				if (req.method !== "POST") {
					writeJson(res, 405, {
						ok: false,
						code: "git",
						message: `method not allowed: ${req.method}`
					});
					return;
				}
				try {
					writeJson(res, 200, await applyUpdate({
						repoPath: cfg.repoPath,
						remote: cfg.remote,
						branch: cfg.branch,
						gitTimeoutMs: cfg.gitTimeoutMs,
						rebuildTimeoutMs: cfg.rebuildTimeoutMs,
						rebuildAfterUpdate: cfg.rebuildAfterUpdate,
						sslBackend: cfg.sslBackend
					}));
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "unknown",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			}
		},
		{
			kind: "exact",
			path: UPDATER_API.config,
			handler: async (req, res) => {
				if (!isLoopbackRequest(req)) {
					writeJson(res, 403, {
						ok: false,
						code: "forbidden",
						message: "forbidden: loopback-only"
					});
					return;
				}
				if (req.method === "GET") {
					writeJson(res, 200, {
						ok: true,
						repoPath: cfg.repoPath,
						rebuildAfterUpdate: cfg.rebuildAfterUpdate
					});
					return;
				}
				if (req.method !== "POST") {
					writeJson(res, 405, {
						ok: false,
						code: "git",
						message: `method not allowed: ${req.method}`
					});
					return;
				}
				try {
					const raw = await readJsonBody(req);
					const patch = {};
					if (typeof raw === "object" && raw !== null) {
						const record = raw;
						if (typeof record.repoPath === "string") patch.repoPath = record.repoPath;
						if (typeof record.rebuildAfterUpdate === "boolean") patch.rebuildAfterUpdate = record.rebuildAfterUpdate;
					}
					if (patch.repoPath === void 0 && patch.rebuildAfterUpdate === void 0) {
						writeJson(res, 400, {
							ok: false,
							code: "git",
							message: "no config fields to write"
						});
						return;
					}
					writeJson(res, 200, await writeConfig(patch));
				} catch (error) {
					writeJson(res, 200, {
						ok: false,
						code: "unknown",
						message: error instanceof Error ? error.message : String(error)
					});
				}
			}
		}
	];
}
//#endregion
export { Config, DEFAULT_BRANCH, DEFAULT_REBUILD, DEFAULT_REMOTE, DEFAULT_REPO_PATH, UPDATER_API, UPDATER_SETTINGS_NAMESPACE, apply, applyUpdate, checkUpdate, inject, makeRoutes, name };
