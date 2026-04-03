import * as vscode from 'vscode';
import {
    CONFIG_SECTION,
    CONFIG_KEY_CHAT_ID,
    CONFIG_KEY_ENABLED,
} from './constants';

export interface ConfigManager {
    getChatId(): string;
    getEnabled(): boolean;
    setChatId(v: string): Promise<void>;
    setEnabled(v: boolean): Promise<void>;
}

export function createConfigManager(): ConfigManager {
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
    };
}
