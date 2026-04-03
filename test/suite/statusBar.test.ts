import * as vscode from 'vscode';
import { createStatusBarManager } from '../../src/statusBar';
import {
    CMD_CONFIGURE,
    STATUS_BAR_ON,
    STATUS_BAR_OFF,
    STATUS_BAR_NOT_CONFIGURED,
} from '../../src/constants';

function assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
        throw new Error(
            message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
    }
}

suite('StatusBarManager', () => {
    let originalCreate: typeof vscode.window.createStatusBarItem;
    let fakeText: string;
    let fakeCommand: string | vscode.Command | undefined;
    let disposeCallCount: number;

    function makeFakeItem(): vscode.StatusBarItem {
        const item = {
            id: '',
            name: '',
            text: '',
            tooltip: undefined,
            color: undefined,
            backgroundColor: undefined,
            command: undefined,
            accessibilityInformation: undefined,
            alignment: vscode.StatusBarAlignment.Left,
            priority: 100,
            show(): void { /* no-op */ },
            hide(): void { /* no-op */ },
            dispose(): void { disposeCallCount++; },
        } as unknown as vscode.StatusBarItem;

        Object.defineProperty(item, 'text', {
            get: () => fakeText,
            set: (v: string) => { fakeText = v; },
            configurable: true,
        });
        Object.defineProperty(item, 'command', {
            get: () => fakeCommand,
            set: (v: string | vscode.Command | undefined) => { fakeCommand = v; },
            configurable: true,
        });
        return item;
    }

    setup(() => {
        fakeText = '';
        fakeCommand = undefined;
        disposeCallCount = 0;
        originalCreate = vscode.window.createStatusBarItem;
        (vscode.window as { createStatusBarItem: unknown }).createStatusBarItem =
            () => makeFakeItem();
    });

    teardown(() => {
        (vscode.window as { createStatusBarItem: unknown }).createStatusBarItem =
            originalCreate;
    });

    test('update ON sets STATUS_BAR_ON text', () => {
        const manager = createStatusBarManager();
        manager.update('ON');
        assertEqual(fakeText, STATUS_BAR_ON);
    });

    test('update OFF sets STATUS_BAR_OFF text', () => {
        const manager = createStatusBarManager();
        manager.update('OFF');
        assertEqual(fakeText, STATUS_BAR_OFF);
    });

    test('update NOT_CONFIGURED sets STATUS_BAR_NOT_CONFIGURED text', () => {
        const manager = createStatusBarManager();
        manager.update('NOT_CONFIGURED');
        assertEqual(fakeText, STATUS_BAR_NOT_CONFIGURED);
    });

    test('all states set command to CMD_CONFIGURE', () => {
        const manager = createStatusBarManager();
        const states: ReadonlyArray<'ON' | 'OFF' | 'NOT_CONFIGURED'> = [
            'ON',
            'OFF',
            'NOT_CONFIGURED',
        ];
        for (const state of states) {
            manager.update(state);
            assertEqual(fakeCommand, CMD_CONFIGURE);
        }
    });

    test('dispose calls underlying item dispose exactly once', () => {
        const manager = createStatusBarManager();
        manager.dispose();
        assertEqual(disposeCallCount, 1);
    });
});
