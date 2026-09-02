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
    TIME_CONSUMING_ACTIONS,
    carryWhatOnlyTheSentenceKnows,
    extractJsonObject,
    parseIntent,
    validatePlan,
    type ActionName,
    type Plan,
    type PlannedAction
} from './actions.js';
import {
    INTENT_SYSTEM_PROMPT,
    composeIntentUser,
    composeNarrationUser,
    narrationSystemPrompt
} from './prompt.js';
import {
    readyTheTier,
    verbForASentenceThePatternsMissed
} from './reaching-a-verb-the-pattern-table-has-no-line-for.js';
import {
    spendsSomething,
    stepsInTheResponse,
    theClauseThisStepQuotes,
    type PlanStep,
    type PlanWithSteps
} from './a-sentence-can-be-more-than-one-call.js';
import type { AwarenessRow } from './knowledge.js';
import type { Hearing } from './hearsay.js';
import type { EngineFacts } from './facts.js';

// ─────────────────────────────────────────────────────────────────────────
// PHASE 1, AND THE ONE THING A MODEL'S READING MAY NOT DO
//
/**
 * The whole of phase 1 when no model answers: the pattern table, and then the
 * embedding for a sentence the table had no line for.
 *
 * The ordering is the safety property and it is one-directional. `parseIntent`
 * runs first and complete, spelling repair included; the embedding is only ever
 * shown a sentence that came back `unclear`, and it cannot move a verb the
 * table already chose - `verbForASentenceThePatternsMissed` returns the table's
 * plan untouched unless the table declined. Measured over the 208 phrasings in
 * `coverage.test.ts`: 208 of 208 unchanged.
 *
 * ── WHAT THIS USED TO CLAIM, AND WHY IT WAS WRONG ────────────────────────
 *
 * It said: "so the two narrators read a sentence the same way. They must."
 *
 * They do not, they never did, and requiring it would be the wrong fix.
 * Measured on a real run, deterministic reader against ollama gemma4:26b, the
 * same sentence back to back:
 *
 *   [deterministic] "I steal from Ji Wanniang"
 *      -> interact(steal). Refused, reached their house, reprisal, a serious
 *         wound, 20 of 40 health.
 *   [model]         "I steal from Ji Wanniang"
 *      -> attack(Ji Wanniang). combat_manage.resolve, a no-contest across four
 *         realms - and against a peer, a duel.
 *
 * A theft became a fight, and three samples of the same sentence gave three
 * different verbs. But `AGENTS.md` is explicit that the model reading a
 * sentence DIFFERENTLY is the point of having one: the same act means
 * different things in different situations, the table cannot see the
 * situation, and a model that agreed with the table in every case would be a
 * slower table. So the invariant cannot be agreement.
 *
 * ── WHAT THE INVARIANT ACTUALLY IS ───────────────────────────────────────
 *
 * > **The model may read a sentence any way it likes. What it may not do is be
 * > the reason a turn became dangerous.**
 *
 * A player whose local model is down should meet worse prose, never a smaller
 * vocabulary - and a player whose local model is UP should never meet a bigger
 * bill for the same words. Running a model is allowed to make a turn cheaper,
 * better read, or differently read; it is not allowed to make it cost days,
 * a wound, or the run when reading the same sentence with no model would not
 * have. {@link theModelIsNotWhyThisTurnIsDangerous} is that rule in code, and
 * it is one-directional: de-escalation is free, and so is any move between two
 * verbs the deterministic reader would already have called dangerous.
 *
 * The line between the two is not invented here. `TIME_CONSUMING_ACTIONS` in
 * `actions.ts` already exists to be exactly this floor - its own docstring says
 * "an intent the engine did not understand must never resolve to anything in
 * it" - so the model is held to the bar an unreadable sentence is already held
 * to, and nothing needed a second classification of what a verb costs.
 *
 * And the reading is SHOWN, which `AGENTS.md` asks for where a reading is a
 * judgement call: the routing row in the log says which reader chose the verb,
 * and a declined escalation says what the model wanted and what ran instead.
 *
 * ── AND IT DEGRADES ──────────────────────────────────────────────────────
 *
 * A corpus that failed to build, or anything else thrown from the tier, costs
 * the player nothing but the refusal they were already getting: the table's own
 * answer is what leaves this function. That sentence was here before the catch
 * that makes it true was, and {@link readTheSentence} is where the argument for
 * catching it here rather than nowhere is written down.
 */
