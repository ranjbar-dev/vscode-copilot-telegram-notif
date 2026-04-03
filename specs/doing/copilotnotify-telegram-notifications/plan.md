# Plan: CopilotNotify — Telegram Notifications (Phase 1 MVP)

**Branch:** `amirranjbar/feat/copilotnotify-telegram-notifications`  
**Date:** 2026-04-03  
**Spec:** `specs/queue/copilotnotify-telegram-notifications/spec.md`  
**Status:** Ready for task generation (Step 4)

---

## Summary

Implement the CopilotNotify VS Code extension from scratch. The extension registers a custom chat participant (`@copilotnotify`). When the participant handler resolves after streaming its response, a Telegram push notification is dispatched via native `fetch`. Bot token is stored in `vscode.SecretStorage`; chat ID and the enabled flag live in workspace configuration. A setup wizard, enable/disable commands, a test-notification command, a status bar indicator, and an Output Channel log complete the Phase 1 surface.

---

## Technical Context

| Concern | Decision |
|---|---|
| VS Code engine constraint | `>=1.90.0` — minimum for the stable public `vscode.chat` participant API |
| Activation event | `onStartupFinished` — avoids eager activation cost; participant is ready before the user opens Chat |
| HTTP client | Built-in `fetch` (available in VS Code extension host ≥1.90.0); no external HTTP library |
| Test framework | Mocha + `@vscode/test-electron` (VS Code standard) |
| Build | `tsc -p ./` for type checking; `esbuild` or `vsce package` for bundling |
| TypeScript | `"strict": true`, `"target": "ES2020"`, `"module": "commonjs"` |
| Runtime dependencies | Zero. Only `vscode` (peer) and built-in Node globals |
| Dev dependencies | `typescript`, `@types/vscode`, `@vscode/test-electron`, `mocha`, `@types/mocha`, `esbuild` (or `webpack`), `eslint`, `@typescript-eslint/eslint-plugin` |

---

## Constitution Check

| Constitution Constraint | How This Plan Satisfies It |
|---|---|
| TypeScript strict mode | `tsconfig.json` sets `"strict": true`; no `any` in any module |
| Custom chat participant only | `participant.ts` uses `vscode.chat.createChatParticipant`; no passive observation |
| Bot token in SecretStorage | `secretManager.ts` is the only code that touches SecretStorage; token never appears in settings |
| Chat ID in workspace configuration | `configManager.ts` reads/writes `copilotNotify.telegramChatId` |
| Native fetch only | `notifier.ts` uses `fetch`; no `axios`, no `node-fetch` |
| No backend | All HTTP goes directly to `api.telegram.org` |
| No telemetry | No analytics calls anywhere |
| Generic label only | `notifier.ts` builds payload from `constants.ts` label + workspace name + timestamp only |
| Privacy-first | Wizard, participant, and notifier never access prompt text, code, or file content |
| No Phase 2 settings | `package.json` declares exactly 3 contribution settings; no `notifyOnSuccess`, `notifyOnFailure`, `cooldownSeconds`, `messageFormat`, or `includeTaskSummary` |

---

## Project Structure (Target)

```
.
├── src/
│   ├── extension.ts          ← activate() / deactivate() entry point
│   ├── participant.ts        ← chat participant registration + setup wizard
│   ├── notifier.ts           ← Telegram dispatch + payload builder
│   ├── secretManager.ts      ← SecretStorage wrapper (bot token)
│   ├── configManager.ts      ← workspace configuration wrapper
│   ├── statusBar.ts          ← status bar item lifecycle and state machine
│   └── constants.ts          ← all named string constants
├── test/
│   └── suite/
│       ├── index.ts           ← Mocha root suite loader
│       ├── notifier.test.ts
│       ├── secretManager.test.ts
│       ├── configManager.test.ts
│       ├── statusBar.test.ts
│       └── wizard.test.ts     ← tests for extracted wizard logic
├── .vscode/
│   └── launch.json            ← extension debug configuration
├── .vscodeignore
├── package.json
├── tsconfig.json
└── .eslintrc.json
```

---

## Research Findings

