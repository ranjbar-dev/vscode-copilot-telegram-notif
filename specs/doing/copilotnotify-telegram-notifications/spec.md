# Spec: CopilotNotify — Phase 2 Enriched Notifications + Phase 3 Repo Foundation

**Branch:** `amirranjbar/feat/copilotnotify-telegram-notifications`  
**Date:** 2026-04-04 (revised; originally created 2026-04-03)  
**Status:** Active — Phase 1 delivered; Phase 2 + feasible Phase 3 in progress  
**Scope:** Phase 2 enriched notifications; feasible Phase 3 repo work; Phase 1 delivered baseline preserved  
**Inputs:** Phase 1 spec (2026-04-03) · PDR.md · memory/constitution.md · .github/copilot-instructions.md · SDD orchestrator brief (2026-04-04)

---

## 1. Overview

CopilotNotify is a VS Code extension that sends Telegram push notifications when the user's GitHub Copilot interaction — invoked through the CopilotNotify custom chat participant — completes. The goal is to let developers step away from the screen during long Copilot tasks and be alerted on their phone the moment the response is ready.

**Phase 1 (delivered, v0.1.0):** The minimal viable notification loop — configure credentials → invoke participant → receive Telegram notification with a generic label, workspace name, and timestamp.

**This revision (Phase 2 + feasible Phase 3) adds:**

- Enriched notification content: task duration, participant-turn outcome (completed vs. cancelled), and configurable message format variants
- User-configurable outcome filtering (`notifyOnSuccess`, `notifyOnFailure`) and notification cooldown (`cooldownSeconds`)
- Repository foundation work: README, root CHANGELOG, LICENSE, GitHub Actions CI workflow, and issue templates

**Architecture note:** The extension does not passively monitor real Copilot agent tasks. All detection, duration measurement, and outcome detection are scoped exclusively to the CopilotNotify custom participant turn. Duration is the elapsed wall-clock time from when the participant handler is invoked to when it resolves. Outcome is derived solely from the VS Code cancellation token passed to the participant handler — `token.isCancellationRequested` at handler-resolution time. These are participant-turn metadata, not internal Copilot job telemetry.

---

## 2. Scope and Non-Goals

### 2.1 Phase 1 (Delivered Baseline)

The following items were delivered in v0.1.0 and are preserved as the stable foundation. No regression is permitted against them.

- TypeScript VS Code extension scaffold with strict mode
- Telegram bot setup wizard (sequential InputBoxes; bot token is password-masked)
- Bot token stored exclusively in `vscode.SecretStorage`
- Chat ID stored in `vscode.workspace.getConfiguration`
- Custom VS Code chat participant that fires a notification when its handler resolves after response streaming completes
- Notification payload: generic label + workspace name + ISO timestamp
- Notification dispatch via native `fetch` over HTTPS to the Telegram Bot API; no backend
- "Send Test Notification" command
- Enable / Disable commands with corresponding status bar indicator
- "Show Logs" command that opens the Output Channel

### 2.2 Phase 2 (Active — this revision)

| Item | Description |
|---|---|
| Task duration | Record handler start time and end time; include human-readable elapsed duration in the notification |
| Outcome differentiation | Detect participant cancellation via `token.isCancellationRequested`; surface "completed" vs. "cancelled" in the notification payload |
| `notifyOnSuccess` | Boolean setting; when `false`, suppress notifications when outcome is "completed" (default: `true`) |
| `notifyOnFailure` | Boolean setting; when `false`, suppress notifications when outcome is "cancelled" (default: `true`) |
| `cooldownSeconds` | Integer setting; minimum seconds between notifications; default `5`; `0` disables cooldown; negative values treated as `0` |
| `messageFormat` | Enum setting: `"default"` (enriched) or `"minimal"` (label + timestamp only); fallback to `"default"` on unrecognized value |
| Privacy-safe default format | `"default"` format includes only: generic label, workspace name, duration, outcome, and ISO timestamp — no prompt text, no code |

### 2.3 Feasible Phase 3 Repo Work (Active — this revision)

| Item | Description |
|---|---|
| `README.md` | Project overview, prerequisites, setup guide, usage walkthrough, full configuration reference |
| Root `CHANGELOG.md` | Human-readable release history starting from v0.1.0; Keep a Changelog format |
| `LICENSE` | MIT license file at repository root |
| GitHub Actions CI | Workflow: triggers on push and pull request; runs `compile`, `lint`, and `test` |
| Issue templates | Bug report and feature request templates in `.github/ISSUE_TEMPLATE/` |