// ─────────────────────────────────────────────────────────────────────────

function withTheTierFailure(note: string, tierFailure: string | null): string {
    return tierFailure ? `${note}; ${tierFailure}` : note;
}

/** What the reader with no model behind it made of the sentence. */
interface DeterministicRead {
    readonly action: PlannedAction;
    /**
     * Why the tier below the table did not answer, or null.
     *
     * Carried rather than swallowed so it reaches the routing row a player can
     * open, on top of the console line the operator gets.
     */
    readonly tierFailure: string | null;
}

/**
 * THE TIER STILL THROWS. THE TURN NO LONGER CARRIES THE THROW TO THE PLAYER.
 *
 * `reaching-a-verb-the-pattern-table-has-no-line-for.ts` opens with the ruling
 * this has to sit under: a file in this repository is not something to write a
 * fallback for, because a quieter mode that silently reads sentences worse is
 * harder to notice than an error. That is right, and the catch that used to be
 * here was removed for it.
 *
 * What was left was this, typed by a player:
 *
 *   > what is this place like now
 *   !!! THREW: The verb corpus has changed since its vectors were built
 *   (file 0b7898..., corpus 9292...). Run `npm run verbs:embed`.
 *
 * That is not failing loudly. It is failing at the wrong person: a build
 * instruction, in the second person, to somebody who is playing a game and has
 * no checkout to run it in. The vectors are gitignored by design, so a fresh
 * clone meets it on the first sentence the table cannot read.
 *
 * The two rulings are not actually in tension once you separate WHERE it fails
 * from WHETHER it is silent. This is silent nowhere:
 *
 *   - `readyTheTier` still throws, unchanged. Nothing degrades inside it.
 *   - Start-up still calls it and still reports the failure, before anybody has
 *     typed anything.
 *   - `npm test` fails - `the-verb-corpus-vectors-are-current.test.ts` fails by
 *     itself and by name, and the tier's own suite fails with it.
 *   - Every turn that meets it writes a console line naming the command.
 *   - And the routing row the player can open carries the reason too.
 *
 * Four boundaries where somebody can act on it, and the only place it stops is
 * inside somebody's turn. What the player loses is nothing they had: this tier
 * only ever runs on a sentence the table already declined, so the caught path
 * returns the refusal they were getting anyway, with the live verbs under it.
 *
 * Quantified, on one commit with a single `npm run verbs:embed` between runs:
 * 11 failing tests before, 5 after. Five whole test FILES were this throw
 * arriving where nobody had asked a question about the corpus.
 */
async function readTheSentence(input: string): Promise<DeterministicRead> {
    const fromTable = parseIntent(input);
    try {
        return { action: await verbForASentenceThePatternsMissed(input, fromTable), tierFailure: null };
    } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        console.error(
            `[narrator] the sentence model did not answer and the table's own reading was used: ${why}`
        );
        return { action: fromTable, tierFailure: `the sentence model did not answer (${why})` };
    }
}

/**
 * Verbs that can spend a day, write a wound, or end the run.
 *
 * Read off `actions.ts` rather than restated, because a verb added tomorrow
 * gets this guard the moment its author classifies it - which is a thing they
 * have to do anyway, and the one thing they cannot forget.
 */
function spendsMoreThanASentence(action: ActionName): boolean {
    return (TIME_CONSUMING_ACTIONS as readonly ActionName[]).includes(action);
}

export interface ReadingCheck {
    readonly action: PlannedAction;
    /** What was declined and what ran instead. Null when nothing was declined. */
    readonly declined: string | null;
    /** Anything the tier failed at on the way. Null on the happy path. */
    readonly tierFailure: string | null;
}

