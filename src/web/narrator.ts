/**
 * The narrator - and the wall it stands behind.
 */

import type { AmbientQi } from '../schema/cultivation.js';
import type { LLMProvider } from '../agent/provider/types.js';
import {
    FALLBACK_ACTION,
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
    nearestVerbByMeaning,
    readyTheTier,
    theTableMeantIt,
    verbForASentenceThePatternsMissed
} from './reaching-a-verb-the-pattern-table-has-no-line-for.js';
import {
    anyClauseReadsAsThisVerb,
    theClausesNoStepAccountsFor,
    theWholeSentenceAsAPlan,
    spendsSomething,
    stepsInTheResponse,
    theReaderSaysItDecidedTheOrder,
    whyTheReaderSaysTheOrderCannotWork,
    theClauseThisStepQuotes,
    type PlanStep,
    type PlanWithSteps
} from './a-sentence-can-be-more-than-one-call.js';
// The one place every verb declares which fields it reads. `canCarryASubject`
// asks it whether a verb has anywhere to put the thing a sentence named, which
// is a question it already answers for the phase-1 glossary and for
// `docs/verbs.md`. No second list.
import { WHAT_EACH_VERB_IS_FOR } from './what-each-verb-is-for-in-the-players-words.js';
import type { AwarenessRow } from './knowledge.js';
import type { Hearing } from './hearsay.js';
import type { EngineFacts } from './facts.js';

// ─────────────────────────────────────────────────────────────────────────
// PHASE 1, AND THE ONE THING A MODEL'S READING MAY NOT DO
//
/**
 * The whole of phase 1 when no model answers: the pattern table, and then the
 * embedding for a sentence the table had no line for.
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
 */
function spendsMoreThanASentence(action: ActionName): boolean {
    return (TIME_CONSUMING_ACTIONS as readonly ActionName[]).includes(action);
}

/**
 * Somebody handing a thing over, and somebody taking one off a person.
 */
function readsAsGiving(plan: PlannedAction): boolean {
    return plan.action === 'give';
}

function readsAsTaking(plan: PlannedAction): boolean {
    if (plan.action === 'coerce') return true;
    if (plan.action === 'attack') return true;
    // `take` as well as `steal`, because a taking no longer asserts whose the
    // thing was: the reader says a taking was said and the WORLD decides
    // whether it was a theft. A guard that knew only the word `steal` would
    // wave through every politely-worded one, which is the whole class
    // `a-taking-is-decided-by-ownership.ts` exists for.
    return plan.action === 'interact'
        && (plan.intent === 'steal' || plan.intent === 'take');
}

/**
 * A reading that changes what the player IS, rather than what a turn costs.
 */
function changesWhoYouAre(plan: PlannedAction): boolean {
    if (plan.action !== 'sect') return false;
    if (plan.intent === 'leave') return true;
    return (plan.target ?? '').trim().length > 0;
}

/**
 * Whether a verb has anywhere to put the thing a sentence named.
 */
function canCarryASubject(action: ActionName): boolean {
    const takes = WHAT_EACH_VERB_IS_FOR[action]?.takes ?? [];
    return takes.includes('target') || takes.includes('topic');
}

/** Whether a reading actually came out holding one. */
function namesASubject(plan: PlannedAction): boolean {
    return (plan.target ?? '').trim().length >= 2 || (plan.topic ?? '').trim().length >= 2;
}

/**
 * THE SECOND THING A MODEL'S READING MAY NOT DO: DROP THE OBJECT.
 */
function theObjectWasDropped(fromModel: PlannedAction, input: string): ReadingCheck | null {
    if (canCarryASubject(fromModel.action)) return null;

    const fromTable = parseIntent(input);
    if (fromTable.action === fromModel.action) return null;
    if (!namesASubject(fromTable) || !canCarryASubject(fromTable.action)) return null;
    // One-directional, exactly like the cost rule: correcting a dropped object
    // may hand back a free read and may never start something.
    if (spendsMoreThanASentence(fromTable.action)) return null;

    return {
        action: fromTable,
        declined:
            `the model read this as ${labelFor(fromModel)}, which has nowhere to put a subject; `
            + `the sentence names one, and reading it without a model reaches `
            + `${labelFor(fromTable)} on "${(fromTable.target ?? fromTable.topic ?? '').slice(0, 40)}". `
            + 'A model may read a sentence any way it likes; it may not answer a sentence about '
            + 'something with a read of the surroundings.',
        tierFailure: null
    };
}

