# Repository Constitution — CopilotNotify

**Version:** 1.0  
**Date:** 2026-04-03  
**Author:** Amir Ranjbar

---

## 1. Project Identity

- **Name:** CopilotNotify  
- **Type:** VS Code Extension  
- **Publisher:** devbehkami  
- **Purpose:** Send Telegram push notifications when a GitHub Copilot agent task completes, so developers can step away and be alerted the moment Copilot finishes.

---

## 2. Active Scope

**Phase 1 MVP (v0.1.0) only.** No Phase 2–4 code until Phase 1 is shipped and spec'd.

Phase 1 deliverables:
- Extension scaffold (TypeScript + VS Code Extension API)
- Telegram bot setup wizard (bot token stored in SecretStorage, chat ID in settings)
- Custom chat participant to detect Copilot task completion
- Send notification on task end
- Send test notification command
- Status bar indicator (ON / OFF / Not Configured)

---

## 3. Immutable Decisions

| Decision | Value |
|---|---|
| Language | TypeScript (strict mode) |
| Extension API | VS Code Extension API (no electron/node internal APIs) |
| Copilot detection | Custom chat participant — `vscode.chat` API |
| Bot token storage | `vscode.SecretStorage` — **never** `settings.json`, **never** plaintext |
| Chat ID storage | `vscode.workspace.getConfiguration` (non-secret) |
| HTTP client | Native `fetch` — no axios, no node-fetch |
| Backend | None. Direct HTTPS to `api.telegram.org` only |
| Telemetry | None. No analytics, no tracking |
| Task summary content | Generic label only (e.g., "Copilot task finished") — NO prompt text, NO code content |
| Privacy | Extension never reads or transmits user code or prompts |

---

## 4. Architecture Principles

1. **Privacy-first** — the extension never touches prompt text or file content. Only metadata (status, timestamp, generic label).
2. **No backend** — all calls go directly from the extension to the Telegram Bot API over HTTPS.
3. **Minimal dependencies** — native VS Code APIs and built-in Node/fetch only.
4. **SecretStorage from day one** — bot token is stored in encrypted SecretStorage even in v0.1.0.
5. **Graceful degradation** — if Telegram is unreachable, log silently; never block or crash the editor.

---

## 5. Code Style Conventions

- TypeScript strict mode (`"strict": true` in tsconfig)
- No `any` types — use `unknown` and narrow explicitly
- Immutable-first: prefer `const`, `readonly`, immutable data transforms
- Functions < 50 lines; files < 800 lines
- No hardcoded strings — use named constants
- Error handling at every async boundary; never swallow errors silently
- All user-facing strings go through a single constants file (Phase 1 is English only)

---

## 6. Testing Requirements

- Target: 80% unit test coverage by end of Phase 1
- Framework: `@vscode/test-electron` + Mocha (VS Code extension standard)
- Test notification dispatch logic with mocked `fetch`
- Test SecretStorage interactions with VS Code test harness

---

## 7. Spec-Driven Development Contract

- All new features must be spec'd before implementation begins
- Specs live in `specs/queue/`, `specs/doing/`, `specs/done/`
- No product code is written without an active spec in `specs/doing/`
- This constitution is updated whenever an immutable decision changes (requires deliberate review)

---

## 8. References

| Resource | URL |
|---|---|
| VS Code Extension API | https://code.visualstudio.com/api |
| VS Code Chat API | https://code.visualstudio.com/api/extension-guides/chat |
| VS Code SecretStorage | https://code.visualstudio.com/api/references/vscode-api#SecretStorage |
| Telegram Bot API | https://core.telegram.org/bots/api |
| PRD | PDR.md (workspace root) |
