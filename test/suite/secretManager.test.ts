import * as assert from 'assert';
import type * as vscode from 'vscode';
import { createSecretManager } from '../../src/secretManager';
import { SECRET_KEY_BOT_TOKEN } from '../../src/constants';

class MockSecretStorage {
    private _data = new Map<string, string>();
    lastGetKey: string | undefined;
    lastStoreKey: string | undefined;

    get(key: string): Promise<string | undefined> {
        this.lastGetKey = key;
        return Promise.resolve(this._data.get(key));
    }

    store(key: string, value: string): Promise<void> {
        this.lastStoreKey = key;
        this._data.set(key, value);
        return Promise.resolve();
    }

    delete(key: string): Promise<void> {
        this._data.delete(key);
        return Promise.resolve();
    }
}

suite('SecretManager', () => {
    let mockStorage: MockSecretStorage;

    setup(() => {
        mockStorage = new MockSecretStorage();
    });

    test('getToken returns undefined when storage is empty', async () => {
        const manager = createSecretManager(mockStorage as unknown as vscode.SecretStorage);
        const result = await manager.getToken();
        assert.strictEqual(result, undefined);
    });

    test('storeToken then getToken returns the stored token', async () => {
        const manager = createSecretManager(mockStorage as unknown as vscode.SecretStorage);
        await manager.storeToken('abc');
        const result = await manager.getToken();
        assert.strictEqual(result, 'abc');
    });

    test('second storeToken overwrites the first', async () => {
        const manager = createSecretManager(mockStorage as unknown as vscode.SecretStorage);
        await manager.storeToken('first');
        await manager.storeToken('second');
        const result = await manager.getToken();
        assert.strictEqual(result, 'second');
    });

    test('uses SECRET_KEY_BOT_TOKEN constant as the storage key', async () => {
        const manager = createSecretManager(mockStorage as unknown as vscode.SecretStorage);
        await manager.storeToken('test-token');
        await manager.getToken();
        assert.strictEqual(mockStorage.lastStoreKey, SECRET_KEY_BOT_TOKEN);
        assert.strictEqual(mockStorage.lastGetKey, SECRET_KEY_BOT_TOKEN);
        assert.strictEqual(SECRET_KEY_BOT_TOKEN, 'copilotNotify.botToken');
    });
});