### 2.4 Out of Scope (This Revision and Beyond Unless Noted)

| Item | Reason |
|---|---|
| Prompt text or task summary derived from user request | Privacy constraint — constitution C-03 |
| Passive observation of Copilot Chat, Edits, Workspace, or autocomplete | Not possible via public APIs — C-01, C-02 |
| LLM quality or error detection beyond participant cancellation state | Requires internal Copilot API access — C-02 |
| `includeTaskSummary` toggle | Eliminated — privacy constraint makes a meaningful summary impossible without exposing prompt content |
| Marketplace submission, demo GIF, publisher account tasks | External/account work; out of repository scope |
| Slack, Discord, or other notification channels | Deferred to Phase 4 |
| Notification history panel | Deferred to Phase 4 |
| Multi-destination dispatch | Deferred to Phase 4 |

---

## 3. Critical Constraints

**C-01 — No passive Copilot observation.**  
The extension does NOT observe Copilot Edits, Copilot Workspace, Copilot Chat conversations not addressed to the CopilotNotify participant, or standard autocomplete. All phases detect only the completion of the CopilotNotify custom participant turn. Duration and outcome are participant-turn metadata, not internal Copilot job telemetry.

**C-02 — No private/internal APIs.**  
The following are forbidden regardless of availability:
- `github.copilot.edits.taskCompleted`
- `vscode.chat.onDidReceiveResponse` (internal)
- `vscode.lm.onDidChangeChatModels` (misuse as task boundary)

Only the public `vscode.chat` extension surface is permitted.

**C-03 — Privacy-safe message content only.**  
Notifications must use a generic label (e.g., "Copilot task finished"). Duration, outcome, workspace name, and timestamp are the only permitted enrichments. The extension must never read, log, or transmit prompt text, code content, file contents, or diff output.

**C-04 — SecretStorage from day one.**  
Bot token must be stored in `vscode.SecretStorage` in all phases. Storing the token in `settings.json` or any plaintext location is prohibited.

**C-05 — Native fetch only.**  
No `axios`, `node-fetch`, or any third-party HTTP library. All Telegram API calls use the built-in `fetch` available in the VS Code extension host.

**C-06 — No backend.**  
All HTTPS calls go directly from the extension to `api.telegram.org`. No proxy, relay, or intermediate server.

---

## 4. User Stories

### Phase 1 Stories (Delivered)

> These stories are part of the delivered v0.1.0 baseline. Acceptance scenarios must continue to pass after Phase 2 changes are applied.

### US-01 — Telegram setup wizard
**Priority:** HIGH · **Phase:** 1 (delivered)  
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
**Priority:** HIGH · **Phase:** 1 (delivered)  
**As a** developer,  
**I want to** receive a Telegram message when CopilotNotify's custom participant finishes responding,  
**so that** I can step away and be alerted the moment the response is ready.

**Acceptance Scenarios:**

- **AS-02a (Happy path):** User invokes the CopilotNotify participant in the VS Code Chat panel. When the participant handler resolves, a Telegram message is dispatched containing at minimum: a generic completion label, the workspace folder name, and an ISO timestamp. No prompt text or code appears in the message.
- **AS-02b (Notifications disabled):** User has run "CopilotNotify: Disable". On subsequent participant invocations, no notification is dispatched. Status bar shows "OFF".
- **AS-02c (Not configured):** Bot token or chat ID is absent. On participant invocation, no network request is made. An error is logged to the Output Channel. No modal or blocking dialog is shown.
- **AS-02d (Telegram unreachable):** Telegram API returns any error or network request fails. The extension logs the error to the Output Channel. The editor continues to function normally; no modal error is surfaced to the user.

---

### US-03 — Enable / disable toggle
**Priority:** MEDIUM · **Phase:** 1 (delivered)  
**As a** developer,  
**I want to** enable or disable notifications without uninstalling the extension,  
**so that** I can pause notifications when they are not needed.

**Acceptance Scenarios:**

- **AS-03a:** User runs "CopilotNotify: Disable". `copilotNotify.enabled` is set to `false`. Status bar shifts to "OFF". Subsequent participant completions do not fire notifications.
- **AS-03b:** User runs "CopilotNotify: Enable". `copilotNotify.enabled` is set to `true`. Status bar shifts to "ON" (or "Not Configured" if credentials are missing). Subsequent participant completions fire notifications.

---

