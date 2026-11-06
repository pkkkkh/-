/**
 * The panel's stylesheet, injected once with the page.
 *
 * Colour, radius, and font decisions come from the Host's `--dsw-*` tokens so
 * the panel follows light/dark, the user's font settings, and any third-party
 * theme. Every token has a neutral fallback: a Host build that lacks one still
 * renders a coherent panel instead of an unstyled one.
 */
export const STYLE_ID = 'dsh-handoff-style'

export const CSS = String.raw`
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
`
