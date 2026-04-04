import * as assert from 'assert';
import * as vscode from 'vscode';
import { runSetupWizard } from '../../src/participant';
import { WIZARD_ERROR_TOKEN_EMPTY, WIZARD_ERROR_CHAT_ID_EMPTY } from '../../src/constants';
import { SecretManager } from '../../src/secretManager';
import { ConfigManager } from '../../src/configManager';

// ---- Stub factories ----

interface TrackedConfigManager extends ConfigManager {
    readonly setChatIdCalls: string[];
    readonly currentChatId: string;
}

function makeConfigManager(initialChatId = ''): TrackedConfigManager {
    let chatId = initialChatId;
    const setChatIdCalls: string[] = [];
    return {
        get setChatIdCalls(): string[] { return setChatIdCalls; },
        get currentChatId(): string { return chatId; },
        getChatId(): string { return chatId; },
        getEnabled(): boolean { return true; },
        async setChatId(v: string): Promise<void> {
            setChatIdCalls.push(v);
            chatId = v;
        },
        async setEnabled(_v: boolean): Promise<void> { /* noop */ },
        getNotifyOnSuccess(): boolean { return true; },
        getNotifyOnFailure(): boolean { return true; },
        getCooldownSeconds(): number { return 0; },
        getMessageFormat(): 'default' | 'minimal' { return 'default'; },
    };
}

interface TrackedSecretManager extends SecretManager {
    readonly storeTokenCalls: string[];
}

function makeSecretManager(opts?: { storeThrows?: boolean }): TrackedSecretManager {
    const storeTokenCalls: string[] = [];
    return {
        get storeTokenCalls(): string[] { return storeTokenCalls; },
        async getToken(): Promise<string | undefined> { return undefined; },
        async storeToken(token: string): Promise<void> {
            storeTokenCalls.push(token);
            if (opts?.storeThrows) {
                throw new Error('storeToken failed');
            }
        },
    };
}

// ---- Suite ----

suite('runSetupWizard', () => {
    let inputBoxQueue: Array<string | undefined>;
    let capturedCalls: Array<{ options: vscode.InputBoxOptions }>;
    let originalShowInputBox: typeof vscode.window.showInputBox;

    setup(() => {
        inputBoxQueue = [];
        capturedCalls = [];
        originalShowInputBox = vscode.window.showInputBox;
        (vscode.window as { showInputBox: unknown }).showInputBox = (
            options: vscode.InputBoxOptions,
        ): Promise<string | undefined> => {
            capturedCalls.push({ options });
            return Promise.resolve(inputBoxQueue.shift());
        };
    });

    teardown(() => {
        (vscode.window as { showInputBox: unknown }).showInputBox = originalShowInputBox;
    });

    test('happy path – both valid inputs → setChatId and storeToken called, returns completed', async () => {
        inputBoxQueue = ['bot-token-123', 'chat-id-456'];
        const secrets = makeSecretManager();
        const config = makeConfigManager();

        const result = await runSetupWizard(secrets, config);

        assert.strictEqual(result, 'completed');
        assert.deepStrictEqual(secrets.storeTokenCalls, ['bot-token-123']);
        assert.ok(
            config.setChatIdCalls.includes('chat-id-456'),
            'setChatId should have been called with the entered chatId',
        );
    });

    test('cancel at token box – no writes, returns cancelled', async () => {
        inputBoxQueue = [undefined];
        const secrets = makeSecretManager();
        const config = makeConfigManager();

        const result = await runSetupWizard(secrets, config);

        assert.strictEqual(result, 'cancelled');
        assert.strictEqual(secrets.storeTokenCalls.length, 0, 'storeToken must not be called');
        assert.strictEqual(config.setChatIdCalls.length, 0, 'setChatId must not be called');
    });

    test('cancel at chatId box – token not yet written, returns cancelled', async () => {
        inputBoxQueue = ['valid-token', undefined];
        const secrets = makeSecretManager();
        const config = makeConfigManager();

        const result = await runSetupWizard(secrets, config);

        assert.strictEqual(result, 'cancelled');
        assert.strictEqual(secrets.storeTokenCalls.length, 0, 'storeToken must not be called');
        assert.strictEqual(config.setChatIdCalls.length, 0, 'setChatId must not be called');
    });

    test('token validateInput returns error for empty string', async () => {
        // Cancel immediately so the wizard aborts; we only need to capture the options.
        inputBoxQueue = [undefined];
        const secrets = makeSecretManager();
        const config = makeConfigManager();

        await runSetupWizard(secrets, config);

        assert.strictEqual(capturedCalls.length, 1);
        const validateInput = capturedCalls[0].options.validateInput;
        assert.ok(validateInput, 'validateInput must be provided');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        assert.strictEqual(
            validateInput!('') as string | undefined,
            WIZARD_ERROR_TOKEN_EMPTY,
        );
    });

    test('token validateInput returns error for whitespace-only; returns undefined for valid value', async () => {
        inputBoxQueue = [undefined];
        const secrets = makeSecretManager();
        const config = makeConfigManager();

        await runSetupWizard(secrets, config);

        const validateInput = capturedCalls[0].options.validateInput;
        assert.ok(validateInput, 'validateInput must be provided');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        assert.strictEqual(
            validateInput!('   ') as string | undefined,
            WIZARD_ERROR_TOKEN_EMPTY,
            'whitespace-only token must fail validation',
        );
        assert.strictEqual(
            validateInput!('valid-token') as string | undefined,
            undefined,
            'valid token must pass validation',
        );
    });

    test('chatId validateInput returns error for whitespace-only; returns undefined for valid value', async () => {
        // Provide a valid token so the wizard reaches the chatId InputBox, then cancel.
        inputBoxQueue = ['valid-token', undefined];
        const secrets = makeSecretManager();
        const config = makeConfigManager();

        await runSetupWizard(secrets, config);

        assert.strictEqual(capturedCalls.length, 2, 'wizard must have shown two InputBoxes');
        const validateInput = capturedCalls[1].options.validateInput;
        assert.ok(validateInput, 'chatId validateInput must be provided');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        assert.strictEqual(
            validateInput!('   ') as string | undefined,
            WIZARD_ERROR_CHAT_ID_EMPTY,
            'whitespace-only chatId must fail validation',
        );
        assert.strictEqual(
            validateInput!('123456') as string | undefined,
            undefined,
            'valid chatId must pass validation',
        );
    });

    test('storeToken failure triggers chatId rollback and error propagates', async () => {
        inputBoxQueue = ['bot-token-abc', 'new-chat-id'];
        const secrets = makeSecretManager({ storeThrows: true });
        const config = makeConfigManager('old-chat-id');

        await assert.rejects(
            () => runSetupWizard(secrets, config),
            /storeToken failed/,
            'error thrown by storeToken must propagate out of runSetupWizard',
        );

        // setChatId('new-chat-id') was called first, then setChatId('old-chat-id') for rollback.
        assert.deepStrictEqual(
            config.setChatIdCalls,
            ['new-chat-id', 'old-chat-id'],
            'chatId must be rolled back to the pre-wizard value after storeToken failure',
        );
    });
});
