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
import type { Company, EngineFacts } from './facts.js';
import { inTheCharactersThePatternsUse } from './sentence-parts.js';

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
    /**
     * Who is standing in the square.
     *
     * A CONSTRAINT on the prose and not material for it: see
     * `describeTheRoom` in `prompt.ts` for the played defect, which is a
     * narrator asked to write a scene and never told whether anybody was in it.
     */
    company?: Company | null;
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
    /**
     * NAMED THINGS THE ENGINE PUT IN FRONT OF THE MODEL THIS TURN THAT THE
     * PLAYER DOES NOT HOLD.
     *
     * FOUND BY PLAYING. The stall was read, nothing was bought, and the next
     * turn's prose said *"You have the Lesser Qi-Gathering Manual with you, but
     * it remains a closed weight in your possession."* The engine's own facts
     * for that turn said the opposite in as many words - no method is
     * practised, the rate multiplier is zero - and the model wrote the player
     * into owning the one object that would have changed it.
     *
     * This is narrower than "every name", deliberately. Only what the engine
     * SAID this turn can be checked, because only that is a name the model was
     * handed; and only what is not held can be a fabrication. A stall listing a
     * manual for sale is not a claim of ownership, so the check is on the claim
     * and not on the mention.
     */
    onOfferAndNotHeld?: readonly string[];
    /**
     * WHETHER THE ENGINE ANSWERED THE THING THE PLAYER ASKED.
     *
     * FOUND BY PLAYING, on turn one of a run. The opening scene read *"Mo Anzhi
     * stands nearby, counting a pile of stones. Someone else lingers in the
     * square"*. The player typed `where am I?`, the engine answered it in five
     * separate ruling blocks - the place, the air, the rank, the root, the
     * progress - and the prose came back:
     *
     *     You ask where you are, but the question hangs in the humid air. There
     *     is no one immediately close enough to answer.
     *
     * Two people were standing there and the answer was already in hand. The
     * narrator staged a failure it had no grounds for and invented an empty
     * square to justify it.
     *
     * ── THE RULE, AND WHY IT IS NOT ABOUT WHO IS STANDING THERE ──────────
     *
     * The design owner: *if Mo Anzhi is nearby, then he can answer. If nobody is
     * nearby, I ought to answer.* So the square never decides whether a question
     * gets an answer - it decides only WHO gives it. With somebody present they
     * can; with nobody present the narration does.
     *
     * And: *there can be a non-answer if the question is incoherent, but this
     * question is coherent. I know where I am.* Which is the condition. A
     * sentence the engine could not read is `unclear`, and prose about a
     * question going nowhere is honest there and only there. Everywhere else the
     * engine produced an answer, and prose reporting that none came contradicts
     * the turn it is narrating.
     *
     * ── WHO IS ASKING, WHICH IS TWO THINGS AT ONCE AND STAYS THAT WAY ────
     *
     * The design owner: *my character does. I the player don't.* And then,
     * immediately: *I mean it CAN BE the player asking aloud.*
     *
     * Both, and the engine does not get to choose. `where am I` is the player
     * querying the game for something the character already knows - which is why
     * a read costs nothing and passes no time - and it is also a sentence a
     * person can say out loud in a market. A narrator may stage it either way.
     *
     * WHAT IS NOT FREE IS THE ENDING. Every staging has an answer available:
     * spoken with somebody present, they answer; spoken with nobody present, the
     * narration answers; taken as the player's query, the answer is simply
     * given. The non-answer belongs to none of them, which is why this checks
     * the ending and never the staging.
     *
     * Absent means a caller has not said, and nothing is checked - the same
     * opt-in `onOfferAndNotHeld` takes.
     */
    /**
     * The rank the engine says this cultivator is at, in the ladder's own
     * words. See `claimsThePlayerAdvanced` for the played defect: without it,
     * a faithful answer to `what is my rank` reads as an invented one.
     */
    standsAt?: string;
    answered?: boolean;
}

export interface NarrationViolation {
    kind:
        | 'invented_breakthrough'
        | 'invented_death'
        | 'invented_possession'
        | 'invented_absence';
    detail: string;
}