/**
 * The one thing a model's reading of a sentence may not do.
 *
 * ── WHAT IS CHECKED ──────────────────────────────────────────────────────
 *
 * Only whether the model is the REASON this turn can cost the player. If the
 * verb the model chose cannot spend a day, write a wound or end the run,
 * nothing is compared and nothing is computed - which is also why this is
 * cheap: the deterministic reading is only ever read for the minority of turns
 * where the model reached for something expensive.
 *
 * The baseline is the whole deterministic reader, table AND tier, rather than
 * the table alone. That matters in both directions. "I draw my blade" is
 * `unclear` to the table and `attack` to the tier at 0.879, so a model calling
 * it a fight is agreeing with the reader it is being checked against. "he has
 * pushed me too far" is `unclear` to both - the tier's own dangerous-verb floor
 * declines it at 0.751 against a bar of 0.76 - and a model calling that a fight
 * is starting one nobody could read out of the words.
 *
 * ── WHAT IS DELIBERATELY NOT CHECKED ─────────────────────────────────────
 *
 * **The verb, when the two readings are both cheap or both dangerous.** A
 * question read as a bargain, a bargain read as a petition, a threat read as an
 * ask: all free, all the point of having a model, and the routing row says
 * which verb was chosen and by what.
 *
 * **The intent inside a verb.** `interact` carries both `talk`, which is a
 * read, and the eight of `PRESSING_SOMEBODY`, which spend days and can
 * empty the purse - so an escalation is expressible there too, and it is left
 * alone on purpose. Reading "I want that book from him" as a negotiation
 * rather than as a description of a man is exactly the situational reading the
 * design is buying, and holding the intent to the table's would cap the model
 * at the table's ceiling on the readings it exists to make. The verb is where
 * the repo already draws a cost line; the intent is not, and inventing a
 * second classification here to draw one would be a second cost model living
 * beside the first.
 *
 * **Anything about the outcome.** This chooses which deterministic routine
 * runs and nothing else, which is the same authority phase 1 always had.
 */
async function theModelIsNotWhyThisTurnIsDangerous(
    fromModel: PlannedAction,
    input: string
): Promise<ReadingCheck> {
    if (!spendsMoreThanASentence(fromModel.action)) {
        return { action: fromModel, declined: null, tierFailure: null };
    }

    const withoutAModel = await readTheSentence(input);
    if (spendsMoreThanASentence(withoutAModel.action.action)) {
        return { action: fromModel, declined: null, tierFailure: withoutAModel.tierFailure };
    }

    return {
        action: withoutAModel.action,
        declined:
            `the model read this as ${fromModel.action}, which can spend days or end the run; `
            + `reading the same sentence without a model reaches ${withoutAModel.action.action}, which cannot. `
            + 'A model may read a sentence differently; it may not be the reason a turn became dangerous. '
            + `Say it plainly - "I attack him" - to mean ${fromModel.action}.`,
        tierFailure: withoutAModel.tierFailure
    };
}

/**
 * Open the model before the first turn asks for it.
 *
 * The weights and the exemplar vectors cost a fraction of a second to read, and
 * paying it while the player is watching a spinner is the wrong moment. Called
 * from `server.ts` at start-up; anything that skips it simply pays on the first
 * sentence the table cannot read, because `readyTheTier` is idempotent.
 */
