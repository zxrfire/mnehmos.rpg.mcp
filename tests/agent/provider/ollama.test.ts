import { OllamaProvider, DEFAULT_BASE_URL } from '../../../src/agent/provider/ollama.js';
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

function throwingFetch(err: unknown): typeof fetch {
    return async () => { throw err; };
}

function chatReply(content: string, extra: Record<string, unknown> = {}): string {
    return JSON.stringify({
        model: 'llama3.1',
        created_at: '2026-01-01T00:00:00Z',
        message: { role: 'assistant', content },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 42,
        eval_count: 17,
        ...extra
    });
}

describe('OllamaProvider', () => {
    it('returns parsed assistant text', async () => {
        const mock = mockFetch({ body: chatReply('The disciple kneels.') });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        const result = await provider.call({
            model: 'llama3.1',
            messages: [{ role: 'user', content: 'Greet the elder.' }]
        });

        expect(result.text).toBe('The disciple kneels.');
        expect(result.finishReason).toBe('stop');
        expect(result.raw).toContain('The disciple kneels.');
    });

    it('posts to /api/chat on the default local base URL with stream:false', async () => {
        const mock = mockFetch({ body: chatReply('x') });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        await provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] });

        expect(mock.lastRequest.url).toBe(`${DEFAULT_BASE_URL}/api/chat`);
        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.stream).toBe(false);
        expect(body.model).toBe('llama3.1');
    });

    it('requires no API key and sends no auth header', async () => {
        const mock = mockFetch({ body: chatReply('x') });
        // Constructing with zero config must work — that is the whole point of
        // the local provider.
        const provider = new OllamaProvider({ fetchImpl: mock.fn });
        await provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] });

        const headers = mock.lastRequest.init?.headers as Record<string, string>;
        expect(headers['Authorization']).toBeUndefined();
        expect(headers['x-api-key']).toBeUndefined();
        expect(headers['Content-Type']).toBe('application/json');
    });

    it('honors an overridden base URL and trims a trailing slash', async () => {
        const mock = mockFetch({ body: chatReply('x') });
        const provider = new OllamaProvider({ baseUrl: 'http://gpu-box:11434/', fetchImpl: mock.fn });

        await provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] });
        expect(mock.lastRequest.url).toBe('http://gpu-box:11434/api/chat');
    });

    it('passes system messages through unchanged (native role)', async () => {
        const mock = mockFetch({ body: chatReply('x') });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        await provider.call({
            model: 'llama3.1',
            messages: [
                { role: 'system', content: 'You are Elder Yun.' },
                { role: 'user', content: 'Who are you?' }
            ]
        });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.messages).toEqual([
            { role: 'system', content: 'You are Elder Yun.' },
            { role: 'user', content: 'Who are you?' }
        ]);
        expect(body.system).toBeUndefined();
    });

    it('maps temperature and maxTokens into options', async () => {
        const mock = mockFetch({ body: chatReply('x') });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        await provider.call({
            model: 'llama3.1',
            messages: [{ role: 'user', content: 'hi' }],
            temperature: 0.4,
            maxTokens: 512
        });

        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.options).toEqual({ temperature: 0.4, num_predict: 512 });
    });

    it('omits options entirely when no generation knobs are set', async () => {
        const mock = mockFetch({ body: chatReply('x') });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        await provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] });
        const body = JSON.parse(mock.lastRequest.init?.body as string);
        expect(body.options).toBeUndefined();
    });

    // ── usage + cost ──────────────────────────────────────────────────────

    it('maps prompt_eval_count/eval_count onto prompt/completion tokens', async () => {
        const mock = mockFetch({ body: chatReply('x') });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        const result = await provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] });
        expect(result.promptTokens).toBe(42);
        expect(result.completionTokens).toBe(17);
        expect(result.totalTokens).toBe(59);
    });

    it('reports zero cost as provider-authoritative — local inference is free', async () => {
        const mock = mockFetch({ body: chatReply('x') });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        const result = await provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] });
        expect(result.costUsd).toBe(0);
        expect(result.costSource).toBe('provider');
    });

    it('leaves totals undefined when the server omits counts', async () => {
        const mock = mockFetch({
            body: JSON.stringify({ message: { role: 'assistant', content: 'x' }, done: true, done_reason: 'stop' })
        });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        const result = await provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] });
        expect(result.promptTokens).toBeUndefined();
        expect(result.completionTokens).toBeUndefined();
        expect(result.totalTokens).toBeUndefined();
    });

    it('passes done_reason through as finishReason', async () => {
        const mock = mockFetch({ body: chatReply('partial', { done_reason: 'length' }) });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        const result = await provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] });
        expect(result.finishReason).toBe('length');
    });

    // ── error classification ──────────────────────────────────────────────

    it('gives actionable guidance when the server is unreachable', async () => {
        const provider = new OllamaProvider({
            fetchImpl: throwingFetch(Object.assign(new TypeError('fetch failed'), {
                cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), { code: 'ECONNREFUSED' })
            }))
        });

        try {
            await provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] });
            throw new Error('should have thrown');
        } catch (err) {
            const providerErr = err as ProviderError;
            expect(providerErr.kind).toBe('network');
            expect(providerErr.message).toMatch(/ollama serve/);
            expect(providerErr.message).toMatch(/OLLAMA_BASE_URL/);
            expect(providerErr.message).toContain(DEFAULT_BASE_URL);
        }
    });

    it('tells the operator to pull a model that is not installed', async () => {
        const mock = mockFetch({
            status: 404,
            body: JSON.stringify({ error: 'model "qwen3" not found, try pulling it first' })
        });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        try {
            await provider.call({ model: 'qwen3', messages: [{ role: 'user', content: 'hi' }] });
            throw new Error('should have thrown');
        } catch (err) {
            expect((err as ProviderError).message).toMatch(/ollama pull qwen3/);
            expect((err as ProviderError).status).toBe(404);
        }
    });

    it('classifies an aborted request as timeout', async () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';
        const provider = new OllamaProvider({ fetchImpl: throwingFetch(abortError) });

        await expect(provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'timeout' });
    });

    it('classifies 5xx as server', async () => {
        const mock = mockFetch({ status: 500, body: 'internal error' });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        await expect(provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'server', status: 500 });
    });

    it('classifies 401 as auth (proxied deployments)', async () => {
        const mock = mockFetch({ status: 401, body: 'unauthorized' });
        const provider = new OllamaProvider({ baseUrl: 'https://ollama.internal', fetchImpl: mock.fn });

        await expect(provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'auth', status: 401 });
    });

    it('classifies 429 as rate_limited', async () => {
        const mock = mockFetch({ status: 429, body: 'busy' });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        await expect(provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'rate_limited', status: 429 });
    });

    it('classifies a non-JSON 200 body as malformed', async () => {
        const mock = mockFetch({ body: 'not json at all' });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        await expect(provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'malformed' });
    });

    it('treats a 200 body carrying an error field as a server error', async () => {
        const mock = mockFetch({ body: JSON.stringify({ error: 'failed to load model into memory' }) });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        await expect(provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toMatchObject({ kind: 'server' });
    });

    it('explains an empty reply truncated by the completion budget', async () => {
        const mock = mockFetch({ body: chatReply('', { done_reason: 'length' }) });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        await expect(provider.call({
            model: 'llama3.1',
            messages: [{ role: 'user', content: 'hi' }],
            maxTokens: 128
        })).rejects.toThrow(/done_reason="length"[\s\S]*Raise agent\.maxTokens/);
    });

    it('reports an otherwise empty reply as malformed', async () => {
        const mock = mockFetch({ body: chatReply('') });
        const provider = new OllamaProvider({ fetchImpl: mock.fn });

        await expect(provider.call({ model: 'llama3.1', messages: [{ role: 'user', content: 'hi' }] }))
            .rejects.toThrow(/empty message content/);
    });
});