function labelFor(plan: PlannedAction): string {
    return plan.intent ? `${plan.action}/${plan.intent}` : plan.action;
}

export interface ReadingCheck {
    readonly action: PlannedAction;
    /** What was declined and what ran instead. Null when nothing was declined. */
    readonly declined: string | null;
    /** Anything the tier failed at on the way. Null on the happy path. */
    readonly tierFailure: string | null;
}


/**
 * THE THIRD THING A MODEL'S READING MAY NOT DO: RE-ROUTE A DELIBERATE `unclear`.
 */
function theTableAnsweredItOnPurpose(
    fromModel: PlannedAction,
    input: string
): ReadingCheck | null {
    if (!theTableMeantIt(input)) return null;
    if (fromModel.action === FALLBACK_ACTION) return null;

    return {
        action: { action: FALLBACK_ACTION },
        declined:
            `the model read this as ${labelFor(fromModel)}; the sentence is somebody asking `
            + 'what there is to do, which the engine answers directly rather than with a verb. '
            + 'A model may read a sentence any way it likes; it may not answer a question about '
            + 'what is possible with an act.',
        tierFailure: null
    };
}

/**
 * THE FOURTH: EARNING AND SPENDING ARE NEVER EACH OTHER'S FALLBACK.
 */
function readsAsSpending(plan: PlannedAction): boolean {
    return plan.action === 'market' || plan.action === 'buy';
}

async function earningIsNotSpending(
    fromModel: PlannedAction,
    input: string
): Promise<ReadingCheck | null> {
    if (!readsAsSpending(fromModel)) return null;

    const withoutAModel = await readTheSentence(input);
    const table = withoutAModel.action;
    // The QUESTION, and never the taking. See the note above on the ninety days.
    if (table.action !== 'work' || table.intent !== 'board') return null;

    return {
        action: table,
        declined:
            `the model read this as ${labelFor(fromModel)}; reading the same sentence without a `
            + 'model reaches the work going here. Earning and spending are opposite directions '
            + 'across one counter, and a model may not answer a question about one with the '
            + 'other. What ran is the board, which costs nothing to read.',
        tierFailure: withoutAModel.tierFailure
    };
}

/**
 * The one thing a model's reading of a sentence may not do.
 */
