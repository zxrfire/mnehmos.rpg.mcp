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

/**
 * Somebody handing a thing over, and somebody taking one off a person.
 *
 * The two families the model must never confuse, read off the plan rather than
 * off a second list of verbs: `give` is the whole of one, and the other is the
 * `steal` intent plus the two verbs whose point is that the thing is not being
 * handed over willingly.
 *
 * Deliberately NOT symmetrical with the cost rule. A model reading a THEFT as a
 * gift is the harmless direction - it refuses the taking and hands the player
 * back the cheaper reading - and it is already covered by the ordinary rule
 * that a model may read a sentence any way it likes. What may not happen is the
 * other way about.
 */
function readsAsGiving(plan: PlannedAction): boolean {
    return plan.action === 'give';
}

function readsAsTaking(plan: PlannedAction): boolean {
    if (plan.action === 'coerce') return true;
    if (plan.action === 'attack') return true;
    return plan.action === 'interact' && plan.intent === 'steal';
}

/**
 * A reading that changes what the player IS, rather than what a turn costs.
 *
 * ── THE THIRD AXIS, AND IT WAS THE HOLE THE WORST ONE CAME THROUGH ───────
 *
 * The cost rule below is gated on {@link TIME_CONSUMING_ACTIONS}, and `sect` is
 * on neither that list nor `READ_ONLY_ACTIONS`. So a model answering `sect` was
 * waved through at the cheap exit and its reading was NEVER compared against
 * the sentence's own. Measured with a scripted provider, at ordinal 25:
 *
 *   > if they'll have me, I'll join
 *   sect_manage.join: "Taken on by Azure Dew Sect, ranked Dew Elder."
 *
 * The player stated a policy contingent on a fact they did not have and was
 * enrolled at the house's elder tier. Nothing about the house, the bar or the
 * rank was wrong - `entryRankIndexFor` seats a cultivator at 25 exactly there,
 * by design. What was wrong is that a model's reading put somebody on a roll
 * and no guard looked at it.
 *
 * Checked OUTSIDE the cost rule and separately from it, for the reason the
 * giving-and-taking rule states two functions up: cost is not the axis this is
 * about. Joining a house takes no days at all, and it is the single most
 * consequential thing a turn can do to somebody - it is the difference between
 * being nobody and being a Dew Elder, and everything downstream reads off it.
 *
 * The axis is whether the sentence NAMES A HOUSE, because that is precisely
 * what `GameService.sect` dispatches on: a named house that resolves is a join,
 * and no house named is the listing. Keying on `intent` would have missed it -
 * the deterministic reading of "I join the Azure Dew Sect" carries no intent at
 * all and still enrols.
 *
 * `leave` rides along because it is the same act with the sign flipped, and
 * because INSTANCE 3 at the top of `asking-is-not-doing.ts` is a played run
 * where "can I leave my sect" LEFT it. That fix guards the deterministic
 * reading; this guards a model asserting the same thing.
 */
function changesWhoYouAre(plan: PlannedAction): boolean {
    if (plan.action !== 'sect') return false;
    if (plan.intent === 'leave') return true;
    return (plan.target ?? '').trim().length > 0;
}