/** The rung words an advancement claim has to land on to be one. */
const RUNG_WORD =
    '(?:layer|rank|realm|stage|condensation|foundation|core|nascent|deity|void|tribulation)';

/**
 * Saying it in a way that can only be an advancement, whoever the subject is.
 *
 * No house states its intake bar as "broke through", so these are safe to catch
 * without asking who the sentence is about.
 */
const ADVANCED_UNAMBIGUOUSLY =
    new RegExp(
        '\\b(?:breakthrough succeeded|broke through(?! (?:to nothing|and failed))|broken through'
        + '|advanced to|rose to|ascended to|stepped up to|climbed to)\\b'
        + `[^.!?]{0,60}\\b${RUNG_WORD}\\b`,
        'i'
    );

/**
 * A BAR SOMEBODY ELSE SETS IS NOT A CLAIM ABOUT THE PLAYER.
 *
 * `reached` and `attained` used to be in the list above, subjectless, and that
 * made a whole class of turn unnarratable. An intake notice says "will hear
 * anybody who has reached Qi Condensation at all" - so every faithful narration
 * of a house recruiting tripped `invented_breakthrough` and was thrown away, and
 * the player got the engine's own list instead. Measured on `who is here` in a
 * town with three notices up: discarded on three consecutive runs, and the run
 * that passed did so only by omitting all three notices.
 *
 * These two verbs therefore need the subject to be the person whose run this is,
 * which is the shape {@link claimsThePlayerDied} already uses and for the same
 * reason.
 */
/**
 * The words that turn a crossing into a crossing that did not happen.
 *
 * Kept to forms that can only negate or defer. `no` is deliberately absent:
 * "no rung above this one" is a true sentence beside a real claim, and letting
 * it excuse one would open the guard to any prose that mentions a lack.
 */
const NOT_THAT_IT_HAPPENED = new RegExp([
    String.raw`\b(?:not|never|nor|cannot|can't|won't|shan't)\b`,
    // A subject that is nobody. `no` on its own is deliberately not here: "no
    // rung above this one" is a true clause that can sit beside a real claim.
    String.raw`\b(?:nothing|nobody|no\s?one|none)\b`,
    String.raw`\b(?:have|has|had|did|do|does|is|are|was|were|will|would|could|should)n't\b`,
    String.raw`\byet\s+to\b`,
    String.raw`\bfar\s+from\b`,
    String.raw`\b(?:short|shy)\s+of\b`,
    String.raw`\bwithout\b`,
    // The conditional and the deferred, which are the other two ways of
    // naming a rung nobody has stood on: "before you reach", "when you reach",
    // "until you reach", "if you reach", "so as to reach".
    String.raw`\b(?:before|until|till|unless|when|once|if|whether|to)\b`
].join('|'), 'i');

/**
 * Whether the claim that matched sits inside a clause that denies it.
 *
 * FOUND BY PLAYING BLIND, on TURN ONE of a fresh run. The player typed `where
 * am i`, the engine answered with the place, the rung, the root and *0 of 100
 * qi-units toward the next rank. Not yet eligible* - and the narration was
 * thrown away as an invented breakthrough, so the first thing a new player ever
 * read was the raw engine sheet with an apology under it.
 *
 * `ADVANCED_UNAMBIGUOUSLY` matches on the verb alone, by design: no house
 * states its intake bar as *broke through*, so the phrase needs no subject. But
 * it also needs no POLARITY, and the engine's own fact for that turn was a
 * negative one. Any faithful sentence saying somebody has NOT crossed says
 * "have not broken through to <rung>", which is the pattern exactly.
 *
 * So the same distinction the `standsAt` note already draws, one axis over: the
 * words are ambiguous and what settles them is not in the verb. There it was
 * the subject; here it is whether the clause asserts the thing or denies it.
 *
 * Scoped to the clause the match sits in, so "you have not broken through, and
 * you broke through last year" still catches the second half.
 */
function insideAClauseThatDeniesIt(text: string, at: number): boolean {
    const clauseStart = Math.max(
        ...['.', '!', '?', ';', ',', ' - '].map(mark => text.lastIndexOf(mark, at)),
        -1
    );
    return NOT_THAT_IT_HAPPENED.test(text.slice(clauseStart + 1, at));
}