### US-04 — Test notification command
**Priority:** MEDIUM · **Phase:** 1 (delivered)  
**As a** developer,  
**I want to** send a test notification from the Command Palette,  
**so that** I can verify my bot token and chat ID are correct before relying on participant notifications.

**Acceptance Scenarios:**

- **AS-04a (Happy path):** User runs "CopilotNotify: Send Test Notification". Extension dispatches a generic test message to Telegram. A VS Code information notification confirms success.
- **AS-04b (Not configured):** Either credential is missing. An inline VS Code warning notification explains which credential is absent. No network request is attempted.
- **AS-04c (API error):** Telegram returns an error. An inline VS Code warning notification surfaces the error code or description. Error is also logged to the Output Channel.

---

### US-05 — Generic status label in notification
**Priority:** MEDIUM · **Phase:** 1 (delivered)  
**As a** developer,  
**I want to** receive a clear, concise message in Telegram,  
**so that** I know the CopilotNotify task finished without exposing private context.

**Acceptance Scenarios:**

- **AS-05a:** Notification message contains: a static completion label, the VS Code workspace folder name (if available), and a timestamp.
- **AS-05b:** Notification message contains NO prompt text, NO code snippets, NO file contents, NO diffs.
- **AS-05c:** If no workspace folder is open, the workspace name field is omitted or replaced with a safe placeholder.

---

### US-06 — Status bar indicator
**Priority:** LOW · **Phase:** 1 (delivered)  
**As a** developer,  
**I want to** see the current notification state at a glance in the VS Code status bar,  
**so that** I know whether CopilotNotify is active, disabled, or needs configuration.

**Acceptance Scenarios:**

- **AS-06a:** Configured and enabled → status bar shows "🔔 Notify: ON".
- **AS-06b:** Disabled by user → status bar shows "🔕 Notify: OFF".
- **AS-06c:** Bot token or chat ID absent → status bar shows "⚠️ Notify: Not Configured".
- **AS-06d:** Clicking the status bar item opens the "CopilotNotify: Configure Telegram" command.

---

### Phase 2 Stories (Active)

### US-07 — Task duration in notification
**Priority:** HIGH · **Phase:** 2  
**As a** developer,  
**I want to** see how long the Copilot participant turn took in the notification message,  
**so that** I have context for how much processing occurred.

**Acceptance Scenarios:**

- **AS-07a (Default format):** With `messageFormat` set to `"default"`, the notification includes a human-readable duration (e.g., "12s") representing elapsed wall-clock time between when the participant handler was invoked and when it resolved.
- **AS-07b (Minimal format):** With `messageFormat` set to `"minimal"`, no duration field is included.
- **AS-07c (Sub-second turn):** Duration rounds to "0s" or "< 1s"; no negative or error value is produced.
- **AS-07d (Privacy):** Duration value is derived solely from wall-clock elapsed time; no prompt content or token count contributes to the value.

---

### US-08 — Participant-scope outcome in notification
**Priority:** HIGH · **Phase:** 2  
**As a** developer,  
**I want to** know whether my participant turn completed normally or was cancelled,  
**so that** I can take appropriate action if I accidentally stopped a long task.

**Acceptance Scenarios:**

- **AS-08a (Completed):** User does not cancel the participant turn. `token.isCancellationRequested` is `false` at handler resolution. Notification includes outcome "completed".
- **AS-08b (Cancelled):** User presses the stop button during the participant turn. `token.isCancellationRequested` is `true` at handler resolution. Notification includes outcome "cancelled".
- **AS-08c (Minimal format):** With `messageFormat` set to `"minimal"`, no outcome field is included regardless of cancellation state.
- **AS-08d (Privacy):** Outcome label is "completed" or "cancelled" only. No LLM quality indicator, no error code, no response content appears in the notification.

---

### US-09 — Outcome-based notification filtering
**Priority:** MEDIUM · **Phase:** 2  
**As a** developer,  
**I want to** control whether I receive notifications for completed turns, cancelled turns, or both,  
**so that** I can reduce notification noise for outcomes I don't care about.

**Acceptance Scenarios:**

- **AS-09a (Both on — default):** `notifyOnSuccess: true` and `notifyOnFailure: true`. Notifications fire for both completed and cancelled turns.
- **AS-09b (Success only):** `notifyOnFailure: false`. Cancelled turns produce no notification.
- **AS-09c (Failure only):** `notifyOnSuccess: false`. Completed turns produce no notification.
- **AS-09d (Both off):** `notifyOnSuccess: false` and `notifyOnFailure: false`. No notifications are dispatched. No error is shown; the extension is effectively silent. Suppression is logged to the Output Channel.
- **AS-09e (Terminology):** "success" = non-cancelled participant turn; "failure" = cancelled participant turn. No LLM-level error detection is implied.

