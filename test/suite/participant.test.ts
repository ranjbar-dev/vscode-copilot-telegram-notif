import * as vscode from 'vscode';
import { registerParticipant } from '../../src/participant';
import { PARTICIPANT_RESPONSE_LABEL } from '../../src/constants';
import type { SecretManager } from '../../src/secretManager';
import type { ConfigManager } from '../../src/configManager';
import type { Notifier, NotificationResult } from '../../src/notifier';

// ── Inline assertion helpers ────────────────────────────────────────────────

function ok(value: unknown, msg?: string): void {
    if (!value) { throw new Error(msg ?? `Expected truthy value, got: ${String(value)}`); }
}

function strictEqual(actual: unknown, expected: unknown, msg?: string): void {
    if (actual !== expected) {
        throw new Error(msg ?? `Expected ${String(expected)}, got ${String(actual)}`);
    }
}

// ── Types ────────────────────────────────────────────────────────────────────

type ChatHandler = (
    request: vscode.ChatRequest,
    ctx: vscode.ChatContext,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
) => Promise<void>;

// ── Spy / stub helpers ───────────────────────────────────────────────────────

type SpyChannel = vscode.OutputChannel & { readonly lines: string[] };

function makeSpyChannel(): SpyChannel {
    const lines: string[] = [];
    return {
        lines,
        name: 'TestChannel',
        append: (_v: string): void => undefined,
        appendLine: (v: string): void => { lines.push(v); },
        replace: (_v: string): void => undefined,
        clear: (): void => undefined,
        show: (..._args: unknown[]): void => undefined,
        hide: (): void => undefined,
        dispose: (): void => undefined,
    } as unknown as SpyChannel;
}

type SpyResponse = vscode.ChatResponseStream & { readonly markdownCalls: string[] };

function makeSpyResponse(): SpyResponse {
    const markdownCalls: string[] = [];
    return {
        markdownCalls,
        markdown: (value: string | vscode.MarkdownString): void => {
            markdownCalls.push(typeof value === 'string' ? value : value.value);
        },
        anchor: (): void => undefined,
        button: (): void => undefined,
        filetree: (): void => undefined,
        progress: (): void => undefined,
        reference: (): void => undefined,
        textEdit: (): void => undefined,
        push: (): void => undefined,
    } as unknown as SpyResponse;
}

function makeStubContext(): vscode.ExtensionContext {
    return {} as unknown as vscode.ExtensionContext;
}

function makeStubSecretManager(token: string | undefined): SecretManager {
    return {
        getToken: (): Promise<string | undefined> => Promise.resolve(token),
        storeToken: (_t: string): Promise<void> => Promise.resolve(),
    };
}

function makeStubConfigManager(enabled: boolean, chatId: string): ConfigManager {
    return {
        getEnabled: (): boolean => enabled,
        getChatId: (): string => chatId,
        setChatId: (_v: string): Promise<void> => Promise.resolve(),
        setEnabled: (_v: boolean): Promise<void> => Promise.resolve(),
    };
}

type SpyNotifier = Notifier & { readonly calls: Array<{ token: string; chatId: string }> };

function makeSpyNotifier(result: NotificationResult): SpyNotifier {
    const calls: Array<{ token: string; chatId: string }> = [];
    return {
        calls,
        sendNotification: (token: string, chatId: string): Promise<NotificationResult> => {
            calls.push({ token, chatId });
            return Promise.resolve(result);
        },
    };
}

// ── Suite ────────────────────────────────────────────────────────────────────

