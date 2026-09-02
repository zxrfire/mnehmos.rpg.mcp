/**
 * A player says one sentence containing a plan, and the turn carries it out.
 *
 * ── THE DEFECT THIS EXISTS TO REMOVE ─────────────────────────────────────
 *
 * Phase 1 answered with ONE verb, and a sentence with two steps in it had
 * nowhere to go. Played, on this branch:
 *
 *     > I offer Gu Peiyan's family my spirit stones for the match
 *     "No one in the room acknowledges the name of the house you have invoked."
 *
 * That sentence is two acts - work out who that family is, then put an offer to
 * them - and one verb cannot express it, so it refused. The same shape:
 *
 *     > I try to take Cao Antao's purse while he isn't looking
 *     "You move toward Cao Antao ... you have no target"
 *
 * The design owner's ruling, and the whole justification for this file:
 *
 *   > "The AI takes action on behalf of the user and it has wide leeway to
 *   >  decide which APIs to take, based on the user's actions."
 *   > "This is all for the fact that a game should be playable. Too many
 *   >  instructions that end in refusals and the game is UNFUN."
 *
 * ── WHAT MAKES IT SAFE, AND IT IS NOT A PROMPT ───────────────────────────
 *
 * More calls is more REACH. It is never more authority: every step is still a
 * member of the closed enum, every outcome is still computed by phase 2, and
 * nothing here reads a value out of a model response and writes it. What this
 * module adds is a law about how much of the player's LIFE one sentence may
 * spend, and the law is enforced by the executor rather than asked for in the
 * prompt - a model told "only one costly action" will eventually do two.
 *
 * The line is not invented here. {@link costsTheAskerNothing} already exists in
 * `actions.ts` and already answers exactly the right question: it is a fact
 * about the PLAN rather than about the verb, which is what `interact` needs -
 * free on `talk`, days and stones on the eight of `PRESSING_SOMEBODY`. The
 * engine's own marker for the same idea is `GameService.freeAction`, which
 * increments the turn and does nothing else, and the two agree by construction
 * because both are read off the same list.
 *
 * So:
 *
 *   FREE READS CHAIN.        Looking, asking who is here, reading a board,
 *                            checking a purse, recalling what you know. As many
 *                            as the sentence needs, up to
 *                            {@link MOST_CALLS_IN_ONE_TURN}, because resolving
 *                            who somebody is and then what they hold is ONE
 *                            player intention and should be one turn.
 *
 *   ONE COSTLY ACT.          Anything that spends a day, the purse or the body.
 *                            At most one, and it is the thing the player asked
 *                            for rather than one the model added on the way.
 *
 * ── AND WHEN THERE ARE TWO, THE TURN ASKS ────────────────────────────────
 *
 * This is the design owner's correction to an earlier draft of this file, and
 * it is the part most worth reading:
 *
 *   > "If the model is told this it should ask which to do first, because it
 *   >  can't do both."
 *
 * The earlier draft ran the first costly act and reported that the second had
 * not been done. That is still the reader deciding on the player's behalf, and
 * it spends a costly act they may not have wanted first. **Asking costs
 * nothing** - a question is a free turn - and it hands the choice back to the
 * person whose life is being spent. So:
 *
 *   1. Run the free reads. They cost nothing and they are usually most of the
 *      plan. They run BEFORE the question, so the question can name what they
 *      found rather than asking about a name nobody has resolved yet.
 *   2. If exactly one costly act remains, do it. That is the ordinary case and
 *      it should feel like nothing happened.
 *   3. If two or more remain, do NEITHER, and ask which comes first.
 *
 * **The question is not a refusal and must not read as one.** Nothing failed.
 * The turn understood the whole sentence, which is the opposite of the failure
 * this work exists to remove, and {@link whatTheQuestionAsks} is written to make
 * that obvious. It is answerable in one word, because a list of enum names is a
 * parser asking and a game asks in the player's own terms.
 *
 * ── THE FORK IS NOT A MODAL JAIL ─────────────────────────────────────────
 *
 * Copied from `choosing-what-to-do-when-a-seclusion-is-broken.ts`, which
 * settled this question first and settled it correctly. The question stands for
 * exactly one turn, it lives in memory rather than in a row, and **any other
 * sentence is an ordinary turn** - a player who answers with something else
 * entirely gets that thing, not a refusal telling them to answer the question
 * first. Nothing is banked and nothing is owed.
 *
 * ── WHAT THE DETERMINISTIC TIERS DO ──────────────────────────────────────
 *
 * One action per turn, unchanged, and the design owner said so explicitly. A
 * `Plan` with no `steps` on it takes the single-step path through
 * {@link stepsOfThePlan}, which yields exactly one step and reaches
 * `GameService.execute` exactly once with exactly the object it reached before.
 * That is the determinism argument: the multi-call path is unreachable without
 * a model, so no RNG draw moves. It becomes a real difference between the rungs
 * rather than a shortfall - the model can carry out a plan, the embedding
 * carries out a verb.
 */

