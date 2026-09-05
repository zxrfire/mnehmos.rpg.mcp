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
    /**
     * This step CHOOSES from what the step before it found; it does not act.
     *
     * When present the executor runs no verb at all - it resolves a name out of
     * the rows the turn is already holding, says who was picked, and spends
     * nothing. `action` is carried only so every other reader of a step keeps
     * working, and is always a read.
     *
     * See {@link theSelectionInThisClause} for why a selection must never
     * price as an act.
     */
    readonly selects?: ASelection;
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
    /**
     * Steps the reading layer declined and removed, in the player's own words.
     *
     * A clause that never became a step is invisible to everything downstream -
     * the executor cannot report a step it was not given, and the narrator is
     * then the only thing in the turn that knows the clause existed. Measured,
     * it filled the gap: handed a turn whose only rulings were a refusal, a
     * model wrote *"You take the purse from Cao Antao and press it into Shen
     * Liefeng's hand"*. A clause the reader dropped needs exactly the treatment
     * a clause the budget declined already gets.
     */
    readonly droppedClauses?: readonly PlanStep[];
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

/**
 * The player's sentence, cut where a person would cut it.
 *
 * Commas, `and`, `then`, `before`, `after` - the joins people actually use to
 * put three acts in one line. Deliberately dumb: it is not parsing the
 * sentence, it is finding the places a clause could begin, because everything
 * downstream re-reads each piece with the ordinary table anyway.
 */
export function theClausesOf(input: string): string[] {
    return input
        .split(/,|;|\band then\b|\bthen\b|\band\b|\bafter that\b|\bbefore that\b|\bafterwards\b/i)
        .map(part => part.trim())
        .filter(part => part.split(/\s+/).filter(Boolean).length >= 2);
}

/**
 * Whether ANY clause of the player's own sentence reads as this verb.
 *
 * ── THE MEASUREMENT THAT MADE THIS NECESSARY ─────────────────────────────
 *
 * Played live, the owner's own acceptance sentence:
 *
 *   > I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away
 *
 * The model returned all three steps correctly - `interact/steal`, `give`,
 * `move/flee`. The danger check then DECLINED the first and the third, because
 * the model had emitted no `said` for them, so each was compared against a
 * reading of the WHOLE sentence, which the table calls `give`. Both were
 * replaced by that reading, the plan became `give -> give -> give`, and
 * `oneClauseIsOneAct` collapsed it to one. **The theft did not survive the
 * layer that exists to stop a model escalating - and the model had not
 * escalated anything.** It had read the sentence exactly right.
 *
 * The invariant is *a player must not meet a bigger bill for the same words*.
 * A whole-sentence reading is not "the same words" as one clause of it, and
 * `said` - which the reader may simply not send - is the wrong thing to hang
 * the comparison on. So the question is asked of the PLAYER'S TEXT directly:
 * cut their sentence where a person would cut it and ask whether any piece of
 * it reads as this verb with no model in the room.
 *
 * That cannot be gamed. Every clause comes from what they typed; the model
 * contributes nothing to this test but the verb being checked. And it is
 * strictly narrower than trusting `said`, because a quoted clause the reader
 * invented would fail it.
 */
