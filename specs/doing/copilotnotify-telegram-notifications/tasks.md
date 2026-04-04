# Tasks: CopilotNotify — Phase 2 Enriched Notifications + Phase 3 Repo Foundation

**Spec:** `specs/done/copilotnotify-telegram-notifications/spec.md`  
**Plan:** `specs/done/copilotnotify-telegram-notifications/plan.md`  
**Route:** related-revise — Phase 1 delivered (T001–T022 complete); this task list covers Phase 2 + Phase 3 revision work only.

---

## Phase 1: Defect Fix + Build Configuration

Carry the DF-01 build defect forward and establish the version and configuration prerequisites before any source-code changes begin. T001 (`tsconfig.json`) and T002 (`package.json`) touch different files, share no state, and are parallel-safe.

- [ ] T001 [P] [DF-01] Fix `tsconfig.json`: add `"node"` to `compilerOptions.types` (alongside any existing entries, or as `["node"]` if the array is absent) so that `assert` and other Node.js built-ins are correctly typed in test files. If any source file contains a standalone `declare function fetch(...)` or `declare const fetch: ...` declaration (sometimes added to satisfy strict-mode in earlier drafts), remove it — the `lib` settings plus `@types/node` provide the correct built-in `fetch` typing without a conflicting local declaration. Verify `devDependencies` in `package.json` includes `"@types/node"` — if absent, that addition is handled in T002. After this change `npm run compile` must produce zero TypeScript errors in any test file that references `assert` — satisfies DF-01, FR-25 — file: `tsconfig.json`

- [ ] T002 [P] Update `package.json`: (1) bump `"version"` from `"0.1.0"` to `"0.2.0"`; (2) add `"@types/node"` to `devDependencies` if absent (version compatible with current TypeScript and VS Code engine targets); (3) add four new entries to `contributes.configuration.properties`: `"copilotNotify.notifyOnSuccess"` (`type: "boolean"`, `default: true`, `description: "Send notification when the participant turn completes normally."`), `"copilotNotify.notifyOnFailure"` (`type: "boolean"`, `default: true`, `description: "Send notification when the participant turn is cancelled."`), `"copilotNotify.cooldownSeconds"` (`type: "integer"`, `default: 5`, `minimum: 0`, `description: "Minimum seconds between notifications. Set to 0 to disable cooldown."`), `"copilotNotify.messageFormat"` (`type: "string"`, `enum: ["default", "minimal"]`, `default: "default"`, `description: "Notification verbosity. 'default' includes duration and outcome; 'minimal' includes only label and timestamp."`). These registrations are mandatory: a setting absent from `contributes.configuration` silently returns `undefined` instead of its declared default — satisfies FR-31 — file: `package.json`

---

## Phase 2: Foundation Layer (Blocking Prerequisites)

`src/constants.ts` has no inter-module dependencies and must be updated before any other Phase 2 source module is modified — every subsequent module that needs the new strings imports from it. Blocked on Phase 1 for project integrity; the constants edit itself is a standalone additive change.

- [ ] T003 Add new named string constants to `src/constants.ts` — no Phase 1 constants may be removed or renamed. Add the following groups: (1) config key constants: `CONFIG_NOTIFY_ON_SUCCESS = 'notifyOnSuccess'`, `CONFIG_NOTIFY_ON_FAILURE = 'notifyOnFailure'`, `CONFIG_COOLDOWN_SECONDS = 'cooldownSeconds'`, `CONFIG_MESSAGE_FORMAT = 'messageFormat'`; (2) outcome strings: `OUTCOME_COMPLETED = 'completed'`, `OUTCOME_CANCELLED = 'cancelled'`; (3) format strings: `FORMAT_DEFAULT = 'default'`, `FORMAT_MINIMAL = 'minimal'`; (4) suppression log messages: `SUPPRESSED_OUTCOME_SUCCESS` (e.g., `"[CopilotNotify] Notification suppressed — notifyOnSuccess is false"`), `SUPPRESSED_OUTCOME_FAILURE` (e.g., `"[CopilotNotify] Notification suppressed — notifyOnFailure is false"`), `SUPPRESSED_COOLDOWN` (base string without the seconds suffix, e.g., `"[CopilotNotify] Notification suppressed — cooldown active"` — caller appends remaining seconds at log time); (5) format fallback warning: `WARN_UNKNOWN_FORMAT = "[CopilotNotify] Unknown messageFormat value; falling back to 'default'"`. If `WARN_MISSING_BOT_TOKEN` or `WARN_MISSING_CHAT_ID` are currently inline literals in `extension.ts`, add them here so Phase 6 can replace the literals with constants — satisfies FR-17, FR-18, FR-19, FR-20, FR-21, FR-24 — file: `src/constants.ts`

