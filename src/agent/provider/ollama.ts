/**
 * Ollama provider - the local / self-hosted runtime agent. POST /api/chat with
 * `stream: false`, so one JSON body arrives and the replay-capture contract holds.
 *
 * Two structural differences from the hosted providers, both absorbed here. NO
 * API KEY: availability is "is it enabled and is the server up", so
 * ProviderFactory constructs it whenever it is configured. NO COST: costUsd is a
 * hard 0 reported as provider-authoritative rather than an estimate.
 *
 * System messages are a native role here, so the message list passes straight
 * through - unlike Anthropic, which needs system hoisting.
 */

import {
    LLMProvider,
    ProviderCallOpts,
    ProviderCallResult,
    ProviderError,
    classifyFetchError,
    classifyHttpStatus
} from './types.js';
import { PROVIDER_DEFAULT_MODEL } from './config.js';

/** A positive integer from an environment variable, or nothing. */
function numberFromEnv(raw: string | undefined): number | undefined {
    if (raw === undefined) return undefined;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : undefined;
}

export const DEFAULT_BASE_URL = 'http://localhost:11434';


export interface OllamaProviderConfig {
    /** Base URL of the Ollama server. Defaults to http://localhost:11434. */
    baseUrl?: string;
    /**
     * Tokens of context to ask the server for. ABSENT BY DEFAULT: Ollama holds a
     * model in VRAM at ONE window, so a request asking for a different one makes
     * it unload and reload, and a game sending 32768 to a tag another tool uses at
     * the default makes both reload on every alternation. An operator who wants a
     * sized window uses a model file of their own (`config/ollama/`), or
     * `OLLAMA_NUM_CTX` for the per-request override.
     */
    contextWindow?: number;
    /** Model used when a call omits one. */
    defaultModel?: string;
    /**
     * Whether the model should reason before answering. DEFAULTS TO FALSE: a
     * thinking-tuned model reasons whether or not anybody asked, out of the same
     * budget as the answer. Measured on gemma4:26b, asked for one sentence about a
     * mountain: 722 characters of reasoning to produce 37 of answer. On a real
     * narration prompt the whole budget went to reasoning, content came back
     * EMPTY, and every narration fell through to the deterministic account
     * silently while the game reported itself as model-narrated.
     *
     * The flag cannot be sent to everything - Ollama rejects `think` outright on a
     * model not tuned for it - so a refusal is remembered and the call retried
     * without it, which needs no capability list to maintain.
     */
    think?: boolean;
    /** Allow tests to inject a custom fetch implementation. */
    fetchImpl?: typeof fetch;
}

interface OllamaChatResponse {
    message?: { role?: string; content?: string };
    done?: boolean;
    done_reason?: string;
    /** Tokens the server evaluated for the prompt. */
    prompt_eval_count?: number;
    /** Tokens the server generated. */
    eval_count?: number;
    error?: string;
}

/**
 * Ollama reports "model not pulled" as a 404 with a plain-string `error` field.
 * Detect it so the operator gets `ollama pull <model>` instead of a bare 404.
 */
function isModelMissing(status: number, body: string): boolean {
    return status === 404 && /not found|no such model|try pulling/i.test(body);
}

/**
 * "This model does not take a `think` flag" - a 400 whose error names thinking.
 * Deliberately loose about the rest of the wording, because the phrasing has
 * changed across versions; anything not about `think` is a real failure and must
 * be reported rather than retried into.
 */
function isThinkUnsupported(status: number, body: string): boolean {
    return status === 400 && /think|thinking/i.test(body);
}

export class OllamaProvider implements LLMProvider {
    readonly name = 'ollama' as const;
    private readonly baseUrl: string;
    private readonly defaultModel: string;
    private readonly think: boolean;
    private readonly contextWindow: number | undefined;
    private readonly fetchImpl: typeof fetch;
    /**
     * Models that answered "I do not take a `think` flag". Learned rather than
     * listed: a list of thinking-tuned local models would be wrong the week a new
     * one is pulled. One refused call per model per process.
     */
    private readonly refusesThink = new Set<string>();

    constructor(config: OllamaProviderConfig = {}) {
        // No apiKey guard on purpose - a local server needs no credential, and
        // requiring one would make the self-hosted path impossible to configure.
        this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
        this.defaultModel = config.defaultModel ?? PROVIDER_DEFAULT_MODEL.ollama;
        this.think = config.think ?? false;
        this.contextWindow = config.contextWindow ?? numberFromEnv(process.env.OLLAMA_NUM_CTX);
        this.fetchImpl = config.fetchImpl ?? fetch;
    }