/**
 * Clauses of the player's sentence that no step of the plan accounts for.
 *
 * ── WHY A DROPPED CLAUSE IS THE WORST OF THE THREE ───────────────────────
 *
 * A clause the budget held is reported. A clause the danger check declined is
 * reported. A clause the READER simply never turned into a step is invisible to
 * everything downstream - the executor cannot report a step it was not given -
 * so the narrator becomes the only thing in the turn that knows the clause was
 * ever there. Measured, that is exactly what it does with the knowledge:
 *
 *   > I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away
 *
 * over a turn holding one refusal, the prose read *"You take the purse from Cao
 * Antao and press it into Shen Liefeng's hand"*. Neither happened.
 *
 * ── HOW A CLAUSE IS FOUND WITHOUT TRUSTING THE READER ────────────────────
 *
 * Not by comparing against `said`, which the reader may not send and which is
 * the thing that failed here. The player's own sentence is cut into clauses and
 * each one is read with no model in the room: a clause that reaches a real verb
 * which no step in the plan carries is a clause the split lost.
 *
 * ── AND ONLY A CLAUSE THAT WOULD HAVE COST SOMETHING ─────────────────────
 *
 * The house rule, already measured elsewhere in this package against a corpus
 * of sixty ordinary sentences containing "and": reporting every clause whose
 * reading differs from the turn's produced seven false reports and every one of
 * them was a free read. This reproduced it immediately - "who is here, what am
 * I carrying, and what do I know of them" ran `look, status, recall` and the
 * middle clause also reads as `inventory`, so a free read the model had routed
 * to its neighbour was announced to the player as a thing that did not happen.
 *
 * Nothing was taken, so there is nothing to report. A free read the player
 * still wants is theirs next turn for nothing.
 *
 * Conservative in the other direction too: two clauses reading as the same verb
 * count as covered by one step, so this under-reports rather than over-reports.
 * A false report tells a player something did not happen when it did, which is
 * the same lie this exists to prevent, pointed the other way.
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
 * The player's whole sentence as a plan, with any act the reader missed put
 * back in the position they wrote it.
 *
 * ── WHY THE SENTENCE OUTRANKS THE READER ON THIS ONE QUESTION ────────────
 *
 * Played, repeatedly, against a live model:
 *
 *   > I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away
 *   read as 2: interact(Cao Antao), move(away)
 *
 * Three clauses in, two acts out, and the one it lost is **the middle one** -
 * which is the clause the other two exist for. Take and walk away is a person
 * leaving. The handover is what makes it a frame-up. Everything downstream
 * behaved correctly on what it was handed; it was handed a smaller sentence
 * than the player typed.
 *
 * **How many acts are in a sentence is a property of the sentence, not a
 * judgement the reader makes.** That is the same division this architecture
 * runs on everywhere else - the engine rules, the model reads, and a reader is
 * never given more authority for having more reach. A model that under-splits
 * is not exercising judgement, it is failing to read, and the player's own
 * words are sitting there to be read instead.
 *
 * It is also what makes composition a property of the GAME rather than of the
 * top tier. There are four reading tiers down to a browser embedding, and if a
 * three-act sentence only composes when a good model splits it, composition is
 * a feature the bottom three do not have.
 *
 * ── THE TWO GUARDS, BOTH ALREADY MEASURED ────────────────────────────────
 *
 * **Only a clause that would COST something.** A free read the model routed to
 * its neighbour must not be re-run or announced - the house rule, and it caught
 * a live false positive the moment it was left out.
 *
 * **Never a step the player did not write.** Every backfilled step is the
 * deterministic reading of a clause of their own typed sentence, so this cannot
 * invent an act, and it cannot be steered by a model: the model contributes
 * nothing to a backfill but the gap that let it happen.
 *
 * ── AND IT NEVER REORDERS WHAT THE READER SENT ───────────────────────────
 *
 * The reader's steps come out in the order it sent them. A backfill is placed
 * between them, at the clause position the player wrote it in, which is the
 * only thing being decided here. Order is meaning in this file and a backfill
 * must not be the thing that changes it.
 */