---

### US-10 — Notification cooldown
**Priority:** MEDIUM · **Phase:** 2  
**As a** developer,  
**I want to** set a minimum interval between consecutive notifications,  
**so that** rapid successive participant turns don't flood my Telegram chat.

**Acceptance Scenarios:**

- **AS-10a (Default cooldown):** `cooldownSeconds` defaults to `5`. A second notification dispatched within 5 seconds of the prior one is suppressed. The suppression is logged to the Output Channel.
- **AS-10b (Cooldown = 0):** Cooldown is disabled; every eligible turn fires a notification.
- **AS-10c (Cooldown respected across outcomes):** Cooldown applies regardless of outcome. A suppressed notification is not replayed after the cooldown window expires.
- **AS-10d (Minimum enforced):** Setting `cooldownSeconds` to a negative value is treated as `0`; no error is thrown.

---

### US-11 — Message format variants
**Priority:** MEDIUM · **Phase:** 2  
**As a** developer,  
**I want to** choose between an enriched and a compact notification format,  
**so that** my notifications match my preferred verbosity.

**Acceptance Scenarios:**

- **AS-11a (Default format):** `messageFormat: "default"`. Notification includes: generic label, workspace name, duration, outcome, and ISO timestamp.
- **AS-11b (Minimal format):** `messageFormat: "minimal"`. Notification includes: generic label and ISO timestamp only.
- **AS-11c (Privacy — default format):** The `"default"` format never includes prompt text, code content, file names derived from prompts, or diff output.
- **AS-11d (Invalid value):** If `messageFormat` is set to an unrecognized string, the extension falls back to `"default"` and logs a warning to the Output Channel.

---

### Phase 3 Stories (Active — repo work only)

### US-12 — Project README
**Priority:** HIGH · **Phase:** 3  
**As a** contributor or new user,  
**I want to** find a clear README at the repository root,  
**so that** I can understand what CopilotNotify does, how to set it up, and how to configure it.

**Acceptance Scenarios:**

- **AS-12a:** README includes: project purpose, prerequisites (@BotFather setup, Telegram chat ID), installation or build steps, usage walkthrough, full configuration reference table covering all Phase 1 and Phase 2 settings, and known limitations.
- **AS-12b:** README does not contain placeholder sections, TODO markers, or stale Phase 1-only content after Phase 2 is specced.

---

### US-13 — Root CHANGELOG
**Priority:** MEDIUM · **Phase:** 3  
**As a** contributor or user,  
**I want to** find a `CHANGELOG.md` at the repository root,  
**so that** I can track what changed between releases.

**Acceptance Scenarios:**

- **AS-13a:** `CHANGELOG.md` exists at repository root (distinct from `specs/*/changelog.md`).
- **AS-13b:** Contains at least a v0.1.0 entry summarizing Phase 1 deliverables.
- **AS-13c:** Format follows Keep a Changelog conventions.

---

### US-14 — LICENSE file
**Priority:** MEDIUM · **Phase:** 3  
**As a** contributor or user,  
**I want to** find a LICENSE file at the repository root,  
**so that** the terms under which CopilotNotify can be used are clear.

**Acceptance Scenarios:**

- **AS-14a:** `LICENSE` exists at repository root.
- **AS-14b:** License type is MIT (consistent with publisher devbehkami open-source preference).
- **AS-14c:** Year and author match the project identity.

---

### US-15 — GitHub Actions CI workflow
**Priority:** MEDIUM · **Phase:** 3  
**As a** contributor,  
**I want to** have a CI workflow that automatically compiles, lints, and tests on every push and pull request,  
**so that** regressions are caught before code is merged.

**Acceptance Scenarios:**

- **AS-15a:** A workflow file exists under `.github/workflows/`.
- **AS-15b:** Triggers on `push` and `pull_request` to the main/default branch.
- **AS-15c:** Workflow runs at minimum: `npm install`, `npm run compile`, `npm run lint`, `npm run test`.
- **AS-15d:** Workflow completes without errors on the current passing codebase.

---

### US-16 — GitHub issue templates
**Priority:** LOW · **Phase:** 3  
**As a** contributor or user,  
**I want to** find structured issue templates when filing a bug or feature request,  
**so that** reports include the information needed to act on them.

**Acceptance Scenarios:**