import {
    ACTION_NAMES,
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
 *
 * `said` is the fragment of the player's own sentence this step is for. It is
 * shown to the player in the question and it is matched against their one-word
 * answer, and both of those are safe for the same reason: it selects which of
 * two ALREADY VALIDATED plans runs, and both of them are the player's. Nothing
 * downstream reads it, no outcome branches on it, and it is bounded and
 * stripped the way `intent` is.
 *
 * Absent when a model did not supply one, in which case
 * {@link whatThisStepIsCalled} falls back to the verb's own player-facing name
 * out of `WHAT_EACH_VERB_IS_FOR` - so the question always has something to say.
 */
export interface PlanStep {
    readonly action: PlannedAction;
    readonly said?: string;
}

/**
 * A `Plan` that may carry more than one call.
 *
 * Declared here rather than widening `Plan` in `actions.ts`, so the whole of
 * this feature is one file plus a small hunk in the executor. `action` keeps
 * meaning what it always meant - the verb THIS TURN IS ABOUT - so every
 * existing reader of a plan (the routing row, the dropped-clause check, the
 * crossroads settlement) goes on working with no change and no second meaning.
 */
export interface PlanWithSteps extends Plan {
    /**
     * Every call, in the order the reader put them. Absent means one call, and
     * absent is what both deterministic tiers always produce.
     */
    readonly steps?: readonly PlanStep[];
}

/**
 * The steps of a plan, whether or not it has any.
 *
 * The single-step path is not a special case that happens to work - it is the
 * SAME path, yielding one step whose action is `plan.action`, which is the
 * object that reached the engine before this file existed.
 */
export function stepsOfThePlan(plan: PlanWithSteps): readonly PlanStep[] {
    const steps = plan.steps ?? [];
    return steps.length > 0 ? steps : [{ action: plan.action }];
}

/**
 * How many engine calls one sentence may make.
 *
 * A bound rather than a budget: free reads cost the player nothing, so the only
 * thing this defends against is a model that has decided to enumerate the
 * world. Six covers every real plan measured while writing this - the longest
 * was four - and the ones past it are named rather than dropped, because a
 * silently truncated plan is the defect this file exists to remove.
 */
export const MOST_CALLS_IN_ONE_TURN = 6;

/** Whether this step spends a day, the purse or the body. */
export function spendsSomething(step: PlanStep): boolean {
    return !costsTheAskerNothing(step.action);
}

// ─────────────────────────────────────────────────────────────────────────
// READING A SEQUENCE OUT OF A MODEL RESPONSE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The steps in a phase-1 response, or null if there is no sequence in it.
 *
 * ── THE GATE IS EXACTLY THE ONE THAT WAS ALREADY THERE ───────────────────
 *
 * Every step goes through {@link validatePlan}, unchanged - the closed enum,
 * the bounded `days`, the stripping of unknown keys. A response of
 * `{"steps":[{"action":"ascend"},{"action":"set_realm","realmOrdinal":40}]}` is
 * one rejected step and one `{action:'unclear'}`; there is no path here by
 * which a sequence widens what a model may say. What is new is HOW MANY legal
 * plans one response may carry, and nothing about what a legal plan is.
 *
 * Each step then goes through {@link carryWhatOnlyTheSentenceKnows} against the
 * player's whole sentence, for the same reason a single plan does: `leverage`,
 * `terms`, `opening` and `rations` are facts about what the player put on the
 * table, and a model never emits them. It only ever fills fields the model left
 * empty and only where the two readings agree on the verb, so a three-step plan
 * gets the carry on whichever of its steps the parser also reached.
 *
 * Null - rather than an empty list - when the response carries no `steps` array
 * at all, so a caller can tell "this model answered the old way" from "this
 * model answered with nothing", and the old way keeps working untouched.
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
 *
 * Treated exactly the way `intent` is treated in `validatePlan`, and for the
 * same reason: it goes into a question and a log line, never into a conditional
 * that produces a result. Punctuation is kept where `intent` drops it, because
 * this is a phrase a person reads rather than a label, and an apostrophe in
 * "Cao Antao's purse" is the difference between a sentence and a slug.
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
 * The player's own words for this step, but only if they really are the
 * player's own words.
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────
 *
 * `theModelIsNotWhyThisTurnIsDangerous` compares the model's verb against the
 * deterministic reading of the sentence, and its rule is written in terms of
 * words: *a player whose local model is up must never meet a bigger bill for
 * THE SAME WORDS*. With one verb per turn the sentence and the act were the
 * same thing, so "the same words" needed no definition. With a plan they are
 * not, and comparing a single CLAUSE against a reading of the WHOLE sentence
 * compares different things. Measured, and it is not marginal:
 *
 *   "I look over the stalls, ask who is selling, and take the work going"
 *      whole sentence, deterministic -> interact(talk)   free
 *      the clause "take the work going" -> work          spends
 *
 * The table takes whichever verb it reaches first, which for a three-clause
 * sentence is usually the first clause - so every later costly step would be
 * declined for the crime of not being the first thing said. That is not the
 * invariant protecting anybody; it is a comparison against the wrong baseline.
 *
 * ── AND IT IS NOT A LOOPHOLE ─────────────────────────────────────────────
 *
 * The clause is used ONLY when it is genuinely a quotation: normalised, it must
 * appear inside the player's own sentence, and be at least two words long. So a
 * model cannot invent a dangerous-sounding clause to license an escalation - it
 * can only point at words the player actually typed, and reading the player's
 * own words is exactly what the deterministic reader does. Anything that fails
 * the check falls back to the whole sentence, which is the stricter baseline.
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

// ─────────────────────────────────────────────────────────────────────────
// THE LAW
// ─────────────────────────────────────────────────────────────────────────

/**
 * What is left over when a turn cannot do everything it understood.
 *
 * Two or more costly acts, held open for one turn so the player can say which
 * comes first. Note what it is NOT: a refusal, a queue, or a promise. Nothing
 * is banked - the unchosen act is not owed to the player and not held against
 * them, and next turn they may say something else entirely.
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
     *
     * Not "the reads and then the act" - see {@link whatThisTurnMayRun} for why
     * that ordering was wrong and what it would have done to the sentence this
     * whole file was built for.
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
     *
     * Shown in the engine channel rather than swallowed - see
     * {@link oneClauseIsOneAct} for why an ambiguous phrase must never become a
     * question about itself, and why the losing reading still has to be visible.
     */
    readonly secondReadings: ReadonlyArray<{ taken: PlanStep; alsoRead: PlanStep }>;
}