function claimsThePlayerAdvanced(
    text: string,
    who: string | undefined,
    /**
     * The rank the engine says they are at, when the caller supplies it.
     *
     * ── SAYING WHERE SOMEBODY STANDS IS NOT CLAIMING THEY MOVED ──────────
     *
     * FOUND BY PLAYING BLIND. The player typed `what is my rank`, the engine
     * answered with the rank, and the narration was discarded as an invented
     * breakthrough. It is the most basic read in the game and it could not be
     * narrated: any faithful sentence about the rung somebody is on says the
     * rung's name, and `reached <rung>` is how that sentence goes.
     *
     * `status` grants no rank and attempts nothing, so the guard's other two
     * conditions were always true - which means EVERY well-written rank read
     * was thrown away and the player got the raw sheet instead.
     *
     * The test is what rung is named. A sentence naming the rung the engine
     * itself just reported is repeating the engine; a sentence naming a
     * different one has moved them. That is the whole distinction, and it is
     * the same shape as the fix for a house's intake bar: the words are
     * ambiguous and the SUBJECT of them is not.
     */
    standsAt?: string
): boolean {
    // Every place it says it, not only the first: a paragraph that denies a
    // crossing in one sentence and asserts one in the next is still a claim.
    // See `insideAClauseThatDeniesIt` for the played defect.
    const said = new RegExp(ADVANCED_UNAMBIGUOUSLY.source, 'gi');
    for (let hit = said.exec(text); hit !== null; hit = said.exec(text)) {
        if (!insideAClauseThatDeniesIt(text, hit.index)) return true;
    }

    const subjects = ['you', 'your', ...(who && who.trim() ? [forRegExp(who.trim())] : [])];
    const claim = new RegExp(
        `\\b(?:${subjects.join('|')})\\b[^.!?]{0,40}\\b(?:attained|reached)\\b`
        // LAZY TO THE FIRST RUNG WORD, THEN A SHORT TAIL. A rank's name does
        // not end at its rung word - `Qi Condensation Layer 1` carries the
        // number after it - and a capture that stopped at `Layer` could never
        // match the rank the engine filed, so every rank read stayed flagged.
        + `([^.!?]{0,60}?\\b${RUNG_WORD}\\b[^.!?]{0,12})`,
        'i'
    ).exec(text);
    if (!claim) return false;

    // Same polarity rule as above, measured from the VERB rather than from the
    // start of the match: this pattern opens on the SUBJECT, so "you have not
    // yet reached" carries its own `not` inside the match, where a test on the
    // text before it cannot see it.
    const verbAt = claim[0].search(/\b(?:attained|reached)\b/i);
    if (insideAClauseThatDeniesIt(text, claim.index + (verbAt < 0 ? 0 : verbAt))) return false;

    // The rung it named, against the rung they are on. Absent, nothing is
    // excused and the check behaves as it always did.
    const named = (standsAt ?? '').trim();
    if (named.length === 0) return true;
    return !new RegExp(forRegExp(named), 'i').test(claim[1] ?? '');
}

/**
 * Prose reporting that what was asked went unanswered.
 *
 * ON THE ENDING AND NEVER ON THE STAGING. A narrator may have the question
 * spoken aloud, or may treat it as the player's own query and simply answer
 * it. Both are legitimate and this must not read as a vote on which. What it
 * catches is the third thing, which is not: a coherent question that produced
 * an answer, narrated as producing none.
 *
 * `nobody here to ask` on its own is deliberately NOT enough, because it is a
 * true and ordinary sentence in an empty square that then goes on to answer.
 * What makes it a violation is ANSWERING being the thing reported absent.
 */
