import {
    AnthropicProvider,
    ANTHROPIC_VERSION,
    DEFAULT_MAX_TOKENS,
    splitSystemMessages,
    usesAdaptiveThinking,
    rejectsSamplingParams
} from '../../../src/agent/provider/anthropic.js';
import { ProviderError } from '../../../src/agent/provider/types.js';

function mockFetch(opts: { status?: number; body: string }): {
    fn: typeof fetch;
    lastRequest: { url?: string; init?: RequestInit };
} {
    const captured: { url?: string; init?: RequestInit } = {};
    const fn: typeof fetch = async (input, init) => {
        captured.url = typeof input === 'string' ? input : input.toString();
        captured.init = init;
        return new Response(opts.body, {
            status: opts.status ?? 200,
            headers: { 'Content-Type': 'application/json' }
        });
    };
    return { fn, lastRequest: captured };
}

/** A fetch that rejects, to exercise the network/timeout classification paths. */
function throwingFetch(err: unknown): typeof fetch {
    return async () => { throw err; };
}

function textReply(text: string, extra: Record<string, unknown> = {}): string {
    return JSON.stringify({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
        ...extra
    });
}

describe('AnthropicProvider', () => {
    it('returns parsed assistant text', async () => {
        const mock = mockFetch({ body: textReply('The cultivator bows.') });
        const provider = new AnthropicProvider({ apiKey: 'sk-ant-test', fetchImpl: mock.fn });

        const result = await provider.call({
            model: 'claude-opus-5',
            messages: [{ role: 'user', content: 'Greet the elder.' }]
        });

        expect(result.text).toBe('The cultivator bows.');
        expect(result.promptTokens).toBe(10);
        expect(result.completionTokens).toBe(5);
        expect(result.totalTokens).toBe(15);
        expect(result.raw).toContain('The cultivator bows.');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('posts to /v1/messages with x-api-key and anthropic-version headers', async () => {
        const mock = mockFetch({ body: textReply('x') });
        const provider = new AnthropicProvider({ apiKey: 'sk-ant-test', fetchImpl: mock.fn });

        await provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] });

        expect(mock.lastRequest.url).toBe('https://api.anthropic.com/v1/messages');
        const headers = mock.lastRequest.init?.headers as Record<string, string>;
        expect(headers['x-api-key']).toBe('sk-ant-test');
        expect(headers['anthropic-version']).toBe(ANTHROPIC_VERSION);
        // Anthropic does NOT use bearer auth — a stray Authorization header
        // would silently shadow the key on some gateways.
        expect(headers['Authorization']).toBeUndefined();
    });

    // ── system hoisting ───────────────────────────────────────────────────

    it('hoists a system message to the top-level system parameter', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await provider.call({
            model: 'claude-opus-5',
            messages: [
                { role: 'system', content: 'You are Elder Yun.' },
                { role: 'user', content: 'Who are you?' }
            ]
        });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.system).toBe('You are Elder Yun.');
        expect(body.messages).toEqual([{ role: 'user', content: 'Who are you?' }]);
        expect(body.messages.some((m: { role: string }) => m.role === 'system')).toBe(false);
    });

    it('merges multiple system messages in order', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await provider.call({
            model: 'claude-opus-5',
            messages: [
                { role: 'system', content: 'Persona slice.' },
                { role: 'system', content: 'Directive slice.' },
                { role: 'user', content: 'Act.' }
            ]
        });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.system).toBe('Persona slice.\n\nDirective slice.');
    });

    it('splitSystemMessages preserves non-system order', () => {
        const { system, chat } = splitSystemMessages([
            { role: 'user', content: 'a' },
            { role: 'system', content: 's' },
            { role: 'assistant', content: 'b' },
            { role: 'user', content: 'c' }
        ]);
        expect(system).toBe('s');
        expect(chat).toEqual([
            { role: 'user', content: 'a' },
            { role: 'assistant', content: 'b' },
            { role: 'user', content: 'c' }
        ]);
    });

    it('rejects a prompt made entirely of system content', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await expect(provider.call({
            model: 'claude-opus-5',
            messages: [{ role: 'system', content: 'only system' }]
        })).rejects.toThrow(/at least one user\/assistant message/);
    });

    // ── required max_tokens ───────────────────────────────────────────────

    it('always sends max_tokens, defaulting when the caller omits it', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.max_tokens).toBe(DEFAULT_MAX_TOKENS);
    });

    it('passes an explicit maxTokens through as max_tokens', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }], maxTokens: 640 });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.max_tokens).toBe(640);
    });

    // ── multi-block content ───────────────────────────────────────────────

    it('concatenates multiple text blocks and ignores thinking blocks', async () => {
        const mock = mockFetch({
            body: JSON.stringify({
                content: [
                    { type: 'thinking', thinking: 'hidden reasoning' },
                    { type: 'text', text: 'First part. ' },
                    { type: 'text', text: 'Second part.' }
                ],
                stop_reason: 'end_turn',
                usage: { input_tokens: 3, output_tokens: 9 }
            })
        });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        const result = await provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] });
        expect(result.text).toBe('First part. Second part.');
    });

    // ── usage + finish reason mapping ─────────────────────────────────────

    it('maps input_tokens/output_tokens and reports thinking tokens as reasoningTokens', async () => {
        const mock = mockFetch({
            body: JSON.stringify({
                content: [{ type: 'text', text: 'ok' }],
                stop_reason: 'end_turn',
                usage: { input_tokens: 120, output_tokens: 40, thinking_tokens: 25 }
            })
        });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        const result = await provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] });
        expect(result.promptTokens).toBe(120);
        expect(result.completionTokens).toBe(40);
        expect(result.totalTokens).toBe(160);
        expect(result.reasoningTokens).toBe(25);
    });

    it('maps stop_reason onto the shared finishReason vocabulary', async () => {
        const endTurn = mockFetch({ body: textReply('a') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: endTurn.fn });
        expect((await provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] })).finishReason)
            .toBe('stop');

        const truncated = mockFetch({
            body: JSON.stringify({
                content: [{ type: 'text', text: 'partial' }],
                stop_reason: 'max_tokens',
                usage: { input_tokens: 1, output_tokens: 1 }
            })
        });
        const truncatedProvider = new AnthropicProvider({ apiKey: 'k', fetchImpl: truncated.fn });
        expect((await truncatedProvider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] })).finishReason)
            .toBe('length');
    });

    // ── model-family parameter shaping ────────────────────────────────────

    it('suppresses temperature for models that reject sampling parameters', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await provider.call({
            model: 'claude-opus-5',
            messages: [{ role: 'user', content: 'hi' }],
            temperature: 0.7
        });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.temperature).toBeUndefined();
    });

    it('sends temperature for older families that still accept it', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await provider.call({
            model: 'claude-sonnet-4-5',
            messages: [{ role: 'user', content: 'hi' }],
            temperature: 0.7
        });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.temperature).toBe(0.7);
    });

    it('maps reasoningEffort onto adaptive thinking + effort for current models', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await provider.call({
            model: 'claude-opus-5',
            messages: [{ role: 'user', content: 'hi' }],
            maxTokens: 800,
            reasoningEffort: 'high'
        });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.thinking).toEqual({ type: 'adaptive' });
        expect(body.output_config).toEqual({ effort: 'high' });
        expect(body.thinking.budget_tokens).toBeUndefined();
    });

    it('clamps xhigh effort on families that do not support it', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await provider.call({
            model: 'claude-sonnet-4-6',
            messages: [{ role: 'user', content: 'hi' }],
            reasoningEffort: 'xhigh'
        });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.output_config).toEqual({ effort: 'high' });
    });

    it('uses a fixed thinking budget for legacy families with room for it', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await provider.call({
            model: 'claude-sonnet-4-5',
            messages: [{ role: 'user', content: 'hi' }],
            maxTokens: 8000,
            reasoningEffort: 'low'
        });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 4096 });
        expect(body.output_config).toBeUndefined();
    });

    it('omits thinking entirely when the legacy budget cannot fit under max_tokens', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await provider.call({
            model: 'claude-sonnet-4-5',
            messages: [{ role: 'user', content: 'hi' }],
            maxTokens: 800,
            reasoningEffort: 'high'
        });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.thinking).toBeUndefined();
    });

    it('classifies model families correctly', () => {
        expect(usesAdaptiveThinking('claude-opus-5')).toBe(true);
        expect(usesAdaptiveThinking('anthropic/claude-sonnet-4-6')).toBe(true);
        expect(usesAdaptiveThinking('claude-sonnet-4-5')).toBe(false);
        expect(rejectsSamplingParams('claude-opus-5')).toBe(true);
        expect(rejectsSamplingParams('claude-sonnet-4-6')).toBe(false);
    });

    // ── error classification ──────────────────────────────────────────────

    it('classifies 401 as auth', async () => {
        const mock = mockFetch({ status: 401, body: '{"error":{"message":"invalid x-api-key"}}' });
        const provider = new AnthropicProvider({ apiKey: 'bad', fetchImpl: mock.fn });

        await expect(provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'auth', status: 401 });
    });

    it('classifies 429 as rate_limited', async () => {
        const mock = mockFetch({ status: 429, body: 'slow down' });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await expect(provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'rate_limited', status: 429 });
    });

    it('classifies 5xx as server', async () => {
        const mock = mockFetch({ status: 529, body: 'overloaded' });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await expect(provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'server', status: 529 });
    });

    it('classifies a connection failure as network', async () => {
        const provider = new AnthropicProvider({
            apiKey: 'k',
            fetchImpl: throwingFetch(Object.assign(new TypeError('fetch failed'), {
                cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' })
            }))
        });

        await expect(provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'network' });
    });

    it('classifies an aborted request as timeout', async () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: throwingFetch(abortError) });

        await expect(provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'timeout' });
    });

    it('classifies a non-JSON 200 body as malformed', async () => {
        const mock = mockFetch({ body: '<html>gateway</html>' });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await expect(provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'malformed' });
    });

    it('treats a 200 body carrying an error field as a server error', async () => {
        const mock = mockFetch({ body: JSON.stringify({ error: { type: 'overloaded_error', message: 'Overloaded' } }) });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await expect(provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'server' });
    });

    it('explains an empty reply truncated by max_tokens', async () => {
        const mock = mockFetch({
            body: JSON.stringify({ content: [], stop_reason: 'max_tokens', usage: { input_tokens: 5, output_tokens: 800 } })
        });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        await expect(provider.call({
            model: 'claude-opus-5',
            messages: [{ role: 'user', content: 'hi' }],
            maxTokens: 800
        })).rejects.toThrow(/exhausted before any text[\s\S]*Raise agent\.maxTokens/);
    });

    it('reports an empty reply as malformed', async () => {
        const mock = mockFetch({ body: JSON.stringify({ content: [], stop_reason: 'end_turn' }) });
        const provider = new AnthropicProvider({ apiKey: 'k', fetchImpl: mock.fn });

        try {
            await provider.call({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'hi' }] });
            throw new Error('should have thrown');
        } catch (err) {
            expect((err as ProviderError).kind).toBe('malformed');
            expect((err as ProviderError).message).toMatch(/empty message content/);
        }
    });

    it('refuses construction without apiKey', () => {
        expect(() => new AnthropicProvider({ apiKey: '' })).toThrow(/apiKey/);
    });

    it('honors a configured default model when the call omits one', async () => {
        const mock = mockFetch({ body: textReply('ok') });
        const provider = new AnthropicProvider({ apiKey: 'k', defaultModel: 'claude-sonnet-5', fetchImpl: mock.fn });

        await provider.call({ model: '', messages: [{ role: 'user', content: 'hi' }] });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.model).toBe('claude-sonnet-5');
    });
});