*Synthesised from Step 3 research; drives all decisions below.*

1. **Chat participant API (≥1.90.0):** `vscode.chat.createChatParticipant(id, handler)` returns a `ChatParticipant` disposable. `id` must match `contributes.chatParticipants[].id` in `package.json`. The handler signature is `(request, context, response, token) => Thenable<void>`. Notification dispatch happens after `await`ing any response streaming inside the handler — the handler's returned promise resolving is the task-completion boundary.

2. **package.json manifest requirements:**
   - `"engines": { "vscode": ">=1.90.0" }`
   - `"activationEvents": ["onStartupFinished"]`
   - `"contributes.chatParticipants"`: one entry with `"id": "copilotnotify"`, `"name": "copilotnotify"`, `"description": "..."`, `"isSticky": false`
   - `"contributes.commands"`: exactly 5 entries (see §Commands below)
   - `"contributes.configuration"`: exactly 3 settings (`copilotNotify.enabled`, `copilotNotify.telegramChatId`; bot token is NOT a declared contribution — it lives only in SecretStorage)

   > Note: only 2 settings appear in `contributes.configuration` because `botToken` is SecretStorage-only. The research phrasing "3 settings" referred to the total config surface; the manifest will have 2 `configuration` contributions.

3. **Notification dispatch timing:** The participant handler is `async`. After all `response.markdown(...)` / `response.stream(...)` calls, `await notifier.sendNotification(...)` is called as a fire-and-forget (not awaited by the participant return) or with a `void` cast so VS Code is not blocked on Telegram round-trip.

4. **SecretStorage:** `context.secrets.get(key)` and `context.secrets.store(key, value)` are async. The `ExtensionContext` must be passed to `secretManager` at initialisation time.

5. **Output Channel:** Created once in `extension.ts` (or `constants.ts`-driven) via `vscode.window.createOutputChannel(CHANNEL_NAME)` and shared via module-level singleton or passed by reference to all modules that log.

6. **Wizard atomicity:** Collect both values (token string, chatId string) in memory first. Write chatId to configuration _then_ token to SecretStorage only after both inputs are confirmed. If the user cancels at either `showInputBox`, return early without touching any storage.

7. **Telegram error logging:** Log the HTTP status code and the `description` field from the Telegram API response JSON. Do NOT log the bot token or the chatId. The `description` field is Telegram server-generated text unrelated to user data — safe to log.

8. **Workspace name as safe metadata:** `vscode.workspace.workspaceFolders?.[0]?.name` is a VS Code environment property. It reflects the folder name chosen by the user for their workspace — it is not derived from prompt text, code content, or file contents. Including it in the notification payload is explicitly safe under the constitution's privacy requirement.

---

## Configuration Schema (Phase 1)

| Key | Storage | Type | Default | Nullability | Unique |
|---|---|---|---|---|---|
| `copilotNotify.botToken` | `vscode.SecretStorage` | `string` | — | nullable (absent until wizard runs) | per extension context |
| `copilotNotify.telegramChatId` | `settings.json` | `string` | `""` | empty string = not configured | 1 per workspace |
| `copilotNotify.enabled` | `settings.json` | `boolean` | `true` | non-null (VS Code provides default) | 1 per workspace |

**Cardinality:** one configuration triple per VS Code workspace. Multi-workspace support (multiple `workspaceFolders`) is out of scope; the extension uses `workspaceFolders[0]` where applicable.

---

## Commands (5 total)

| Command ID | Title | Effect |
|---|---|---|
| `copilotNotify.configure` | CopilotNotify: Configure Telegram | Opens the setup wizard |
| `copilotNotify.enable` | CopilotNotify: Enable | Sets `copilotNotify.enabled` to `true` |
| `copilotNotify.disable` | CopilotNotify: Disable | Sets `copilotNotify.enabled` to `false` |
| `copilotNotify.sendTest` | CopilotNotify: Send Test Notification | Dispatches a test message; shows inline success/error |
| `copilotNotify.showLogs` | CopilotNotify: Show Logs | Calls `outputChannel.show()` |

---

## API / Interface Contracts