const NOTHING_CAME_BACK = new RegExp([
    // The question itself going nowhere.
    String.raw`\bquestions?\b[^.!?]{0,40}\b(?:hangs?|hung|hanging)\b`,
    String.raw`\bgo(?:es)?\s+unanswered\b`,
    String.raw`\bwent\s+unanswered\b`,
    String.raw`\bremains?\s+unanswered\b`,
    // Nobody to give one. The ANSWERING is what has to be absent, not the
    // company - see the note above.
    String.raw`\b(?:no\s?one|nobody|no\s+person)\b[^.!?]{0,40}\bto\s+answer\b`,
    String.raw`\bno\s+answer\b[^.!?]{0,20}\b(?:comes?|came|follows?|followed)\b`,
    String.raw`\b(?:nobody|no\s?one)\s+(?:answers?|answered|replies|replied)\b`
].join('|'), 'i');

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
    if (!granted && filed.breakthroughAttempted !== true && claimsThePlayerAdvanced(text, filed.who, filed.standsAt)) {
        found.push({
            kind: 'invented_breakthrough',
            detail: 'prose announces an advancement; the engine granted no rank and resolved no attempt'
        });
    }

    // A QUESTION THE ENGINE ANSWERED, NARRATED AS ANSWERING NOTHING.
    //
    // Opt-in: absent means the caller has not said whether this turn answered
    // anything, and nothing is checked. `unclear` is the case that legitimately
    // ends in a non-answer, and it files `false`.
    if (filed.answered === true && NOTHING_CAME_BACK.test(text)) {
        found.push({
            kind: 'invented_absence',
            detail:
                'prose reports the question going unanswered; the engine answered it this turn'
        });
    }

    if (filed.died !== true && claimsThePlayerDied(text, filed.who)) {
        found.push({
            kind: 'invented_death',
            detail: 'prose reports the death of the cultivator whose run this is; the engine did not record one'
        });
    }

    for (const name of filed.onOfferAndNotHeld ?? []) {
        if (!claimsTheyHaveIt(text, name)) continue;
        found.push({
            kind: 'invented_possession',
            detail: `prose has this cultivator holding ${name}, which the engine says they do not have`
        });
        // One is enough to throw the account away, and listing the rest adds
        // nothing a reader of the log would act on.
        break;
    }

    return found;
}

/**
 * Prose that says the player HAS a particular named thing.
 *
 * Tight on purpose. A market answer legitimately says a manual is on a stall,
 * priced, and opens at a given rung - none of which is a claim that anybody
 * owns it. What is banned is the ownership itself, in the three shapes it comes
 * in: possessing it, it being yours, and it being in your hands.
 */
function claimsTheyHaveIt(text: string, name: string): boolean {
    const it = forRegExp(name);
    return new RegExp(
        // "you have / hold / carry / own the X", within a clause of it
        `\\byou\\s+(?:have|hold|holds|carry|own|possess|keep)\\b[^.!?]{0,40}${it}`
        // "your X"
        + `|\\byour\\s+(?:own\\s+)?${it}`
        // "the X in your hands / in your possession / you are carrying"
        + `|${it}[^.!?]{0,40}\\b(?:in|is in)\\s+your\\s+(?:hands?|possession|pouch|pack|sleeve)\\b`
        + `|${it}[^.!?]{0,30}\\byou\\s+are\\s+carrying\\b`,
        'i'
    ).test(text);
}

/**
 * What the player is told when a narration was thrown away.
 */
export const THE_NARRATION_WAS_DISCARDED =
    'The account written for this turn described something that did not happen, '
    + 'so what is above is the engine\'s own record of it instead.';