    async call(opts: ProviderCallOpts): Promise<ProviderCallResult> {
        const start = Date.now();
        const model = opts.model || this.defaultModel;

        // Generation knobs live under `options`, not at the top level. num_predict
        // is Ollama's name for the completion cap.
        const options: Record<string, unknown> = {};
        // ABSENT UNLESS AN OPERATOR ASKED FOR IT. See `OllamaProviderConfig.contextWindow`.
        if (this.contextWindow !== undefined) options.num_ctx = this.contextWindow;
        if (opts.temperature !== undefined) options.temperature = opts.temperature;
        if (opts.maxTokens !== undefined) options.num_predict = opts.maxTokens;

        const body: Record<string, unknown> = {
            model,
            messages: opts.messages,
            // Non-negotiable: the runtime consumes one complete response and
            // stores the raw body for replay. A streamed body would arrive as
            // newline-delimited JSON fragments and break both.
            stream: false
        };
        if (Object.keys(options).length > 0) body.options = options;

        // reasoningEffort is deliberately NOT mapped: Ollama exposes thinking via
        // a `think` flag that only thinking-tuned models accept, so effort is a
        // no-op here. `think` is sent unless this model has already refused it.
        const sentThink = !this.refusesThink.has(model);
        if (sentThink) body.think = this.think;

        const post = (payload: Record<string, unknown>): Promise<Response> =>
            this.fetchImpl(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: opts.signal
            });

        let response: Response;
        try {
            response = await post(body);
            // Remember the refusal and ask again without it.
            if (!response.ok && sentThink) {
                const refusal = await response.clone().text();
                if (isThinkUnsupported(response.status, refusal)) {
                    this.refusesThink.add(model);
                    delete body.think;
                    response = await post(body);
                }
            }
        } catch (err) {
            const classified = classifyFetchError(err);
            if (classified.kind === 'network') {
                // The single most common failure for a local provider: the server
                // simply isn't running. Say so, and say how to fix it.
                throw new ProviderError(
                    `Cannot reach the Ollama server at ${this.baseUrl}. Start it with 'ollama serve' `
                    + `(or set OLLAMA_BASE_URL if it runs elsewhere). Underlying error: ${classified.message}`,
                    'network'
                );
            }
            throw classified;
        }

        const rawText = await response.text();
        const durationMs = Date.now() - start;

        if (!response.ok) {
            if (isModelMissing(response.status, rawText)) {
                throw new ProviderError(
                    `Ollama has no model '${model}' pulled. Run 'ollama pull ${model}' on the host `
                    + `at ${this.baseUrl}, or set OLLAMA_MODEL to a model that is already installed.`,
                    'unknown', response.status, rawText
                );
            }
            throw classifyHttpStatus(response.status, rawText);
        }

        let parsed: OllamaChatResponse;
        try {
            parsed = JSON.parse(rawText);
        } catch (err) {
            throw new ProviderError(`Malformed JSON response: ${(err as Error).message}`, 'malformed', response.status, rawText);
        }

        // Ollama can answer 200 with an `error` string (e.g. a model that failed
        // to load after the request was accepted).
        if (parsed.error) {
            if (isModelMissing(404, parsed.error)) {
                throw new ProviderError(
                    `Ollama has no model '${model}' pulled. Run 'ollama pull ${model}' on the host `
                    + `at ${this.baseUrl}, or set OLLAMA_MODEL to a model that is already installed.`,
                    'unknown', response.status, rawText
                );
            }
            throw new ProviderError(parsed.error, 'server', response.status, rawText);
        }

        const text = parsed.message?.content ?? '';
        if (!text) {
            if (parsed.done_reason === 'length') {
                throw new ProviderError(
                    `Provider returned empty content with done_reason="length": the completion budget `
                    + `(${opts.maxTokens ?? 'server default'}) was exhausted before any text was produced. Raise agent.maxTokens.`,
                    'malformed', response.status, rawText
                );
            }
            throw new ProviderError('Provider returned empty message content', 'malformed', response.status, rawText);
        }

        const promptTokens = parsed.prompt_eval_count;
        const completionTokens = parsed.eval_count;

        return {
            text,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens !== undefined && completionTokens !== undefined
                ? promptTokens + completionTokens
                : undefined,
            // Local inference is free and we know it - this is a fact, not an estimate.
            costUsd: 0,
            costSource: 'provider',
            raw: rawText,
            durationMs,
            finishReason: parsed.done_reason
        };
    }
}