- **AS-16a:** At least one bug report template and one feature request template exist in `.github/ISSUE_TEMPLATE/`.
- **AS-16b:** Bug template prompts for: VS Code version, extension version, OS, steps to reproduce, expected vs. actual behavior.
- **AS-16c:** Feature template prompts for: problem statement, proposed solution, alternatives considered.

---

### Carried Defect Fix

### DF-01 — tsconfig missing node types
**Priority:** HIGH (build integrity)  
**Description:** Two test files report missing type declarations for the Node.js `assert` module because `@types/node` is absent from the TypeScript configuration. This causes type errors in the test suite and may silently suppress legitimate type mismatches in Node.js built-ins.

**Fix scope:** Add `@types/node` to `devDependencies` (if not already present) and include `"node"` in the `"types"` array in `tsconfig.json` so that `assert` and other Node.js built-ins are correctly typed in test files. This is a build/configuration fix only; no logic changes are implied.

**Acceptance Scenarios:**

- **DF-01a:** After the fix, `npm run compile` produces zero TypeScript errors in test files that reference `assert`.
- **DF-01b:** The fix does not widen the type surface of production source files in a way that hides real type errors.

---

## 5. Edge Cases

*Derived from acceptance scenarios and constitution constraints across all active phases.*

| ID | Scenario | Expected Behavior |
|---|---|---|
| EC-01 | Setup wizard opened when credentials already exist | Wizard pre-fills chat ID (non-secret); bot token field is blank (SecretStorage value never pre-filled into UI) |
| EC-02 | Participant completes while extension host is under load | Notification dispatched asynchronously; no blocking on participant response |
| EC-03 | Bot token changed mid-session via wizard | Next notification uses updated token immediately (always read from SecretStorage at dispatch time) |
| EC-04 | Chat ID changed mid-session via settings.json | Next notification uses updated value (read from configuration at dispatch time) |
| EC-05 | Multiple rapid participant turns within cooldown window | First eligible turn fires; subsequent turns within `cooldownSeconds` are suppressed and logged to Output Channel |
| EC-06 | Network offline when notification fires | `fetch` rejects; error caught, logged to Output Channel; extension does not throw or crash |
| EC-07 | Telegram bot token is invalid (401 from API) | Error response body is logged; no credential is auto-cleared |
| EC-08 | Chat ID is a group or channel ID (not personal) | Extension is agnostic to ID format; dispatches to whatever ID is configured; no validation beyond non-empty check |
| EC-09 | Workspace with no open folder | Workspace name field is omitted or replaced with a safe placeholder |
| EC-10 | User escapes setup wizard after entering token but before chat ID | Neither credential is written; SecretStorage retains any prior token value |
| EC-11 | Extension activated with `enabled: false` in saved settings | Status bar shows "OFF" on startup; no participant listener fires notifications |
| EC-12 | Extension deactivated (VS Code window close) | Status bar item and participant are disposed cleanly via deactivate hook |
| EC-13 | Participant turn cancelled immediately (near-zero duration) | Duration rounds to "0s" or "< 1s"; outcome reported as "cancelled"; no error produced |
| EC-14 | `notifyOnSuccess: false` and `notifyOnFailure: false` simultaneously | No notification dispatched; no error shown; suppression logged to Output Channel |
| EC-15 | `cooldownSeconds` set to a negative value | Treated as `0` (cooldown disabled); no error thrown |
| EC-16 | `messageFormat` set to an unrecognized string value | Falls back to `"default"`; warning logged to Output Channel |
| EC-17 | Cooldown timer running when VS Code window closes | Cooldown state is not persisted; timer resets on next activation |
| EC-18 | Outcome filter suppresses a turn that would also have been suppressed by cooldown | Outcome filter is checked first; cooldown timer is not advanced for suppressed notifications |
| EC-19 | CI workflow runs when `npm run test` fails | Workflow fails and reports failure status on the PR/push; no silent pass |

---

## 6. Requirements

### 6.1 Functional Requirements

#### Phase 1 (Delivered)

