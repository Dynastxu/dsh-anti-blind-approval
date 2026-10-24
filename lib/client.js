window.__ModuleLoader__.load({
	id: "@dynastxu/dsh-anti-blind-approval",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		// src/contract.ts
		/**
		* Route paths owned by this package. Both halves need them, and the browser
		* half must not import a Host module to read one string.
		* @module dsh-anti-blind-approval/contract
		*/
		/** Route prefix owned by this package. */
		const ROUTE_BASE = "/api/anti-blind-approval";
		// src/client/http.ts
		/**
		* Requests to the plugin's own Host routes. They ride the authenticated `/api`
		* carrier, so the browser's same-origin cookies are the whole credential story.
		* @module dsh-anti-blind-approval/client/http
		*/
		/** One failed request, carrying the HTTP status the caller may act on. */
		var HttpError = class extends Error {
			/** Response status; `404` means the Host half is not composed. */
			status;
			/**
			* @param status - response status.
			*/
			constructor(status) {
				super(`HTTP_${String(status)}`);
				this.name = "HttpError";
				this.status = status;
			}
		};
		/**
		* Post a JSON body and parse the JSON answer.
		* @param url - route path below the current origin.
		* @param body - request body.
		* @param signal - cancellation for this request.
		* @returns the parsed response body.
		* @throws {HttpError} when the response status is not OK.
		*/
		async function postJson(url, body, signal) {
			const response = await fetch(url, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				...signal === void 0 ? {} : { signal }
			});
			if (!response.ok) throw new HttpError(response.status);
			return await response.json();
		}
		/**
		* Fetch a JSON document.
		* @param url - route path below the current origin.
		* @returns the parsed response body.
		* @throws {HttpError} when the response status is not OK.
		*/
		async function getJson(url) {
			const response = await fetch(url, {
				method: "GET",
				credentials: "same-origin",
				headers: { accept: "application/json" }
			});
			if (!response.ok) throw new HttpError(response.status);
			return await response.json();
		}
		// src/client/locales.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "anti-blind-approval";
		/** Simplified Chinese dictionary and key-set source of truth. */
		const zh = {
			nav: "反盲批",
			title: "反盲批",
			intro: "会话处于「工作区内修改」时，先把提权申请交给模型审核：审核期间「允许」不可点；判为不安全时再锁定一段时间。最终决定权仍在人。",
			enabled: "启用 AI 审核",
			enabledHint: "关闭后恢复原生审批面板",
			model: "审核模型",
			modelHint: "留空使用当前会话模型",
			modelCurrent: "当前会话模型（默认）",
			delay: "不安全时锁定时长（秒）",
			delayHint: "0 表示审核结果不锁定按钮",
			reviewTimeout: "审核超时时间（毫秒）",
			reviewTimeoutHint: "单次审核的最大耗时，超时则判定为失败；范围 5000–300000",
			prompt: "审核提示词",
			promptHint: "留空使用内置英文提示词；可用 {language} 占位符，运行时替换为界面语言（如 Chinese (zh)）；JSON 输出格式由插件固定追加",
			promptReset: "恢复默认",
			promptDefault: "内置默认提示词",
			test: "测试审核",
			testing: "审核中…",
			testOk: "模型可用",
			testFail: "测试失败",
			saved: "已保存",
			saveFailed: "保存失败：当前组合可能不接受配置写入（例如以 --patch 覆盖层启动）",
			catalogFail: "无法读取模型列表，将使用当前会话模型。",
			configUnavailable: "当前组合没有提供可编辑的插件配置（例如以 --patch 覆盖层启动），设置页为只读。",
			configReadonly: "当前 profile 不接受配置写入，设置页为只读。",
			storageHint: "设置保存在当前 profile 的 DSH 配置（cordis.patch.yml）中，写入后立即生效，所有浏览器共享。",
			waiting: "等待审批",
			checking: "正在确认审批范围",
			reviewing: "AI 审核中…",
			safe: "AI 审核通过",
			unsafe: "AI 审核未通过",
			error: "AI 审核不可用",
			escalation: "工具 {toolName} 请求越权执行",
			detailAria: "审批详情",
			preview: "待审操作",
			allowOnce: "允许一次",
			reject: "拒绝",
			hold: "{seconds} 秒后可允许",
			verdictSafe: "模型判断此操作无明显安全风险，请确认后允许。",
			verdictUnsafe: "模型判断此操作存在安全风险：",
			verdictError: "审核未能完成，已按防误点策略短暂锁定：",
			"err.NO_SESSION": "找不到会话",
			"err.NO_MODEL": "没有可用的审核模型",
			"err.INVALID_OUTPUT": "模型返回格式不符合 JSON 约定",
			"err.TIMEOUT": "审核超时",
			"err.LLM_ERROR": "模型调用失败",
			"err.LLM_NO_FINISH": "模型没有正常结束",
			"err.REVIEW_FAILED": "审核失败",
			"err.BAD_REQUEST": "请求格式错误",
			"err.NETWORK": "网络或服务不可用",
			"err.ABORTED": "审核已取消"
		};
		/** English dictionary, checked against the Chinese key set. */
		const en = {
			nav: "Anti Blind Approval",
			title: "Anti Blind Approval",
			intro: "In a Workspace Write session, the escalation request is reviewed by a model before you decide: Allow stays disabled while the review runs, and for a while after an unsafe verdict. You still make the final call.",
			enabled: "Enable AI review",
			enabledHint: "Turn off to restore the stock approval panel",
			model: "Review model",
			modelHint: "Leave empty to use the current session model",
			modelCurrent: "Current session model (default)",
			delay: "Lock Allow for (seconds)",
			delayHint: "0 means the verdict never locks the buttons",
			reviewTimeout: "Review timeout (ms)",
			reviewTimeoutHint: "Maximum time per review before it fails; range 5000–300000",
			prompt: "Review prompt",
			promptHint: "Empty uses the built-in English prompt. {language} is replaced at runtime with the UI language (e.g. Chinese (zh)); the JSON output contract is appended by the plugin",
			promptReset: "Restore default",
			promptDefault: "Built-in default prompt",
			test: "Test review",
			testing: "Reviewing…",
			testOk: "Model is available",
			testFail: "Test failed",
			saved: "Saved",
			saveFailed: "Save failed: this composition may not accept configuration writes (for example when started from a --patch overlay)",
			catalogFail: "Could not load the model list; the current session model will be used.",
			configUnavailable: "This composition serves no editable plugin configuration (for example when started from a --patch overlay), so settings are read-only.",
			configReadonly: "The active profile does not accept configuration writes; settings are read-only.",
			storageHint: "Settings live in this profile's DSH configuration (cordis.patch.yml); they apply immediately and are shared by every browser.",
			waiting: "Waiting for approval",
			checking: "Checking approval scope",
			reviewing: "AI reviewing…",
			safe: "AI review passed",
			unsafe: "AI review failed",
			error: "AI review unavailable",
			escalation: "Tool {toolName} requests privileged execution",
			detailAria: "Approval details",
			preview: "Pending action",
			allowOnce: "Allow once",
			reject: "Reject",
			hold: "Allow in {seconds}s",
			verdictSafe: "The model found no obvious risk in this action. Confirm to allow.",
			verdictUnsafe: "The model flagged this action: ",
			verdictError: "The review did not finish; the anti-blind-click hold is active: ",
			"err.NO_SESSION": "Session not found",
			"err.NO_MODEL": "No review model is available",
			"err.INVALID_OUTPUT": "The model output did not match the JSON contract",
			"err.TIMEOUT": "The review timed out",
			"err.LLM_ERROR": "The model call failed",
			"err.LLM_NO_FINISH": "The model stream did not finish",
			"err.REVIEW_FAILED": "The review failed",
			"err.BAD_REQUEST": "Malformed request",
			"err.NETWORK": "Network or service unavailable",
			"err.ABORTED": "Review cancelled"
		};
		/** Dictionary key for each failure code a route can report. */
		const ERROR_KEYS = {
			BAD_REQUEST: "err.BAD_REQUEST",
			NO_SESSION: "err.NO_SESSION",
			NO_MODEL: "err.NO_MODEL",
			INVALID_OUTPUT: "err.INVALID_OUTPUT",
			TIMEOUT: "err.TIMEOUT",
			LLM_ERROR: "err.LLM_ERROR",
			LLM_NO_FINISH: "err.LLM_NO_FINISH",
			REVIEW_FAILED: "err.REVIEW_FAILED",
			ABORTED: "err.ABORTED",
			NETWORK: "err.NETWORK"
		};
		/**
		* Resolve the dictionary key of a reported failure code.
		* @param code - code from a response body, which is why an unknown value is possible.
		* @returns the matching key, or the generic failure key.
		*/
		function errorKey(code) {
			if (typeof code === "string" && Object.hasOwn(ERROR_KEYS, code)) return ERROR_KEYS[code];
			return ERROR_KEYS.REVIEW_FAILED;
		}
		// src/client/ApprovalPanel.tsx
		/**
		* The approval takeover: for a `workspace-write` session it probes the Host,
		* shows the pending action, asks for one JSON safety verdict, keeps Allow
		* disabled while the review runs, and — on an unsafe verdict or a failed review
		* — keeps it disabled for the configured cool-down.
		*
		* The human still decides. A failed review never allows by itself, and an
		* allowed review still needs a click.
		* @module dsh-anti-blind-approval/client/ApprovalPanel
		*/
		/** Poll interval of the cool-down label. */
		const TICK_MS = 200;
		/**
		* Render one pending approval, gated on the Host's review.
		* @param props - owner, locale, and registrant-injected shares.
		* @returns the approval card.
		*/
		function ApprovalPanel(props) {
			const { matched: pending, t, resolveReason, userLanguage: readUserLanguage, reviews, settings } = props;
			const [phase, setPhase] = (0, react.useState)("checking");
			const [preview, setPreview] = (0, react.useState)("");
			const [verdict, setVerdict] = (0, react.useState)(null);
			const [failure, setFailure] = (0, react.useState)({});
			const [answered, setAnswered] = (0, react.useState)(false);
			const [countdown, setCountdown] = (0, react.useState)({
				until: 0,
				left: 0
			});
			const waitingRef = (0, react.useRef)(false);
			const aliveRef = (0, react.useRef)(true);
			const reasonText = (() => {
				if (pending.displayReason !== void 0) try {
					const text = resolveReason(pending.displayReason);
					if (text !== "") return text;
				} catch {}
				if (pending.reason !== void 0 && pending.reason !== "") return pending.reason;
				return t("escalation", { toolName: pending.toolName });
			})();
			const beginHold = (0, react.useCallback)((seconds) => {
				if (!Number.isFinite(seconds) || seconds <= 0) {
					setCountdown({
						until: 0,
						left: 0
					});
					return;
				}
				setCountdown({
					until: Date.now() + seconds * 1e3,
					left: Math.ceil(seconds)
				});
			}, []);
			(0, react.useEffect)(() => {
				if (countdown.until === 0) return void 0;
				const timer = setInterval(() => {
					const left = Math.max(0, Math.ceil((countdown.until - Date.now()) / 1e3));
					setCountdown((previous) => previous.until !== countdown.until ? previous : {
						until: previous.until,
						left
					});
					if (left <= 0) clearInterval(timer);
				}, TICK_MS);
				return () => {
					clearInterval(timer);
				};
			}, [countdown.until]);
			(0, react.useEffect)(() => {
				aliveRef.current = true;
				return () => {
					aliveRef.current = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				const current = settings.snapshot().settings;
				if (!current.enabled) {
					setPhase("off");
					return;
				}
				const cacheKey = pending.callId === void 0 ? "" : `${pending.sessionId}\u0000${pending.callId}`;
				const cached = cacheKey === "" ? void 0 : reviews.lookup(cacheKey);
				if (cached !== void 0) {
					if (cached.preview !== "") setPreview(cached.preview);
					setVerdict({
						safe: cached.safe,
						reason: cached.reason,
						model: cached.model
					});
					if (cached.safe) setPhase("safe");
					else {
						setPhase("unsafe");
						beginHold(current.delaySeconds);
					}
					return;
				}
				const controller = new AbortController();
				let language = "";
				try {
					language = readUserLanguage();
				} catch {
					language = "";
				}
				const base = {
					sessionId: pending.sessionId,
					toolName: pending.toolName,
					...pending.callId === void 0 ? {} : { callId: pending.callId },
					...pending.reason === void 0 ? {} : { reason: pending.reason },
					...pending.displayReason === void 0 ? {} : { displayReason: pending.displayReason },
					userLanguage: language
				};
				const run = async () => {
					const action = await postJson(`${ROUTE_BASE}/action`, base, controller.signal);
					if (!aliveRef.current) return;
					if (action.active !== true) {
						setPhase("off");
						return;
					}
					if (typeof action.preview === "string") setPreview(action.preview);
					setPhase("reviewing");
					const result = await postJson(`${ROUTE_BASE}/review`, {
						...base,
						prompt: current.prompt,
						model: current.model
					}, controller.signal);
					if (!aliveRef.current) return;
					if (typeof result.errorCode === "string") {
						setFailure(result);
						setPhase("error");
						beginHold(current.delaySeconds);
						return;
					}
					if (typeof result.preview === "string" && result.preview !== "") setPreview(result.preview);
					const value = {
						safe: result.safe === true,
						reason: typeof result.reason === "string" ? result.reason : "",
						model: typeof result.model === "string" ? result.model : ""
					};
					setVerdict(value);
					if (cacheKey !== "") reviews.remember(cacheKey, {
						...value,
						preview: typeof result.preview === "string" ? result.preview : ""
					});
					if (value.safe) setPhase("safe");
					else {
						setPhase("unsafe");
						beginHold(current.delaySeconds);
					}
				};
				run().catch((error) => {
					if (!aliveRef.current || controller.signal.aborted) return;
					if (error instanceof HttpError && error.status === 404) {
						setPhase("off");
						return;
					}
					setFailure({
						errorCode: "NETWORK",
						detail: error instanceof Error ? error.message : String(error)
					});
					setPhase("error");
					beginHold(current.delaySeconds);
				});
				return () => {
					controller.abort();
				};
			}, [pending.key]);
			const reviewing = phase === "checking" || phase === "reviewing";
			const holdActive = (phase === "unsafe" || phase === "error") && countdown.left > 0;
			const allowEnabled = !answered && !reviewing && !holdActive;
			const answer = (outcome) => {
				if (waitingRef.current || pending.answerable === false) return;
				if (outcome === "allowed-once" && !allowEnabled) return;
				waitingRef.current = true;
				setAnswered(true);
				try {
					pending.answer(outcome).catch(() => {
						if (!aliveRef.current || pending.answerable === false) return;
						waitingRef.current = false;
						setAnswered(false);
					});
				} catch {
					waitingRef.current = false;
					setAnswered(false);
				}
			};
			const onKeyDown = (event) => {
				if (event.defaultPrevented) return;
				if (event.key !== "Enter" && event.key !== "Escape") return;
				const target = event.target instanceof HTMLElement ? event.target : null;
				if (!event.currentTarget.contains(document.activeElement)) return;
				if (target?.closest("input, textarea, select, [contenteditable=\"true\"], [contenteditable=\"\"]") != null) return;
				if (event.key === "Enter" && target?.closest("button, a[href], [role=\"button\"]") != null) return;
				if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
				event.preventDefault();
				event.stopPropagation();
				if (event.repeat || event.nativeEvent.isComposing || event.keyCode === 229) return;
				answer(event.key === "Enter" ? "allowed-once" : "rejected");
			};
			const strip = stripState(phase, t);
			const holdNote = holdActive ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "aiar-hold",
				"data-tone": holdTone(phase),
				role: "status",
				children: t("hold", { seconds: countdown.left })
			}) : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "aiar-root",
				"data-approval-key": pending.key,
				"data-phase": phase,
				"aria-busy": answered || reviewing ? "true" : "false",
				tabIndex: 0,
				onKeyDown,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "aiar-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "aiar-strip",
							"data-tone": strip.tone,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "aiar-dot",
								"data-pulse": reviewing ? "true" : void 0
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: strip.text })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "aiar-body",
							"data-approval-scroll": "",
							tabIndex: 0,
							role: "group",
							"aria-label": t("detailAria"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "aiar-headline",
									children: reasonText
								}),
								reviewBox(phase, verdict, failure, t),
								preview === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "aiar-command",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "aiar-reviewMeta",
										children: t("preview")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
										className: "aiar-pre",
										children: preview
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "aiar-actionRow",
							children: [
								holdNote,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: answered,
									onClick: () => {
										answer("rejected");
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "aiar-btnLabel",
										children: t("reject")
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									disabled: !allowEnabled,
									onClick: () => {
										answer("allowed-once");
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "aiar-btnLabel",
										children: [reviewing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "aiar-spinner",
											"aria-hidden": "true"
										}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("allowOnce") })]
									})
								})
							]
						})
					]
				})
			});
		}
		/** Tone of the cool-down label: an unsafe verdict is the error tone. */
		function holdTone(phase) {
			return phase === "unsafe" ? "bad" : void 0;
		}
		/** Strip text and tone for one phase. */
		function stripState(phase, t) {
			switch (phase) {
				case "checking": return {
					text: t("checking"),
					tone: "warn"
				};
				case "reviewing": return {
					text: t("reviewing"),
					tone: "warn"
				};
				case "safe": return {
					text: t("safe"),
					tone: "ok"
				};
				case "unsafe": return {
					text: t("unsafe"),
					tone: "bad"
				};
				case "error": return {
					text: t("error"),
					tone: "warn"
				};
				case "off": return {
					text: t("waiting"),
					tone: "warn"
				};
			}
		}
		/** Resolve one failure's localized label plus its diagnostic detail. */
		function errorText(t, failure) {
			const label = t(errorKey(failure.errorCode));
			const detail = typeof failure.detail === "string" ? failure.detail : "";
			return detail === "" ? label : `${label} (${detail})`;
		}
		/** The verdict block for the current phase, or nothing while the panel decides. */
		function reviewBox(phase, verdict, failure, t) {
			if (phase === "safe" && verdict !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "aiar-review",
				"data-tone": "ok",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "aiar-reviewTitle",
						children: t("verdictSafe")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "aiar-reviewBody",
						children: verdict.reason
					}),
					verdict.model === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "aiar-reviewMeta",
						children: verdict.model
					})
				]
			});
			if (phase === "unsafe" && verdict !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "aiar-review",
				"data-tone": "bad",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "aiar-reviewTitle",
						children: t("verdictUnsafe")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "aiar-reviewBody",
						children: verdict.reason
					}),
					verdict.model === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "aiar-reviewMeta",
						children: verdict.model
					})
				]
			});
			if (phase === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "aiar-review",
				"data-tone": "warn",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "aiar-reviewTitle",
					children: t("verdictError")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "aiar-reviewBody",
					children: errorText(t, failure)
				})]
			});
			return null;
		}
		// src/prompt.ts
		/** Default maximum milliseconds one review may take; overridable through plugin config. */
		const DEFAULT_REVIEW_TIMEOUT_MS$1 = 1e4;
		// src/settings-shared.ts
		/**
		* Reviewer preferences shared by both halves.
		*
		* The values themselves live in the active profile's DSH configuration: the
		* Host declares them as volatile `Config` fields, the settings service projects
		* them into a browser form, and the panel reads that form through
		* `ctx.configForms`. This module carries only the entry identity, the bounds,
		* and the normalization both faces agree on, so neither half imports the other.
		*
		* @module dsh-anti-blind-approval/settings-shared
		*/
		/**
		* Profile entry id. Also the settings namespace the browser form is requested
		* by, so a composition that renames the entry would have to change it here.
		*/
		const SETTINGS_NAMESPACE = "dsh-anti-blind-approval";
		/** Default review timeout in milliseconds. */
		const DEFAULT_REVIEW_TIMEOUT_MS = DEFAULT_REVIEW_TIMEOUT_MS$1;
		/** Shortest review timeout the schema and the settings page accept. */
		const MIN_REVIEW_TIMEOUT_MS = 5e3;
		/** Longest review timeout the schema and the settings page accept. */
		const MAX_REVIEW_TIMEOUT_MS = 3e5;
		/**
		* Read one raw preference section into its valid range.
		* @param raw - resolved config value, which may be absent or partial.
		* @returns complete preferences with a bounded cool-down.
		*/
		function normalizeSettings(raw) {
			const value = raw !== null && typeof raw === "object" ? raw : {};
			const stored = Number(value.delaySeconds);
			const delaySeconds = Number.isFinite(stored) ? Math.max(0, Math.min(30, Math.round(stored))) : 3;
			const storedTimeout = Number(value.reviewTimeoutMs);
			const reviewTimeoutMs = Number.isFinite(storedTimeout) ? Math.max(MIN_REVIEW_TIMEOUT_MS, Math.min(MAX_REVIEW_TIMEOUT_MS, Math.round(storedTimeout))) : DEFAULT_REVIEW_TIMEOUT_MS;
			return {
				enabled: value.enabled !== false,
				model: typeof value.model === "string" ? value.model : "",
				delaySeconds,
				prompt: typeof value.prompt === "string" ? value.prompt : "",
				reviewTimeoutMs
			};
		}
		// src/client/settings.ts
		/** One browser's handle on the profile's reviewer configuration. */
		var SettingsHandle = class {
			form;
			/**
			* @param form - shared form for this plugin's profile entry.
			*/
			constructor(form) {
				this.form = form;
			}
			/** @returns the current availability plus the effective preferences. */
			snapshot() {
				const raw = this.form.getSnapshot();
				const user = raw.user;
				const overridden = new Set(user !== null && typeof user === "object" && !Array.isArray(user) ? Object.keys(user) : []);
				return {
					status: raw.status,
					writable: raw.writable,
					settings: normalizeSettings(raw.value),
					overridden
				};
			}
			/**
			* Observe value and availability changes.
			* @param listener - invoked after each snapshot change.
			* @returns the disposer removing this listener.
			*/
			subscribe(listener) {
				return this.form.subscribe(listener);
			}
			/**
			* Queue one field write into the profile's configuration.
			* @param field - field to overwrite.
			* @param value - new value, as the JSON-shaped form expects it.
			* @returns whether the Host accepted the write.
			*/
			set(field, value) {
				return this.form.set(field, value);
			}
			/**
			* Clear one field so it inherits the composition default again.
			* @param field - field to clear.
			* @returns whether the Host accepted the clear.
			*/
			unset(field) {
				return this.form.unset(field);
			}
		};
		// src/client/SettingsSection.tsx
		/**
		* The plugin's settings page: the master switch, the reviewer model, the
		* cool-down, and the reviewer policy.
		*
		* The values are the Host entry's volatile `Config` fields projected through
		* `ctx.configForms`, so they are written into the active profile's DSH
		* configuration (and can also be supplied from `cordis.yml`) instead of living
		* in one browser. A profile that serves no writable form gets a read-only page.
		*
		* @module dsh-anti-blind-approval/client/SettingsSection
		*/
		/** How long the "saved" acknowledgement stays visible. */
		const SAVED_MS = 1600;
		/** Idle time before a prompt edit is written, so typing does not write per key. */
		const PROMPT_WRITE_MS = 600;
		/**
		* Render the anti-blind-approval settings page.
		* @param props - owner, locale, and registrant-injected shares.
		* @returns the settings page.
		*/
		function SettingsSection(props) {
			const { t, userLanguage, settings: handle } = props;
			const [state, setState] = (0, react.useState)(() => handle.snapshot());
			const settings = state.settings;
			const editable = state.status === "ready" && state.writable;
			const [catalog, setCatalog] = (0, react.useState)(null);
			const [catalogFailed, setCatalogFailed] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)(settings.prompt);
			const [saved, setSaved] = (0, react.useState)(false);
			const [saveFailed, setSaveFailed] = (0, react.useState)(false);
			const [test, setTest] = (0, react.useState)(null);
			const savedTimer = (0, react.useRef)(0);
			const promptTimer = (0, react.useRef)(0);
			const pendingPrompt = (0, react.useRef)(null);
			const lastStoredPrompt = (0, react.useRef)(settings.prompt);
			const alive = (0, react.useRef)(true);
			(0, react.useEffect)(() => handle.subscribe(() => {
				setState(handle.snapshot());
			}), [handle]);
			(0, react.useEffect)(() => {
				let live = true;
				getJson(`${ROUTE_BASE}/catalog`).then((data) => {
					if (!live) return;
					setCatalog(data);
					if (settings.prompt === "" && typeof data.defaultPrompt === "string") setDraft(data.defaultPrompt);
				}).catch(() => {
					if (live) setCatalogFailed(true);
				});
				return () => {
					live = false;
				};
			}, []);
			/** Show the saved or failed acknowledgement for the latest write. */
			const noteSaved = (ok) => {
				if (!alive.current) return;
				setSaved(ok);
				setSaveFailed(!ok);
				if (savedTimer.current !== 0) clearTimeout(savedTimer.current);
				savedTimer.current = window.setTimeout(() => {
					if (!alive.current) return;
					setSaved(false);
					savedTimer.current = 0;
				}, SAVED_MS);
			};
			/** Queue one configuration write and report its settlement. */
			const save = (field, value) => {
				if (alive.current) setSaveFailed(false);
				handle.set(field, value).then((ok) => {
					noteSaved(ok);
				}, () => {
					noteSaved(false);
				});
			};
			/** Queue one field clear (back to the inherited default). */
			const clear = (field) => {
				if (alive.current) setSaveFailed(false);
				handle.unset(field).then((ok) => {
					noteSaved(ok);
				}, () => {
					noteSaved(false);
				});
			};
			/** Write the pending prompt edit, if the debounce has not run yet. */
			const flushPrompt = () => {
				if (promptTimer.current !== 0) {
					clearTimeout(promptTimer.current);
					promptTimer.current = 0;
				}
				const value = pendingPrompt.current;
				pendingPrompt.current = null;
				if (value !== null) save("prompt", value);
			};
			/** Keep the draft local while the user types, then write it once. */
			const editPrompt = (value) => {
				setDraft(value);
				pendingPrompt.current = value;
				if (promptTimer.current !== 0) clearTimeout(promptTimer.current);
				promptTimer.current = window.setTimeout(flushPrompt, PROMPT_WRITE_MS);
			};
			(0, react.useEffect)(() => () => {
				alive.current = false;
				flushPrompt();
			}, []);
			(0, react.useEffect)(() => {
				if (settings.prompt === lastStoredPrompt.current) return;
				lastStoredPrompt.current = settings.prompt;
				if (pendingPrompt.current !== null || settings.prompt === "") return;
				setDraft(settings.prompt);
			}, [settings.prompt]);
			/** One failure's localized label plus its diagnostic detail. */
			const failureText = (data) => {
				const label = t(errorKey(data.errorCode));
				return typeof data.detail === "string" && data.detail !== "" ? `${label} (${data.detail})` : label;
			};
			const runTest = () => {
				setTest({
					status: "running",
					text: t("testing")
				});
				let language = "";
				try {
					language = userLanguage();
				} catch {
					language = "";
				}
				postJson(`${ROUTE_BASE}/test`, {
					prompt: draft,
					model: settings.model,
					userLanguage: language
				}).then((data) => {
					if (data.ok === true) {
						setTest({
							status: "ok",
							text: `${t("testOk")} · ${data.model ?? ""} · ${data.safe === true ? "safe=true" : "safe=false"}`
						});
						return;
					}
					setTest({
						status: "fail",
						text: `${t("testFail")} · ${failureText(data)}`
					});
				}).catch((error) => {
					setTest({
						status: "fail",
						text: `${t("testFail")} · ${error instanceof Error ? error.message : String(error)}`
					});
				});
			};
			const modelOptions = [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
				value: "",
				children: t("modelCurrent")
			}, "__current")];
			for (const provider of catalog?.providers ?? []) {
				if (provider.models.length === 0) continue;
				modelOptions.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
					label: provider.name,
					children: provider.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: `${provider.id}::${model.id}`,
						children: model.name
					}, `${provider.id}::${model.id}`))
				}, provider.id));
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "aiar-settings",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: "aiar-settingsTitle",
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "aiar-settingsIntro",
						children: t("intro")
					}),
					state.status === "unavailable" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "aiar-status",
						"data-tone": "warn",
						children: t("configUnavailable")
					}) : null,
					state.status === "ready" && !state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "aiar-status",
						"data-tone": "warn",
						children: t("configReadonly")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "aiar-panel",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "aiar-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "aiar-rowText",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "aiar-rowLabel",
										children: t("enabled")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "aiar-rowHint",
										children: t("enabledHint")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
									checked: settings.enabled,
									label: t("enabled"),
									disabled: !editable,
									onChange: (next) => {
										save("enabled", next);
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "aiar-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "aiar-rowText",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "aiar-rowLabel",
										children: t("model")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "aiar-rowHint",
										children: t("modelHint")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: "aiar-select",
									value: settings.model,
									"aria-label": t("model"),
									disabled: !editable,
									onChange: (event) => {
										save("model", event.currentTarget.value);
									},
									children: modelOptions
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "aiar-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "aiar-rowText",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "aiar-rowLabel",
										children: t("delay")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "aiar-rowHint",
										children: t("delayHint")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "aiar-number",
									type: "number",
									min: 0,
									max: 30,
									step: 1,
									value: settings.delaySeconds,
									"aria-label": t("delay"),
									disabled: !editable,
									onChange: (event) => {
										const value = Number(event.currentTarget.value);
										save("delaySeconds", Number.isFinite(value) ? Math.max(0, Math.min(30, Math.round(value))) : 0);
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "aiar-row",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "aiar-rowText",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "aiar-rowLabel",
										children: t("reviewTimeout")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "aiar-rowHint",
										children: t("reviewTimeoutHint")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "aiar-number",
									type: "number",
									min: MIN_REVIEW_TIMEOUT_MS,
									max: MAX_REVIEW_TIMEOUT_MS,
									step: 1e3,
									value: settings.reviewTimeoutMs,
									"aria-label": t("reviewTimeout"),
									disabled: !editable,
									onChange: (event) => {
										const value = Number(event.currentTarget.value);
										save("reviewTimeoutMs", Number.isFinite(value) ? Math.max(MIN_REVIEW_TIMEOUT_MS, Math.min(MAX_REVIEW_TIMEOUT_MS, Math.round(value))) : MIN_REVIEW_TIMEOUT_MS);
									}
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "aiar-panel",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "aiar-column",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "aiar-columnTitle",
									children: t("prompt")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: "aiar-textarea",
									value: draft,
									spellCheck: false,
									"aria-label": t("prompt"),
									placeholder: t("promptDefault"),
									disabled: !editable,
									onChange: (event) => {
										editPrompt(event.currentTarget.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "aiar-rowHint",
									children: t("promptHint")
								}),
								catalogFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "aiar-status",
									"data-tone": "warn",
									children: t("catalogFail")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "aiar-toolbar",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											disabled: !editable,
											onClick: () => {
												pendingPrompt.current = null;
												if (promptTimer.current !== 0) {
													clearTimeout(promptTimer.current);
													promptTimer.current = 0;
												}
												setDraft(catalog?.defaultPrompt ?? "");
												clear("prompt");
											},
											children: t("promptReset")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "primary",
											disabled: test !== null && test.status === "running",
											onClick: runTest,
											children: t("test")
										}),
										saved ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "aiar-status",
											"data-tone": "ok",
											children: t("saved")
										}) : null,
										saveFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "aiar-status",
											"data-tone": "warn",
											children: t("saveFailed")
										}) : null,
										test === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "aiar-status",
											"data-tone": testTone(test.status),
											children: test.text
										})
									]
								})
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "aiar-rowHint",
						children: t("storageHint")
					})
				]
			});
		}
		/** Tone of the connectivity-test label. */
		function testTone(status) {
			if (status === "ok") return "ok";
			if (status === "fail") return "bad";
		}
		// src/client/styles.ts
		/**
		* Stylesheet for both surfaces.
		*
		* The bundle ships no CSS file: this text is injected into one `<style>` tag by
		* the plugin's `apply`, and removed with the plugin. Every value is a shared
		* `--dsw-*` token, so both surfaces follow the active theme.
		* @module dsh-anti-blind-approval/client/styles
		*/
		/** Attribute marking the injected style tag as plugin-owned. */
		const STYLE_MARKER = "anti-blind-approval";
		/** Complete stylesheet text. */
		const CSS = [
			"@keyframes aiar-spin{to{transform:rotate(360deg)}}",
			".aiar-root{padding:8px calc(var(--dsh-composer-side-clearance) + 16px) 12px;flex-direction:column;align-items:center;display:flex}",
			".aiar-card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);border-radius:var(--dsw-radius-xl,var(--dsw-radius-lg));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1));box-shadow:var(--dsw-shadow-lv2);overflow:hidden}",
			".aiar-strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}",
			".aiar-strip[data-tone=\"ok\"]{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}",
			".aiar-strip[data-tone=\"bad\"]{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}",
			".aiar-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}",
			".aiar-dot[data-pulse=\"true\"]{animation:aiar-pulse 1.2s ease-in-out infinite}",
			"@keyframes aiar-pulse{0%,100%{opacity:.35}50%{opacity:1}}",
			".aiar-body{box-sizing:border-box;max-height:var(--dsh-composer-text-max-height,320px);flex-direction:column;gap:6px;padding:12px 16px 0;display:flex;overflow-y:auto}",
			".aiar-headline{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500;line-height:24px;overflow-wrap:anywhere}",
			".aiar-command{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);word-break:break-all;font-size:13px;line-height:20px}",
			".aiar-review{display:flex;flex-direction:column;gap:2px;font-size:13px;line-height:20px}",
			".aiar-reviewTitle{font-weight:500;color:var(--dsw-alias-label-primary)}",
			".aiar-review[data-tone=\"ok\"] .aiar-reviewTitle{color:var(--dsw-alias-state-success-primary)}",
			".aiar-review[data-tone=\"bad\"] .aiar-reviewTitle{color:var(--dsw-alias-state-error-primary)}",
			".aiar-review[data-tone=\"warn\"] .aiar-reviewTitle{color:var(--dsw-alias-state-warn-primary)}",
			".aiar-reviewBody{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere}",
			".aiar-reviewMeta{color:var(--dsw-alias-label-tertiary);font-size:12px}",
			".aiar-pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);max-height:180px;overflow:auto}",
			".aiar-actionRow{align-items:center;justify-content:flex-end;gap:8px;padding:14px 16px;display:flex}",
			".aiar-hold{margin-right:auto;color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:18px}",
			".aiar-hold[data-tone=\"bad\"]{color:var(--dsw-alias-state-error-primary)}",
			".aiar-spinner{width:12px;height:12px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:aiar-spin .8s linear infinite;display:inline-block;vertical-align:-2px;flex:none}",
			".aiar-btnLabel{align-items:center;gap:6px;display:inline-flex}",
			".aiar-settings{max-width:760px;flex-direction:column;gap:12px;display:flex;color:var(--dsw-alias-label-primary)}",
			".aiar-settingsTitle{margin:0;font-size:18px;font-weight:600}",
			".aiar-settingsIntro{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}",
			".aiar-panel{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);padding:0 14px;display:flex;flex-direction:column}",
			".aiar-row{display:flex;align-items:center;gap:16px;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1)}",
			".aiar-row:first-child{border-top:0}",
			".aiar-rowText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}",
			".aiar-rowLabel{font-size:14px;line-height:22px}",
			".aiar-rowHint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
			".aiar-column{display:flex;flex-direction:column;gap:6px;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1)}",
			".aiar-columnTitle{font-size:14px;line-height:22px}",
			".aiar-select,.aiar-number,.aiar-input{box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);padding:5px 8px;font:inherit;font-size:13px;line-height:20px}",
			".aiar-select{min-width:260px;max-width:100%}",
			".aiar-number{width:96px}",
			".aiar-textarea{box-sizing:border-box;width:100%;min-height:220px;resize:vertical;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);padding:8px 10px;font-family:var(--ds-font-family-code);font-size:12px;line-height:18px}",
			".aiar-textarea:focus,.aiar-select:focus,.aiar-number:focus{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}",
			".aiar-toolbar{display:flex;align-items:center;gap:8px;padding-top:10px}",
			".aiar-btn{font:inherit;font-size:13px;line-height:20px;padding:4px 12px;border-radius:var(--dsw-radius-md);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer}",
			".aiar-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
			".aiar-btn:disabled{opacity:.5;cursor:default}",
			".aiar-btn[data-variant=\"primary\"]{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground);border-color:transparent}",
			".aiar-status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
			".aiar-status[data-tone=\"ok\"]{color:var(--dsw-alias-state-success-primary)}",
			".aiar-status[data-tone=\"bad\"]{color:var(--dsw-alias-state-error-primary)}",
			".aiar-status[data-tone=\"warn\"]{color:var(--dsw-alias-state-warn-primary)}"
		].join("");
		// src/client/index.ts
		/** Required services: slot registry, dictionaries, and the settings form service. */
		const inject = [
			"slots",
			"locale",
			"configForms"
		];
		/** Verdicts one page keeps before it starts over. */
		const CACHE_LIMIT = 64;
		/**
		* Create the page's verdict cache.
		*
		* One handle per plugin instance, passed to the panel through its inject face,
		* so a remount reuses the verdict instead of paying for a second review.
		* @returns the cache handle the panel holds.
		*/
		function createReviewCache() {
			const entries = /* @__PURE__ */ new Map();
			return {
				lookup(key) {
					return entries.get(key);
				},
				remember(key, verdict) {
					if (entries.size >= CACHE_LIMIT) entries.clear();
					entries.set(key, verdict);
				}
			};
		}
		/**
		* Install the stylesheet, the dictionaries, and both surfaces.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				const style = document.createElement("style");
				style.dataset.plugin = STYLE_MARKER;
				style.textContent = CSS;
				document.head.appendChild(style);
				return () => {
					style.remove();
				};
			}, "anti-blind-approval: styles");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "anti-blind-approval: dictionaries");
			const t = ctx.locale.bind(NS);
			const reviews = createReviewCache();
			const settings = new SettingsHandle(ctx.configForms.get(SETTINGS_NAMESPACE));
			/**
			* The language the user reads this UI in. The reviewer writes its
			* one-sentence reason in that language, so a Chinese user keeps a Chinese
			* verdict while the policy prompt itself stays English.
			* @returns the active locale tag, the browser language, or `''`.
			*/
			const userLanguage = () => {
				const active = ctx.locale.getSnapshot().active;
				if (active !== "") return active;
				return typeof navigator === "undefined" ? "" : navigator.language;
			};
			ctx.slots.inject("conversation.composer", () => ctx.slots.register({
				name: "conversation.composer",
				priority: 0,
				select: (owner) => {
					const pending = owner.pendingInteraction;
					if (pending === void 0 || pending.kind !== "approval") return null;
					if (!settings.snapshot().settings.enabled) return null;
					return pending;
				},
				locale: NS,
				inject: () => ({
					resolveReason: (reason) => ctx.locale.resolveText(reason),
					userLanguage,
					reviews,
					settings
				})
			}, ApprovalPanel));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "anti-blind-approval",
				order: 90,
				label: () => t("nav"),
				locale: NS,
				inject: () => ({
					userLanguage,
					settings
				})
			}, SettingsSection));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map