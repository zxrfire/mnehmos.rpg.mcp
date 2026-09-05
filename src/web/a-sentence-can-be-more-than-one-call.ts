/**
 * A player says one sentence containing a plan, and the turn carries it out.
 */

import {
    ACTION_NAMES,
    TARGETED_ACTIONS,
    carryWhatOnlyTheSentenceKnows,
    costsTheAskerNothing,
    validatePlan,
    type ActionName,
    type Plan,
    type PlannedAction
} from './actions.js';
import type { EngineFacts } from './facts.js';

// ─────────────────────────────────────────────────────────────────────────
// A STEP
// ─────────────────────────────────────────────────────────────────────────

/**
 * One call in a plan, with the words the player used for it.
 */
export interface PlanStep {
    readonly action: PlannedAction;
    readonly said?: string;
    /**
     * This step CHOOSES from what the step before it found; it does not act.
     */
    readonly selects?: ASelection;
}

/**
 * A `Plan` that may carry more than one call.
 */
export interface PlanWithSteps extends Plan {
    /**
     * Every call, in the order the reader put them. Absent means one call.
     */
    readonly steps?: readonly PlanStep[];
    /**
     * Steps the reading layer declined and removed, in the player's own words.
     */
    readonly droppedClauses?: readonly PlanStep[];
}

/**
 * The steps of a plan, whether or not it has any.
 */
export function stepsOfThePlan(plan: PlanWithSteps): readonly PlanStep[] {
    const steps = plan.steps ?? [];
    return steps.length > 0 ? steps : [{ action: plan.action }];
}

/**
 * How many engine calls one sentence may make.
 */
export const MOST_CALLS_IN_ONE_TURN = 6;

/** Whether this step spends a day, the purse or the body. */
export function spendsSomething(step: PlanStep): boolean {
    // A CHOICE IS NEVER AN ACT. Structural rather than a classification
    // somebody has to remember: picking a person out of a group takes nothing
    // from anybody, and a played turn that priced one as a verb turned a
    // three-clause sentence into a question about a choice that spends nothing.
    if (step.selects) return false;
    return !costsTheAskerNothing(step.action);
}

// ─────────────────────────────────────────────────────────────────────────
// READING A SEQUENCE OUT OF A MODEL RESPONSE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The steps in a phase-1 response, or null if there is no sequence in it.
 */
export function stepsInTheResponse(raw: unknown, input: string): PlanStep[] | null {
    const list = arrayOfSteps(raw);
    if (list === null) return null;

    const steps: PlanStep[] = [];
    for (const entry of list.slice(0, MOST_CALLS_IN_ONE_TURN * 2)) {
        const validated = validatePlan(entry);
        if (!validated.ok) continue;
        steps.push({
            action: carryWhatOnlyTheSentenceKnows(validated.action, input),
            said: theWordsThisStepCameFrom(entry)
        });
    }
    return steps;
}



function arrayOfSteps(raw: unknown): unknown[] | null {
    if (Array.isArray(raw)) return raw;
    if (raw === null || typeof raw !== 'object') return null;
    const steps = (raw as { steps?: unknown }).steps;
    return Array.isArray(steps) ? steps : null;
}

/**
 * The fragment of the player's sentence a step came from, bounded and stripped.
 */