| ID | Requirement |
|---|---|
| FR-01 | The extension MUST register a custom VS Code chat participant using the public `vscode.chat` API |
| FR-02 | The participant handler MUST dispatch a task-completion event when its `async` handler resolves after response streaming completes |
| FR-03 | On each eligible task-completion event (notifications enabled), the extension MUST dispatch an HTTPS POST to `api.telegram.org/bot<TOKEN>/sendMessage` using native `fetch` |
| FR-04 | The notification message body MUST contain at minimum: a static completion label, workspace folder name (or placeholder), and ISO timestamp |
| FR-05 | The notification message body MUST NOT contain prompt text, code content, file names derived from prompts, or diff output |
| FR-06 | The bot token MUST be stored exclusively in `vscode.SecretStorage` under the key `copilotNotify.botToken` |
| FR-07 | The chat ID MUST be stored in `vscode.workspace.getConfiguration('copilotNotify')` under the key `copilotNotify.telegramChatId` |
| FR-08 | The setup wizard MUST use sequential `vscode.window.showInputBox` calls; the token InputBox MUST set `password: true` |
| FR-09 | The extension MUST expose a "Send Test Notification" command that dispatches a generic test message and reports success or failure inline |
| FR-10 | The extension MUST expose enable and disable commands that toggle `copilotNotify.enabled` |
| FR-11 | The extension MUST display a status bar item reflecting three states: ON, OFF, Not Configured |
| FR-12 | The extension MUST expose a "Show Logs" command that reveals the CopilotNotify Output Channel |
| FR-13 | All Telegram API errors MUST be caught, logged to the Output Channel, and MUST NOT surface as unhandled exceptions or crash the extension host |

#### Phase 2 (Active)

| ID | Requirement |
|---|---|
| FR-14 | The participant handler MUST record a start timestamp at handler entry, before any async operations begin, and MUST compute elapsed duration as the wall-clock difference when the handler resolves |
| FR-15 | Duration MUST be derived solely from wall-clock elapsed time of the participant handler; no prompt content, token count, or LLM metadata may contribute to the value |
| FR-16 | The participant handler MUST read `token.isCancellationRequested` at handler-resolution time to determine outcome: `true` → "cancelled", `false` → "completed" |
| FR-17 | The outcome value in any notification payload MUST be limited to the strings "completed" and "cancelled"; no other outcome labels or LLM error codes are permitted |
| FR-18 | When `notifyOnSuccess` is `false` and outcome is "completed", the notification MUST be suppressed and the suppression logged |
| FR-19 | When `notifyOnFailure` is `false` and outcome is "cancelled", the notification MUST be suppressed and the suppression logged |
| FR-20 | `cooldownSeconds` MUST suppress any notification dispatched within `cooldownSeconds` seconds of the most recently *successfully dispatched* notification; the cooldown timer advances only when a notification is successfully dispatched to Telegram — notifications suppressed by an outcome filter or by the cooldown check itself do not advance the timer; `0` disables cooldown; negative values MUST be treated as `0` |
| FR-21 | All suppressed notifications (by outcome filter or cooldown) MUST be logged to the Output Channel with a suppression reason |
| FR-22 | When `messageFormat` is `"default"`, the notification payload MUST include: generic label, workspace name, duration, outcome, and ISO timestamp |
| FR-23 | When `messageFormat` is `"minimal"`, the notification payload MUST include: generic label and ISO timestamp only |
| FR-24 | When `messageFormat` is an unrecognized string, the extension MUST fall back to `"default"` and log a warning |
| FR-31 | Every Phase 2 setting (`notifyOnSuccess`, `notifyOnFailure`, `cooldownSeconds`, `messageFormat`) MUST be declared in `package.json` under `contributes.configuration` with the correct `type`, `default`, and `description` fields; a setting omitted from `contributes.configuration` will not appear in the VS Code Settings UI and will silently return `undefined` instead of its declared default |

#### Phase 2 — Defect Fix

| ID | Requirement |
|---|---|
| FR-25 | `tsconfig.json` MUST include node type declarations so that `assert` and other Node.js built-ins are correctly typed in test files; `npm run compile` MUST produce zero type errors in test files |

#### Phase 3 — Repo Foundation

| ID | Requirement |
|---|---|
| FR-26 | `README.md` MUST exist at repository root and include: project purpose, prerequisites, installation/build steps, usage walkthrough, and a full configuration reference table covering all Phase 1 and Phase 2 settings |
| FR-27 | `CHANGELOG.md` MUST exist at repository root following Keep a Changelog conventions and contain at least a v0.1.0 entry |
| FR-28 | `LICENSE` MUST exist at repository root with MIT license text, correct year, and author |
| FR-29 | A GitHub Actions CI workflow MUST exist under `.github/workflows/` and run `compile`, `lint`, and `test` on push and pull requests |
| FR-30 | Issue templates for bug reports and feature requests MUST exist in `.github/ISSUE_TEMPLATE/` |