### `secretManager.ts`
```typescript
interface SecretManager {
  getToken(): Promise<string | undefined>;
  storeToken(token: string): Promise<void>;
  // No deleteToken in Phase 1 (token replaced by new wizard run)
}
// Factory: createSecretManager(secrets: vscode.SecretStorage): SecretManager
```

### `configManager.ts`
```typescript
interface ConfigManager {
  getChatId(): string;
  getEnabled(): boolean;
  setChatId(value: string): Promise<void>;
  setEnabled(value: boolean): Promise<void>;
}
// Factory: createConfigManager(): ConfigManager
// Reads from vscode.workspace.getConfiguration('copilotNotify') on each call (no caching)
```

### `notifier.ts`
```typescript
interface NotificationPayload {
  readonly label: string;       // static constant from constants.ts
  readonly workspaceName: string | undefined;
  readonly timestamp: string;   // ISO 8601
}

type NotificationResult =
  | { readonly success: true }
  | { readonly success: false; readonly errorMessage: string };

interface Notifier {
  sendNotification(token: string, chatId: string): Promise<NotificationResult>;
  buildPayload(): NotificationPayload;   // pure; extracted for unit tests
  formatMessage(payload: NotificationPayload): string;  // pure; extracted for unit tests
}
// Factory: createNotifier(outputChannel: vscode.OutputChannel): Notifier
// sendNotification reads workspace name from vscode.workspace at call time
// Participant-triggered calls are fire-and-forget (void-cast); test command awaits
// the result to surface success/failure inline via showInformationMessage/showWarningMessage
```

### `statusBar.ts`
```typescript
type StatusBarState = 'ON' | 'OFF' | 'NOT_CONFIGURED';

interface StatusBarManager {
  update(state: StatusBarState): void;
  dispose(): void;
}
// Factory: createStatusBarManager(): StatusBarManager
```

### `participant.ts`
```typescript
// Wizard logic is extracted to a pure async function for testability:
async function runSetupWizard(
  secrets: SecretManager,
  config: ConfigManager
): Promise<'completed' | 'cancelled'>;

// Participant registration returns Disposable:
function registerParticipant(
  context: vscode.ExtensionContext,
  notifier: Notifier,
  config: ConfigManager,
  secrets: SecretManager,
  outputChannel: vscode.OutputChannel
): vscode.Disposable;
```

### `extension.ts`
```typescript
export function activate(context: vscode.ExtensionContext): void;
export function deactivate(): void;
// Owns: outputChannel creation, all Disposable push-to-subscriptions
```

---

## File-by-File Implementation Plan (Dependency Order)

### Phase A — Foundation (no VS Code API dependencies)

**1. `src/constants.ts`**  
No imports. Defines all `const` string values:
- Command IDs (5)
- Config keys (`copilotNotify.enabled`, `copilotNotify.telegramChatId`)
- SecretStorage key (`copilotNotify.botToken`)
- Output channel name
- Chat participant ID and name
- Notification message label (`"Copilot task finished"`)
- Status bar texts for all three states
- Telegram API base URL template
- Validation error messages for wizard InputBoxes

**2. `src/secretManager.ts`**  
Imports: `vscode` (SecretStorage type only), `constants.ts`.  
Implements `SecretManager` interface with `getToken` and `storeToken`.  
No logic beyond the two SecretStorage calls and the keyed constant.

**3. `src/configManager.ts`**  
Imports: `vscode`, `constants.ts`.  
Reads `vscode.workspace.getConfiguration('copilotNotify')` on every call (no caching — satisfies EC-04).  
Implements `ConfigManager`: `getChatId`, `getEnabled`, `setChatId`, `setEnabled`.  
`setChatId` and `setEnabled` use `config.update(key, value, vscode.ConfigurationTarget.Global)`.

### Phase B — Core Logic

