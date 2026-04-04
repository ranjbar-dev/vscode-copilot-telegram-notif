# Plan: CopilotNotify — Phase 2 Enriched Notifications + Phase 3 Repo Foundation

**Branch:** `amirranjbar/feat/copilotnotify-telegram-notifications`  
**Date:** 2026-04-04 (revised; original Phase 1 plan: 2026-04-03)  
**Spec:** `specs/done/copilotnotify-telegram-notifications/spec.md`  
**Status:** Ready for task generation (Step 4) — Phase 2 + Phase 3 revision  
**Route:** related-revise (Phase 1 delivered; extending existing source files)

---

## Summary

Extend the delivered Phase 1 CopilotNotify VS Code extension with Phase 2 enriched notifications and feasible Phase 3 repository foundation work. No new TypeScript source modules are introduced; all changes are made in-place to the existing seven source files (`constants.ts`, `configManager.ts`, `notifier.ts`, `participant.ts`, `extension.ts`, `statusBar.ts`, `secretManager.ts`) plus build configuration.

**Phase 2 adds:**
- Carried defect fix: `tsconfig.json` missing `node` types and any conflicting local `fetch` declaration
- Four new user-configurable settings: `notifyOnSuccess`, `notifyOnFailure`, `cooldownSeconds`, `messageFormat` — declared in `package.json` and accessed via updated `configManager.ts` getters
- Extended notification payload: human-readable task duration (participant-turn wall-clock elapsed time), participant-scope outcome ("completed" / "cancelled")
- Outcome-based notification filtering and in-memory cooldown tracking in `notifier.ts`
- Start-time capture and cancellation-state reading in `participant.ts`; enriched metadata passed to notifier
- Version bump to `0.2.0`

**Phase 3 adds:** `README.md`, root `CHANGELOG.md`, `LICENSE`, `.github/workflows/ci.yml` (with Xvfb headless support for Ubuntu), and two GitHub issue templates. These are repository files, not TypeScript source.

**Critical architecture constraint (preserved from spec):** The extension does not passively monitor real Copilot agent tasks. Duration is the wall-clock elapsed time from participant-handler invocation to handler resolution only. Outcome is derived solely from `token.isCancellationRequested` at handler-resolution time. Both are participant-turn metadata — not internal Copilot job telemetry.

---

## Technical Context

| Concern | Decision |
|---|---|
| VS Code engine constraint | `>=1.90.0` — unchanged; minimum for stable public `vscode.chat` participant API |
| Activation event | `onStartupFinished` — unchanged |
| HTTP client | Built-in `fetch` — unchanged; no external HTTP library |
| Test framework | Mocha + `@vscode/test-electron` — unchanged |
| Build | `tsc -p ./` for type checking |
| TypeScript | `"strict": true`, `"target": "ES2020"`, `"module": "commonjs"` — unchanged |
| Runtime dependencies | Zero — unchanged |
| Dev dependencies | `@types/node` added to devDependencies; required for correct typing of `assert` and Node.js built-ins in test files |
| tsconfig `types` array | `"node"` added alongside `"vscode"` so test files referencing `assert` compile without error; no local `declare function fetch` that conflicts with built-in typing should remain |
| Version | Bumped from `0.1.0` → `0.2.0` in `package.json` |
| New source files | None — all Phase 2 work is additive edits to existing modules |
| Cooldown state | In-memory `lastDispatchedAt: number | undefined` field inside the `Notifier` implementation — not persisted; resets on extension host restart |

---

## Constitution Check

| Constitution Constraint | How This Plan Satisfies It |
|---|---|
| TypeScript strict mode | `tsconfig.json` remains `"strict": true`; `@types/node` addition does not relax strictness |
| Custom chat participant only | `participant.ts` still uses `vscode.chat.createChatParticipant`; no passive observation added; duration and outcome are handler-scoped metadata only |
| Duration = participant-turn elapsed time | Start timestamp captured at handler entry via `Date.now()`; elapsed computed at handler resolution; no LLM metadata, token count, or prompt content contributes |
| Outcome = participant-turn cancellation token only | `token.isCancellationRequested` at handler-resolution time; values are "completed" / "cancelled" only; no LLM quality or error-code derivation |
| Bot token in SecretStorage | `secretManager.ts` contract unchanged; no new token access paths introduced |
| Chat ID in workspace configuration | `configManager.ts` extended with new getters; storage mechanism unchanged |
| Native fetch only | `notifier.ts` additions use `fetch`; no new HTTP libraries |
| No backend | All HTTP goes directly to `api.telegram.org` — unchanged |
| No telemetry | No analytics calls introduced in any Phase 2 module |
| Privacy-safe message content | `"default"` format adds duration (wall-clock integer seconds), outcome string, and existing fields only; no prompt text, no code, no file names derived from prompts |
| No Phase 3+ settings in schema | `package.json` adds exactly the four Phase 2 settings; no future-phase keys added |

---

## Project Structure (Phase 2 + Phase 3 Target)

No new TypeScript source modules. Existing source tree unchanged; Phase 3 repo files added.

