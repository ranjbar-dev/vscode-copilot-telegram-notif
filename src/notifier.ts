import * as vscode from 'vscode';
import { COMPLETION_LABEL, telegramApiUrl } from './constants';

// VS Code extension host (Electron / Node.js ≥18) provides fetch as a built-in global.
// Declare it here so TypeScript resolves the symbol without requiring "lib": ["dom"].
declare const fetch: (
    input: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown> }>;

export interface NotificationPayload {
    label: string;
    workspaceName: string | undefined;
    timestamp: string;
}

export type NotificationResult =
    | { success: true }
    | { success: false; errorMessage: string };

export interface Notifier {
    sendNotification(token: string, chatId: string): Promise<NotificationResult>;
}

export function buildPayload(): NotificationPayload {
    return {
        label: COMPLETION_LABEL,
        workspaceName: vscode.workspace.workspaceFolders?.[0]?.name,
        timestamp: new Date().toISOString(),
    };
}

export function formatMessage(payload: NotificationPayload): string {
    const lines: string[] = [payload.label];
    if (payload.workspaceName !== undefined) {
        lines.push(`Workspace: ${payload.workspaceName}`);
    }
    lines.push(payload.timestamp);
    return lines.join('\n');
}

export function createNotifier(outputChannel: vscode.OutputChannel): Notifier {
    return {
        async sendNotification(token: string, chatId: string): Promise<NotificationResult> {
            const payload = buildPayload();
            const text = formatMessage(payload);

            try {
                const response = await fetch(telegramApiUrl(token), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text }),
                });

                if (response.ok) {
                    return { success: true };
                }

                const status = response.status;
                try {
                    const json = await response.json() as { description?: unknown };
                    const description =
                        typeof json.description === 'string' ? json.description : undefined;
                    const errorMessage = description
                        ? `Telegram error ${status}: ${description}`
                        : `Telegram error ${status}`;
                    outputChannel.appendLine(errorMessage);
                    return { success: false, errorMessage };
                } catch {
                    const errorMessage = `Telegram error ${status}`;
                    outputChannel.appendLine(errorMessage);
                    return { success: false, errorMessage };
                }
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                outputChannel.appendLine(errorMessage);
                return { success: false, errorMessage };
            }
        },
    };
}
