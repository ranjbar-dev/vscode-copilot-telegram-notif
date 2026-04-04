import * as vscode from 'vscode';
import {
    CHANNEL_NAME,
    CMD_CONFIGURE,
    CMD_DISABLE,
    CMD_ENABLE,
    CMD_SEND_TEST,
    CMD_SHOW_LOGS,
    TEST_SUCCESS_MESSAGE,
    WARN_MISSING_BOT_TOKEN,
    WARN_MISSING_CHAT_ID,
} from './constants';
import { createSecretManager, SecretManager } from './secretManager';
import { createConfigManager, ConfigManager } from './configManager';
import { createNotifier } from './notifier';
import { createStatusBarManager, StatusBarState } from './statusBar';
import { registerParticipant, runSetupWizard } from './participant';

async function computeState(
    secretManager: SecretManager,
    configManager: ConfigManager,
): Promise<StatusBarState> {
    if (!configManager.getEnabled()) {
        return 'OFF';
    }
    const token = await secretManager.getToken();
    if (!token || !configManager.getChatId()) {
        return 'NOT_CONFIGURED';
    }
    return 'ON';
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel(CHANNEL_NAME);
    const secretManager = createSecretManager(context.secrets);
    const configManager = createConfigManager(outputChannel);
    const notifier = createNotifier(outputChannel, configManager);
    const statusBarManager = createStatusBarManager();

    const initialState = await computeState(secretManager, configManager);
    statusBarManager.update(initialState);

    context.subscriptions.push(
        registerParticipant(context, notifier, configManager, secretManager, outputChannel),
    );

    const configureCmd = vscode.commands.registerCommand(CMD_CONFIGURE, async () => {
        try {
            const result = await runSetupWizard(secretManager, configManager);
            if (result === 'completed') {
                const newState = await computeState(secretManager, configManager);
                statusBarManager.update(newState);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            outputChannel.appendLine(`Configure error: ${message}`);
            await vscode.window.showWarningMessage(message);
        }
    });

    const enableCmd = vscode.commands.registerCommand(CMD_ENABLE, async () => {
        await configManager.setEnabled(true);
        const newState = await computeState(secretManager, configManager);
        statusBarManager.update(newState);
    });

    const disableCmd = vscode.commands.registerCommand(CMD_DISABLE, async () => {
        await configManager.setEnabled(false);
        statusBarManager.update('OFF');
    });

    const sendTestCmd = vscode.commands.registerCommand(CMD_SEND_TEST, async () => {
        const token = await secretManager.getToken();
        const chatId = configManager.getChatId();

        if (!token && !chatId) {
            await vscode.window.showWarningMessage(
                'CopilotNotify: Bot token and chat ID are not configured.',
            );
            return;
        }
        if (!token) {
            await vscode.window.showWarningMessage(WARN_MISSING_BOT_TOKEN);
            return;
        }
        if (!chatId) {
            await vscode.window.showWarningMessage(WARN_MISSING_CHAT_ID);
            return;
        }

        const result = await notifier.sendTestNotification(token, chatId);
        if (result.success) {
            await vscode.window.showInformationMessage(TEST_SUCCESS_MESSAGE);
        } else {
            await vscode.window.showWarningMessage(result.errorMessage);
        }
    });

    const showLogsCmd = vscode.commands.registerCommand(CMD_SHOW_LOGS, () => {
        outputChannel.show();
    });

    context.subscriptions.push(
        configureCmd,
        enableCmd,
        disableCmd,
        sendTestCmd,
        showLogsCmd,
        { dispose: () => statusBarManager.dispose() },
    );
}

export function deactivate(): void {
    // VS Code auto-disposes context.subscriptions on deactivation
}
