import * as vscode from 'vscode';
import {
    PARTICIPANT_ID,
    PARTICIPANT_RESPONSE_LABEL,
    WIZARD_ERROR_TOKEN_EMPTY,
    WIZARD_ERROR_CHAT_ID_EMPTY,
} from './constants';
import { SecretManager } from './secretManager';
import { ConfigManager } from './configManager';
import { Notifier } from './notifier';

export async function runSetupWizard(
    secrets: SecretManager,
    config: ConfigManager,
): Promise<'completed' | 'cancelled'> {
    const token = await vscode.window.showInputBox({
        prompt: 'Enter your Telegram bot token',
        password: true,
        ignoreFocusOut: true,
        validateInput(value: string): string | undefined {
            if (!value || !value.trim()) {
                return WIZARD_ERROR_TOKEN_EMPTY;
            }
            return undefined;
        },
    });

    if (token === undefined) {
        return 'cancelled';
    }

    const existingChatId = config.getChatId();
    const chatId = await vscode.window.showInputBox({
        prompt: 'Enter your Telegram chat ID',
        value: existingChatId !== '' ? existingChatId : undefined,
        ignoreFocusOut: true,
        validateInput(value: string): string | undefined {
            if (!value || !value.trim()) {
                return WIZARD_ERROR_CHAT_ID_EMPTY;
            }
            return undefined;
        },
    });

    if (chatId === undefined) {
        return 'cancelled';
    }

    const previousChatId = config.getChatId();
    await config.setChatId(chatId);
    try {
        await secrets.storeToken(token);
    } catch (err) {
        await config.setChatId(previousChatId);
        throw err;
    }

    return 'completed';
}

export function registerParticipant(
    _context: vscode.ExtensionContext,
    notifier: Notifier,
    config: ConfigManager,
    secrets: SecretManager,
    outputChannel: vscode.OutputChannel,
): vscode.Disposable {
    const participant = vscode.chat.createChatParticipant(
        PARTICIPANT_ID,
        async (
            _request: vscode.ChatRequest,
            _ctx: vscode.ChatContext,
            response: vscode.ChatResponseStream,
            _token: vscode.CancellationToken,
        ) => {
            response.markdown(PARTICIPANT_RESPONSE_LABEL);

            if (!config.getEnabled()) {
                return;
            }

            const botToken = await secrets.getToken();
            const chatId = config.getChatId();

            if (!botToken || !chatId) {
                outputChannel.appendLine('CopilotNotify: not configured — missing token or chat ID.');
                return;
            }

            void notifier.sendNotification(botToken, chatId).then(result => {
                if (!result.success) {
                    outputChannel.appendLine(result.errorMessage);
                }
            });
        },
    );

    return participant;
}
