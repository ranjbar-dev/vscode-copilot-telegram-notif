import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import {
	COMPLETION_LABEL,
	FORMAT_MINIMAL,
	OUTCOME_CANCELLED,
	OUTCOME_COMPLETED,
	SUPPRESSED_COOLDOWN,
	SUPPRESSED_OUTCOME_FAILURE,
	SUPPRESSED_OUTCOME_SUCCESS,
	telegramApiUrl,
} from './constants';

export interface NotificationTaskMetadata {
	readonly durationSeconds: number;
	readonly outcome: 'completed' | 'cancelled';
}

export interface NotificationPayload {
	readonly label: string;
	readonly workspaceName?: string;
	readonly timestamp: string;
	readonly durationSeconds?: number;
	readonly outcome?: 'completed' | 'cancelled';
}

export type NotificationResult =
	| { readonly success: true }
	| { readonly success: false; readonly errorMessage: string };

export interface Notifier {
	sendNotification(
		token: string,
		chatId: string,
		metadata: NotificationTaskMetadata,
	): Promise<NotificationResult>;
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

export function formatMessage(
	payload: NotificationPayload,
	format: 'default' | 'minimal',
): string {
	if (format === FORMAT_MINIMAL) {
		return [payload.label, payload.timestamp].join('\n');
	}

	const lines = [payload.label];
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

export function createNotifier(
	outputChannel: vscode.OutputChannel,
	config: ConfigManager,
): Notifier {
	let lastDispatchedAt: number | undefined;

	async function postMessage(token: string, chatId: string, text: string): Promise<NotificationResult> {
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
				const description = typeof json.description === 'string' ? json.description : undefined;
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
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			outputChannel.appendLine(errorMessage);
			return { success: false, errorMessage };
		}
	}

	return {
		async sendNotification(
			token: string,
			chatId: string,
			metadata: NotificationTaskMetadata,
		): Promise<NotificationResult> {
			if (metadata.outcome === OUTCOME_COMPLETED && !config.getNotifyOnSuccess()) {
				outputChannel.appendLine(SUPPRESSED_OUTCOME_SUCCESS);
				return { success: true };
			}

			if (metadata.outcome === OUTCOME_CANCELLED && !config.getNotifyOnFailure()) {
				outputChannel.appendLine(SUPPRESSED_OUTCOME_FAILURE);
				return { success: true };
			}

			const cooldownSeconds = config.getCooldownSeconds();
			if (cooldownSeconds > 0 && lastDispatchedAt !== undefined) {
				const elapsedSeconds = (Date.now() - lastDispatchedAt) / 1000;
				if (elapsedSeconds < cooldownSeconds) {
					const remainingSeconds = cooldownSeconds - elapsedSeconds;
					outputChannel.appendLine(
						`${SUPPRESSED_COOLDOWN} ${Math.ceil(remainingSeconds)}s remaining`,
					);
					return { success: true };
				}
			}

			const messageFormat = config.getMessageFormat();
			const payload = buildPayload(metadata);
			const text = formatMessage(payload, messageFormat);
			const result = await postMessage(token, chatId, text);
			if (result.success) {
				lastDispatchedAt = Date.now();
			}
			return result;
		},

		async sendTestNotification(token: string, chatId: string): Promise<NotificationResult> {
			const text = [COMPLETION_LABEL, new Date().toISOString()].join('\n');
			return postMessage(token, chatId, text);
		},
	};
}