async function theModelIsNotWhyThisTurnIsDangerous(
    fromModel: PlannedAction,
    input: string
): Promise<ReadingCheck> {
    const takingFromThem = readsAsTaking(fromModel);

    // THE OTHER AXIS, AND IT HAS TO BE ASKED BEFORE THE CHEAP EXIT
    const droppedTheObject = theObjectWasDropped(fromModel, input);
    if (droppedTheObject) return droppedTheObject;

    // Both asked before the cheap exit and for the reason it gives: the exit
    // waves through anything free, and both of these live entirely on that
    // side of it. `market`, `destinations` and `unclear` are all free, and
    // being free is not the same as being right.
    const meantTheUnclear = theTableAnsweredItOnPurpose(fromModel, input);
    if (meantTheUnclear) return meantTheUnclear;

    const spentInsteadOfEarned = await earningIsNotSpending(fromModel, input);
    if (spentInsteadOfEarned) return spentInsteadOfEarned;

    // The identity axis, asked with the other two and before the cheap exit,
    // because `sect` is on neither cost list and the exit would wave it through.
    const putsThemInAHouse = changesWhoYouAre(fromModel);

    if (!spendsMoreThanASentence(fromModel.action) && !takingFromThem && !putsThemInAHouse) {
        return { action: fromModel, declined: null, tierFailure: null };
    }

    const withoutAModel = await readTheSentence(input);

    // GIVING AND TAKING ARE NEVER EACH OTHER'S FALLBACK
    if (takingFromThem && readsAsGiving(withoutAModel.action)) {
        return {
            action: withoutAModel.action,
            declined:
                `the model read this as taking from them (${labelFor(fromModel)}); reading the `
                + 'same sentence without a model reaches giving to them. Those are opposite acts - '
                + 'one opens a favour and the other opens a grudge and a reprisal - and a model '
                + 'may not turn one into the other. '
                + 'Say it plainly - "I steal from him" - to mean the taking.',
            tierFailure: withoutAModel.tierFailure
        };
    }

    // A MODEL MAY NOT BE THE REASON SOMEBODY JOINED A HOUSE
    if (putsThemInAHouse && !changesWhoYouAre(withoutAModel.action)) {
        return {
            action: withoutAModel.action,
            declined:
                `the model read this as joining a house (${labelFor(fromModel)}); reading the same `
                + 'sentence without a model does not put anybody on a roll. Being taken on changes '
                + 'what you are and what every house in the world reads off you, and a model may '
                + 'not be the reason it happened. '
                + 'Say it plainly - "I join the Azure Dew Sect" - to mean it.',
            tierFailure: withoutAModel.tierFailure
        };
    }

    if (!spendsMoreThanASentence(fromModel.action)) {
        return { action: fromModel, declined: null, tierFailure: withoutAModel.tierFailure };
    }
    if (spendsMoreThanASentence(withoutAModel.action.action)) {
        return { action: fromModel, declined: null, tierFailure: withoutAModel.tierFailure };
    }

    // The deterministic side read nothing rather than something cheaper, and a
    // second reader agrees with the model about what the sentence says. Two
    // readers agreeing is not a model inventing an act, which is the only thing
    // this guard was ever for. See `theSentenceSaysSoToo`.
    if (
        withoutAModel.action.action === FALLBACK_ACTION
        && await theSentenceSaysSoToo(input, fromModel.action)
    ) {
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
 * Whether the sentence itself carries the reading the model gave it.
 */
async function theSentenceSaysSoToo(input: string, chosen: ActionName): Promise<boolean> {
    try {
        const nearest = await nearestVerbByMeaning(input);
        return nearest !== null && nearest.action === chosen;
    } catch {
        // The tier throws rather than degrading, and here that is survivable:
        // no corroboration is available, so there is none, and the guard below
        // declines exactly as it did before this existed.
        return false;
    }
}

/**
 * Open the model before the first turn asks for it.
 */
export function openTheSentenceModel(): Promise<void> {
    return readyTheTier();
}

export interface NarratorScene {
    place: string;
    ambient: AmbientQi;
    /**
     * Every person, faction and place this cultivator has heard of.
     */
    awareness?: readonly AwarenessRow[];
    /**
     * A name the engine has decided somebody says in this scene, if any.
     */
    hearing?: Hearing | null;
    /**
     * What the player literally typed.
     */
    playerSaid?: string | null;
    /**
     * What the engine actually filed this turn, for the output-side check.
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
     */
    plan(input: string, stateSummary: string, lastTurn?: string | null): Promise<PlanWithSteps>;
    narrate(facts: EngineFacts, scene: NarratorScene): Promise<Narration>;
}

// THE OTHER SIDE OF THE WALL

/**
 * What the engine actually filed for this turn.
 */
export interface FiledOutcome {
    /** Ranks the engine granted. Zero, absent and null all mean none. */
    ranksGained?: number;
    /** Whether the engine resolved a breakthrough ATTEMPT at all, either way. */
    breakthroughAttempted?: boolean;
    /** Whether the run is over. */
    died?: boolean;
    /**
     * The name of the cultivator whose run this is.
     */
    who?: string;
}

export interface NarrationViolation {
    kind: 'invented_breakthrough' | 'invented_death';
    detail: string;
}

/** Prose that claims a rank was gained. */
const CLAIMS_ADVANCEMENT =
    /\b(?:breakthrough succeeded|broke through(?! (?:to nothing|and failed))|broken through|advanced to|rose to|ascended to|stepped up to|climbed to|attained|reached)\b[^.!?]{0,60}\b(?:layer|rank|realm|stage|condensation|foundation|core|nascent|deity|void|tribulation)\b/i;

/**
 * Ways of saying somebody died, without the somebody.
 *
 * The subject is supplied by {@link claimsThePlayerDied} and is the whole of
 * what makes this safe to use - see there.
 */
const DIED_PREDICATE =
    '(?:is|are|was|were)\\s+dead|died|(?:is|are|was|were)\\s+killed|did\\s+not\\s+survive'
    + '|will\\s+not\\s+wake|breathed?\\s+(?:his|her|their|your)\\s+last';

function forRegExp(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Prose that says THE PERSON WHOSE RUN THIS IS died.
 */
function claimsThePlayerDied(text: string, who: string | undefined): boolean {
    // Unambiguous whoever is named: a run is the player's and nobody else's.
    if (/\bthe run is over\b/i.test(text)) return true;

    const subjects = ['you', ...(who && who.trim() ? [forRegExp(who.trim())] : [])];
    return new RegExp(`\\b(?:${subjects.join('|')})\\s+(?:${DIED_PREDICATE})`, 'i').test(text);
}

/**
 * Compare prose against the engine's account.
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

    if (filed.died !== true && claimsThePlayerDied(text, filed.who)) {
        found.push({
            kind: 'invented_death',
            detail: 'prose reports the death of the cultivator whose run this is; the engine did not record one'
        });
    }

    return found;
}

/**
 * What the player is told when a narration was thrown away.
 */
export const THE_NARRATION_WAS_DISCARDED =
    'The account written for this turn described something that did not happen, '
    + 'so what is above is the engine\'s own record of it instead.';

/**
 * Put back anything the narrator left out that a player cannot play without.
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

    /**
     * ONE READING OF THE SENTENCE, AND THEN THE SENTENCE'S OWN CLAUSES.
     *
     * The table answers with one verb, so "I go to Cold Peak and gather herbs"
     * came back as a single act - and `theWholeSentenceAsAPlan`, which exists
     * to put back the clauses a reader did not answer, was only ever called on
     * the model path. The consequence was worse than under-reading: the one
     * verb the table returned was the LAST clause's, so the sentence ran the
     * gathering, dropped the journey, and said so afterwards.
     *
     * The design owner: *this needs to be two steps without an LLM.* It also
     * settles what happens next, and it is not this layer's problem to solve:
     * *asking is okay cuz an embedding can't tell, that's too hard and would
     * make it too brittle.* Two steps is the answer here. Which of them comes
     * first is `whatThisTurnMayRun`'s question, and where the sentence does not
     * say, asking the player is the honest end of it.
     */
    async plan(input: string): Promise<PlanWithSteps> {
        const read = await readTheSentence(input);
        const note = read.tierFailure ? `${this.note}; ${read.tierFailure}` : this.note;
        const whole = await theWholeSentenceAsAPlan(
            input,
            [{ action: read.action }],
            async clause => (await readTheSentence(clause)).action
        );

        return whole.steps.length > 1
            ? { action: read.action, source: 'fallback', steps: whole.steps, note }
            : { action: read.action, source: 'fallback', note };
    }

    /**
     * The engine's own account, plus anything a caller marked required.
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

/**
 * The phase-1 completion budget, and it is sized by the plan rule rather than
 * guessed.
 */
export const ENOUGH_ROOM_FOR_A_WHOLE_PLAN = 1200;


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
        this.maxIntentTokens = options.maxIntentTokens ?? ENOUGH_ROOM_FOR_A_WHOLE_PLAN;
        this.maxNarrationTokens = options.maxNarrationTokens ?? 800;
    }

    /**
     * Phase 1. The return type is `Plan`, never a throw: every path out of here
     * is a legal action, because a player mid-run must not be blocked by an
     * unreachable inference server.
     */
    async plan(
        input: string,
        stateSummary: string,
        lastTurn?: string | null
    ): Promise<PlanWithSteps> {
        let text: string;
        try {
            const result = await this.provider.call({
                model: this.options.model,
                temperature: this.intentTemperature,
                maxTokens: this.maxIntentTokens,
                signal: AbortSignal.timeout(this.timeoutMs),
                messages: [
                    { role: 'system', content: INTENT_SYSTEM_PROMPT },
                    { role: 'user', content: composeIntentUser(input, stateSummary, lastTurn) }
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
            return await this.aPlanRatherThanAVerb(
                asSteps,
                input,
                theReaderSaysItDecidedTheOrder(raw),
                whyTheReaderSaysTheOrderCannotWork(raw)
            );
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
     */
    private async aPlanRatherThanAVerb(
        fromTheReader: readonly PlanStep[],
        input: string,
        /** Whether the reader said it worked the order out. Carried, never inferred. */
        orderDecided = false,
        /** The reader's objection to the order, where it made one. */
        orderMakesNoSense: string | null = null
    ): Promise<PlanWithSteps> {
        // THE SENTENCE SAYS HOW MANY ACTS ARE IN IT
        const whole = await theWholeSentenceAsAPlan(
            input, fromTheReader, async clause => (await readTheSentence(clause)).action
        );
        const steps = whole.steps;

        const checked: PlanStep[] = [];
        const declined: string[] = [];
        const dropped: PlanStep[] = [];
        let tierFailure: string | null = null;

        for (const step of steps) {
            if (!spendsSomething(step)) {
                checked.push(step);
                continue;
            }

            // THE SAME WORDS, AND FOR A PLAN THAT MEANS A CLAUSE
            if (whole.backfilled.includes(step)) {
                checked.push(step);
                continue;
            }

            const quoted = theClauseThisStepQuotes(step, input);
            const verdict = await theModelIsNotWhyThisTurnIsDangerous(
                step.action, quoted ?? input
            );
            tierFailure = verdict.tierFailure ?? tierFailure;

            if (verdict.declined === null) {
                checked.push({ action: verdict.action, said: step.said });
                continue;
            }

            if (quoted === null && await anyClauseReadsAsThisVerb(
                input, step.action.action, async clause => (await readTheSentence(clause)).action.action
            )) {
                // The player's own words reach this verb somewhere in the
                // sentence, so the model is not why the turn can cost them.
                checked.push(step);
                continue;
            }

            // A DECLINED STEP IS DROPPED, NEVER SUBSTITUTED
            declined.push(verdict.declined);
            dropped.push(step);
        }

        // Every step declined. The turn still has to be a turn, so it falls all
        // the way back to the one reading a player with no model would have
        // got - the same degradation every other model failure in this class
        // takes, and the dropped clauses are still named below.
        if (checked.length === 0) {
            const withoutAModel = await readTheSentence(input);
            return {
                action: withoutAModel.action,
                droppedClauses: dropped,
                source: 'fallback',
                note: withTheTierFailure(
                    ['every step of the plan was declined; read without a model instead.',
                        ...declined].join(' '),
                    withoutAModel.tierFailure ?? tierFailure
                )
            };
        }

        // AND THE CLAUSES THE READER NEVER TURNED INTO A STEP AT ALL.
        //
        // Found by playing: on one turn the model split the owner's sentence
        // into two steps and simply left the middle clause out, and nothing
        // downstream could know it had existed. Checked against the player's own
        // text rather than against what the model said about it.
        dropped.push(...await theClausesNoStepAccountsFor(
            input, checked, async clause => (await readTheSentence(clause)).action
        ));

        const costly = checked.filter(spendsSomething);
        const headline = (costly.length === 1 ? costly[0] : checked[0])!;

        const note = [
            `read as a plan of ${checked.length}: `
            + checked.map(step => step.action.action).join(' -> ')
            + '. Resolved in order, each against the world the one before it left.',
            // Said out loud, because a step nobody sent is exactly the kind of
            // reading AGENTS.md asks to be shown: the player can see that their
            // sentence put an act back that the reader had not. How the sentence
            // was split, and what became of every clause - including the ones
            // nothing was done about, because a clause that vanishes without saying
            // why is the defect this whole layer exists to remove, and it cost a
            // played round trip to find once already.
            `The reader answered with ${fromTheReader.length}. Clause by clause: `
            + whole.why.join('; ') + '.',
            ...declined
        ].join(' ');

        return {
            action: headline.action,
            steps: checked,
            droppedClauses: dropped,
            // Only where the reader answered every clause it was given. A plan
            // the engine had to backfill is not an order anybody worked out.
            orderDecided: orderDecided && dropped.length === 0,
            ...(orderMakesNoSense === null ? {} : { orderMakesNoSense }),
            // `model` when nothing was declined, because the model chose every
            // verb that ran; `fallback` when something was, because at least one
            // of them is the reading the player would have got with no model.
            source: declined.length === 0 ? 'model' : 'fallback',
            note: withTheTierFailure(note, tierFailure)
        };
    }

    /**
     * Phase 1 with no model in it, wearing whatever note said why.
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

            // the output-side gate
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