```
.
├── src/                                    ← no new files; all changes are in-place edits
│   ├── extension.ts          ← wiring changes; sendTest path compatible with revised Notifier
│   ├── participant.ts        ← start-time capture; outcome detection; metadata passing
│   ├── notifier.ts           ← extended payload, format variants, outcome filter, cooldown
│   ├── secretManager.ts      ← unchanged
│   ├── configManager.ts      ← 4 new getters for Phase 2 settings
│   ├── statusBar.ts          ← unchanged
│   └── constants.ts          ← new keys, outcome strings, format values, suppression messages
├── test/
│   └── suite/
│       ├── index.ts
│       ├── notifier.test.ts          ← updated for Phase 2 (format, filter, cooldown)
│       ├── secretManager.test.ts     ← unchanged
│       ├── configManager.test.ts     ← updated for 4 new getters
│       ├── statusBar.test.ts         ← unchanged
│       ├── wizard.test.ts            ← unchanged
│       └── participant.test.ts       ← updated for start-time and outcome metadata
├── .github/
│   ├── workflows/
│   │   └── ci.yml                    ← NEW: CI (compile / lint / test; Xvfb on ubuntu)
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md             ← NEW
│       └── feature_request.md        ← NEW
├── README.md                         ← NEW
├── CHANGELOG.md                      ← NEW (root; distinct from specs changelog)
├── LICENSE                           ← NEW (MIT)
├── package.json                      ← version 0.2.0; 4 new config contributions
├── tsconfig.json                     ← add "node" to types array; remove conflicting fetch decl
└── .vscodeignore
```

---

## Research Findings

*Phase 2 + Phase 3 research synthesized to drive all decisions below. Phase 1 findings from original plan remain valid and are not repeated in full.*

1. **tsconfig `node` types defect.** The Phase 1 codebase is missing `"node"` in the `compilerOptions.types` array, causing type errors for `assert` in test files. Fix: add `"node"` to the `types` array in `tsconfig.json`. Check whether a local `declare function fetch(...)` declaration in any source file (sometimes added to satisfy strict mode in early drafts) conflicts with the built-in `fetch` typing that comes with `@types/node` or lib settings; if it exists, remove it. The `@types/node` package must be present in `devDependencies`.

2. **Package.json config declarations are mandatory for VS Code defaults.** Settings read by `configManager.ts` that are not declared under `contributes.configuration` in `package.json` will return `undefined` instead of the intended default when no value is explicitly configured. All four Phase 2 settings must be registered. The correct JSON Schema types are: `boolean` for `notifyOnSuccess` / `notifyOnFailure`, `integer` for `cooldownSeconds`, `string` with `enum` for `messageFormat`.

3. **Cooldown tracking.** A module-level (inside the `Notifier` factory closure) `lastDispatchedAt: number | undefined` monotonic marker is sufficient. Reset it to `undefined` on factory creation. Advance it only when a Telegram HTTP request returns `response.ok === true`. Outcome-filter suppressions and cooldown-check suppressions must not advance the timer (spec FR-20, EC-18). The cooldown check reads `cooldownSeconds` from the config on every call (no caching) so live setting changes are honoured.

4. **Outcome detection.** `vscode.CancellationToken.isCancellationRequested` is a synchronous boolean property. Read it at the end of the participant handler (after response streaming resolves) to determine outcome. No async wait is required. Values map to constants: `OUTCOME_COMPLETED = "completed"`, `OUTCOME_CANCELLED = "cancelled"`. No other values are emitted.

5. **Duration computation.** `Date.now()` at handler entry (before any `await`) minus `Date.now()` at handler resolution gives elapsed milliseconds. Convert to whole seconds via `Math.floor(ms / 1000)`. Sub-second durations produce `0`; display as `"0s"` or `"< 1s"` per spec AS-07c. Duration is a plain integer — no floating point formatting needed. This is participant-turn wall-clock time only; it includes streaming latency and response transmission but nothing independent of the handler's own span.

6. **Message format variants.** `"default"` format: generic label + workspace name (or placeholder) + duration string + outcome string + ISO timestamp. `"minimal"` format: generic label + ISO timestamp only. Unrecognized value: fall back to `"default"`, log warning. `formatMessage` must remain a pure function that accepts `payload` and `format` arguments so it can be unit-tested without side effects.

7. **sendNotification contract extension.** The current `sendNotification(token, chatId)` signature must be extended to accept `NotificationTaskMetadata` (duration, outcome). Outcome-filter and cooldown checks execute inside `sendNotification` before dispatching. The test-notification path (`sendTest` command) passes a sentinel `isTest: true` flag or a dedicated `sendTestNotification` method that bypasses outcome filtering and cooldown (test notifications are not real participant turns). Both paths must remain backward-safe: a missing flag defaults to real-notification behaviour.

8. **CI headless test support on Ubuntu.** `@vscode/test-electron` launches a real VS Code window. On Linux CI runners without a display server, this requires Xvfb. The workflow must include `sudo apt-get install -y xvfb` and wrap the test step with `xvfb-run -a npm run test`. macOS and Windows runners do not require this. Using `ubuntu-latest` as the single target runner is acceptable for CI; macOS/Windows can be added later.

9. **participant.test.ts — new test file needed.** The Phase 1 test suite has `wizard.test.ts` but no dedicated `participant.test.ts` for the handler logic (the handler was thin in Phase 1). Phase 2 handler now carries meaningful logic (start-time capture, outcome read, metadata assembly). Add `participant.test.ts` covering: metadata construction when outcome is "completed", metadata construction when outcome is "cancelled", elapsed duration calculation for zero-ms and multi-second cases. `registerParticipant` is not directly testable; test the pure metadata-extraction helper that the handler delegates to.

---

## Configuration Schema

### Phase 1 (Delivered — unchanged)

| Key | Storage | Type | Default | Nullability | Uniqueness |
|---|---|---|---|---|---|
| `copilotNotify.botToken` | `vscode.SecretStorage` | `string` | — | nullable (absent until wizard runs) | per extension context |
| `copilotNotify.telegramChatId` | `settings.json` | `string` | `""` | empty string = not configured | 1 per workspace |
| `copilotNotify.enabled` | `settings.json` | `boolean` | `true` | non-null (VS Code provides default) | 1 per workspace |

### Phase 2 (New — must be declared in `package.json`)

