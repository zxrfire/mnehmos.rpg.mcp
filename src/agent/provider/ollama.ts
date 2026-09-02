/**
 * Ollama provider - the local / self-hosted runtime agent.
 *
 * Talks to a locally running Ollama server (default http://localhost:11434) via
 * POST /api/chat with `stream: false`, so the whole reply arrives as one JSON
 * body and the shared error-classification + replay-capture contract holds.
 *
 * Two things make Ollama structurally different from the hosted providers, and
 * both are absorbed here:
 *
 *   1. NO API KEY. Availability is a function of "is it enabled and is the
 *      server up", not "do we hold a secret". ProviderFactory therefore
 *      constructs it whenever it is configured/enabled.
 *   2. NO COST. Local inference is free, so costUsd is a hard 0 reported as
 *      provider-authoritative rather than an estimate. This deployment is
 *      single-user and self-hosted with no paid tiers - a run under Ollama must
 *      never accrue a dollar figure that implies otherwise.
 *
 * Wire-shape mapping: `message.content` -> .text, `prompt_eval_count` /
 * `eval_count` -> prompt/completion tokens, `done_reason` -> finishReason.
 * System messages are a native role here, so the message list passes straight
 * through (unlike Anthropic, which needs system hoisting).
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

export const DEFAULT_BASE_URL = 'http://localhost:11434';

export interface OllamaProviderConfig {
    /** Base URL of the Ollama server. Defaults to http://localhost:11434. */
    baseUrl?: string;
    /** Model used when a call omits one. */
    defaultModel?: string;
    /**
     * Whether the model should reason before answering.
     *
     * Undefined means the flag is not sent at all, which is the only safe
     * default: Ollama rejects `think` outright on a model that was not tuned
     * for it, so a value is passed on only when somebody has said one.
     *
     * Set it to false on a thinking-tuned local model. Measured on gemma4:26b,
     * asked for one sentence about a mountain: 722 characters of reasoning to
     * produce 37 of answer. A narration prompt is far larger, so the whole
     * completion budget went to reasoning, the content came back EMPTY, and
     * every narration fell through to the deterministic account - silently,
     * because falling back is what the narrator is supposed to do when a
     * provider fails. The game reported itself as model-narrated throughout.
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

export class OllamaProvider implements LLMProvider {
    readonly name = 'ollama' as const;
    private readonly baseUrl: string;
    private readonly defaultModel: string;
    private readonly think: boolean | undefined;
    private readonly fetchImpl: typeof fetch;

    constructor(config: OllamaProviderConfig = {}) {
        // No apiKey guard on purpose - a local server needs no credential, and
        // requiring one would make the self-hosted path impossible to configure.
        this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
        this.defaultModel = config.defaultModel ?? PROVIDER_DEFAULT_MODEL.ollama;
        this.think = config.think;
        this.fetchImpl = config.fetchImpl ?? fetch;
    }

    async call(opts: ProviderCallOpts): Promise<ProviderCallResult> {
        const start = Date.now();
        const model = opts.model || this.defaultModel;

        // Generation knobs live under `options`, not at the top level. num_predict
        // is Ollama's name for the completion cap.
        const options: Record<string, unknown> = {};
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

        // reasoningEffort is deliberately NOT mapped. Ollama exposes thinking via
        // a `think` flag that only thinking-tuned models accept - sending it to an
        // ordinary local model is a hard error, so effort stays a no-op here.
        //
        // `think` itself is sent ONLY when configured, for that same reason: an
        // unset flag is absent from the body rather than false. See the field's
        // doc comment for what leaving it unset costs on a thinking model.
        if (this.think !== undefined) body.think = this.think;

        let response: Response;
        try {
            response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: opts.signal
            });
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
