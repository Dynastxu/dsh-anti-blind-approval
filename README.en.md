<p align="center">
  <img src="icon.svg" alt="icon" width="30%"> 
</p>
<h1 align="center">Anti Blind Approval</h1>

<p align="center">
  <a href="LICENSE">
    <img alt="MIT" src="https://img.shields.io/badge/LICENSE-MIT-blue">
  </a>
</p>

<p align="center">
  <a href="https://www.deepseek.com/harness/">
    <img alt="DeepSeek Harness" src="https://img.shields.io/badge/DeepSeek-Harness-1B1B1C?logo=deepseek&logoColor=white&labelColor=5f6df5">
  </a>
  <a>
    <img alt="WebStorm" src="https://img.shields.io/badge/WebStorm-blue?logo=webstorm">
  </a>
  <a>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white">
  </a>
</p>

<p align="center">
  <a href="README.md">中文</a> ｜
  English
</p>

DeepSeek Harness plugin: when a session is in "workspace-write" mode, it sends privilege escalation requests to the model for review as well, returning only `{safe, reason}`. During review, the "Allow" button shows a loading spinner and is disabled; if judged unsafe, it locks for N seconds (default 3 seconds). **The final decision remains with the human; it will not auto-approve.**

UI display name: **反盲批 / Anti Blind Approval**. The package identifier is the same as the repository/folder name: `dsh-anti-blind-approval`. Use this package name for installation, uninstallation, and commands.

## UI Examples
### Allow
![allow.png](docs/imgs/allow.png)
### Deny
![deny.png](docs/imgs/deny.png)

## Settings

