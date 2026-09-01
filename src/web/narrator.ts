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
    composeIntentUser,
    composeNarrationUser,
    narrationSystemPrompt
} from './prompt.js';
import type { AwarenessRow } from './knowledge.js';
import type { Hearing } from './hearsay.js';
import type { EngineFacts } from './facts.js';

export interface NarratorScene {
    place: string;
    ambient: AmbientQi;
    /**
     * Every person, faction and place this cultivator has heard of.
     *
     * Sent as an explicit whitelist of proper nouns. The discovery rule is
     * enforced twice over: the model is told what it may name, and it is not
     * given anything else to name in the first place.
     */
    awareness?: readonly AwarenessRow[];
    /**
     * A name the engine has decided somebody says in this scene, if any.
     *
     * Licensed for dialogue only. The knowledge record for it was already
     * written before this call, so the name is in the player's world whether or
     * not the prose gets it right - which is the correct dependency direction.
     */
    hearing?: Hearing | null;
    /**
     * What the player literally typed.
     *
     * Asking turns on what was SAID rather than on any stat, so the phrasing
     * has to reach the prose or the narration cannot reflect the thing that
     * made the difference. It is shown to the model, never parsed back out of
     * its reply - the authority line is exactly where it was.
     */
    playerSaid?: string | null;
    /**
     * What the engine actually filed this turn, for the output-side check.
     *
     * Optional, and omitting it audits nothing - which keeps every existing
     * call site working and makes adding the guard to a new one a one-line
     * change rather than a refactor.
     */
    filed?: FiledOutcome | null;
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

// ─────────────────────────────────────────────────────────────────────────
// THE OTHER SIDE OF THE WALL
//
// Everything above this banner protects the ENGINE from the model: an invented
// action name is discarded, an invented stat field is stripped, an out-of-range
// duration falls back, and the model is only ever shown facts the engine
// produced. Twenty-three cases guard it and all twenty-three look at the input.
//
// Nothing looked at what the model SAYS, and that is a hole in the same rule
// from the side nobody was watching. Measured against the real service with a
// scripted narrator:
//
//     narration-claims-breakthrough = true
//     ordinal-after = 0        progress-after = 0
//
// The prose read "Day 91 - Breakthrough succeeded: Qi Condensation Layer 1 to
// Layer 2. Odds were 94.0%." and the cultivator was at ordinal 0 with zero
// progress. Two ranks announced to a player that the engine never granted, in
// prose that imitates the engine's own digest format down to the day numbers
// and the odds. The engine was never touched; the player was told a different
// game had happened.
//
// "The AI narrates, the engine decides" is not only a rule about who writes to
// the database. A player who is told they advanced two ranks HAS been given an
// outcome by a model, whether or not a row moved - they will plan the next
// forty years around it. So the prose is now checked against the engine's own
// account, and prose that contradicts it is not shown.
//
// ── What is checked, and what is deliberately not ────────────────────────
//
// One direction only: a claim the engine did NOT make. Nothing here ever
// requires the prose to say anything - that is the `required` channel's job,
// below - and nothing here reads a value out of the prose and uses it. The
// checks are narrow on purpose, because a false positive throws away good
// writing, and they cover the two outcomes a player would irreversibly act on:
// a rank they did not gain, and a death that did not happen.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the engine actually filed for this turn.
 *
 * Supplied by the caller from the result it already has. Everything is
 * optional and an absent field means "not asserted", so a call site that has
 * no skip to describe audits nothing and loses nothing.
 */
export interface FiledOutcome {
    /** Ranks the engine granted. Zero, absent and null all mean none. */
    ranksGained?: number;
    /** Whether the engine resolved a breakthrough ATTEMPT at all, either way. */
    breakthroughAttempted?: boolean;
    /** Whether the run is over. */
    died?: boolean;
}

export interface NarrationViolation {
    kind: 'invented_breakthrough' | 'invented_death';
    detail: string;
}

/** Prose that claims a rank was gained. */
const CLAIMS_ADVANCEMENT =
    /\b(?:breakthrough succeeded|broke through(?! (?:to nothing|and failed))|broken through|advanced to|rose to|ascended to|stepped up to|climbed to|attained|reached)\b[^.!?]{0,60}\b(?:layer|rank|realm|stage|condensation|foundation|core|nascent|deity|void|tribulation)\b/i;

/** Prose that says the cultivator is dead. */
const CLAIMS_DEATH =
    /\b(?:is dead|died|was killed|did not survive|breathed (?:his|her|their) last|the run is over|will not wake)\b/i;

/**
 * Compare prose against the engine's account.
 *
 * Pure, and it returns findings rather than acting on them, so a caller may
 * log them, fall back, or both. Empty means the prose said nothing the engine
 * did not.
 */
export function auditNarration(
    text: string,
    filed: FiledOutcome | null | undefined
): NarrationViolation[] {
    if (!filed) return [];
    const found: NarrationViolation[] = [];

    // A breakthrough is only a fabrication when the engine granted no rank AND
    // resolved no attempt. An attempt that FAILED is a legitimate thing to
    // write about, and prose about it will contain these words.
    const granted = (filed.ranksGained ?? 0) > 0;
    if (!granted && filed.breakthroughAttempted !== true && CLAIMS_ADVANCEMENT.test(text)) {
        found.push({
            kind: 'invented_breakthrough',
            detail: 'prose announces an advancement; the engine granted no rank and resolved no attempt'
        });
    }

    if (filed.died !== true && CLAIMS_DEATH.test(text)) {
        found.push({
            kind: 'invented_death',
            detail: 'prose reports a death the engine did not record'
        });
    }

    return found;
}

/**
 * Put back anything the narrator left out that a player cannot play without.
 *
 * Appended verbatim rather than rewritten, and only when it is genuinely
 * absent: a model that rendered the fact well has already satisfied this and
 * pays nothing. Matching is on a normalised substring, so a model that quoted
 * the sentence inside its own paragraph counts as having said it.
 */
export function withRequiredLines(text: string, required: readonly string[] | undefined): string {
    if (!required || required.length === 0) return text;
    const seen = normaliseForMatch(text);
    const missing = required.filter(line => !seen.includes(normaliseForMatch(line)));
    if (missing.length === 0) return text;
    return [text, ...missing].join('\n\n');
}

function normaliseForMatch(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
                    { role: 'system', content: narrationSystemPrompt() },
                    { role: 'user', content: composeNarrationUser(facts, scene) }
                ]
            });

            const text = (result.text ?? '').trim();
            if (text.length === 0) {
                return { text: facts.prose, source: 'fallback', note: 'model returned empty prose' };
            }

            // ── the output-side gate ─────────────────────────────────────
            //
            // Prose that announces an outcome the engine did not file is not
            // bad writing to be tidied up, it is the model deciding - and it is
            // degraded exactly the way every other narrator failure is, to the
            // engine's own account. A player whose model invents a breakthrough
            // should get the plain digest, which is always correct, rather than
            // a compelling account of a life they are not living.
            const violations = auditNarration(text, scene.filed);
            if (violations.length > 0) {
                return {
                    text: facts.prose,
                    source: 'fallback',
                    note:
                        'narration contradicted the engine and was discarded ('
                        + violations.map(v => v.kind).join(', ')
                        + '); engine account rendered directly'
                };
            }

            // And anything the engine says the player must read, whether or not
            // the model felt like including it.
            const whole = withRequiredLines(text, facts.required);
            return { text: whole.slice(0, MAX_NARRATION_CHARS), source: 'model', note: null };
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
