# Tasks: CopilotNotify — Telegram Notifications (Phase 1 MVP)

**Spec:** `specs/queue/copilotnotify-telegram-notifications/spec.md`  
**Plan:** `specs/queue/copilotnotify-telegram-notifications/plan.md`

---

## Phase 1: Setup

Scaffold the VS Code extension project skeleton. All tasks in this phase are independent file creations with no shared state and no ordering dependency on each other; all five are parallel-safe.

- [x] T001 [P] Create `package.json` with full Phase 1 manifest: `name: copilotnotify`, `displayName: CopilotNotify`, `publisher: devbehkami`, `version: 0.1.0`, `engines.vscode: >=1.90.0`, `activationEvents: ["onStartupFinished"]`, `contributes.chatParticipants` (one entry: `id: copilotnotify`, `name: copilotnotify`, `description`, `isSticky: false`), `contributes.commands` (5 entries for configure / enable / disable / sendTest / showLogs), `contributes.configuration` (2 properties: `copilotNotify.enabled: boolean default true` and `copilotNotify.telegramChatId: string default ""`; bot token is **not** a contributed setting — SecretStorage only), `main: ./out/extension.js`, `scripts: { compile, watch, lint, test }`, `devDependencies` list (typescript, @types/vscode, @vscode/test-electron, mocha, @types/mocha, esbuild, eslint, @typescript-eslint/eslint-plugin, @typescript-eslint/parser) — file: `package.json`

- [x] T002 [P] Create `tsconfig.json`: `compilerOptions` — `strict: true`, `target: ES2020`, `module: commonjs`, `outDir: ./out`, `rootDir: ./src`, `lib: [ES2020]`, `sourceMap: true`; `include: ["src"]`; `exclude: ["node_modules", "out"]` — file: `tsconfig.json`

- [x] T003 [P] Create `.eslintrc.json` with `@typescript-eslint` parser and plugin, rules: `"@typescript-eslint/no-floating-promises": "error"` (catches unawaited async to satisfy error-handling contract), `"@typescript-eslint/no-explicit-any": "error"` (enforces NFR-01), `"no-console": "error"` (enforces VSCode OutputChannel-only logging); `parserOptions: { project: "./tsconfig.json" }` — file: `.eslintrc.json`

- [x] T004 [P] Create `.vscodeignore` excluding `src/**`, `test/**`, `node_modules/**`, `*.ts`, `.eslintrc.json`, `tsconfig.json`, `.vscode/**`; retaining `out/**`, `package.json`, `README.md` so the packaged `.vsix` contains only the compiled output — file: `.vscodeignore`