export function openTheSentenceModel(): Promise<void> {
    return readyTheTier();
}

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
    /**
     * Phase 1. One verb, or several in the order the player said them.
     *
     * `PlanWithSteps` rather than `Plan` because a sentence can contain a plan -
     * *"I take his purse, hand it to the man beside him, and walk away"* is
     * three acts, and a reader that can only answer with one either refuses it
     * or, as measured, narrates the two it could not run. `steps` is absent from
     * every deterministic answer, and absent means one call, which is the object
     * that reached the engine before sequences existed. See
     * `a-sentence-can-be-more-than-one-call.ts` for the law that bounds it.
     */
    plan(input: string, stateSummary: string): Promise<PlanWithSteps>;
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
 *
 * ── AND IT STAYS AT TWO CHECKS, WHICH WAS A RULING RATHER THAN AN OVERSIGHT ─
 *
 * A playtest found four turns where the model narrated ACTS the engine never
 * ran rather than outcomes it never filed - a purse pressed into somebody's
 * hand on a turn the ask was refused, a purchase on a turn whose ruling said
 * "nothing bought", a year of hauling on a turn that spent no day, and a price
 * and a balance assigned the wrong way round. Every one of them is a lie a
 * player would act on, and none is an invented rung or an invented death.
 *
 * Checks for all four were written, measured against the four fixtures, and
 * withdrawn on the design owner's ruling: **"you can just prompt the LLM to do
 * as told and no more than that."** The fix is in what the narrator is TOLD,
 * and it is now two clauses in `NARRATOR-CORE.md` - only the acts the turn ran
 * happened, and every figure comes from a ruling.
 *
 * The evidence supports the ruling rather than merely deferring to it. On the
 * turns where the engine reported what it had declined, the model narrated
 * honestly every time, including writing "the manual is marked at eleven spirit
 * stones" for a price on display it had not paid. It filled the gap only where
 * a clause was dropped and the turn said nothing about it. **The model lies
 * when the turn does not tell it what was not done, and stops lying when it
 * does** - so a checker behind the prompt would have been catching the symptom
 * of a hole in what gets passed.
 *
 * What is left here is the pair that guards the two outcomes a player would
 * irreversibly act on, and they stay narrow for the reason above the banner: a
 * false positive throws away good writing, and a discarded narration is now
 * something the player is told about.
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
 * What the player is told when a narration was thrown away.
 *
 * ── WHY THE PLAYER AND NOT ONLY THE OPERATOR ─────────────────────────────
 *
 * A discarded narration used to be silent at the front: the prose swapped to
 * the engine's own account under the same banner, and the only trace was a note
 * in a row nobody opens. That is wrong in both directions at once. When the
 * verdict is RIGHT, the player has just been protected from a model that told
 * them something untrue and has no way to know it happened or to report it.
 * When it is WRONG - and a playtest caught one firing on a false verdict - the
 * player has silently lost the writing they were promised, and the only
 * evidence of the bug is invisible to the person best placed to notice it.
 *
 * `AGENTS.md` states the floor this sits under and it holds at every rung: a
 * turn that changes what the player is reading and says nothing is broken.
 * One sentence, in the game's own plain voice, and no jargon: it says what was
 * swapped and it does not explain the architecture.
 */