suite('registerParticipant', () => {
    let capturedHandler: ChatHandler | undefined;
    let savedCreateChatParticipant: unknown;

    setup(() => {
        capturedHandler = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        savedCreateChatParticipant = (vscode.chat as any).createChatParticipant;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (vscode.chat as any).createChatParticipant = (
            _id: string,
            handler: ChatHandler,
        ): vscode.ChatParticipant => {
            capturedHandler = handler;
            return { dispose: (): void => undefined } as unknown as vscode.ChatParticipant;
        };
    });

    teardown(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (vscode.chat as any).createChatParticipant = savedCreateChatParticipant;
    });

    async function invokeHandler(
        notifier: Notifier,
        config: ConfigManager,
        secrets: SecretManager,
        channel: SpyChannel,
    ): Promise<SpyResponse> {
        registerParticipant(makeStubContext(), notifier, config, secrets, channel);
        if (capturedHandler === undefined) {
            throw new Error('createChatParticipant did not capture a handler');
        }
        const response = makeSpyResponse();
        await capturedHandler(
            {} as vscode.ChatRequest,
            {} as vscode.ChatContext,
            response,
            {} as vscode.CancellationToken,
        );
        // Flush pending microtasks so the fire-and-forget .then() callbacks run.
        await Promise.resolve();
        return response;
    }

    test('case 1: enabled false — responds with label, sendNotification not called', async () => {
        const channel = makeSpyChannel();
        const notifier = makeSpyNotifier({ success: true });
        const response = await invokeHandler(
            notifier,
            makeStubConfigManager(false, 'chatId'),
            makeStubSecretManager('token'),
            channel,
        );
        strictEqual(response.markdownCalls.length, 1);
        strictEqual(response.markdownCalls[0], PARTICIPANT_RESPONSE_LABEL);
        strictEqual(notifier.calls.length, 0);
        strictEqual(channel.lines.length, 0);
    });

    test('case 2: missing token — responds with label, logs not-configured, sendNotification not called', async () => {
        const channel = makeSpyChannel();
        const notifier = makeSpyNotifier({ success: true });
        const response = await invokeHandler(
            notifier,
            makeStubConfigManager(true, 'chatId'),
            makeStubSecretManager(undefined),
            channel,
        );
        strictEqual(response.markdownCalls.length, 1);
        strictEqual(response.markdownCalls[0], PARTICIPANT_RESPONSE_LABEL);
        strictEqual(notifier.calls.length, 0);
        strictEqual(channel.lines.length, 1);
        ok(channel.lines[0].includes('not configured'), 'expected "not configured" in log');
    });

    test('case 3: missing chatId — responds with label, logs not-configured, sendNotification not called', async () => {
        const channel = makeSpyChannel();
        const notifier = makeSpyNotifier({ success: true });
        const response = await invokeHandler(
            notifier,
            makeStubConfigManager(true, ''),
            makeStubSecretManager('token'),
            channel,
        );
        strictEqual(response.markdownCalls.length, 1);
        strictEqual(response.markdownCalls[0], PARTICIPANT_RESPONSE_LABEL);
        strictEqual(notifier.calls.length, 0);
        strictEqual(channel.lines.length, 1);
        ok(channel.lines[0].includes('not configured'), 'expected "not configured" in log');
    });

    test('case 4: credentials present and enabled — responds with label, sendNotification called once', async () => {
        const channel = makeSpyChannel();
        const notifier = makeSpyNotifier({ success: true });
        const response = await invokeHandler(
            notifier,
            makeStubConfigManager(true, 'test-chat-id'),
            makeStubSecretManager('test-token'),
            channel,
        );
        strictEqual(response.markdownCalls.length, 1);
        strictEqual(response.markdownCalls[0], PARTICIPANT_RESPONSE_LABEL);
        strictEqual(notifier.calls.length, 1);
        strictEqual(notifier.calls[0].token, 'test-token');
        strictEqual(notifier.calls[0].chatId, 'test-chat-id');
        strictEqual(channel.lines.length, 0);
    });

    test('case 5: notifier failure — responds with label, error message logged, no throw', async () => {
        const channel = makeSpyChannel();
        const notifier = makeSpyNotifier({ success: false, errorMessage: 'boom' });
        const response = await invokeHandler(
            notifier,
            makeStubConfigManager(true, 'test-chat-id'),
            makeStubSecretManager('test-token'),
            channel,
        );
        strictEqual(response.markdownCalls.length, 1);
        strictEqual(response.markdownCalls[0], PARTICIPANT_RESPONSE_LABEL);
        strictEqual(notifier.calls.length, 1);
        strictEqual(channel.lines.length, 1);
        strictEqual(channel.lines[0], 'boom');
    });
});