**4. `src/notifier.ts`**  
Imports: `vscode`, `constants.ts`.  
Constructor arg: `outputChannel: vscode.OutputChannel`.  
`buildPayload()`: pure function. Returns `{ label: COMPLETION_LABEL, workspaceName: vscode.workspace.workspaceFolders?.[0]?.name, timestamp: new Date().toISOString() }`.  
`formatMessage(payload)`: pure function. Builds the Telegram `text` string. If `workspaceName` is undefined, omits workspace line.  
`sendNotification(token, chatId)`: returns `Promise<NotificationResult>`
  1. Build payload and format message
  2. `fetch(TELEGRAM_URL(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: message }) })`
     (No `parse_mode` — plain text only)
  3. If `response.ok`: log success to output channel; return `{ success: true }`
  4. If `!response.ok`: parse response JSON; log `response.status` + `json.description`; return `{ success: false, errorMessage: \`Telegram error \${response.status}: \${json.description ?? 'unknown'}\` }`
  5. On fetch rejection (network error): log error message; return `{ success: false, errorMessage: error.message }`
  6. On JSON parse failure for error body: return `{ success: false, errorMessage: \`Telegram error \${response.status}\` }`
  7. Never throw; never log token or chatId

**5. `src/statusBar.ts`**  
Imports: `vscode`, `constants.ts`.  
Creates one `vscode.StatusBarItem` (priority 100, left alignment).  
`update(state)`: sets `text`, `tooltip`, and `command` based on state.  
  - `'ON'`: text = `"🔔 Notify: ON"`, command = `copilotNotify.configure`
  - `'OFF'`: text = `"🔕 Notify: OFF"`, command = `copilotNotify.configure`
  - `'NOT_CONFIGURED'`: text = `"⚠️ Notify: Not Configured"`, command = `copilotNotify.configure`

  All three states bind to `copilotNotify.configure` on click (spec AS-06d). Tooltip distinguishes ON/OFF/NOT_CONFIGURED to communicate current state without separate enable/disable click paths.  
`dispose()`: disposes the status bar item.  
Shows item immediately on construction.

### Phase C — Participant and Wizard

**6. `src/participant.ts`**  
Imports: `vscode`, `constants.ts`, `secretManager.ts`, `configManager.ts`, `notifier.ts`.

**`runSetupWizard(secrets, config)`:**  
  1. Show token InputBox (`password: true`, `validateInput` checks non-empty/non-whitespace)
  2. If undefined (cancelled): return `'cancelled'` — no writes
  3. Show chatId InputBox (`validateInput` checks non-empty/non-whitespace; pre-fill with `config.getChatId()` if non-empty)
  4. If undefined (cancelled): return `'cancelled'` — no writes
  5. *(Both inputs now held in local variables; storage writes begin)*
  6. Capture rollback snapshot: `const previousChatId = config.getChatId()`
  7. Write chatId (first write): `await config.setChatId(chatId)`
  8. Write token (second write): `await secrets.storeToken(token)` — wrapped in try/catch
     - On success: return `'completed'`
     - On failure: rollback: `await config.setChatId(previousChatId)`; re-throw so the caller can log and show an error notification; no partial state persists

**`registerParticipant(context, notifier, config, secrets, outputChannel)`:**  
  1. `vscode.chat.createChatParticipant(PARTICIPANT_ID, handler)`
  2. Handler: `async (request, _ctx, response, _token) => { ... }`
     - Stream a response: `response.markdown(PARTICIPANT_RESPONSE_LABEL)`
     - After streaming resolves: check `config.getEnabled()`; if false → return (silent)
     - Await both credentials: `const token = await secrets.getToken(); const chatId = config.getChatId()`
     - If token is undefined or chatId is empty: log to output channel; return
     - Fire-and-forget: `void notifier.sendNotification(token, chatId).then(result => { if (!result.success) outputChannel.appendLine(result.errorMessage); })`
  3. Return the participant disposable

### Phase D — Entry Point

**7. `src/extension.ts`**  
`activate(context)`:
1. Create singleton `outputChannel = vscode.window.createOutputChannel(CHANNEL_NAME)`
2. Instantiate `secretManager`, `configManager`, `notifier`, `statusBarManager`
3. Determine initial status bar state *(async — must await SecretStorage)*:
   `const token = await secretManager.getToken();`
   `if (!configManager.getEnabled()) → 'OFF'`
   `else if (!token || !configManager.getChatId()) → 'NOT_CONFIGURED'`
   `else → 'ON'`
