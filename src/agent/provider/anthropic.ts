/**
 * Anthropic (Claude) provider — the primary/default runtime agent.
 *
 * Uses the Messages API: POST https://api.anthropic.com/v1/messages
 * Auth is `x-api-key` (NOT a bearer token) plus the pinned `anthropic-version`
 * header. Native fetch, same error-classification and replay-capture contract as
 * every other provider.
 *
 * Wire-shape differences from the OpenAI Chat Completions providers, all of them
 * absorbed here so callers never see them:
 *
 *   1. The system prompt is a TOP-LEVEL `system` parameter, not a message with
 *      role 'system'. Incoming ChatMessage[] therefore has its system turns
 *      hoisted out and merged.
 *   2. `max_tokens` is REQUIRED — a request without it is rejected.
 *   3. The reply is `content: [{type:'text', text}, ...]` blocks, which must be
 *      concatenated to produce the single `.text` the interface promises.
 *   4. Usage is `input_tokens` / `output_tokens`, not prompt/completion.
 *   5. `stop_reason` uses Anthropic's vocabulary ('end_turn', 'max_tokens', ...)
 *      and is normalized onto the provider-neutral finishReason vocabulary the
 *      runtime already stores for OpenAI ('stop', 'length', ...).
 */

import {
    LLMProvider,
    ProviderCallOpts,
    ProviderCallResult,
    ProviderError,
    ReasoningEffort,
    ChatMessage,
    classifyFetchError,
    classifyHttpStatus
} from './types.js';
import { PROVIDER_DEFAULT_MODEL } from './config.js';
import { reasoningCompletionFloor } from './reasoning.js';

const DEFAULT_BASE = 'https://api.anthropic.com/v1';

/** The Messages API version this implementation is written against. */
export const ANTHROPIC_VERSION = '2023-06-01';

/**
 * `max_tokens` is mandatory on the Messages API, but ProviderCallOpts.maxTokens
 * is optional (OpenAI happily defaults it). Supply a conversational default so a
 * caller that omits it gets a reply instead of a 400.
 */
export const DEFAULT_MAX_TOKENS = 1024;

/** Anthropic's own minimum for an explicit thinking budget. */
const MIN_THINKING_BUDGET = 1024;

export interface AnthropicProviderConfig {
    apiKey: string;
    baseUrl?: string;
    /** Override the pinned API version (rarely needed). */
    anthropicVersion?: string;
    /** Model used when a call omits one. Defaults to the configured default. */
    defaultModel?: string;
    /** Allow tests to inject a custom fetch implementation. */
    fetchImpl?: typeof fetch;
}

interface AnthropicContentBlock {
    type?: string;
    text?: string;
    thinking?: string;
}

interface AnthropicMessagesResponse {
    content?: AnthropicContentBlock[];
    stop_reason?: string | null;
    model?: string;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        /** Present on responses that separate thinking spend from visible output. */
        thinking_tokens?: number;
        output_tokens_details?: { thinking_tokens?: number };
    };
    error?: { type?: string; message?: string };
}

interface AnthropicWireMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Model families that take adaptive extended thinking (`thinking:{type:'adaptive'}`)
 * and REJECT the older fixed `budget_tokens` form with a 400. Newer Claude models
 * decide their own thinking depth; depth is steered by `output_config.effort`.
 */
const ADAPTIVE_THINKING_PREFIXES = [
    'claude-fable-5',
    'claude-mythos-5',
    'claude-opus-5',
    'claude-opus-4-8',
    'claude-opus-4-7',
    'claude-opus-4-6',
    'claude-sonnet-5',
    'claude-sonnet-4-6'
];

/**
 * The subset of the above that also REJECTS sampling parameters (temperature,
 * top_p, top_k) with a 400, and that accepts the 'xhigh' effort level.
 *
 * This matters in practice: agents carry a temperature (default 0.7) that the
 * runtime passes on every call, so sending it blindly to a current Claude model
 * would turn every NPC turn into a 400.
 */
