# GitHub Copilot Instructions — CopilotNotify

## What This Project Is

**CopilotNotify** is a VS Code extension that sends Telegram notifications when GitHub Copilot agent tasks complete. It is privacy-first and serverless: the extension calls the Telegram Bot API directly from the editor, with no backend.

Active scope: **Phase 1 MVP only** (v0.1.0). See `memory/constitution.md` for the full constitution.

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

## Project Structure (Phase 1 Target)

```
.
├── .github/
│   └── copilot-instructions.md   ← this file
├── memory/
│   └── constitution.md           ← immutable project decisions
├── specs/
│   ├── queue/                    ← specs awaiting work
│   ├── doing/                    ← spec currently being implemented
│   └── done/                     ← completed specs
├── src/
│   ├── extension.ts              ← activate/deactivate entry point
│   ├── participant.ts            ← Copilot chat participant + task detection
│   ├── notifier.ts               ← Telegram dispatch logic
│   ├── secretManager.ts          ← SecretStorage wrapper for bot token
│   ├── configManager.ts          ← workspace settings accessor
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
├── PDR.md                        ← Product Requirements Document
├── package.json
├── tsconfig.json
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
- Do NOT implement Phase 2+ features until Phase 1 spec is done
- Do NOT use `axios`, `node-fetch`, or other HTTP libs — `fetch` only
- Do NOT add telemetry or analytics of any kind
- Do NOT use internal Copilot APIs that are not part of the public VS Code extension surface

---

## Spec-Driven Development

All new work requires an active spec in `specs/doing/` before any product code is written. Refer to `memory/constitution.md` for the full SDD contract.
