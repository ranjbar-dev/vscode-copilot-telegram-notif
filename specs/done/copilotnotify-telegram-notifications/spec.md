# Spec: CopilotNotify — Telegram Notifications (Phase 1 MVP)

**Branch:** `amirranjbar/feat/copilotnotify-telegram-notifications`  
**Date:** 2026-04-03  
**Status:** Queue  
**Scope:** Phase 1 MVP (v0.1.0) only  
**Inputs:** PDR.md · memory/constitution.md · .github/copilot-instructions.md · Step 1 decisions · Step 2 research findings

---

## 1. Overview

CopilotNotify is a VS Code extension that sends a Telegram push notification when the user's GitHub Copilot chat interaction — invoked through the CopilotNotify custom chat participant — completes. The goal is to let developers step away from the screen during long Copilot tasks and be alerted on their phone the moment the response is ready.

**Phase 1 delivers the minimal viable loop:** configure → invoke participant → receive Telegram notification.

---

## 2. Scope and Non-Goals

### 2.1 In Scope (Phase 1)

- TypeScript VS Code extension scaffold with strict mode
- Telegram bot setup wizard (sequential InputBoxes; bot token is password-masked)
- Bot token stored exclusively in `vscode.SecretStorage`
- Chat ID stored in `vscode.workspace.getConfiguration`
- Custom VS Code chat participant that fires a notification when its handler resolves after response streaming completes
- Notification dispatch via native `fetch` over HTTPS to the Telegram Bot API
- Generic message content only (no prompt text, no code content, no diffs)
- "Send Test Notification" command
- Enable / Disable commands with corresponding status bar indicator
- "Show Logs" command that opens the Output Channel

### 2.2 Out of Scope (Phase 2+)

The following items are explicitly deferred and must not appear in Phase 1 code or configuration:

| Item | Deferral |
|---|---|
| Success vs failure differentiation | Phase 2 |
| Notification cooldown (`cooldownSeconds`) | Phase 2 |
| Message format variants (`default` / `minimal`) | Phase 2 |
| Task duration tracking | Phase 2 |
| `includeTaskSummary` toggle | Phase 2 |
| `notifyOnSuccess` / `notifyOnFailure` settings | Phase 2 |
| Copilot Edits / Workspace integration | Phase 4 |
| Slack, Discord, or other channels | Phase 4 |
| Notification history panel | Phase 4 |
| Marketplace submission and onboarding walkthrough | Phase 3 |

---

## 3. Critical Constraints

**C-01 — No passive Copilot observation.**  
The extension does NOT observe normal Copilot Edits, Copilot Workspace, or standard autocomplete. Phase 1 detects only the completion of the CopilotNotify custom participant turn. Users must explicitly invoke the participant (e.g., `@copilotnotify`) to receive a notification.

**C-02 — No private/internal APIs.**  
The following are forbidden regardless of availability:
- `github.copilot.edits.taskCompleted`
- `vscode.chat.onDidReceiveResponse` (internal)
- `vscode.lm.onDidChangeChatModels` (misuse as task boundary)

Only the public `vscode.chat` extension surface is permitted.

**C-03 — Privacy-safe message content only.**  
Notifications must use a generic label (e.g., "Copilot task finished"). The extension must never read, log, or transmit prompt text, code content, file contents, or diff output.

**C-04 — SecretStorage from day one.**  
Bot token must be stored in `vscode.SecretStorage` in v0.1.0. Storing the token in `settings.json` or any plaintext location is prohibited.

**C-05 — Native fetch only.**  
No `axios`, `node-fetch`, or any third-party HTTP library. All Telegram API calls use the built-in `fetch` available in the VS Code extension host.

**C-06 — No backend.**  
All HTTPS calls go directly from the extension to `api.telegram.org`. No proxy, relay, or intermediate server.

---

## 4. User Stories

### US-01 — Telegram setup wizard
**Priority:** HIGH  
**As a** developer,  
**I want to** configure my Telegram bot token and chat ID through a guided wizard,  
**so that** my credentials stay private, securely stored, and the extension is ready to send notifications.

**Acceptance Scenarios:**

- **AS-01a (Happy path):** User runs "CopilotNotify: Configure Telegram". Two sequential InputBoxes appear: first for bot token (password-masked), then for chat ID. After valid values are submitted, bot token is saved to SecretStorage and chat ID to workspace configuration. Status bar updates to "Not Configured" → "ON" (if `enabled` is true).
- **AS-01b (Cancellation):** User presses Escape during either InputBox. No data is written; any previously stored values are preserved unchanged.
- **AS-01c (Empty input rejected):** User submits an empty or whitespace-only value. The InputBox displays an inline validation message and does not advance.
- **AS-01d (Token remains masked):** The bot token InputBox must use `password: true` so the value is never visible in plaintext.