function theWordsThisStepCameFrom(entry: unknown): string | undefined {
    if (entry === null || typeof entry !== 'object') return undefined;
    const said = (entry as { said?: unknown }).said;
    if (typeof said !== 'string') return undefined;
    const clean = said
        .replace(/[^\p{L}\p{N} ',.-]+/gu, ' ')
        .replace(/\s+/g, ' ')
        // A model splitting a sentence at its conjunctions hands back fragments
        // beginning "and", "then", "before". Quoted or set at the head of a
        // sentence those read as a stutter - "and and check myself over" - and
        // the conjunction was never part of the act in any case.
        .replace(/^(?:and|then|after that|before that|next|finally|also|but|so)\b[ ,]*/i, '')
        .trim()
        .slice(0, 60);
    return clean.length > 0 ? clean : undefined;
}

/**
 * The player's own words for this step, but only if they really are the player's
 * own words.
 */
export function theClauseThisStepQuotes(step: PlanStep, input: string): string | null {
    const said = (step.said ?? '').trim();
    if (said.length === 0) return null;
    const clause = forMatching(said);
    if (clause.split(' ').length < 2) return null;
    return forMatching(input).includes(clause) ? said : null;
}

function forMatching(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * The player's sentence, cut where a person would cut it.
 */
export function theClausesOf(input: string): string[] {
    return input
        .split(/,|;|\band then\b|\bthen\b|\band\b|\bafter that\b|\bbefore that\b|\bafterwards\b/i)
        .map(part => part.trim())
        .filter(part => part.split(/\s+/).filter(Boolean).length >= 2)
        .filter(part => !thisFragmentModifiesTheActBesideIt(part));
}

/**
 * A fragment that qualifies the act next to it rather than naming one.
 *
 * Latent until the deterministic tier started composing sentences: the model
 * path anchors every step to the words it quoted, so a mis-split was corrected
 * by the alignment, and without a model there are no quotes to align to.
 * Measured on played tests the moment it was turned on -
 *
 *     "I stand guard while Shen Liefeng crosses, for a hundred days"
 *     "By order of the Sect, the disciples are to gather herbs"
 *
 * - where the trailing span became a request for seclusion, because a bare
 * duration IS one, and the leading authority became an act of its own. Both
 * halves belong to the clause beside them, and neither has a verb in it.
 */
function thisFragmentModifiesTheActBesideIt(part: string): boolean {
    return HOW_LONG_THE_ACT_RUNS.test(part) || ON_WHOSE_AUTHORITY.test(part);
}

/** How long the act beside it runs. "for a hundred days", "over three years". */
const HOW_LONG_THE_ACT_RUNS =
    /^(?:for|over|across|during|lasting)\s+(?:the\s+)?(?:next\s+)?[\w\s-]{1,32}$/i;

/** Whose authority the act beside it is on. "By order of the Sect". */
const ON_WHOSE_AUTHORITY =
    /^(?:by\s+(?:order|command|decree|authority|leave)\s+of|on\s+the\s+authority\s+of|in\s+the\s+name\s+of)\b/i;

/**
 * Whether ANY clause of the player's own sentence reads as this verb.
 */
/**
 * Clauses of the player's sentence that no step of the plan accounts for.
 */
export async function theClausesNoStepAccountsFor(
    input: string,
    steps: readonly PlanStep[],
    read: (clause: string) => Promise<PlannedAction>
): Promise<PlanStep[]> {
    const carried = new Set(steps.map(step => step.action.action));
    const lost: PlanStep[] = [];

    for (const clause of theClausesOf(input)) {
        // A clause that only CHOOSES is answered by a choice, not by a verb, so
        // it is never lost and must never be reported as lost. Without this the
        // superseded reader step came back to the player as "the reading layer
        // declined gather" - naming the herb verb, over a clause that picks a
        // person, on a turn where the picking had in fact happened.
        if (theSelectionInThisClause(clause) !== null) continue;
        // THE WHOLE READING, NOT THE BARE VERB. This took an ActionName and
        // rebuilt a plan from it, which threw the intent away - and `interact`
        // with no intent is FREE, while `interact` with `steal` is not. So a
        // lost theft, the exact clause this was written for, priced itself as a
        // free read and was never reported. `costsTheAskerNothing` is a fact
        // about a plan, and it has to be given one.
        const reading = await read(clause);
        if (reading.action === 'unclear' || carried.has(reading.action)) continue;
        if (costsTheAskerNothing(reading)) continue;
        carried.add(reading.action);
        lost.push({ action: reading, said: clause });
    }
    return lost;
}

/**
 * The player's whole sentence as a plan, with any act the reader missed put back in
 * the position they wrote it.
 */
export interface TheSentenceAsAPlan {
    steps: PlanStep[];
    backfilled: PlanStep[];
    /**
     * What happened to each clause, in the player's own words.
     */
    why: string[];
}

export async function theWholeSentenceAsAPlan(
    input: string,
    fromTheReader: readonly PlanStep[],
    read: (clause: string) => Promise<PlannedAction>
): Promise<TheSentenceAsAPlan> {
    const clauses = theClausesOf(input);
    if (clauses.length < 2) {
        return {
            steps: [...fromTheReader],
            backfilled: [],
            why: [`one clause, so there is nothing to compose: "${input.slice(0, 60)}"`]
        };
    }

    const readings = await Promise.all(clauses.map(read));

    // A CLAUSE THAT CHOOSES IS A CHOICE, WHATEVER ANYBODY READ IT AS
    const chooses = clauses.map(theSelectionInThisClause);

    // Which clause each of the reader's steps is answering. `said` when it
    // quoted the player; otherwise the first clause not yet spoken for whose
    // own reading reaches the same verb.
    const spokenFor = new Set<number>();
    const positionOf = fromTheReader.map(step => {
        // A quotation claims its clause only when the two READINGS agree.
        const quoted = theClauseThisStepQuotes(step, input);
        if (quoted !== null) {
            const at = clauses.findIndex((clause, i) =>
                !spokenFor.has(i)
                // A clause that only CHOOSES is never claimed, however the
                // reader labelled it and whatever the table calls it. Played:
                // "pick the strongest one" reads as `gather` to the table, so a
                // reader step carrying `gather` and quoting that clause AGREED
                // with it and claimed it - and the choice was priced as a
                // seven-day herb gathering.
                && chooses[i] === null
                && forMatching(clause) === forMatching(quoted)
                && readings[i]!.action === step.action.action);
            if (at !== -1) { spokenFor.add(at); return at; }
        }
        const at = readings.findIndex(
            (reading, i) =>
                !spokenFor.has(i) && chooses[i] === null && reading.action === step.action.action
        );
        if (at !== -1) { spokenFor.add(at); return at; }
        return null;
    });

    const steps: PlanStep[] = [];
    const backfilled: PlanStep[] = [];
    const superseded: PlanStep[] = [];
    const why: string[] = clauses.map((clause, at) => {
        const answering = positionOf.indexOf(at);
        return `"${clause}" reads as ${readings[at]!.action}`
            + `${readings[at]!.target ? `(${readings[at]!.target})` : ''}`
            + `${costsTheAskerNothing(readings[at]!) ? ', free' : ', costly'}`
            + (answering === -1
                ? `; no step of the reader's is answering it`
                : `; the reader's step ${answering + 1} (${
                    fromTheReader[answering]!.action.action}) is answering it`);
    });

    /** Costly clauses nobody is answering, from `from` up to but not including `to`. */
    const fillBetween = (from: number, to: number): void => {
        for (let at = from; at < to; at++) {
            if (spokenFor.has(at)) continue;
            const reading = readings[at]!;
            // Every reason a clause is passed over is SAID. A silent `continue`
            // here is a clause vanishing, which is the thing this whole file
            // exists to stop happening one layer up.
            const choice = chooses[at]!;
            if (choice !== null) {
                // Always, and free. A choice the player wrote is a choice
                // whether or not making it costs anything, so there is no cost
                // guard on this branch - the guard exists to stop a FREE READ
                // being re-run, and a choice is not a read of the world.
                const picking: PlanStep = {
                    action: { action: 'look' }, said: clauses[at]!, selects: choice
                };
                spokenFor.add(at);
                backfilled.push(picking);
                steps.push(picking);
                why[at] += `; taken as a CHOICE of the ${choice.word} out of what the clause `
                    + 'before it found, which takes nothing from anybody';
                continue;
            }
            if (reading.action === 'unclear') {
                why[at] += '; not put back - nothing reads it';
                continue;
            }
            if (costsTheAskerNothing(reading)) {
                // A FREE CLAUSE IS PUT BACK ONLY WHERE THE READER PLAINLY
                // UNDER-SPLIT
                if (fromTheReader.length >= clauses.length) {
                    why[at] += '; not put back - it costs nothing, and the reader answered '
                        + 'every clause, so nothing was lost';
                    continue;
                }
                spokenFor.add(at);
                const free = { action: reading, said: clauses[at]! };
                backfilled.push(free);
                steps.push(free);
                why[at] += '; PUT BACK from the sentence itself - it costs nothing, and the '
                    + 'reader answered fewer acts than the sentence has clauses';
                continue;
            }
            // A CLAUSE THAT READS AS A VERB ALREADY IN THE PLAN IS THE SAME
            // ACT SAID TWICE. "I go back to the carriage and finish it" is one
            // build in two clauses - the craft verb owns both `go back to` and
            // `finish` - and putting the second half back made a sentence that
            // finishes a carriage into a question about which half to do first.
            // `theSameClause` catches this where two steps QUOTE overlapping
            // words; a backfilled clause quotes nothing the reader wrote, so
            // the verb is what is left to compare.
            if (fromTheReader.some(step => step.action.action === reading.action)) {
                why[at] += `; not put back - the reader already answered ${reading.action}, `
                    + 'and one verb over two clauses of one sentence is one act said twice';
                continue;
            }
            spokenFor.add(at);
            const put = { action: reading, said: clauses[at]! };
            backfilled.push(put);
            steps.push(put);
            why[at] += '; PUT BACK from the sentence itself';
        }
    };

    let next = 0;
    fromTheReader.forEach((step, i) => {
        const at = positionOf[i];
        if (at !== null && at >= next) {
            fillBetween(next, at);
            next = at + 1;
        }
        // A STEP KEEPS THE PLAYER'S WORDS EVEN WHERE THE READER SENT NONE.
        if (at === null && theClauseThisStepAnswersIsAChoice(step, clauses, chooses, input)) {
            superseded.push(step);
            return;
        }
        steps.push(at !== null && step.said === undefined
            ? { ...step, said: clauses[at]! }
            : step);
    });
    fillBetween(next, clauses.length);

    for (const [at, place] of positionOf.entries()) {
        if (place === null) {
            why.push(`the reader's step ${at + 1} (${fromTheReader[at]!.action.action}`
                + `${fromTheReader[at]!.action.target ? `/${fromTheReader[at]!.action.target}` : ''}`
                + ') answers no clause of the sentence, and was kept in the order it was sent');
        }
    }

    for (const step of superseded) {
        why.push(`the reader's ${step.action.action}`
            + `${step.action.target ? `(${step.action.target})` : '()'}`
            + ' was answering a clause that only CHOOSES, so it was superseded by the choice '
            + 'and never priced as an act');
    }

    return { steps, backfilled, why };
}

/**
 * Whether a step the reader sent was really answering a clause that only chooses.
 */
function theClauseThisStepAnswersIsAChoice(
    step: PlanStep,
    clauses: readonly string[],
    chooses: ReadonlyArray<ASelection | null>,
    input: string
): boolean {
    const words = [theClauseThisStepQuotes(step, input), step.action.target]
        .filter((it): it is string => typeof it === 'string' && it.trim().length > 0)
        .map(forMatching);
    if (words.length === 0) return false;

    return clauses.some((clause, at) => {
        if (chooses[at] === null) return false;
        const whole = forMatching(clause);
        return words.some(word => whole.includes(word) || word.includes(whole));
    });
}

export async function anyClauseReadsAsThisVerb(
    input: string,
    verb: ActionName,
    read: (clause: string) => Promise<ActionName>
): Promise<boolean> {
    for (const clause of theClausesOf(input)) {
        if (await read(clause) === verb) return true;
    }
    return false;
}

// ─────────────────────────────────────────────────────────────────────────
// PICKING ONE OUT OF WHAT THE LAST STEP FOUND
// ─────────────────────────────────────────────────────────────────────────

/**
 * A clause that CHOOSES from what the clause before it returned.
 */
export interface ASelection {
    /** Which field of the rows is being compared. */
    readonly field: 'rung' | 'age' | 'distance' | 'price' | 'ambient';
    /** Which end of it the player asked for. */
    readonly want: 'most' | 'least';
    /** The player's own word, for saying who was picked and why. */
    readonly word: string;
}

/**
 * The superlatives, and the field each one names.
 */
/** The words a place's ground goes by, on a row or in a sentence. */
const GROUND = '(?:air|qi|ground|vein|veins|energy)';

/**
 * Ground asked for at its best, however the comparison is phrased.
 */
const GROUND_COMPARED_UPWARD = new RegExp(
    `\\b(?:thickest|richest|densest|deepest|strongest|best|finest|most)\\b[^.!?]{0,20}\\b${GROUND}\\b`
    + `|\\b${GROUND}\\b[^.!?]{0,24}\\b(?:thickest|richest|densest|deepest|strongest|best|finest|thick|thicker|rich|richer|dense|denser|deep|deeper|strong|stronger)\\b`,
    'i'
);

/** And at its worst, which somebody asks for far less often but does ask. */
const GROUND_COMPARED_DOWNWARD = new RegExp(
    `\\b(?:thinnest|poorest|emptiest|worst)\\b[^.!?]{0,20}\\b${GROUND}\\b`
    + `|\\b${GROUND}\\b[^.!?]{0,24}\\b(?:thinnest|poorest|emptiest|worst)\\b`,
    'i'
);

/**
 * A clause pointing back at the set the clause before it produced.
 */
const POINTING_AT_THE_LAST_SET =
    /\b(?:whichever|whoever|whatever)\b|\b(?:of|among|from|out of)\s+(?:them|these|those|the list|the ones)\b|\bone of them\b/i;

/** The frames in which a PLACE is asked for by what it is like, not by name. */
const SOMEWHERE_RATHER_THAN_A_NAME =
    /\b(?:somewhere|anywhere|a place|some place|someplace|a province|a town|wherever|where the|where it is)\b/i;

const WHAT_A_SUPERLATIVE_NAMES: ReadonlyArray<[RegExp, ASelection['field'], ASelection['want']]> = [
    [/\b(?:strongest|toughest|mightiest|deepest|highest|most powerful|most dangerous)\b/i, 'rung', 'most'],
    [/\b(?:weakest|lowest|least powerful|softest|most harmless)\b/i, 'rung', 'least'],
    [/\b(?:oldest|eldest)\b/i, 'age', 'most'],
    [/\b(?:youngest)\b/i, 'age', 'least'],
    [/\b(?:nearest|closest)\b/i, 'distance', 'least'],
    [/\b(?:furthest|farthest)\b/i, 'distance', 'most'],
    [/\b(?:cheapest|least expensive)\b/i, 'price', 'least'],
    [/\b(?:dearest|priciest|most expensive)\b/i, 'price', 'most'],
    // GROUND, the fifth field, and the one with rows in hand on a turn where the
    // player has just asked where they could go. Every place carries an `ambient`
    // band and the read prints it on every row - "a spirit tide, triple rate",
    // "thin qi, half rate" - so this is `pick the strongest one` with the field
    // being ground instead of rung.
    [GROUND_COMPARED_UPWARD, 'ambient', 'most'],
    [GROUND_COMPARED_DOWNWARD, 'ambient', 'least']
];

/**
 * The frames in which a superlative is a CHOICE rather than a description.
 */
const CHOOSING_RATHER_THAN_DOING =
    /\b(?:pick|picks|picking|choose|chooses|choosing|chose|select|selects|selecting|single out|singles out|settle on|settles on|go for|goes for|find|finds|identify|identifies|work out|works out|decide on|whichever|whoever)\b/i;

/** The selection a clause makes, or null when it is not making one. */
export function theSelectionInThisClause(clause: string): ASelection | null {
    const comparison = theComparisonIn(clause);
    if (comparison === null) return null;

    // A comparison is only a CHOICE inside a frame that says one is being made.
    // Three of them, and the first is the strongest: the player pointing at the
    // set, a verb that chooses, or a place asked for by what it is like. Without
    // this, "I attack the strongest one" would become a free selection step and
    // the act in it would be lost - the defect this file exists to prevent,
    // caused by the fix for it.
    return POINTING_AT_THE_LAST_SET.test(clause)
        || CHOOSING_RATHER_THAN_DOING.test(clause)
        || (comparison.field === 'ambient' && SOMEWHERE_RATHER_THAN_A_NAME.test(clause))
        ? comparison
        : null;
}

/** The comparison a clause makes, and the field it names, or null. */
function theComparisonIn(clause: string): ASelection | null {
    for (const [pattern, field, want] of WHAT_A_SUPERLATIVE_NAMES) {
        const found = pattern.exec(clause);
        if (found) {
            return { field, want, word: found[0].toLowerCase().replace(/\s+/g, ' ').trim() };
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT "IT" MEANS IN THE THIRD CLAUSE
// ─────────────────────────────────────────────────────────────────────────

/**
 * A pronoun that means whatever the clause before it was about.
 */
const A_PRONOUN_FOR_THE_LAST_THING: ReadonlySet<string> = new Set([
    'it', 'them', 'that', 'those', 'this', 'these', 'the same', 'the thing', 'the same thing'
]);

/**
 * What a reader writes when it knows a target is coming and has no name yet.
 */
const A_PLACEHOLDER_FOR_WHOEVER_WAS_CHOSEN: ReadonlySet<string> = new Set([
    'unnamed cultivator', 'the unnamed cultivator', 'that person', 'the person',
    'whoever', 'whoever it is', 'the chosen one', 'the one'
]);

function standsForTheLastThing(value: string | undefined): boolean {
    if (value === undefined) return false;
    const plain = forMatching(value);
    return A_PRONOUN_FOR_THE_LAST_THING.has(plain)
        || A_PLACEHOLDER_FOR_WHOEVER_WAS_CHOSEN.has(plain)
        // "the strongest one", where a clause before it already chose them.
        || aSuperlativeWithNoNounOnIt(plain);
}

/**
 * A superlative standing on its own, as in "the strongest one".
 */
function aSuperlativeWithNoNounOnIt(plain: string): boolean {
    for (const [pattern] of WHAT_A_SUPERLATIVE_NAMES) {
        const found = pattern.exec(plain);
        if (!found) continue;
        const rest = (plain.slice(0, found.index) + plain.slice(found.index + found[0].length))
            .replace(/\s+/g, ' ').trim();
        if (/^(?:the |a |an )?(?:one|ones|of them|of these|of those)?$/.test(rest)) {
            return true;
        }
    }
    return false;
}

/**
 * The thing a step's own clause was about, for the next step to refer to.
 */
export function theThingThisStepNamed(step: PlanStep): string | null {
    // A READ THAT POINTS AT NOTHING NAMES NOTHING. "I look over who is here"
    // is a read of the room rather than of a thing, and taking its clause apart
    // yielded the phrase "over who is here", which then stood in for every
    // later pronoun in the sentence. An act still names its object even where
    // the step carries no target - "buy the cheapest manual" names a manual -
    // so the guard is on the free, untargeted read and nothing wider.
    if (!spendsSomething(step)
        && step.action.target === undefined
        && step.action.topic === undefined) {
        return null;
    }

    const said = (step.said ?? '').trim();
    if (said.length === 0) return null;

    const words = said.split(/\s+/).filter(Boolean);
    // "I take ...", "then press ..." - drop a leading subject or connective, and
    // then the verb itself.
    let at = 0;
    while (at < words.length && /^(?:i|i'?ll|then|and|so|next|also|first|finally)$/i.test(words[at]!)) at++;
    at++;

    const rest = words.slice(at).join(' ').replace(/^(?:the|a|an|my|his|her|their)\s+/i, '').trim();
    if (rest.length === 0 || standsForTheLastThing(rest)) return null;
    return rest;
}

/**
 * The same step with any bare pronoun replaced by what the last one named.
 */
export function carryingTheReferentForward(step: PlanStep, lastThing: string | null): PlanStep {
    if (lastThing === null) return step;

    const action = { ...step.action };
    let changed = false;
    if (standsForTheLastThing(action.target)) { action.target = lastThing; changed = true; }
    if (standsForTheLastThing(action.topic)) { action.topic = lastThing; changed = true; }

    // A PRONOUN THE TABLE DROPPED IS STILL A PRONOUN
    if (action.target === undefined
        && TARGETED_ACTIONS.includes(action.action)
        && A_PRONOUN_FOR_SOMEBODY.test(step.said ?? '')) {
        action.target = lastThing;
        changed = true;
    }

    return changed ? { ...step, action } : step;
}

/** A pronoun standing for a person, in the player's own clause. */
const A_PRONOUN_FOR_SOMEBODY = /\b(?:them|him|her|they|that one|the same one)\b/i;

/** The inspector row saying what a pronoun was taken to mean. */
export function theRowForAResolvedPronoun(
    before: PlanStep,
    after: PlanStep
): ToolCallRecordish {
    return {
        name: 'engine.step',
        action: after.action.action,
        summary: `"${before.action.topic ?? before.action.target}" in this clause was taken to `
            + `mean "${after.action.topic ?? after.action.target}", which is what the clause `
            + 'before it was about. The phrase is the player\'s own; whether anything matches '
            + 'it is the resolver\'s answer, not this one.',
        ok: true
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE LAW
// ─────────────────────────────────────────────────────────────────────────

/**
 * What is left over when a turn cannot do everything it understood.
 */
export interface WhichComesFirst {
    readonly runId: string;
    readonly cultivatorId: string;
    /** The turn it was raised on. It answers on the next one and then it is gone. */
    readonly raisedOnTurn: number;
    /** The costly acts, in the order the sentence put them. Always two or more. */
    readonly acts: readonly PlanStep[];
}

/** What this turn is going to do, decided before any of it runs. */
export interface WhatThisTurnMayRun {
    /**
     * The steps to run, IN THE ORDER THE PLAYER SAID THEM.
     */
    readonly toRun: readonly PlanStep[];
    /**
     * The costly acts to ask about. Empty unless there are two or more AND the
     * player did not already say which comes first - see
     * {@link theSentenceSaysItsOwnOrder}.
     */
    readonly askAbout: readonly PlanStep[];
    /**
     * Steps the turn did not reach, whether it stopped to ask or stopped
     * because the turn's one costly act was spent. Named, never dropped.
     */
    readonly heldForTheQuestion: readonly PlanStep[];
    /**
     * Whether the player's own sentence settled the order, so nothing was
     * asked. True means `heldForTheQuestion` is what is left for next turn
     * rather than what a question is about.
     */
    readonly theOrderWasGiven: boolean;
    /** Steps past {@link MOST_CALLS_IN_ONE_TURN}. Named, never silently dropped. */
    readonly overTheBound: readonly PlanStep[];
    /**
     * One clause the reader read twice, and which reading was taken.
     */
    readonly secondReadings: ReadonlyArray<{ taken: PlanStep; alsoRead: PlanStep }>;
    /**
     * Clauses that stated why, and were counted as reasons rather than as acts.
     */
    readonly statedReasons: readonly PlanStep[];
}

/**
 * A clause that states a need rather than naming an act.
 */
const A_STATED_NEED =
    /^\s*(?:(?:and|so|then|but|also)\s+)?(?:i\s+)?(?:really\s+|badly\s+|urgently\s+)?(?:need|want|must|should|ought to|have to|have got to|would like|am going to need)\b\s+\S/i;

/** Whether this step's own clause is phrased as a need rather than as an act. */
export function thisClauseIsAReasonNotAnAct(step: PlanStep): boolean {
    const said = (step.said ?? '').trim();
    return said.length > 0 && A_STATED_NEED.test(said);
}

/**
 * Steps split into the acts and the clauses that merely said why.
 */
function tellingReasonsFromActs(
    steps: readonly PlanStep[]
): { acts: PlanStep[]; reasons: PlanStep[] } {
    const reasons = steps.filter(
        step => spendsSomething(step) && thisClauseIsAReasonNotAnAct(step)
    );
    if (reasons.length === 0) return { acts: [...steps], reasons: [] };

    const survives = steps.some(
        step => spendsSomething(step) && !thisClauseIsAReasonNotAnAct(step)
    );
    if (!survives) return { acts: [...steps], reasons: [] };

    return { acts: steps.filter(step => !reasons.includes(step)), reasons };
}

/**
 * The whole law, as a pure function of the steps.
 */
export function whatThisTurnMayRun(
    steps: readonly PlanStep[],
    input = '',
    /**
     * Whether a READER decided this order, as against the words alone.
     *
     * The design owner, settling which layer answers this:
     *
     *   > this needs to be two steps without an LLM ... but the llm should
     *   > reason what comes first, right? or if the order doesn't matter
     *   > ... asking is okay cuz an embedding can't tell, that's too hard and
     *   > would make it too brittle
     *
     * So the question belongs to whoever can actually answer it. A model was
     * told to answer with one step per act IN THAT ORDER, so a multi-step plan
     * from one is a decision already taken - it either worked out what has to
     * happen first or decided nothing turns on it, and either way it committed.
     * Asking the player to say it again is asking them to redo work that was
     * done. A pattern table cannot reason about order at all, and forcing it to
     * try is the brittleness that ruling warns against, so where the words do
     * not say, it asks.
     */
    theReaderDecidedTheOrder = false
): WhatThisTurnMayRun {
    const withoutDoubleReadings = oneClauseIsOneAct(steps);
    // A CLAUSE THAT SAID WHY IS NOT A SECOND THING TO DO. Before the bound and
    // before the count, because a reason was never one of the turn's calls -
    // "I need to eat, so I take whatever work will feed me" is one act, and a
    // question about which of the two comes first has nothing in it to answer.
    const { acts: withoutReasons, reasons: statedReasons } =
        tellingReasonsFromActs(withoutDoubleReadings.acts);
    const kept = withoutReasons.slice(0, MOST_CALLS_IN_ONE_TURN);
    const overTheBound = withoutReasons.slice(MOST_CALLS_IN_ONE_TURN);
    const secondReadings = withoutDoubleReadings.secondReadings;

    const costly = kept.filter(spendsSomething);
    if (costly.length < 2) {
        return {
            toRun: kept, askAbout: [], heldForTheQuestion: [], overTheBound,
            theOrderWasGiven: false, secondReadings, statedReasons
        };
    }

    const first = kept.findIndex(spendsSomething);

    // THE PLAYER MAY HAVE ALREADY ANSWERED THE QUESTION, or a reader may have
    // answered it for them. See `theReaderDecidedTheOrder`.
    if (theReaderDecidedTheOrder || theOrderIsAlreadySettled(kept, input)) {
        const second = kept.findIndex((step, at) => at > first && spendsSomething(step));
        return {
            toRun: kept.slice(0, second),
            askAbout: [],
            heldForTheQuestion: kept.slice(second),
            overTheBound,
            theOrderWasGiven: true,
            secondReadings,
            statedReasons
        };
    }

    return {
        toRun: kept.slice(0, first),
        askAbout: costly,
        heldForTheQuestion: kept.slice(first),
        overTheBound,
        theOrderWasGiven: false,
        secondReadings,
        statedReasons
    };
}

/**
 * Whether the player's own sentence already says which comes first.
 */
export function theOrderIsAlreadySettled(
    steps: readonly PlanStep[],
    input: string
): boolean {
    if (theSentenceSaysItsOwnOrder(input)) return true;

    // A BACK-REFERENCE FIXES THE ORDER AS FIRMLY AS "THEN" DOES
    return steps.some((step, at) =>
        at > 0
        && (standsForTheLastThing(step.action.topic)
            || standsForTheLastThing(step.action.target)));
}

export function theSentenceSaysItsOwnOrder(input: string): boolean {
    return /\b(?:and then|then|afterwards?|after that|after which|before|first(?:ly)?|next|finally|once (?:i|that|it)|when (?:i|that|it)(?:'s| is| am)? (?:done|finished|over))\b/i.test(input)
        || THE_CLAUSE_THAT_SAYS_WHY.test(input);
}

/**
 * The forms that say what an act is for, and so say what comes after it.
 */
const THE_CLAUSE_THAT_SAYS_WHY =
    /\b(?:until|so (?:i|that i) (?:can|could|have|am)|in order to|so as to|to pay for|to afford|enough (?:for|to)|so (?:i|we)\b|and so\b|because\b|since (?:i|we)\b)/i;

/**
 * COUNT SPANS OF THE SENTENCE, NEVER PATTERN HITS.
 */
function oneClauseIsOneAct(
    steps: readonly PlanStep[]
): { acts: PlanStep[]; secondReadings: Array<{ taken: PlanStep; alsoRead: PlanStep }> } {
    const acts: PlanStep[] = [];
    const secondReadings: Array<{ taken: PlanStep; alsoRead: PlanStep }> = [];

    for (const step of steps) {
        const already = spendsSomething(step)
            ? acts.find(kept => spendsSomething(kept) && theSameClause(kept, step))
            : undefined;
        if (already) secondReadings.push({ taken: already, alsoRead: step });
        else acts.push(step);
    }
    return { acts, secondReadings };
}

function theSameClause(a: PlanStep, b: PlanStep): boolean {
    const said = [a, b].map(step => forMatching(step.said ?? ''));
    if (said[0]!.length > 0 && said[1]!.length > 0) {
        return said[0]!.includes(said[1]!) || said[1]!.includes(said[0]!);
    }
    // No words to go on, so the object decides. Two costly verbs pointed at one
    // thing in one sentence are one act read twice.
    const at = [a, b].map(step => forMatching(step.action.target ?? ''));
    return at[0] === at[1];
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE QUESTION SAYS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What to call one act when asking the player about it.
 */
/**
 * The names that already end in the word that joins them to an object.
 */
const JOINS_TO_AN_OBJECT = /\b(?:to|with|at|on|for|of|into|from)$/i;

/**
 * THE OBJECT FORM, FOR NAMES THAT ARE COMPLETE ON THEIR OWN.
 */
const PLAINLY_WITH_AN_OBJECT: Partial<Record<ActionName, string>> = {
    buy: 'the purchase of',
    sell: 'the sale of',
    hunt: 'the hunt for',
    gather: 'the gathering of',
    refine: 'the refining of',
    craft: 'the building of',
    offer: 'the offering of',
    consume_pill: 'taking',
    learn_technique: 'taking up',
    site: 'going into',
    seal: 'what is under',
    sect: 'the business with',
    propose: 'the match with',
    // 护法. Not "guarding", which is the word the fight layer already owns for
    // a posture inside a round, rather than a span spent standing over
    // somebody else's crossing.
    guard: 'standing over the crossing of'
};

export function whatThisStepIsCalled(step: PlanStep): string {
    const said = (step.said ?? '').trim();
    if (said.length > 0) return said;

    const verb = plainNameOf(step.action.action);
    const at = step.action.target?.trim();
    // "the journey to away" - a direction is not a destination, and gluing the
    // two together makes the question read like a template rather than like
    // somebody talking. Played, and it is what the player was offered.
    if (at !== undefined && /^(?:away|off|out|elsewhere|somewhere else)$/i.test(at)) {
        return step.action.action === 'move' ? 'walking away' : `${verb} away`;
    }
    if (!at) return verb;
    // A name written to take an object takes it. One that is complete on its
    // own gets its object form, and one with neither stands alone rather than
    // being glued to a noun it does not join to.
    if (JOINS_TO_AN_OBJECT.test(verb)) return `${verb} ${at}`;
    const joined = PLAINLY_WITH_AN_OBJECT[step.action.action];
    return joined ? `${joined} ${at}` : verb;
}

/**
 * The verb, said the way somebody would say it out loud.
 */
const PLAINLY: Partial<Record<ActionName, string>> = {
    cultivate: 'sitting down to cultivate',
    seclude: 'going into seclusion',
    breakthrough: 'striking the barrier',
    train_technique: 'working at the art',
    move: 'the journey to',
    ride: 'riding out to',
    fold: 'stepping across to',
    passage: 'taking passage to',
    work: 'taking the work',
    hunt: 'the hunt',
    wait: 'waiting it out',
    eat: 'eating',
    attack: 'the fight with',
    coerce: 'laying hands on',
    interact: 'the approach to',
    request: 'the ask of',
    provision: 'buying the rations',
    give: 'handing it over to',
    buy: 'the purchase',
    sell: 'the sale',
    consume_pill: 'taking the pill',
    learn_technique: 'taking up the art',
    treat: 'having the wound seen to',
    gather: 'the gathering',
    refine: 'the refining',
    // Not "the craft", which is the noun for the thing rather than for the
    // work, and would read as the question asking whether they want a boat.
    craft: 'the work at the bench',
    site: 'going in',
    legacy: 'putting it beyond your own death',
    sect: 'the business with the house',
    posture: 'the house declaring itself',
    seal: 'what is under the mountain',
    offer: 'the offering',
    oath: 'the oath',
    descend: 'going down',
    propose: 'the match',
    decline: 'refusing the match',
    child: 'the child',
    // Not "telling", which reads as the question asking whether the player
    // wants to be told something. What the step actually is, from the outside,
    // is somebody being given news they did not have.
    tell: 'carrying the news to',
    guard: 'standing guard over the crossing'
};

function plainNameOf(action: ActionName): string {
    return PLAINLY[action] ?? action.replace(/_/g, ' ');
}

/**
 * Every verb this question could ever have to name, for the guard test.
 */
export function everyVerbTheQuestionCouldName(): ActionName[] {
    return ACTION_NAMES.filter(name => !costsTheAskerNothing({ action: name }));
}

/**
 * The question, in the player's own terms, answerable in one word.
 */
export function whatTheQuestionAsks(fork: WhichComesFirst): string {
    const named = fork.acts.map(whatThisStepIsCalled);
    const list = named.length === 2
        ? `${named[0]} and ${named[1]}`
        : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;

    return `You mean to do both. ${capitalise(list)} each take real time, and there is only `
        + 'one of you, so one of them is going to happen first and the other is going to happen '
        + `after - or not at all, if the first one changes things. Which comes first? ${
            named.map(name => `"${name}"`).join(' or ')} is answer enough.`;
}

/** The same question for the engine channel, which keeps every figure. */
export function whatTheQuestionAsksStructurally(fork: WhichComesFirst): string {
    return 'A turn spends at most one costly action. This sentence read as '
        + `${fork.acts.length}: `
        + fork.acts
            .map(step => `${step.action.action}${step.action.target ? `(${step.action.target})` : '()'}`)
            .join(', ')
        + '. None of them ran and nothing was spent. The choice is held for one turn and then '
        + 'lapses; any other sentence next turn is an ordinary turn.';
}

function capitalise(text: string): string {
    return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PLAYER SAYS BACK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether a fork still belongs to the cultivator and run in front of us.
 */
export function theQuestionStillStands(
    fork: WhichComesFirst | null,
    runId: string,
    cultivatorId: string
): fork is WhichComesFirst {
    return fork !== null
        && fork.runId === runId
        && fork.cultivatorId === cultivatorId
        && fork.acts.length >= 2;
}

/**
 * Which of the two the player picked, or null if they said something else.
 */
export function whichOneTheyChose(
    answer: string,
    fork: WhichComesFirst
): PlanStep | null {
    const said = answer.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (said.length === 0) return null;
    // A long sentence is a new turn, not an answer to a question that could be
    // answered in one word. Twelve words is generous for "the second one".
    if (said.split(' ').length > 12) return null;

    const byOrdinal = ordinalIn(said);
    if (byOrdinal !== null && byOrdinal < fork.acts.length) return fork.acts[byOrdinal]!;

    const words = new Set(said.split(' ').filter(word => !NOISE.has(word)));
    if (words.size === 0) return null;

    const hits = fork.acts.filter(step => {
        const own = distinctiveWordsOf(step, fork.acts);
        for (const word of words) if (own.has(word)) return true;
        return false;
    });

    return hits.length === 1 ? hits[0]! : null;
}

/** "first", "the second one", "2". Zero-based, or null. */
function ordinalIn(said: string): number | null {
    if (/^(?:the )?(?:1|first|former|one)(?: one)?$/.test(said)) return 0;
    if (/^(?:the )?(?:2|second|latter|two)(?: one)?$/.test(said)) return 1;
    if (/^(?:the )?(?:3|third|three)(?: one)?$/.test(said)) return 2;
    return null;
}

/**
 * Words that pick this act out from the others in the fork.
 */
function distinctiveWordsOf(step: PlanStep, all: readonly PlanStep[]): Set<string> {
    const mine = wordsOf(step);
    for (const other of all) {
        if (other === step) continue;
        for (const word of wordsOf(other)) mine.delete(word);
    }
    // The verb itself is always available as an answer even when two acts share
    // it - in which case it matches both, and `whichOneTheyChose` returns null,
    // which is correct: it did not choose.
    mine.add(step.action.action);
    return mine;
}

function wordsOf(step: PlanStep): Set<string> {
    const text = [
        whatThisStepIsCalled(step),
        step.action.action,
        step.action.target ?? '',
        step.action.intent ?? '',
        step.action.topic ?? ''
    ].join(' ').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ');
    return new Set(text.split(/\s+/).filter(word => word.length > 1 && !NOISE.has(word)));
}

/** Words that appear in everything and therefore choose nothing. */
const NOISE: ReadonlySet<string> = new Set([
    'i', 'the', 'a', 'an', 'to', 'of', 'and', 'or', 'my', 'me', 'do', 'go',
    'it', 'is', 'be', 'for', 'with', 'that', 'this', 'then', 'one', 'ill',
    'lets', 'let', 'us', 'we', 'want', 'try', 'first', 'please', 'yes', 'ok'
]);

// ─────────────────────────────────────────────────────────────────────────
// FOLDING SEVERAL CALLS INTO ONE TURN
// ─────────────────────────────────────────────────────────────────────────

/**
 * What one engine call came back with.
 */
export interface OneCall<
    Event = unknown, Skip = unknown, Break = unknown, Heard = unknown, Seen = unknown
> {
    facts: EngineFacts;
    events: Event[];
    timeSkip: Skip | null;
    breakthrough: Break | null;
    outcome: 'executed' | 'refused';
    calls: ToolCallRecordish[];
    hearing?: Heard | null;
    /**
     * What each step showed the player, kept generic for the same reason
     * `Heard` is: this module folds executions without knowing what a
     * perception is, and importing the type would tie the folder to the web
     * layer it is deliberately independent of.
     */
    perceived?: Seen[];
}

/**
 * The inspector row, as much of it as folding needs to know.
 */
export interface ToolCallRecordish {
    name: string;
    action: string;
    summary: string;
    ok: boolean;
}

/**
 * Whether the world stopped the plan here.
 */
export function theWorldStoppedHere(
    call: Pick<OneCall, 'outcome' | 'calls'>,
    step: PlanStep
): boolean {
    return howTheStepWent(call, step) === 'did_not_come_off';
}

/**
 * A step can fail, or it can succeed into a world that will not carry the next one.
 * Those are different things and the player has to be able to tell them apart.
 */
export type HowItWent = 'ran' | 'landed' | 'did_not_come_off';

/** Rows this module writes about the sequence, which are not the engine speaking. */
const THE_EXECUTORS_OWN_ROWS: ReadonlySet<string> = new Set([
    'engine.step', 'engine.planStopped', 'engine.stillToCome',
    'engine.stepNotRun', 'engine.whichComesFirst'
]);

export function howTheStepWent(
    call: Pick<OneCall, 'outcome' | 'calls'>,
    step: PlanStep
): HowItWent {
    // A free read never stops a plan however it went - see the note above on
    // why an empty read is information rather than an obstacle.
    if (!spendsSomething(step)) return 'ran';

    // The executor's OWN bookkeeping row carries this step's verb and `ok: true`,
    // so counting it would classify every step as landed - which it did, and a
    // refused theft came back as a success. Only rows the ENGINE filed count.
    const itsOwn = call.calls.filter(
        row => row.action === step.action.action && !THE_EXECUTORS_OWN_ROWS.has(row.name)
    );
    if (itsOwn.some(row => row.ok)) return 'landed';
    if (call.outcome === 'refused' || itsOwn.some(row => !row.ok)) return 'did_not_come_off';
    return 'ran';
}

/**
 * What the player reads when a step came off and ENDED THINGS anyway.
 */
export function sayingWhatItCostTheRest(
    landed: PlanStep,
    notReached: readonly PlanStep[]
): string {
    const named = notReached.map(whatThisStepIsCalled);
    const rest = named.length === 1
        ? named[0]!
        : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
    return `"${whatThisStepIsCalled(landed)}" came off. What it cost is why `
        + `"${rest}" did not - there was no one left standing to do it. `
        + 'Nothing was spent on what came after.';
}

/**
 * What the player reads when the plan stopped before the end.
 */
export function sayingWhereItStopped(
    stoppedOn: PlanStep,
    notReached: readonly PlanStep[]
): string {
    if (notReached.length === 0) return '';
    const named = notReached.map(whatThisStepIsCalled);
    const rest = named.length === 1
        ? named[0]!
        : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
    return `That is as far as it went: "${whatThisStepIsCalled(stoppedOn)}" did not come off, `
        + `and "${rest}" depended on it having done - so ${
            named.length === 1 ? 'it never happened' : 'none of it happened'}. `
        + 'Nothing was spent on what came after.';
}

/** The same, for the engine channel. */
export function theRowThatSaysWhereItStopped(
    stoppedOn: PlanStep,
    notReached: readonly PlanStep[],
    havingLanded = false
): ToolCallRecordish {
    const at = `${stoppedOn.action.action}`
        + `${stoppedOn.action.target ? `(${stoppedOn.action.target})` : '()'}`;
    const after = `${notReached.length} later step${notReached.length === 1 ? '' : 's'} `
        + `never ran and cost nothing: ${notReached.map(s => s.action.action).join(', ')}.`;
    return {
        name: 'engine.planStopped',
        action: stoppedOn.action.action,
        summary: havingLanded
            ? `The plan stopped after ${at}, which LANDED - the run did not survive what it `
              + `cost, so there was nobody left to carry the rest. ${after}`
            : `The plan stopped at ${at}, which the world did not let through. ${after}`,
        // A landed step is not a failure, and marking it as one in the surface an
        // operator reads to find failures is the same lie the prose was telling.
        ok: havingLanded
    };
}

/**
 * Several calls, folded into the one turn the player took.
 */
export function foldTheCallsIntoOneTurn<Event, Skip, Break, Heard, Seen>(
    calls: readonly OneCall<Event, Skip, Break, Heard, Seen>[],
    headline?: string
): OneCall<Event, Skip, Break, Heard, Seen> {
    if (calls.length === 1 && headline === undefined) return calls[0]!;

    const first = calls[0];
    if (!first) throw new Error('a turn folded no calls at all, which cannot happen');

    const facts: EngineFacts = {
        headline: headline ?? first.facts.headline,
        lines: calls.flatMap(call => call.facts.lines),
        structure: calls.flatMap(call => call.facts.structure),
        prose: calls.map(call => call.facts.prose).filter(text => text.length > 0).join('\n\n')
    };

    const required = calls.flatMap(call => call.facts.required ?? []);
    if (required.length > 0) facts.required = required;

    return {
        facts,
        events: calls.flatMap(call => call.events),
        // The one time skip and the one breakthrough a turn can hold, which is
        // guaranteed by the law above: only a costly act produces either, and
        // there is at most one costly act.
        timeSkip: calls.map(call => call.timeSkip).find(skip => skip !== null) ?? null,
        breakthrough: calls.map(call => call.breakthrough).find(result => result !== null) ?? null,
        outcome: calls.some(call => call.outcome === 'executed') ? 'executed' : 'refused',
        calls: calls.flatMap(call => call.calls),
        hearing: calls.map(call => call.hearing).find(heard => heard != null) ?? null,
        // CONCATENATED, unlike the hearing above, and the difference is not an
        // inconsistency. A turn has at most one thing somebody SAID to render,
        // and every step of a plan can show the player something - so taking
        // the first would silently drop what the later steps put in front of
        // them, which is the defect this seam exists to end.
        perceived: calls.flatMap(call => call.perceived ?? [])
    };
}

/**
 * The row that says a step began, so the inspector reads as a sequence.
 *
 * One per step, in front of that step's own calls. Without it six calls arrive
 * as a flat list and the player cannot tell which of them were one act.
 */
export function theRowThatOpensAStep(
    step: PlanStep,
    index: number,
    outOf: number
): ToolCallRecordish {
    const free = spendsSomething(step) ? 'costly' : 'free';
    return {
        name: 'engine.step',
        action: step.action.action,
        summary: `Step ${index + 1} of ${outOf} in one sentence: ${step.action.action}`
            + `${step.action.target ? `(${step.action.target})` : '()'}`
            + `, ${free}.`
            + (step.said ? ` Read out of: "${step.said}".` : ''),
        ok: true
    };
}

/**
 * The row that says the turn asked instead of choosing.
 */
export function theRowThatAsksWhichFirst(fork: WhichComesFirst): ToolCallRecordish {
    return {
        name: 'engine.whichComesFirst',
        action: 'ask',
        summary: whatTheQuestionAsksStructurally(fork),
        ok: true
    };
}

/**
 * The row that names a clause counted as a reason rather than as an act.
 */
export function theRowForAStatedReason(step: PlanStep): ToolCallRecordish {
    return {
        name: 'engine.step',
        action: step.action.action,
        summary: `"${step.said ?? ''}" states a need rather than naming an act, and a real act `
            + `stands beside it in the same sentence - so it was read as the REASON for that `
            + `act rather than as a second thing to do. Nothing was declined and nothing was `
            + `spent. Said on its own it is a request to ${step.action.action}, and it runs.`,
        ok: true
    };
}

/** The row that names a step the bound cut off, because dropping it silently is the defect. */
export function theRowForAStepOverTheBound(step: PlanStep): ToolCallRecordish {
    return {
        name: 'engine.stepNotRun',
        action: step.action.action,
        summary: `Not run: a sentence may make at most ${MOST_CALLS_IN_ONE_TURN} engine calls, `
            + `and ${step.action.action}`
            + `${step.action.target ? `(${step.action.target})` : '()'}`
            + ' was past that. Nothing was spent on it. Say it again on its own and it will run.',
        ok: false
    };
}

/**
 * What the player reads when their own sentence gave the order.
 */
export function sayingWhatIsStillToCome(held: readonly PlanStep[]): string {
    const named = held.map(whatThisStepIsCalled);
    const rest = named.length === 1
        ? named[0]!
        : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
    return `You said what order you wanted, and that is the order it went in. `
        + `${capitalise(rest)} ${named.length === 1 ? 'is' : 'are'} still ahead of you - `
        + `a turn spends one act that costs, and this one is spent. Say it again and it runs.`;
}

/** The same, as an inspector row per held step. */
export function theRowForSomethingStillToCome(step: PlanStep): ToolCallRecordish {
    return {
        name: 'engine.stillToCome',
        action: step.action.action,
        summary: `Not run, and not declined: the sentence gave its own order, so `
            + `${step.action.action}${step.action.target ? `(${step.action.target})` : '()'}`
            + ' comes after the act this turn spent. Nothing was spent on it.',
        ok: true
    };
}

/**
 * What the player reads when the reading layer dropped one of their clauses.
 */
export function sayingWhatTheReadingDropped(dropped: readonly PlanStep[]): string {
    const named = dropped.map(whatThisStepIsCalled);
    const rest = named.length === 1
        ? named[0]!
        : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
    return `"${rest}" ${named.length === 1 ? 'was' : 'were'} not part of what happened - `
        + `that part of the sentence did not become an act, so nothing was done about it and `
        + `nothing was spent on it. Say it on its own and it will run.`;
}

/** The same, as an inspector row per dropped clause. */
export function theRowForADroppedClause(step: PlanStep, wasTheirs = true): ToolCallRecordish {
    const at = `${step.action.action}`
        + `${step.action.target ? `(${step.action.target})` : '()'}`;
    return {
        name: 'engine.stepNotRun',
        action: step.action.action,
        summary: wasTheirs
            ? `Not run: the reading layer declined ${at} - only a model read the sentence that `
              + 'way, and a model may not be the reason a turn became dangerous. Nothing was '
              + 'spent on it.'
            : `Not run, and NOT the player's: the reader added ${at}, which quotes no clause of `
              + 'what was typed. Declined and dropped without telling them, because a player '
              + 'told an act they never asked for "did not happen" learns that their sentence '
              + 'was misread when what happened is that the reader added to it.',
        ok: false
    };
}

/**
 * Whether a dropped step is one of the PLAYER'S clauses or one the reader added.
 */
export function theseWereThePlayersOwnWords(step: PlanStep, input: string): boolean {
    return theClauseThisStepQuotes(step, input) !== null;
}

/**
 * Who the choice landed on, said to the player.
 */
export function whatTheChoiceLandedOn(
    selection: ASelection,
    name: string,
    because: string
): string {
    return `Of the people here you can put a name to, the ${selection.word} is ${name} `
        + `(${because}). That is who the rest of the sentence is about - say the name `
        + 'yourself if you meant somebody else.';
}

/** The same, for the engine channel, with the field named. */
export function whatTheChoiceLandedOnStructurally(
    selection: ASelection,
    picked: { name: string; because: string } | null
): string {
    const over = `Choice over ${selection.field}, taking the ${selection.want === 'most' ? 'highest' : 'lowest'}`;
    return picked === null
        ? `${over}, from the word "${selection.word}". No candidate: either nobody here has a `
          + 'knowledge record, or this field has no rows on a turn like this one. Nothing was '
          + 'spent and no name was invented.'
        : `${over}, from the word "${selection.word}". Landed on ${picked.name} (${picked.because}). `
          + 'Candidates are the faces this cultivator already has a record for and nobody else, '
          + 'so a choice can never be what hands over a name.';
}

/**
 * The refusal, when there is nobody to choose between.
 */
export function whatTheChoiceFoundNobody(selection: ASelection): string {
    return selection.field === 'rung' || selection.field === 'age'
        ? `There is nobody here you could put a name to, so there is no ${selection.word} one `
          + 'to pick out. Looking at who is here, or asking after somebody, is what gives you '
          + 'names to choose between.'
        : `Picking the ${selection.word} one is a comparison this turn has nothing to make: `
          + `${selection.field === 'price' ? 'a price board' : 'a set of places'} is what would `
          + 'carry it, and nothing here is holding one. Ask for that first and then choose.';
}

/** The choice, as an inspector row: the field, the direction and who it landed on. */
export function theRowForAChoice(
    selection: ASelection,
    picked: { name: string; because: string } | null
): ToolCallRecordish {
    return {
        name: 'engine.chose',
        action: 'look',
        summary: whatTheChoiceLandedOnStructurally(selection, picked),
        // A choice that found nobody is a refusal like any other, and an
        // operator looking for what went wrong should find it.
        ok: picked !== null
    };
}

/** The sentence a player reads when the bound cut something off. */
export function sayingWhatTheBoundCutOff(over: readonly PlanStep[]): string {
    const named = over.map(whatThisStepIsCalled);
    return `That was more than one turn's worth of asking, so ${named.join(', ')} `
        + `${named.length === 1 ? 'was' : 'were'} left. Nothing was spent on `
        + `${named.length === 1 ? 'it' : 'them'}; say it again and it will run.`;
}