/**
 * Put back anything the narrator left out that a player cannot play without.
 *
 * ── NEVER REQUIRE A LINE THE PROMPT FORBIDS THE PROSE FROM CONTAINING ──────
 *
 * Matching is on the line appearing in the text, so a line the narrator is under
 * instructions NOT to write is missing on every well-behaved turn and is appended
 * on every well-behaved turn. `narrationSystemPrompt` says *"do not restate the
 * numbers as a list - the interface already shows the arithmetic"*, and a combat
 * round used to require its own bars and odds anyway: the result was that obeying
 * the prompt guaranteed the stat block, and every fight turn ended in one.
 *
 * So the test before marking a line required is not "would a player want this".
 * It is "is a narrator ALLOWED to write this". If the answer is no, the line
 * belongs in `structure`, where the tool-call summary picks it up for an operator.
 * `tests/web/a-round-does-not-print-its-own-arithmetic.test.ts` holds that line.
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
     */
    private async aPlanRatherThanAVerb(
        fromTheReader: readonly PlanStep[],
        input: string
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

            // DECLINING THE MODEL'S READING OF A CLAUSE IS NOT DECLINING THE
            // CLAUSE. `plan` above substitutes the deterministic reading and
            // runs it; this dropped the step instead, so one sentence got two
            // treatments and the harsher one fell on the clause the model had
            // described more fully. Played: "i go to the market and ask around"
            // only asked around, because the model read the first clause as
            // `move` and the table reads it as the free `market` - a costly verb
            // where a cheap one would do, declined, and the clause went with it.
            // `theWholeSentenceAsAPlan` would have put that same clause back on
            // that same reading had the model omitted it.
            //
            // The guard's rule stands: what is substituted is the deterministic
            // reading, so a model still cannot be why a turn spends days. Only
            // for a clause the player typed, because for a step quoting nothing
            // `verdict.action` is a reading of the WHOLE sentence; and only
            // where something reads it, because `unclear` is not an act.
            const itsOwnReading = quoted === null ? null : verdict.action;
            if (itsOwnReading !== null && itsOwnReading.action !== FALLBACK_ACTION) {
                declined.push(verdict.declined);
                checked.push({ action: itsOwnReading, said: step.said });
                continue;
            }

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
    /**
     * The reading a player would have got with no model at all.
     *
     * It COMPOSES, the same way `DeterministicNarrator` does. Both of these are
     * the deterministic tier and a sentence does not become one act because a
     * provider timed out: this returned the table's single verb, which is the
     * LAST clause's, so a model failure turned "I sit for a year and take work
     * for a season" into a season of work with the year silently gone.
     */
    private async deterministically(input: string, note: string): Promise<PlanWithSteps> {
        const read = await readTheSentence(input);
        const whole = await theWholeSentenceAsAPlan(
            input,
            [{ action: read.action }],
            async clause => (await readTheSentence(clause)).action
        );
        return {
            action: read.action,
            source: 'fallback',
            ...(whole.steps.length > 1 ? { steps: whole.steps } : {}),
            note: withTheTierFailure(note, read.tierFailure)
        };
    }

    /**
     * THE LAST SCENE HEADER THIS NARRATOR HANDED OVER.
     *
     * Held here rather than by the caller because `narrate` is the one funnel:
     * five call sites in `turn-engine.ts` reach it and none of them would
     * otherwise know what the previous one said. What it is for is written on
     * `composeNarrationUser`'s `told` parameter.
     */
    private lastSceneTold: { place: string; ambient: AmbientQi } | null = null;

    /**
     * Phase 3. The result is stored in the log and shown to the player. It is
     * not parsed, matched, or compared against anything; there is deliberately
     * no code in this package that reads a value out of it.
     */
    async narrate(facts: EngineFacts, scene: NarratorScene): Promise<Narration> {
        const ambientIsNews = this.lastSceneTold === null
            || this.lastSceneTold.place !== scene.place
            || this.lastSceneTold.ambient !== scene.ambient;
        // Recorded before the call rather than after it, so a narration that
        // times out or is discarded does not make the next turn repeat itself.
        // The model was told; whether it used it well is a separate question.
        this.lastSceneTold = { place: scene.place, ambient: scene.ambient };
        try {
            const result = await this.provider.call({
                model: this.options.model,
                temperature: this.narrationTemperature,
                maxTokens: this.maxNarrationTokens,
                signal: AbortSignal.timeout(this.timeoutMs),
                messages: [
                    { role: 'system', content: narrationSystemPrompt() },
                    { role: 'user', content: composeNarrationUser(facts, scene, { ambientIsNews }) }
                ]
            });

            // THE MODEL WRITES TYPOGRAPHY THIS REPO DOES NOT USE.
            //
            // `AGENTS.md` forbids an em-dash and an en-dash, and
            // `terminology.test.ts` enforces it across every file. None of that
            // reaches the narrator, which writes them freely: measured on a live
            // turn, gemma produced "within earshot - even in a kitchen - the
            // disciples stand" with em-dashes on both sides. That is the most
            // read surface in the game breaking the one typographic rule the
            // whole repo keeps.
            //
            // `inTheCharactersThePatternsUse` already existed for the other
            // direction, normalising what a PLAYER types so the patterns can
            // match it. The same function serves here, and smart quotes and an
            // ellipsis character come back with it.
            const text = inTheCharactersThePatternsUse((result.text ?? '').trim());
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