| Key | Storage | Type | Default | Nullability | Uniqueness | Coercion |
|---|---|---|---|---|---|---|
| `copilotNotify.notifyOnSuccess` | `settings.json` | `boolean` | `true` | non-null (VS Code provides default) | 1 per workspace | `getBoolean` getter; no coercion needed |
| `copilotNotify.notifyOnFailure` | `settings.json` | `boolean` | `true` | non-null (VS Code provides default) | 1 per workspace | `getBoolean` getter; no coercion needed |
| `copilotNotify.cooldownSeconds` | `settings.json` | `integer` | `5` | non-null (VS Code provides default) | 1 per workspace | negative values → `0` (coerced in getter); fractional values floored |
| `copilotNotify.messageFormat` | `settings.json` | `"default" \| "minimal"` | `"default"` | non-null (VS Code provides default) | 1 per workspace | unrecognized string → `"default"` fallback + warning log |

**Cardinality:** one configuration set per VS Code workspace. Multi-workspace support is out of scope; `workspaceFolders[0]` used where folder name is needed.

---

## Commands (5 total — unchanged)

| Command ID | Title | Effect |
|---|---|---|
| `copilotNotify.configure` | CopilotNotify: Configure Telegram | Opens the setup wizard |
| `copilotNotify.enable` | CopilotNotify: Enable | Sets `copilotNotify.enabled` to `true` |
| `copilotNotify.disable` | CopilotNotify: Disable | Sets `copilotNotify.enabled` to `false` |
| `copilotNotify.sendTest` | CopilotNotify: Send Test Notification | Dispatches a test message; shows inline success/error |
| `copilotNotify.showLogs` | CopilotNotify: Show Logs | Calls `outputChannel.show()` |

---

## API / Interface Contracts

### `secretManager.ts` (unchanged)
```typescript
interface SecretManager {
  getToken(): Promise<string | undefined>;
  storeToken(token: string): Promise<void>;
}
// Factory: createSecretManager(secrets: vscode.SecretStorage): SecretManager
```

### `configManager.ts` (4 new read-only getters added)
```typescript
interface ConfigManager {
  // Phase 1 — unchanged
  getChatId(): string;
  getEnabled(): boolean;
  setChatId(value: string): Promise<void>;
  setEnabled(value: boolean): Promise<void>;
  // Phase 2 — new getters (read from configuration on every call; no caching)
  getNotifyOnSuccess(): boolean;    // default true; VS Code provides default
  getNotifyOnFailure(): boolean;    // default true; VS Code provides default
  getCooldownSeconds(): number;     // default 5; coerced: negative → 0; fractional → Math.floor
  getMessageFormat(): 'default' | 'minimal'; // unrecognized string → 'default' + warning log
}
// Factory: createConfigManager(outputChannel: vscode.OutputChannel): ConfigManager
// outputChannel needed for getMessageFormat() fallback warning log
```

### `notifier.ts` (extended payload, filtering, cooldown)
```typescript
interface NotificationTaskMetadata {
  readonly durationSeconds: number;   // non-negative integer; 0 for sub-second turns
  readonly outcome: 'completed' | 'cancelled';
}

interface NotificationPayload {
  readonly label: string;               // static constant
  readonly workspaceName: string | undefined;
  readonly timestamp: string;           // ISO 8601
  readonly durationSeconds?: number;    // present in 'default' format only
  readonly outcome?: 'completed' | 'cancelled'; // present in 'default' format only
}

type NotificationResult =
  | { readonly success: true }
  | { readonly success: false; readonly errorMessage: string };

interface Notifier {
  // Real participant turn — applies outcome filter and cooldown
  sendNotification(
    token: string,
    chatId: string,
    metadata: NotificationTaskMetadata
  ): Promise<NotificationResult>;
  // Test notification — bypasses outcome filter and cooldown; sends a fixed test message
  sendTestNotification(token: string, chatId: string): Promise<NotificationResult>;
  // Pure helpers — exported for unit tests
  buildPayload(metadata: NotificationTaskMetadata): NotificationPayload;
  formatMessage(payload: NotificationPayload, format: 'default' | 'minimal'): string;
}
// Factory: createNotifier(outputChannel: vscode.OutputChannel, config: ConfigManager): Notifier
// Cooldown state (lastDispatchedAt: number | undefined) is owned inside the factory closure
```

### `participant.ts` (start-time capture, outcome detection, metadata assembly)
```typescript
// Pure helper — testable without VS Code runtime:
function buildTaskMetadata(
  startTime: number,    // Date.now() at handler entry
  endTime: number,      // Date.now() at handler resolution
  token: vscode.CancellationToken
): NotificationTaskMetadata;
// Returns: { durationSeconds: Math.floor((endTime - startTime) / 1000), outcome: token.isCancellationRequested ? 'cancelled' : 'completed' }

// Wizard function unchanged:
async function runSetupWizard(
  secrets: SecretManager,
  config: ConfigManager
): Promise<'completed' | 'cancelled'>;

// Registration unchanged in signature; handler body extended:
function registerParticipant(
  context: vscode.ExtensionContext,
  notifier: Notifier,
  config: ConfigManager,
  secrets: SecretManager,
  outputChannel: vscode.OutputChannel
): vscode.Disposable;
// Handler now: captures startTime = Date.now() at entry, reads token.isCancellationRequested
// at resolution, calls buildTaskMetadata, passes metadata to sendNotification
```

### `statusBar.ts` (unchanged)
```typescript
type StatusBarState = 'ON' | 'OFF' | 'NOT_CONFIGURED';
interface StatusBarManager {
  update(state: StatusBarState): void;
  dispose(): void;
}
```