---

### US-02 — Notification on participant task completion
**Priority:** HIGH  
**As a** developer,  
**I want to** receive a Telegram message when CopilotNotify's custom participant finishes responding,  
**so that** I can step away and be alerted the moment the response is ready.

**Acceptance Scenarios:**

- **AS-02a (Happy path):** User invokes the CopilotNotify participant in the VS Code Chat panel. When the participant handler resolves (response streaming complete), a Telegram message is dispatched containing a generic completion label, the workspace name, and an ISO timestamp. No prompt text or code appears in the message.
- **AS-02b (Notifications disabled):** User has run "CopilotNotify: Disable". On subsequent participant invocations, no notification is dispatched. Status bar shows "OFF".
- **AS-02c (Not configured):** Bot token or chat ID is absent. On participant invocation, no network request is made. An error is logged to the Output Channel. No modal or blocking dialog is shown.
- **AS-02d (Telegram unreachable):** Telegram API returns any error or network request fails. The extension logs the error to the Output Channel. The editor continues to function normally; no modal error is surfaced to the user.

---

### US-03 — Enable / disable toggle
**Priority:** MEDIUM  
**As a** developer,  
**I want to** enable or disable notifications without uninstalling the extension,  
**so that** I can pause notifications when they are not needed.

**Acceptance Scenarios:**

- **AS-03a:** User runs "CopilotNotify: Disable". `copilotNotify.enabled` is set to `false`. Status bar shifts to "OFF". Subsequent participant completions do not fire notifications.
- **AS-03b:** User runs "CopilotNotify: Enable". `copilotNotify.enabled` is set to `true`. Status bar shifts to "ON" (or "Not Configured" if credentials are missing). Subsequent participant completions fire notifications.

---

### US-04 — Test notification command
**Priority:** MEDIUM  
**As a** developer,  
**I want to** send a test notification from the Command Palette,  
**so that** I can verify my bot token and chat ID are correct before relying on participant notifications.

**Acceptance Scenarios:**

- **AS-04a (Happy path):** User runs "CopilotNotify: Send Test Notification". Extension dispatches a generic test message to Telegram. A VS Code information notification confirms success.
- **AS-04b (Not configured):** Either credential is missing. An inline VS Code warning notification explains which credential is absent. No network request is attempted.
- **AS-04c (API error):** Telegram returns an error. An inline VS Code warning notification surfaces the error code or description. Error is also logged to the Output Channel.

---

### US-05 — Generic status label in notification
**Priority:** MEDIUM  
**As a** developer,  
**I want to** receive a clear, concise message in Telegram,  
**so that** I know the CopilotNotify task finished without exposing private context.

**Acceptance Scenarios:**

- **AS-05a:** Notification message contains: a static completion label, the VS Code workspace folder name (if available), and a timestamp.
- **AS-05b:** Notification message contains NO prompt text, NO code snippets, NO file contents, NO diffs.
- **AS-05c:** If no workspace folder is open, the workspace name field is omitted or replaced with a safe placeholder.

---

### US-06 — Status bar indicator
**Priority:** LOW  
**As a** developer,  
**I want to** see the current notification state at a glance in the VS Code status bar,  
**so that** I know whether CopilotNotify is active, disabled, or needs configuration.

**Acceptance Scenarios:**

- **AS-06a:** Configured and enabled → status bar shows "🔔 Notify: ON".
- **AS-06b:** Disabled by user → status bar shows "🔕 Notify: OFF".
- **AS-06c:** Bot token or chat ID absent → status bar shows "⚠️ Notify: Not Configured".
- **AS-06d:** Clicking the status bar item opens the "CopilotNotify: Configure Telegram" command.

---

## 5. Edge Cases

*Derived from acceptance scenarios and constitution constraints.*