export const THE_NARRATION_WAS_DISCARDED =
    'The account written for this turn described something that did not happen, '
    + 'so what is above is the engine\'s own record of it instead.';

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
        const read = await readTheSentence(input);
        return {
            action: read.action,
            source: 'fallback',
            note: read.tierFailure ? `${this.note}; ${read.tierFailure}` : this.note
        };
    }

    /**
     * The engine's own account, plus anything a caller marked required.
     *
     * `prose` is composed once, from the lines `facts.ts` was given. Callers
     * that learn something AFTERWARDS - the ceiling before a decade, what the
     * cave mouth charged for rations, an event that ended the stretch - push it
     * onto `lines` and onto `required`, and `lines` is a licence rather than a
     * script. So on this path those sentences reached nobody at all: the same
     * omission `required` was written to stop, one door over.
     *
     * Measured, and it killed runs. A purse went 24 -> 6 -> 0 across two
     * seclusions with no mention of a purchase either time, and a serious qi
     * deviation that halted a stretch was never narrated.
     *
     * `withRequiredLines` only appends what is genuinely absent, so where the
     * composed prose already carries the fact this costs nothing - and the two
     * front doors now mean the same thing by `required`, which the package
     * README has claimed for some time.
     */
    async narrate(facts: EngineFacts): Promise<Narration> {
        return {
            text: withRequiredLines(facts.prose, facts.required),
            source: 'fallback',
            note: this.note
        };
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
    async plan(input: string, stateSummary: string): Promise<PlanWithSteps> {
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
            return this.deterministically(
                input,
                `provider unavailable (${errorLabel(err)}); intent parsed deterministically`
            );
        }

        const raw = extractJsonObject(text);
        if (raw === null) {
            return this.deterministically(
                input,
                'model did not return a JSON object; intent parsed deterministically'
            );
        }

        // ── A SENTENCE MAY CONTAIN A PLAN ───────────────────────────────
        //
        // Tried before the single-plan path and falling through to it when the
        // response carries no `steps`, so a model that answers the old way -
        // and both deterministic tiers, which always do - reaches exactly the
        // code it reached before.
        const asSteps = stepsInTheResponse(raw, input);
        if (asSteps !== null && asSteps.length > 0) {
            return await this.aPlanRatherThanAVerb(asSteps, input);
        }

        // The gate. An unknown action name, a `days` of 1e9, a `realmOrdinal`
        // field smuggled alongside - all of it either fails validation or is
        // stripped, and either way what comes out the other side is a member of
        // the closed set with bounded arguments.
        const validated = validatePlan(raw);
        if (!validated.ok) {
            return this.deterministically(
                input,
                `model response rejected (${validated.reason}); intent parsed deterministically`
            );
        }

        // The model chose the verb; the sentence still owns the facts about
        // itself. Without this a configured provider and an unconfigured one
        // hand the ENGINE different objects for the same sentence - a threat
        // loses the leverage the social resolver reads, a count of rations
        // becomes a defaulted month - and the two modes stop being the same
        // game. See `carryWhatOnlyTheSentenceKnows` for the measurement.
        const chosen = carryWhatOnlyTheSentenceKnows(validated.action, input);

        // And the one thing the model's reading may not be: the reason this
        // turn can cost days, a wound, or the run. Degraded exactly the way
        // every other model failure in this class is - to the reading the
        // player would have got with no model at all - and never silently: the
        // note is the routing row, which is the row that exists to say where
        // the verb came from.
        const checked = await theModelIsNotWhyThisTurnIsDangerous(chosen, input);
        if (checked.declined !== null) {
            return {
                action: checked.action,
                source: 'fallback',
                note: withTheTierFailure(checked.declined, checked.tierFailure)
            };
        }
        return { action: checked.action, source: 'model' };
    }

    /**
     * A sequence, with the same one thing checked that a single verb is.
     *
     * ── MORE REACH, AND NOT ONE GRAIN MORE AUTHORITY ─────────────────────
     *
     * {@link theModelIsNotWhyThisTurnIsDangerous} is applied to EVERY costly
     * step, not to the plan as a whole, and that is the strict reading of the
     * rule rather than a convenient one. The invariant has never been about how
     * many calls a turn makes; it is that *a player whose local model is up must
     * never meet a bigger bill for the same words*. A three-step plan whose
     * middle step is a fight nobody could read out of the sentence is that
     * defect with two free reads standing in front of it, and checking the plan
     * "as a whole" would let it through.
     *
     * A declined step is replaced by the deterministic reading of the same
     * sentence, which by construction is not dangerous - so the plan keeps its
     * shape and its length, loses only the escalation, and says so in the
     * routing note the player can open.
     *
     * ── WHAT `action` MEANS ON A PLAN WITH STEPS ─────────────────────────
     *
     * The verb THE TURN IS ABOUT: the costly act when there is exactly one, and
     * otherwise the first step. That keeps every existing reader of a plan
     * working unchanged - the routing row, the dropped-clause check, the
     * crossroads settlement - and it is the honest answer to "what did this turn
     * do", because free reads around one costly act are the ordinary shape and
     * the costly one is the act.
     */
    private async aPlanRatherThanAVerb(
        steps: readonly PlanStep[],
        input: string
    ): Promise<PlanWithSteps> {
        const checked: PlanStep[] = [];
        const declined: string[] = [];
        let tierFailure: string | null = null;

        for (const step of steps) {
            if (!spendsSomething(step)) {
                checked.push(step);
                continue;
            }
            // THE SAME WORDS, AND FOR A PLAN THAT MEANS THE CLAUSE.
            //
            // The invariant is that a player must not meet a bigger bill for
            // the same words. With one verb a turn, the sentence and the act
            // were the same thing; with a plan they are not, and reading a
            // three-clause sentence with the table gives whichever verb it
            // reaches FIRST - so every later costly step would be declined for
            // not being the first thing said. `theClauseThisStepQuotes` returns
            // the player's own words only when they really are the player's own
            // words, and falls back to the whole sentence, which is stricter.
            const sameWords = theClauseThisStepQuotes(step, input) ?? input;
            const verdict = await theModelIsNotWhyThisTurnIsDangerous(step.action, sameWords);
            tierFailure = verdict.tierFailure ?? tierFailure;
            if (verdict.declined !== null) declined.push(verdict.declined);
            checked.push({ action: verdict.action, said: step.said });
        }

        const costly = checked.filter(spendsSomething);
        const headline = (costly.length === 1 ? costly[0] : checked[0])!;

        const note = [
            `read as a plan of ${checked.length}: `
            + checked.map(step => step.action.action).join(' -> ')
            + '. Resolved in order, each against the world the one before it left.',
            ...declined
        ].join(' ');

        return {
            action: headline.action,
            steps: checked,
            // `model` when nothing was declined, because the model chose every
            // verb that ran; `fallback` when something was, because at least one
            // of them is the reading the player would have got with no model.
            source: declined.length === 0 ? 'model' : 'fallback',
            note: withTheTierFailure(note, tierFailure)
        };
    }

    /**
     * Phase 1 with no model in it, wearing whatever note said why.
     *
     * Four call sites had the same three lines and none of them could report a
     * tier that had failed underneath, so a broken corpus was invisible on
     * exactly the paths a player meets it on.
     */
    private async deterministically(input: string, note: string): Promise<Plan> {
        const read = await readTheSentence(input);
        return {
            action: read.action,
            source: 'fallback',
            note: withTheTierFailure(note, read.tierFailure)
        };
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
                // Loud at the boundary where somebody can act on it. The verdict
                // has already been wrong once in a playtest, and a check that
                // throws away good writing without saying so is unfalsifiable.
                console.error(
                    `[narrator] narration discarded (${violations.map(v => v.kind).join(', ')}): `
                    + violations.map(v => v.detail).join('; ')
                );
                return {
                    // And the player is told, which they were not before. See
                    // {@link THE_NARRATION_WAS_DISCARDED} for why this is the
                    // player's business and not only the operator's.
                    text: `${facts.prose}\n\n${THE_NARRATION_WAS_DISCARDED}`,
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

/**
 * Why the provider did not answer, in words somebody can act on.
 *
 * ── WHY THE MESSAGE IS HERE AND THE KIND ALONE IS NOT ────────────────────
 *
 * This returned `err.kind` and nothing else, so a real session running a local
 * model saw only:
 *
 *     provider unavailable (malformed); intent parsed deterministically
 *
 * "Malformed" is a CATEGORY. The sentence that says what to do about it was
 * thrown with the error and discarded one line later - `ollama.ts` raises
 * "Provider returned empty content with done_reason='length': the completion
 * budget (N) was exhausted before any text was produced. Raise agent.maxTokens",
 * which is a complete diagnosis and a fix. The operator got the one word that
 * cannot be acted on and never saw the one that could.
 *
 * That is the standard this build holds everywhere else - a refusal must name
 * what would work - applied to the one refusal an operator meets before they
 * have a game running at all. Kind AND message, kind first so the category
 * stays greppable.
 */
function errorLabel(err: unknown): string {
    const kind =
        err && typeof err === 'object' && 'kind' in err && typeof (err as { kind: unknown }).kind === 'string'
            ? (err as { kind: string }).kind
            : null;
    const message = err instanceof Error
        ? (err.name === 'TimeoutError' ? 'timed out' : err.message)
        : null;

    if (kind !== null) {
        return message ? `${kind}: ${message.slice(0, 240)}` : kind;
    }
    if (message !== null) return message.slice(0, 240);
    return 'unknown';
}
