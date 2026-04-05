# Tasks: CopilotNotify — Phase 2 Enriched Notifications + Phase 3 Repo Foundation

**Spec:** `specs/doing/copilotnotify-telegram-notifications/spec.md`  
**Plan:** `specs/doing/copilotnotify-telegram-notifications/plan.md`  
**Route:** related-revise — Phase 1 delivered (all prior tasks complete); this task list covers Phase 2 + feasible Phase 3 work only

---

## Phase 1: Setup

Fix the carried build-configuration defect (DF-01) and extend the extension manifest for Phase 2 settings. Both tasks write to independent files with no shared state; T001 and T002 may start simultaneously.

- [x] T001 [P] Fix `tsconfig.json`: add `"node"` to `compilerOptions.types` array (alongside existing entries, or as `["node"]` if the array is absent); search all source and test files for any standalone `declare function fetch(...)` or `declare const fetch:` declaration that was introduced as a strict-mode workaround before built-in fetch typing was available and remove it — satisfies DF-01a (zero type errors for `assert` in test files after fix), DF-01b (fix does not widen type surface of production source files) — file: `tsconfig.json`

- [x] T002 [P] Update `package.json`: (1) bump `"version"` from `"0.1.0"` to `"0.2.0"`; (2) add `"@types/node"` to `devDependencies` (version compatible with ES2020 target) if not already present; (3) add four entries under `contributes.configuration.properties`: `copilotNotify.notifyOnSuccess` (type `boolean`, default `true`, description "Send notification when the participant turn completes normally"), `copilotNotify.notifyOnFailure` (type `boolean`, default `true`, description "Send notification when the participant turn is cancelled"), `copilotNotify.cooldownSeconds` (type `integer`, default `5`, minimum `0`, description "Minimum seconds between notifications; set 0 to disable cooldown"), `copilotNotify.messageFormat` (type `string`, enum `["default","minimal"]`, default `"default"`, description "Notification verbosity: 'default' includes duration and outcome; 'minimal' is label + timestamp only") — VS Code requires `contributes.configuration` declarations for settings to surface their defaults to `getConfiguration` callers — satisfies FR-31, DF-01 (devDep) — file: `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

All Phase 3+ source modules import new constants from `src/constants.ts`. This single task must complete before any subsequent phase begins.

- [x] T003 Extend `src/constants.ts` with Phase 2 constant groups — zero removals of Phase 1 constants are permitted: (1) config-key string constants: `CONFIG_NOTIFY_ON_SUCCESS = 'notifyOnSuccess'`, `CONFIG_NOTIFY_ON_FAILURE = 'notifyOnFailure'`, `CONFIG_COOLDOWN_SECONDS = 'cooldownSeconds'`, `CONFIG_MESSAGE_FORMAT = 'messageFormat'`; (2) outcome value constants: `OUTCOME_COMPLETED = 'completed'`, `OUTCOME_CANCELLED = 'cancelled'`; (3) message-format value constants: `FORMAT_DEFAULT = 'default'`, `FORMAT_MINIMAL = 'minimal'`; (4) suppression log prefix constants: `SUPPRESSED_OUTCOME_SUCCESS = "[CopilotNotify] Notification suppressed — notifyOnSuccess is false"`, `SUPPRESSED_OUTCOME_FAILURE = "[CopilotNotify] Notification suppressed — notifyOnFailure is false"`, `SUPPRESSED_COOLDOWN = "[CopilotNotify] Notification suppressed — cooldown active"` (the runtime log appends an integer `"Xs remaining"` suffix; the constant stores only the invariant prefix, which enables contains-based assertions in tests — see T009); (5) format-fallback warning constant: `WARN_UNKNOWN_FORMAT = "[CopilotNotify] Unknown messageFormat value; falling back to 'default'"` — file: `src/constants.ts`

---

## Phase 3: [US-09 + US-10 + US-11] ConfigManager

`src/configManager.ts` (T004) depends on the new constants from T003 and is independent of all other Phase 3+ source modules. T005 depends on T004 and can proceed in parallel with notifier implementation (T006) once T004 is complete.

- [x] T004 [US-09 + US-10 + US-11] Extend `src/configManager.ts`: update factory signature to `createConfigManager(outputChannel: vscode.OutputChannel): ConfigManager` — the `outputChannel` parameter is required for the `getMessageFormat` fallback warning log; add four getters to the `ConfigManager` interface and its factory-closure implementation: `getNotifyOnSuccess(): boolean` — `config.get<boolean>(CONFIG_NOTIFY_ON_SUCCESS, true)`; `getNotifyOnFailure(): boolean` — `config.get<boolean>(CONFIG_NOTIFY_ON_FAILURE, true)`; `getCooldownSeconds(): number` — `Math.max(0, Math.floor(config.get<number>(CONFIG_COOLDOWN_SECONDS, 5)))`, coercing negative values to `0` and flooring fractional values; `getMessageFormat(): 'default' | 'minimal'` — read raw string value; if it is not `'default'` or `'minimal'`, log `WARN_UNKNOWN_FORMAT` to `outputChannel` and return `'default'` — depends on T003 — satisfies AS-10d, AS-11d, FR-17, FR-31 — file: `src/configManager.ts`

- [x] T005 [US-09 + US-10 + US-11] Extend `test/suite/configManager.test.ts` with cases for all four new getters (append to existing file; all Phase 1 cases must continue to pass): `getNotifyOnSuccess()` with unset config → `true`; explicit `false` → `false`; `getNotifyOnFailure()` with unset config → `true`; explicit `false` → `false`; `getCooldownSeconds()` with default → `5`; with `-3` → `0` (coerced); with `4.9` → `4` (floored); `getMessageFormat()` `'default'` → `'default'`; `'minimal'` → `'minimal'`; unrecognized string `'compact'` → `'default'` and output-channel spy receives a call whose argument includes `WARN_UNKNOWN_FORMAT` — depends on T004 — file: `test/suite/configManager.test.ts`

---

## Phase 4: [US-09 + US-10 + US-11] Notifier

`src/notifier.ts` (T006) depends on both T003 (constants) and T004 (configManager updated signature). T007, T008, and T009 are sequential test-extension tasks — each appends cases to the same file and depends on its immediate predecessor; none are parallel-safe relative to each other because they write to a shared file.

- [x] T006 [US-09 + US-10 + US-11] Extend `src/notifier.ts` with Phase 2 logic — all changes are additive edits; Phase 1 export contracts are preserved: (1) update factory signature to `createNotifier(outputChannel: vscode.OutputChannel, config: ConfigManager): Notifier`; (2) add `let lastDispatchedAt: number | undefined = undefined` inside the factory closure, initialised to `undefined` on each factory invocation and never persisted; (3) extend `NotificationPayload` type with optional fields `durationSeconds?: number` and `outcome?: 'completed' | 'cancelled'`; (4) update `buildPayload(metadata: NotificationTaskMetadata): NotificationPayload` to populate `durationSeconds` and `outcome` from the metadata argument; (5) update `formatMessage(payload: NotificationPayload, format: 'default' | 'minimal'): string` — pure function, two arguments: `'default'` outputs label line + optional workspace line (omit when `workspaceName` is `undefined`) + `"Duration: <N>s"` line + `"Outcome: <value>"` line + ISO timestamp line; `'minimal'` outputs label line + ISO timestamp line only; (6) rename/extend `sendNotification` to `sendNotification(token, chatId, metadata: NotificationTaskMetadata)` — execution sequence: (a) read `notifyOnSuccess`, `notifyOnFailure`; (b) if `metadata.outcome === OUTCOME_COMPLETED` and `!notifyOnSuccess` → log `SUPPRESSED_OUTCOME_SUCCESS`, return `{ success: true }`; (c) if `metadata.outcome === OUTCOME_CANCELLED` and `!notifyOnFailure` → log `SUPPRESSED_OUTCOME_FAILURE`, return `{ success: true }`; (d) read `cooldownSeconds`; if `cooldownSeconds > 0` and `lastDispatchedAt !== undefined` and `(Date.now() - lastDispatchedAt) / 1000 < cooldownSeconds` → log `SUPPRESSED_COOLDOWN + " " + Math.ceil(remainingSeconds) + "s remaining"`, return `{ success: true }`; (e) read `messageFormat`; (f) build and format payload; (g) dispatch `fetch` POST; (h) on `response.ok` set `lastDispatchedAt = Date.now()` and return `{ success: true }`; on error / rejection return `{ success: false, errorMessage }` without advancing `lastDispatchedAt`; (7) add `sendTestNotification(token: string, chatId: string): Promise<NotificationResult>`: builds a fixed generic test message using the existing `COMPLETION_LABEL` constant, calls `fetch` POST directly, reads no config, does not advance `lastDispatchedAt` — depends on T003, T004 — satisfies FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, AS-09a–e, AS-10a–d, AS-11a–d — file: `src/notifier.ts`

- [x] T007 [US-11] Extend `test/suite/notifier.test.ts` with format and payload-build cases (all Phase 1 cases must continue to pass): `buildPayload(metadata)` with valid `NotificationTaskMetadata` → returned payload has `durationSeconds` and `outcome` fields matching metadata; `formatMessage(payload, 'default')` with defined `workspaceName` → output string contains workspace name, `"Duration:"`, `"Outcome:"`, and the ISO timestamp; `formatMessage(payload, 'default')` with `workspaceName: undefined` → output does not contain a workspace line; `formatMessage(payload, 'minimal')` → output contains label and timestamp, does NOT contain the strings `"Duration"` or `"Outcome"` — depends on T006 — file: `test/suite/notifier.test.ts`

- [x] T008 [US-09] Extend `test/suite/notifier.test.ts` with outcome-filter cases (append after T007 additions): `sendNotification` with `config.getNotifyOnSuccess()` stubbed to `false` and `metadata.outcome = OUTCOME_COMPLETED` → `fetch` not called; return value is `{ success: true }`; output-channel log argument equals `SUPPRESSED_OUTCOME_SUCCESS`; `sendNotification` with `config.getNotifyOnFailure()` stubbed to `false` and `metadata.outcome = OUTCOME_CANCELLED` → `fetch` not called; output-channel log argument equals `SUPPRESSED_OUTCOME_FAILURE`; `sendTestNotification` with both filter stubs `false` → `fetch` IS called, confirming the test path bypasses outcome filtering — depends on T007 — file: `test/suite/notifier.test.ts`

- [x] T009 [US-10] Extend `test/suite/notifier.test.ts` with cooldown cases (append after T008 additions): (1) same-instance cooldown suppression — first `sendNotification` call succeeds (`response.ok = true` stub); second call whose `Date.now()` stub places it inside the cooldown window → `fetch` called exactly once total; verify output-channel `appendLine` was called with an argument that **contains** `SUPPRESSED_COOLDOWN` using `.includes(SUPPRESSED_COOLDOWN)` — do NOT use strict equality, because the runtime appends remaining-seconds text (`"Xs remaining"`) that the constant does not include; (2) fresh-notifier-instance method for elapsed cooldown — after the first instance has dispatched, construct a second `createNotifier(outputChannel, configStub)` call to obtain a new `Notifier` instance; call `sendNotification` on the new instance and verify `fetch` IS called — this confirms that `lastDispatchedAt` resets on each factory invocation and that no cooldown state leaks across factory calls (models the "elapsed cooldown" dispatch path where no prior dispatch is recorded for the current instance); (3) error path does not advance cooldown timer — stub `fetch` to return `response.ok = false`; call `sendNotification` twice on the same instance; verify `fetch` is called both times, confirming that an unsuccessful dispatch does not set `lastDispatchedAt` and therefore does not block the subsequent attempt — depends on T008 — file: `test/suite/notifier.test.ts`

---

## Phase 5: [US-07 + US-08] Participant

`src/participant.ts` (T010) depends on T003 (constants) and T006 (updated `Notifier` signature with `metadata` argument). T011 depends on T010 and is independent of extension-wiring tasks.

- [x] T010 [US-07 + US-08] Extend `src/participant.ts` with duration and outcome support — wizard logic and `registerParticipant` function signature are unchanged: (1) export a new pure helper `buildTaskMetadata(startTime: number, endTime: number, token: vscode.CancellationToken): NotificationTaskMetadata` — returns `{ durationSeconds: Math.floor((endTime - startTime) / 1000), outcome: token.isCancellationRequested ? OUTCOME_CANCELLED : OUTCOME_COMPLETED }`; this function is exported so it can be unit-tested without the VS Code chat runtime; (2) update the participant handler body only: capture `const startTime = Date.now()` as the first statement of the handler callback before any `await`; after streaming resolves, capture `const endTime = Date.now()`; call `const metadata = buildTaskMetadata(startTime, endTime, token)`; pass `metadata` as the third argument to `notifier.sendNotification(token, chatId, metadata)` — depends on T003, T006 — satisfies FR-14, FR-15, FR-16, FR-17, AS-07a–d, AS-08a–d — file: `src/participant.ts`

- [x] T011 [US-07 + US-08] Update `test/suite/participant.test.ts` with `buildTaskMetadata` unit cases: `isCancellationRequested: false` → `outcome` equals `OUTCOME_COMPLETED`; `isCancellationRequested: true` → `outcome` equals `OUTCOME_CANCELLED`; `startTime === endTime` (0 ms elapsed) → `durationSeconds` equals `0`; `endTime − startTime === 1500` (1500 ms elapsed) → `durationSeconds` equals `1` (floor confirms no round-up); `endTime − startTime === 999` (999 ms elapsed) → `durationSeconds` equals `0` (floor, confirms sub-second rounds down) — depends on T010 — file: `test/suite/participant.test.ts`

---

## Phase 6: Extension Wiring

`src/extension.ts` depends on all prior source modules. Changes are limited to factory call-site signatures and the `sendTest` dispatch path — no new feature logic is introduced here. This phase is sequential after all Phase 3–5 source changes complete.

- [x] T012 [US-07 + US-08 + US-09 + US-10 + US-11] Update `src/extension.ts` with Phase 2 wiring changes only: (1) update `createConfigManager(...)` call site to pass `outputChannel` as the required first argument; (2) update `createNotifier(...)` call site to pass `configManager` as the required second argument; (3) replace the `copilotNotify.sendTest` command handler's call to `notifier.sendNotification(token, chatId)` with `notifier.sendTestNotification(token, chatId)` so the test path bypasses outcome filter and cooldown; (4) if any inline string literals remain in the `sendTest` missing-credential guard, replace them with the corresponding named constants from `src/constants.ts` — depends on T003, T004, T006, T010 — file: `src/extension.ts`

---

## Phase 7: [US-12 + US-13 + US-14] Repo Documentation

All three tasks create independent new files with no shared state; all are parallel-safe. Content references Phase 2 settings, so this phase is placed after Phase 6 completes.

- [x] T013 [P] [US-12] Create `README.md`: project overview (privacy-first, serverless, participant-turn scoped — not a passive Copilot monitor), prerequisites section (@BotFather setup, Telegram chat ID retrieval), installation and build steps (`npm install`, `npm run compile`), usage walkthrough (configure wizard → invoke `@copilotnotify` in Chat panel → receive Telegram notification), full configuration reference table covering all Phase 1 (`enabled`, `telegramChatId`) and Phase 2 (`notifyOnSuccess`, `notifyOnFailure`, `cooldownSeconds`, `messageFormat`) settings with name / type / default / description columns, known limitations section (participant-scope only — does not monitor Copilot Edits, autocomplete, or Copilot Chat conversations not addressed to this participant), link to `CHANGELOG.md` — no placeholder sections, no TODO markers — satisfies FR-26, AS-12a, AS-12b — file: `README.md`

- [x] T014 [P] [US-13] Create `CHANGELOG.md` at repository root following Keep a Changelog format: `[Unreleased]` section header; `[0.2.0] - 2026-04-04` section — Added entries for task duration in notifications, participant-scope outcome ("completed"/"cancelled"), outcome-based notification filtering (`notifyOnSuccess` / `notifyOnFailure`), notification cooldown (`cooldownSeconds`), message format variants (`messageFormat`), `sendTestNotification` method that bypasses filters and cooldown, `tsconfig` node-types fix (`@types/node`), version bump to `0.2.0`; `[0.1.0] - 2026-04-03` section — Added entries for setup wizard, SecretStorage bot token storage, Telegram dispatch via native fetch, enable/disable toggle, sendTest command, status bar indicator, generic completion label + workspace name + timestamp message — satisfies FR-27, AS-13a, AS-13b, AS-13c — file: `CHANGELOG.md`

- [x] T015 [P] [US-14] Create `LICENSE` at repository root with standard MIT license text: copyright year `2026`, copyright holder `devbehkami / Amir Ranjbar`, followed by the standard permission block, warranty disclaimer, and liability limitation clauses — satisfies FR-28, AS-14a, AS-14b, AS-14c — file: `LICENSE`

---

## Phase 8: [US-15 + US-16] CI Workflow and Issue Templates

T016 (CI workflow) and T017 (both issue template files) create independent new files with no shared state; both are parallel-safe.

- [x] T016 [P] [US-15] Create `.github/workflows/ci.yml`: `name: CI`; triggers: `on: push` and `pull_request` targeting the `main` branch; one job `build-and-test` with `runs-on: ubuntu-latest`; steps: `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: '20'`, `run: sudo apt-get install -y xvfb` (required for `@vscode/test-electron` headless launch on Linux), `run: npm install`, `run: npm run compile`, `run: npm run lint`, `run: xvfb-run -a npm run test` — satisfies FR-29, AS-15a, AS-15b, AS-15c, AS-15d — file: `.github/workflows/ci.yml`

- [x] T017 [P] [US-16] Create both GitHub issue templates: (a) `.github/ISSUE_TEMPLATE/bug_report.md` — YAML front matter: `name: Bug Report`, `about: Report a defect in CopilotNotify`, `labels: bug`, `assignees: ''`; body sections prompting for: VS Code version, CopilotNotify extension version, operating system, numbered steps to reproduce, expected behavior, actual behavior, Output Channel log snippet; (b) `.github/ISSUE_TEMPLATE/feature_request.md` — YAML front matter: `name: Feature Request`, `about: Suggest an improvement`, `labels: enhancement`, `assignees: ''`; body sections prompting for: problem statement, proposed solution, alternatives considered, additional context — satisfies FR-30, AS-16a, AS-16b, AS-16c — files: `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`

---

## Final Phase: Polish & Cross-Cutting

T018 is sequential: compile must succeed before the test run begins. This single consolidated checkpoint validates the entire Phase 2 + Phase 3 scope.

- [x] T018 Build + test checkpoint: (1) run `npm run compile` (`tsc -p ./`) — all TypeScript sources and test files must compile with zero errors under `strict: true` with `node` types in scope; diagnose and fix any emit errors in `src/*.ts` or `test/suite/*.ts` before step 2; (2) run `npm run test` — all Mocha cases from the Phase 1 delivered suite plus all new Phase 2 test additions must pass; verify unit test line coverage ≥ 80% across `src/constants.ts`, `src/configManager.ts`, `src/notifier.ts`, `src/participant.ts`, `src/extension.ts`; fix any failing cases or missing coverage branches before declaring Phase 2 + Phase 3 complete — files: `tsconfig.json`, `src/*.ts`, `test/suite/*.ts`

---

**Coverage Check**

> Phase 1 acceptance scenarios (AS-01a through AS-06d) are satisfied by the delivered v0.1.0 baseline; all Phase 1 tasks are checked complete. The table below covers Phase 2 and Phase 3 scenarios only; no regression against Phase 1 is permitted.

| Acceptance Scenario | Covered By |
|---|---|
| AS-07a: default format includes human-readable duration | T006, T007 |
| AS-07b: minimal format omits duration | T006, T007 |
| AS-07c: sub-second duration rounds to 0s or "< 1s"; no negative value produced | T010, T011 |
| AS-07d: duration derived from wall-clock elapsed time only; no prompt content | T010 |
| AS-08a: outcome "completed" when token not cancelled at handler resolution | T010, T011 |
| AS-08b: outcome "cancelled" when token is cancelled | T010, T011 |
| AS-08c: minimal format omits outcome field regardless of cancellation state | T006, T007 |
| AS-08d: outcome label is "completed" or "cancelled" only; no LLM error codes | T010 |
| AS-09a: both notifyOnSuccess and notifyOnFailure true by default — both outcomes fire | T004, T006, T008 |
| AS-09b: notifyOnFailure false — cancelled turns suppressed | T004, T005, T006, T008 |
| AS-09c: notifyOnSuccess false — completed turns suppressed | T004, T005, T006, T008 |
| AS-09d: both false — all turns suppressed; suppression logged; no error shown | T006, T008 |
| AS-09e: "success" = completed turn; "failure" = cancelled turn; no LLM semantics implied | T006, T010 |
| AS-10a: default cooldown 5s; second notification within 5s suppressed and logged | T004, T006, T009 |
| AS-10b: cooldown = 0 disables cooldown; all eligible turns fire | T004, T006, T009 |
| AS-10c: cooldown applies regardless of outcome; suppressed notifications not replayed | T006, T009 |
| AS-10d: negative cooldown value treated as 0 | T004, T005 |
| AS-11a: default format — label + workspace + duration + outcome + timestamp | T006, T007 |
| AS-11b: minimal format — label + timestamp only | T006, T007 |
| AS-11c: default format never includes prompt text, code, file names, or diffs | T006, T007 |
| AS-11d: unrecognized messageFormat falls back to "default" with warning logged | T004, T005 |
| AS-12a: README covers purpose, prerequisites, setup, usage, config reference, limitations | T013 |
| AS-12b: README has no placeholder sections or TODO markers | T013 |
| AS-13a: CHANGELOG.md exists at repository root | T014 |
| AS-13b: CHANGELOG contains a v0.1.0 entry | T014 |
| AS-13c: CHANGELOG follows Keep a Changelog format | T014 |
| AS-14a: LICENSE exists at repository root | T015 |
| AS-14b: License type is MIT | T015 |
| AS-14c: Year and author match project identity | T015 |
| AS-15a: CI workflow file exists under .github/workflows/ | T016 |
| AS-15b: Workflow triggers on push and pull_request | T016 |
| AS-15c: Workflow includes npm install, compile, lint, test steps | T016 |
| AS-15d: Workflow completes without errors on passing codebase | T016, T018 |
| AS-16a: Bug report and feature request templates exist in .github/ISSUE_TEMPLATE/ | T017 |
| AS-16b: Bug template prompts for VS Code version, extension version, OS, repro steps, expected vs. actual | T017 |
| AS-16c: Feature template prompts for problem statement, proposed solution, alternatives | T017 |
| DF-01a: npm run compile produces zero errors in test files referencing assert | T001, T018 |
| DF-01b: Fix does not widen type surface of production source files | T001 |

| Success Criterion | Covered By |
|---|---|
| SC-01: npm run compile exits zero with strict: true after Phase 2 changes | T001, T018 |
| SC-02: All Phase 1 + Phase 2 Mocha cases pass | T018 |
| SC-03: Unit test coverage ≥ 80% across all modified source modules | T018 |
| SC-04: Telegram notifications include duration and outcome in default format | T006, T007, T010 |
| SC-05: Outcome-filter suppression is logged; no error surfaces to the editor | T006, T008 |
| SC-06: Cooldown suppression is logged with remaining-seconds; timer advances only on successful response | T006, T009 |
| SC-07: sendTestNotification bypasses outcome filter and cooldown; does not advance timer | T006, T009 |
| SC-08: README, CHANGELOG, and LICENSE exist at repository root and are complete | T013, T014, T015 |
| SC-09: GitHub Actions CI workflow compiles, lints, and tests on ubuntu-latest with Xvfb | T016 |

**Unmapped Scenarios:** None. All 37 Phase 2+3 acceptance scenarios (AS-07a–AS-16c + DF-01a–b), all 9 Phase 2+3 success criteria, and all applicable Phase 2 edge cases (EC-05, EC-13–EC-19) are covered by at least one task.