---

## Phase 3: [US-09 + US-10 + US-11] ConfigManager Getters

`configManager.ts` depends on the new constants (T003). The four getters enable all Phase 2 config-driven behavior. The factory signature gains an `outputChannel` parameter (required for the `getMessageFormat` fallback warning log) — this change propagates to the `extension.ts` call site in Phase 6.

- [ ] T004 [US-09 + US-10 + US-11] Extend `src/configManager.ts`: (1) update the `ConfigManager` interface to declare four new read-only getters: `getNotifyOnSuccess(): boolean`, `getNotifyOnFailure(): boolean`, `getCooldownSeconds(): number`, `getMessageFormat(): 'default' | 'minimal'`; (2) update factory signature to `createConfigManager(outputChannel: vscode.OutputChannel): ConfigManager` — `outputChannel` is needed only by `getMessageFormat` to log the fallback warning; (3) implement each getter reading `vscode.workspace.getConfiguration('copilotNotify')` on every call, no caching: `getNotifyOnSuccess` → `config.get<boolean>(CONFIG_NOTIFY_ON_SUCCESS, true)`; `getNotifyOnFailure` → `config.get<boolean>(CONFIG_NOTIFY_ON_FAILURE, true)`; `getCooldownSeconds` → `Math.max(0, Math.floor(config.get<number>(CONFIG_COOLDOWN_SECONDS, 5)))` — coerces negative values to `0` and floors fractional values; `getMessageFormat` → reads raw value; if `'default'` or `'minimal'` returns it directly; otherwise logs `WARN_UNKNOWN_FORMAT` to outputChannel and returns `'default'`. Phase 1 getters (`getChatId`, `getEnabled`, `setChatId`, `setEnabled`) are unchanged — satisfies FR-18, FR-19, FR-20, FR-24, EC-15, EC-16 — file: `src/configManager.ts`

---

## Phase 4: [US-07 + US-08 + US-09 + US-10 + US-11] Notifier Enrichment

`notifier.ts` is the most substantial Phase 2 change. It depends on updated constants (T003) and the revised `ConfigManager` interface (T004). The factory signature change propagates to `extension.ts` in Phase 6.

