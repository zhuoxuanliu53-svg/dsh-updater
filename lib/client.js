window.__ModuleLoader__.load({
	id: "dsh-updater",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
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
		//#region src/client/api.ts
		/**
		* Browser-side API client for /api/dsh-updater - plain same-origin fetch,
		* the only data path the settings card uses.
		*/
		/** Error carrying the route's message. */
		var UpdaterApiError = class extends Error {
			constructor(message) {
				super(message);
				this.name = "UpdaterApiError";
			}
		};
		/** Ask the host to check the git checkout against the official remote. */
		async function checkUpdate() {
			const response = await fetch(UPDATER_API.check, { method: "POST" });
			let body;
			try {
				body = await response.json();
			} catch {
				throw new UpdaterApiError(`HTTP ${response.status}: invalid JSON response`);
			}
			return body;
		}
		/** Ask the host to fast-forward the git checkout to the official remote. */
		async function applyUpdate() {
			const response = await fetch(UPDATER_API.update, { method: "POST" });
			let body;
			try {
				body = await response.json();
			} catch {
				throw new UpdaterApiError(`HTTP ${response.status}: invalid JSON response`);
			}
			return body;
		}
		/** Read the current config from the host. */
		async function getConfig() {
			const response = await fetch(UPDATER_API.config, { method: "GET" });
			const body = await parseJson(response);
			if (body === void 0 || !body.ok) throw new UpdaterApiError(body?.message ?? `HTTP ${response.status}`);
			return {
				repoPath: body.repoPath,
				rebuildAfterUpdate: body.rebuildAfterUpdate
			};
		}
		/** Persist one config patch and return the host-accepted view. */
		async function setConfig(patch) {
			const response = await fetch(UPDATER_API.config, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(patch)
			});
			const body = await parseJson(response);
			if (body === void 0 || !body.ok) throw new UpdaterApiError(body?.message ?? `HTTP ${response.status}`);
			return {
				repoPath: body.repoPath,
				rebuildAfterUpdate: body.rebuildAfterUpdate
			};
		}
		/** Parse one JSON body into a loose record, or throw a typed error. */
		async function parseJson(response) {
			try {
				return await response.json();
			} catch {
				throw new UpdaterApiError(`HTTP ${response.status}: invalid JSON response`);
			}
		}
		//#endregion
		//#region \0dsh-css:C:\Users\LiuJuan\Desktop\更新\dsh-updater\src\client\UpdaterCard.module.css.mjs
		const css = ".qsP8fW_card{flex-direction:column;gap:12px;padding:12px 0;display:flex}.qsP8fW_title{font-family:var(--dsw-font-s-strong-14-font-family);font-size:var(--dsw-font-s-strong-14-font-size);font-weight:var(--dsw-font-s-strong-14-font-weight);line-height:var(--dsw-font-s-strong-14-line-height);color:var(--dsw-alias-label-primary);margin:0}.qsP8fW_status{font-family:var(--dsw-font-s-14-font-family);font-size:var(--dsw-font-s-14-font-size);line-height:var(--dsw-font-s-14-line-height);color:var(--dsw-alias-label-secondary);margin:0}.qsP8fW_field{font-family:var(--dsw-font-s-14-font-family);font-size:var(--dsw-font-s-14-font-size);color:var(--dsw-alias-label-secondary);flex-direction:column;gap:4px;display:flex}.qsP8fW_input{width:100%;font-family:var(--dsw-font-markdown-code-font-family);font-size:var(--dsw-font-s-14-font-size);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:6px;padding:6px 8px}.qsP8fW_toggle{font-family:var(--dsw-font-s-14-font-family);font-size:var(--dsw-font-s-14-font-size);color:var(--dsw-alias-label-primary);flex-direction:column;gap:4px;display:flex}.qsP8fW_toggle input[type=checkbox]{align-self:flex-start}.qsP8fW_toggle small,.qsP8fW_field small{color:var(--dsw-alias-label-tertiary)}.qsP8fW_actions{align-items:center;gap:8px;display:flex}.qsP8fW_primary,.qsP8fW_danger{font-family:var(--dsw-font-s-14-font-family);font-size:var(--dsw-font-s-14-font-size);line-height:var(--dsw-font-s-14-line-height);cursor:pointer;border:1px solid #0000;border-radius:6px;padding:6px 14px}.qsP8fW_primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-inverted)}.qsP8fW_primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.qsP8fW_danger{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.qsP8fW_danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.qsP8fW_primary:disabled,.qsP8fW_danger:disabled{opacity:.5;cursor:not-allowed}.qsP8fW_log{margin-top:4px}.qsP8fW_log summary{cursor:pointer;font-family:var(--dsw-font-s-14-font-family);font-size:var(--dsw-font-s-14-font-size);color:var(--dsw-alias-label-secondary)}.qsP8fW_log pre{font-family:var(--dsw-font-markdown-code-font-family);font-size:var(--dsw-font-xxs-12-font-size);white-space:pre-wrap;word-break:break-all;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);border-radius:6px;max-height:240px;padding:8px;overflow:auto}";
		const tagId = "dsh-updater/UpdaterCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-updater";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var UpdaterCard_module_css_default = {
			"danger": "qsP8fW_danger",
			"card": "qsP8fW_card",
			"field": "qsP8fW_field",
			"primary": "qsP8fW_primary",
			"log": "qsP8fW_log",
			"title": "qsP8fW_title",
			"input": "qsP8fW_input",
			"toggle": "qsP8fW_toggle",
			"status": "qsP8fW_status",
			"actions": "qsP8fW_actions"
		};
		//#endregion
		//#region src/client/UpdaterCard.tsx
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
		/** Map a typed failure to localized copy. */
		function failureText(t, outcome) {
			switch (outcome.code) {
				case "network": return t("networkError");
				case "not-a-repo": return `${t("notARepo")}: ${outcome.message}`;
				case "dirty": return t("dirty");
				case "conflict": return t("conflict");
				case "git": return `${t("gitError")}: ${outcome.message}`;
				default: return t("unknownError");
			}
		}
		/**
		* Render the dsh-updater settings card.
		* @param props - locale copy and the runtime section props.
		* @returns the card.
		*/
		function UpdaterCard(props) {
			const { t } = props;
			const [config, setConfigState] = (0, react.useState)(void 0);
			const [configError, setConfigError] = (0, react.useState)(void 0);
			const [repoDraft, setRepoDraft] = (0, react.useState)(void 0);
			const [check, setCheck] = (0, react.useState)(void 0);
			const [update, setUpdate] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				let cancelled = false;
				getConfig().then((value) => {
					if (!cancelled) {
						setConfigState(value);
						setConfigError(void 0);
					}
				}, (error) => {
					if (!cancelled) setConfigError(error instanceof Error ? error.message : String(error));
				});
				return () => {
					cancelled = true;
				};
			}, []);
			const ready = config !== void 0;
			const repoPath = repoDraft ?? config?.repoPath ?? "";
			const rebuild = config?.rebuildAfterUpdate ?? false;
			const commitRepoPath = async () => {
				const draft = repoDraft?.trim();
				setRepoDraft(void 0);
				if (draft === void 0 || draft === "" || draft === config?.repoPath) return;
				const previous = config;
				setConfigState((value) => value ? {
					...value,
					repoPath: draft
				} : value);
				try {
					const accepted = await setConfig({ repoPath: draft });
					setConfigState((value) => value ? {
						...value,
						...accepted
					} : accepted);
					setConfigError(void 0);
				} catch (error) {
					setConfigState(previous);
					setConfigError(error instanceof Error ? error.message : String(error));
				}
			};
			const toggleRebuild = async (next) => {
				const previous = config;
				setConfigState((value) => value ? {
					...value,
					rebuildAfterUpdate: next
				} : value);
				try {
					const accepted = await setConfig({ rebuildAfterUpdate: next });
					setConfigState((value) => value ? {
						...value,
						...accepted
					} : accepted);
					setConfigError(void 0);
				} catch (error) {
					setConfigState(previous);
					setConfigError(error instanceof Error ? error.message : String(error));
				}
			};
			const onCheck = async () => {
				setBusy("check");
				setCheck(void 0);
				try {
					setCheck(await checkUpdate());
				} catch (error) {
					setCheck({
						ok: false,
						code: "unknown",
						message: error instanceof Error ? error.message : String(error)
					});
				} finally {
					setBusy(void 0);
				}
			};
			const onUpdate = async () => {
				setBusy("update");
				setUpdate(void 0);
				try {
					setUpdate(await applyUpdate());
				} catch (error) {
					setUpdate({
						ok: false,
						code: "unknown",
						message: error instanceof Error ? error.message : String(error)
					});
				} finally {
					setBusy(void 0);
				}
			};
			const status = () => {
				if (update !== void 0 && !update.ok) return failureText(t, update);
				if (check !== void 0 && !check.ok) return failureText(t, check);
				if (update !== void 0 && update.ok) {
					if (!update.applied) return t("updateNoChange");
					return `${t("updatedHint").replace("{sha}", update.after.slice(0, 7))}${update.rebuilt ? ` ${t("rebuildDone")}` : update.log.includes("-- rebuild --") ? ` ${t("rebuildSkipped")}` : ""}`;
				}
				if (check !== void 0 && check.ok) {
					if (check.hasUpdate) return `${t("hasUpdate")} · ${t("current")} ${check.currentShort} · ${t("remote")} ${check.remoteShort} · ${t("behind")} ${check.behind}`;
					return `${t("upToDate")} · ${t("current")} ${check.currentShort}`;
				}
				return t("notChecked");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: UpdaterCard_module_css_default.card,
				"aria-label": t("nav"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: UpdaterCard_module_css_default.title,
						children: t("nav")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: UpdaterCard_module_css_default.status,
						role: "status",
						children: status()
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: UpdaterCard_module_css_default.field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("repoPathLabel") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								className: UpdaterCard_module_css_default.input,
								value: repoPath,
								disabled: !ready || busy !== void 0,
								onBlur: () => {
									commitRepoPath();
								},
								onChange: (event) => setRepoDraft(event.target.value),
								placeholder: t("repoPathPlaceholder")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("repoPathHint") })
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: UpdaterCard_module_css_default.toggle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: rebuild,
								disabled: !ready || busy !== void 0,
								onChange: (event) => {
									toggleRebuild(event.target.checked);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("rebuildToggle") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("rebuildHint") })
						]
					}),
					configError !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: UpdaterCard_module_css_default.status,
						role: "alert",
						children: [
							t("configError"),
							": ",
							configError
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: UpdaterCard_module_css_default.actions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: UpdaterCard_module_css_default.primary,
							disabled: busy !== void 0,
							onClick: () => {
								onCheck();
							},
							children: busy === "check" ? t("checking") : t("check")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: UpdaterCard_module_css_default.danger,
							disabled: busy !== void 0 || check !== void 0 && check.ok && !check.hasUpdate,
							onClick: () => {
								onUpdate();
							},
							children: busy === "update" ? t("updating") : t("update")
						})]
					}),
					update !== void 0 && update.ok && update.log.trim() !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: UpdaterCard_module_css_default.log,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("logTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: update.log })]
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Chinese copy. */
		const zh = {
			nav: "检查更新",
			repoPathLabel: "源码路径",
			repoPathHint: "DeepSeek Harness 的 git 源码克隆路径（远程为官方 deepseek-ai/deepseek-harness）",
			repoPathPlaceholder: "请输入源码克隆的绝对路径",
			check: "检查更新",
			checking: "检查中…",
			update: "更新",
			updating: "更新中…",
			rebuildToggle: "更新后自动重编译",
			rebuildHint: "拉取后运行 pnpm install 与 pnpm run build（需要联网与完整工具链）",
			notChecked: "尚未检查",
			current: "当前提交",
			remote: "官方最新",
			behind: "落后",
			upToDate: "已是最新",
			hasUpdate: "有更新",
			networkError: "无法检查更新：网络不可达或无法连接远程仓库",
			notARepo: "路径不是有效的 Git 仓库",
			dirty: "工作区有未提交改动，请先提交或暂存后再更新",
			conflict: "无法快进合并（可能分叉），请人工运行 git pull --rebase",
			gitError: "Git 操作失败",
			unknownError: "发生未知错误",
			updatedHint: "已更新到 {sha}。此插件不会自动重启，请重启 DSH 后生效。",
			updateNoChange: "当前已是最新，无需更新",
			rebuildDone: "重新编译已完成",
			rebuildSkipped: "重新编译未执行或未成功",
			logTitle: "执行日志",
			configError: "配置读取或保存失败"
		};
		/** English copy. */
		const en = {
			nav: "Check updates",
			repoPathLabel: "Source path",
			repoPathHint: "Path to the DeepSeek Harness git checkout (remote is the official deepseek-ai/deepseek-harness)",
			repoPathPlaceholder: "Absolute path to your harness checkout",
			check: "Check update",
			checking: "Checking…",
			update: "Update",
			updating: "Updating…",
			rebuildToggle: "Rebuild after update",
			rebuildHint: "Run pnpm install and pnpm run build after pulling (needs network and a full toolchain)",
			notChecked: "Not checked yet",
			current: "Current commit",
			remote: "Official latest",
			behind: "behind",
			upToDate: "Up to date",
			hasUpdate: "Update available",
			networkError: "Cannot check: network unreachable or remote cannot be reached",
			notARepo: "Path is not a valid git repository",
			dirty: "Working tree has uncommitted changes; commit or stash before updating",
			conflict: "Cannot fast-forward merge (diverged history); run git pull --rebase manually",
			gitError: "Git operation failed",
			unknownError: "An unknown error occurred",
			updatedHint: "Updated to {sha}. This plugin does not auto-restart; please restart DSH to take effect.",
			updateNoChange: "Already up to date",
			rebuildDone: "Rebuild finished",
			rebuildSkipped: "Rebuild was not run or did not finish",
			logTitle: "Log",
			configError: "Failed to load or save settings"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "dsh-updater";
		/** Services required by this plugin. */
		const inject = ["slots", "locale"];
		/**
		* Register the dsh-updater settings section card.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-updater: dictionaries");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-updater",
				order: 900,
				label: () => ctx.locale.bind(NS)("nav"),
				locale: NS
			}, UpdaterCard));
		}
		//#endregion
		exports.UpdaterCard = UpdaterCard;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map