4. Call `statusBarManager.update(initialState)`
5. Register participant via `registerParticipant(...)`
6. Register 5 commands (see below)
7. Push all disposables to `context.subscriptions`
8. Push `statusBarManager` to subscriptions (via `{ dispose }` adapter)

**Command registrations:**
- `copilotNotify.configure`: calls `runSetupWizard`; on `'completed'`, performs async re-evaluation (`await secretManager.getToken()`) to determine new state, then calls `statusBarManager.update(...)`
- `copilotNotify.enable`: calls `configManager.setEnabled(true)`; performs async re-evaluation of token + chatId to set `'ON'` or `'NOT_CONFIGURED'`
- `copilotNotify.disable`: calls `configManager.setEnabled(false)`; calls `statusBarManager.update('OFF')`
- `copilotNotify.sendTest`: reads token (async, via `await secretManager.getToken()`) and chatId (sync); if either absent, shows `showWarningMessage` naming the missing credential(s); else `await`s `notifier.sendNotification(token, chatId)` and branches on `NotificationResult`: `success === true` → `showInformationMessage(TEST_SUCCESS_MESSAGE)`, `success === false` → `showWarningMessage(result.errorMessage)`
- `copilotNotify.showLogs`: calls `outputChannel.show()`

`deactivate()`: no-op (subscriptions auto-disposed by VS Code).

### Phase E — Tests

**8. `test/suite/notifier.test.ts`**  
Test targets: `buildPayload()`, `formatMessage()`, `sendNotification()` with mocked `fetch`.  
Cases: happy path → `{ success: true }`; `response.ok = false` → `{ success: false, errorMessage }` + log; fetch rejection → `{ success: false }` + log; JSON parse failure → `{ success: false }`. No `parse_mode` in any request body assertion.

**9. `test/suite/secretManager.test.ts`**  
Test targets: `getToken()`, `storeToken()`.  
Use in-memory mock implementing `vscode.SecretStorage`.  
Cases: token absent → returns undefined; store then get → returns value.

**10. `test/suite/configManager.test.ts`**  
Test targets: `getChatId()`, `getEnabled()`, `setChatId()`, `setEnabled()`.  
Use VS Code workspace configuration test harness or an extracted pure config reader.  
Cases: default values, write then read round-trips.

**11. `test/suite/statusBar.test.ts`**  
Test targets: `update(state)`, state transitions.  
Cases: ON text/tooltip/command, OFF text/tooltip/command, NOT_CONFIGURED text/tooltip/command.

**12. `test/suite/wizard.test.ts`**  
Test target: `runSetupWizard` with mocked `showInputBox`.  
Cases: happy path → writes both values, returns `'completed'`; cancel at token → no writes, returns `'cancelled'`; cancel at chatId → no writes, returns `'cancelled'`; empty token rejected (validation); empty chatId rejected (validation); second write (token) failure → chatId rolled back to previous value (mock `storeToken` to throw).

---

## Data Flow

```
User types @copilotnotify in Chat panel
        │
        ▼
VS Code Chat engine calls participant handler (request, ctx, response, token)
        │
        ▼
participant.ts: streams response.markdown(...) to Chat panel  ← user sees response
        │
        ▼  (handler async resolves — streaming complete)
        │
        ├── config.getEnabled() == false? → silent return
        │
        ├── await secrets.getToken() == undefined? → log "token not configured" → return
        │
        ├── config.getChatId() == ""? → log "chatId not configured" → return
        │
        ▼
notifier.sendNotification(token, chatId)  [fire-and-forget; result logged but not surfaced in Chat]
        │
        ▼
notifier.buildPayload() → { label, workspaceName, timestamp }
notifier.formatMessage() → "🔔 Copilot task finished\nWorkspace: foo\n2026-04-03T..."
        │
        ▼
fetch POST https://api.telegram.org/bot<TOKEN>/sendMessage
  body: { chat_id: chatId, text: message }   ← plain text; no parse_mode
        │
        ├── response.ok == true → return { success: true }
        │
        └── response.ok == false OR fetch rejection
              → log HTTP status + description to Output Channel (no token, no chatId)
              → return { success: false, errorMessage: "..." }
              (test command surfaces this; participant handler logs to Output Channel only)
```