- [ ] T005 [US-07 + US-08 + US-09 + US-10 + US-11] Extend `src/notifier.ts`: (1) update factory signature to `createNotifier(outputChannel: vscode.OutputChannel, config: ConfigManager): Notifier` — `config` is read for all Phase 2 settings at dispatch time; (2) add `lastDispatchedAt: number | undefined` to the factory closure, initialized to `undefined`; (3) introduce (`NotificationTaskMetadata` type) `{ readonly durationSeconds: number; readonly outcome: 'completed' | 'cancelled' }`; (4) extend `NotificationPayload` with optional `readonly durationSeconds?: number` and `readonly outcome?: 'completed' | 'cancelled'` fields; (5) update `buildPayload(metadata: NotificationTaskMetadata): NotificationPayload` to populate `durationSeconds` and `outcome` from the metadata argument alongside the existing label, workspaceName, and timestamp fields; (6) update `formatMessage(payload: NotificationPayload, format: 'default' | 'minimal'): string` — `'default'`: label + workspace line (omitted when `workspaceName` is `undefined`) + `Duration: <N>s` + `Outcome: <outcome>` + ISO timestamp; `'minimal'`: label + ISO timestamp only — `formatMessage` must remain a pure function accepting both arguments explicitly (no config reads inside); (7) update `sendNotification(token: string, chatId: string, metadata: NotificationTaskMetadata): Promise<NotificationResult>` with these ordered steps: (a) outcome filter — if `metadata.outcome === 'completed'` and `!config.getNotifyOnSuccess()` log `SUPPRESSED_OUTCOME_SUCCESS` and return `{ success: true }` without advancing `lastDispatchedAt`; if `metadata.outcome === 'cancelled'` and `!config.getNotifyOnFailure()` log `SUPPRESSED_OUTCOME_FAILURE` and return `{ success: true }` without advancing `lastDispatchedAt`; (b) cooldown check — if `config.getCooldownSeconds() > 0` and `lastDispatchedAt` is set and `(Date.now() - lastDispatchedAt) / 1000 < config.getCooldownSeconds()` log `SUPPRESSED_COOLDOWN` with remaining seconds and return `{ success: true }` without advancing `lastDispatchedAt`; (c) read `config.getMessageFormat()`, build payload via `buildPayload(metadata)`, format via `formatMessage(payload, format)`, dispatch `fetch` POST; (d) on `response.ok === true`: set `lastDispatchedAt = Date.now()` and return `{ success: true }`; (e) on error: return `{ success: false, errorMessage }` — `lastDispatchedAt` NOT advanced on any error path; (8) add `sendTestNotification(token: string, chatId: string): Promise<NotificationResult>` — constructs a fixed generic test message (label + ISO timestamp using constants; same structure as minimal format), dispatches `fetch` POST directly, bypasses outcome filter, cooldown check, and `lastDispatchedAt` advancement — satisfies FR-14, FR-15, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, AS-09a–e, AS-10a–d, AS-11a–d, EC-05, EC-13, EC-14, EC-15, EC-16, EC-17, EC-18 — file: `src/notifier.ts`

---

## Phase 5: [US-07 + US-08] Participant Metadata

`participant.ts` handler body changes depend on the updated `Notifier` interface (T005). The exported `buildTaskMetadata` pure helper is the primary addition and the main testable unit. Wizard logic and `registerParticipant` signature are unchanged.

- [ ] T006 [US-07 + US-08] Extend `src/participant.ts`: (1) export `buildTaskMetadata(startTime: number, endTime: number, token: vscode.CancellationToken): NotificationTaskMetadata` as a pure function — `durationSeconds = Math.floor((endTime - startTime) / 1000)` (sub-second elapsed rounds to `0`; result is always `>= 0`); `outcome = token.isCancellationRequested ? OUTCOME_CANCELLED : OUTCOME_COMPLETED` using constants; (2) update the participant handler inside `registerParticipant` — capture `const startTime = Date.now()` as the first statement of the handler body before any `await`; after response streaming resolves: `const endTime = Date.now()`; `const metadata = buildTaskMetadata(startTime, endTime, token)` — note: `token` here is the `vscode.CancellationToken` provided by the chat participant callback signature, not the Telegram bot token; (3) pass `metadata` as the third argument to `void notifier.sendNotification(telegramToken, chatId, metadata).then(result => { if (!result.success) { outputChannel.appendLine(result.errorMessage); } })`. All other handler logic (enabled check, credential presence check, fire-and-forget pattern, `response.markdown` call) is unchanged — satisfies FR-14, FR-15, FR-16, FR-17, AS-07a–d, AS-08a–d, EC-13 — file: `src/participant.ts`

---

## Phase 6: Extension Wiring

Call-site updates only — all implementation logic lives in the modules modified in Phases 2–5. Phase 6 is blocked on Phases 3–5 because factory signatures changed.

