import * as vscode from 'vscode';
import {
    createNotifier,
    buildPayload,
    formatMessage,
    NotificationPayload,
    NotificationTaskMetadata,
} from '../../src/notifier';
import { ConfigManager } from '../../src/configManager';
import {
    COMPLETION_LABEL,
    SUPPRESSED_OUTCOME_SUCCESS,
    SUPPRESSED_OUTCOME_FAILURE,
    SUPPRESSED_COOLDOWN,
    OUTCOME_COMPLETED,
    OUTCOME_CANCELLED,
} from '../../src/constants';

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

/** Returns a ConfigManager stub with permissive defaults (no filtering, no cooldown). */
function makeDefaultConfigStub(): ConfigManager {
    return {
        getChatId: () => '',
        getEnabled: () => true,
        setChatId: async (_v: string): Promise<void> => {},
        setEnabled: async (_v: boolean): Promise<void> => {},
        getNotifyOnSuccess: () => true,
        getNotifyOnFailure: () => true,
        getCooldownSeconds: () => 0,
        getMessageFormat: (): 'default' | 'minimal' => 'default',
    };
}

/** Returns a minimal NotificationTaskMetadata stub. */
function makeDefaultMetadata(): NotificationTaskMetadata {
    return { durationSeconds: 0, outcome: 'completed' };
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
        const notifier = createNotifier(channel, makeDefaultConfigStub());

        const result = await notifier.sendNotification('tok', 'chatid', makeDefaultMetadata());

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
        const notifier = createNotifier(channel, makeDefaultConfigStub());

        const result = await notifier.sendNotification('tok', 'chatid', makeDefaultMetadata());

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
        const notifier = createNotifier(channel, makeDefaultConfigStub());

        const result = await notifier.sendNotification('tok', 'chatid', makeDefaultMetadata());

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
        const notifier = createNotifier(channel, makeDefaultConfigStub());

        const result = await notifier.sendNotification('tok', 'chatid', makeDefaultMetadata());

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
            const payload = buildPayload(makeDefaultMetadata());
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

        const message = formatMessage(payload, 'default');
        const hasWorkspaceLine = message.split('\n').some((l) => l.startsWith('Workspace:'));

        strictEqual(hasWorkspaceLine, false, 'message must not contain a "Workspace:" line');
        ok(message.includes(COMPLETION_LABEL), 'message must still contain the completion label');
    });

    // ── Case 7: no parse_mode in request body ─────────────────────────────

    test('does not include parse_mode in the serialised fetch request body', async () => {
        const state = capturingFetchStub();
        const channel = makeSpyChannel();
        const notifier = createNotifier(channel, makeDefaultConfigStub());

        await notifier.sendNotification('tok', 'chatid', makeDefaultMetadata());

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
        const notifier = createNotifier(channel, makeDefaultConfigStub());

        await notifier.sendNotification(token, chatId, makeDefaultMetadata());

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

    // ── T007-1: buildPayload populates durationSeconds and outcome ────────────

    test('buildPayload returns durationSeconds and outcome from metadata', () => {
        const metadata: NotificationTaskMetadata = { durationSeconds: 42, outcome: 'cancelled' };
        const payload = buildPayload(metadata);
        strictEqual(payload.durationSeconds, 42);
        strictEqual(payload.outcome, 'cancelled');
    });

    // ── T007-2: formatMessage 'default' with defined workspaceName ────────────

    test("formatMessage default format includes workspace name, Duration, Outcome, and timestamp", () => {
        const payload: NotificationPayload = {
            label: COMPLETION_LABEL,
            workspaceName: 'my-project',
            timestamp: '2025-01-01T12:00:00.000Z',
            durationSeconds: 3,
            outcome: 'completed',
        };

        const message = formatMessage(payload, 'default');

        ok(message.includes('my-project'), 'message must contain workspace name');
        ok(message.includes('Duration:'), 'message must contain Duration:');
        ok(message.includes('Outcome:'), 'message must contain Outcome:');
        ok(message.includes('2025-01-01T12:00:00.000Z'), 'message must contain the ISO timestamp');
    });

    // ── T007-3: formatMessage 'default' with workspaceName undefined ──────────

    test("formatMessage default format with workspaceName undefined omits workspace line", () => {
        const payload: NotificationPayload = {
            label: COMPLETION_LABEL,
            workspaceName: undefined,
            timestamp: '2025-01-01T12:00:00.000Z',
            durationSeconds: 5,
            outcome: 'completed',
        };

        const message = formatMessage(payload, 'default');
        const hasWorkspaceLine = message.split('\n').some((l) => l.startsWith('Workspace:'));

        strictEqual(hasWorkspaceLine, false, 'message must not contain a "Workspace:" line');
        ok(message.includes(COMPLETION_LABEL), 'message must still contain the completion label');
        ok(message.includes('Duration:'), 'message must still contain Duration:');
    });

    // ── T007-4: formatMessage 'minimal' omits Duration and Outcome ────────────

    test("formatMessage minimal format contains label and timestamp only — no Duration or Outcome", () => {
        const payload: NotificationPayload = {
            label: COMPLETION_LABEL,
            workspaceName: 'my-project',
            timestamp: '2025-01-01T12:00:00.000Z',
            durationSeconds: 10,
            outcome: 'completed',
        };

        const message = formatMessage(payload, 'minimal');

        ok(message.includes(COMPLETION_LABEL), 'message must contain label');
        ok(message.includes('2025-01-01T12:00:00.000Z'), 'message must contain timestamp');
        ok(!message.includes('Duration'), 'message must NOT contain Duration');
        ok(!message.includes('Outcome'), 'message must NOT contain Outcome');
    });

    // ── T008-1: notifyOnSuccess false suppresses completed turns ──────────────

    test('sendNotification suppresses completed outcome when notifyOnSuccess is false', async () => {
        const channel = makeSpyChannel();
        const config: ConfigManager = {
            ...makeDefaultConfigStub(),
            getNotifyOnSuccess: () => false,
        };
        const notifier = createNotifier(channel, config);

        const result = await notifier.sendNotification('tok', 'chatid', { durationSeconds: 1, outcome: OUTCOME_COMPLETED });

        deepEqual(result, { success: true });
        strictEqual(channel.lines[0], SUPPRESSED_OUTCOME_SUCCESS);
    });

    // ── T008-2: notifyOnFailure false suppresses cancelled turns ──────────────

    test('sendNotification suppresses cancelled outcome when notifyOnFailure is false', async () => {
        const channel = makeSpyChannel();
        const config: ConfigManager = {
            ...makeDefaultConfigStub(),
            getNotifyOnFailure: () => false,
        };
        const notifier = createNotifier(channel, config);

        const result = await notifier.sendNotification('tok', 'chatid', { durationSeconds: 1, outcome: OUTCOME_CANCELLED });

        deepEqual(result, { success: true });
        strictEqual(channel.lines[0], SUPPRESSED_OUTCOME_FAILURE);
    });

    // ── T008-3: sendTestNotification bypasses both outcome filters ────────────

    test('sendTestNotification dispatches fetch even when both notifyOnSuccess and notifyOnFailure are false', async () => {
        let fetchCalled = false;
        setGlobalFetch(async (_input, _init) => {
            fetchCalled = true;
            return { ok: true as const, status: 200, json: async () => ({}) };
        });
        const channel = makeSpyChannel();
        const config: ConfigManager = {
            ...makeDefaultConfigStub(),
            getNotifyOnSuccess: () => false,
            getNotifyOnFailure: () => false,
        };
        const notifier = createNotifier(channel, config);

        const result = await notifier.sendTestNotification('tok', 'chatid');

        deepEqual(result, { success: true });
        ok(fetchCalled, 'fetch must have been called — sendTestNotification bypasses outcome filters');
    });

    // ── T009-1: cooldown suppression within same instance ─────────────────────

    test('sendNotification suppresses second call on same instance within cooldown window', async () => {
        stubFetchResponse({ ok: true, status: 200, json: async () => ({}) });
        const channel = makeSpyChannel();
        const config: ConfigManager = {
            ...makeDefaultConfigStub(),
            getCooldownSeconds: () => 60,
        };
        const notifier = createNotifier(channel, config);

        // First call succeeds and advances lastDispatchedAt
        const first = await notifier.sendNotification('tok', 'chatid', makeDefaultMetadata());
        deepEqual(first, { success: true });

        // Second call within cooldown window must be suppressed
        const second = await notifier.sendNotification('tok', 'chatid', makeDefaultMetadata());
        deepEqual(second, { success: true });
        ok(
            channel.lines.some((l) => l.includes(SUPPRESSED_COOLDOWN)),
            `output must contain SUPPRESSED_COOLDOWN — lines: ${JSON.stringify(channel.lines)}`,
        );
    });

    // ── T009-2: fresh notifier instance has no prior dispatch state ───────────

    test('fresh notifier instance with cooldownSeconds set dispatches on first call without suppression', async () => {
        let fetchCalled = false;
        setGlobalFetch(async (_input, _init) => {
            fetchCalled = true;
            return { ok: true as const, status: 200, json: async () => ({}) };
        });
        const channel = makeSpyChannel();
        const config: ConfigManager = {
            ...makeDefaultConfigStub(),
            getCooldownSeconds: () => 60,
        };
        const notifier = createNotifier(channel, config);

        const result = await notifier.sendNotification('tok', 'chatid', makeDefaultMetadata());

        deepEqual(result, { success: true });
        ok(fetchCalled, 'fetch must be called — no prior dispatch state on fresh instance');
        ok(
            !channel.lines.some((l) => l.includes(SUPPRESSED_COOLDOWN)),
            'first call on fresh instance must not be suppressed by cooldown',
        );
    });

    // ── T009-3: failed dispatch does not advance cooldown timer ───────────────

    test('failed dispatch does not advance cooldown timer — subsequent call is not suppressed', async () => {
        stubFetchResponse({
            ok: false,
            status: 400,
            json: async () => ({ description: 'Bad Request' }),
        });
        const channel = makeSpyChannel();
        const config: ConfigManager = {
            ...makeDefaultConfigStub(),
            getCooldownSeconds: () => 60,
        };
        const notifier = createNotifier(channel, config);

        // First call fails — timer must NOT be advanced
        const first = await notifier.sendNotification('tok', 'chatid', makeDefaultMetadata());
        deepEqual(first, { success: false, errorMessage: 'Telegram error 400: Bad Request' });

        // Replace fetch stub so the second call succeeds
        let secondFetchCalled = false;
        setGlobalFetch(async (_input, _init) => {
            secondFetchCalled = true;
            return { ok: true as const, status: 200, json: async () => ({}) };
        });

        // Second call must reach fetch — cooldown was never armed by the failed first call
        const second = await notifier.sendNotification('tok', 'chatid', makeDefaultMetadata());
        deepEqual(second, { success: true });
        ok(secondFetchCalled, 'fetch must be called on second attempt — failed dispatch does not start cooldown');
        ok(
            !channel.lines.some((l) => l.includes(SUPPRESSED_COOLDOWN)),
            'second call must not be suppressed — failed dispatch does not arm cooldown timer',
        );
    });
});
