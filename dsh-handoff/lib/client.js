window.__ModuleLoader__.load({ id: "dsh-handoff", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
// src/client/api.ts
/** Typed access to the plugin's small HTTP surface. */
const API = "/api/dsh-handoff";
/** Failure carrying the Host's stable error code, when the route supplied one. */
var HandoffRequestError = class extends Error {
	code;
	constructor(code, message) {
		super(message);
		this.name = "HandoffRequestError";
		this.code = code;
	}
};
/** Plain-language explanation for the codes the routes can return. */
const HINTS = {
	NO_ROUTE: "这个会话还没有模型回复，无法推断用哪个模型。先在插件配置里填写 provider / model，或先在会话里聊一轮。",
	NO_SESSION: "这个会话已经不在当前进程里了，换一个会话再试。",
	EMPTY_SESSION: "当前会话还没有任何消息，先聊一轮再生成。",
	EMPTY_DOCUMENT: "模型返回了空文档，重试一次通常就好。",
	TOOL_CALLS: "模型选择调用工具而不是写文档，重试一次即可。",
	ABORTED: "生成被取消了。",
	RATE_LIMIT: "模型服务限流了，等一会儿再试。",
	AUTH: "模型凭据无效，检查插件或账号配置。",
	BAD_ROUTE_CONFIG: "provider 与 model 必须同时填写，或都留空。",
	BROKEN_POINTER: "latest.md 指向的文件不存在，直接选一份历史文档。",
	BAD_NAME: "文件名不合法。",
	NO_DOCUMENT: "这个目录下还没有交接文档。",
	NO_AGENT: "这个会话当前没有活动实例。先给它发一条消息激活，再回来接续。",
	INTERNAL: "本地服务处理失败，稍后重试一次；仍然失败就重启 Harness。"
};
async function request(path, init) {
	let response;
	try {
		response = await fetch(path, {
			cache: "no-store",
			...init
		});
	} catch (error) {
		throw new HandoffRequestError("NETWORK", `无法连接本地服务：${String(error)}`);
	}
	let body;
	try {
		body = await response.json();
	} catch {
		throw new HandoffRequestError(`HTTP_${response.status}`, `本地服务返回了非 JSON 响应（HTTP ${response.status}）。`);
	}
	if (body.ok !== true) throw new HandoffRequestError(body.error?.code ?? `HTTP_${response.status}`, body.error?.message ?? `请求失败（HTTP ${response.status}）。`);
	return body.value;
}
/** Read a route's value. */
function apiGet(path) {
	return request(path);
}
/** Post a JSON body to a route. */
function apiPost(path, body) {
	return request(path, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body)
	});
}
/** Human-facing text for an error: the hint when we know the code, else the raw message. */
function describeError(error) {
	if (error instanceof HandoffRequestError) {
		const hint = HINTS[error.code];
		return hint === void 0 ? {
			text: error.message,
			code: error.code
		} : {
			text: hint,
			code: error.code
		};
	}
	return { text: error instanceof Error ? error.message : String(error) };
}
// src/client/styles.ts
const CSS = String.raw`
.dh-root{
  --dh-fg:var(--dsw-alias-label-primary,#1f2328);
  --dh-fg-2:var(--dsw-alias-label-secondary,#57606a);
  --dh-fg-3:var(--dsw-alias-label-tertiary,#8b949e);
  --dh-surface:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.055));
  --dh-surface-2:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.09));
  --dh-line:var(--dsw-alias-border-l1,rgba(127,127,127,.22));
  --dh-line-strong:var(--dsw-alias-border-l2,rgba(127,127,127,.34));
  --dh-hover:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1));
  --dh-brand:var(--dsw-alias-brand-primary,#4d6bfe);
  --dh-brand-soft:color-mix(in srgb,var(--dh-brand) 11%,transparent);
  --dh-danger:var(--dsw-alias-state-error-primary,#d33d3d);
  --dh-success:var(--dsw-alias-state-success-primary,#2c9c5a);
  --dh-radius:var(--dsw-radius-md,10px);
  --dh-mono:var(--dsw-font-markdown-code-font-family,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);
  display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;
  padding:22px 26px 18px;gap:13px;
  color:var(--dh-fg);
  font-family:var(--dsw-font-family,inherit);
  font-size:13px;line-height:1.55;
  -webkit-font-smoothing:antialiased;
}
.dh-root *,.dh-root *::before,.dh-root *::after{box-sizing:border-box}
.dh-root :focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,var(--dh-brand)));outline-offset:1px}
.dh-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* ── header ─────────────────────────────────────────────────────────── */
.dh-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
.dh-title{display:flex;align-items:center;gap:9px;font-size:17px;font-weight:600;letter-spacing:.005em;line-height:1.3}
.dh-title-mark{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:var(--dh-brand-soft);color:var(--dh-brand);flex:none}
.dh-sub{margin-top:4px;font-size:12px;color:var(--dh-fg-3);line-height:1.5}
.dh-session{display:flex;align-items:center;gap:7px;padding-top:2px}
.dh-label{font-size:11.5px;color:var(--dh-fg-3);white-space:nowrap}
.dh-selectwrap{position:relative;display:inline-flex;align-items:center;max-width:min(46vw,360px)}
.dh-select{appearance:none;-webkit-appearance:none;width:100%;padding:6px 26px 6px 10px;border:1px solid var(--dh-line-strong);border-radius:8px;background:var(--dh-surface);color:var(--dh-fg);font:inherit;font-size:12px;cursor:pointer;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}
.dh-select:hover{background:var(--dh-surface-2)}
.dh-select:disabled{opacity:.55;cursor:default}
.dh-select-icon{position:absolute;right:7px;pointer-events:none;color:var(--dh-fg-3)}

/* ── composer ───────────────────────────────────────────────────────── */
.dh-compose{display:flex;align-items:center;gap:8px;padding:7px 8px 7px 13px;border:1px solid var(--dh-line-strong);border-radius:12px;background:var(--dh-surface);transition:border-color .15s ease,box-shadow .15s ease}
.dh-compose:focus-within{border-color:color-mix(in srgb,var(--dh-brand) 55%,var(--dh-line));box-shadow:0 0 0 3px var(--dh-brand-soft)}
.dh-compose-icon{color:var(--dh-fg-3);flex:none;display:inline-flex}
.dh-compose-input{flex:1;min-width:0;border:0;background:transparent;color:inherit;font:inherit;font-size:13px;padding:5px 0;outline:none}
.dh-compose-input::placeholder{color:var(--dh-fg-3)}
.dh-compose-meta{font-size:10.5px;color:var(--dh-fg-3);white-space:nowrap;padding-right:2px}

/* ── buttons ────────────────────────────────────────────────────────── */
.dh-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 12px;border-radius:8px;border:1px solid transparent;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,color .15s ease}
.dh-btn:disabled{opacity:.5;cursor:default}
.dh-btn-primary{background:var(--dsw-alias-button-primary-fill,var(--dh-brand));color:var(--dsw-alias-label-primary-foreground,#fff)}
.dh-btn-primary:not(:disabled):hover{background:var(--dsw-alias-button-primary-hover,color-mix(in srgb,var(--dh-brand) 88%,#000))}
.dh-btn-ghost{background:transparent;border-color:var(--dh-line);color:var(--dh-fg-2)}
.dh-btn-ghost:not(:disabled):hover{background:var(--dh-hover);color:var(--dh-fg)}
.dh-btn-sm{height:26px;padding:0 9px;font-size:12px;border-radius:7px}
.dh-btn-accent{background:var(--dh-brand-soft);border-color:color-mix(in srgb,var(--dh-brand) 30%,transparent);color:var(--dh-brand)}
.dh-btn-accent:not(:disabled):hover{background:color-mix(in srgb,var(--dh-brand) 18%,transparent);border-color:color-mix(in srgb,var(--dh-brand) 44%,transparent)}
.dh-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dh-fg-3);cursor:pointer;flex:none;transition:background .15s ease,color .15s ease}
.dh-iconbtn:hover{background:var(--dh-hover);color:var(--dh-fg)}
.dh-iconbtn:disabled{opacity:.4;cursor:default;background:transparent}

/* ── notice ─────────────────────────────────────────────────────────── */
.dh-banner{display:flex;align-items:flex-start;gap:8px;padding:8px 11px;border-radius:9px;font-size:12px;line-height:1.5;border:1px solid transparent}
.dh-banner-info{background:var(--dh-brand-soft);color:var(--dh-fg-2)}
.dh-banner-ok{background:color-mix(in srgb,var(--dh-success) 12%,transparent);color:var(--dh-fg);border-color:color-mix(in srgb,var(--dh-success) 26%,transparent)}
.dh-banner-error{background:color-mix(in srgb,var(--dh-danger) 11%,transparent);color:var(--dh-fg);border-color:color-mix(in srgb,var(--dh-danger) 30%,transparent)}
.dh-banner-icon{flex:none;margin-top:1px}
.dh-banner-ok .dh-banner-icon{color:var(--dh-success)}
.dh-banner-error .dh-banner-icon{color:var(--dh-danger)}
.dh-banner-info .dh-banner-icon{color:var(--dh-brand)}
.dh-banner-text{flex:1;min-width:0;word-break:break-word}
.dh-banner-text code{font-family:var(--dh-mono);font-size:11.5px}

/* ── split body ─────────────────────────────────────────────────────── */
.dh-body{display:flex;gap:13px;flex:1;min-height:0}
.dh-list{width:288px;flex:0 0 288px;display:flex;flex-direction:column;min-height:0;border:1px solid var(--dh-line-strong);border-radius:12px;background:color-mix(in srgb,var(--dh-surface) 55%,transparent);overflow:hidden}
.dh-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px 4px 12px}
.dh-list-title{font-size:11.5px;font-weight:600;color:var(--dh-fg-2);letter-spacing:.02em}
.dh-count{font-weight:400;color:var(--dh-fg-3);font-variant-numeric:tabular-nums}
.dh-searchwrap{position:relative;display:flex;align-items:center;margin:4px 8px 8px}
.dh-search{width:100%;height:28px;padding:0 26px 0 27px;border:1px solid var(--dh-line-strong);border-radius:8px;background:var(--dh-surface);color:inherit;font:inherit;font-size:12px;outline:none}
.dh-search::placeholder{color:var(--dh-fg-3)}
.dh-search:focus{border-color:color-mix(in srgb,var(--dh-brand) 55%,var(--dh-line));box-shadow:0 0 0 3px var(--dh-brand-soft)}
.dh-search-icon{position:absolute;left:8px;color:var(--dh-fg-3);pointer-events:none}
.dh-search-clear{position:absolute;right:3px;width:22px;height:22px}
.dh-items{flex:1;min-height:0;overflow:auto;padding:0 6px 6px;display:flex;flex-direction:column;gap:1px;scrollbar-width:thin}
.dh-item{position:relative;display:flex;flex-direction:column;gap:3px;width:100%;padding:8px 9px 8px 11px;border:1px solid transparent;border-radius:9px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .12s ease}
.dh-item:hover{background:var(--dh-hover)}
.dh-item[data-active='true']{background:var(--dh-surface-2);border-color:var(--dh-line)}
.dh-item[data-active='true']::before{content:'';position:absolute;left:0;top:7px;bottom:7px;width:2px;border-radius:2px;background:var(--dh-brand)}
.dh-item-top{display:flex;align-items:center;gap:6px;min-width:0}
.dh-version{flex:none;font-family:var(--dh-mono);font-size:10px;line-height:15px;padding:0 5px;border:1px solid var(--dh-line);border-radius:5px;color:var(--dh-fg-3);font-variant-numeric:tabular-nums}
.dh-item-title{flex:1;min-width:0;font-size:12.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-badge-new{flex:none;font-size:9.5px;line-height:15px;padding:0 5px;border-radius:99px;background:var(--dh-brand-soft);color:var(--dh-brand);font-weight:500}
.dh-item-meta{font-size:10.5px;color:var(--dh-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}
.dh-list-foot{display:flex;align-items:center;gap:6px;padding:7px 11px;border-top:1px solid var(--dh-line);font-size:10.5px;color:var(--dh-fg-3);min-width:0}
.dh-dir{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--dh-mono);direction:rtl;text-align:left;opacity:.85}
.dh-skel{height:42px;margin:2px 0;border-radius:9px;background:linear-gradient(90deg,var(--dh-surface) 20%,var(--dh-surface-2) 38%,var(--dh-surface) 56%);background-size:300% 100%;animation:dh-shimmer 1.5s ease infinite}
@keyframes dh-shimmer{from{background-position:120% 0}to{background-position:-20% 0}}

/* ── document view ──────────────────────────────────────────────────── */
.dh-view{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;border:1px solid var(--dh-line-strong);border-radius:12px;background:var(--dh-surface);overflow:hidden}
.dh-view-head{display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;border-bottom:1px solid var(--dh-line);flex-wrap:wrap}
.dh-view-title{flex:1;min-width:110px;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-view-actions{display:flex;align-items:center;gap:2px}
.dh-chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;color:var(--dh-fg-3);border:1px solid var(--dh-line);border-radius:99px;padding:1px 7px;white-space:nowrap;font-variant-numeric:tabular-nums}
.dh-chip-brand{color:var(--dh-brand);border-color:color-mix(in srgb,var(--dh-brand) 32%,transparent);background:var(--dh-brand-soft)}
.dh-chips{display:flex;flex-wrap:wrap;gap:5px;padding:8px 14px 0}
.dh-article{flex:1;min-height:0;overflow:auto;padding:18px 24px 40px;scrollbar-width:thin}
.dh-doc{max-width:780px;margin:0;overflow-wrap:anywhere}
.dh-doc h1,.dh-doc h2,.dh-doc h3,.dh-doc h4{scroll-margin-top:12px}
.dh-doc h2{font-size:15.5px;font-weight:600;line-height:1.4;margin:26px 0 8px;padding-top:2px;letter-spacing:.005em}
.dh-doc h2:first-child{margin-top:2px}
.dh-doc h3{font-size:14px;font-weight:600;margin:19px 0 6px}
.dh-doc h4{font-size:13px;font-weight:600;margin:15px 0 5px;color:var(--dh-fg-2)}
.dh-doc p{margin:7px 0;font-size:13.5px;line-height:1.78}
.dh-doc strong{font-weight:600}
.dh-doc em{font-style:italic}
.dh-doc del{opacity:.6}
.dh-doc a{color:var(--dsw-alias-link,var(--dh-brand));text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--dh-brand) 35%,transparent)}
.dh-doc a:hover{border-bottom-color:var(--dh-brand)}
.dh-doc ul,.dh-doc ol{margin:7px 0;padding-left:21px;font-size:13.5px;line-height:1.72}
.dh-doc li{margin:3px 0}
.dh-doc li::marker{color:var(--dh-fg-3)}
.dh-tasklist{list-style:none;padding-left:2px}
.dh-task{display:flex;align-items:flex-start;gap:7px}
.dh-check{flex:none;width:14px;height:14px;margin-top:3px;border:1px solid var(--dh-line-strong);border-radius:4px;display:inline-flex;align-items:center;justify-content:center;color:transparent;background:transparent}
.dh-check[data-checked='true']{background:var(--dh-brand);border-color:var(--dh-brand);color:#fff}
.dh-inline-code{font-family:var(--dh-mono);font-size:11.5px;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-markdown-inline-code,var(--dh-surface-2));border:1px solid color-mix(in srgb,var(--dh-line) 60%,transparent);white-space:break-spaces}
.dh-code{position:relative;margin:10px 0;border:1px solid var(--dh-line);border-radius:9px;background:var(--dsw-alias-markdown-code-block,var(--dh-surface-2));overflow:hidden}
.dh-code-lang{position:absolute;top:8px;left:12px;padding:0;font-family:var(--dh-mono);font-size:10px;letter-spacing:.04em;text-transform:lowercase;color:var(--dh-fg-3);pointer-events:none}
.dh-code pre{margin:0;padding:12px 13px;overflow:auto;font-family:var(--dh-mono);font-size:11.5px;line-height:1.65;tab-size:2}
.dh-code-has-lang pre{padding-top:26px}
.dh-code-copy{position:absolute;top:5px;right:5px;opacity:0;transition:opacity .12s ease}
.dh-code:hover .dh-code-copy,.dh-code:focus-within .dh-code-copy{opacity:1}
.dh-quote{margin:10px 0;padding:2px 0 2px 12px;border-left:2px solid color-mix(in srgb,var(--dh-brand) 55%,var(--dh-line));color:var(--dh-fg-2)}
.dh-quote p{font-size:12.5px;margin:4px 0}
.dh-hr{border:0;border-top:1px solid var(--dh-line);margin:18px 0}
.dh-tablewrap{margin:10px 0;border:1px solid var(--dh-line-strong);border-radius:9px;overflow:auto}
.dh-doc table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.6}
.dh-doc th{background:var(--dh-surface-2);font-weight:600;text-align:left}
.dh-doc th,.dh-doc td{padding:6px 10px;border-bottom:1px solid var(--dh-line);vertical-align:top}
.dh-doc tr:last-child td{border-bottom:0}
.dh-opening{margin:14px 0;border:1px solid color-mix(in srgb,var(--dh-brand) 28%,transparent);border-radius:10px;background:var(--dh-brand-soft);padding:11px 13px}
.dh-opening-head{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:600;color:var(--dh-brand);margin-bottom:4px}
.dh-opening-head .dh-badge-new{background:color-mix(in srgb,var(--dh-brand) 16%,transparent)}
.dh-opening .dh-doc>*:first-child{margin-top:0}
.dh-raw{margin:0;padding:16px 20px;font-family:var(--dh-mono);font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}

/* ── attach confirmation layer ─────────────────────────────────────── */
.dh-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;background:var(--dsw-alias-bg-mask-1,color-mix(in srgb,var(--dh-fg) 42%,transparent));-webkit-backdrop-filter:blur(var(--dsw-mask-blur,0px));backdrop-filter:blur(var(--dsw-mask-blur,0px))}
.dh-dialog{width:min(440px,100%);max-height:calc(100vh - 40px);overflow:auto;display:flex;flex-direction:column;border:1px solid var(--dh-line);border-radius:var(--dsw-radius-panel,var(--dh-radius));background:var(--dsw-alias-bg-layer-2,var(--dh-surface));box-shadow:var(--dsw-elevation-prominent,0 18px 48px color-mix(in srgb,var(--dh-fg) 24%,transparent))}
.dh-dialog-head{display:flex;align-items:center;gap:8px;padding:14px 12px 10px 16px}
.dh-dialog-mark{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:var(--dh-brand-soft);color:var(--dh-brand);flex:none}
.dh-dialog-title{flex:1;min-width:0;font-size:14px;font-weight:600}
.dh-dialog-body{display:flex;flex-direction:column;gap:10px;padding:0 16px 4px}
.dh-dialog-lead{margin:0;font-size:12.5px;line-height:1.6;color:var(--dh-fg-2);overflow-wrap:anywhere}
.dh-dialog-field{display:flex;flex-direction:column;gap:5px}
.dh-dialog-selectwrap{width:100%;max-width:none}
.dh-dialog-hints{margin:0;padding-left:18px;font-size:11.5px;line-height:1.65;color:var(--dh-fg-3)}
.dh-dialog-hints li{margin:2px 0}
.dh-dialog-file{margin:0;font-family:var(--dh-mono);font-size:10.5px;color:var(--dh-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;opacity:.85}
.dh-dialog-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px 14px;margin-top:6px;border-top:1px solid var(--dh-line)}

/* ── empty states ───────────────────────────────────────────────────── */
.dh-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:28px;text-align:center;color:var(--dh-fg-3)}
.dh-empty-mark{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:12px;border:1px dashed var(--dh-line-strong);color:var(--dh-fg-3);margin-bottom:2px}
.dh-empty-title{font-size:12.5px;font-weight:500;color:var(--dh-fg-2)}
.dh-empty-text{margin:0;max-width:330px;font-size:11.5px;line-height:1.65}
.dh-empty .dh-btn{margin-top:6px}
.dh-skel-lines{width:100%;max-width:520px;display:flex;flex-direction:column;gap:8px;margin-top:6px}
.dh-skel-line{height:11px;border-radius:6px;background:var(--dh-surface-2)}
.dh-skel-line:nth-child(2){width:82%}
.dh-skel-line:nth-child(3){width:64%}

.dh-spin{animation:dh-spin .9s linear infinite}
@keyframes dh-spin{to{transform:rotate(360deg)}}

/* ── plugin card ────────────────────────────────────────────────────── */
.dh-card{height:auto;padding:0;gap:11px;max-width:820px;font-size:12.5px}
.dh-card-intro{margin:0;color:var(--dh-fg-2);line-height:1.7}
.dh-card-loading{color:var(--dh-fg-3);font-size:12px}
.dh-card-group{display:flex;flex-direction:column;border:1px solid var(--dh-line);border-radius:10px;overflow:hidden}
.dh-card-group-title{padding:7px 12px;background:var(--dh-surface-2);font-size:11px;font-weight:600;letter-spacing:.05em;color:var(--dh-fg-3)}
.dh-row{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;padding:9px 12px;border-top:1px solid var(--dh-line);align-items:start}
.dh-card-group-title + .dh-row{border-top:0}
.dh-row-label{display:flex;flex-direction:column;gap:1px;min-width:0}
.dh-row-name{color:var(--dh-fg);font-size:12.5px}
.dh-row-key{font-family:var(--dh-mono);font-size:10px;color:var(--dh-fg-3)}
.dh-row-hint{font-size:10.5px;color:var(--dh-fg-3);line-height:1.5}
.dh-row-value{justify-self:end;text-align:right;font-family:var(--dh-mono);font-size:11.5px;color:var(--dh-fg-2);word-break:break-all}
.dh-row-value[data-empty='true']{font-family:inherit;opacity:.6}
.dh-flag{justify-self:end;display:inline-flex;align-items:center;padding:0 7px;border-radius:99px;border:1px solid var(--dh-line);font-size:10.5px;color:var(--dh-fg-3)}
.dh-flag-on{border-color:color-mix(in srgb,var(--dh-success) 40%,transparent);background:color-mix(in srgb,var(--dh-success) 10%,transparent);color:var(--dh-success)}
.dh-card-note{display:flex;align-items:flex-start;gap:6px;margin:0;color:var(--dh-fg-3);font-size:11px;line-height:1.6}
.dh-card-note svg{margin-top:1px;flex:none}
@media (prefers-reduced-motion:reduce){
  .dh-skel,.dh-skel-line{animation:none}
  .dh-spin{animation:none;opacity:.6}
  .dh-root *{transition:none!important}
}
@media (max-width:920px){
  .dh-root{padding:16px 14px 12px;gap:11px}
  .dh-body{flex-direction:column}
  .dh-list{width:auto;flex:0 0 auto;max-height:238px}
  .dh-view{min-height:300px}
  .dh-selectwrap{max-width:min(70vw,320px)}
}
`;
// src/client/ui.ts
/** Inline glyphs for the panel: 16px grid, 1.4px stroke, `currentColor`. */
function draw(children, viewBox, defaultSize) {
	return (props) => (0, react.createElement)("svg", {
		width: props.size ?? defaultSize,
		height: props.size ?? defaultSize,
		viewBox,
		fill: "none",
		stroke: "currentColor",
		strokeWidth: props.strokeWidth ?? 1.4,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		className: props.className,
		"aria-hidden": true,
		focusable: false
	}, children);
}
const make = (children, defaultSize = 16) => draw(children, "0 0 16 16", defaultSize);
/** The sidebar row and the panel title share this mark: a page passed on. */
const IconHandoff = make([
	(0, react.createElement)("path", {
		key: "page",
		d: "M3.2 2.2h6.1L12.8 5.7v8.1H3.2z"
	}),
	(0, react.createElement)("path", {
		key: "fold",
		d: "M9.3 2.2v3.5h3.5"
	}),
	(0, react.createElement)("path", {
		key: "line1",
		d: "M5.4 8.2h4.2"
	}),
	(0, react.createElement)("path", {
		key: "line2",
		d: "M5.4 11.2h2.6"
	})
]);
const IconSearch = make([(0, react.createElement)("circle", {
	key: "c",
	cx: "7.2",
	cy: "7.2",
	r: "4.2"
}), (0, react.createElement)("path", {
	key: "l",
	d: "M10.4 10.4 13.4 13.4"
})]);
const IconRefresh = make([(0, react.createElement)("path", {
	key: "a",
	d: "M13 8a5 5 0 1 1-1.6-3.7"
}), (0, react.createElement)("path", {
	key: "b",
	d: "M13.2 2.6v3.1h-3.1"
})]);
const IconCopy = make([(0, react.createElement)("rect", {
	key: "a",
	x: "5.6",
	y: "5.6",
	width: "7.6",
	height: "7.6",
	rx: "1.4"
}), (0, react.createElement)("path", {
	key: "b",
	d: "M10.4 5.6V4.2a1.4 1.4 0 0 0-1.4-1.4H4.2a1.4 1.4 0 0 0-1.4 1.4v4.8a1.4 1.4 0 0 0 1.4 1.4h1.4"
})]);
const IconDownload = make([
	(0, react.createElement)("path", {
		key: "a",
		d: "M8 2.4v7.6"
	}),
	(0, react.createElement)("path", {
		key: "b",
		d: "M5 7.2 8 10.2l3-3"
	}),
	(0, react.createElement)("path", {
		key: "c",
		d: "M2.9 11.6v1.4a1 1 0 0 0 1 1h8.2a1 1 0 0 0 1-1v-1.4"
	})
]);
const IconCheck = make([(0, react.createElement)("path", {
	key: "a",
	d: "M3.2 8.4 6.4 11.6 12.8 4.6"
})]);
const IconClose = make([(0, react.createElement)("path", {
	key: "a",
	d: "M4 4 12 12"
}), (0, react.createElement)("path", {
	key: "b",
	d: "M12 4 4 12"
})]);
const IconAlert = make([
	(0, react.createElement)("path", {
		key: "a",
		d: "M8 2.6 14.2 13.4H1.8z"
	}),
	(0, react.createElement)("path", {
		key: "b",
		d: "M8 6.4v3.2"
	}),
	(0, react.createElement)("path", {
		key: "c",
		d: "M8 11.6v.4"
	})
]);
const IconInfo = make([
	(0, react.createElement)("circle", {
		key: "a",
		cx: "8",
		cy: "8",
		r: "5.8"
	}),
	(0, react.createElement)("path", {
		key: "b",
		d: "M8 7.2v3.4"
	}),
	(0, react.createElement)("path", {
		key: "c",
		d: "M8 5.1v.3"
	})
]);
const IconSparkle = make([(0, react.createElement)("path", {
	key: "a",
	d: "M6.4 2.2 7.4 5l2.8 1-2.8 1-1 2.8L5.4 7 2.6 6l2.8-1z"
}), (0, react.createElement)("path", {
	key: "b",
	d: "M11.6 8.6l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z"
})]);
const IconChevronDown = make([(0, react.createElement)("path", {
	key: "a",
	d: "M4.6 6.4 8 9.8l3.4-3.4"
})]);
const IconEye = make([(0, react.createElement)("path", {
	key: "a",
	d: "M1.6 8s2.4-4.2 6.4-4.2S14.4 8 14.4 8s-2.4 4.2-6.4 4.2S1.6 8 1.6 8z"
}), (0, react.createElement)("circle", {
	key: "b",
	cx: "8",
	cy: "8",
	r: "1.8"
})]);
const IconCode = make([(0, react.createElement)("path", {
	key: "a",
	d: "M5.8 5 2.8 8l3 3"
}), (0, react.createElement)("path", {
	key: "b",
	d: "M10.2 5l3 3-3 3"
})]);
const IconLoader = make([
	(0, react.createElement)("path", {
		key: "a",
		d: "M8 1.8v2.4"
	}),
	(0, react.createElement)("path", {
		key: "b",
		d: "M8 11.8v2.4"
	}),
	(0, react.createElement)("path", {
		key: "c",
		d: "M1.8 8h2.4"
	}),
	(0, react.createElement)("path", {
		key: "d",
		d: "M11.8 8h2.4"
	}),
	(0, react.createElement)("path", {
		key: "e",
		d: "M3.6 3.6 5.3 5.3"
	}),
	(0, react.createElement)("path", {
		key: "f",
		d: "M10.7 10.7l1.7 1.7"
	}),
	(0, react.createElement)("path", {
		key: "g",
		d: "M12.4 3.6 10.7 5.3"
	}),
	(0, react.createElement)("path", {
		key: "h",
		d: "M5.3 10.7l-1.7 1.7"
	})
]);
/** A tick for a checked task item; sized to sit inside the 14px box. */
const IconTaskCheck = make([(0, react.createElement)("path", {
	key: "a",
	d: "M2.6 6.2 4.4 8 7.4 4.4"
})], 10);
// src/client/card.ts
/**
* The bundle's card on the Host's Plugins page.
*
* It answers two questions a reader arrives with: what this plugin does, and
* which configuration this process actually loaded. Values are grouped by the
* decision they belong to instead of being dumped as one flat table.
*/
const GROUPS = [
	{
		title: "输出",
		rows: [
			{
				key: "outputDir",
				label: "输出目录",
				hint: "相对会话工作目录；也可以写绝对路径"
			},
			{
				key: "filenamePrefix",
				label: "文件名前缀",
				hint: "配合时间戳与标题生成文件名"
			},
			{
				key: "writeLatest",
				label: "维护 latest.md",
				hint: "写一个指向最新文档的指针，供 /handoff resume"
			}
		]
	},
	{
		title: "模型",
		rows: [
			{
				key: "provider",
				label: "服务商",
				hint: "留空则沿用会话里最后一条回复实际使用的模型"
			},
			{
				key: "model",
				label: "模型",
				hint: "与上面一项同时留空，或同时填写"
			},
			{
				key: "maxOutputTokens",
				label: "输出上限",
				hint: "生成文档时的最大 token 数"
			}
		]
	},
	{
		title: "记录",
		rows: [
			{
				key: "maxInputChars",
				label: "输入预算",
				hint: "会话记录超过预算时保留头尾、省略中段"
			},
			{
				key: "includeToolResults",
				label: "工具结果",
				hint: "把工具输出写进交给模型的记录"
			},
			{
				key: "includeInjectedContext",
				label: "注入上下文",
				hint: "把技能、工作区说明等注入内容写进记录"
			},
			{
				key: "includeReasoning",
				label: "思考过程",
				hint: "把模型的推理内容写进记录"
			}
		]
	},
	{
		title: "写作",
		rows: [{
			key: "language",
			label: "文档语言",
			hint: "auto 跟随对话语言，也可以固定 zh / en"
		}, {
			key: "extraInstructions",
			label: "追加要求",
			hint: "追加给撰写模型的额外指示"
		}]
	}
];
function valueNode(value) {
	if (typeof value === "boolean") return (0, react.createElement)("span", { className: value ? "dh-flag dh-flag-on" : "dh-flag" }, value ? "开" : "关");
	if (value === "" || value === void 0 || value === null) return (0, react.createElement)("span", {
		className: "dh-row-value",
		"data-empty": "true"
	}, "未设置");
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return (0, react.createElement)("span", {
		className: "dh-row-value",
		title: text
	}, text);
}
/** Card rendered inside the plugin page (`view: 'page'`) and the list (`summary`). */
function SettingsCard(props) {
	const view = props?.view;
	const [config, setConfig] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)("");
	(0, react.useEffect)(() => {
		let alive = true;
		apiGet(`${API}/config`).then((value) => {
			if (alive) setConfig(value.config);
		}).catch((cause) => {
			if (alive) setError(describeError(cause).text);
		});
		return () => {
			alive = false;
		};
	}, []);
	if (view === "summary") return (0, react.createElement)("div", null, "把当前会话整理成交接文档，写给下一个会话；生成 / 历史 / 预览都在侧边栏的「交接文档」页。");
	return (0, react.createElement)("div", { className: "dh-root dh-card" }, (0, react.createElement)("style", { key: "dh-style" }, CSS), (0, react.createElement)("p", { className: "dh-card-intro" }, "下面这些值来自 profile 的插件配置（", (0, react.createElement)("code", { className: "dh-inline-code" }, "cordis.patch.yml"), " 里的 dsh-handoff 条目），是这次运行实际加载的结果。改动配置后重新加载插件或重启 Harness 才会生效。"), error === "" ? null : (0, react.createElement)("div", { className: "dh-banner dh-banner-error" }, error), config === null && error === "" ? (0, react.createElement)("div", {
		className: "dh-card-loading",
		"aria-busy": true
	}, "正在读取配置…") : null, ...GROUPS.map((group) => (0, react.createElement)("section", {
		className: "dh-card-group",
		key: group.title
	}, (0, react.createElement)("div", { className: "dh-card-group-title" }, group.title), ...group.rows.map((row) => (0, react.createElement)("div", {
		className: "dh-row",
		key: row.key
	}, (0, react.createElement)("div", { className: "dh-row-label" }, (0, react.createElement)("span", { className: "dh-row-name" }, row.label), (0, react.createElement)("span", { className: "dh-row-key" }, row.key), (0, react.createElement)("span", { className: "dh-row-hint" }, row.hint)), valueNode(config?.[row.key]))))), (0, react.createElement)("p", { className: "dh-card-note" }, (0, react.createElement)(IconInfo, { size: 12 }), "侧边栏页里的「生成交接文档」使用同一份配置；关注点只影响这一次生成，不会写回配置。"), (0, react.createElement)("p", { className: "dh-card-note" }, (0, react.createElement)(IconCheck, { size: 12 }), "文档保存在会话工作目录的 .dsh/handoff/ 下，同时维护 latest.md 指针，新会话用 /handoff resume 接续。"));
}
// src/client/format.ts
/**
* Small presentation helpers for the handoff panel.
*
* Kept free of React and of the Host's modules so the panel renders the same
* under the web client, under `renderToStaticMarkup` in tests, and nowhere else.
*/
const MINUTE = 6e4;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** `3 KB`, `1.4 MB` — binary units, one decimal only when it helps. */
function fileSizeText(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb < 10 ? kb.toFixed(1).replace(/\.0$/u, "") : Math.round(kb)} KB`;
	return `${(kb / 1024).toFixed(1).replace(/\.0$/u, "")} MB`;
}
function pad(value) {
	return String(value).padStart(2, "0");
}
/** `2026-10-26 08:58` in the browser's own time zone. */
function dateTimeText(at) {
	const date = new Date(at);
	if (Number.isNaN(date.getTime())) return "";
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/**
* `刚刚` / `12 分钟前` / `昨天 08:58` / `10月26日 08:58` / `2025年10月26日`.
*
* A handoff is read minutes after it is written, so the near range is worth
* spelling out; anything older gets a date the reader can place.
*/
function relativeTime(at, now = Date.now()) {
	const delta = now - at;
	if (!Number.isFinite(delta)) return "";
	if (delta < MINUTE) return "刚刚";
	if (delta < HOUR) return `${Math.floor(delta / MINUTE)} 分钟前`;
	if (delta < DAY) return `${Math.floor(delta / HOUR)} 小时前`;
	const date = new Date(at);
	const today = new Date(now);
	if (at >= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - DAY) return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
	if (date.getFullYear() === today.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
	return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
/** Trim to `max` characters on a word-free boundary that keeps CJK intact. */
function clip(text, max) {
	const value = text.trim();
	return value.length <= max ? value : `${value.slice(0, Math.max(1, max - 1))}…`;
}
/** `provider/model` as written in the front matter, or `未知模型`. */
function modelText(provider, model) {
	const value = [provider, model].filter((part) => part !== void 0 && part !== "").join("/");
	return value === "" ? "未知模型" : value;
}
/** Copy text to the clipboard, tolerating a browser that only offers the old path. */
async function writeClipboard(text) {
	try {
		if (navigator.clipboard !== void 0 && navigator.clipboard.writeText !== void 0) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {}
	try {
		const area = document.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.style.position = "fixed";
		area.style.opacity = "0";
		document.body.appendChild(area);
		area.select();
		const done = document.execCommand("copy");
		document.body.removeChild(area);
		return done;
	} catch {
		return false;
	}
}
/** Trigger a browser download for generated text. */
function downloadText(name, text) {
	const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = name;
	anchor.style.display = "none";
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
/** `handoff-20261026-085833-补测试.md` → `补测试`, with a readable fallback. */
function titleFromFileName(name) {
	const bare = name.replace(/\.md$/u, "");
	const slug = /^\w+?-(\d{8})-(\d{6})-(.+)$/u.exec(bare)?.[3]?.replace(/-/gu, " ").trim() ?? "";
	return slug === "" ? bare : slug;
}
// src/markdown.ts
/** YAML front matter: `---` line, fields, closing `---`, then the body. */
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/u;
/** A scalar as written by `yamlString`: bare, `"quoted"`, or a plain number. */
function scalar(raw) {
	const value = raw.trim();
	if (value.startsWith("\"") && value.endsWith("\"") && value.length >= 2) try {
		const parsed = JSON.parse(value);
		if (typeof parsed === "string") return parsed;
	} catch {}
	return value;
}
/**
* Split front matter from the body without a YAML dependency.
*
* The generator writes only flat `key: scalar` pairs, so a full parser would be
* dead weight; a document edited by hand with nested YAML keeps the flat fields
* it does have and ignores the rest.
*/
function splitFrontMatter(content) {
	const match = FRONT_MATTER.exec(content);
	if (match === null) return {
		meta: {},
		body: content
	};
	const meta = {};
	for (const line of (match[1] ?? "").split(/\r?\n/u)) {
		const field = /^([A-Za-z][\w-]*):[ \t]*(.*)$/u.exec(line);
		if (field?.[1] !== void 0 && field[2] !== void 0 && field[2].trim() !== "") meta[field[1]] = scalar(field[2]);
	}
	return {
		meta,
		body: content.slice(match[0].length)
	};
}
// src/client/markdown.ts
/**
* A deliberately small markdown reader for handoff documents.
*
* The Host ships a full markdown renderer, but it expects a sizable label
* bundle and the transcript typography; a handoff is a short, predictable
* document, so a local parser keeps the panel independent and lets the preview
* style its own sections. Everything is returned as data and rendered as React
* elements — never as HTML — so a document can not inject markup.
*/
const SAFE_HREF = /^(?:https?:|mailto:|#|\/)/iu;
/** Split inline markdown into data. Unknown syntax stays literal text. */
function parseInline(text) {
	const out = [];
	const pattern = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\s]+\))/gu;
	let cursor = 0;
	for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
		if (match.index > cursor) out.push({
			kind: "text",
			text: text.slice(cursor, match.index)
		});
		const token = match[0];
		if (match[1] !== void 0) out.push({
			kind: "code",
			text: token.slice(1, -1)
		});
		else if (match[2] !== void 0 || match[3] !== void 0) out.push({
			kind: "strong",
			children: parseInline(token.slice(2, -2))
		});
		else if (match[4] !== void 0 || match[5] !== void 0) out.push({
			kind: "em",
			children: parseInline(token.slice(1, -1))
		});
		else if (match[6] !== void 0) out.push({
			kind: "del",
			children: parseInline(token.slice(2, -2))
		});
		else if (match[7] !== void 0) {
			const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/u.exec(token);
			const label = link?.[1] ?? token;
			const href = link?.[2] ?? "";
			out.push(SAFE_HREF.test(href) ? {
				kind: "link",
				href,
				children: parseInline(label)
			} : {
				kind: "text",
				text: label
			});
		}
		cursor = match.index + token.length;
	}
	if (cursor < text.length) out.push({
		kind: "text",
		text: text.slice(cursor)
	});
	return out;
}
/** Plain text of inline content — for copy buttons and search. */
function inlineText(inline) {
	return inline.map((node) => {
		switch (node.kind) {
			case "text":
			case "code": return node.text;
			case "strong":
			case "em":
			case "del": return inlineText(node.children);
			case "link": return inlineText(node.children);
			default: return "";
		}
	}).join("");
}
const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/u;
const FENCE = /^```([\w+#.-]*)[ \t]*$/u;
const UL_ITEM = /^([ \t]*)[-*+][ \t]+(.*)$/u;
const OL_ITEM = /^([ \t]*)(\d{1,9})[.)][ \t]+(.*)$/u;
const TASK = /^\[([ xX])\][ \t]+(.*)$/u;
const QUOTE = /^>[ \t]?(.*)$/u;
const HR = /^[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/u;
const TABLE_SEPARATOR = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/u;
function tableCells(line) {
	return line.trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|").map((cell) => cell.trim());
}
/** Indentation width → nesting depth (two spaces or one tab per level). */
function depthOf(indent) {
	const spaces = indent.replace(/\t/gu, "  ").length;
	return Math.min(3, Math.floor(spaces / 2));
}
/** Parse a document body into blocks. Front matter is returned separately. */
function parseDocument(raw) {
	const { meta, body } = splitFrontMatter(raw);
	const lines = body.split(/\r?\n/u);
	const blocks = [];
	let title;
	let index = 0;
	const pushParagraph = (parts) => {
		const text = parts.join("\n").trim();
		if (text !== "") blocks.push({
			kind: "paragraph",
			inline: parseInline(text)
		});
	};
	while (index < lines.length) {
		const line = lines[index] ?? "";
		index += 1;
		if (line.trim() === "") continue;
		const fence = FENCE.exec(line.trim());
		if (fence !== null) {
			const code = [];
			while (index < lines.length && (lines[index] ?? "").trim() !== "```") {
				code.push(lines[index] ?? "");
				index += 1;
			}
			index += 1;
			blocks.push({
				kind: "code",
				lang: fence[1] ?? "",
				code: code.join("\n")
			});
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading !== null) {
			const level = Math.min(6, (heading[1] ?? "#").length);
			const inline = parseInline((heading[2] ?? "").trim());
			if (level === 1 && title === void 0) title = inlineText(inline);
			blocks.push({
				kind: "heading",
				level,
				inline
			});
			continue;
		}
		if (HR.test(line)) {
			blocks.push({ kind: "hr" });
			continue;
		}
		if (line.trimStart().startsWith("|") && TABLE_SEPARATOR.test(lines[index] ?? "")) {
			const head = tableCells(line).map((cell) => parseInline(cell));
			index += 1;
			const rows = [];
			while (index < lines.length && (lines[index] ?? "").trimStart().startsWith("|")) {
				rows.push(tableCells(lines[index] ?? "").map((cell) => parseInline(cell)));
				index += 1;
			}
			blocks.push({
				kind: "table",
				head,
				rows
			});
			continue;
		}
		if (QUOTE.test(line)) {
			const inner = [(QUOTE.exec(line)?.[1] ?? "").trim()];
			while (index < lines.length) {
				const next = lines[index] ?? "";
				if (!QUOTE.test(next)) break;
				inner.push((QUOTE.exec(next)?.[1] ?? "").trim());
				index += 1;
			}
			blocks.push({
				kind: "quote",
				blocks: parseDocument(inner.join("\n")).blocks
			});
			continue;
		}
		if (UL_ITEM.test(line) || OL_ITEM.test(line)) {
			const ordered = !UL_ITEM.test(line);
			const items = [];
			let current = line;
			while (current !== void 0) {
				const item = ordered ? OL_ITEM.exec(current) : UL_ITEM.exec(current);
				if (item === null) break;
				const depth = depthOf(item[1] ?? "");
				let text = (ordered ? item[3] ?? "" : item[2] ?? "").trim();
				const task = TASK.exec(text);
				const checked = task === null ? void 0 : (task[1] ?? "").trim().toLowerCase() === "x";
				if (task !== null) text = task[2] ?? "";
				while (index < lines.length) {
					const next = lines[index] ?? "";
					if (next.trim() === "" || UL_ITEM.test(next) || OL_ITEM.test(next) || HEADING.test(next) || FENCE.test(next.trim()) || QUOTE.test(next) || HR.test(next) || next.trimStart().startsWith("|")) break;
					text += ` ${next.trim()}`;
					index += 1;
				}
				const inline = parseInline(text);
				items.push(checked === void 0 ? {
					inline,
					depth
				} : {
					inline,
					depth,
					checked
				});
				current = lines[index];
				if (current !== void 0 && (ordered ? OL_ITEM.test(current) : UL_ITEM.test(current))) index += 1;
				else current = void 0;
			}
			blocks.push({
				kind: "list",
				ordered,
				items
			});
			continue;
		}
		const paragraph = [line];
		while (index < lines.length) {
			const next = lines[index] ?? "";
			if (next.trim() === "" || HEADING.test(next) || FENCE.test(next.trim()) || HR.test(next) || QUOTE.test(next) || UL_ITEM.test(next) || OL_ITEM.test(next) || next.trimStart().startsWith("|")) break;
			paragraph.push(next);
			index += 1;
		}
		pushParagraph(paragraph);
	}
	return title === void 0 ? {
		meta,
		blocks
	} : {
		meta,
		blocks,
		title
	};
}
/** Everything the opening-line section contains, for its copy button. */
function openingLine(blocks) {
	const start = blocks.findIndex((block) => block.kind === "heading" && /开场白|opening line/iu.test(inlineText(block.inline)));
	if (start < 0) return "";
	const parts = [];
	for (const block of blocks.slice(start + 1)) {
		if (block.kind === "heading") break;
		if (block.kind === "paragraph") parts.push(inlineText(block.inline));
		else if (block.kind === "quote") parts.push(block.blocks.map((inner) => inner.kind === "paragraph" ? inlineText(inner.inline) : "").join(" "));
	}
	return parts.join("\n\n").trim();
}
// src/client/page.ts
/**
* The handoff page: document list, rendered preview, and generation.
*
* Layout is a two-column split inside the Host's `main` panel: the left rail
* lists generated documents, the right pane renders the selected one. Every
* state the routes can produce — loading, empty, error, truncated — has a
* visible home, because a handoff screen is often opened in a hurry.
*/
const SESSION_KEY = "dsh-handoff:session";
/** Read a remembered panel choice; storage can be unavailable in a sandboxed frame. */
function readStored(key) {
	try {
		return window.localStorage.getItem(key) ?? "";
	} catch {
		return "";
	}
}
function storeChoice(key, value) {
	try {
		window.localStorage.setItem(key, value);
	} catch {}
}
/** `交接文档 · 重构登录模块` → `重构登录模块`. */
function stripDocumentPrefix(title) {
	return title.replace(/^交接文档\s*[·:：-]\s*/u, "").trim();
}
function quoteText(block) {
	return block.blocks.map((inner) => {
		if (inner.kind === "paragraph") return inlineText(inner.inline);
		if (inner.kind === "quote") return quoteText(inner);
		return "";
	}).join(" ");
}
/** Drop the generated H1 and freshness line: the pane header already shows both. */
function trimBoilerplate(blocks) {
	const out = [...blocks];
	const first = out[0];
	if (first?.kind === "heading" && first.level === 1) out.shift();
	const next = out[0];
	if (next?.kind === "quote" && quoteText(next).includes("生成于")) out.shift();
	return out;
}
function inlineNodes(inline, keyPrefix) {
	return inline.map((node, index) => {
		const key = `${keyPrefix}-${index}`;
		switch (node.kind) {
			case "text": return node.text;
			case "code": return (0, react.createElement)("code", {
				key,
				className: "dh-inline-code"
			}, node.text);
			case "strong": return (0, react.createElement)("strong", { key }, inlineNodes(node.children, key));
			case "em": return (0, react.createElement)("em", { key }, inlineNodes(node.children, key));
			case "del": return (0, react.createElement)("del", { key }, inlineNodes(node.children, key));
			case "link": return (0, react.createElement)("a", {
				key,
				href: node.href,
				target: "_blank",
				rel: "noreferrer noopener"
			}, inlineNodes(node.children, key));
			default: return null;
		}
	});
}
/** A fenced block with its own copy affordance. */
function CodeBlock(props) {
	const [done, setDone] = (0, react.useState)(false);
	const timer = (0, react.useRef)(void 0);
	(0, react.useEffect)(() => () => window.clearTimeout(timer.current), []);
	const copy = () => {
		writeClipboard(props.code).then((ok) => {
			if (!ok) return;
			setDone(true);
			window.clearTimeout(timer.current);
			timer.current = window.setTimeout(() => setDone(false), 1400);
		});
	};
	return (0, react.createElement)("div", { className: props.lang === "" ? "dh-code" : "dh-code dh-code-has-lang" }, props.lang === "" ? null : (0, react.createElement)("span", { className: "dh-code-lang" }, props.lang), (0, react.createElement)("button", {
		type: "button",
		className: "dh-iconbtn dh-code-copy",
		title: "复制代码",
		"aria-label": "复制代码",
		onClick: copy
	}, done ? (0, react.createElement)(IconCheck, { size: 13 }) : (0, react.createElement)(IconCopy, { size: 13 })), (0, react.createElement)("pre", null, (0, react.createElement)("code", null, props.code)));
}
function renderBlock(block, key) {
	switch (block.kind) {
		case "heading": {
			const level = Math.min(4, block.level);
			return (0, react.createElement)(`h${level}`, { key }, inlineNodes(block.inline, key));
		}
		case "paragraph": return (0, react.createElement)("p", { key }, inlineNodes(block.inline, key));
		case "code": return (0, react.createElement)(CodeBlock, {
			key,
			lang: block.lang,
			code: block.code
		});
		case "quote": return (0, react.createElement)("blockquote", {
			key,
			className: "dh-quote"
		}, block.blocks.map((inner, index) => renderBlock(inner, `${key}-${index}`)));
		case "hr": return (0, react.createElement)("hr", {
			key,
			className: "dh-hr"
		});
		case "table": return (0, react.createElement)("div", {
			key,
			className: "dh-tablewrap"
		}, (0, react.createElement)("table", null, (0, react.createElement)("thead", null, (0, react.createElement)("tr", null, block.head.map((cell, index) => (0, react.createElement)("th", { key: `${key}-h-${index}` }, inlineNodes(cell, `${key}-h-${index}`))))), (0, react.createElement)("tbody", null, block.rows.map((row, rowIndex) => (0, react.createElement)("tr", { key: `${key}-r-${rowIndex}` }, row.map((cell, cellIndex) => (0, react.createElement)("td", { key: `${key}-r-${rowIndex}-${cellIndex}` }, inlineNodes(cell, `${key}-r-${rowIndex}-${cellIndex}`))))))));
		case "list": {
			const listTag = block.ordered ? "ol" : "ul";
			const tasks = block.items.some((item) => item.checked !== void 0);
			return (0, react.createElement)(listTag, {
				key,
				className: tasks ? "dh-tasklist" : void 0
			}, block.items.map((item, index) => (0, react.createElement)("li", {
				key: `${key}-${index}`,
				className: item.checked === void 0 ? void 0 : "dh-task",
				style: item.depth === 0 ? void 0 : { marginLeft: item.depth * 14 }
			}, item.checked === void 0 ? inlineNodes(item.inline, `${key}-${index}`) : [(0, react.createElement)("span", {
				key: "check",
				className: "dh-check",
				"data-checked": item.checked ? "true" : "false",
				"aria-hidden": true
			}, item.checked ? (0, react.createElement)(IconTaskCheck, { size: 10 }) : null), (0, react.createElement)("span", { key: "text" }, inlineNodes(item.inline, `${key}-${index}`))])));
		}
		default: return null;
	}
}
/** The closing section gets a highlighted card: it is the part people paste. */
function OpeningCard(props) {
	const [done, setDone] = (0, react.useState)(false);
	const timer = (0, react.useRef)(void 0);
	(0, react.useEffect)(() => () => window.clearTimeout(timer.current), []);
	const copy = () => {
		writeClipboard(props.text).then((ok) => {
			if (!ok) return;
			setDone(true);
			window.clearTimeout(timer.current);
			timer.current = window.setTimeout(() => setDone(false), 1400);
		});
	};
	const body = props.blocks.slice(1);
	return (0, react.createElement)("section", { className: "dh-opening" }, (0, react.createElement)("div", { className: "dh-opening-head" }, (0, react.createElement)(IconSparkle, { size: 13 }), (0, react.createElement)("span", null, "给下一个会话的开场白"), (0, react.createElement)("span", { className: "dh-badge-new" }, "可直接粘贴"), (0, react.createElement)("span", { style: { flex: 1 } }), (0, react.createElement)("button", {
		type: "button",
		className: "dh-btn dh-btn-ghost dh-btn-sm",
		onClick: copy
	}, done ? (0, react.createElement)(IconCheck, { size: 12 }) : (0, react.createElement)(IconCopy, { size: 12 }), done ? "已复制" : "复制")), (0, react.createElement)("div", null, body.map((block, index) => renderBlock(block, `opening-${index}`))));
}
/** Render the document body, lifting the opening-line section into its card. */
function Article(props) {
	const nodes = [];
	const start = props.blocks.findIndex((block) => block.kind === "heading" && /开场白|opening line/iu.test(inlineText(block.inline)));
	let index = 0;
	while (index < props.blocks.length) {
		if (index === start) {
			const group = [];
			let cursor = index;
			while (cursor < props.blocks.length && (cursor === index || props.blocks[cursor]?.kind !== "heading")) {
				const block = props.blocks[cursor];
				if (block !== void 0) group.push(block);
				cursor += 1;
			}
			nodes.push((0, react.createElement)(OpeningCard, {
				key: "opening",
				blocks: group,
				text: props.text
			}));
			index = cursor;
			continue;
		}
		const block = props.blocks[index];
		if (block !== void 0) nodes.push(renderBlock(block, `block-${index}`));
		index += 1;
	}
	return (0, react.createElement)("div", { className: "dh-doc" }, nodes);
}
function NoticeBar(props) {
	const icon = props.notice.tone === "error" ? (0, react.createElement)(IconAlert, { size: 14 }) : props.notice.tone === "ok" ? (0, react.createElement)(IconCheck, { size: 14 }) : (0, react.createElement)(IconInfo, { size: 14 });
	return (0, react.createElement)("div", {
		className: `dh-banner dh-banner-${props.notice.tone}`,
		role: props.notice.tone === "error" ? "alert" : "status"
	}, (0, react.createElement)("span", { className: "dh-banner-icon" }, icon), (0, react.createElement)("span", { className: "dh-banner-text" }, props.notice.text, props.notice.code === void 0 ? null : (0, react.createElement)("code", { style: {
		marginLeft: 6,
		opacity: .7
	} }, props.notice.code)), (0, react.createElement)("button", {
		type: "button",
		className: "dh-iconbtn",
		title: "关闭提示",
		"aria-label": "关闭提示",
		onClick: props.onDismiss
	}, (0, react.createElement)(IconClose, { size: 12 })));
}
function EmptyState(props) {
	return (0, react.createElement)("div", { className: "dh-empty" }, (0, react.createElement)("div", { className: "dh-empty-mark" }, (0, react.createElement)(IconHandoff, { size: 18 })), (0, react.createElement)("div", { className: "dh-empty-title" }, props.title), (0, react.createElement)("p", { className: "dh-empty-text" }, props.text), props.children);
}
function SkeletonList() {
	return (0, react.createElement)("div", {
		className: "dh-items",
		"aria-hidden": true
	}, [
		0,
		1,
		2
	].map((index) => (0, react.createElement)("div", {
		key: index,
		className: "dh-skel"
	})));
}
/** The busiest live session is the likeliest place to continue the work. */
function defaultAttachTarget(sessions) {
	let best;
	for (const session of sessions) if (best === void 0 || session.messages > best.messages) best = session;
	return best?.id ?? "";
}
/**
* The confirmation layer for "接续到会话".
*
* It is deliberately local rather than a Host dialog import: the panel owns one
* scoped stylesheet, so the layer reskins with the same `--dsw-*` tokens as the
* rest of the page and cannot depend on a private Host component path.
*/
function AttachDialog(props) {
	const [target, setTarget] = (0, react.useState)(() => defaultAttachTarget(props.sessions));
	(0, react.useEffect)(() => {
		const onKeyDown = (event) => {
			if (event.key === "Escape") props.onCancel();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [props.onCancel]);
	const canConfirm = target !== "";
	return (0, react.createElement)("div", {
		className: "dh-overlay",
		onMouseDown: (event) => {
			if (event.target === event.currentTarget) props.onCancel();
		}
	}, (0, react.createElement)("div", {
		className: "dh-dialog",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "dh-attach-title",
		"aria-describedby": "dh-attach-hint"
	}, (0, react.createElement)("div", { className: "dh-dialog-head" }, (0, react.createElement)("span", { className: "dh-dialog-mark" }, (0, react.createElement)(IconHandoff, { size: 15 })), (0, react.createElement)("span", {
		className: "dh-dialog-title",
		id: "dh-attach-title"
	}, "接续到会话"), (0, react.createElement)("button", {
		type: "button",
		className: "dh-iconbtn",
		title: "关闭",
		"aria-label": "关闭",
		onClick: props.onCancel
	}, (0, react.createElement)(IconClose, { size: 13 }))), (0, react.createElement)("div", { className: "dh-dialog-body" }, (0, react.createElement)("p", { className: "dh-dialog-lead" }, `把《${props.docTitle}》注入到下面选中的会话。`), (0, react.createElement)("div", { className: "dh-dialog-field" }, (0, react.createElement)("label", {
		className: "dh-label",
		htmlFor: "dh-attach-session"
	}, "目标会话"), (0, react.createElement)("div", { className: "dh-selectwrap dh-dialog-selectwrap" }, (0, react.createElement)("select", {
		id: "dh-attach-session",
		className: "dh-select",
		value: target,
		autoFocus: true,
		onChange: (event) => setTarget(event.target.value)
	}, props.sessions.length === 0 ? (0, react.createElement)("option", { value: "" }, "没有活动会话") : props.sessions.map((session) => (0, react.createElement)("option", {
		key: session.id,
		value: session.id
	}, `${session.title}（${session.messages} 条消息）`))), (0, react.createElement)(IconChevronDown, {
		size: 13,
		className: "dh-select-icon"
	}))), (0, react.createElement)("ul", {
		className: "dh-dialog-hints",
		id: "dh-attach-hint"
	}, (0, react.createElement)("li", null, "会作为模型可见的上下文注入该会话，不产生用户消息，也不开新的一轮对话。"), (0, react.createElement)("li", null, "文档超过 30000 字时只注入前 30000 字，并标注已截断。"), (0, react.createElement)("li", null, "目标会话必须是当前进程里活着的会话；没有活动实例的先发一条消息激活。"), (0, react.createElement)("li", null, "文档按目标会话的工作目录查找同名文件；工作目录不同、没有这份文档时会提示换一个会话。")), (0, react.createElement)("p", {
		className: "dh-dialog-file",
		title: props.docName
	}, props.docName)), (0, react.createElement)("div", { className: "dh-dialog-foot" }, (0, react.createElement)("button", {
		type: "button",
		className: "dh-btn dh-btn-ghost dh-btn-sm",
		onClick: props.onCancel
	}, "取消"), (0, react.createElement)("button", {
		type: "button",
		className: "dh-btn dh-btn-primary dh-btn-sm",
		disabled: !canConfirm,
		onClick: () => props.onConfirm(target)
	}, (0, react.createElement)(IconHandoff, { size: 13 }), "确认注入"))));
}
function DocumentPane(props) {
	const [copied, setCopied] = (0, react.useState)(false);
	const [downloaded, setDownloaded] = (0, react.useState)(false);
	const timer = (0, react.useRef)(void 0);
	(0, react.useEffect)(() => () => window.clearTimeout(timer.current), []);
	const parsed = (0, react.useMemo)(() => props.raw === "" ? null : parseDocument(props.raw), [props.raw]);
	const blocks = (0, react.useMemo)(() => parsed === null ? [] : trimBoilerplate(parsed.blocks), [parsed]);
	const text = (0, react.useMemo)(() => parsed === null ? "" : openingLine(parsed.blocks), [parsed]);
	const fallbackTitle = parsed?.title === void 0 ? "" : stripDocumentPrefix(parsed.title);
	const title = (props.entry?.title ?? fallbackTitle) || titleFromFileName(props.entry?.name ?? "");
	const meta = parsed?.meta ?? {};
	const versionLabel = meta.version !== void 0 ? `v${meta.version}` : props.entry?.version === void 0 ? "" : `v${props.entry.version}`;
	const created = meta.created;
	const createdMs = created === void 0 ? NaN : Date.parse(created);
	const model = modelText(meta.provider ?? props.entry?.provider, meta.model ?? props.entry?.model);
	const focus = meta.focus ?? props.entry?.focus ?? "";
	const previous = meta.previous ?? props.entry?.previous ?? "";
	const generator = meta.generator ?? props.entry?.generator ?? "";
	const messageCount = meta.messages !== void 0 ? Number(meta.messages) : props.entry?.messages;
	const flash = (setter) => {
		setter(true);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setter(false), 1400);
	};
	const copyAll = () => {
		writeClipboard(props.raw).then((ok) => {
			if (ok) flash(setCopied);
		});
	};
	const download = () => {
		if (props.entry === void 0) return;
		downloadText(props.entry.name, props.raw);
		flash(setDownloaded);
	};
	if (props.state === "loading") return (0, react.createElement)("section", { className: "dh-view" }, (0, react.createElement)("div", {
		className: "dh-empty",
		"aria-busy": true
	}, (0, react.createElement)(IconLoader, {
		size: 18,
		className: "dh-spin"
	}), (0, react.createElement)("div", { className: "dh-empty-title" }, "正在读取文档…"), (0, react.createElement)("div", { className: "dh-skel-lines" }, [
		0,
		1,
		2
	].map((index) => (0, react.createElement)("div", {
		key: index,
		className: "dh-skel-line"
	})))));
	if (props.state === "error") return (0, react.createElement)("section", { className: "dh-view" }, (0, react.createElement)(EmptyState, {
		title: "文档读取失败",
		text: props.error
	}, (0, react.createElement)("button", {
		type: "button",
		className: "dh-btn dh-btn-ghost dh-btn-sm",
		onClick: props.onRetry
	}, (0, react.createElement)(IconRefresh, { size: 13 }), "重试")));
	if (props.entry === void 0) return (0, react.createElement)("section", { className: "dh-view" }, (0, react.createElement)(EmptyState, {
		title: "选一份文档预览",
		text: "左侧列出这个会话目录下生成过的交接文档；点任意一份就能在这里读。"
	}, null));
	if (parsed === null) return (0, react.createElement)("section", { className: "dh-view" }, (0, react.createElement)(EmptyState, {
		title: "这份文档是空的",
		text: `${props.entry.name} 没有可显示的内容，可能被清空了。`
	}, (0, react.createElement)("button", {
		type: "button",
		className: "dh-btn dh-btn-ghost dh-btn-sm",
		onClick: props.onRetry
	}, (0, react.createElement)(IconRefresh, { size: 13 }), "重新读取")));
	return (0, react.createElement)("section", { className: "dh-view" }, (0, react.createElement)("div", { className: "dh-view-head" }, (0, react.createElement)("div", {
		className: "dh-view-title",
		title: props.entry.name
	}, title), (0, react.createElement)("div", { className: "dh-view-actions" }, (0, react.createElement)("button", {
		type: "button",
		className: "dh-btn dh-btn-sm dh-btn-accent",
		onClick: props.onAttach,
		disabled: props.attachBusy,
		title: "把这份交接文档注入到另一个活着的会话，让它在下一步继续",
		"aria-busy": props.attachBusy ? "true" : void 0
	}, props.attachBusy ? (0, react.createElement)(IconLoader, {
		size: 13,
		className: "dh-spin"
	}) : props.attached ? (0, react.createElement)(IconCheck, { size: 13 }) : (0, react.createElement)(IconHandoff, { size: 13 }), props.attachBusy ? "接续中…" : props.attached ? "已接续" : "接续到会话"), (0, react.createElement)("button", {
		type: "button",
		className: "dh-btn dh-btn-ghost dh-btn-sm",
		onClick: () => props.onMode(props.mode === "preview" ? "raw" : "preview"),
		title: props.mode === "preview" ? "查看原始 markdown" : "回到渲染视图"
	}, props.mode === "preview" ? (0, react.createElement)(IconCode, { size: 13 }) : (0, react.createElement)(IconEye, { size: 13 }), props.mode === "preview" ? "原文" : "预览"), (0, react.createElement)("button", {
		type: "button",
		className: "dh-iconbtn",
		title: copied ? "已复制" : "复制全文",
		"aria-label": "复制全文",
		onClick: copyAll
	}, copied ? (0, react.createElement)(IconCheck, { size: 14 }) : (0, react.createElement)(IconCopy, { size: 14 })), (0, react.createElement)("button", {
		type: "button",
		className: "dh-iconbtn",
		title: downloaded ? "已保存" : "下载 .md",
		"aria-label": "下载 markdown",
		onClick: download
	}, downloaded ? (0, react.createElement)(IconCheck, { size: 14 }) : (0, react.createElement)(IconDownload, { size: 14 })))), (0, react.createElement)("div", { className: "dh-chips" }, versionLabel === "" ? null : (0, react.createElement)("span", { className: "dh-chip dh-chip-brand" }, versionLabel), created === void 0 || Number.isNaN(createdMs) ? null : (0, react.createElement)("span", {
		className: "dh-chip",
		title: created
	}, (0, react.createElement)(IconInfo, { size: 10 }), dateTimeText(createdMs)), (0, react.createElement)("span", { className: "dh-chip" }, model), typeof messageCount === "number" && Number.isFinite(messageCount) ? (0, react.createElement)("span", { className: "dh-chip" }, `${messageCount} 条消息`) : null, focus === "" ? null : (0, react.createElement)("span", {
		className: "dh-chip",
		title: focus
	}, `关注点：${clip(focus, 24)}`), previous === "" ? null : (0, react.createElement)("span", {
		className: "dh-chip",
		title: previous
	}, `上一份：${previous}`), generator === "" ? null : (0, react.createElement)("span", {
		className: "dh-chip",
		title: generator
	}, generator)), (0, react.createElement)("div", { className: "dh-article" }, props.mode === "raw" ? (0, react.createElement)("pre", { className: "dh-raw" }, props.raw) : (0, react.createElement)(Article, {
		blocks,
		text
	})));
}
/** The whole panel. */
function Page() {
	const [sessions, setSessions] = (0, react.useState)([]);
	const [sessionId, setSessionId] = (0, react.useState)("");
	const [sessionsState, setSessionsState] = (0, react.useState)("idle");
	const [docs, setDocs] = (0, react.useState)([]);
	const [dir, setDir] = (0, react.useState)("");
	const [docsState, setDocsState] = (0, react.useState)("idle");
	const [docsError, setDocsError] = (0, react.useState)("");
	const [activeName, setActiveName] = (0, react.useState)("");
	const [docState, setDocState] = (0, react.useState)("idle");
	const [docError, setDocError] = (0, react.useState)("");
	const [raw, setRaw] = (0, react.useState)("");
	const [focus, setFocus] = (0, react.useState)("");
	const [search, setSearch] = (0, react.useState)("");
	const [mode, setMode] = (0, react.useState)("preview");
	const [busy, setBusy] = (0, react.useState)(false);
	const [notice, setNotice] = (0, react.useState)(null);
	const [attachOpen, setAttachOpen] = (0, react.useState)(false);
	const [attachBusy, setAttachBusy] = (0, react.useState)(false);
	const [attached, setAttached] = (0, react.useState)(false);
	const loadToken = (0, react.useRef)(0);
	const sessionToken = (0, react.useRef)(0);
	const attachTimer = (0, react.useRef)(void 0);
	const activeNameRef = (0, react.useRef)("");
	/** Fetch the live sessions and select the remembered one, else the newest. */
	const loadSessions = (0, react.useCallback)(async () => {
		const token = sessionToken.current + 1;
		sessionToken.current = token;
		setSessionsState("loading");
		try {
			const value = await apiGet(`${API}/sessions`);
			if (sessionToken.current !== token) return;
			setSessions(value.sessions);
			setSessionsState("ready");
			const remembered = readStored(SESSION_KEY);
			const pick = value.sessions.find((session) => session.id === remembered) ?? value.sessions[value.sessions.length - 1] ?? value.sessions[0];
			if (pick !== void 0) setSessionId(pick.id);
		} catch (error) {
			if (sessionToken.current !== token) return;
			setSessionsState("error");
			const described = describeError(error);
			setNotice({
				tone: "error",
				text: `会话列表读取失败：${described.text}`,
				...described.code === void 0 ? {} : { code: described.code }
			});
		}
	}, []);
	(0, react.useEffect)(() => {
		loadSessions();
		return () => {
			sessionToken.current += 1;
		};
	}, [loadSessions]);
	/** Load the document list for one session; returns what it found. */
	const loadDocs = (0, react.useCallback)(async (id, token) => {
		const value = await apiGet(`${API}/docs?sessionId=${encodeURIComponent(id)}`);
		const found = [...value.docs];
		if (token !== void 0 && loadToken.current !== token) return found;
		setDocs(found);
		setDir(value.dir);
		setDocsState("ready");
		return found;
	}, []);
	/** Select a document and drop the previous body in the same update. */
	const selectDoc = (0, react.useCallback)((name) => {
		setActiveName(name);
		setRaw("");
		setDocError("");
		setDocState(name === "" ? "idle" : "loading");
	}, []);
	(0, react.useEffect)(() => {
		if (sessionId === "") return;
		storeChoice(SESSION_KEY, sessionId);
		setDocs([]);
		setDir("");
		setActiveName("");
		setRaw("");
		setDocState("idle");
		setDocsState("loading");
		setDocsError("");
		const token = loadToken.current + 1;
		loadToken.current = token;
		loadDocs(sessionId, token).catch((error) => {
			if (loadToken.current !== token) return;
			const described = describeError(error);
			setDocsState("error");
			setDocsError(described.text);
		});
	}, [sessionId, loadDocs]);
	(0, react.useEffect)(() => {
		if (docsState !== "ready") return;
		if (docs.length === 0) {
			if (activeName !== "") selectDoc("");
			return;
		}
		if (!docs.some((doc) => doc.name === activeName)) {
			const newest = docs[0];
			if (newest !== void 0) selectDoc(newest.name);
		}
	}, [
		docs,
		docsState,
		activeName,
		selectDoc
	]);
	const activeEntry = activeName === "" ? void 0 : docs.find((doc) => doc.name === activeName);
	(0, react.useEffect)(() => {
		activeNameRef.current = activeName;
		setAttached(false);
	}, [activeName]);
	(0, react.useEffect)(() => () => window.clearTimeout(attachTimer.current), []);
	const loadDoc = (0, react.useCallback)(async (id, name, token) => {
		setDocState("loading");
		setDocError("");
		try {
			const value = await apiGet(`${API}/doc?sessionId=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`);
			if (loadToken.current !== token) return;
			setRaw(value.content);
			setDocState("ready");
		} catch (error) {
			if (loadToken.current !== token) return;
			const described = describeError(error);
			setDocError(described.text);
			setDocState("error");
		}
	}, []);
	(0, react.useEffect)(() => {
		if (sessionId === "" || activeName === "") {
			setRaw("");
			return;
		}
		const token = loadToken.current + 1;
		loadToken.current = token;
		loadDoc(sessionId, activeName, token);
	}, [
		sessionId,
		activeName,
		loadDoc
	]);
	const generate = (0, react.useCallback)(async () => {
		if (sessionId === "" || busy) return;
		setBusy(true);
		setNotice(null);
		const token = loadToken.current + 1;
		loadToken.current = token;
		try {
			const value = await apiPost(`${API}/generate`, {
				sessionId,
				focus: focus.trim()
			});
			if (loadToken.current !== token) return;
			const created = value.path.split("/").pop() ?? "";
			const nextDocs = await loadDocs(sessionId, token);
			if (loadToken.current !== token) return;
			setNotice({
				tone: "ok",
				text: `交接文档已生成：v${value.version} · ${value.model} · ${value.messages} 条消息${value.truncated ? "（记录中段已省略）" : ""}`
			});
			if (created !== "" && nextDocs.some((doc) => doc.name === created)) selectDoc(created);
		} catch (error) {
			if (loadToken.current !== token) return;
			const described = describeError(error);
			setNotice({
				tone: "error",
				text: `生成失败：${described.text}`,
				...described.code === void 0 ? {} : { code: described.code }
			});
		} finally {
			setBusy(false);
		}
	}, [
		sessionId,
		focus,
		busy,
		loadDocs,
		selectDoc
	]);
	const openAttach = (0, react.useCallback)(() => {
		if (activeName === "" || attachBusy) return;
		setNotice(null);
		setAttachOpen(true);
	}, [activeName, attachBusy]);
	const closeAttach = (0, react.useCallback)(() => {
		setAttachOpen(false);
	}, []);
	/**
	* Inject the open document into the picked session.
	*
	* The dialog closes first on purpose: the request must not freeze the panel,
	* so progress lives on the header button and the outcome on the notice bar.
	*/
	const attachTo = (0, react.useCallback)(async (targetId) => {
		if (activeName === "" || attachBusy) return;
		const nameAtStart = activeName;
		setAttachOpen(false);
		setAttachBusy(true);
		setNotice(null);
		try {
			const value = await apiPost(`${API}/attach`, {
				sessionId: targetId,
				name: nameAtStart
			});
			setNotice({
				tone: "ok",
				text: `✅ 已接续《${value.name}》（${value.chars} 字${value.truncated ? "，已截断" : ""}）`
			});
			if (activeNameRef.current === nameAtStart) {
				setAttached(true);
				window.clearTimeout(attachTimer.current);
				attachTimer.current = window.setTimeout(() => setAttached(false), 1600);
			}
		} catch (error) {
			const described = describeError(error);
			setNotice({
				tone: "error",
				text: `接续失败：${described.text}`,
				...described.code === void 0 ? {} : { code: described.code }
			});
		} finally {
			setAttachBusy(false);
		}
	}, [activeName, attachBusy]);
	const filtered = (0, react.useMemo)(() => {
		const query = search.trim().toLowerCase();
		if (query === "") return docs;
		return docs.filter((doc) => {
			return [
				doc.title ?? "",
				doc.name,
				doc.focus ?? "",
				doc.version === void 0 ? "" : `v${doc.version}`
			].join(" ").toLowerCase().includes(query);
		});
	}, [docs, search]);
	const onListKeyDown = (event) => {
		if (![
			"ArrowDown",
			"ArrowUp",
			"Home",
			"End"
		].includes(event.key)) return;
		const buttons = Array.from(event.currentTarget.querySelectorAll("button.dh-item"));
		if (buttons.length === 0) return;
		const current = buttons.findIndex((button) => button === document.activeElement);
		const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? Math.min(buttons.length - 1, current + 1) : Math.max(0, current <= 0 ? 0 : current - 1);
		event.preventDefault();
		buttons[next]?.focus();
	};
	const onSession = (event) => {
		setSessionId(event.target.value);
		setNotice(null);
	};
	const retryDocs = () => {
		if (sessionId === "") return;
		const token = loadToken.current + 1;
		loadToken.current = token;
		setDocsState("loading");
		setDocsError("");
		loadDocs(sessionId, token).catch((error) => {
			if (loadToken.current !== token) return;
			setDocsState("error");
			setDocsError(describeError(error).text);
		});
	};
	const retryDoc = () => {
		if (sessionId === "" || activeName === "") return;
		const token = loadToken.current + 1;
		loadToken.current = token;
		loadDoc(sessionId, activeName, token);
	};
	const listContent = (() => {
		if (docsState === "loading" || docsState === "idle") return (0, react.createElement)(SkeletonList, null);
		if (docsState === "error") return (0, react.createElement)("div", { className: "dh-empty" }, (0, react.createElement)("div", { className: "dh-empty-title" }, "文档列表读取失败"), (0, react.createElement)("p", { className: "dh-empty-text" }, docsError), (0, react.createElement)("button", {
			type: "button",
			className: "dh-btn dh-btn-ghost dh-btn-sm",
			onClick: retryDocs
		}, (0, react.createElement)(IconRefresh, { size: 13 }), "重试"));
		if (docs.length === 0) return (0, react.createElement)(EmptyState, {
			title: "还没有文档",
			text: "点上面的「生成交接文档」，把当前会话写成下一份能直接接手的 brief。"
		}, null);
		if (filtered.length === 0) return (0, react.createElement)(EmptyState, {
			title: "没有匹配的文档",
			text: `没有找到包含「${search.trim()}」的交接文档。`
		}, (0, react.createElement)("button", {
			type: "button",
			className: "dh-btn dh-btn-ghost dh-btn-sm",
			onClick: () => setSearch("")
		}, "清除搜索"));
		return (0, react.createElement)("div", {
			className: "dh-items",
			onKeyDown: onListKeyDown
		}, filtered.map((doc, index) => {
			const active = doc.name === activeName;
			const title = doc.title ?? titleFromFileName(doc.name);
			return (0, react.createElement)("button", {
				key: doc.name,
				type: "button",
				className: "dh-item",
				"aria-current": active ? "true" : void 0,
				"data-active": active ? "true" : "false",
				title: doc.name,
				onClick: () => selectDoc(doc.name)
			}, (0, react.createElement)("div", { className: "dh-item-top" }, doc.version === void 0 ? null : (0, react.createElement)("span", { className: "dh-version" }, `v${doc.version}`), (0, react.createElement)("span", { className: "dh-item-title" }, title), index === 0 && search.trim() === "" ? (0, react.createElement)("span", { className: "dh-badge-new" }, "最新") : null), (0, react.createElement)("div", { className: "dh-item-meta" }, `${relativeTime(doc.modifiedAt)} · ${fileSizeText(doc.size)}${doc.focus === void 0 || doc.focus === "" ? "" : ` · ${clip(doc.focus, 18)}`}`));
		}));
	})();
	const showEmptySessions = sessionsState === "ready" && sessions.length === 0;
	return (0, react.createElement)("div", { className: "dh-root" }, (0, react.createElement)("style", { key: "dh-style" }, CSS), (0, react.createElement)("header", { className: "dh-head" }, (0, react.createElement)("div", null, (0, react.createElement)("div", { className: "dh-title" }, (0, react.createElement)("span", { className: "dh-title-mark" }, (0, react.createElement)(IconHandoff, { size: 15 })), "交接文档"), (0, react.createElement)("div", { className: "dh-sub" }, "把当前会话写成下一个会话能直接接手的 markdown，落到 .dsh/handoff/。")), (0, react.createElement)("div", { className: "dh-session" }, (0, react.createElement)("label", {
		className: "dh-label",
		htmlFor: "dh-session"
	}, "会话"), (0, react.createElement)("div", { className: "dh-selectwrap" }, (0, react.createElement)("select", {
		id: "dh-session",
		className: "dh-select",
		value: sessionId,
		onChange: onSession,
		disabled: sessions.length === 0,
		title: sessions.length === 0 ? "当前进程里没有活动会话" : "选择要写成交接文档的会话"
	}, sessions.length === 0 ? (0, react.createElement)("option", { value: "" }, "没有活动会话") : sessions.map((session) => (0, react.createElement)("option", {
		key: session.id,
		value: session.id
	}, `${session.title}（${session.messages} 条）`))), (0, react.createElement)(IconChevronDown, {
		size: 13,
		className: "dh-select-icon"
	})))), (0, react.createElement)("div", { className: "dh-compose" }, (0, react.createElement)("span", { className: "dh-compose-icon" }, (0, react.createElement)(IconSparkle, { size: 14 })), (0, react.createElement)("input", {
		className: "dh-compose-input",
		value: focus,
		placeholder: "关注点（可省略）：例如「重点写测试和没修完的 bug」",
		"aria-label": "交接文档关注点",
		onChange: (event) => setFocus(event.target.value),
		onKeyDown: (event) => {
			if (event.key === "Enter" && !event.nativeEvent.isComposing) generate();
		},
		disabled: busy
	}), (0, react.createElement)("span", { className: "dh-compose-meta" }, "留空则由模型判断重点"), (0, react.createElement)("button", {
		type: "button",
		className: "dh-btn dh-btn-primary",
		disabled: busy || sessionId === "",
		onClick: () => void generate()
	}, busy ? (0, react.createElement)(IconLoader, {
		size: 13,
		className: "dh-spin"
	}) : (0, react.createElement)(IconSparkle, { size: 13 }), busy ? "生成中…" : "生成交接文档")), notice === null ? null : (0, react.createElement)(NoticeBar, {
		notice,
		onDismiss: () => setNotice(null)
	}), sessionsState === "error" ? (0, react.createElement)(EmptyState, {
		title: "会话列表读取失败",
		text: "本地服务没有返回会话列表。重试一次；仍然失败的话，重启 Harness 后再打开这一页。"
	}, (0, react.createElement)("button", {
		type: "button",
		className: "dh-btn dh-btn-ghost dh-btn-sm",
		onClick: () => void loadSessions()
	}, (0, react.createElement)(IconRefresh, { size: 13 }), "重试")) : showEmptySessions ? (0, react.createElement)(EmptyState, {
		title: "没有活动会话",
		text: "当前进程里还没有会话。开一个新会话聊几句，再回来生成交接文档。"
	}, null) : (0, react.createElement)("div", { className: "dh-body" }, (0, react.createElement)("aside", { className: "dh-list" }, (0, react.createElement)("div", { className: "dh-list-head" }, (0, react.createElement)("span", { className: "dh-list-title" }, "历史文档", (0, react.createElement)("span", { className: "dh-count" }, ` ${filtered.length}/${docs.length}`)), (0, react.createElement)("div", { style: {
		display: "flex",
		gap: 2
	} }, (0, react.createElement)("button", {
		type: "button",
		className: "dh-iconbtn",
		title: "刷新列表",
		"aria-label": "刷新列表",
		onClick: retryDocs,
		disabled: docsState === "loading"
	}, (0, react.createElement)(IconRefresh, { size: 13 })))), (0, react.createElement)("div", { className: "dh-searchwrap" }, (0, react.createElement)(IconSearch, {
		size: 13,
		className: "dh-search-icon"
	}), (0, react.createElement)("input", {
		className: "dh-search",
		value: search,
		placeholder: "搜索标题、版本或文件名",
		"aria-label": "搜索交接文档",
		onChange: (event) => setSearch(event.target.value)
	}), search === "" ? null : (0, react.createElement)("button", {
		type: "button",
		className: "dh-iconbtn dh-search-clear",
		title: "清除搜索",
		"aria-label": "清除搜索",
		onClick: () => setSearch("")
	}, (0, react.createElement)(IconClose, { size: 11 }))), listContent, dir === "" ? null : (0, react.createElement)("div", {
		className: "dh-list-foot",
		title: dir
	}, (0, react.createElement)("span", null, "目录"), (0, react.createElement)("span", { className: "dh-dir" }, dir))), (0, react.createElement)(DocumentPane, {
		entry: activeEntry,
		state: activeName === "" ? "idle" : docState,
		error: docError,
		raw,
		mode,
		onMode: setMode,
		onRetry: retryDoc,
		attachBusy,
		attached,
		onAttach: openAttach
	})), attachOpen && activeEntry !== void 0 ? (0, react.createElement)(AttachDialog, {
		sessions,
		docTitle: activeEntry.title ?? titleFromFileName(activeEntry.name),
		docName: activeEntry.name,
		onCancel: closeAttach,
		onConfirm: (targetId) => void attachTo(targetId)
	}) : null);
}
// src/client/index.ts
/**
* Browser half of dsh-handoff.
*
* Registers one sidebar page (a `main` panel beside the Host's own pages) that
* lists generated handoff documents, renders them, and can generate a new one
* for any live session; plus a card on this bundle's configuration page.
*
* Written with `createElement` and structural service types on purpose: the
* bundle resolves `react` through the Host's shared module table, so it must
* not depend on monorepo-internal type packages at runtime.
*/
const NS = "dsh-handoff";
/** The sidebar seat calls its occupant with Host-owned props; only `size` matters here. */
const SidebarIcon = (props) => IconHandoff(props ?? {});
const name = "dsh-handoff";
const inject = ["slots"];
/** Register the page, its sidebar row, and the bundle's configuration card. */
function apply(ctx) {
	const noProps = () => ({});
	ctx.slots.inject("sidebar.panellist", () => {
		ctx.slots.register({
			name: "main",
			key: NS,
			inject: noProps
		}, Page);
		ctx.slots.register({
			name: "sidebar.panellist",
			id: NS,
			order: 30,
			label: () => "交接文档",
			inject: noProps
		}, SidebarIcon);
	});
	ctx.slots.inject("plugins.bundle.config", () => {
		ctx.slots.register({
			name: "plugins.bundle.config",
			key: NS,
			inject: noProps
		}, SettingsCard);
	});
}
exports.apply = apply;
exports.inject = inject;
exports.name = name;


return module.exports;
}
});