export interface TheSentenceAsAPlan {
    steps: PlanStep[];
    backfilled: PlanStep[];
    /**
     * What happened to each clause, in the player's own words.
     *
     * ── WHY THIS IS NOT DEBUG OUTPUT ─────────────────────────────────────
     *
     * The backfill worked in one played transcript and silently did nothing in
     * the next, on the same build, because the model's split differed - and
     * every `continue` in the fill is a clause disappearing without saying why.
     * Reasoning about it from outside cost a round trip and did not settle it.
     *
     * `AGENTS.md` asks that where a reading is a judgement call, it is shown.
     * This is that rule applied to the reading that decides how many acts a
     * sentence contains, and it goes to the routing row an operator can already
     * open beside every turn.
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

    // ── A CLAUSE THAT CHOOSES IS A CHOICE, WHATEVER ANYBODY READ IT AS ──
    //
    // Decided from the clause and never from the reader, for the same reason
    // everything else here is: the sentence is the authority on what its own
    // clauses are. Played, "pick the strongest one" reached `gather` - the herb
    // verb - and a choice that takes nothing from anybody became one of two
    // costly acts the turn then asked the player to choose between.
    const chooses = clauses.map(theSelectionInThisClause);

    // Which clause each of the reader's steps is answering. `said` when it
    // quoted the player; otherwise the first clause not yet spoken for whose
    // own reading reaches the same verb.
    const spokenFor = new Set<number>();
    const positionOf = fromTheReader.map(step => {
        // A quotation claims its clause only when the two READINGS agree.
        //
        // Found by driving a reader's real answer through this: a step labelled
        // with clause 0's words - "I take Cao Antao's purse" - while carrying
        // the verb `give` claimed the theft's clause, so the theft was never put
        // back, and the fill then produced a SECOND `give` for the clause that
        // really was one. The act at the head of the owner's own sentence
        // disappeared with nothing said about it.
        //
        // A label the reader attached is the reader's account of the sentence;
        // the clause's own reading is the sentence's. Where they disagree, the
        // sentence wins, which is the same rule the rest of this file runs on.
        // The step is not lost by it - it falls through to the verb match below,
        // and where that finds nothing it keeps its place unpositioned.
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
                // ── A FREE CLAUSE IS PUT BACK ONLY WHERE THE READER
                //    PLAINLY UNDER-SPLIT ─────────────────────────────────
                //
                // The measured rule - never re-run a free read the reader
                // routed to its neighbour - is about a reader that answered
                // every clause and merely chose a different verb for one:
                // "who is here, what am I carrying, and what do I know of them"
                // ran look/status/recall, and the middle clause also reads as
                // `inventory`. Re-running that is duplicate work over a
                // sentence nobody lost anything from.
                //
                // It is a different thing when the reader answered with FEWER
                // ACTS THAN THE SENTENCE HAS CLAUSES. Played: "I look over who
                // is here, pick the strongest one of them, and ask them about
                // their sect" came back with one step, and the looking and the
                // asking - both free, both plainly asked for - simply did not
                // happen. Nothing was taken from the player, and nothing was
                // given to them either.
                //
                // So a free clause is put back exactly when the count says a
                // clause was lost rather than merely read differently. It costs
                // nothing either way, which is why the bar can be this low.
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
        //
        // `said` is optional and a model may simply not send it, and three
        // separate consumers then compare one clause against a reading of the
        // whole sentence: the danger check, the dropped-clause report, and
        // whether a clause merely said why. This fills the field only from the
        // clause the step has just been POSITIONED at, which is the player's
        // own text by construction, so it can invent nothing and override
        // nothing - a step that quoted the player keeps its own quotation.
        // A reader step that answers no clause AND whose words point at a
        // clause that only CHOOSES is that clause's step, read as an act. The
        // clause has its own step now, so this one is superseded rather than
        // kept and priced. Every other unpositioned step is kept where it was.
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
 * Whether a step the reader sent was really answering a clause that only
 * chooses.
 *
 * Matched on the step's own words where it quoted the player, and otherwise on
 * its target - `gather(strongest one)` points at "pick the strongest one" by
 * carrying the words out of it. Narrow on purpose: a step matching neither is
 * kept, because dropping a step nobody can place is the loss this whole file
 * exists to prevent.
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
 *
 * ── THE CASE, PLAYED ─────────────────────────────────────────────────────
 *
 *   > I look over who is here, pick the strongest one, and tell them I want
 *   > their sect to answer for something
 *
 *   read as 2: gather(strongest one), interact(unnamed cultivator)
 *   Which comes first? "pick the strongest one" or "the approach to unnamed
 *   cultivator"?
 *
 * Two things wrong and they are the same thing. The middle clause is a
 * SELECTION FROM WHAT THE FIRST ONE RETURNED - the room read gives a set of
 * people and *the strongest one* is a row in it - and nothing carried the set,
 * so the third clause's target came out as the placeholder the reader invented.
 * And because the selection landed as a costly verb, a three-clause sentence
 * became a question about a choice that spends nothing.
 *
 * ── WHY THIS IS TRACTABLE AND NOT A QUERY LANGUAGE ───────────────────────
 *
 * **The superlative names the field.** Strongest is a rung, oldest is an age,
 * nearest is a distance, cheapest is a price - each one a comparison the engine
 * already makes, over rows the previous step already fetched. So this is a small
 * closed vocabulary of superlatives over a set the turn is already holding, and
 * it must not grow into anything more: a clause that does not name a field this
 * way is not a selection and is left alone.
 *
 * ── AND A SELECTION IS NEVER AN ACT ──────────────────────────────────────
 *
 * Picking somebody out of a group costs nothing. It is choosing a target, not
 * doing something to them, and the moment it prices as an act the sentence
 * above turns into a question about a choice that spends nothing - which is
 * exactly what a played turn did. `selects` on a step is what makes that
 * structural rather than a classification somebody has to remember: the
 * executor never runs a verb for it.
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
 *
 * Closed, and deliberately small. Every entry is a comparison the engine
 * already makes somewhere on data it already holds; a word that does not name
 * a field the engine can compare has no business here, because the alternative
 * to refusing it is guessing what the player meant about their own life.
 */
/** The words a place's ground goes by, on a row or in a sentence. */
const GROUND = '(?:air|qi|ground|vein|veins|energy)';

/**
 * Ground asked for at its best, however the comparison is phrased.
 *
 * Either order, because people say both: "the best air" and "the air is
 * thickest". A bare `best` counts only next to a ground noun - "the best one"
 * on its own names no field, and guessing one would be this rule reaching past
 * what it knows.
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
 *
 * **The strongest signal there is that a selection is meant**, and stronger than
 * the superlative: *"take the road to whichever of them has the best air"* says
 * outright that the choice is being made out of something already in hand. A
 * clause carrying one of these needs no choosing verb and no "somewhere" frame,
 * because the player has said what they are choosing from.
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
    // GROUND, the fifth field, and the one with rows in hand on a turn where
    // the player has just asked where they could go. Every place carries an
    // `ambient` band and the read prints it on every row - "a spirit tide,
    // triple rate", "thin qi, half rate" - so this is `pick the strongest one`
    // with the field being ground instead of rung.
    //
    // Matched on the COMPARISON and never on a word shape, because the played
    // sentence had no superlative in it at all: "whichever of them has the best
    // air". `best`, `most`, `thickest`, `densest` and "thick enough to matter"
    // are one selection said five ways, and only one of them ends in -est.
    [GROUND_COMPARED_UPWARD, 'ambient', 'most'],
    [GROUND_COMPARED_DOWNWARD, 'ambient', 'least']
];

/**
 * The frames in which a superlative is a CHOICE rather than a description.
 *
 * Required, and it is the whole guard against this swallowing ordinary
 * sentences. "I attack the strongest one" is an act with a superlative target
 * and belongs to `attack`; "pick the strongest one" is a choice and belongs
 * here. Without this, every sentence containing a superlative would become a
 * free selection step and the act in it would be lost - the defect this file
 * exists to prevent, caused by the fix for it.
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
 *
 * ── THE GAP THIS CLOSES, MEASURED ────────────────────────────────────────
 *
 *   > I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away
 *
 *   engine.handOver:  No pouch row matched "it". Nothing moved, no time passed.
 *
 * The second step's object arrived as the literal string `it`, was looked up
 * among the things the player is carrying, and of course matched nothing. **A
 * pronoun in step N means the thing step N-1 was about**, and until something
 * carries that forward `it` can only ever be a missing pouch row.
 *
 * The set is closed and short on purpose. These are the words that stand for
 * "the thing we were just talking about" and nothing else; anything outside it
 * is a name the resolvers already handle, and widening this would start
 * rewriting objects the player named explicitly.
 */
const A_PRONOUN_FOR_THE_LAST_THING: ReadonlySet<string> = new Set([
    'it', 'them', 'that', 'those', 'this', 'these', 'the same', 'the thing', 'the same thing'
]);

/**
 * What a reader writes when it knows a target is coming and has no name yet.
 *
 * Played, on "I look over who is here, pick the strongest one, and tell them I
 * want their sect to answer for something": the third clause's target came back
 * as the literal string `unnamed cultivator`. That is the reader saying "the
 * one that was chosen" in the only way it can, and it means exactly what a
 * pronoun means - so it resolves the same way, against whatever the choice
 * before it landed on.
 *
 * A phrase naming the superlative itself - "the strongest one" - is here for
 * the same reason: a clause that chose it has already turned it into a person,
 * and the clauses after it are talking about that person.
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
 *
 * The head has to be a PRO-FORM - `one`, `ones`, or nothing at all. A
 * superlative with a real noun after it names a real thing and is the
 * resolvers' business: "the cheapest manual" is a manual, and rewriting it to
 * whatever the last clause chose would be this rule reaching past what it
 * knows. Caught by a test that had `buy the cheapest manual` in it already.
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
 *
 * Generic rather than a noun catalog, which would be a second catalog of the
 * world's objects living in the reading layer. A clause a person writes in a
 * plan is `<verb> <object>` - "take Cao Antao's purse", "buy the cheapest
 * manual" - so dropping the leading pronoun and verb leaves the object, and
 * every resolver downstream already knows how to match a phrase like that
 * against real rows. Nothing here decides whether the thing exists.
 *
 * Null when the clause names no object, or names another pronoun, in which case
 * whatever was already carried stays carried.
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
 *
 * Only ever fills a field that is EXACTLY a pronoun - never one carrying a name
 * the player wrote - and only from a phrase that came out of the player's own
 * sentence. So this cannot invent an object, cannot override one, and cannot
 * make a step point at something nobody mentioned. It decides no outcome: the
 * substituted phrase goes to the same resolver the typed phrase would have gone
 * to, and is refused by it in the ordinary way if nothing matches.
 */
export function carryingTheReferentForward(step: PlanStep, lastThing: string | null): PlanStep {
    if (lastThing === null) return step;

    const action = { ...step.action };
    let changed = false;
    if (standsForTheLastThing(action.target)) { action.target = lastThing; changed = true; }
    if (standsForTheLastThing(action.topic)) { action.topic = lastThing; changed = true; }

    // ── A PRONOUN THE TABLE DROPPED IS STILL A PRONOUN ──────────────────
    //
    // Played: "ask them about their sect", after a clause that had chosen Yu
    // Lanyin, reached the engine as `interact()` with NO target - the table
    // read the topic and let the "them" go - and the approach landed on
    // whoever happened to be nearest. The pronoun was in the player's sentence
    // and meant somebody the turn had already named.
    //
    // Filled only where the verb takes a target, the step has none, and the
    // player's own clause carries the pronoun. It overrides nothing, because
    // there is nothing there to override.
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
    /**
     * Clauses that stated why, and were counted as reasons rather than as acts.
     *
     * Shown for the same reason `secondReadings` is: it is a judgement call
     * about the sentence, and the player is owed the chance to see it and say
     * otherwise. Engine channel only - nothing was declined and nothing was
     * spent, so there is nothing here a player is owed in prose.
     */
    readonly statedReasons: readonly PlanStep[];
}

/**
 * A clause that states a need rather than naming an act.
 *
 * ── FOUND BY PLAYING, AND IT IS A QUESTION WITH NO ANSWER IN IT ──────────
 *
 *   > I need to eat, so I take whatever work will feed me for a season
 *
 *   eat(), work(any)   -> "Which comes first? 'I need to eat' or 'taking the
 *                         work any'?"
 *
 * **"I need to eat" is a reason, not an act.** The player is saying WHY they
 * are doing the thing in the second half, and there is one act in that
 * sentence. The player cannot answer that question because there is nothing in
 * it to answer - the same shape as *"work the water until I have enough for the
 * physician"*, which {@link THE_CLAUSE_THAT_SAYS_WHY} already settles from the
 * other end.
 *
 * ── AND ON ITS OWN IT IS THE ACT, WHICH IS THE WHOLE OF THE CARE ─────────
 *
 * A hungry player typing *"I need to eat"* and nothing else is asking to be
 * fed, and must be. So this never decides anything by itself: it says only that
 * a clause is PHRASED as a need, and {@link whatThisTurnMayRun} discounts it
 * only where a real act is standing beside it in the same sentence. Where the
 * need is the only thing said, it is what the turn does.
 *
 * Two or more needs and no act keeps them all, for the same reason: somebody
 * who says "I need to eat and I need to find work" has named two things and
 * discounting both would leave a turn with nothing in it.
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
 *
 * A reason is discounted only where an act survives it. Nothing is dropped
 * silently: what comes back in `reasons` reaches the engine channel, and it
 * cost nothing either way - a stated need that was really a request is one
 * word away next turn and no day passed on it.
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

    // THE PLAYER MAY HAVE ALREADY ANSWERED THE QUESTION.
    if (theOrderIsAlreadySettled(kept, input)) {
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
 *
 * ── FOUND BY PLAYING, AND IT IS THE QUESTION'S OWN LIMIT ─────────────────
 *
 *   > I go to Cloud Gate and then sit down and cultivate for a year
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
 *
 * ── SAYING WHY IS ALSO SAYING WHEN ───────────────────────────────────────
 *
 * Found by playing, at 1 of 40 health and 2 spirit stones, with the game's own
 * refusal saying *"Earning is the move before either of them"*:
 *
 *   > I keep my head down and work the water for a year until I have enough
 *     for the physician
 *
 *   work(water), buy(physician's visit)   -> "which comes first?"
 *
 * There is nothing there to answer. **A clause saying what an act is FOR says
 * what order it goes in**, and says it more firmly than `and then` does: you
 * cannot buy a thing with money you are still working to earn, so the earning
 * is first by the meaning of the sentence rather than by a word placed between
 * two halves of it.
 *
 * The model handed this sentence understood it perfectly and said so - *"To
 * labor through the year is to commit to a span that will inevitably precede
 * the seeking of the physician. You have set your path: first the work, then
 * the cost"* - underneath a question insisting the order was unknown. When the
 * reader is the only party at the table that cannot see the order, the reader
 * is what is wrong.
 *
 * The generosity argument above applies here with more force, because the
 * subordinate half is the one that gets held: being wrong runs the work and
 * names the physician as still ahead, which is what the player asked for
 * either way.
 */
export function theOrderIsAlreadySettled(
    steps: readonly PlanStep[],
    input: string
): boolean {
    if (theSentenceSaysItsOwnOrder(input)) return true;

    // ── A BACK-REFERENCE FIXES THE ORDER AS FIRMLY AS "THEN" DOES ───────
    //
    //   > I take Cao Antao's purse, press it into Shen Liefeng's hand, and
    //   > walk away
    //
    // No sequencing word anywhere, and the order is not in the least ambiguous:
    // **it** means the purse, so the pressing cannot precede the taking. Asking
    // which comes first is asking the player to repeat themselves, which is the
    // failure this whole branch exists to avoid - and it is worse here, because
    // the sentence is the one the design owner wrote to show what composition is
    // for. A step that refers back to an earlier one is chained to it by the
    // language, and a chain cannot be reordered.
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
 *
 * `until` is the commonest and is the reason this exists. The rest are how the
 * same sentence gets written: a purpose (`so I can`, `in order to`), a price
 * (`to pay for`, `to afford`), or a threshold (`enough for`).
 *
 * Kept to subordinators that genuinely bind one act to another. Bare `to` is
 * deliberately absent - "I go to Cloud Gate" would match it, and an infinitive
 * of motion is not a purpose clause.
 *
 * ── AND A BARE `so` JOINING A REASON TO A CONSEQUENCE ────────────────────
 *
 * Found by playing, and it is the same pattern with its halves swapped:
 *
 *   > I need to eat, so I take whatever work will feed me for a season
 *
 * The forms above are all *act, then why*. This is *why, then act*, and it is
 * how people talk when they are explaining themselves - which is what a player
 * does before they have learned to be clipped. `so I`, `and so`, `because` and
 * `since I` are one connective doing one job, and the order they fix is not in
 * the least ambiguous: the reason cannot come after the thing it is the reason
 * for.
 *
 * `so I` rather than bare `so`, because bare `so` is also an intensifier - "I
 * do it so quietly" - and an intensifier says nothing about order.
 */
const THE_CLAUSE_THAT_SAYS_WHY =
    /\b(?:until|so (?:i|that i) (?:can|could|have|am)|in order to|so as to|to pay for|to afford|enough (?:for|to)|so (?:i|we)\b|and so\b|because\b|since (?:i|we)\b)/i;

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
/**
 * The names that already end in the word that joins them to an object.
 *
 * Computed rather than listed, because it is a property of the words: "the
 * journey to", "the approach to", "the fight with", "carrying the news to" are
 * all written to have something put after them, and a name that is not is not.
 */
const JOINS_TO_AN_OBJECT = /\b(?:to|with|at|on|for|of|into|from)$/i;

/**
 * THE OBJECT FORM, FOR NAMES THAT ARE COMPLETE ON THEIR OWN.
 *
 * -- WHAT THIS FIXES, AND IT IS WRONG ON CORRECT TURNS TOO ----------------
 *
 * Played:
 *
 *   Which comes first? "the purchase a physician's visit" or "I find a doctor"
 *
 * **"the purchase a physician's visit" is not English.** `PLAINLY` holds two
 * kinds of name and the code glued the target onto both: the object-taking ones
 * read correctly - "the journey to Silver Island", "the approach to Bai Xuping" -
 * and the self-contained ones did not. "the sale a manual", "the hunt a boar"
 * and "the gathering herbs" were all one played turn away.
 *
 * This is worth fixing independently of the splitting, because it reads badly on
 * every turn the question fires INCLUDING the turns where the split is right.
 *
 * -- AND THE TARGET IS NOT DROPPED WHERE IT IS DOING WORK -----------------
 *
 * `whatThisStepIsCalled` carries the target so two acts can be told apart, and
 * two acts on one verb and one target are already one act. So the fix is a
 * joining word rather than a deletion: only where a verb has neither a joining
 * name nor an object form does the name stand alone, which is the honest
 * fallback and reads as English.
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
 *   market(Six Li)          43 things on offer, four manuals priced
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
 *   > I rob Cao Antao and then run away to Cloud Gate
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

/**
 * The row that names a clause counted as a reason rather than as an act.
 *
 * `ok: true`, and for the same reason the question's own row is: nothing
 * failed. The sentence was understood in full and one act came out of it, which
 * is what the sentence contained. It reaches the engine channel only - there is
 * nothing here a player is owed in prose, because nothing was declined and
 * nothing was spent.
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

/**
 * What the player reads when the reading layer dropped one of their clauses.
 *
 * Said as a fact about the sentence rather than about the reader, and it names
 * the plain way to say the thing - which is what the decline itself already
 * knows and what a refusal in this repository owes the player.
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
 *
 * ── FOUND BY PLAYING, AND IT IS A LIE IN THE PLAYER'S DIRECTION ──────────
 *
 *   > I press Cao Antao's purse into Shen Liefeng's hand and walk away
 *
 * The model added a third step - `interact(Cao Antao, steal)`, a theft the
 * sentence does not ask for and which had already happened a turn earlier. The
 * danger check declined it, correctly. And then the turn told the player:
 *
 *     "the approach to Cao Antao" was not part of what happened - that part of
 *     the sentence did not become an act. Say it on its own and it will run.
 *
 * **There is no such part of the sentence.** Reporting an invented act as a
 * lost clause teaches the player their words were misread, and invites them to
 * say again a thing they never said - which is the one direction a report like
 * this must never be wrong in.
 *
 * So a dropped step reaches the player only when its words are genuinely
 * theirs. Everything else is an inspector row, where an operator can see the
 * reader reaching for something nobody asked for, which is exactly the thing
 * that surface exists to show.
 */
export function theseWereThePlayersOwnWords(step: PlanStep, input: string): boolean {
    return theClauseThisStepQuotes(step, input) !== null;
}

/**
 * Who the choice landed on, said to the player.
 *
 * ── SAYING IT IS NOT DECORATION ──────────────────────────────────────────
 *
 * The engine resolving *the strongest one* to a named person is a judgement,
 * and `AGENTS.md` asks for a judgement to be shown. It is also the difference
 * between this working and this being spooky: a player who meant somebody else
 * can only correct it if they are told who was chosen, and the field it was
 * chosen on is what makes the correction possible - "strongest" and "oldest"
 * pick different people out of the same room.
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
 *
 * Names a route, like every refusal in this package: the reason it found
 * nothing is either that the player knows nobody here or that this kind of
 * comparison has no rows on this turn, and both are things they can act on.
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
