import * as vscode from 'vscode';
import {
    createNotifier,
    buildPayload,
    formatMessage,
    NotificationPayload,
} from '../../src/notifier';
import { COMPLETION_LABEL } from '../../src/constants';

// Inline assertion helpers — avoids @types/node dependency in test files
function ok(value: unknown, msg?: string): void {
    if (!value) { throw new Error(msg ?? `Expected truthy value, got: ${String(value)}`); }
}

function strictEqual(actual: unknown, expected: unknown, msg?: string): void {
    if (actual !== expected) {
        throw new Error(msg ?? `Expected ${String(expected)}, got ${String(actual)}`);
    }
}

function deepEqual(actual: unknown, expected: unknown, msg?: string): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) { throw new Error(msg ?? `Expected ${b}, got ${a}`); }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SpyChannel = vscode.OutputChannel & { readonly lines: string[] };

function makeSpyChannel(): SpyChannel {
    const lines: string[] = [];
    const channel = {
        lines,
        name: 'TestChannel',
        append: (_v: string): void => undefined,
        appendLine: (v: string): void => { lines.push(v); },
        replace: (_v: string): void => undefined,
        clear: (): void => undefined,
        // satisfies both show() overloads by accepting any args
        show: (..._args: unknown[]): void => undefined,
        hide: (): void => undefined,
        dispose: (): void => undefined,
    };
    return channel as unknown as SpyChannel;
}

type MockResponse = {
    readonly ok: boolean;
    readonly status: number;
    json(): Promise<unknown>;
};

type FetchLike = (input: string, init?: unknown) => Promise<MockResponse>;

function setGlobalFetch(impl: FetchLike): void {
    (globalThis as unknown as Record<string, unknown>)['fetch'] = impl;
}

function clearGlobalFetch(): void {
    delete (globalThis as unknown as Record<string, unknown>)['fetch'];
}

function stubFetchResponse(response: MockResponse): void {
    setGlobalFetch(async (_input, _init) => response);
}

function stubFetchReject(error: Error): void {
    setGlobalFetch(async (_input, _init): Promise<MockResponse> => {
        throw error;
    });
}

/** Sets a fetch stub that records the last `init.body` and returns 200 ok. */
function capturingFetchStub(): { captured?: string } {
    const state: { captured?: string } = {};
    setGlobalFetch(async (_input, init) => {
        const initObj = init as { body?: string } | undefined;
        state.captured = initObj?.body;
        return { ok: true as const, status: 200, json: async () => ({}) };
    });
    return state;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

suite('Notifier', () => {

    teardown(() => {
        clearGlobalFetch();
    });

    // ── Case 1: success ────────────────────────────────────────────────────

    test('returns { success: true } when response.ok is true', async () => {
        stubFetchResponse({ ok: true, status: 200, json: async () => ({}) });
        const channel = makeSpyChannel();
        const notifier = createNotifier(channel);

        const result = await notifier.sendNotification('tok', 'chatid');

        deepEqual(result, { success: true });
    });

    // ── Case 2: HTTP error with parseable JSON description ─────────────────

    test('returns error message with status + description and logs it on HTTP error with valid JSON', async () => {
        stubFetchResponse({
            ok: false,
            status: 400,
            json: async () => ({ description: 'Bad Request' }),
        });
        const channel = makeSpyChannel();
        const notifier = createNotifier(channel);

        const result = await notifier.sendNotification('tok', 'chatid');

        deepEqual(result, {
            success: false,
            errorMessage: 'Telegram error 400: Bad Request',
        });
        ok(channel.lines.length >= 1, 'outputChannel.appendLine should have been called');
        strictEqual(channel.lines[0], 'Telegram error 400: Bad Request');
    });

    // ── Case 3: rejected fetch ─────────────────────────────────────────────

    test('returns the Error message and logs it when fetch rejects', async () => {
        stubFetchReject(new Error('offline'));
        const channel = makeSpyChannel();
        const notifier = createNotifier(channel);

        const result = await notifier.sendNotification('tok', 'chatid');

        deepEqual(result, { success: false, errorMessage: 'offline' });
        ok(channel.lines.length >= 1, 'outputChannel.appendLine should have been called');
        strictEqual(channel.lines[0], 'offline');
    });

    // ── Case 4: HTTP error + unparseable JSON body ─────────────────────────

    test('returns generic "Telegram error <status>" when the JSON body cannot be parsed', async () => {
        stubFetchResponse({
            ok: false,
            status: 500,
            json: async () => { throw new SyntaxError('Unexpected end of input'); },
        });
        const channel = makeSpyChannel();
        const notifier = createNotifier(channel);

        const result = await notifier.sendNotification('tok', 'chatid');

        deepEqual(result, { success: false, errorMessage: 'Telegram error 500' });
    });

    // ── Case 5: buildPayload — undefined workspaceName ─────────────────────

    test('buildPayload returns workspaceName: undefined when workspaceFolders is undefined', () => {
        const savedDescriptor = Object.getOwnPropertyDescriptor(vscode.workspace, 'workspaceFolders');
        try {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: undefined,
                writable: false,
                configurable: true,
            });
            const payload = buildPayload();
            strictEqual(payload.workspaceName, undefined);
        } finally {
            if (savedDescriptor !== undefined) {
                Object.defineProperty(vscode.workspace, 'workspaceFolders', savedDescriptor);
            }
        }
    });

    // ── Case 6: formatMessage omits workspace line ─────────────────────────

    test('formatMessage does not include a "Workspace:" line when workspaceName is undefined', () => {
        const payload: NotificationPayload = {
            label: COMPLETION_LABEL,
            workspaceName: undefined,
            timestamp: '2024-01-01T00:00:00.000Z',
        };

        const message = formatMessage(payload);
        const hasWorkspaceLine = message.split('\n').some((l) => l.startsWith('Workspace:'));

        strictEqual(hasWorkspaceLine, false, 'message must not contain a "Workspace:" line');
        ok(message.includes(COMPLETION_LABEL), 'message must still contain the completion label');
    });

    // ── Case 7: no parse_mode in request body ─────────────────────────────

    test('does not include parse_mode in the serialised fetch request body', async () => {
        const state = capturingFetchStub();
        const channel = makeSpyChannel();
        const notifier = createNotifier(channel);

        await notifier.sendNotification('tok', 'chatid');

        ok(state.captured !== undefined, 'fetch should have been called with a body');
        const parsed = JSON.parse(state.captured as string) as Record<string, unknown>;
        ok(!('parse_mode' in parsed), 'request body must not include parse_mode');
    });

    // ── Case 8: no token / chatId leakage ─────────────────────────────────

    test('does not log the bot token or chatId in any outputChannel.appendLine call', async () => {
        const token  = 'SECRET_BOT_TOKEN_MUST_NOT_APPEAR_IN_LOGS';
        const chatId = 'SECRET_CHAT_ID_MUST_NOT_APPEAR_IN_LOGS';
        stubFetchResponse({
            ok: false,
            status: 401,
            json: async () => ({ description: 'Unauthorized' }),
        });
        const channel = makeSpyChannel();
        const notifier = createNotifier(channel);

        await notifier.sendNotification(token, chatId);

        for (const line of channel.lines) {
            ok(
                !line.includes(token),
                `output log must not contain the bot token — line: "${line}"`,
            );
            ok(
                !line.includes(chatId),
                `output log must not contain the chatId — line: "${line}"`,
            );
        }
    });
});