---

## Error Handling Plan

| Error Scenario | Handler Location | Action |
|---|---|---|
| Wizard: empty/whitespace token | `participant.ts` validateInput | Inline InputBox error string; no advance |
| Wizard: user cancels at token | `participant.ts` | Return `'cancelled'`; no storage writes |
| Wizard: user cancels at chatId | `participant.ts` | Return `'cancelled'`; no storage writes (token not yet written) |
| Wizard: second write (token) failure | `participant.ts` `runSetupWizard` | Rollback chatId to previous value; re-throw; caller logs and shows VS Code error notification; no partial state |
| Notification: not configured (either token or chatId absent) | `participant.ts` handler | Log to Output Channel; silent return |
| Notification: disabled | `participant.ts` handler | Silent return (expected state) |
| Notification: Telegram API error (4xx/5xx) | `notifier.ts` | Log HTTP status + `description`; return `{ success: false, errorMessage }` |
| Notification: network offline / fetch rejection | `notifier.ts` | Log error message; return `{ success: false, errorMessage }` |
| Notification: response JSON parse failure | `notifier.ts` | Return `{ success: false, errorMessage: "Telegram error <status>" }` |
| Test notification: token or chatId absent | `extension.ts` command | `showWarningMessage` naming each missing credential; no network call |
| Test notification: `NotificationResult.success === false` | `extension.ts` command | `showWarningMessage(result.errorMessage)` |
| Any unhandled leak | Enforced by TypeScript strict mode + no-floating-promises lint rule | Compile-time prevention |

**Safe error logging contract (addresses Step 2 reviewer note):**  
`notifier.ts` must log: `[CopilotNotify] Telegram error — status: <HTTP_STATUS>, description: <TELEGRAM_DESCRIPTION>`.  
Must NOT log: token, chatId, request body, or any user workspace content.

**Workspace name as safe metadata (addresses Step 2 reviewer note):**  
`vscode.workspace.workspaceFolders?.[0]?.name` is an environment-level property set by the user in VS Code — not derived from prompts, file content, or code. It is explicitly safe to include in the notification payload per constitution §4 (metadata only).

**Wizard atomicity (addresses Step 2 reviewer note):**  
Both inputs are collected in local variables before any storage call. The write sequence is: (1) `config.setChatId(chatId)`, (2) `secrets.storeToken(token)`. If the second write (token) fails, the first write (chatId) is explicitly rolled back by restoring the pre-wizard chatId value. This guarantees no partial-configuration state survives a write failure.

---

## Test Strategy

### Extractable Pure Logic (high test value)

| Function | Module | Why Extract |
|---|---|---|
| `buildPayload()` | `notifier.ts` | No VS Code API; testable with Jest/Mocha directly |
| `formatMessage(payload)` | `notifier.ts` | Pure string builder; deterministic |
| `runSetupWizard(secrets, config)` | `participant.ts` | Accepts injected stubs; no live UI required |
| `StatusBarManager.update(state)` | `statusBar.ts` | State machine; verify text/command per state |
| `ConfigManager` read/write | `configManager.ts` | Thin wrapper; verify delegation to `getConfiguration` |
| `SecretManager` get/store | `secretManager.ts` | Verify delegation to `SecretStorage` |

### Coverage Path to 80%

- `constants.ts` — passively covered (imported by all modules under test)
- `notifier.ts` — `buildPayload`, `formatMessage`, `sendNotification` (mocked fetch: success / !ok / rejection)
- `secretManager.ts` — `getToken` (absent, present), `storeToken`
- `configManager.ts` — `getChatId` (default, set), `getEnabled` (default, set), `setChatId`, `setEnabled`
- `statusBar.ts` — `update` (3 state transitions), `dispose`
- `participant.ts` — `runSetupWizard` (happy, cancel-token, cancel-chatId, empty-validation); participant handler (enabled, disabled, not-configured)
- `extension.ts` — `activate` (integration-level); `deactivate` (trivial)

