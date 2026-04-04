# Changelog

All notable changes to **CopilotNotify** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.2.0] - 2026-04-04

### Added

- Task duration is now included in notification messages (`durationSeconds` field in payload).
- Participant-scope outcome detection: turns are classified as `"completed"` or `"cancelled"` based on the VS Code cancellation token.
- Outcome-based notification filtering: `copilotNotify.notifyOnSuccess` (default `true`) suppresses notifications for completed turns when set to `false`.
- Outcome-based notification filtering: `copilotNotify.notifyOnFailure` (default `true`) suppresses notifications for cancelled turns when set to `false`.
- Notification cooldown: `copilotNotify.cooldownSeconds` (default `5`) enforces a minimum interval between dispatches; set to `0` to disable.
- Message format variants: `copilotNotify.messageFormat` accepts `"default"` (label + workspace + duration + outcome + timestamp) or `"minimal"` (label + timestamp only).
- `sendTestNotification` method on `Notifier` — builds a fixed generic message and dispatches directly, bypassing outcome filters and cooldown.
- `@types/node` added to `devDependencies`; `"node"` added to `compilerOptions.types` in `tsconfig.json` to resolve strict-mode `assert` typing (DF-01).
- Version bumped to `0.2.0` in `package.json`.

---

## [0.1.0] - 2026-04-03

### Added

- Setup wizard command (`copilotNotify.setup`) that guides the user through bot-token and chat-ID configuration via input boxes.
- Bot token stored exclusively in `vscode.SecretStorage` (never written to `settings.json`).
- Telegram dispatch via the native `fetch` API — no third-party HTTP libraries.
- Enable / disable toggle (`copilotNotify.enabled`, default `true`) to suspend notifications without uninstalling.
- `copilotNotify.sendTest` command to send a test notification and validate credentials.
- Status bar indicator showing notification state (enabled / disabled).
- Generic completion message format: task label + optional workspace name + ISO timestamp.

---

[Unreleased]: https://github.com/devbehkami/vscode-copilot-telegram-notification/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/devbehkami/vscode-copilot-telegram-notification/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/devbehkami/vscode-copilot-telegram-notification/releases/tag/v0.1.0