- [ ] T007 Update `src/extension.ts`: (1) update the `createConfigManager(...)` call site to pass `outputChannel` as the argument (factory signature changed in T004); (2) update the `createNotifier(...)` call site to pass `(outputChannel, configManager)` as two arguments (factory signature changed in T005); (3) update the `copilotNotify.sendTest` command handler to call `notifier.sendTestNotification(token, chatId)` instead of the old `notifier.sendNotification(token, chatId)` — no `metadata` argument exists for a test notification; (4) if any inline string literals for missing-credential warnings exist in the `sendTest` handler, replace them with the named constants `WARN_MISSING_BOT_TOKEN` / `WARN_MISSING_CHAT_ID` from `src/constants.ts`. No other changes to command registrations, `activate` lifecycle, status bar logic, enable/disable, or wiring — satisfies FR-09, EC-12 — file: `src/extension.ts`

---

## Phase 7: Test Updates

T008, T009, and T010 each depend on a separate implementation phase and touch separate test files with no shared runtime state — they are parallel-safe relative to each other. Each is blocked on its paired implementation.

- [ ] T008 [P] [US-09 + US-10 + US-11] Extend `test/suite/configManager.test.ts` with four new getter test groups. Extend the existing `vscode.workspace.getConfiguration` stub to supply configurable Phase 2 values. Cases to add: (1) `getNotifyOnSuccess()` — returns `true` when config returns undefined (default); returns `false` when config returns `false`; (2) `getNotifyOnFailure()` — same pattern; (3) `getCooldownSeconds()` — default `5`; negative input (e.g., `-3`) → coerced to `0`; fractional input (e.g., `2.7`) → floored to `2`; zero preserved as `0`; (4) `getMessageFormat()` — `'default'` returned when config value is `'default'`; `'minimal'` returned when config value is `'minimal'`; unrecognized string (e.g., `'verbose'`) returns `'default'` and the output channel spy receives the `WARN_UNKNOWN_FORMAT` constant value. Depends on T004 — file: `test/suite/configManager.test.ts`

- [ ] T009 [P] [US-07 + US-08 + US-09 + US-10 + US-11] Extend `test/suite/notifier.test.ts` with Phase 2 test cases. Use a configManager stub that returns configurable Phase 2 config values; extend the `fetch` stub per test. Cases to add: (1) `buildPayload(metadata)` with valid metadata → returned payload has `durationSeconds` and `outcome` populated; (2) `formatMessage(payload, 'default')` output contains workspace line, `Duration: <N>s` line, `Outcome: <outcome>` line, and ISO timestamp; (3) `formatMessage(payload, 'minimal')` output contains only label and ISO timestamp — no duration line, no outcome line; (4) `formatMessage(payload, 'default')` with `workspaceName: undefined` → workspace line absent; (5) `sendNotification` with `notifyOnSuccess: false` and `outcome: 'completed'` → fetch not called, returns `{ success: true }`, suppression string logged to output channel; (6) `sendNotification` with `notifyOnFailure: false` and `outcome: 'cancelled'` → fetch not called, returns `{ success: true }`, suppression string logged; (7) cooldown: first call dispatches (fetch called once), second call within window → fetch not called on second call, returns `{ success: true }`, output channel spy receives a string that *contains* `SUPPRESSED_COOLDOWN` (exact-equality match is not valid — remaining seconds are appended dynamically by the caller, so assert `logged.includes(SUPPRESSED_COOLDOWN)`); (8) cooldown elapsed — create a fresh notifier instance (its `lastDispatchedAt` is initialized to `undefined`, so no window is active) rather than using clock manipulation or accessing private closure state → fetch called normally on the very first `sendNotification` call against that instance; (9) cooldown timer NOT advanced when Telegram returns `response.ok === false` — verify by confirming the next call within what would have been the extended window still dispatches; (10) cooldown timer NOT advanced when outcome filter suppresses — verify the immediately following real notification dispatches; (11) `sendTestNotification` → fetch called exactly once; a `sendNotification` call immediately after is NOT suppressed by cooldown (timer was not advanced by the test path). Depends on T005 — file: `test/suite/notifier.test.ts`

