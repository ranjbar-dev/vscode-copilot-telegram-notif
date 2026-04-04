import * as vscode from 'vscode';
import { createConfigManager } from '../../src/configManager';
import {
    CONFIG_SECTION,
    CONFIG_NOTIFY_ON_SUCCESS,
    CONFIG_NOTIFY_ON_FAILURE,
    CONFIG_COOLDOWN_SECONDS,
    CONFIG_MESSAGE_FORMAT,
    WARN_UNKNOWN_FORMAT,
} from '../../src/constants';

function strictEqual<T>(actual: T, expected: T): void {
    if (actual !== expected) {
        throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
    }
}

function assertTrue(value: boolean, msg?: string): void {
    if (!value) {
        throw new Error(msg ?? 'Expected true');
    }
}

suite('ConfigManager', () => {
    let store: Record<string, unknown>;
    let originalGetConfiguration: typeof vscode.workspace.getConfiguration;
    let outputLines: string[];
    let outputChannel: vscode.OutputChannel;

    setup(() => {
        store = {};
        outputLines = [];
        outputChannel = {
            appendLine(value: string): void {
                outputLines.push(value);
            },
        } as unknown as vscode.OutputChannel;
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

    // Phase 1 cases

    test('default enabled is true', () => {
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getEnabled(), true);
    });

    test('default chatId is empty string', () => {
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getChatId(), '');
    });

    test('setChatId round-trip', async () => {
        const cfg = createConfigManager(outputChannel);
        await cfg.setChatId('123');
        strictEqual(cfg.getChatId(), '123');
    });

    test('setEnabled round-trip to false', async () => {
        const cfg = createConfigManager(outputChannel);
        await cfg.setEnabled(false);
        strictEqual(cfg.getEnabled(), false);
    });

    // Phase 2 cases: getNotifyOnSuccess

    test('getNotifyOnSuccess default is true', () => {
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getNotifyOnSuccess(), true);
    });

    test('getNotifyOnSuccess explicit false', () => {
        store[CONFIG_NOTIFY_ON_SUCCESS] = false;
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getNotifyOnSuccess(), false);
    });

    // Phase 2 cases: getNotifyOnFailure

    test('getNotifyOnFailure default is true', () => {
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getNotifyOnFailure(), true);
    });

    test('getNotifyOnFailure explicit false', () => {
        store[CONFIG_NOTIFY_ON_FAILURE] = false;
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getNotifyOnFailure(), false);
    });

    // Phase 2 cases: getCooldownSeconds

    test('getCooldownSeconds default is 5', () => {
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getCooldownSeconds(), 5);
    });

    test('getCooldownSeconds negative value coerced to 0', () => {
        store[CONFIG_COOLDOWN_SECONDS] = -3;
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getCooldownSeconds(), 0);
    });

    test('getCooldownSeconds fractional value floored', () => {
        store[CONFIG_COOLDOWN_SECONDS] = 4.9;
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getCooldownSeconds(), 4);
    });

    // Phase 2 cases: getMessageFormat

    test('getMessageFormat default returns default', () => {
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getMessageFormat(), 'default');
    });

    test('getMessageFormat minimal returns minimal', () => {
        store[CONFIG_MESSAGE_FORMAT] = 'minimal';
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getMessageFormat(), 'minimal');
    });

    test('getMessageFormat unrecognized string falls back to default and logs warning', () => {
        store[CONFIG_MESSAGE_FORMAT] = 'compact';
        const cfg = createConfigManager(outputChannel);
        strictEqual(cfg.getMessageFormat(), 'default');
        assertTrue(
            outputLines.some(line => line.includes(WARN_UNKNOWN_FORMAT)),
            'Expected WARN_UNKNOWN_FORMAT to be logged to the output channel',
        );
    });
});