### `extension.ts` (updated factory call + sendTest path)
```typescript
export function activate(context: vscode.ExtensionContext): void;
export function deactivate(): void;
// Changes:
//   createNotifier now receives (outputChannel, configManager)
//   createConfigManager now receives (outputChannel) for format-fallback warning
//   sendTest command calls notifier.sendTestNotification(token, chatId) [not sendNotification]
//   Missing warning strings for sendTest moved to constants.ts (no inline string literals)
```

---

## File-Level Change Map (Dependency Order)

All changes are additive edits or targeted extensions to existing files. Ordering below ensures each file's dependencies are satisfied before it is touched.

---

### Step 1 — Build Configuration (no source dependencies)

**`tsconfig.json`**  
- Add `"node"` to `compilerOptions.types` (alongside `"vscode"` if present, or as `["node"]` if absent).
- If any source file contains a standalone `declare function fetch(...)` or `declare const fetch: ...` that was added to satisfy strict-mode before built-in `fetch` was recognized, remove it. The `"lib"` settings plus `@types/node` provide the correct typing.
- Verify `devDependencies` in `package.json` includes `"@types/node"`.

**`package.json`**  
- Bump `"version"` from `"0.1.0"` to `"0.2.0"`.
- Add `"@types/node"` to `devDependencies` if absent (version compatible with current TypeScript target).
- Add four entries to `contributes.configuration.properties`:
  ```jsonc
  "copilotNotify.notifyOnSuccess": { "type": "boolean", "default": true, "description": "Send notification when the participant turn completes normally." },
  "copilotNotify.notifyOnFailure": { "type": "boolean", "default": true, "description": "Send notification when the participant turn is cancelled." },
  "copilotNotify.cooldownSeconds": { "type": "integer", "default": 5, "minimum": 0, "description": "Minimum seconds between notifications. Set to 0 to disable cooldown." },
  "copilotNotify.messageFormat": { "type": "string", "enum": ["default", "minimal"], "default": "default", "description": "Notification verbosity. 'default' includes duration and outcome; 'minimal' includes only label and timestamp." }
  ```

---

### Step 2 — Foundation Layer (no inter-module dependencies)

**`src/constants.ts`**  
Add the following constant groups (no removals from Phase 1 constants):
- Config key constants: `CONFIG_NOTIFY_ON_SUCCESS`, `CONFIG_NOTIFY_ON_FAILURE`, `CONFIG_COOLDOWN_SECONDS`, `CONFIG_MESSAGE_FORMAT`
- Outcome strings: `OUTCOME_COMPLETED = 'completed'`, `OUTCOME_CANCELLED = 'cancelled'`
- Message format strings: `FORMAT_DEFAULT = 'default'`, `FORMAT_MINIMAL = 'minimal'`
- Suppression log messages: `SUPPRESSED_OUTCOME_SUCCESS` (e.g., `"[CopilotNotify] Notification suppressed — notifyOnSuccess is false"`), `SUPPRESSED_OUTCOME_FAILURE`, `SUPPRESSED_COOLDOWN` (e.g., `"[CopilotNotify] Notification suppressed — cooldown active (Xs remaining)"`)
- Format fallback warning: `WARN_UNKNOWN_FORMAT` (e.g., `"[CopilotNotify] Unknown messageFormat value; falling back to 'default'"`)
- Test notification missing credential warnings (move any inline strings in extension.ts into constants): `WARN_MISSING_BOT_TOKEN`, `WARN_MISSING_CHAT_ID` if not already present

---

### Step 3 — ConfigManager (depends on constants.ts)

**`src/configManager.ts`**  
Add four getters to the existing `ConfigManager` implementation (factory pattern; no class refactor):
- `getNotifyOnSuccess()`: `config.get<boolean>(CONFIG_NOTIFY_ON_SUCCESS, true)`
- `getNotifyOnFailure()`: `config.get<boolean>(CONFIG_NOTIFY_ON_FAILURE, true)`
- `getCooldownSeconds()`: `Math.max(0, Math.floor(config.get<number>(CONFIG_COOLDOWN_SECONDS, 5)))` — coerces negative and fractional values
- `getMessageFormat()`: read raw value; if not `'default'` or `'minimal'`, log `WARN_UNKNOWN_FORMAT` to outputChannel, return `'default'`; factory now accepts `outputChannel` parameter for this warning

Update factory signature: `createConfigManager(outputChannel: vscode.OutputChannel): ConfigManager`

---

### Step 4 — Notifier (depends on constants.ts, configManager.ts)

**`src/notifier.ts`**  
This is the most substantial Phase 2 change. Key additions:
- Add `lastDispatchedAt: number | undefined` to the factory closure (initialized to `undefined`)
- Extend `NotificationPayload` type to include optional `durationSeconds` and `outcome` fields
- Add `buildTaskMetadata` import or inline the parameter pattern; `buildPayload` now accepts `NotificationTaskMetadata` and populates duration/outcome fields when present
- Update `formatMessage(payload, format)` — pure function accepting two arguments:
  - `'default'`: `🔔 Copilot task finished\nWorkspace: <name>\nDuration: <N>s\nOutcome: <outcome>\n<timestamp>`
  - `'minimal'`: `🔔 Copilot task finished\n<timestamp>`
  - If workspace name is absent: omit workspace line regardless of format
