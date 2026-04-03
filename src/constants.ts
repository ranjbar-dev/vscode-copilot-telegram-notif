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
