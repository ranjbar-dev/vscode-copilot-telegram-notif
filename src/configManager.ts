import * as vscode from 'vscode';
import {
    CONFIG_SECTION,
    CONFIG_KEY_CHAT_ID,
    CONFIG_KEY_ENABLED,
    CONFIG_NOTIFY_ON_SUCCESS,
    CONFIG_NOTIFY_ON_FAILURE,
    CONFIG_COOLDOWN_SECONDS,
    CONFIG_MESSAGE_FORMAT,
    FORMAT_DEFAULT,
    FORMAT_MINIMAL,
    WARN_UNKNOWN_FORMAT,
} from './constants';

export interface ConfigManager {
    getChatId(): string;
    getEnabled(): boolean;
    setChatId(v: string): Promise<void>;
    setEnabled(v: boolean): Promise<void>;
    getNotifyOnSuccess(): boolean;
    getNotifyOnFailure(): boolean;
    getCooldownSeconds(): number;
    getMessageFormat(): 'default' | 'minimal';
}

export function createConfigManager(outputChannel: vscode.OutputChannel): ConfigManager {
    return {
        getChatId(): string {
            return vscode.workspace
                .getConfiguration(CONFIG_SECTION)
                .get<string>(CONFIG_KEY_CHAT_ID, '');
        },

        getEnabled(): boolean {
            return vscode.workspace
                .getConfiguration(CONFIG_SECTION)
                .get<boolean>(CONFIG_KEY_ENABLED, true);
        },

        async setChatId(v: string): Promise<void> {
            await vscode.workspace
                .getConfiguration(CONFIG_SECTION)
                .update(CONFIG_KEY_CHAT_ID, v, vscode.ConfigurationTarget.Global);
        },

        async setEnabled(v: boolean): Promise<void> {
            await vscode.workspace
                .getConfiguration(CONFIG_SECTION)
                .update(CONFIG_KEY_ENABLED, v, vscode.ConfigurationTarget.Global);
        },

        getNotifyOnSuccess(): boolean {
            return vscode.workspace
                .getConfiguration(CONFIG_SECTION)
                .get<boolean>(CONFIG_NOTIFY_ON_SUCCESS, true);
        },

        getNotifyOnFailure(): boolean {
            return vscode.workspace
                .getConfiguration(CONFIG_SECTION)
                .get<boolean>(CONFIG_NOTIFY_ON_FAILURE, true);
        },

        getCooldownSeconds(): number {
            const raw = vscode.workspace
                .getConfiguration(CONFIG_SECTION)
                .get<number>(CONFIG_COOLDOWN_SECONDS, 5);
            return Math.max(0, Math.floor(raw));
        },

        getMessageFormat(): 'default' | 'minimal' {
            const raw = vscode.workspace
                .getConfiguration(CONFIG_SECTION)
                .get<string>(CONFIG_MESSAGE_FORMAT, FORMAT_DEFAULT);
            if (raw === FORMAT_DEFAULT || raw === FORMAT_MINIMAL) {
                return raw;
            }
            outputChannel.appendLine(WARN_UNKNOWN_FORMAT);
            return FORMAT_DEFAULT;
        },
    };
}