/**
 * The whole law, as a pure function of the steps.
 *
 * Pure and total: no clock, no database, no ordering surprises. That is what
 * makes it testable as a law rather than as a behaviour, and
 * `tests/web/a-sentence-can-be-more-than-one-call.test.ts` reads it as one.
 *
 * ── ORDER IS MEANING, AND AN EARLIER DRAFT GOT THIS WRONG ────────────────
 *
 * That draft ran every free step first and the costly one after, on the
 * reasoning that a read is free either way. It is not free either way, and the
 * design owner's own example is what breaks it:
 *
 *   > "a person could steal and then hand it to someone else before running
 *   >  away (framing), and all of that comes naturally."
 *
 *   > I take his purse, hand it to the man beside him, and walk away
 *
 * Three acts, and **the interesting thing is not any of the three - it is what
 * they compose into.** Somebody else is holding stolen property and the player
 * is elsewhere. Nobody framed anybody with a `frame` verb; framing fell out of
 * the ORDERING. Sort the free steps to the front and the purse is handed over
 * before it is taken, which is not a smaller version of that sentence - it is
 * nonsense, and it is nonsense the engine would have executed.
 *
 * So the sequence is **not a batch**. Each step runs against the world the step
 * before it left, and a step whose precondition the previous one destroyed is
 * refused by phase 2 in phase 2's own words - which is the correct outcome and
 * needs nothing from this file, because a refusal here already names a route.
 *
 * ── WHERE IT STOPS WHEN IT HAS TO ASK ────────────────────────────────────
 *
 * At the FIRST costly act, and not one step later. Everything before it ran,
 * which is what makes the question worth asking - the design owner asked that
 * the free reads happen first so the question can name who they resolved, and
 * in a sentence people actually type the resolving reads come first anyway.
 * Everything from the first costly act onward is held, named, and spent on
 * nothing.
 */
