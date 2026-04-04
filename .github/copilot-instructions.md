# GitHub Copilot Instructions — CopilotNotify

## What This Project Is

**CopilotNotify** is a VS Code extension that sends Telegram notifications when GitHub Copilot agent tasks complete. It is privacy-first and serverless: the extension calls the Telegram Bot API directly from the editor, with no backend.

Active scope: **Phase 1 and Phase 2 complete** (v0.2.0). See `memory/constitution.md` for the full constitution.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Runtime | VS Code Extension Host (Node.js) |
| Extension API | VS Code Extension API (`vscode` module) |
| Copilot detection | VS Code Chat Participant API (`vscode.chat`) |
| HTTP | Native `fetch` (no axios, no node-fetch) |
| Bot token storage | `vscode.SecretStorage` |
| Chat ID storage | `vscode.workspace.getConfiguration` |
| Test framework | Mocha + `@vscode/test-electron` |
| Build | `tsc` (TypeScript compiler; `esbuild` is a devDep but not used in build scripts) |
| Package manager | npm |

---

## Build & Test Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile
# or: npx tsc -p ./

# Watch mode
npm run watch

# Run extension tests (compiles first, then launches @vscode/test-electron)
npm run test

# Lint
npm run lint
# or: npx eslint src --ext ts

# Package extension
npx vsce package
```

---

## Project Structure

```
.
├── .github/
│   ├── copilot-instructions.md   ← this file
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── workflows/
│       └── ci.yml                ← CI: compile + test on push/PR
├── memory/
│   └── constitution.md           ← immutable project decisions
├── specs/
│   ├── queue/                    ← specs awaiting work
│   ├── doing/                    ← spec currently being implemented
│   └── done/                     ← completed specs
├── src/
│   ├── extension.ts              ← activate/deactivate entry point
│   ├── participant.ts            ← Copilot chat participant + task detection + metadata
│   ├── notifier.ts               ← Telegram dispatch, payload building, format variants, cooldown
│   ├── secretManager.ts          ← SecretStorage wrapper for bot token
│   ├── configManager.ts          ← workspace settings accessor (Phase 1 + Phase 2 keys)
│   ├── statusBar.ts              ← status bar item lifecycle
│   └── constants.ts              ← all string constants
├── test/
│   ├── runTest.ts                ← @vscode/test-electron entry point
│   └── suite/
│       ├── configManager.test.ts
│       ├── index.ts
│       ├── notifier.test.ts
│       ├── participant.test.ts
│       ├── secretManager.test.ts
│       ├── statusBar.test.ts
│       └── wizard.test.ts
├── CHANGELOG.md
├── LICENSE
├── PDR.md                        ← Product Requirements Document
├── README.md
├── package.json
├── tsconfig.json                 ← "types": ["node"] required for test files
└── .vscodeignore
```

---

## Core Architecture Rules

1. **Bot token lives exclusively in `vscode.SecretStorage`** — never in `settings.json`, never in memory beyond the active request.
2. **Chat ID lives in `vscode.workspace.getConfiguration('copilotNotify')`** — it is not a secret.
3. **No backend** — all HTTP goes directly to `https://api.telegram.org/bot<TOKEN>/sendMessage`.
4. **Task summary is a generic label only** — never include prompt text, file contents, or code diffs.
5. **Copilot detection uses the custom chat participant API** — not internal/private Copilot events.
6. **Graceful failure** — log errors to the VS Code Output Channel; never throw unhandled errors that could crash the extension host.

---

## Configuration Namespace

All settings live under `copilotNotify.*`:

| Key | Type | Storage | Notes |
|---|---|---|---|
| `copilotNotify.enabled` | boolean | settings.json | Master on/off switch |
| `copilotNotify.telegramChatId` | string | settings.json | Not a secret |
| `copilotNotify.notifyOnSuccess` | boolean | settings.json | Send notification on successful task completion (default: true) |
| `copilotNotify.notifyOnFailure` | boolean | settings.json | Send notification on cancelled/failed task (default: true) |
| `copilotNotify.cooldownSeconds` | integer | settings.json | Min seconds between notifications; 0 = no cooldown (default: 5) |
| `copilotNotify.messageFormat` | string | settings.json | `'default'` (label + workspace + duration + outcome + timestamp) or `'minimal'` (label + timestamp) |
| Bot Token | string | SecretStorage | Key: `copilotNotify.botToken` |

---

## Code Style

- TypeScript `"strict": true` — no `any`, use `unknown` with explicit narrowing
- Prefer `const` and immutable patterns; never mutate shared state
- All async functions must handle errors explicitly — no silent swallows
- Named constants for every user-visible string (see `src/constants.ts`)
- Functions ≤ 50 lines; files ≤ 800 lines
- No `console.log` — use the VS Code Output Channel

---

## What NOT To Do

- Do NOT read, log, or transmit any code content or prompt text
- Do NOT store the bot token in `settings.json` or workspace state
- Do NOT add backend servers, proxies, or third-party services
- Do NOT use `axios`, `node-fetch`, or other HTTP libs — `fetch` only
- Do NOT add telemetry or analytics of any kind
- Do NOT use internal Copilot APIs that are not part of the public VS Code extension surface

---

## Spec-Driven Development

All new work requires an active spec in `specs/doing/` before any product code is written. Refer to `memory/constitution.md` for the full SDD contract.
