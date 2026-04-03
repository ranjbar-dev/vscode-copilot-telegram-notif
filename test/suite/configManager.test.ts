import * as vscode from 'vscode';
import { createConfigManager } from '../../src/configManager';
import { CONFIG_SECTION } from '../../src/constants';

function strictEqual<T>(actual: T, expected: T): void {
    if (actual !== expected) {
        throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
    }
}

suite('ConfigManager', () => {
    let store: Record<string, unknown>;
    let originalGetConfiguration: typeof vscode.workspace.getConfiguration;

    setup(() => {
        store = {};
        originalGetConfiguration = vscode.workspace.getConfiguration;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (vscode.workspace as any).getConfiguration = (section?: string) => {
            if (section !== CONFIG_SECTION) {
                return originalGetConfiguration.call(vscode.workspace, section);
            }
            return {
                get<T>(key: string, defaultValue: T): T {
                    return key in store ? (store[key] as T) : defaultValue;
                },
                async update(key: string, value: unknown): Promise<void> {
                    store[key] = value;
                },
            };
        };
    });

    teardown(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (vscode.workspace as any).getConfiguration = originalGetConfiguration;
    });

    test('default enabled is true', () => {
        const cfg = createConfigManager();
        strictEqual(cfg.getEnabled(), true);
    });

    test('default chatId is empty string', () => {
        const cfg = createConfigManager();
        strictEqual(cfg.getChatId(), '');
    });

    test('setChatId round-trip', async () => {
        const cfg = createConfigManager();
        await cfg.setChatId('123');
        strictEqual(cfg.getChatId(), '123');
    });

    test('setEnabled round-trip to false', async () => {
        const cfg = createConfigManager();
        await cfg.setEnabled(false);
        strictEqual(cfg.getEnabled(), false);
    });
});