/**
 * Whether a verb has anywhere to put the thing a sentence named.
 *
 * Read off `WHAT_EACH_VERB_IS_FOR` rather than restated, for the reason
 * {@link spendsMoreThanASentence} reads its list off `actions.ts`: the
 * declaration already exists, the compiler already forces every verb to have
 * one, and a second list here would be a second answer to a question that has
 * one. `look` declares `takes: ['intent']` - the room read genuinely has no
 * object - and that is the whole of what this predicate needs to know.
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
 *
 * ── THE TURN THIS WAS FOUND ON ───────────────────────────────────────────
 *
 * Played against ollama, by the design owner:
 *
 *   > look at Shellback
 *   engine.readState/look
 *   "You look at Shellback. The person is here, alongside another figure..."
 *
 * The room, with the name pasted on the front of it. The table reads that
 * sentence correctly - `investigate` with `target: "Shellback"`, and so do
 * `I look at Shellback`, `I examine Shellback` and `I inspect Shellback` - so
 * this is not a parser gap. The MODEL answered a sentence that names a person
 * with the verb that reads the surroundings, and `look` has nowhere to put a
 * person: its glossary entry declares `takes: ['intent']`.
 *
 * ── WHY THE EXISTING GUARD CANNOT SEE IT ─────────────────────────────────
 *
 * {@link theModelIsNotWhyThisTurnIsDangerous} compares COST, and both readings
 * are free. It is the same blind spot the giving-and-taking rule above was
 * written for and it wants the same shape: a hard boundary on one axis, checked
 * separately, because the axis the cost rule measures does not contain it.
 *
 * ── AND IT IS DELIBERATELY NOT "THE MODEL MUST AGREE" ────────────────────
 *
 * The file's standing rule is that a model reading a sentence differently is
 * the entire point of having one - a question read as a bargain, a threat read
 * as an ask - and none of that is touched. What is checked is narrower and
 * structural: **did the model answer a sentence that names something with a
 * verb that has nowhere to put it.** A verb that can hold the subject and
 * chooses to hold a different one is a reading, and readings are free.
 *
 * ── THE DEGRADE IS THE SAME ONE, AND IT CANNOT ESCALATE ──────────────────
 *
 * What runs instead is the table's own plan, which is what the player would
 * have got with no model at all - the same degrade every other rule in this
 * class uses. It is refused outright where the table's verb can spend a day, so
 * this rule can never be the reason a turn became expensive; that is the one
 * direction the whole file is one-directional about.
 *
 * Costs nothing to ask: `parseIntent` is regex over one sentence, and
 * `carryWhatOnlyTheSentenceKnows` has already run it on this same input one
 * line earlier.
 *
 * KNOWN EDGE, written down rather than left to be discovered: inside a
 * multi-step plan this is only reached for a step that spends something, since
 * {@link GameService} skips the free ones before calling the check. A dropped
 * object on a free step of a plan is not caught.
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
    const takingFromThem = readsAsTaking(fromModel);

    // ── THE OTHER AXIS, AND IT HAS TO BE ASKED BEFORE THE CHEAP EXIT ─────
    //
    // A verb with nowhere to put a subject is free by construction - `look`,
    // `status`, `news` - so the exit below waves every one of them through, and
    // the whole defect this catches lives on that side of it. Same reasoning as
    // the giving-and-taking rule, which is also checked outside the cost rule
    // because cost is not the axis it is about.
    const droppedTheObject = theObjectWasDropped(fromModel, input);
    if (droppedTheObject) return droppedTheObject;

    // The identity axis, asked with the other two and before the cheap exit,
    // because `sect` is on neither cost list and the exit would wave it through.
    const putsThemInAHouse = changesWhoYouAre(fromModel);

    if (!spendsMoreThanASentence(fromModel.action) && !takingFromThem && !putsThemInAHouse) {
        return { action: fromModel, declined: null, tierFailure: null };
    }

    const withoutAModel = await readTheSentence(input);

    // ── GIVING AND TAKING ARE NEVER EACH OTHER'S FALLBACK ────────────────
    //
    // Checked before the cost rule and separately from it, because it is a
    // different axis and the cost rule cannot see it: `interact` is on neither
    // cost list, so a gift read as a theft is two readings of identical price
    // and the guard above waves it through.
    //
    // Measured in the UI against ollama, and it is the worst failure this
    // package can produce:
    //
    //   > I hand Shen Liefeng my two spirit stones
    //   The approach was labelled "steal". Shen Liefeng: countered.
    //   Reprisal: injured. Weighed as serious robbery.
    //
    // A player tried to hand somebody money, was charged with robbery, took a
    // wound for it, and now carries a grudge from the person they were trying
    // to be generous to. The two verbs have OPPOSITE SIGNS on every consequence
    // in this game - one opens a favour, the other opens a grudge and a
    // reprisal that costs the body - so a near-miss between them is worse than
    // no match at all, and it is worse in the one direction that punishes
    // somebody for generosity.
    //
    // A hard boundary rather than a priority: it does not matter which reading
    // is cheaper or which came first. If the sentence reads as a gift with no
    // model in it, no model may turn it into a taking.
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

    // ── A MODEL MAY NOT BE THE REASON SOMEBODY JOINED A HOUSE ────────────
    //
    // The same shape as the giving-and-taking boundary above and for the same
    // reason: a hard rule rather than a priority, and it does not matter which
    // reading is cheaper. If the sentence read without a model does not put
    // anybody in a house, no model may.
    //
    // What makes this land on the played sentence is the pair of changes
    // working together. "if they'll have me, I'll join" reads, without a model,
    // as `sect` with NO house named - the listing - because a leading
    // conditional is now a question in `asking-is-not-doing.ts`, and the read
    // it routes to drops the house it named. So the model's join is declined
    // and the player is answered instead of enrolled.
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
     *
     * `lastTurn` is one turn of memory and never more - what the previous turn
     * did and what it told the player, already composed into a prompt block by
     * `describeTheLastTurn`. It is a parameter rather than a session: nothing
     * accumulates, and a reader that resolves *the cheaper one* from it has
     * been given information and no authority at all. Absent when there is
     * nothing to say, which is every first turn and every deterministic tier,
     * where the same record is read by `game.ts` with no model in the room.
     */
    plan(input: string, stateSummary: string, lastTurn?: string | null): Promise<PlanWithSteps>;
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
    /**
     * The name of the cultivator whose run this is.
     *
     * Only the death check reads it, and only to decide WHOSE death the
     * prose is describing. Optional like everything else here: absent, the
     * check falls back to the second person, which under-reports rather than
     * blaming the player for an NPC dying.
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
 *
 * ── THE SUBJECT IS THE CHECK. DO NOT WIDEN IT ────────────────────────
 *
 * This used to match any death in the sentence, and `filed.died` means the
 * RUN ENDED - so prose naming an NPC's death was reported as the player's
 * own invented death, and the turn was replaced with a true objection and a
 * false reason. Measured:
 *
 *     "Han Liebo is dead."   ->  CAUGHT as invented_death
 *
 * Nothing about that narration was wrong. That is the same sin as the prose
 * this function exists to police, committed by the police, and it is latent
 * in the worst way: it needs no new bug to fire, it fires rarely, and when it
 * fires it looks like evidence of something that did not happen.
 *
 * So the question is not "did somebody die" but "did the narrator kill the
 * person whose run this is". Anybody widening this back to any-death to
 * improve coverage will reintroduce the wrong verdict, which is worse than
 * the missing one: people in this world die constantly and the narrator is
 * meant to say so.
 *
 * Both ways the player is named. Prose is second person, and the engine's own
 * account and the deterministic fallback use the cultivator's NAME - the
 * fixture in `narrator-output-authority.test.ts` is "Wen Shu is dead", which
 * a second-person-only test would miss. With no name supplied it falls back
 * to the second person alone, which can under-report and can never blame the
 * player for somebody else's death.
 *
 * Coverage past this is deliberately absent. "You cut him down" and "you
 * killed him" do not match, and were measured at 0 of 12 against a validated
 * classifier on the read most likely to produce them, so there is no
 * demonstrated defect to catch - and a check built for a hypothetical is how
 * the four withdrawn ones got written.
 */