const NO_SAMPLING_PREFIXES = [
    'claude-fable-5',
    'claude-mythos-5',
    'claude-opus-5',
    'claude-opus-4-8',
    'claude-opus-4-7',
    'claude-sonnet-5'
];

/** Strip an optional gateway namespace ("anthropic/claude-opus-5") and case. */
function normalizeModel(model: string): string {
    return model.toLowerCase().replace(/^[^/]+\//, '');
}

function matchesFamily(model: string, prefixes: string[]): boolean {
    const normalized = normalizeModel(model);
    return prefixes.some(prefix => normalized.startsWith(prefix));
}

/** Exported for tests and for callers that need to explain a model's behaviour. */
export function usesAdaptiveThinking(model: string): boolean {
    return matchesFamily(model, ADAPTIVE_THINKING_PREFIXES);
}

export function rejectsSamplingParams(model: string): boolean {
    return matchesFamily(model, NO_SAMPLING_PREFIXES);
}

/**
 * Map the runtime's ReasoningEffort onto `output_config.effort`. The vocabulary
 * matches one-for-one except that 'xhigh' only exists on the newer families —
 * clamp it down rather than send a level the model will reject.
 */
function effortFor(model: string, effort: ReasoningEffort): string {
    if (effort === 'xhigh' && !rejectsSamplingParams(model)) return 'high';
    return effort;
}

/**
 * Hoist system turns out of the message list.
 *
 * Anthropic has no system role inside `messages`; a system turn there is a 400.
 * Multiple system slices (the prompt composer can emit more than one) are merged
 * in order with a blank line, which preserves their meaning as one instruction
 * block. The remaining turns keep their order.
 */
export function splitSystemMessages(messages: ChatMessage[]): {
    system: string | null;
    chat: AnthropicWireMessage[];
} {
    const systemParts: string[] = [];
    const chat: AnthropicWireMessage[] = [];
    for (const message of messages) {
        if (message.role === 'system') {
            if (message.content) systemParts.push(message.content);
            continue;
        }
        chat.push({ role: message.role, content: message.content });
    }
    return {
        system: systemParts.length > 0 ? systemParts.join('\n\n') : null,
        chat
    };
}

/**
 * Normalize Anthropic's stop_reason onto the finishReason vocabulary the runtime
 * already persists for the OpenAI-shaped providers, so audit rows and any
 * downstream check ('length' means the budget ran out) stay provider-neutral.
 */
function normalizeStopReason(stopReason: string | null | undefined): string | undefined {
    switch (stopReason) {
        case 'end_turn':
        case 'stop_sequence':
            return 'stop';
        case 'max_tokens':
            return 'length';
        case null:
        case undefined:
            return undefined;
        default:
            // 'tool_use', 'pause_turn', 'refusal', and anything added later pass
            // through verbatim — inventing a translation would lose information.
            return stopReason;
    }
}

export class AnthropicProvider implements LLMProvider {
    readonly name = 'anthropic' as const;
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly anthropicVersion: string;
    private readonly defaultModel: string;
    private readonly fetchImpl: typeof fetch;

    constructor(config: AnthropicProviderConfig) {
        if (!config.apiKey) {
            throw new Error('AnthropicProvider requires apiKey');
        }
        this.apiKey = config.apiKey;
        this.baseUrl = (config.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
        this.anthropicVersion = config.anthropicVersion ?? ANTHROPIC_VERSION;
        this.defaultModel = config.defaultModel ?? PROVIDER_DEFAULT_MODEL.anthropic;
        this.fetchImpl = config.fetchImpl ?? fetch;
    }

    async call(opts: ProviderCallOpts): Promise<ProviderCallResult> {
        const start = Date.now();
        const model = opts.model || this.defaultModel;
        const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': this.anthropicVersion
        };

        const { system, chat } = splitSystemMessages(opts.messages);
        if (chat.length === 0) {
            // A system-only prompt has nothing for the model to answer. Fail here
            // rather than spend a round trip on a guaranteed 400.
            throw new ProviderError(
                'Anthropic requires at least one user/assistant message; the prompt contained only system content',
                'malformed'
            );
        }

        const body: Record<string, unknown> = {
            model,
            max_tokens: maxTokens,
            messages: chat
        };
        if (system) body.system = system;

        // Current Claude models reject temperature outright; older ones accept it.
        if (opts.temperature !== undefined && !rejectsSamplingParams(model)) {
            body.temperature = opts.temperature;
        }

        if (opts.reasoningEffort !== undefined && opts.reasoningEffort !== null) {
            if (usesAdaptiveThinking(model)) {
                // Adaptive thinking + effort: the model paces its own reasoning.
                body.thinking = { type: 'adaptive' };
                body.output_config = { effort: effortFor(model, opts.reasoningEffort) };
            } else {
                // Legacy families still take a fixed thinking budget, which must
                // be at least 1024 and strictly less than max_tokens — otherwise
                // reasoning would consume the entire allowance and the model
                // would have no room left to speak. If the caller's ceiling can't
                // fund both, skip thinking rather than send an invalid request.
                const budget = Math.min(
                    reasoningCompletionFloor(opts.reasoningEffort),
                    maxTokens - MIN_THINKING_BUDGET
                );
                if (budget >= MIN_THINKING_BUDGET) {
                    body.thinking = { type: 'enabled', budget_tokens: budget };
                }
            }
        }

        let response: Response;
        try {
            response = await this.fetchImpl(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: opts.signal
            });
        } catch (err) {
            throw classifyFetchError(err);
        }

        const rawText = await response.text();
        const durationMs = Date.now() - start;

        if (!response.ok) {
            throw classifyHttpStatus(response.status, rawText);
        }

        let parsed: AnthropicMessagesResponse;
        try {
            parsed = JSON.parse(rawText);
        } catch (err) {
            throw new ProviderError(`Malformed JSON response: ${(err as Error).message}`, 'malformed', response.status, rawText);
        }

        if (parsed.error) {
            throw new ProviderError(parsed.error.message ?? 'Unknown provider error', 'server', response.status, rawText);
        }

        // A reply is a LIST of blocks. Thinking blocks carry no visible prose, so
        // only text blocks contribute; multi-block replies concatenate in order.
        const text = (parsed.content ?? [])
            .filter(block => block.type === 'text' && typeof block.text === 'string')
            .map(block => block.text as string)
            .join('');

        const finishReason = normalizeStopReason(parsed.stop_reason);

        if (!text) {
            if (parsed.stop_reason === 'max_tokens') {
                throw new ProviderError(
                    `Provider returned empty content with stop_reason="max_tokens": the completion budget (${maxTokens}) `
                    + 'was exhausted before any text was produced, likely consumed by extended thinking. Raise agent.maxTokens.',
                    'malformed', response.status, rawText
                );
            }
            if (parsed.stop_reason === 'refusal') {
                throw new ProviderError(
                    'Provider declined the request (stop_reason="refusal")',
                    'malformed', response.status, rawText
                );
            }
            throw new ProviderError('Provider returned empty message content', 'malformed', response.status, rawText);
        }

        const promptTokens = parsed.usage?.input_tokens;
        const completionTokens = parsed.usage?.output_tokens;

        return {
            text,
            promptTokens,
            completionTokens,
            // Anthropic reports the two halves but no total — derive it so the
            // runtime's budget accounting doesn't have to fall back to an estimate.
            totalTokens: promptTokens !== undefined && completionTokens !== undefined
                ? promptTokens + completionTokens
                : undefined,
            reasoningTokens: parsed.usage?.thinking_tokens ?? parsed.usage?.output_tokens_details?.thinking_tokens,
            // No dollar figure comes back on the Messages API; the runtime falls
            // back to costSource 'estimated' when costUsd is absent.
            raw: rawText,
            durationMs,
            finishReason
        };
    }
}