- [x] T005 [P] Create `.vscode/launch.json` with two run configurations: `"Extension"` (type `extensionHost`, `request: launch`, `args: ["--extensionDevelopmentPath=${workspaceFolder}"]`) and `"Extension Tests"` (type `extensionHost`, `request: launch`, `args: ["--extensionDevelopmentPath=${workspaceFolder}", "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"]`) — file: `.vscode/launch.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

`src/constants.ts` (T006) must complete before any Phase 3+ implementation can begin, because every subsequent source module imports from it. `test/suite/index.ts` (T007) has no source dependencies and may be written at the same time.

- [x] T006 [P] Create `src/constants.ts` exporting ALL named string constants — zero imports from any other `src/` file are allowed; this file is the dependency root. Must include: 5 command ID strings (`copilotNotify.configure`, `copilotNotify.enable`, `copilotNotify.disable`, `copilotNotify.sendTest`, `copilotNotify.showLogs`); configuration section identifier `copilotNotify`; configuration property keys `enabled` and `telegramChatId`; SecretStorage key `copilotNotify.botToken`; output channel display name `CopilotNotify`; chat participant ID and name `copilotnotify`; Telegram API URL template (function or template string accepting a token); generic completion label `Copilot task finished`; participant chat response label; status bar display strings for the three states (`🔔 Notify: ON`, `🔕 Notify: OFF`, `⚠️ Notify: Not Configured`); wizard validation error strings for empty/whitespace token and chatId; test-success info message; test-failure warning prefix — file: `src/constants.ts`

- [x] T007 [P] Create `test/suite/index.ts` as the Mocha root suite loader for `@vscode/test-electron`: resolve the compiled `test/suite` directory, glob for `**/*.test.js`, require each file, and export a configured Mocha runner for the VS Code test host — file: `test/suite/index.ts`

---

## Phase 3: [US-02 + US-05] Notification Core

Implements the three modules that underpin notification dispatch (US-02) and the privacy-safe generic message format (US-05). The three implementation tasks (T008, T010, T012) share no state and may start simultaneously as soon as T006 completes. Each test task is paired with its implementation module; the three test tasks are parallel-safe relative to each other but each has an intra-phase ordering dependency on its paired implementation task (noted below).

- [x] T008 [P] [US-02] Implement `src/secretManager.ts`: export factory `createSecretManager(secrets: vscode.SecretStorage): SecretManager` where the `SecretManager` interface is `{ getToken(): Promise<string | undefined>; storeToken(token: string): Promise<void> }`. Both methods use the key constant from `src/constants.ts`. The raw token value must never be logged or cached beyond the immediate return — satisfies FR-06, C-04 — file: `src/secretManager.ts`

- [x] T009 [US-02] Implement `test/suite/secretManager.test.ts`: provide an in-memory `Map`-backed mock implementing `vscode.SecretStorage`. Test cases: (1) `getToken()` on empty storage returns `undefined`; (2) `storeToken('abc')` then `getToken()` returns `'abc'`; (3) second `storeToken` overwrites the first; (4) verify key used is `copilotNotify.botToken` from constants. Depends on T008 — file: `test/suite/secretManager.test.ts`

- [x] T010 [P] [US-02] Implement `src/configManager.ts`: export factory `createConfigManager(): ConfigManager` where the interface is `{ getChatId(): string; getEnabled(): boolean; setChatId(v: string): Promise<void>; setEnabled(v: boolean): Promise<void> }`. Reads `vscode.workspace.getConfiguration('copilotNotify')` on _every_ call — no caching, which is required for mid-session setting changes (EC-04). `setChatId` and `setEnabled` update with `ConfigurationTarget.Global` — satisfies FR-07 — file: `src/configManager.ts`

- [x] T011 [US-02] Implement `test/suite/configManager.test.ts`: stub `vscode.workspace.getConfiguration` to return a mutable in-memory dictionary. Test cases: (1) default `enabled` is `true`; (2) default `chatId` is `""`; (3) `setChatId('123')` causes `getChatId()` to return `'123'`; (4) `setEnabled(false)` causes `getEnabled()` to return `false`. Depends on T010 — file: `test/suite/configManager.test.ts`

- [x] T012 [P] [US-02 + US-05] Implement `src/notifier.ts`: export factory `createNotifier(outputChannel: vscode.OutputChannel): Notifier`. Implement `buildPayload(): NotificationPayload` — pure function, returns `{ label: COMPLETION_LABEL, workspaceName: vscode.workspace.workspaceFolders?.[0]?.name, timestamp: new Date().toISOString() }`. Implement `formatMessage(payload: NotificationPayload): string` — pure string builder; builds the Telegram text from label, optional workspace line (omitted when `workspaceName` is `undefined`, satisfying AS-05c / EC-09), and timestamp. Implement `sendNotification(token: string, chatId: string): Promise<NotificationResult>` — constructs `fetch` POST to `api.telegram.org/bot<TOKEN>/sendMessage` with body `{ chat_id: chatId, text: message }`, **no `parse_mode`**; on `response.ok` returns `{ success: true }`; on `!response.ok` parses JSON, logs `status + description` to outputChannel, returns `{ success: false, errorMessage }`; on fetch rejection logs error message and returns `{ success: false, errorMessage }`; on JSON parse failure returns `{ success: false, errorMessage: "Telegram error <status>" }`. Must never throw; must never log token or chatId — satisfies FR-03, FR-04, FR-05, FR-13, C-03, C-05, EC-06, EC-07 — file: `src/notifier.ts`

- [x] T013 [US-02 + US-05] Implement `test/suite/notifier.test.ts`: replace global `fetch` with a configurable stub per test. Test cases: (1) `response.ok=true` → `{ success: true }`; (2) `response.ok=false` with valid JSON `{ description: "Bad Request" }` → `{ success: false, errorMessage: "Telegram error 400: Bad Request" }` and output channel receives a log entry; (3) fetch rejects with `new Error('offline')` → `{ success: false, errorMessage: 'offline' }` and output channel receives a log entry; (4) `response.ok=false` with unparseable JSON body → `{ success: false, errorMessage: "Telegram error 500" }`; (5) `buildPayload()` when `workspaceFolders` is `undefined` returns `workspaceName: undefined`; (6) `formatMessage({ workspaceName: undefined, ... })` output does not contain a workspace line; (7) assert no `parse_mode` key appears in the serialised request body; (8) assert neither the token string nor the chatId string appear in any value appended to `outputChannel.appendLine`. Depends on T012 — file: `test/suite/notifier.test.ts`

---

## Phase 4: [US-06] Status Bar Indicator

`src/statusBar.ts` depends only on `src/constants.ts` (T006) and is independent of all Phase 3 modules — it may therefore be developed in parallel with Phase 3 workers. It is placed in its own phase because it completes a discrete user story (US-06) and must exist before `extension.ts` is written in Phase 6.

- [x] T014 [P] [US-06] Implement `src/statusBar.ts`: export factory `createStatusBarManager(): StatusBarManager` where the interface is `{ update(state: StatusBarState): void; dispose(): void }`. In the factory, create a `vscode.StatusBarItem` with `vscode.StatusBarAlignment.Left` at priority `100`; call `.show()` immediately. `update('ON')` sets `text: "🔔 Notify: ON"` and `command: copilotNotify.configure`. `update('OFF')` sets `text: "🔕 Notify: OFF"` and `command: copilotNotify.configure`. `update('NOT_CONFIGURED')` sets `text: "⚠️ Notify: Not Configured"` and `command: copilotNotify.configure`. All three states bind the click action to `copilotNotify.configure` (AS-06d — status bar opens the wizard on click). `dispose()` calls `.dispose()` on the underlying item — satisfies FR-11, AS-06a–d — file: `src/statusBar.ts`

- [x] T015 [US-06] Implement `test/suite/statusBar.test.ts`: mock `vscode.window.createStatusBarItem` to return a spy object tracking property writes and method calls. Test cases: (1) `update('ON')` → `text` equals `"🔔 Notify: ON"` and `command` equals `copilotNotify.configure`; (2) `update('OFF')` → `text` equals `"🔕 Notify: OFF"` and `command` equals `copilotNotify.configure`; (3) `update('NOT_CONFIGURED')` → `text` equals `"⚠️ Notify: Not Configured"` and `command` equals `copilotNotify.configure`; (4) all three update calls produce the same `command` value (AS-06d); (5) `dispose()` calls the underlying item's `.dispose` exactly once. Depends on T014 — file: `test/suite/statusBar.test.ts`

---

## Phase 5: [US-01] Setup Wizard + Participant Handler

`src/participant.ts` (T016) depends on secretManager (T008), configManager (T010), and notifier (T012) from Phase 3. It is independent of statusBar (T014) and may begin as soon as Phase 3 is complete. T017 and T018 are both sequential after T016; they are parallel-safe relative to each other.

- [x] T016 [US-01 + US-02] Implement `src/participant.ts`. **Export `runSetupWizard(secrets: SecretManager, config: ConfigManager): Promise<'completed' | 'cancelled'>`:** (1) show token InputBox with `password: true` and `validateInput` returning the token-empty error constant for blank/whitespace input; (2) if user cancels (`undefined`) → return `'cancelled'` immediately, no writes; (3) show chatId InputBox pre-filled with `config.getChatId()` if non-empty, with non-empty validator using chatId-empty error constant; (4) if user cancels → return `'cancelled'` immediately, token not yet written (EC-10, AS-01b); (5) snapshot `const previousChatId = config.getChatId()`; (6) `await config.setChatId(chatId)`; (7) `await secrets.storeToken(token)` inside try/catch — on failure: `await config.setChatId(previousChatId)` to roll back, then re-throw (wizard atomicity per plan §Research Findings item 6); (8) return `'completed'` (AS-01a, AS-01c, AS-01d, EC-01). **Export `registerParticipant(context, notifier, config, secrets, outputChannel): vscode.Disposable`:** call `vscode.chat.createChatParticipant(PARTICIPANT_ID, async (request, _ctx, response, _token) => { ... })` using only the public `vscode.chat` API surface (C-02). Handler: streams `response.markdown(PARTICIPANT_RESPONSE_LABEL)`; checks `config.getEnabled()` — if false, returns silently (AS-02b); reads `await secrets.getToken()` and `config.getChatId()` — if either is absent, logs a "not configured" line to outputChannel and returns (AS-02c); fire-and-forgets `notifier.sendNotification(token, chatId)` via `void notifier.sendNotification(...).then(result => { if (!result.success) outputChannel.appendLine(result.errorMessage); })` (AS-02a, AS-02d, EC-02) — return the participant disposable — satisfies FR-01, FR-02, FR-08, C-01, C-02 — file: `src/participant.ts`

- [x] T017 [P] [US-01] Implement `test/suite/wizard.test.ts`: stub `vscode.window.showInputBox` to resolve from a configurable sequence of return values (string or `undefined`). Test cases: (1) both inputs provide valid strings → `setChatId` called with chatId, `storeToken` called with token, returns `'completed'`; (2) cancel at token box → neither `setChatId` nor `storeToken` called, returns `'cancelled'`; (3) cancel at chatId box → neither `setChatId` nor `storeToken` called (token not yet written), returns `'cancelled'` (EC-10, AS-01b); (4) empty string at token field → `validateInput` returns error string and does not advance to chatId box (AS-01c); (5) whitespace-only at chatId field → `validateInput` returns error string (AS-01c); (6) mock `storeToken` to throw an error → `setChatId` is subsequently called with the pre-wizard chatId value (rollback confirmed), error propagates out of `runSetupWizard`. Depends on T016 — file: `test/suite/wizard.test.ts`

- [x] T018 [P] [US-02] Implement `test/suite/participant.test.ts`: stub `vscode.chat.createChatParticipant` to capture the handler function and invoke it directly; provide a spy `Notifier`, stub `SecretManager`, stub `ConfigManager`, and spy `OutputChannel`. Test cases: (1) `getEnabled()` returns `false` → handler returns without calling `notifier.sendNotification` (AS-02b); (2) `getEnabled()` returns `true` but `getToken()` returns `undefined` → `sendNotification` not called, `outputChannel.appendLine` receives a "not configured" log entry (AS-02c); (3) `getEnabled()` returns `true`, `getToken()` returns a token, `getChatId()` returns `""` → `sendNotification` not called, output channel receives a log entry (AS-02c); (4) all credentials present and `getEnabled()` true → `sendNotification` called exactly once with the correct token and chatId (AS-02a); (5) stubs as in case 4 but `sendNotification` resolves `{ success: false, errorMessage: 'boom' }` → `outputChannel.appendLine` called with `'boom'`, handler does not throw (AS-02d); (6) in each of cases (1)–(5), assert that the `response.markdown` spy was called exactly once with `PARTICIPANT_RESPONSE_LABEL` — verifies the participant always emits its chat response text regardless of which notification branch is taken. Depends on T016 — file: `test/suite/participant.test.ts`

---

## Phase 6: [US-03 + US-04] Extension Entry Point

`src/extension.ts` (T019) integrates all previously built modules and registers all 5 commands, including `copilotNotify.enable` / `copilotNotify.disable` (US-03) and `copilotNotify.sendTest` (US-04). This is the sole task in the phase; it is sequential after all Phase 2–5 tasks complete.

- [x] T019 [US-01 + US-03 + US-04] Implement `src/extension.ts`. **Export `activate(context: vscode.ExtensionContext): Promise<void>`:** (1) create singleton `outputChannel = vscode.window.createOutputChannel(CHANNEL_NAME)`; (2) instantiate `secretManager`, `configManager`, `notifier` (pass outputChannel), `statusBarManager`; (3) compute initial status bar state: `const initialToken = await secretManager.getToken()`; evaluate: `!configManager.getEnabled()` → `'OFF'`, else `!initialToken || !configManager.getChatId()` → `'NOT_CONFIGURED'`, else → `'ON'` (EC-11); (4) `statusBarManager.update(initialState)`; (5) push `registerParticipant(context, notifier, configManager, secretManager, outputChannel)` result to `context.subscriptions`; (6) register `copilotNotify.configure` — calls `runSetupWizard(secretManager, configManager)`; on `'completed'` re-evaluates token + chatId + enabled to determine new state and calls `statusBarManager.update`; on thrown error logs to outputChannel and shows `showWarningMessage`; (7) register `copilotNotify.enable` — `await configManager.setEnabled(true)`; re-evaluates state (re-reads token + chatId) to set `'ON'` or `'NOT_CONFIGURED'` and updates statusBar (AS-03b); (8) register `copilotNotify.disable` — `await configManager.setEnabled(false)`; `statusBarManager.update('OFF')` (AS-03a); (9) register `copilotNotify.sendTest` — reads `await secretManager.getToken()` and `configManager.getChatId()`; if either is absent shows `vscode.window.showWarningMessage` naming the absent credential(s), no network call (AS-04b); else `const result = await notifier.sendNotification(token, chatId)`; on `result.success` shows `showInformationMessage(TEST_SUCCESS_MESSAGE)` (AS-04a); on `!result.success` shows `showWarningMessage(result.errorMessage)` (AS-04c); (10) register `copilotNotify.showLogs` — calls `outputChannel.show()`; (11) push all command disposables and `{ dispose: () => statusBarManager.dispose() }` to `context.subscriptions` (EC-12). **Export `deactivate(): void`** as a no-op (VS Code auto-disposes subscriptions) — satisfies FR-09, FR-10, FR-12, AS-03a–b, AS-04a–c, AS-06a–d, EC-11, EC-12 — file: `src/extension.ts`

---

## Final Phase: Polish & Cross-Cutting

Tasks are sequential: T020 → T021 → T022. T020 is parallel-safe against any remaining work in prior phases (compile can run while a prior-phase task is finishing) but T021 and T022 have ordering dependencies on their predecessors here.

- [x] T020 [P] Build checkpoint: run `npm run compile` (`tsc -p ./`); all TypeScript sources must compile with zero errors under `strict: true`; diagnose and fix any emit errors in `src/*.ts` before proceeding (SC-09, NFR-01) — files: `tsconfig.json`, `src/*.ts`

- [x] T021 Test checkpoint: run `npm run test`; all Mocha cases must pass; verify unit test line coverage ≥ 80% across `src/constants.ts`, `src/secretManager.ts`, `src/configManager.ts`, `src/notifier.ts`, `src/statusBar.ts`, `src/participant.ts`; fix any failing cases or missing coverage branches before T022 (SC-08, NFR-03) — files: `test/suite/*.test.ts`

- [x] T022 Package checkpoint: run `npx vsce package`; zero packaging errors expected; verify a `.vsix` artifact is produced and the manifest has 5 commands, 1 chat participant, and 2 configuration properties (SC-10) — files: `.vscodeignore`, `package.json`

---

**Coverage Check**

| Acceptance Scenario | Covered By |
|---|---|
| AS-01a: wizard happy path — both credentials stored, status bar updates | T016, T017, T019 |
| AS-01b: wizard cancelled at either InputBox — no data written, prior values preserved | T016, T017 |
| AS-01c: empty / whitespace input — inline validation error, does not advance | T016, T017 |
| AS-01d: token InputBox uses `password: true` | T016 |
| AS-02a: participant completion triggers Telegram dispatch with generic label + workspace + timestamp | T012, T013, T016, T018 |
| AS-02b: notifications disabled — participant completes, no dispatch | T016, T018, T019 |
| AS-02c: not configured — no network request, error logged to Output Channel | T016, T018 |
| AS-02d: Telegram unreachable — error caught and logged, editor unaffected | T012, T013 |
| AS-03a: disable command sets `enabled: false`, status bar shows OFF | T019 |
| AS-03b: enable command sets `enabled: true`, status bar updates to ON or NOT_CONFIGURED | T019 |
| AS-04a: sendTest happy path — notification dispatched, info message shown | T012, T019 |
| AS-04b: sendTest not configured — warning names the missing credential, no network call | T019 |
| AS-04c: sendTest API error — warning surfaces code/description, logged to Output Channel | T012, T019 |
| AS-05a: message contains static label + workspace name + ISO timestamp | T012, T013 |
| AS-05b: message contains no prompt text, code, file names, or diffs | T012, T013 |
| AS-05c: no workspace folder — workspace name field omitted from message | T012, T013 |
| AS-06a: configured + enabled → status bar "🔔 Notify: ON" | T014, T015 |
| AS-06b: disabled → status bar "🔕 Notify: OFF" | T014, T015 |
| AS-06c: bot token or chat ID absent → status bar "⚠️ Notify: Not Configured" | T014, T015 |
| AS-06d: clicking status bar item opens configure command | T014, T015 |

| Success Criterion | Covered By |
|---|---|
| SC-01: wizard stores credentials correctly; cancellable without side effects | T016, T017, T019 |
| SC-02: participant triggers notification with generic label, no prompt/code | T012, T013, T016, T018 |
| SC-03: notifications suppressed when `enabled: false` | T016, T018, T019 |
| SC-04: test command confirms success or reports error inline; no unhandled throws | T012, T019 |
| SC-05: status bar transitions correctly among all three states | T014, T015, T019 |
| SC-06: Telegram errors caught and logged; extension host does not crash | T012, T013 |
| SC-07: no private or internal VS Code / Copilot APIs used | T016 (enforced at implementation time; `vscode.chat.createChatParticipant` is the only Copilot API surface used) |
| SC-08: unit test coverage ≥ 80% | T018, T021 |
| SC-09: TypeScript compiles with zero errors under strict mode | T020 |
| SC-10: extension packages without errors via `vsce package` | T022 |

| Edge Case | Covered By |
|---|---|
| EC-01: wizard pre-fills existing chatId; token field starts blank | T016 |
| EC-02: participant completes under load — notification dispatched asynchronously, no blocking | T016 (fire-and-forget pattern) *(impl-only)* |
| EC-03: token changed mid-session via wizard — next dispatch reads fresh SecretStorage value | T008 (no caching) *(impl-only)* |
| EC-04: chatId changed mid-session via settings.json — next dispatch reads fresh config value | T010 (no caching) *(impl-only)* |
| EC-05: multiple rapid participant turns — each fires independently (no dedup in Phase 1) | Covered by design; no task required |
| EC-06: network offline — fetch rejection caught, logged, no crash | T012, T013 |
| EC-07: invalid token (401) — error body logged, no credential auto-cleared | T012, T013 |
| EC-08: group or channel chat ID — no format validation beyond non-empty check | T016 (validator only checks non-empty) |
| EC-09: no open workspace folder — workspace name omitted from message | T012, T013 |
| EC-10: cancel after chatId entered but before token written — no writes (rollback unnecessary; token is second) | T016, T017 |
| EC-11: `enabled: false` on startup — status bar initialises to OFF, no notifications | T019 |
| EC-12: extension deactivated — all subscriptions auto-disposed by VS Code, status bar item disposed | T019 |

**Unmapped Scenarios:** None. All 20 acceptance scenarios (AS-01a–AS-06d), all 10 success criteria (SC-01–SC-10), and all 12 applicable edge cases (EC-01–EC-12) are covered by at least one task.