function claimsThePlayerDied(text: string, who: string | undefined): boolean {
    // Unambiguous whoever is named: a run is the player's and nobody else's.
    if (/\bthe run is over\b/i.test(text)) return true;

    const subjects = ['you', ...(who && who.trim() ? [forRegExp(who.trim())] : [])];
    return new RegExp(`\\b(?:${subjects.join('|')})\\s+(?:${DIED_PREDICATE})`, 'i').test(text);
}

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
 *
 * ── THE THIRD FACE, AND THE ONE THE RULING ABOVE DOES NOT REACH ──────────
 *
 * Both faces above are about SILENCE: the turn did not say what it declined, so
 * the model filled the gap. The fix for both is to make the turn say it, and it
 * works. This one is different in kind, and it was found by playing:
 *
 *   > is it safe to sit and cultivate here, or will someone bother me?
 *   "You begin to settle into your meditation, drawing the ambient energy into
 *    yourself."
 *
 * The engine had declined the cultivate. Every defence above was working. The
 * Tier 1 text was loaded from disk and the phase-3 system prompt carried "only
 * the acts the turn ran happened" verbatim; the declined clause reached
 * `facts.lines` explicitly marked, in the player's own words. The model was
 * obedient. **The FACT LINE was false.**
 *
 * `theClauseThisTurnDidNotRun` had split the sentence on the `and` inside "sit
 * and cultivate" - one verb phrase, not two acts - and then reported, in the
 * engine's own voice, that "only the FIRST of them was done". The player's first
 * half is "is it safe to sit and cultivate here". So the turn told phase 3 that
 * the sitting had run, and phase 3 narrated it.
 *
 * **A narrator cannot be prompted out of a fact line that lies to it**, and that
 * is the boundary of the ruling above rather than a counterexample to it. Making
 * the turn speak fixes silence; nothing in the prompt can fix a turn that speaks
 * falsely, because the prose is CORRECT with respect to what it was given. The
 * check that would have caught it does not belong here either - it would have
 * had to know which half of the player's sentence ran, which is precisely the
 * thing the reporter got wrong.
 *
 * So the fix was upstream, in the reporter, and the lesson for anybody tempted
 * to add a third check here: when phase 3 narrates something that did not
 * happen, read the fact lines it was handed BEFORE reading the prose. Twice now
 * the answer has been in what the turn said rather than in how the model read
 * it. See `the-part-of-the-sentence-that-was-not-run.ts`.
 *
 * ── AND THE FOURTH FACE: DENY THE ACT, DO NOT REPORT A CONDITION ─────────
 *
 * A third check was proposed here and refused, and the refusal is the useful
 * part. Played: *"I take a manual from the sect library without asking"* came
 * back as *"your hand closing around a manual. You take it without asking."*
 * Nothing was stolen - the intent reaches no resolver at all for a faction
 * target, and `intent` never even reaches phase 3: it is on `structure`, which
 * `composeNarrationUser` does not send, and captured off a recording provider
 * the word "steal" appears nowhere in the message.
 *
 * **The player's own sentence was doing the narrating**, out of
 * `THE PLAYER SAID, WORD FOR WORD` - which has to be in the prompt, because
 * asking in this game turns on what was said. An audit check would catch the
 * OUTPUT of that and delete it, and it would fail the way the four withdrawn
 * checks failed: it can tell that a sentence was written, never that the
 * sentence was wrong.
 *
 * What worked was upstream again, one degree sharper than "make the turn
 * speak". The turn was already speaking - it said *"nothing is settled by it,
 * nothing changed hands"* - and that is a sentence about SETTLEMENT. A model
 * holding it beside *"I take a manual"* has no contradiction to resolve: it can
 * write the hand closing and the outcome pending, which is what it did.
 *
 * > **Give the sentence a fact it collides with.** Not "nothing was settled" -
 * > *the taking did not occur; it is still on the shelf.* A model cannot write
 * > "you pull it from its place" against "it is still in its place" without
 * > writing a flat contradiction, which is far harder for a model than a hedge.
 * > It is not being asked to omit anything.
 *
 * Measured as two played turns of one build: given a denial of the act, "the
 * declaration hangs between you and the world, unanswered"; given a report of
 * the condition, the hand closing and then a hedge.
 * `unresolved-attempt-denials.ts` holds one for every member of
 * `INTERACT_INTENTS`, because all eleven reach the unresolved branch and only
 * `steal` is getting a resolver.
 *
 * ── AND WHICH READS WILL FAIL, WHICH THIS PREDICTS ──────────────────────
 *
 * The sharper form of the rule, and it is worth having because it says where
 * to look next rather than only what to do:
 *
 * > **A read that already talks about the same stakes as the sentence
 * > collides with it on its own. A read that lists things and prices has
 * > nothing to collide with.**
 *
 * Measured, on the two reads that stand in for the most act-shaped verbs.
 * `assess` answers survivability - it is already about danger and
 * consequence - and a killing sentence put through it came back "you have
 * CLAIMED to cut Han Liebo down" and "you MOVE TO kill him": 0 of 12 narrated
 * the blow landing, against a classifier checked on five positives and three
 * negatives. The market listing answers what is on a stall and what it costs,
 * and a taking sentence put through it narrated the taking 1 turn in 10.
 *
 * So the reads at risk are the ones whose content is orthogonal to the act:
 * the price lists, the inventories, the destination tables. That is where a
 * denial has to be supplied, and it is why `assess` needed none.
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
        fromTheReader: readonly PlanStep[],
        input: string
    ): Promise<PlanWithSteps> {
        // ── THE SENTENCE SAYS HOW MANY ACTS ARE IN IT ───────────────────
        //
        // Before anything is checked, because a clause the reader never sent
        // cannot be declined, held or reported - it simply is not there. Any
        // costly clause of the player's own sentence that no step is answering
        // is read with the deterministic table and put back where they wrote
        // it. See `theWholeSentenceAsAPlan` for why this is the sentence's
        // authority rather than a rescue of a weak model.
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

            // ── THE SAME WORDS, AND FOR A PLAN THAT MEANS A CLAUSE ──────
            //
            // Two ways to be that clause, and the second is the one that
            // matters. The reader may have quoted the player - preferred, and
            // only ever accepted when it really is a quotation. Where it did
            // not, the question is put to the player's own text instead: cut
            // their sentence where a person would cut it, and ask whether any
            // piece of it reads as this verb with no model in the room.
            //
            // Comparing against a reading of the WHOLE sentence, which is what
            // this did, declined the owner's own acceptance sentence into
            // nothing - see `anyClauseReadsAsThisVerb` for the transcript.
            // A step the SENTENCE put back is the deterministic reading of the
            // player's own clause, so there is nothing for this check to
            // compare it against: it is the baseline. Checking it would compare
            // the table's answer with the table's answer and, where the clause
            // and the whole sentence read differently, decline the player's own
            // words for not being a model's.
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

            // ── A DECLINED STEP IS DROPPED, NEVER SUBSTITUTED ───────────
            //
            // In a one-verb turn, replacing the model's reading with the
            // deterministic one is right: the turn has to do something. In a
            // PLAN the other steps are already doing something, and putting the
            // whole-sentence reading in the declined step's place duplicates a
            // verb another step is already carrying - which is exactly how
            // `give -> give -> give` happened, and `oneClauseIsOneAct` then
            // collapsed the plan to a single act.
            //
            // So it is removed and NAMED. The player is told what was not done
            // and how to say it plainly, which is what the decline already
            // said; what changes is that no invented step runs in its place.
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
            // sentence put an act back that the reader had not.
            // How the sentence was split, and what became of every clause -
            // including the ones nothing was done about, because a clause that
            // vanishes without saying why is the defect this whole layer exists
            // to remove, and it cost a played round trip to find once already.
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
