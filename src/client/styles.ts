/**
 * Stylesheet for both surfaces.
 *
 * The bundle ships no CSS file: this text is injected into one `<style>` tag by
 * the plugin's `apply`, and removed with the plugin. Every value is a shared
 * `--dsw-*` token, so both surfaces follow the active theme.
 * @module dsh-anti-blind-approval/client/styles
 */

/** Attribute marking the injected style tag as plugin-owned. */
export const STYLE_MARKER = 'anti-blind-approval'

/** Complete stylesheet text. */
export const CSS = [
  '@keyframes aiar-spin{to{transform:rotate(360deg)}}',
  '.aiar-root{padding:8px calc(var(--dsh-composer-side-clearance) + 16px) 12px;flex-direction:column;align-items:center;display:flex}',
  '.aiar-card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);border-radius:var(--dsw-radius-xl,var(--dsw-radius-lg));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1));box-shadow:var(--dsw-shadow-lv2);overflow:hidden}',
  '.aiar-strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}',
  '.aiar-strip[data-tone="ok"]{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}',
  '.aiar-strip[data-tone="bad"]{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}',
  '.aiar-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}',
  '.aiar-dot[data-pulse="true"]{animation:aiar-pulse 1.2s ease-in-out infinite}',
  '@keyframes aiar-pulse{0%,100%{opacity:.35}50%{opacity:1}}',
  '.aiar-body{box-sizing:border-box;max-height:var(--dsh-composer-text-max-height,320px);flex-direction:column;gap:6px;padding:12px 16px 0;display:flex;overflow-y:auto}',
  '.aiar-headline{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500;line-height:24px;overflow-wrap:anywhere}',
  '.aiar-command{color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);word-break:break-all;font-size:13px;line-height:20px}',
  '.aiar-review{display:flex;flex-direction:column;gap:2px;font-size:13px;line-height:20px}',
  '.aiar-reviewTitle{font-weight:500;color:var(--dsw-alias-label-primary)}',
  '.aiar-review[data-tone="ok"] .aiar-reviewTitle{color:var(--dsw-alias-state-success-primary)}',
  '.aiar-review[data-tone="bad"] .aiar-reviewTitle{color:var(--dsw-alias-state-error-primary)}',
  '.aiar-review[data-tone="warn"] .aiar-reviewTitle{color:var(--dsw-alias-state-warn-primary)}',
  '.aiar-reviewBody{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere}',
  '.aiar-reviewMeta{color:var(--dsw-alias-label-tertiary);font-size:12px}',
  '.aiar-pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);max-height:180px;overflow:auto}',
  '.aiar-actionRow{align-items:center;justify-content:flex-end;gap:8px;padding:14px 16px;display:flex}',
  '.aiar-hold{margin-right:auto;color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:18px}',
  '.aiar-hold[data-tone="bad"]{color:var(--dsw-alias-state-error-primary)}',
  '.aiar-spinner{width:12px;height:12px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:aiar-spin .8s linear infinite;display:inline-block;vertical-align:-2px;flex:none}',
  '.aiar-btnLabel{align-items:center;gap:6px;display:inline-flex}',
  // settings page
  '.aiar-settings{max-width:760px;flex-direction:column;gap:12px;display:flex;color:var(--dsw-alias-label-primary)}',
  '.aiar-settingsTitle{margin:0;font-size:18px;font-weight:600}',
  '.aiar-settingsIntro{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}',
  '.aiar-panel{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);padding:0 14px;display:flex;flex-direction:column}',
  '.aiar-row{display:flex;align-items:center;gap:16px;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1)}',
  '.aiar-row:first-child{border-top:0}',
  '.aiar-rowText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
  '.aiar-rowLabel{font-size:14px;line-height:22px}',
  '.aiar-rowHint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
  '.aiar-column{display:flex;flex-direction:column;gap:6px;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1)}',
  '.aiar-columnTitle{font-size:14px;line-height:22px}',
  '.aiar-select,.aiar-number,.aiar-input{box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);padding:5px 8px;font:inherit;font-size:13px;line-height:20px}',
  '.aiar-select{min-width:260px;max-width:100%}',
  '.aiar-number{width:96px}',
  '.aiar-textarea{box-sizing:border-box;width:100%;min-height:220px;resize:vertical;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);padding:8px 10px;font-family:var(--ds-font-family-code);font-size:12px;line-height:18px}',
  '.aiar-textarea:focus,.aiar-select:focus,.aiar-number:focus{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}',
  '.aiar-toolbar{display:flex;align-items:center;gap:8px;padding-top:10px}',
  '.aiar-btn{font:inherit;font-size:13px;line-height:20px;padding:4px 12px;border-radius:var(--dsw-radius-md);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer}',
  '.aiar-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
  '.aiar-btn:disabled{opacity:.5;cursor:default}',
  '.aiar-btn[data-variant="primary"]{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground);border-color:transparent}',
  '.aiar-status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
  '.aiar-status[data-tone="ok"]{color:var(--dsw-alias-state-success-primary)}',
  '.aiar-status[data-tone="bad"]{color:var(--dsw-alias-state-error-primary)}',
  '.aiar-status[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary)}',
].join('')