**Settings → Anti Blind Approval** (standalone settings page, does not rely on the plugin's auto-config form):

| Setting | Default | Description |
|---|---|---|
| Enable AI review | On | When off, immediately falls back to the DSH native approval panel |
| Review model | Current session model | Any registered provider/model can be selected; leave empty to follow the current session |
| Lock duration when unsafe | 3 seconds | 0–30; 0 means the verdict does not lock the button |
| Review timeout | 10 seconds | 5000–300000ms; maximum duration of a single review; timeout is treated as failure |
| Review prompt | Built-in (English) | Fully customizable; `{language}` is replaced with the UI language; the JSON output contract is appended by the plugin and is unaffected |
| Test review | — | Runs one real model call with a built-in sample to verify model/credentials |

These fields are `.volatile()` fields of the host-side plugin `Config`, projected into a browser form by `@deepseek-ai/dsh-settings`; the browser half reads and writes them via `ctx.configForms`. Writes land in the **current profile's `cordis.patch.yml`**, take effect immediately after saving, are shared by all browsers, and can also be provided directly via `cordis.yml`:

```yaml
- id: dsh-anti-blind-approval
  name: 'dsh-anti-blind-approval'
  config:
    enabled: true
    model: 'deepseek-account::deepseek-flash'   # leave empty to follow current session
    delaySeconds: 3                             # 0 means no lock
    prompt: ''                                  # empty uses built-in prompt
    reviewTimeoutMs: 10000                      # 10-second timeout
```

## Source and Build

The plugin is written in TypeScript. `lib/` contains build artifacts and is committed with the repository: installing from GitHub just fetches the source package, so build artifacts must be in the repository. After changing `src/`, you must rebuild (`pnpm run build`) and commit `lib/`, otherwise consumers still load the old code.

```
src/                        TypeScript sources
  index.ts                  Host entry: name / inject / apply / Config, registers four routes
  config.ts                 Host Config: four .volatile() fields; settings generates form from it
  settings-shared.ts        Shared entry id, value ranges, normalization (no runtime deps)
  routes.ts                 Route handling: preset determination, request body field validation, error codes
  review.ts                 One review: route resolution, fact trimming, model stream, strict JSON verdict
  prompt.ts                 Built-in policy, fixed output contract, {language} replacement
  contract.ts               Route prefix shared by both halves
  types.ts                  Wire contract shared by both halves (types only)
  util.ts                   isRecord / clip / brand conversion
  client/                   Browser half (React)
    index.ts                apply: styles, dictionaries, configForms handle, two slot registrations
    ApprovalPanel.tsx       Approval card (conversation.composer, priority 0)
    SettingsSection.tsx     Settings page (settings.section), reads/writes profile config
    settings.ts             configForms handle
    locales.ts              zh / en dictionaries + error code mapping
    http.ts                 /api requests and HttpError
    styles.ts               Stylesheet injected into <style>
    tsconfig.json           Browser-surface anchor for editor
lib/                        Build artifacts (committed with repo)
  index.js                  Host half ESM (only imports @deepseek-ai/schemastery)
  client.js                 Browser half (window.__ModuleLoader__ closure factory format)
test/                       Tests
  host.test.mjs             Fake ctx + fake model stream: routes, preset, JSON parsing, error codes
  client.test.mjs           Fake loader/React/configForms: panel, settings page, config writes
  composition.test.mjs      Real Cordis Context: service dependencies, activation gating, settings policy
tsconfig.json               Node compilation surface (ES2024, no DOM)
tsconfig.client.json        Browser compilation surface (ES2024, React JSX)
tsdown.config.ts            Build config: src/index.ts → lib/index.js, src/client/ → lib/client.js
cordis.patch.yml            Profile patch layer (package name reference)
package.json                Package manifest + dsh declaration
README.md                   Full documentation
```

When developing in this repo, use the toolchain at the repo root:

```sh
cd dsh-anti-blind-approval
pnpm run typecheck         
pnpm run build             
pnpm test                  
```

The host half depends on `@deepseek-ai/schemastery` (`Config` is its schema), which is listed in `dependencies`; the browser half adds no new runtime dependencies. When installed into a profile, pnpm installs dependencies as usual; when running `--patch` directly in a source checkout, you must run `pnpm install` once in the plugin directory first, otherwise `lib/index.js` cannot resolve this import (the build also needs it).

When the plugin installs its own dependencies separately (e.g., after moving it out of this repo and running `pnpm install`), use the standard scripts `pnpm run typecheck` / `pnpm run build`. We deliberately do not set `prepare` here: pnpm runs `prepare` for git dependencies, and by default it refuses to run dependency scripts not listed in `allowBuilds`, causing installation to fail directly (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`); the artifacts are already committed, so consumers do not need to build on site.

### Two Compilation Surfaces

`tsconfig.json` (Node, no DOM) and `tsconfig.client.json` (browser, React JSX) are separate to prevent either surface from pulling in the other's global types. In both surfaces, `paths` point `@deepseek-ai/*` only to each package's **published declarations** (`lib/types`), so type checking targets the APIs actually installed at runtime, independent of repo-internal source aliases.

`lib/client.js` is produced by `tsdown.config.ts` in the closure factory format required by the client module table (`window.__ModuleLoader__.load({ id, factory })`): `react`, `react/jsx-runtime`, and `@deepseek-ai/dsh-client-ui-primitives` remain module-table requests, and everything else is inlined. The host half has only one runtime import (`@deepseek-ai/schemastery`); routing and review code remain self-contained.

## Behavior and Boundaries

- **Only intercepts `workspace-write` sessions.** `read-only` / `danger-full-access` / `custom` sessions are unaffected (the host side re-validates the preset).
- **The review prompt is English; the verdict language follows the user.** The built-in policy and JSON output contract are in English and contain a `{language}` placeholder: the panel sends the current locale (`ctx.locale`'s `active`, e.g. `zh`, `en-US`) as `userLanguage`, and the host replaces it with a human-readable label (e.g. `Chinese (zh)`, `English`) before sending it to the model, so `reason` is not biased by the prompt language. Missing/invalid tags fall back to `English`. Custom prompts can also use `{language}`.
- **Reviews only; does not decide for you.** Review pass = unlock the button; review fail = lock for N seconds, after which manual allow is still possible.
- **Review content is factual**: tool name, recorded parameters corresponding to `callId`, approval reason, and cwd. The plugin executes no commands and writes nothing to the session log.
- **Failures also lock**: timeout (default 10s, adjustable on the settings page, range 5–300s), no available model, and model returning non-JSON are all treated as "unavailable" and count down; set lock duration to 0 to only notify without locking.
- **Review calls do not count toward session tokens**: they are additional model calls initiated by the plugin and will not appear in the session log/context.
- **The same approval result is briefly cached**: the cache is attached to the plugin instance (passed to the panel via the injection surface); repeated mounts do not re-call the model (max 64 entries).
- **Configuration is profile-level**: writes from the settings page land in the current profile's `cordis.patch.yml`, validated and hot-updated by config-editor; all browsers in the same profile immediately see the same values; manual editing of `cordis.yml` is equivalent.

## Architecture

```
lib/index.js    Host half (ESM, only imports @deepseek-ai/schemastery)
  ├─ Config(.volatile())                     settings projects browser form from it
  ├─ POST /api/anti-blind-approval/action    preset determination + pending operation preview (no model call)
  ├─ POST /api/anti-blind-approval/review    calls ctx.llm.stream, strictly parses {safe, reason}
  ├─ GET  /api/anti-blind-approval/catalog   provider/model list + built-in prompt
  └─ POST /api/anti-blind-approval/test      connectivity test with synthetic sample
lib/client.js   Browser half (module loader format, only require react / react-jsx-runtime / ui-primitives)
  ├─ conversation.composer  priority 0 intercepts approval panel (native panel is priority 1)
  └─ settings.section       "Anti Blind Approval" settings page, reads/writes ctx.configForms
```

Host routes are registered via `ctx.connection.fetch.register()`, using DSH's existing `/api` authentication and Host/Origin protection; no additional port is opened. When `connection` is missing, the plugin loads as usual and registers no routes; if the panel probes and gets 404, it falls back to the native panel.

The browser half depends on `ctx.configForms` provided by ui-settings: when `configForms` is missing, the client plugin does not activate, and the native approval panel works as usual. The host half additionally optionally injects `settings` and uses `configure({ auto: false })` to declare that it provides its own settings page, avoiding duplicate auto-generated forms on the client.

## Verification

```sh
node test/host.test.mjs          # Fake ctx + fake model stream: routes, preset, JSON parsing, error codes, trimming, Config defaults
node test/client.test.mjs        # Fake loader/React/configForms: panel and settings page, request body assertions, config writes, old value migration
node test/composition.test.mjs   # Real Cordis Context: service dependencies determine activation, zero routes without connection, settings policy
```

`composition.test.mjs` loads the runtime from `vendor/cordis` in the repo, so it validates the real `inject` gating and activation timing, not a hand-built fake ctx. Route disposal is handled by the Host Connection service in the caller fiber's effect (the disposer returned by `register()` belongs to that fiber); the plugin only submits routes.

## Known Limitations

- Replacing `conversation.composer` depends on DSH's slot chain contract (ascending priority, first non-empty select wins). If a DSH update changes that contract, turn off "Enable AI review" to immediately fall back to the native panel.
- The settings page depends on `ctx.configForms` provided by ui-settings; in client compositions with ui-settings disabled, the plugin will not intercept the approval panel.
- Review is triggered by the browser panel, so headless/no-UI scenarios do not have this review layer.
- LLM judgment can be wrong: this is an auxiliary layer against "blind approval", not a security guarantee.
- Custom prompts are sent to the review model together with the pending parameters; beware that they may contain sensitive content.
