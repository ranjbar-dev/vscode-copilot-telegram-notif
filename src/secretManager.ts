import * as vscode from 'vscode';
import { SECRET_KEY_BOT_TOKEN } from './constants';

export interface SecretManager {
    getToken(): Promise<string | undefined>;
    storeToken(token: string): Promise<void>;
}

export function createSecretManager(secrets: vscode.SecretStorage): SecretManager {
    return {
        async getToken(): Promise<string | undefined> {
            return secrets.get(SECRET_KEY_BOT_TOKEN);
        },
        async storeToken(token: string): Promise<void> {
            await secrets.store(SECRET_KEY_BOT_TOKEN, token);
        },
    };
}
