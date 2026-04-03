import * as vscode from 'vscode';
import {
    CMD_CONFIGURE,
    STATUS_BAR_ON,
    STATUS_BAR_OFF,
    STATUS_BAR_NOT_CONFIGURED,
} from './constants';

export type StatusBarState = 'ON' | 'OFF' | 'NOT_CONFIGURED';

export interface StatusBarManager {
    update(state: StatusBarState): void;
    dispose(): void;
}

export function createStatusBarManager(): StatusBarManager {
    const item = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    item.show();

    return {
        update(state: StatusBarState): void {
            switch (state) {
                case 'ON':
                    item.text = STATUS_BAR_ON;
                    break;
                case 'OFF':
                    item.text = STATUS_BAR_OFF;
                    break;
                case 'NOT_CONFIGURED':
                    item.text = STATUS_BAR_NOT_CONFIGURED;
                    break;
            }
            item.command = CMD_CONFIGURE;
        },
        dispose(): void {
            item.dispose();
        },
    };
}