### 6.2 Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | TypeScript strict mode (`"strict": true`); no `any` types; use `unknown` with explicit narrowing |
| NFR-02 | No external runtime dependencies beyond VS Code Extension API and built-in `fetch` |
| NFR-03 | Unit test coverage target: ≥ 80%; framework: Mocha + `@vscode/test-electron` |
| NFR-04 | No telemetry, analytics, or tracking of any kind |
| NFR-05 | Functions ≤ 50 lines; files ≤ 800 lines; all user-visible strings defined as named constants |

---

## 7. Configuration Schema

### Phase 1 (Delivered)

| Key | Storage | Type | Default | Notes |
|---|---|---|---|---|
| `copilotNotify.botToken` | `vscode.SecretStorage` | `string` | — | Never in settings.json |
| `copilotNotify.telegramChatId` | `settings.json` | `string` | `""` | Not a secret |
| `copilotNotify.enabled` | `settings.json` | `boolean` | `true` | Master on/off switch |

### Phase 2 (Active)

| Key | Storage | Type | Default | Constraint | Notes |
|---|---|---|---|---|---|
| `copilotNotify.notifyOnSuccess` | `settings.json` | `boolean` | `true` | — | When `false`, suppress notifications for "completed" outcomes |
| `copilotNotify.notifyOnFailure` | `settings.json` | `boolean` | `true` | — | When `false`, suppress notifications for "cancelled" outcomes |
| `copilotNotify.cooldownSeconds` | `settings.json` | `integer` | `5` | min `0` | Minimum seconds between dispatched notifications; `0` disables |
| `copilotNotify.messageFormat` | `settings.json` | `"default" \| "minimal"` | `"default"` | Fallback to `"default"` on invalid value | Controls notification verbosity |

**Eliminated:** `includeTaskSummary` — removed from all phases; privacy constraint makes a meaningful summary impossible without exposing prompt content.

> **Implementation requirement — `package.json` registration:** Every Phase 2 setting listed in the table above MUST be declared in `package.json` under `contributes.configuration` with the correct `type`, `default`, and `description` fields. This is mandatory: a setting that is read by `configManager.ts` but absent from `contributes.configuration` will not appear in the VS Code Settings UI and will silently return `undefined` instead of its declared default. Phase 1 settings already satisfy this requirement; the mandate applies to all new settings added in Phase 2 and beyond.

---

## 8. High-Level Implementation Intent

*Module-level intent only; class names, method signatures, and internal design are left to the implementer.*

| Module | Responsibility |
|---|---|
| `src/extension.ts` | Entry point; registers participant, commands, status bar; reads initial configuration on activation; disposes all registrations on deactivation |
| `src/participant.ts` | Registers the custom chat participant; records start time when handler is invoked; reads `token.isCancellationRequested` and computes duration when handler resolves; passes enriched metadata (duration, outcome) to notifier |
| `src/notifier.ts` | Applies outcome filter (`notifyOnSuccess`/`notifyOnFailure`) and cooldown check; builds notification payload per `messageFormat`; dispatches HTTPS POST to Telegram Bot API via native `fetch`; logs suppressions and errors |
| `src/secretManager.ts` | Wraps `vscode.SecretStorage` for bot token get/set operations |
| `src/configManager.ts` | Wraps `vscode.workspace.getConfiguration` for all settings reads and writes including Phase 2 settings |
| `src/statusBar.ts` | Manages the status bar item lifecycle and state transitions (ON / OFF / Not Configured) |
| `src/constants.ts` | All named string constants: command IDs, config keys, message labels, outcome strings, SecretStorage key, output channel name |

Phase 3 artifacts (README, CHANGELOG, LICENSE, CI workflow, issue templates) are repository files, not TypeScript source modules.

---

## 9. Success Criteria

### Phase 1 (Delivered — must not regress)

| Criterion | Verification |
|---|---|
| SC-01 | Setup wizard stores bot token in SecretStorage and chat ID in settings; wizard is cancellable without side effects | Manual test + unit test |
| SC-02 | Invoking the custom participant triggers a Telegram notification with generic label and no prompt/code content | Manual test + unit test (mocked fetch) |
| SC-03 | Notifications suppressed when `enabled` is `false` | Unit test |
| SC-04 | Test notification command confirms success or reports error inline; no unhandled thrown errors | Manual test + unit test |
| SC-05 | Status bar transitions correctly between all three states | Unit test |
| SC-06 | Telegram API errors caught and logged; extension host does not crash | Unit test (mocked fetch with error) |
| SC-07 | No private or internal VS Code/Copilot APIs used | Code review |
| SC-08 | Unit test coverage ≥ 80% | `npm run test` coverage report |
| SC-09 | TypeScript compiles with zero errors under strict mode | `npm run compile` |
| SC-10 | Extension packages without errors | `vsce package` |