| ID | Scenario | Expected Behavior |
|---|---|---|
| EC-01 | Setup wizard opened when credentials already exist | Wizard pre-fills chat ID (non-secret); bot token field is blank (SecretStorage value never pre-filled into UI) |
| EC-02 | Participant completes while extension host is under load | Notification is dispatched asynchronously; no blocking or timeout on the participant response |
| EC-03 | Bot token changed mid-session via wizard | Next notification uses the updated token immediately (always read from SecretStorage at dispatch time) |
| EC-04 | Chat ID changed mid-session via settings.json | Next notification uses the updated value (read from configuration at dispatch time) |
| EC-05 | Multiple rapid participant turns | Each turn fires an independent notification; no deduplication or cooldown in Phase 1 |
| EC-06 | Network offline when notification fires | `fetch` rejects; error is caught, logged to Output Channel; extension does not throw or crash |
| EC-07 | Telegram bot token is invalid (401 from API) | Error response body is logged; VS Code Output Channel entry written; no credential is auto-cleared |
| EC-08 | Chat ID is a group or channel ID (not personal) | Extension is agnostic to ID format; dispatches to whatever ID is configured; no validation beyond non-empty check |
| EC-09 | Workspace with no open folder | Workspace name field is omitted from the notification message body |
| EC-10 | User escapes setup wizard after entering token but before chat ID | Neither credential is written; SecretStorage retains any prior token value |
| EC-11 | Extension activated with `enabled: false` in saved settings | Status bar shows "OFF" on startup; no participant listener fires notifications |
| EC-12 | Extension deactivated (VS Code window close) | Status bar item and participant are disposed cleanly via deactivate hook |

---

## 6. Requirements

### 6.1 Functional Requirements

| ID | Requirement |
|---|---|
| FR-01 | The extension MUST register a custom VS Code chat participant using the public `vscode.chat` API |
| FR-02 | The participant handler MUST dispatch a task-completion event when its `async` handler resolves after response streaming completes |
| FR-03 | On each task-completion event (and notifications enabled), the extension MUST dispatch an HTTPS POST to `api.telegram.org/bot<TOKEN>/sendMessage` using native `fetch` |
| FR-04 | The notification message body MUST contain only: a static completion label, workspace folder name (or placeholder), and ISO timestamp |
| FR-05 | The notification message body MUST NOT contain prompt text, code content, file names derived from prompts, or diff output |
| FR-06 | The bot token MUST be stored exclusively in `vscode.SecretStorage` under the key `copilotNotify.botToken` |
| FR-07 | The chat ID MUST be stored in `vscode.workspace.getConfiguration('copilotNotify')` under the key `copilotNotify.telegramChatId` |
| FR-08 | The setup wizard MUST use sequential `vscode.window.showInputBox` calls; the token InputBox MUST set `password: true` |
| FR-09 | The extension MUST expose a "Send Test Notification" command that dispatches a generic test message and reports success or failure inline |
| FR-10 | The extension MUST expose enable and disable commands that toggle `copilotNotify.enabled` |
| FR-11 | The extension MUST display a status bar item reflecting three states: ON, OFF, Not Configured |
| FR-12 | The extension MUST expose a "Show Logs" command that reveals the CopilotNotify Output Channel |
| FR-13 | All Telegram API errors MUST be caught, logged to the Output Channel, and MUST NOT surface as unhandled exceptions or crash the extension host |

### 6.2 Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | TypeScript strict mode (`"strict": true`); no `any` types; use `unknown` with explicit narrowing |
| NFR-02 | No external runtime dependencies beyond VS Code Extension API and built-in `fetch` |
| NFR-03 | Unit test coverage target: ≥ 80% by end of Phase 1; framework: Mocha + `@vscode/test-electron` |
| NFR-04 | No telemetry, analytics, or tracking of any kind |
| NFR-05 | Functions ≤ 50 lines; files ≤ 800 lines; all user-visible strings defined as named constants |

---

## 7. Configuration Schema (Phase 1)

| Key | Storage | Type | Default | Notes |
|---|---|---|---|---|
| `copilotNotify.botToken` | `vscode.SecretStorage` | `string` | — | Never in settings.json |
| `copilotNotify.telegramChatId` | `settings.json` | `string` | `""` | Not a secret |
| `copilotNotify.enabled` | `settings.json` | `boolean` | `true` | Master on/off switch |

**Excluded from Phase 1:** `notifyOnSuccess`, `notifyOnFailure`, `cooldownSeconds`, `messageFormat`, `includeTaskSummary`.

---

## 8. High-Level Implementation Intent

*File-level intent only; class names, method signatures, and internal design are left to the implementer.*

| Module | Responsibility |
|---|---|
| `src/extension.ts` | Extension entry point; registers participant, commands, status bar item; reads initial configuration on activation; disposes all registrations on deactivation |
| `src/participant.ts` | Registers the custom chat participant; when the handler resolves after response streaming, invokes the notifier |
| `src/notifier.ts` | Builds the generic notification payload; dispatches HTTPS POST to Telegram Bot API via native `fetch`; handles and logs API errors |
| `src/secretManager.ts` | Wraps `vscode.SecretStorage` for bot token get/set operations |
| `src/configManager.ts` | Wraps `vscode.workspace.getConfiguration` for chat ID and `enabled` flag reads and writes |
| `src/statusBar.ts` | Manages the status bar item lifecycle and state transitions (ON / OFF / Not Configured) |
| `src/constants.ts` | All named string constants: command IDs, config keys, message labels, SecretStorage key, output channel name |