### Mock Strategy
- `vscode.SecretStorage`: in-memory `Map`-backed mock
- `vscode.workspace.getConfiguration`: stub returning configurable values
- `fetch`: replaced with `sinon.stub()` or a simple async function returning mock `Response`
- `vscode.window.showInputBox`: stub sequence returning test strings or undefined
- `vscode.window.createOutputChannel`: returns a no-op channel object

---

## Alternatives Considered

### 1. Passive Copilot observation
Listen to internal Copilot events (e.g., `github.copilot.edits.taskCompleted`) to fire notifications without requiring `@copilotnotify` invocation.  
**Rejected:** No stable public API exists (C-02). Using internal/unstable events violates the constitution and would break silently on Copilot updates.

### 2. `onActivate` instead of `onStartupFinished`
Activate when the Chat view opens or when any command is invoked.  
**Rejected:** `onStartupFinished` is simpler, does not require a specific trigger, and ensures the participant is ready as soon as VS Code finishes loading without over-eager activation on every startup action.

### 3. Cache SecretStorage token in memory after first read
Read token once on activate and store in an extension-level variable to avoid repeated async reads.  
**Rejected:** Violates the constitution's "never cache secrets beyond the active request" principle and would miss EC-03 (token changed mid-session via wizard).

### 4. Declaring `notifyOnSuccess` / `notifyOnFailure` as disabled Phase 1 settings
Add the settings with `"markdownDeprecationMessage"` or hidden in the schema to pre-declare the schema.  
**Rejected:** Any Phase 2+ key in the Phase 1 schema violates the constitution's active-scope restriction (§2) and creates confusion for users.

---

## Package.json Manifest Outline

```jsonc
{
  "name": "copilotnotify",
  "displayName": "CopilotNotify",
  "publisher": "devbehkami",
  "version": "0.1.0",
  "engines": { "vscode": ">=1.90.0" },
  "activationEvents": ["onStartupFinished"],
  "contributes": {
    "chatParticipants": [
      {
        "id": "copilotnotify",
        "name": "copilotnotify",
        "description": "Sends a Telegram notification when your Copilot task completes.",
        "isSticky": false
      }
    ],
    "commands": [
      /* 5 commands — see Commands table above */
    ],
    "configuration": {
      "title": "CopilotNotify",
      "properties": {
        "copilotNotify.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable or disable Telegram notifications."
        },
        "copilotNotify.telegramChatId": {
          "type": "string",
          "default": "",
          "description": "Your Telegram chat ID. Use /start with your bot to find it."
        }
      }
    }
  },
  "main": "./out/extension.js",
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src --ext ts",
    "test": "vscode-test"
  },
  "devDependencies": { /* typescript, @types/vscode, @vscode/test-electron, mocha, @types/mocha, esbuild, eslint, @typescript-eslint/... */ }
}
```

---

## Implementation Checklist (for Step 4 Task Generation)

- [ ] A-1: Scaffold `package.json`, `tsconfig.json`, `.eslintrc.json`, `.vscodeignore`
- [ ] A-2: Implement `src/constants.ts`
- [ ] A-3: Implement `src/secretManager.ts` + `test/suite/secretManager.test.ts`
- [ ] A-4: Implement `src/configManager.ts` + `test/suite/configManager.test.ts`
- [ ] B-1: Implement `src/notifier.ts` + `test/suite/notifier.test.ts`
- [ ] B-2: Implement `src/statusBar.ts` + `test/suite/statusBar.test.ts`
- [ ] C-1: Implement `src/participant.ts` (wizard + handler) + `test/suite/wizard.test.ts`
- [ ] D-1: Implement `src/extension.ts` (activate/deactivate + command registrations)
- [ ] E-1: Wire `test/suite/index.ts`; verify `npm run test` passes; verify coverage ≥ 80%
- [ ] E-2: Verify `npm run compile` exits 0
- [ ] E-3: Verify `vsce package` exits 0