- [ ] T010 [P] [US-07 + US-08] Create `test/suite/participant.test.ts` — unit tests for the exported `buildTaskMetadata` pure helper (the full `registerParticipant` handler is not directly unit-testable; the helper is the testable extraction). Provide a `vscode.CancellationToken` stub as a plain object `{ isCancellationRequested: boolean }`. Test cases: (1) `isCancellationRequested: false`, multi-second elapsed (start `0`, end `12000`) → `{ durationSeconds: 12, outcome: 'completed' }`; (2) `isCancellationRequested: true`, multi-second elapsed (start `0`, end `12000`) → `{ durationSeconds: 12, outcome: 'cancelled' }`; (3) zero elapsed (`startTime === endTime`) → `durationSeconds: 0`; (4) sub-second elapsed (`start: 0`, `end: 800`) → `durationSeconds: 0` — floors to zero, never negative. Depends on T006 — file: `test/suite/participant.test.ts`

---

## Phase 8: [US-12 + US-13 + US-14 + US-15 + US-16] Phase 3 Repo Foundation

All five tasks are repository documentation and configuration files. They have no TypeScript source dependencies, share no state with each other, and are parallel-safe as a group. They may be authored concurrently with Phase 7.

- [ ] T011 [P] [US-12] Create `README.md` at the repository root. Must include: (1) project purpose — what CopilotNotify is, how detection works (custom chat participant turn only, not passive Copilot background observation), and the privacy model (no prompt text or code content in notifications); (2) prerequisites — setting up a Telegram bot via @BotFather, obtaining a chat ID, VS Code ≥ 1.90.0; (3) build and installation steps — `npm install`, `npm run compile`, launch via `.vscode/launch.json`; (4) usage walkthrough — run "CopilotNotify: Configure Telegram" from the Command Palette, invoke `@copilotnotify` in the VS Code Chat panel, receive Telegram notification; (5) full configuration reference table covering all six settings declared in `package.json` — Phase 1 (`copilotNotify.enabled`, `copilotNotify.telegramChatId`) and Phase 2 (`copilotNotify.notifyOnSuccess`, `copilotNotify.notifyOnFailure`, `copilotNotify.cooldownSeconds`, `copilotNotify.messageFormat`) — with Type, Default, and Description columns; (6) known limitations section noting participant-turn scope only (no passive background detection), Telegram only, single workspace. Must not contain placeholder sections, `TODO` markers, or Phase 1-only stale content — satisfies FR-26, AS-12a–b — file: `README.md`

- [ ] T012 [P] [US-13] Create `CHANGELOG.md` at the repository root following Keep a Changelog conventions. Required sections: `[Unreleased]` (empty or with any post-v0.2.0 pending items); `[0.2.0] - 2026-04-04` summarizing Phase 2 additions (enriched notification payload, task duration, participant outcome, `notifyOnSuccess`/`notifyOnFailure` filters, `cooldownSeconds`, `messageFormat` variants), the DF-01 tsconfig defect fix, and Phase 3 repo work (README, CHANGELOG, LICENSE, CI workflow, issue templates); `[0.1.0] - 2026-04-03` summarizing Phase 1 deliverables (custom participant, Telegram setup wizard, test notification command, enable/disable, status bar, Output Channel). This file lives at the repository root and is distinct from any `specs/*/changelog.md` — satisfies FR-27, AS-13a–c — file: `CHANGELOG.md`

- [ ] T013 [P] [US-14] Create `LICENSE` at the repository root with full MIT license text. Year: `2026`. Author/copyright holder: consistent with `publisher: devbehkami` / `Amir Ranjbar` project identity — satisfies FR-28, AS-14a–c — file: `LICENSE`

- [ ] T014 [P] [US-15] Create `.github/workflows/ci.yml` — GitHub Actions CI workflow: (1) `on: push` and `pull_request` targeting the default branch; (2) single job `build` using `ubuntu-latest` runner; (3) steps in order: `actions/checkout@v4`, `actions/setup-node@v4` with LTS Node.js, `sudo apt-get install -y xvfb` (Xvfb is required because `@vscode/test-electron` launches a real VS Code window on Linux; the test step will fail with a display error without it), `npm install`, `npm run compile`, `npm run lint`, `xvfb-run -a npm run test`. The workflow must complete without errors on the passing codebase produced by all prior phases — satisfies FR-29, AS-15a–d, EC-19 — file: `.github/workflows/ci.yml`