- Rename `sendNotification(token, chatId)` → `sendNotification(token, chatId, metadata: NotificationTaskMetadata)`:
  1. Read `notifyOnSuccess`, `notifyOnFailure` from config
  2. Check outcome filter: if `outcome === 'completed'` and `!notifyOnSuccess` → log `SUPPRESSED_OUTCOME_SUCCESS`, return `{ success: true }` (suppression is not an error)
  3. Check outcome filter: if `outcome === 'cancelled'` and `!notifyOnFailure` → log `SUPPRESSED_OUTCOME_FAILURE`, return `{ success: true }`
  4. Read `cooldownSeconds` from config; if `cooldownSeconds > 0` and `lastDispatchedAt` is set and `(Date.now() - lastDispatchedAt) / 1000 < cooldownSeconds` → log `SUPPRESSED_COOLDOWN` with remaining seconds, return `{ success: true }`
  5. Read `messageFormat` from config
  6. Build payload via `buildPayload(metadata)`; format via `formatMessage(payload, format)`
  7. Dispatch `fetch` POST to Telegram
  8. On `response.ok`: set `lastDispatchedAt = Date.now()`; return `{ success: true }`
  9. On error: return `{ success: false, errorMessage }` (cooldown timer NOT advanced on error)
- Add `sendTestNotification(token, chatId)` — builds a fixed generic test message string; calls `fetch` directly without reading outcome filter or cooldown; does not advance `lastDispatchedAt`
- Factory signature: `createNotifier(outputChannel: vscode.OutputChannel, config: ConfigManager): Notifier`

---

### Step 5 — Participant (depends on constants.ts, notifier.ts, configManager.ts)

**`src/participant.ts`**  
Targeted handler body changes only; wizard logic and `registerParticipant` signature unchanged:
- Export `buildTaskMetadata(startTime: number, endTime: number, token: vscode.CancellationToken): NotificationTaskMetadata` as a pure, testable helper
- Inside the participant handler:
  - Capture `const startTime = Date.now()` as first line of handler body (before any `await`)
  - After streaming resolves: `const endTime = Date.now()`; read `token.isCancellationRequested`
  - Call `const metadata = buildTaskMetadata(startTime, endTime, token)` before dispatching
  - Pass `metadata` to `void notifier.sendNotification(token, chatId, metadata).then(...)`

---

### Step 6 — Extension Wiring (depends on all modules)

**`src/extension.ts`**  
Minimal wiring changes only:
- Update `createNotifier(...)` call site to pass `configManager` as second argument
- Update `createConfigManager(...)` call site to pass `outputChannel`
- Update `copilotNotify.sendTest` command handler to call `notifier.sendTestNotification(token, chatId)` instead of `notifier.sendNotification(token, chatId)` (no metadata argument needed for test)
- Ensure any inline warning strings in the `sendTest` handler (for missing token/chatId) are replaced with constants from `constants.ts` if not already

---

### Step 7 — Tests (depends on all source modules)

**`test/suite/configManager.test.ts`** — extend with 4 new getter cases:
- `getNotifyOnSuccess` default `true`; explicit `false` value
- `getNotifyOnFailure` default `true`; explicit `false` value
- `getCooldownSeconds` default `5`; negative value → coerced to `0`; fractional → floored
- `getMessageFormat` `'default'`; `'minimal'`; unrecognized → `'default'` + warning logged

**`test/suite/notifier.test.ts`** — extend with Phase 2 cases:
- `buildPayload` with metadata returns enriched payload
- `formatMessage(payload, 'default')` includes duration/outcome/workspace/timestamp
- `formatMessage(payload, 'minimal')` includes only label/timestamp
- `sendNotification` with `notifyOnSuccess: false` and `outcome: 'completed'` → suppressed (no fetch call)
- `sendNotification` with `notifyOnFailure: false` and `outcome: 'cancelled'` → suppressed
- `sendNotification` cooldown: second call within window → suppressed; call after window → dispatched
- `sendNotification` cooldown timer NOT advanced when Telegram returns error
- `sendNotification` cooldown timer NOT advanced on outcome-filter suppression
- `sendTestNotification` bypasses outcome filter and cooldown; dispatches fetch

**`test/suite/participant.test.ts`** — new file (covers Phase 2 handler logic):
- `buildTaskMetadata(start, end, token)` with `isCancellationRequested: false` → `outcome: 'completed'`
- `buildTaskMetadata(start, end, token)` with `isCancellationRequested: true` → `outcome: 'cancelled'`
- `buildTaskMetadata` with 0ms elapsed → `durationSeconds: 0`
- `buildTaskMetadata` with 1500ms elapsed → `durationSeconds: 1`

**`test/suite/wizard.test.ts`** — unchanged  
**`test/suite/secretManager.test.ts`** — unchanged  
**`test/suite/statusBar.test.ts`** — unchanged

---

## Data Flow (Phase 2)

```
User types @copilotnotify in Chat panel
        │
        ▼
VS Code Chat engine calls participant handler (request, ctx, response, token)
        │
        ├── startTime = Date.now()   ← captured BEFORE any await
        │
        ▼
participant.ts: streams response.markdown(...) to Chat panel  ← user sees response
        │
        ▼  (handler async resolves — streaming complete)
        │
        ├── endTime = Date.now()
        ├── metadata = buildTaskMetadata(startTime, endTime, token)
        │     durationSeconds = Math.floor((endTime - startTime) / 1000)
        │     outcome = token.isCancellationRequested ? 'cancelled' : 'completed'
        │
        ├── config.getEnabled() == false? → silent return
        │
        ├── await secrets.getToken() == undefined? → log "token not configured" → return
        │
        ├── config.getChatId() == ""? → log "chatId not configured" → return
        │
        ▼
void notifier.sendNotification(token, chatId, metadata)
        │
        ├── outcome == 'completed' && !notifyOnSuccess? → log SUPPRESSED_OUTCOME_SUCCESS → return { success: true }
        │
        ├── outcome == 'cancelled' && !notifyOnFailure? → log SUPPRESSED_OUTCOME_FAILURE → return { success: true }
        │
        ├── cooldownSeconds > 0 && lastDispatchedAt && (now - lastDispatchedAt)/1000 < cooldown?
        │       → log SUPPRESSED_COOLDOWN → return { success: true }
        │
        ▼
notifier.buildPayload(metadata) → { label, workspaceName, timestamp, durationSeconds, outcome }
notifier.formatMessage(payload, format)
        ├── 'default': "🔔 Copilot task finished\nWorkspace: foo\nDuration: 12s\nOutcome: completed\n2026-04-04T..."
        └── 'minimal': "🔔 Copilot task finished\n2026-04-04T..."
        │
        ▼
fetch POST https://api.telegram.org/bot<TOKEN>/sendMessage
  body: { chat_id: chatId, text: message }   ← plain text; no parse_mode
        │
        ├── response.ok == true → lastDispatchedAt = Date.now() → return { success: true }
        │
        └── response.ok == false OR fetch rejection
              → log HTTP status + description (no token, no chatId)
              → return { success: false, errorMessage }
              → lastDispatchedAt NOT advanced
```

