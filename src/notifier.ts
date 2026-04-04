import * as vscode from 'vscode';
import {
    COMPLETION_LABEL,
    OUTCOME_COMPLETED,
    OUTCOME_CANCELLED,
    SUPPRESSED_OUTCOME_SUCCESS,
    SUPPRESSED_OUTCOME_FAILURE,
    SUPPRESSED_COOLDOWN,
    telegramApiUrl,
} from './constants';
import { ConfigManager } from './configManager';

export interface NotificationTaskMetadata {
    durationSeconds: number;
    outcome: 'completed' | 'cancelled';
}

export interface NotificationPayload {
    label: string;
    workspaceName: string | undefined;
    timestamp: string;
    durationSeconds?: number;
    outcome?: 'completed' | 'cancelled';
}

export type NotificationResult =
    | { success: true }
    | { success: false; errorMessage: string };

export interface Notifier {
    sendNotification(token: string, chatId: string, metadata: NotificationTaskMetadata): Promise<NotificationResult>;
    sendTestNotification(token: string, chatId: string): Promise<NotificationResult>;
}

export function buildPayload(metadata: NotificationTaskMetadata): NotificationPayload {
    return {
        label: COMPLETION_LABEL,
        workspaceName: vscode.workspace.workspaceFolders?.[0]?.name,
        timestamp: new Date().toISOString(),
        durationSeconds: metadata.durationSeconds,
        outcome: metadata.outcome,
    };
}

export function formatMessage(payload: NotificationPayload, format: 'default' | 'minimal'): string {
    if (format === 'minimal') {
        return [payload.label, payload.timestamp].join('\n');
    }
    // 'default' format
    const lines: string[] = [payload.label];
    if (payload.workspaceName !== undefined) {
        lines.push(`Workspace: ${payload.workspaceName}`);
    }
    if (payload.durationSeconds !== undefined) {
        lines.push(`Duration: ${payload.durationSeconds}s`);
    }
    if (payload.outcome !== undefined) {
        lines.push(`Outcome: ${payload.outcome}`);
    }
    lines.push(payload.timestamp);
    return lines.join('\n');
}

export function createNotifier(outputChannel: vscode.OutputChannel, config: ConfigManager): Notifier {
    let lastDispatchedAt: number | undefined = undefined;

    return {
        async sendNotification(token: string, chatId: string, metadata: NotificationTaskMetadata): Promise<NotificationResult> {
            const notifyOnSuccess = config.getNotifyOnSuccess();
            const notifyOnFailure = config.getNotifyOnFailure();

            if (metadata.outcome === OUTCOME_COMPLETED && !notifyOnSuccess) {
                outputChannel.appendLine(SUPPRESSED_OUTCOME_SUCCESS);
                return { success: true };
            }

            if (metadata.outcome === OUTCOME_CANCELLED && !notifyOnFailure) {
                outputChannel.appendLine(SUPPRESSED_OUTCOME_FAILURE);
                return { success: true };
            }

            const cooldownSeconds = config.getCooldownSeconds();
            if (cooldownSeconds > 0 && lastDispatchedAt !== undefined) {
                const elapsedSeconds = (Date.now() - lastDispatchedAt) / 1000;
                if (elapsedSeconds < cooldownSeconds) {
                    const remainingSeconds = cooldownSeconds - elapsedSeconds;
                    outputChannel.appendLine(
                        `${SUPPRESSED_COOLDOWN} ${Math.ceil(remainingSeconds)}s remaining`
                    );
                    return { success: true };
                }
            }

            const messageFormat = config.getMessageFormat();
            const payload = buildPayload(metadata);
            const text = formatMessage(payload, messageFormat);

            try {
                const response = await fetch(telegramApiUrl(token), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text }),
                });

                if (response.ok) {
                    lastDispatchedAt = Date.now();
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

        async sendTestNotification(token: string, chatId: string): Promise<NotificationResult> {
            const text = COMPLETION_LABEL;

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