- [ ] T015 [P] [US-16] Create two issue templates in `.github/ISSUE_TEMPLATE/`: (1) `bug_report.md` — frontmatter `name: Bug report`, `about: Report a defect in CopilotNotify`, `labels: bug`; body prompts for: VS Code version, extension version, OS, steps to reproduce, expected behavior, actual behavior; (2) `feature_request.md` — frontmatter `name: Feature request`, `about: Suggest an enhancement`, `labels: enhancement`; body prompts for: problem statement, proposed solution, alternatives considered. Templates must not contain filler placeholder sections unrelated to CopilotNotify — satisfies FR-30, AS-16a–c — files: `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`

---

## Final Phase: Polish & Cross-Cutting

T016 (compile) must complete before T017 (test). T018 (package) requires a passing compile and may run in parallel with T017 once T016 is green.

- [ ] T016 Build checkpoint: run `npm run compile` (`tsc -p ./`). All TypeScript sources must compile with zero errors under `strict: true`. If T001 was applied correctly, test files referencing `assert` must compile cleanly and any removed `declare function fetch` must not leave unresolved type errors. Diagnose and fix any remaining emit errors in `src/*.ts` or `test/suite/*.ts` before proceeding — satisfies DF-01a, DF-01b, SC-09, NFR-01 — files: `tsconfig.json`, `src/*.ts`, `test/suite/*.ts`

- [ ] T017 Test checkpoint: run `npm run test`. All Mocha cases in `test/suite/` must pass — including Phase 2 additions from T008–T010 and the complete Phase 1 regression suite (wizard, secretManager, statusBar, original notifier, configManager, and participant cases). Verify unit test line coverage ≥ 80% across `src/configManager.ts`, `src/notifier.ts`, and `src/participant.ts` (Phase 2 branches must be exercised). Fix any failing cases before T018 — satisfies SC-08, NFR-03 — files: `test/suite/*.test.ts`

- [ ] T018 [P] Package checkpoint: run `npx vsce package`. Zero packaging errors expected; verify the produced `.vsix` has version `0.2.0`, 5 commands, 1 chat participant, and 6 configuration properties (2 Phase 1 + 4 Phase 2) in its manifest — satisfies SC-10 — files: `.vscodeignore`, `package.json`

---

**Coverage Check**