---

## Error Handling Plan

| Error Scenario | Handler Location | Action |
|---|---|---|
| Wizard: empty/whitespace token | `participant.ts` validateInput | Inline InputBox error string; no advance |
| Wizard: user cancels at token | `participant.ts` | Return `'cancelled'`; no storage writes |
| Wizard: user cancels at chatId | `participant.ts` | Return `'cancelled'`; no storage writes |
| Wizard: second write (token) failure | `participant.ts` | Rollback chatId; re-throw; caller logs and shows VS Code error notification |
| Notification: not configured | `participant.ts` handler | Log to Output Channel; silent return |
| Notification: disabled | `participant.ts` handler | Silent return |
| Notification: outcome filter suppression | `notifier.ts` | Log suppression reason to Output Channel; return `{ success: true }` (not an error) |
| Notification: cooldown suppression | `notifier.ts` | Log suppression with remaining seconds; return `{ success: true }` |
| Notification: both filters off simultaneously | `notifier.ts` | Both outcome checks fire in sequence; first matching check suppresses; result is `{ success: true }` |
| Notification: Telegram API error (4xx/5xx) | `notifier.ts` | Log HTTP status + `description`; return `{ success: false, errorMessage }` |
| Notification: network offline / fetch rejection | `notifier.ts` | Log error message; return `{ success: false, errorMessage }` |
| Notification: response JSON parse failure | `notifier.ts` | Return `{ success: false, errorMessage: "Telegram error <status>" }` |
| Test notification: token or chatId absent | `extension.ts` command | `showWarningMessage` with constant string naming missing credential(s); no network call |
| Test notification: `NotificationResult.success === false` | `extension.ts` command | `showWarningMessage(result.errorMessage)` |
| `messageFormat` unrecognized | `configManager.ts` getter | Log `WARN_UNKNOWN_FORMAT`; return `'default'` |
| `cooldownSeconds` negative | `configManager.ts` getter | Coerce to `0`; no log |

**Safe error logging contract (unchanged):**  
`notifier.ts` must log: `[CopilotNotify] Telegram error — status: <HTTP_STATUS>, description: <TELEGRAM_DESCRIPTION>`.  
Must NOT log: token, chatId, request body, or any user workspace content.

**Suppression logging contract:**  
Suppression log entries must be formatted using the named constants from `constants.ts` and must not include token, chatId, or any payload content beyond the reason name and (for cooldown) an integer seconds value.

---

## Test Strategy

### Extractable Pure Logic (high test value)

| Function | Module | Why |
|---|---|---|
| `buildTaskMetadata(start, end, token)` | `participant.ts` | Pure; test duration calculation and outcome mapping |
| `buildPayload(metadata)` | `notifier.ts` | Pure; test enriched payload construction |
| `formatMessage(payload, format)` | `notifier.ts` | Pure; test both format variants and missing workspace |
| `getCooldownSeconds()` | `configManager.ts` | Coercion logic for negative/fractional values |
| `getMessageFormat()` | `configManager.ts` | Fallback logic for unrecognized strings |
| `runSetupWizard(secrets, config)` | `participant.ts` | Accepts injected stubs; no live UI |
| `StatusBarManager.update(state)` | `statusBar.ts` | State machine; text/command per state |

### Coverage Path to 80%

| Module | Test Cases to Add (Phase 2) |
|---|---|
| `constants.ts` | Passively covered by imports |
| `configManager.ts` | 4 new getter cases × 2–3 branches each (normal, coerced, fallback) |
| `notifier.ts` | Phase 2 branches: outcome filter ×2, cooldown (in-window, out-of-window), error-no-advance, `sendTestNotification` path, both format variants |
| `participant.ts` | `buildTaskMetadata`: 4 cases (two outcomes × two duration ranges) |

### Cooldown Timer Advancement Rules (must be verified in tests)

1. Timer advances only when `response.ok === true`.
2. Timer does NOT advance when Telegram returns an error.
3. Timer does NOT advance when notification is suppressed by outcome filter.
4. Timer does NOT advance when notification is already suppressed by cooldown.
5. A second call after the cooldown window has elapsed dispatches normally and resets the timer.

### Mock Strategy

- `vscode.SecretStorage`: in-memory `Map`-backed mock — unchanged
- `vscode.workspace.getConfiguration`: stub returning configurable values — extended for 4 new settings
- `fetch`: replaced with a simple async function returning mock `Response` — extended for test-notification path
- `vscode.window.showInputBox`: stub sequence — unchanged
- `vscode.window.createOutputChannel`: no-op channel object — unchanged
- `vscode.CancellationToken`: plain object with `isCancellationRequested: boolean` property — new for participant tests

---

## Alternatives Considered

### 1. Passive Copilot observation (Phase 1 — unchanged)
Listen to internal Copilot events (e.g., `github.copilot.edits.taskCompleted`) to fire notifications without requiring `@copilotnotify` invocation.  
**Rejected:** No stable public API exists (C-02). Using internal/unstable events violates the constitution and would break silently on Copilot updates.