export function whatThisTurnMayRun(
    steps: readonly PlanStep[],
    input = ''
): WhatThisTurnMayRun {
    const withoutDoubleReadings = oneClauseIsOneAct(steps);
    const kept = withoutDoubleReadings.acts.slice(0, MOST_CALLS_IN_ONE_TURN);
    const overTheBound = withoutDoubleReadings.acts.slice(MOST_CALLS_IN_ONE_TURN);
    const secondReadings = withoutDoubleReadings.secondReadings;

    const costly = kept.filter(spendsSomething);
    if (costly.length < 2) {
        return {
            toRun: kept, askAbout: [], heldForTheQuestion: [], overTheBound,
            theOrderWasGiven: false, secondReadings
        };
    }

    const first = kept.findIndex(spendsSomething);

    // THE PLAYER MAY HAVE ALREADY ANSWERED THE QUESTION.
    if (theSentenceSaysItsOwnOrder(input)) {
        const second = kept.findIndex((step, at) => at > first && spendsSomething(step));
        return {
            toRun: kept.slice(0, second),
            askAbout: [],
            heldForTheQuestion: kept.slice(second),
            overTheBound,
            theOrderWasGiven: true,
            secondReadings
        };
    }

    return {
        toRun: kept.slice(0, first),
        askAbout: costly,
        heldForTheQuestion: kept.slice(first),
        overTheBound,
        theOrderWasGiven: false,
        secondReadings
    };
}

/**
 * Whether the player's own sentence already says which comes first.
 *
 * ── FOUND BY PLAYING, AND IT IS THE QUESTION'S OWN LIMIT ─────────────────
 *
 *   > I go to Ninewatch and then sit down and cultivate for a year
 *
 * Two costly acts, and asking "which comes first?" is asking somebody to
 * repeat themselves: they wrote **and then**. The question earns its place
 * when the order is genuinely ambiguous - *"I sit for a year and take work for
 * a season"* names two things with no order between them - and not when the
 * player has already sequenced them.
 *
 * This is not the reader deciding on the player's behalf, which is the thing
 * the question exists to avoid. It is the reader reading. The decision is the
 * player's either way; the only difference is whether they had to make it
 * twice.
 *
 * Deliberately generous about what counts as a sequencing word, because the
 * cost of being wrong is running the act the player named FIRST - which is
 * what they said - and holding the rest, named, for a turn they can take
 * immediately. The cost of being wrong the other way is a question they have
 * already answered.
 */