---

## 9. Success Criteria

Phase 1 is complete when all of the following are true:

| Criterion | Verification |
|---|---|
| SC-01 | Setup wizard stores bot token in SecretStorage and chat ID in settings; wizard is cancellable without side effects | Manual test + unit test |
| SC-02 | Invoking the custom participant triggers a Telegram notification with a generic label and no prompt/code content | Manual test + unit test (mocked fetch) |
| SC-03 | Notifications are suppressed when `enabled` is `false` | Unit test |
| SC-04 | Test notification command confirms success or reports error inline; no unhandled thrown errors | Manual test + unit test |
| SC-05 | Status bar transitions correctly between all three states across enable/disable/configuration changes | Unit test |
| SC-06 | Telegram API errors are caught and logged; extension host does not crash | Unit test (mocked fetch with error) |
| SC-07 | No private or internal VS Code/Copilot APIs are used | Code review |
| SC-08 | Unit test coverage ≥ 80% | `npm run test` coverage report |
| SC-09 | TypeScript compiles with zero errors under strict mode | `npm run compile` |
| SC-10 | Extension packages without errors via `vsce package` | CI / manual |

---

## 10. Known Limitations

1. **Passive Copilot detection is not possible in Phase 1.** The extension cannot observe Copilot Edits, Copilot Workspace, or background Copilot agent usage; the user must explicitly invoke the CopilotNotify participant to receive a notification.
2. **No success/failure distinction.** All participant completions trigger the same generic notification regardless of whether the response was helpful, errored, or cancelled by the user. (Phase 2.)
3. **No cooldown.** Rapid successive participant turns will each fire a separate notification. (Phase 2.)
4. **Task summary is a static label.** The notification does not describe what the Copilot task did — by design, to protect user privacy.
5. **Single notification channel.** Only Telegram is supported. (Slack, Discord deferred to Phase 4.)
6. **One bot per installation.** The configuration supports one bot token and one chat ID per VS Code instance; multi-destination dispatch is out of scope.

---

## 11. Assumptions

1. The `vscode.chat` participant API is available in the targeted VS Code version and stable enough for v0.1.0 release.
2. The Telegram Bot API (`api.telegram.org`) is accessible from the user's machine without special firewall rules; the extension makes no attempt to tunnel or proxy.
3. The user has already created a Telegram bot via @BotFather and knows their chat ID; the setup wizard provides inline guidance but does not auto-detect the chat ID.
4. Native `fetch` is available in the VS Code extension host runtime.

---

## 12. Constitution Compliance

| Constitution Decision | Compliance in This Spec |
|---|---|
| Language: TypeScript strict mode | NFR-01 |
| Copilot detection: custom chat participant only | C-01, C-02, FR-01, FR-02 |
| Bot token: `vscode.SecretStorage` only | C-04, FR-06 |
| Chat ID: workspace configuration | FR-07 |
| HTTP client: native `fetch` only | C-05, FR-03 |
| No backend | C-06 |
| No telemetry | NFR-04 |
| Task summary: generic label only | C-03, FR-04, FR-05 |
| Privacy-first: no prompt/code transmission | C-03, FR-05 |
| Phase 1 scope only | Section 2.2 |
| Spec-driven development | This spec precedes all product code |

---

## 13. Resolved Conflicts

| Conflict | Source A | Source B | Resolution |
|---|---|---|---|
| `notifyOnSuccess` / `notifyOnFailure` listed as Phase 1 settings | `.github/copilot-instructions.md` | Step 2 research findings (success/failure split = Phase 2); constitution (Phase 1 scope only) | **Resolved in favor of constitution:** both settings are deferred to Phase 2 and excluded from Phase 1 |
| Bot token in `settings.json` | PDR.md Section 5 (telegramBotToken as workspace setting) | Constitution Section 3 (SecretStorage, never settings.json) | **Resolved in favor of constitution:** SecretStorage exclusively |
| PRD message content includes task name/duration | PDR.md Section 4.4 example | Constitution Section 3 (generic label only) | **Resolved in favor of constitution:** generic label, timestamp, workspace name only |
| `axios` mentioned as HTTP option | PDR.md Section 4.2 | Constitution Section 3 (native fetch only) | **Resolved in favor of constitution:** native fetch only |
