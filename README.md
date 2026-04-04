# CopilotNotify

A VS Code extension that sends a **Telegram push notification** when the CopilotNotify custom chat participant finishes responding.

**Privacy-first · Serverless · Participant-turn scoped**

- The extension calls the Telegram Bot API directly from VS Code — no backend, no proxy.
- Only participant-turn metadata is sent: a generic label, workspace name, duration, and outcome. Prompt text, code content, and file diffs are never read, logged, or transmitted.
- Notifications are scoped exclusively to the `@copilotnotify` chat participant. The extension does **not** passively monitor Copilot Edits, autocomplete suggestions, or Copilot Chat conversations addressed to other participants.

---

## Prerequisites

### 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot` and follow the prompts (choose a name and a username ending in `bot`).
3. BotFather will reply with a **bot token** in the format `123456789:ABCdef...`. Copy it.

### 2. Retrieve Your Chat ID

1. Start a conversation with your new bot (send it any message).
2. Open a browser and visit:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Find the `"id"` field inside `"chat"` in the JSON response — that is your **chat ID** (a positive or negative integer).

> **Group / channel chats:** Add the bot to the group/channel first, then send a message mentioning the bot. Use the negative integer ID from `getUpdates`.

### 3. VS Code

VS Code **1.90.0 or later** is required.

---

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/devbehkami/vscode-copilot-telegram-notification.git
cd vscode-copilot-telegram-notification

# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

Then press **F5** in VS Code to launch an Extension Development Host with CopilotNotify loaded, or package the extension with:

```bash
npx vsce package
```

and install the generated `.vsix` file via **Extensions: Install from VSIX…** in the Command Palette.

---

## Usage

### First-Time Setup

1. Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run **CopilotNotify: Configure Telegram**.
3. Enter your **bot token** when prompted. It is stored in `vscode.SecretStorage` and never written to disk in plaintext.
4. Enter your **Telegram chat ID** when prompted. It is saved in VS Code workspace settings.

The status bar item in the bottom-left corner shows the current state:

| Icon | Meaning |
|---|---|
| 🔔 Notify: ON | Extension is enabled and credentials are configured |
| 🔕 Notify: OFF | Extension is explicitly disabled |
| ⚠️ Notify: Not Configured | Credentials are missing — run Configure Telegram first |

### Receiving Notifications

1. Open the **GitHub Copilot Chat** panel (`Ctrl+Alt+I` / `Cmd+Option+I`).
2. Address a message to the CopilotNotify participant:
   ```
   @copilotnotify explain this function
   ```
3. When the participant turn completes (or is cancelled), CopilotNotify sends a Telegram message to your configured chat.

**Default notification format:**
```
Copilot task finished
Workspace: my-project
Duration: 12s
Outcome: completed
2026-04-04T10:23:45.000Z
```

**Minimal notification format** (set `copilotNotify.messageFormat` to `"minimal"`):
```
Copilot task finished
2026-04-04T10:23:45.000Z
```

### Sending a Test Notification

Run **CopilotNotify: Send Test Notification** from the Command Palette. This sends a fixed generic message that bypasses outcome filtering and cooldown, so you can verify credentials without waiting for a real participant turn.

### Enabling and Disabling

- **CopilotNotify: Enable** — turns notifications on and saves the state globally.
- **CopilotNotify: Disable** — turns notifications off without clearing credentials.

### Viewing Logs

Run **CopilotNotify: Show Logs** to open the `CopilotNotify` Output Channel. All dispatch results, suppression reasons, and warnings are written there.

---

## Configuration Reference

All settings are in the `copilotNotify` namespace and can be configured in VS Code Settings (UI or `settings.json`).

| Setting | Type | Default | Description |
|---|---|---|---|
| `copilotNotify.enabled` | `boolean` | `true` | Master on/off switch for Telegram notifications. |
| `copilotNotify.telegramChatId` | `string` | `""` | Your Telegram chat ID (personal, group, or channel). Not a secret — the bot token is stored separately in SecretStorage. |
| `copilotNotify.notifyOnSuccess` | `boolean` | `true` | Send a notification when a participant turn completes normally (`outcome: completed`). Set to `false` to suppress successful-turn notifications. |
| `copilotNotify.notifyOnFailure` | `boolean` | `true` | Send a notification when a participant turn is cancelled (`outcome: cancelled`). Set to `false` to suppress cancelled-turn notifications. |
| `copilotNotify.cooldownSeconds` | `integer` | `5` | Minimum seconds between consecutive notifications. Prevents notification floods after rapid successive turns. Set to `0` to disable the cooldown entirely. Negative values are treated as `0`. |
| `copilotNotify.messageFormat` | `"default"` \| `"minimal"` | `"default"` | Notification verbosity. `"default"` includes label, workspace name (if available), duration, outcome, and ISO timestamp. `"minimal"` includes only the label and timestamp. Unrecognized values fall back to `"default"` with a warning logged to the Output Channel. |

> **Bot token** is not a VS Code setting — it is stored in `vscode.SecretStorage` under the key `copilotNotify.botToken` and is never written to `settings.json`.

---

## Commands

| Command | Description |
|---|---|
| `CopilotNotify: Configure Telegram` | Run the setup wizard to enter or update bot token and chat ID. |
| `CopilotNotify: Enable` | Enable notifications globally. |
| `CopilotNotify: Disable` | Disable notifications globally (credentials are preserved). |
| `CopilotNotify: Send Test Notification` | Send a fixed test message to verify credentials. Bypasses outcome filter and cooldown. |
| `CopilotNotify: Show Logs` | Open the CopilotNotify Output Channel. |

---

## Known Limitations

- **Participant-scope only.** CopilotNotify detects the completion of its own `@copilotnotify` participant turn. It does **not** monitor Copilot Edits, Copilot Workspace tasks, standard inline autocomplete, or Copilot Chat conversations addressed to other participants (e.g., `@workspace`, `@github`). This is a constraint of the public VS Code Chat Participant API — passive observation of other Copilot surfaces is not exposed.
- **Duration is wall-clock time.** Task duration is the elapsed time from when the participant handler is invoked to when it resolves. It reflects network round-trip and streaming time, not internal model execution time.
- **Outcome derives from the cancellation token.** "Cancelled" means `token.isCancellationRequested` was `true` when the handler resolved. It does not distinguish user-initiated cancellation from a timeout or error path that sets the token.
- **Telegram only.** Push notifications are sent exclusively to Telegram in this release. Slack, Discord, and other channels are out of scope.
- **Single destination.** One bot token and one chat ID per VS Code installation. Multi-destination dispatch is out of scope.
- **No message history.** Sent notifications are not stored or displayed inside VS Code.

---

## Security Notes

- The bot token is stored in `vscode.SecretStorage`, which is encrypted by the OS credential store. It is never written to `settings.json`, workspace state, or any log file.
- HTTP requests go directly to `https://api.telegram.org` using the native `fetch` built into the VS Code extension host — no third-party HTTP library, no proxy, no backend.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the release history.

---

## License

MIT — see [LICENSE](LICENSE).