export function theSentenceSaysItsOwnOrder(input: string): boolean {
    return /\b(?:and then|then|afterwards?|after that|after which|before|first(?:ly)?|next|finally|once (?:i|that|it)|when (?:i|that|it)(?:'s| is| am)? (?:done|finished|over))\b/i
        .test(input);
}

/**
 * COUNT SPANS OF THE SENTENCE, NEVER PATTERN HITS.
 *
 * Found by playing, and it is the failure mode a question about ambiguity walks
 * into on its own. Typed, on a live run:
 *
 *   > I settle in and work at the manual until I have enough to break through
 *
 *   work(manual), train_technique(manual)   -> "which comes first?"
 *
 * That is **one act, not two.** "work at the manual" matched two patterns, and
 * counting pattern hits turned one clause with two readings into two acts and
 * asked the player to choose between them. A player cannot answer that, because
 * there is nothing to answer: they named one thing to do.
 *
 * And the cost of getting it wrong is not only the wasted turn. Handed two verb
 * names for one object, the model wrote *"You set your focus on the work manual
 * first... The technique manual sits aside"* - it invented a second manual to
 * make the question make sense. **Ambiguity is normal, and a question about it
 * is not an answer.**
 *
 * ── HOW TWO STEPS ARE TOLD APART ─────────────────────────────────────────
 *
 * By the SPAN of the sentence they came from, when the reader said - two acts
 * are two clauses, and two readings of one clause overlap. Where no words were
 * supplied, by the object: two costly steps pointed at the same thing are one
 * act read twice, which is exactly the shape above.
 *
 * ── AND THE READING THAT LOST IS SHOWN, NOT SWALLOWED ────────────────────
 *
 * `AGENTS.md`: where a reading is a judgement call, show it. The discarded
 * reading goes to `secondReadings`, which reaches the engine channel and the
 * inspector - so a player who genuinely meant two things can see that the
 * sentence was taken as one, and say the other next turn. Nothing here is
 * silent, which is the whole difference between this and a dropped clause.
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
 *
 * The player's own words first, because that is what makes the answer one word.
 * Where the reader supplied none, the verb's player-facing name, plus whoever
 * or whatever it is pointed at - which is always enough to tell two acts apart,
 * since two acts on the same verb and the same target are one act.
 */
export function whatThisStepIsCalled(step: PlanStep): string {
    const said = (step.said ?? '').trim();
    if (said.length > 0) return said;

    const verb = plainNameOf(step.action.action);
    const at = step.action.target?.trim();
    return at ? `${verb} ${at}` : verb;
}

/**
 * The verb, said the way somebody would say it out loud.
 *
 * ── A PLAYER IS NEVER REQUIRED TO KNOW A STRING ──────────────────────────
 *
 * This used to fall back to the enum member with its underscores taken out, and
 * a played turn showed exactly what that costs. The question printed:
 *
 *   Which comes first? "taking the work manual" or "train technique manual"
 *   is answer enough.
 *
 * `train_technique` is an engine identifier and "the work manual" is not a
 * thing that exists - there was one manual. A question that offers a player two
 * strings, one of them internal, requires them to know a string to answer,
 * which `AGENTS.md` forbids by name. Worse, the model given two verb names for
 * one object obligingly invented two manuals to make the question sensible.
 *
 * So every verb that can ever be the subject of this question has a plain name,
 * and `tests/web/a-sentence-can-be-more-than-one-call.test.ts` fails if one
 * that can cost the player is missing or still carries an underscore. The
 * player's own words are still preferred over all of it - see
 * {@link whatThisStepIsCalled} - and this is the floor beneath them.
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
    buy: 'the purchase',
    sell: 'the sale',
    consume_pill: 'taking the pill',
    learn_technique: 'taking up the art',
    treat: 'having the wound seen to',
    gather: 'the gathering',
    refine: 'the refining',
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
    child: 'the child'
};

function plainNameOf(action: ActionName): string {
    return PLAINLY[action] ?? action.replace(/_/g, ' ');
}

/**
 * Every verb this question could ever have to name, for the guard test.
 *
 * Exported so the test reads the same set the code does rather than a list
 * somebody keeps beside it - a verb added to `ACTION_NAMES` that can cost the
 * player fails that test until it has been given words a person would use.
 */
export function everyVerbTheQuestionCouldName(): ActionName[] {
    return ACTION_NAMES.filter(name => !costsTheAskerNothing({ action: name }));
}

/**
 * The question, in the player's own terms, answerable in one word.
 *
 * Written so that nothing in it reads as a failure. It says outright that both
 * were understood and that the reason for asking is time rather than
 * comprehension, because the sentence being understood in full is the whole
 * point of the work this question sits on top of.
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
 *
 * The same shape and the same reasoning as `stillStands` next door: a question
 * raised in a run that has since ended, or against a cultivator who has since
 * died, is not a question about anybody who is standing here.
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
 *
 * Null is the ordinary and expected answer, not an error: the fork is not a
 * modal jail, so anything that is not one of the named acts is a new sentence
 * and gets read as one. That is why the matching below is deliberately strict
 * about not GUESSING - a loose match would steal a turn from somebody who had
 * changed their mind, which is the exact failure the non-modal rule exists to
 * prevent.
 *
 * Three ways to answer, in order of how somebody actually types:
 *
 *   - the ordinal - "first", "the second one", "1"
 *   - a distinctive word from the act's own name - "offer", "journey", "Peiyan"
 *   - the verb itself - "attack", "cultivate"
 *
 * A word that matches BOTH acts decides nothing and returns null, because the
 * player has not chosen and picking for them is what this whole file refuses to
 * do.
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
 *
 * Shared words are removed rather than scored, because a word both acts contain
 * is not a choice. "the offer to the Peiyan family" against "the journey to the
 * Peiyan family" leaves `offer` against `journey`, which is exactly the pair a
 * player would type one of.
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
 *
 * Structurally the `Execution` that `game.ts` keeps private, declared here so
 * this module does not have to reach into that file for a type and that file
 * does not have to export one. TypeScript's structural typing does the rest;
 * `ToolCallRecord` is imported for its type alone, so there is no runtime cycle.
 */
export interface OneCall<Event = unknown, Skip = unknown, Break = unknown, Heard = unknown> {
    facts: EngineFacts;
    events: Event[];
    timeSkip: Skip | null;
    breakthrough: Break | null;
    outcome: 'executed' | 'refused';
    calls: ToolCallRecordish[];
    hearing?: Heard | null;
}

/**
 * The inspector row, as much of it as folding needs to know.
 *
 * Deliberately the four fields every row has and not the two optional ones.
 * That makes a real `ToolCallRecord` assignable to this AND a row built here
 * assignable to a `ToolCallRecord`, so the executor needs no cast in either
 * direction and nothing has to be exported out of `game.ts` to make it work.
 */
export interface ToolCallRecordish {
    name: string;
    action: string;
    summary: string;
    ok: boolean;
}

/**
 * Whether the world stopped the plan here.
 *
 * ── A PLAN THAT STOPS HALFWAY IS AN OUTCOME, NOT A FAILURE ───────────────
 *
 * The design owner's ruling, and it is the thing that makes a sequence worth
 * having rather than merely convenient:
 *
 *   > "It's good that the 3 actions are independent, because you can try it,
 *   >  and be interrupted after taking his purse, or trying to hand it off, AND
 *   >  ALL OF THOSE ARE VALID RESPONSES TO WHAT YOU TRIED."
 *
 * One sentence, three places it can end, three different worlds. Caught taking
 * it and you are holding somebody's purse in front of them. Caught passing it
 * and two people know - the one you robbed and the one you tried to use. All
 * three and the frame lands on a man who did nothing. None of those needs a
 * rule of its own; they are what "resolved in order, each against the world the
 * last one left" produces for free.
 *
 * So this is not the executor declining to continue. **It is somebody noticing**,
 * and the noticing belongs to the world - to the witness reading the theft path
 * already does, to the refusal the target's own state already produces. The
 * sequence just stops where the world stopped it.
 *
 * ── AND THE HONEST SENTENCE NAMES THE FIRST FAILURE ──────────────────────
 *
 * Running the rest anyway is the tempting alternative and it is wrong: if the
 * theft did not come off, the purse is not in your hand, and a handoff that
 * fails for "you are not carrying that" is the engine explaining the second
 * consequence of the first failure. The player is owed the first one.
 *
 * Read off the engine's own marker rather than from a second classification.
 * `ToolCallRecord.ok` is documented as "false when the engine declined to act -
 * an ineligible attempt, a refusal", which is exactly the question, and it is
 * already set by every verb because the inspector already needs it.
 *
 * ── ONLY A STEP THAT SPENDS MAY STOP A PLAN ──────────────────────────────
 *
 * Found by playing this, against a live model, on the coordinator's own run:
 *
 *   > I look over the stalls, ask who is selling a manual, and buy the
 *   > cheapest one they have
 *
 *   market(Sixmile)          43 things on offer, four manuals priced
 *   interact(merchants)      "merchants" matched nobody
 *   buy(the cheapest manual) NEVER RAN
 *
 * The middle step is a FREE read whose target was a category rather than a
 * person, and stopping there threw away the act the whole sentence was for.
 * That is the failure AGENTS.md names in the clause "at most one act that
 * spends time, stones or the body, **and it is the one they asked for**": a
 * free read had outranked a costly act, and the player who asked to do
 * something and to look while doing it got only the looking.
 *
 * So the rule is narrowed to the thing it was always reaching for. **A read
 * that came back empty is information, not an obstacle.** It changed nothing,
 * so nothing after it can have depended on its having happened - only on what
 * it would have told the reader, which the reader did not have at planning time
 * either. A COSTLY act that did not come off is the other case entirely: the
 * purse did not move, the theft was seen, and the step after it genuinely has
 * nothing to work with.
 *
 * The failed read stays fully visible - its `ok: false` row is in the inspector
 * and its refusal is in the facts - and the plan carries on past it.
 */
export function theWorldStoppedHere(
    call: Pick<OneCall, 'outcome' | 'calls'>,
    step: PlanStep
): boolean {
    return howTheStepWent(call, step) === 'did_not_come_off';
}

/**
 * A step can fail, or it can succeed into a world that will not carry the next
 * one. Those are different things and the player has to be able to tell them
 * apart.
 *
 * ── THE MEASUREMENT THAT FORCED THE DISTINCTION ──────────────────────────
 *
 * Played live, and reported by the coordinator verbatim:
 *
 *   > I rob Cao Antao and then run away to Ninewatch
 *
 *   Cao Antao: taken.
 *   Reprisal: injured. Weighed as serious robbery against Shen Kuo.
 *   Lift: 0 of 0 stones, capped at 72
 *
 *   "That is as far as it went: "the approach to Cao Antao" did not come off"
 *
 * **It came off.** The ruling directly above the summary says `taken`, and the
 * man now knows something happened to him. What actually occurred is that the
 * theft SUCCEEDED and the person was carrying nothing, and the wound it cost
 * is the interesting part of the turn.
 *
 * Reporting that as a failure inverts the lesson. The player is told robbery
 * does not work for them, when the truth is that robbery works fine and this
 * particular man had an empty purse - and that finding out cost half their
 * body. One of those teaches them something true about the world; the other
 * teaches them something false about themselves, and they will play the next
 * fifty turns on it.
 *
 * ── WHY THE POSITIVE SIGNAL WINS ─────────────────────────────────────────
 *
 * The old rule looked only for a false row on the step's own verb, and a landed
 * theft files several rows - the resolver, the marks, the lift, the reprisal -
 * of which at least one can be false while the act plainly happened. So the
 * question is asked the other way round: **did anything on this verb succeed?**
 * A `taken` resolution files `ok: true` against its own verb, and that outranks
 * any false row beside it, because a step that did something did something.
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
 *
 * The sentence the coordinator asked for, and the one this layer is actually
 * good at producing: not "it failed" but "it worked, and what it cost you is
 * why the rest did not happen". Never asserts a cause the engine did not
 * compute - what it says is that the act landed and the run did not survive it,
 * both of which are rows.
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
 *
 * Written as an account of the world rather than as a report about the
 * executor. *"Step 2 of 3 was not executed"* is a parser talking about itself;
 * what happened is that the first thing did not come off, so the second had
 * nothing to happen to.
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
 *
 * ── EVERY CALL STAYS VISIBLE ─────────────────────────────────────────────
 *
 * `calls` is concatenated in the order it ran and nothing is summarised away,
 * because the inspector is the only defence against a model quietly doing
 * something the player did not ask for. A turn with six calls shows six, plus a
 * boundary row per step naming the verb and where in the sentence it came from,
 * so the order is readable rather than inferred.
 *
 * ── AND SO DOES EVERY WORD THE ENGINE SAID ───────────────────────────────
 *
 * `lines`, `structure` and `required` concatenate; `prose` joins on a blank
 * line. Nothing is deduplicated and nothing is trimmed to fit: a fact that
 * reached the player when it was the only call must still reach them when it
 * was the second of three, or this feature has quietly reintroduced the dropped
 * clause it was built to fix.
 *
 * `outcome` is `executed` if anything executed. A turn where a free read was
 * refused and the costly act landed is not a refused turn, and the refusal is
 * still in `calls` with `ok: false` on it, which is where a refusal belongs.
 */
export function foldTheCallsIntoOneTurn<Event, Skip, Break, Heard>(
    calls: readonly OneCall<Event, Skip, Break, Heard>[],
    headline?: string
): OneCall<Event, Skip, Break, Heard> {
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
        hearing: calls.map(call => call.hearing).find(heard => heard != null) ?? null
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
 *
 * `ok: true`, and that is not a slip. Nothing failed here - the sentence was
 * understood in full, which is the opposite of a refusal - and marking it as a
 * failure in the one surface an operator reads to find failures would be the
 * question lying about itself.
 */
export function theRowThatAsksWhichFirst(fork: WhichComesFirst): ToolCallRecordish {
    return {
        name: 'engine.whichComesFirst',
        action: 'ask',
        summary: whatTheQuestionAsksStructurally(fork),
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
 *
 * The first act ran; the rest is still to come. Written as a fact about where
 * they now stand rather than as a report about the executor - *"the sitting is
 * still ahead of you"*, never *"step 2 of 2 was not executed"* - and it must
 * not read as a refusal, because nothing was refused. They said "then", the
 * turn took them at their word, and the second half is theirs to take next.
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

/** The sentence a player reads when the bound cut something off. */
export function sayingWhatTheBoundCutOff(over: readonly PlanStep[]): string {
    const named = over.map(whatThisStepIsCalled);
    return `That was more than one turn's worth of asking, so ${named.join(', ')} `
        + `${named.length === 1 ? 'was' : 'were'} left. Nothing was spent on `
        + `${named.length === 1 ? 'it' : 'them'}; say it again and it will run.`;
}