### 2. `onActivate` instead of `onStartupFinished` (Phase 1 — unchanged)
**Rejected:** `onStartupFinished` is simpler and ensures the participant is ready without over-eager activation.

### 3. Cache SecretStorage token in memory after first read (Phase 1 — unchanged)
**Rejected:** Violates the constitution's "never cache secrets beyond the active request" principle and would miss mid-session token changes (EC-03).

### 4. Declaring `notifyOnSuccess` / `notifyOnFailure` as disabled Phase 1 settings (Phase 1 — unchanged)
**Rejected:** Any Phase 2+ key in the Phase 1 schema violates the constitution's active-scope restriction and creates confusion.

### 5. New `enrichedNotifier.ts` module for Phase 2 (Phase 2)
Extract all Phase 2 filtering and cooldown logic into a new wrapper module around the existing `notifier.ts`.  
**Rejected:** Creates artificial module boundary for what is logically a single dispatch concern. The spec mandates no new source modules; extending the existing `notifier.ts` factory keeps all notification logic co-located and the contract changes are backward-safe.

### 6. Persist cooldown state across VS Code restarts (Phase 2)
Store `lastDispatchedAt` in `workspace.getConfiguration` or a global state key so cooldown survives extension reload.  
**Rejected:** Cooldown is a transient UX guard, not a durable setting. Persisting it adds complexity and a write on every notification dispatch. In-memory state resets cleanly on reload, matching user expectation that a fresh VS Code window starts with a clean notification slate (spec EC-17).

### 7. Duration in milliseconds or sub-second precision (Phase 2)
Emit duration as a floating-point seconds value (e.g., `"1.23s"`) or in milliseconds.  
**Rejected:** Integer seconds are sufficient for user-facing UX. Sub-second precision implies measurement accuracy the participant-turn wall-clock does not provide (latency, GC pauses, and streaming jitter affect the value). Whole seconds keep the message readable.

---

## Package.json Manifest Changes (Phase 2 delta)

```jsonc
{
  "version": "0.2.0",   // bumped from 0.1.0
  "contributes": {
    "configuration": {
      "properties": {
        // --- Phase 1 properties unchanged ---
        "copilotNotify.enabled": { "type": "boolean", "default": true, "description": "..." },
        "copilotNotify.telegramChatId": { "type": "string", "default": "", "description": "..." },
        // --- Phase 2 additions ---
        "copilotNotify.notifyOnSuccess": {
          "type": "boolean",
          "default": true,
          "description": "Send a Telegram notification when the participant turn completes normally (not cancelled)."
        },
        "copilotNotify.notifyOnFailure": {
          "type": "boolean",
          "default": true,
          "description": "Send a Telegram notification when the participant turn is cancelled."
        },
        "copilotNotify.cooldownSeconds": {
          "type": "integer",
          "default": 5,
          "minimum": 0,
          "description": "Minimum seconds between dispatched notifications. Set to 0 to disable cooldown."
        },
        "copilotNotify.messageFormat": {
          "type": "string",
          "enum": ["default", "minimal"],
          "default": "default",
          "description": "Notification verbosity. 'default' includes duration and outcome; 'minimal' includes only label and timestamp."
        }
      }
    }
  }
}
```

---

## Phase 3 Plan — Repository Foundation

Phase 3 artifacts are repository files with no TypeScript source dependencies. They can be authored in parallel with or after Phase 2 code changes. All files are new (absent from the current repository at planning time).

### `README.md` (repository root)

Required sections (spec FR-26, US-12):
1. Project header — name, one-line description, status badge placeholder
2. What is CopilotNotify — explanation of participant-scope detection (not passive Copilot monitoring); the user must invoke `@copilotnotify` explicitly
3. Prerequisites — VS Code ≥1.90.0, Telegram account, @BotFather bot creation steps, chat ID retrieval method
4. Installation / build — `npm install`, `npm run compile`, F5 to launch Extension Development Host
5. Usage walkthrough — configure → enable → invoke participant → receive notification
6. Configuration reference — table covering all Phase 1 + Phase 2 settings with types, defaults, and descriptions
7. Known limitations — static label; participant-scope only; single channel; cooldown is in-memory

### `CHANGELOG.md` (repository root)

Keep a Changelog format (spec FR-27, US-13). Minimum entries:

```markdown
## [0.2.0] — 2026-04-04
### Added
- Task duration (participant-turn elapsed time) in default-format notifications
- Outcome label (completed / cancelled) based on VS Code cancellation token
- notifyOnSuccess, notifyOnFailure, cooldownSeconds, messageFormat settings
- README, root CHANGELOG, LICENSE, CI workflow, GitHub issue templates

### Fixed
- tsconfig.json missing node types (DF-01)

## [0.1.0] — 2026-04-03
### Added
- Initial extension scaffold with TypeScript strict mode
- Telegram setup wizard (bot token password-masked, SecretStorage)
- Custom @copilotnotify chat participant
- Notification on participant-turn completion (label + workspace + timestamp)
- Enable / Disable commands, status bar indicator, Show Logs command
- Send Test Notification command
```

### `LICENSE` (repository root)

MIT license text. Year: 2026. Author: Amir Ranjbar / devbehkami (matches `package.json` publisher).

### `.github/workflows/ci.yml`

Triggers: `push` and `pull_request` to `main` (or default branch).  
Single job: `build-and-test` on `ubuntu-latest`.

