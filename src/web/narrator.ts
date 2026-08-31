/**
 * The narrator - and the wall it stands behind.
 *
 * A `Narrator` does exactly two things, and neither of them is deciding what
 * happens:
 *
 *   plan()     phase 1. Free text in, ONE verb from a closed enum out.
 *   narrate()  phase 3. Engine facts in, prose out - prose that is never read
 *              back by any code in this package.
 *
 * Between them sits phase 2, which lives in game.ts and touches no narrator at
 * all. That ordering is the whole architecture: a model can influence which
 * deterministic routine runs, and how the result is described, and nothing in
 * between.
 *
 * Two implementations, and the deterministic one is not a stub:
 *
 *   DeterministicNarrator  keyword intent parsing plus the engine's own prose
 *                          from facts.ts. This is what `docker compose up` with
 *                          zero configuration plays like, and the whole game is
 *                          reachable through it.
 *
 *   ProviderNarrator       wraps an LLMProvider. Every failure mode - no
 *                          response, a timeout, prose instead of JSON, an
 *                          invented action name, an invented stat field -
 *                          degrades to the deterministic path rather than to an
 *                          error. A player whose Ollama container is not
 *                          running should notice worse writing, not a broken
 *                          game.
 *
 * Nothing here branches on which provider is in use. Selection is
 * configuration, resolved once in server.ts by resolveRuntimeProviderConfig().
 */

import type { AmbientQi } from '../schema/cultivation.js';
import type { LLMProvider } from '../agent/provider/types.js';
import {
    extractJsonObject,
    parseIntent,
    validatePlan,
    type Plan
} from './actions.js';
import {
    INTENT_SYSTEM_PROMPT,
    NARRATION_SYSTEM_PROMPT,
    composeIntentUser,
    composeNarrationUser
} from './prompt.js';
import type { EngineFacts } from './facts.js';

export interface NarratorScene {
    place: string;
    ambient: AmbientQi;
}

export interface Narration {
    text: string;
    source: 'model' | 'fallback';
    /** Why the fallback ran. Null on the happy path. */
    note: string | null;
}

export interface Narrator {
    readonly kind: 'provider' | 'deterministic';
    /** Provider name for diagnostics only. Never branched on. */
    readonly providerName: string | null;
    plan(input: string, stateSummary: string): Promise<Plan>;
    narrate(facts: EngineFacts, scene: NarratorScene): Promise<Narration>;
}

/** Longest prose a narration may return. Beyond this it is truncated, not rejected. */
const MAX_NARRATION_CHARS = 6000;

// ─────────────────────────────────────────────────────────────────────────
// DETERMINISTIC
// ─────────────────────────────────────────────────────────────────────────

export class DeterministicNarrator implements Narrator {
    readonly kind = 'deterministic' as const;
    readonly providerName = null;

    constructor(private readonly note = 'no narrator provider configured') {}

    async plan(input: string): Promise<Plan> {
        return { action: parseIntent(input), source: 'fallback', note: this.note };
    }

    async narrate(facts: EngineFacts): Promise<Narration> {
        return { text: facts.prose, source: 'fallback', note: this.note };
    }
}

// ─────────────────────────────────────────────────────────────────────────
// PROVIDER-BACKED
// ─────────────────────────────────────────────────────────────────────────

export interface ProviderNarratorOptions {
    model: string;
    /** Per-call wall clock budget. A slow model must not hang the request. */
    timeoutMs?: number;
    /** Classification wants determinism; narration wants a little room. */
    intentTemperature?: number;
    narrationTemperature?: number;
    maxIntentTokens?: number;
    maxNarrationTokens?: number;
}

export class ProviderNarrator implements Narrator {
    readonly kind = 'provider' as const;
    readonly providerName: string;

    private readonly timeoutMs: number;
    private readonly intentTemperature: number;
    private readonly narrationTemperature: number;
    private readonly maxIntentTokens: number;
    private readonly maxNarrationTokens: number;

    constructor(
        private readonly provider: LLMProvider,
        private readonly options: ProviderNarratorOptions
    ) {
        this.providerName = provider.name;
        this.timeoutMs = options.timeoutMs ?? 30_000;
        this.intentTemperature = options.intentTemperature ?? 0;
        this.narrationTemperature = options.narrationTemperature ?? 0.8;
        this.maxIntentTokens = options.maxIntentTokens ?? 300;
        this.maxNarrationTokens = options.maxNarrationTokens ?? 800;
    }

    /**
     * Phase 1. The return type is `Plan`, never a throw: every path out of here
     * is a legal action, because a player mid-run must not be blocked by an
     * unreachable inference server.
     */
    async plan(input: string, stateSummary: string): Promise<Plan> {
        let text: string;
        try {
            const result = await this.provider.call({
                model: this.options.model,
                temperature: this.intentTemperature,
                maxTokens: this.maxIntentTokens,
                signal: AbortSignal.timeout(this.timeoutMs),
                messages: [
                    { role: 'system', content: INTENT_SYSTEM_PROMPT },
                    { role: 'user', content: composeIntentUser(input, stateSummary) }
                ]
            });
            text = result.text ?? '';
        } catch (err) {
            return {
                action: parseIntent(input),
                source: 'fallback',
                note: `provider unavailable (${errorLabel(err)}); intent parsed deterministically`
            };
        }

        const raw = extractJsonObject(text);
        if (raw === null) {
            return {
                action: parseIntent(input),
                source: 'fallback',
                note: 'model did not return a JSON object; intent parsed deterministically'
            };
        }

        // The gate. An unknown action name, a `days` of 1e9, a `realmOrdinal`
        // field smuggled alongside - all of it either fails validation or is
        // stripped, and either way what comes out the other side is a member of
        // the closed set with bounded arguments.
        const validated = validatePlan(raw);
        if (!validated.ok) {
            return {
                action: parseIntent(input),
                source: 'fallback',
                note: `model response rejected (${validated.reason}); intent parsed deterministically`
            };
        }

        return { action: validated.action, source: 'model' };
    }

    /**
     * Phase 3. The result is stored in the log and shown to the player. It is
     * not parsed, matched, or compared against anything; there is deliberately
     * no code in this package that reads a value out of it.
     */
    async narrate(facts: EngineFacts, scene: NarratorScene): Promise<Narration> {
        try {
            const result = await this.provider.call({
                model: this.options.model,
                temperature: this.narrationTemperature,
                maxTokens: this.maxNarrationTokens,
                signal: AbortSignal.timeout(this.timeoutMs),
                messages: [
                    { role: 'system', content: NARRATION_SYSTEM_PROMPT },
                    { role: 'user', content: composeNarrationUser(facts, scene) }
                ]
            });

            const text = (result.text ?? '').trim();
            if (text.length === 0) {
                return { text: facts.prose, source: 'fallback', note: 'model returned empty prose' };
            }
            return { text: text.slice(0, MAX_NARRATION_CHARS), source: 'model', note: null };
        } catch (err) {
            return {
                text: facts.prose,
                source: 'fallback',
                note: `provider unavailable (${errorLabel(err)}); engine account rendered directly`
            };
        }
    }
}

function errorLabel(err: unknown): string {
    if (err && typeof err === 'object' && 'kind' in err && typeof (err as { kind: unknown }).kind === 'string') {
        return (err as { kind: string }).kind;
    }
    if (err instanceof Error) return err.name === 'TimeoutError' ? 'timeout' : err.message.slice(0, 80);
    return 'unknown';
}