### Phase 2 (Active)

| Criterion | Verification |
|---|---|
| SC-11 | `"default"` format notification includes duration, outcome, workspace name, and ISO timestamp; no prompt/code content | Unit test (mocked participant invocation) |
| SC-12 | `"minimal"` format notification includes only generic label and ISO timestamp | Unit test |
| SC-13 | `notifyOnSuccess: false` suppresses "completed" turn notifications; suppression is logged to Output Channel | Unit test |
| SC-14 | `notifyOnFailure: false` suppresses "cancelled" turn notifications; suppression is logged to Output Channel | Unit test |
| SC-15 | `cooldownSeconds: 5` suppresses a second notification fired within 5 seconds; suppression is logged | Unit test |
| SC-16 | `cooldownSeconds: 0` disables cooldown; all eligible turns fire | Unit test |
| SC-17 | Unrecognized `messageFormat` value falls back to `"default"`; warning is logged | Unit test |
| SC-18 | `tsconfig.json` node types fix: `npm run compile` produces zero errors in test files referencing `assert` | `npm run compile` |
| SC-24 | All four Phase 2 settings (`notifyOnSuccess`, `notifyOnFailure`, `cooldownSeconds`, `messageFormat`) are present in `package.json` `contributes.configuration` with correct `type`, `default`, and `description` fields | Code review / `package.json` inspection |

### Phase 3 (Active)

| Criterion | Verification |
|---|---|
| SC-19 | `README.md` exists at repository root and covers all required sections including Phase 2 configuration | Manual review |
| SC-20 | Root `CHANGELOG.md` exists with at least a v0.1.0 entry in Keep a Changelog format | Manual review |
| SC-21 | `LICENSE` file exists at root with MIT license, correct year, and author | Manual review |
| SC-22 | CI workflow triggers on push/PR and runs compile, lint, and test without error on the current codebase | GitHub Actions / manual |
| SC-23 | At least one bug report template and one feature request template exist in `.github/ISSUE_TEMPLATE/` | Manual review |

---

## 10. Known Limitations

1. **Passive Copilot detection is not possible.** The extension cannot observe Copilot Edits, Copilot Workspace, or background Copilot agent usage via public APIs. Users must explicitly invoke the CopilotNotify participant (e.g., `@copilotnotify`) to receive a notification.
2. **Outcome is participant-scope only.** "Completed" and "cancelled" reflect only whether the VS Code cancellation token was set when the participant handler resolved — not LLM response quality, streaming errors, or internal Copilot job status.
3. **Duration is participant-turn wall clock only.** Duration reflects elapsed time from handler invocation to handler resolution. It includes streaming and network latency; it does not reflect actual LLM compute time independently.
4. **Task summary is a static label.** The notification does not describe what the Copilot task did — by design, to protect user privacy.
5. **Single notification channel.** Only Telegram is supported. (Slack, Discord deferred to Phase 4.)
6. **One bot per installation.** The configuration supports one bot token and one chat ID per VS Code instance; multi-destination dispatch is out of scope.
7. **Cooldown is in-memory only.** Cooldown state is not persisted; it resets whenever VS Code closes or the extension is reloaded.

---

## 11. Assumptions

1. The `vscode.chat` participant API is available in the targeted VS Code version and stable enough for Phase 2 development.
2. The Telegram Bot API (`api.telegram.org`) is accessible from the user's machine without special firewall rules; the extension makes no attempt to tunnel or proxy.
3. The user has already created a Telegram bot via @BotFather and knows their chat ID; the setup wizard provides inline guidance but does not auto-detect the chat ID.
4. Native `fetch` is available in the VS Code extension host runtime.
5. Registering Phase 2 settings in `package.json` under `contributes.configuration` (see the mandatory implementation requirement in Section 7) is additive: existing installations where no explicit value is configured will receive the declared defaults and are not affected by the additions.
6. `token.isCancellationRequested` reliably reflects user-initiated cancellation (stop button) at participant-handler-resolution time.

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
| Privacy-first: no prompt/code transmission | C-03, FR-05, FR-17 |
| Duration and outcome: participant-turn metadata only | C-01, C-02, FR-14, FR-15, FR-16 |
