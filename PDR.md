# PDR: CopilotNotify — Telegram Notifications for GitHub Copilot Tasks

**Document Version:** 2.0
**Date:** 2026-04-05
**Author:** devbehkami
**Status:** Active — Phase 1 and Phase 2 complete

---

## 1. Overview

### 1.1 Product Summary

**CopilotNotify** is a Visual Studio Code extension that sends real-time Telegram notifications when a GitHub Copilot chat participant turn completes. It is privacy-first and serverless: the extension calls the Telegram Bot API directly from the extension host, with no backend.

Detection is implemented via the public VS Code Chat Participant API (`vscode.chat`). The extension registers a custom chat participant; when a participant turn completes (or is cancelled), a notification is dispatched. The current scope is participant-turn notifications — passive observation of arbitrary background Copilot tasks is not yet supported.

### 1.2 Inspiration

Inspired by [NotiDone](https://marketplace.visualstudio.com/items?itemName=w3leee.notidone), which pioneered the concept of IDE-to-Telegram task notifications.

### 1.3 Problem Statement

GitHub Copilot agent tasks can take many seconds to complete. Developers are forced to either stay glued to the screen or check back manually. CopilotNotify provides a push notification to Telegram the moment a participant turn finishes.

### 1.4 Target Users

| User Type | Description |
|---|---|
| Solo developers | Using Copilot chat for agent-style tasks |
| Freelancers / remote devs | Multitasking between Copilot and other work |
| Power users | Who want async workflows with Copilot |

---

## 2. Goals & Non-Goals

### Goals ✅
- Notify the user on Telegram when a Copilot participant turn completes or is cancelled
- Allow users to configure their own Telegram bot (no shared infrastructure)
- Provide privacy-safe metadata only in messages (label, workspace, duration, outcome, timestamp)
- Be lightweight and zero-dependency on third-party servers or HTTP libraries
- Support enable/disable toggle and notification cooldown

### Non-Goals ❌
- Does NOT send notifications for standard autocomplete suggestions
- Does NOT read, log, or transmit any code content, prompt text, or task summaries
- Does NOT support Slack, email, or Discord (v1 scope — Telegram only)
- Does NOT require a backend server
- Does NOT passively observe arbitrary Copilot tasks outside participant turns (future work)

---

## 3. User Stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-01 | Developer | Receive a Telegram message when my Copilot participant turn finishes | I can step away and get notified |
| US-02 | Developer | Set up my own Telegram bot token and chat ID | My messages stay private |
| US-03 | Developer | Enable/disable notifications without uninstalling | I can turn it off when I don't need it |
| US-04 | Developer | Know the outcome (completed vs cancelled) in the Telegram message | I know how the turn ended |
| US-05 | Developer | Configure notification cooldown | Avoid spam on rapid successive turns |
| US-06 | Developer | Test my Telegram setup from within VS Code | Validate setup before relying on it |

---

## 4. Technical Architecture

### 4.1 High-Level Flow

```
VS Code + Copilot Extension
        │
        │  Participant turn completes (public vscode.chat participant API)
        ▼
CopilotNotify Extension (participant handler)
        │
        │  Reads config: enabled, chatId, outcome filters, cooldown, format
        │  Reads bot token from SecretStorage
        ▼
  Telegram Bot API (HTTPS — native fetch only)
        │
        ▼
  User's Telegram App 📱
```

### 4.2 Key Technical Components

| Component | Technology | Description |
|---|---|---|
| Extension entry point | `src/extension.ts` | `activate` / `deactivate`, registers commands and participant |
| Chat participant | `src/participant.ts` | Registers custom participant via `vscode.chat.createChatParticipant`; detects turn completion and outcome via VS Code cancellation token |
| Notification dispatcher | `src/notifier.ts` | Builds message payload, enforces cooldown, dispatches via `fetch` |
| Secret manager | `src/secretManager.ts` | `vscode.SecretStorage` wrapper — bot token never written to `settings.json` |
| Config manager | `src/configManager.ts` | `vscode.workspace.getConfiguration` accessor for all non-secret settings |
| Status bar | `src/statusBar.ts` | Status bar item lifecycle |
| Constants | `src/constants.ts` | All user-visible strings and setting key names |

### 4.3 Copilot Detection Strategy

The extension registers a **custom VS Code chat participant** using the public `vscode.chat.createChatParticipant` API. This is the supported, public surface for hooking into Copilot Chat turn lifecycle.

- Turn completion is detected when the participant handler returns normally.
- Turn cancellation is detected via the `vscode.CancellationToken` passed to the handler.
- No private or internal Copilot APIs are used.
- Passive observation of background Copilot Edits / Workspace agent tasks is **not** implemented in v0.2.0 (see Phase 4).

### 4.4 Message Content — Privacy Guarantee

Notification messages contain **only privacy-safe metadata**:

| Field | Example |
|---|---|
| Label | `"Copilot response"` |
| Workspace name | `"my-app"` |
| Duration | `42s` |
| Outcome | `completed` / `cancelled` |
| Timestamp | `2026-04-05T15:32:00Z` |

The extension **never** reads, summarizes, or transmits prompt text, generated code, file names, or any other user content.

**Example default format notification:**
```
✅ Copilot response finished
📁 Workspace: my-app
⏱ Duration: 42s
📊 Outcome: completed
🕒 2026-04-05T15:32:00.000Z
```

### 4.5 Telegram Integration

- Official [Telegram Bot API](https://core.telegram.org/bots/api)
- Endpoint: `POST https://api.telegram.org/bot<TOKEN>/sendMessage`
- HTTP client: **native `fetch` only** — no axios, no node-fetch, no third-party libraries

---

## 5. Configuration Schema

All settings live under `copilotNotify.*`. The bot token is **not** a setting — it is stored exclusively in `vscode.SecretStorage`.

| Setting Key | Type | Default | Storage | Description |
|---|---|---|---|---|
| `copilotNotify.enabled` | `boolean` | `true` | settings.json | Master on/off switch |
| `copilotNotify.telegramChatId` | `string` | `""` | settings.json | Your Telegram chat ID (not a secret) |
| `copilotNotify.notifyOnSuccess` | `boolean` | `true` | settings.json | Send notification on completed turns |
| `copilotNotify.notifyOnFailure` | `boolean` | `true` | settings.json | Send notification on cancelled turns |
| `copilotNotify.cooldownSeconds` | `integer` | `5` | settings.json | Min seconds between notifications; `0` = no cooldown |
| `copilotNotify.messageFormat` | `string` | `"default"` | settings.json | `"default"` (label + workspace + duration + outcome + timestamp) or `"minimal"` (label + timestamp) |
| Bot token | `string` | — | SecretStorage | Key: `copilotNotify.botToken` — never in settings.json |

---

## 6. UX & Interface

### 6.1 Onboarding Flow

```
1. Install extension
2. Run command: "CopilotNotify: Configure"
3. Input box: Enter Telegram Bot Token (stored in SecretStorage)
4. Input box: Enter Telegram Chat ID (stored in settings.json)
5. Extension sends a test message: "🎉 CopilotNotify is connected!"
6. Setup complete — status bar shows enabled state
```

### 6.2 Commands

| Command ID | Description |
|---|---|
| `copilotNotify.setup` | Opens setup wizard (bot token + chat ID) |
| `copilotNotify.sendTest` | Sends test notification to Telegram |

### 6.3 Status Bar

- `🔔 CopilotNotify` — Active and configured
- `🔕 CopilotNotify` — Disabled by user
- `⚠️ CopilotNotify` — Not configured (missing token or chat ID)

---

## 7. Privacy & Security

| Concern | Approach |
|---|---|
| Bot token storage | Stored exclusively in `vscode.SecretStorage` — never written to `settings.json` or workspace state |
| Code/prompt privacy | Extension never reads or transmits any code, prompt text, or file content — only metadata |
| No telemetry | No analytics, no tracking, no third-party servers |
| HTTPS only | All Telegram API calls are HTTPS via native `fetch` |
| Open source | Full source on GitHub for community audit |

---

## 8. Deliverables & Milestones

### Phase 1 — MVP (v0.1.0) ✅ Complete
- [x] Extension scaffold with TypeScript (strict mode)
- [x] Telegram setup wizard (bot token via SecretStorage, chat ID via settings)
- [x] Copilot Chat participant turn completion detection via public `vscode.chat` API
- [x] Send notification on turn end
- [x] Send test notification command (`copilotNotify.sendTest`)
- [x] Status bar indicator
- [x] Native `fetch` HTTP dispatch — no third-party libraries

### Phase 2 — Enriched Notifications (v0.2.0) ✅ Complete
- [x] Turn duration tracking
- [x] Completed vs cancelled outcome detection
- [x] Per-outcome notification filtering (`notifyOnSuccess`, `notifyOnFailure`)
- [x] Notification cooldown (`cooldownSeconds`)
- [x] Message format variants (`"default"` / `"minimal"`)
- [x] Unit test suite (Mocha + @vscode/test-electron) for all core modules

### Phase 3 — Repo Foundation ✅ (repo-local items complete)
- [x] README with setup instructions
- [x] CHANGELOG (Keep a Changelog format)
- [x] LICENSE
- [x] GitHub Actions CI (compile + test on push/PR)
- [x] Issue templates (bug report, feature request)
- [ ] Demo GIF for README — **not yet done**
- [ ] VS Code Marketplace submission — **not yet done**

### Phase 4 — Future (v1.x+)
- [ ] Passive detection of Copilot Edits / Workspace agent events (pending stable public API)
- [ ] Custom message templates
- [ ] Multi-channel support (Discord, Slack)
- [ ] Notification history panel in sidebar

---

## 9. Success Metrics

| Metric | Target |
|---|---|
| Marketplace installs (30 days post-launch) | 500+ |
| Setup completion rate | >70% of installers |
| Crash-free sessions | >99% |
| Average rating | ≥4.5 ⭐ |
| GitHub stars | 100+ in 60 days |

---

## 10. References

| Resource | Link |
|---|---|
| VS Code Extension API | https://code.visualstudio.com/api |
| VS Code Chat Participant API | https://code.visualstudio.com/api/extension-guides/chat |
| Telegram Bot API | https://core.telegram.org/bots/api |
| NotiDone (inspiration) | https://marketplace.visualstudio.com/items?itemName=w3leee.notidone |
| VS Code SecretStorage API | https://code.visualstudio.com/api/references/vscode-api#SecretStorage |
| Keep a Changelog | https://keepachangelog.com/en/1.1.0/ |

---

## 11. Open Risks

| Risk | Severity | Status |
|---|---|---|
| Participant-only scope: passive Copilot task events not yet public | High | Accepted for v0.x; tracked for Phase 4 |
| VS Code Chat API surface changes | Medium | Pin to stable API versions; monitor changelogs |
| False cooldown suppression (rapid chat turns) | Low | Cooldown is user-configurable; default 5s is conservative |