Steps (in order):
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: '20'` and `cache: 'npm'`
3. `npm ci`
4. `npm run compile`
5. `npm run lint`
6. `sudo apt-get update && sudo apt-get install -y xvfb` — required for `@vscode/test-electron` on headless Linux
7. `xvfb-run -a npm run test` — runs the full Mocha suite in a virtual display

**Note on Xvfb:** `@vscode/test-electron` spawns a full VS Code Electron window. On Ubuntu CI runners with no display server, the process exits with a display error without Xvfb. `xvfb-run -a` provides a virtual framebuffer. This is the standard headless pattern for VS Code extension CI.

### `.github/ISSUE_TEMPLATE/bug_report.md`

Required fields (spec US-16):
- VS Code version
- CopilotNotify extension version
- OS and version
- Steps to reproduce
- Expected behavior
- Actual behavior

### `.github/ISSUE_TEMPLATE/feature_request.md`

Required fields (spec US-16):
- Problem statement (what problem does this solve?)
- Proposed solution
- Alternatives considered

---

## Verification Strategy

| Verification step | Command / method | Pass condition |
|---|---|---|
| tsconfig fix | `npm run compile` | Zero TypeScript errors including test files |
| Phase 2 settings exist in manifest | Inspect `package.json` | 4 new properties under `contributes.configuration.properties` |
| Unit tests pass | `npm run test` | All Mocha assertions green; no timeout failures |
| Coverage ≥ 80% | Coverage report from test run | ≥ 80% across measured modules |
| Lint | `npm run lint` | Zero ESLint errors |
| Packaging | `vsce package` | Exits 0; produces `.vsix` |
| Phase 1 regression | Re-run full test suite post-Phase-2 edits | Zero regressions; all Phase 1 test cases still pass |
| CI workflow syntax | Push branch to remote | Workflow triggers and completes without error |
| README completeness | Manual review | All required sections present; no TODO markers |
| CHANGELOG format | Manual review | Keep a Changelog format; v0.1.0 and v0.2.0 entries present |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Duration is meaningless for very short turns | Certain | Low | `Math.floor` produces 0 for sub-second; display `"0s"` per spec; no negative values possible |
| Duration is misread as Copilot LLM compute time | Medium | Low | Keep the plan note and README known-limitations section explicit: duration is participant-handler wall-clock time only, not LLM processing time |
| `@types/node` version conflict with existing devDependencies | Low | Medium | Pin to a `@types/node` version compatible with TypeScript target (`ES2020`/`commonjs`); `@types/node@20` is safe |
| Xvfb step fails on different ubuntu runner version | Low | Medium | `apt-get install xvfb` is available on all current ubuntu-{20,22,24}-latest runners; `xvfb-run -a` uses auto display number to avoid conflicts |
| `sendNotification` contract change breaks extension.ts call site | Low | High | Step 6 explicitly updates the sendTest command path; TypeScript strict mode + compile verification will surface any missed call sites at compile time |
| `messageFormat` enum addition to `package.json` doesn't show in Settings UI | Low | Medium | Registration in `contributes.configuration` with `enum` and `default` is mandatory (spec FR-31); verified by `package.json` inspection in the checklist |
| Phase 1 wizard tests broken by `createConfigManager` signature change | Low | Medium | Wizard tests inject stubs; the added `outputChannel` parameter uses a no-op stub already in the test strategy |

---

## Implementation Checklist (for Step 4 Task Generation)

### Phase 2 — Build Configuration
- [ ] P2-A1: `tsconfig.json` — add `"node"` to types array; remove conflicting local fetch declaration if present
- [ ] P2-A2: `package.json` — bump version to `0.2.0`; add `@types/node` to devDependencies; add 4 new config contributions

### Phase 2 — Foundation Layer
- [ ] P2-B1: `src/constants.ts` — add config key constants, outcome strings, format strings, suppression messages, format fallback warning

### Phase 2 — ConfigManager
- [ ] P2-C1: `src/configManager.ts` — add 4 new getters with coercion/fallback; update factory signature to accept `outputChannel`
- [ ] P2-C2: `test/suite/configManager.test.ts` — extend with 4 new getter test cases

### Phase 2 — Notifier
- [ ] P2-D1: `src/notifier.ts` — extend payload types; update `buildPayload`, `formatMessage`; extend `sendNotification` with metadata param, outcome filter, cooldown; add `sendTestNotification`; update factory signature
- [ ] P2-D2: `test/suite/notifier.test.ts` — extend with Phase 2 cases (format variants, outcome filter, cooldown rules, test-notification path)

### Phase 2 — Participant
- [ ] P2-E1: `src/participant.ts` — export `buildTaskMetadata`; update handler to capture start time, compute metadata, pass to notifier
- [ ] P2-E2: `test/suite/participant.test.ts` — new file; 4 cases for `buildTaskMetadata`

### Phase 2 — Extension Wiring
- [ ] P2-F1: `src/extension.ts` — update factory call sites; update sendTest handler to use `sendTestNotification`; move remaining inline strings to constants

### Phase 2 — Verification
- [ ] P2-G1: `npm run compile` exits 0 with zero errors
- [ ] P2-G2: `npm run test` passes; coverage ≥ 80%
- [ ] P2-G3: `npm run lint` exits 0
- [ ] P2-G4: `vsce package` exits 0

### Phase 3 — Repository Foundation
- [ ] P3-A1: `README.md` — all required sections including configuration reference for Phase 1 + Phase 2 settings
- [ ] P3-A2: `CHANGELOG.md` (root) — Keep a Changelog format; v0.1.0 and v0.2.0 entries
- [ ] P3-A3: `LICENSE` — MIT; year 2026; correct author
- [ ] P3-A4: `.github/workflows/ci.yml` — push/PR trigger; compile + lint + Xvfb + test steps
- [ ] P3-A5: `.github/ISSUE_TEMPLATE/bug_report.md` — all required fields
- [ ] P3-A6: `.github/ISSUE_TEMPLATE/feature_request.md` — all required fields
