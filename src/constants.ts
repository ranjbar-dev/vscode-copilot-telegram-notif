// Command IDs
export const CMD_CONFIGURE = 'copilotNotify.configure';
export const CMD_ENABLE = 'copilotNotify.enable';
export const CMD_DISABLE = 'copilotNotify.disable';
export const CMD_SEND_TEST = 'copilotNotify.sendTest';
export const CMD_SHOW_LOGS = 'copilotNotify.showLogs';

// Configuration
export const CONFIG_SECTION = 'copilotNotify';
export const CONFIG_KEY_ENABLED = 'enabled';
export const CONFIG_KEY_CHAT_ID = 'telegramChatId';

// SecretStorage
export const SECRET_KEY_BOT_TOKEN = 'copilotNotify.botToken';

// Output channel
export const CHANNEL_NAME = 'CopilotNotify';

// Chat participant
export const PARTICIPANT_ID = 'copilotnotify';
export const PARTICIPANT_NAME = 'copilotnotify';

// Telegram API
export const telegramApiUrl = (token: string): string =>
    `https://api.telegram.org/bot${token}/sendMessage`;

// Notification content
export const COMPLETION_LABEL = 'Copilot task finished';
export const PARTICIPANT_RESPONSE_LABEL = 'Notification sent.';

// Status bar
export const STATUS_BAR_ON = '🔔 Notify: ON';
export const STATUS_BAR_OFF = '🔕 Notify: OFF';
export const STATUS_BAR_NOT_CONFIGURED = '⚠️ Notify: Not Configured';

// Wizard validation messages
export const WIZARD_ERROR_TOKEN_EMPTY = 'Bot token must not be empty.';
export const WIZARD_ERROR_CHAT_ID_EMPTY = 'Chat ID must not be empty.';

// Test command messages
export const TEST_SUCCESS_MESSAGE = 'CopilotNotify: Test notification sent successfully.';
export const TEST_FAILURE_WARNING_PREFIX = 'CopilotNotify: Test notification failed — ';

// Phase 2 config keys
export const CONFIG_NOTIFY_ON_SUCCESS = 'notifyOnSuccess';
export const CONFIG_NOTIFY_ON_FAILURE = 'notifyOnFailure';
export const CONFIG_COOLDOWN_SECONDS = 'cooldownSeconds';
export const CONFIG_MESSAGE_FORMAT = 'messageFormat';

// Outcome values
export const OUTCOME_COMPLETED = 'completed';
export const OUTCOME_CANCELLED = 'cancelled';

// Message format values
export const FORMAT_DEFAULT = 'default';
export const FORMAT_MINIMAL = 'minimal';

// Suppression log prefix constants (runtime appends remaining-seconds suffix to SUPPRESSED_COOLDOWN)
export const SUPPRESSED_OUTCOME_SUCCESS = "[CopilotNotify] Notification suppressed — notifyOnSuccess is false";
export const SUPPRESSED_OUTCOME_FAILURE = "[CopilotNotify] Notification suppressed — notifyOnFailure is false";
export const SUPPRESSED_COOLDOWN = "[CopilotNotify] Notification suppressed — cooldown active";

// Format-fallback warning
export const WARN_UNKNOWN_FORMAT = "[CopilotNotify] Unknown messageFormat value; falling back to 'default'";

// Missing-credential warnings (for use in extension.ts sendTest guard)
export const WARN_MISSING_BOT_TOKEN = 'CopilotNotify: Bot token is not configured.';
export const WARN_MISSING_CHAT_ID = 'CopilotNotify: Chat ID is not configured.';