| Acceptance Scenario | Covered By |
|---|---|
| DF-01a: `npm run compile` produces zero errors in test files after tsconfig fix | T001, T016 |
| DF-01b: fix does not widen type surface of production source files | T001, T016 |
| AS-07a: default format includes human-readable duration | T005, T009 |
| AS-07b: minimal format excludes duration | T005, T009 |
| AS-07c: sub-second elapsed → durationSeconds 0; no negative value | T006, T010 |
| AS-07d: duration is wall-clock participant-turn time only; no prompt content | T006 *(implementation constraint)* |
| AS-08a: non-cancelled turn → outcome "completed" in notification | T006, T010 |
| AS-08b: cancelled turn → outcome "cancelled" in notification | T006, T010 |
| AS-08c: minimal format excludes outcome regardless of cancellation state | T005, T009 |
| AS-08d: outcome is "completed" or "cancelled" only; no other labels | T003, T006 |
| AS-09a: both filters true (default) — both outcomes notify | T005, T009 |
| AS-09b: notifyOnFailure false — cancelled turns suppressed | T004, T005, T008, T009 |
| AS-09c: notifyOnSuccess false — completed turns suppressed | T004, T005, T008, T009 |
| AS-09d: both filters false — no notifications dispatched; suppression logged | T005, T009 |
| AS-09e: "success"/"failure" terminology scoped to participant-turn only | T003, T006 *(by implementation)* |
| AS-10a: default cooldown 5s — second notification within window suppressed | T004, T005, T009 |
| AS-10b: cooldownSeconds 0 — every eligible turn fires | T004, T005, T009 |
| AS-10c: cooldown applies regardless of outcome; suppressed turn not replayed | T005, T009 |
| AS-10d: negative cooldownSeconds treated as 0; no error thrown | T004, T008 |
| AS-11a: default format has label + workspace + duration + outcome + timestamp | T005, T009 |
| AS-11b: minimal format has label + timestamp only | T005, T009 |
| AS-11c: default format never includes prompt text or code content | T005 *(implementation constraint)* |
| AS-11d: unrecognized messageFormat falls back to "default" + warning logged | T004, T008 |
| AS-12a: README has purpose, prerequisites, install, usage, config table, known limitations | T011 |
| AS-12b: README contains no TODO markers or Phase 1-only stale content | T011 |
| AS-13a: CHANGELOG.md exists at repository root | T012 |
| AS-13b: v0.1.0 entry present | T012 |
| AS-13c: Keep a Changelog format followed | T012 |
| AS-14a: LICENSE exists at repository root | T013 |
| AS-14b: License is MIT | T013 |
| AS-14c: Year and author match project identity | T013 |
| AS-15a: workflow file exists under `.github/workflows/` | T014 |
| AS-15b: triggers on push and pull_request | T014 |
| AS-15c: workflow runs npm install, compile, lint, test | T014 |
| AS-15d: workflow completes without errors on passing codebase | T014, T017 |
| AS-16a: bug report and feature request templates exist | T015 |
| AS-16b: bug template prompts for VS Code version, OS, steps, expected/actual | T015 |
| AS-16c: feature template prompts for problem statement, solution, alternatives | T015 |

| Phase 1 Regression | Covered By |
|---|---|
| AS-01a–d: wizard happy path, cancellation, validation, password mask | T016 *(impl unchanged)*, T017 |
| AS-02a–d: participant notification — happy path, disabled, not configured, Telegram error | T016 *(factory sig only)*, T017 |
| AS-03a–b: enable/disable commands and status bar updates | T016 *(unchanged)*, T017 |
| AS-04a–c: sendTest — happy path, not configured, API error | T007 *(sendTestNotification call)*, T017 |
| AS-05a–c: generic message content — no code/prompt, no-workspace fallback | T005 *(format contract preserved)*, T017 |
| AS-06a–d: status bar states and configure-on-click | T016 *(unchanged)*, T017 |

| Success Criterion | Covered By |
|---|---|
| SC-08: unit test coverage ≥ 80% | T017 |
| SC-09: TypeScript compiles with zero errors under strict | T001, T016 |
| SC-10: extension packages without errors; correct v0.2.0 manifest | T018 |

| Edge Case (Phase 2) | Covered By |
|---|---|
| EC-05: rapid turns within cooldown — first fires; subsequent suppressed and logged | T005, T009 |
| EC-13: near-zero duration → 0s; outcome "cancelled" valid | T006, T010 |
| EC-14: both filters false — no dispatch; no error surfaced to user | T005, T009 |
| EC-15: negative cooldownSeconds → 0; no error thrown | T004, T008 |
| EC-16: unrecognized messageFormat → "default" + warning logged | T004, T008 |
| EC-17: cooldown state not persisted — resets on extension host restart | T005 *(in-memory closure; no persistence written)* |
| EC-18: outcome filter checked before cooldown; timer not advanced for filtered notifications | T005, T009 |
| EC-19: CI workflow fails when `npm run test` fails | T014 |

**Unmapped Scenarios:** None. All active Phase 2 acceptance scenarios (AS-07a–AS-11d), all Phase 3 scenarios (AS-12a–AS-16c), the carried defect fix scenarios (DF-01a–b), all active Phase 2 edge cases (EC-05, EC-13–EC-19), and all active success criteria (SC-08–SC-10) are covered by at least one task. Phase 1 regression is exercised by the T017 test checkpoint, which runs the complete Mocha suite.
