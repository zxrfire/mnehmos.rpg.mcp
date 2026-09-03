/**
 * A question about an act is not the act.
 *
 * The single worst defect ever found in a played run of this game wearing three
 * faces - "can I leave my sect" left it, "can I cultivate here" spent a month,
 * "I want to join a sect" joined one - and the whole of the answer is here: the
 * mood is read on the finished plan, as a post-pass, and a plan that would have
 * spent something is exchanged for the read that already answers the question.
 *
 * Doing it as a post-pass rather than as a veto scattered through the pattern
 * table is what makes it complete: a verb added tomorrow is covered without its
 * author having to know this rule exists. That property is why this is its own
 * module rather than a corner of the classification lists - it is a rule about
 * SENTENCES, applied to every verb at once, and it already had a test file of
 * its own naming it: `tests/web/asking-is-not-doing.test.ts`.
 *
 * `costsTheAskerNothing` lives here and not with `READ_ONLY_ACTIONS` for the
 * reason its own docstring gives at length: `interact` is free on three intents
 * and spends days and stones on the other seven, so the ACTION alone cannot
 * answer the question and a second list would have been wrong. It is a function
 * because the cost is a fact about the sentence.
 *
 * `MALFORMED_QUANTITY` comes with them as the other mood guard: a sentence that
 * named an impossible quantity is one the engine did not understand, and it
 * reaches the cheapest action rather than a clamped guess.
 *
 * Single reason to change: which read answers a question about an act.
 */

import { READ_ONLY_ACTIONS } from './action-set.js';
import type { PlannedAction } from './planned-action.js';

/**
 * Which of those ten reach the pressure model rather than describing somebody.
 *
 * `GameService.interact` sends exactly these to `pressSomebody`, which resolves
 * the attempt, runs the days through `shortSkip` and takes the stones off the
 * purse when it lands. The other three - `talk`, `trade`, `apologise` - fall to
 * the branch that reports who this party is and settles nothing, which passes
 * no time and moves nothing.
 *
 * Written here rather than imported because `game.ts` holds the executor's own
 * copy (`ATTEMPT_INTENTS`) and this file may not depend on that one - actions
 * is below game, not above it. Two copies of a set is a drift risk and the
 * answer is not a comment asking people to be careful: the regression test
 * PLAYS all ten intents in both moods and asserts the split by measuring what
 * each one spent, so a member added on either side goes red on the next run.
 * See `tests/web/asking-is-not-doing.test.ts`.
 *
 * Note what is NOT the discriminator. `LEVERAGE_BEHIND_INTENT` covers three of
 * these and the other four press somebody just as hard with nothing on the
 * table - measured, one day each - so leverage is what the attempt is made
 * WITH and never whether an attempt was made.
 */
export const PRESSING_SOMEBODY: ReadonlySet<string> = new Set([
    'bribe', 'threaten', 'seduce', 'deceive', 'negotiate', 'interrogate', 'recruit',
    // Taking off a person is an attempt against them, resolved by the same
    // machine and at the same price as leaning on one. It is on this side of
    // the split and not the free one because it spends the days it spends
    // whether or not it comes off.
    'steal'
]);

/**
 * Whether this PLAN takes nothing from the player.
 *
 * A narrower question than whether its ACTION is on {@link READ_ONLY_ACTIONS},
 * and `interact` is the whole of the difference: it is free on `talk`, `trade`
 * and `apologise` and spends days and stones on the other seven, so the action
 * alone cannot answer it. Every consumer that used to ask the list should ask
 * this instead - the list is a statement about verbs, and the cost of this one
 * is a fact about the sentence.
 *
 * There are two consumers and they want the same answer for different reasons.
 * {@link theReadThatAnswersIt} asks it to decide whether a question about an
 * act is already answered by the act; `the-part-of-the-sentence-that-was-not-run`
 * asks it to decide whether a dropped clause took anything, and its own measured
 * rule - report a clause only if it would have COST something - was calibrated
 * on a corpus in which `interact` was free. Both would have been wrong in the
 * same direction from one stale answer, which is exactly why this is a function
 * and not a second list.
 */
export function costsTheAskerNothing(plan: PlannedAction): boolean {
    return plan.action === 'interact'
        ? !PRESSING_SOMEBODY.has(plan.intent ?? '')
        : READ_ONLY_ACTIONS.includes(plan.action);
}

/**
 * A quantity that cannot mean what it says.
 *
 * The sign was being SILENTLY DROPPED, which is the same class of defect as the
 * sentence that killed a run at the top of this file and is arguably worse,
 * because it produces a confident action rather than a wrong one. "I enter
 * seclusion for -5 years" was reaching the number scanner, which found `5`,
 * and running a real five-year closed-door seclusion: 750 elapsed days and a
 * breakthrough, off a duration the player wrote as negative. An explicit zero
 * had the mirror problem - `parseDuration` returned null, `seclude` applied its
 * 365-day default, and asking for nothing bought a year.
 *
 * Both resolve to `unclear` rather than to a clamped number. A sentence that
 * NAMED a quantity and named an impossible one is not a sentence the engine
 * understood, and this file's own rule is that anything it did not understand
 * must reach the cheapest action available. Guessing which positive number
 * somebody meant by "-5" is exactly the confidence that kills characters.
 *
 * Narrow on purpose. The minus has to open a token, so "2-3 days" is untouched;
 * "closed-door" and "twenty-five" are hyphens before letters and never match.
 */
export const MALFORMED_QUANTITY =
    /(?:^|[\s(([])-\s*\d|(?:^|\s)(?:0+|zero|none|no)\s+(?:year|month|week|day|season|decade|centur|ration|stone|disciple|time|of)/i;

// ═══════════════════════════════════════════════════════════════════════════
// ASKING IS NOT DOING
// ═══════════════════════════════════════════════════════════════════════════
//
// THE SINGLE WORST DEFECT FOUND IN A PLAYED RUN, and it is one defect wearing
// three faces. A question about an act was routed to the act's executor, so:
//
//   "can I leave my sect"        LEFT THE SECT, permanently, and reported that
//                                contribution does not travel. A player asking
//                                what their options were was punished for it.
//   "can I cultivate here"       spent a month.
//   "I want to join a sect"      joined one, with no introduction and no
//                                journey, one line after the game had said
//                                "knowing a name is not an introduction".
//
// The unifying rule this block exists to state:
//
//   > A QUESTION ABOUT AN ACTION IS NOT THE ACTION.
//
// Note what this is NOT. It is not a ban - `AGENTS.md` is explicit that the
// answer to "may I" is always "yes, and here is what it costs", and every verb
// below is still reachable by the sentence that commands it. "I leave my sect"
// still leaves. What changes is that the sentence with a question mark in its
// grammar reaches the READ instead of the write, and the read is where this
// engine is already at its best.
//
// It is also not a rule about desire. "I want to cultivate for ten years" is a
// command in this genre and `usedAsVerb` is right to take `want to` as a verb
// position. The reason "I want to learn X" used to be a defect was never the
// wanting - it was that learning X cost nothing. That half is fixed where it
// belongs, in `handleLearn` and at the stall, not here.

/**
 * Sentences that are asking about an act rather than performing one.
 *
 * Every branch requires the FIRST PERSON next to the modal, which is what keeps
 * it off the sentences that merely contain the words: "I can feel the qi
 * settling" is not a question, and neither is "the elder said I should leave".
 * The subject has to be the asker and the mood has to be interrogative.
 *
 * Deliberately does not include a bare question mark. Half the questions a
 * player types have no punctuation at all, and half the sentences that end in
 * one - "what now?" - are not about any particular act.
 */
export const ASKING_RATHER_THAN_DOING = new RegExp([
    // The modals. "can I", "could I", "may I", "should I", "would I", "might I".
    /\b(?:can|could|may|might|should|would|shall)\s+i\b/,
    /\bam\s+i\s+(?:able|allowed|permitted|supposed)\s+to\b/,
    /\bdo\s+i\s+(?:have\s+to|need\s+to|get\s+to)\b/,
    // The impersonal forms of the same question.
    // `safe` and `dangerous` were absent and the gap was found by playing:
    // "is it wise to sit and cultivate here" was a question and "is it SAFE to
    // sit and cultivate here" was not, which is `AGENTS.md`'s near-synonym rule
    // exactly - the phrasing that fails is the one a player reaches for first,
    // and they cannot find the working half except by guessing. The antonym is
    // here with it because "is it dangerous to X" is the same question asked
    // from the other end and would have been the next report.
    /\bis\s+it\s+(?:possible|allowed|permitted|worth\s+it|wise|safe|dangerous|any\s+use|a\s+good\s+idea)\b/,
    /\b(?:is|would)\s+(?:it|there)\s+(?:be\s+)?(?:any\s+)?(?:way|point|use)\s+(?:to|in|for)\b/,
    /\bwould\s+it\s+be\s+possible\b/,
    // What follows from an act nobody has taken yet.
    /\bwhat\s+(?:would|will|does|do)\s+(?:it\s+)?(?:cost|take)\b/,
    /\bhow\s+much\s+(?:would|will|does)\s+it\s+cost\b/,
    /\bwhat\s+happens?\s+(?:if|when)\s+i\b/,
    /\bwhat\s+would\s+happen\s+(?:if|when)\s+i\b/,
    // The plainest form, and the one a player reaches for first.
    /\bwhat\s+(?:are|is)\s+the\s+(?:terms|price|cost)\s+(?:of|for)\b/,
    // ── AND THE METHOD QUESTIONS, WHICH ARE NOT INTERROGATIVE AT ALL ─────
    //
    // Found by continued play and it is the worse half, because a method
    // question reads like a plan. "how do I treat my injuries" - an
    // unambiguous question about HOW - bought four courses of care, spent
    // twenty spirit stones and lay still for thirty days. The player asked
    // what their options were and was charged for them.
    //
    // So the test is not the word at the front of the sentence. It is whether
    // the player has DECIDED. "How do I X", "what would it take to X" and
    // "where can I X" are all somebody working out what X involves, and none
    // of them is somebody doing it.
    /\bhow\s+(?:do|would|can|could|should|might)\s+i\b/,
    /\bhow\s+(?:does|do)\s+(?:one|somebody|someone|a\s+person)\b/,
    /\bwhat\s+would\s+it\s+take\s+to\b/,
    /\bwhere\s+(?:can|could|do|would|should)\s+i\b/,
    /\bwhat\s+(?:are|is)\s+my\s+options\b/,
    // ── AND THE PROGRESSIVE, WHICH IS A QUESTION ABOUT WHAT IS ALREADY SO ─
    //
    // Two more found by probing the reads that spend, and both spend:
    //
    //   "what is left to gather here"  -> gather, seven days bent over the ground
    //   "what am I cultivating"        -> cultivate, thirty days
    //
    // Neither sentence contains a decision. "What am I cultivating" is somebody
    // asking what method they are on, which is a fact about the sheet, and it
    // sat them down for a month. The first is the same shape one step out: what
    // is THERE, asked before going to get it.
    //
    // Both need the verb to be the thing asked ABOUT rather than the thing
    // being done, which is what `what am I <verb>ing` and `what is (left|here)
    // to <verb>` both say and no sentence that commits to anything says.
    /\bwhat\s+(?:am|are)\s+i\s+[a-z]+ing\b/,
    /\bwhat\s+(?:is|are)\s+(?:there\s+|left\s+)?(?:here\s+)?to\s+[a-z]+\b/,
    /\bwhat\s+(?:is|are)\s+(?:left|there)\b[^.?!]{0,20}\bto\s+[a-z]+\b/
].map(r => r.source).join('|'), 'i');

/**
 * Whether the WHOLE utterance is a question, asked of the sentence rather than
 * of any clause inside it.
 *
 * ── WHY THIS IS SEPARATE FROM THE ROUTING TEST ABOVE ─────────────────────
 *
 * {@link ASKING_RATHER_THAN_DOING} answers "which verb should run", and for
 * that job a bare question mark is deliberately excluded: half the questions a
 * player types carry no punctuation, and half the sentences that end in one -
 * "what now?" - are not about any particular act, so routing on the mark alone
 * would move verbs around for no reason.
 *
 * This answers a different and much cheaper question: "may a clause of this
 * sentence be REPORTED to the player as an act they asked for and did not get?"
 * The two failure modes there are not symmetrical, and that asymmetry is the
 * whole argument for a wider test:
 *
 *   - staying silent about a clause costs the player a sentence they can retype
 *     next turn for nothing. `the-part-of-the-sentence-that-was-not-run` already
 *     made exactly this trade once and wrote it down;
 *   - reporting a clause of a question tells the player that half of what they
 *     said was an act - and then tells the NARRATOR that the other half ran.
 *
 * The second one is what was found by playing. See the header of
 * `the-part-of-the-sentence-that-was-not-run.ts` for the played transcript.
 *
 * A question mark is only ever accepted at the END, so "what now? I cultivate
 * for a year" is untouched: the mark has to close the utterance to be evidence
 * about it.
 */
export function theWholeSentenceIsAQuestion(input: string): boolean {
    const said = input.trim().toLowerCase();
    return said.endsWith('?') || ASKING_RATHER_THAN_DOING.test(said);
}

/**
 * The free read that answers a question about each committing verb.
 *
 * A table rather than a single downgrade, because the useful answer differs:
 * somebody asking whether they could leave a house wants their own standing in
 * it, and somebody asking whether they could join one wants the listing that
 * already says knowing a name is not an introduction.
 *
 * Anything not named here falls to `assess`, which is this parser's existing
 * "what happens if I try" verb, is in `READ_ONLY_ACTIONS`, and cannot spend a
 * day, a stone or a life. That default is what makes the guard safe for verbs
 * added after it: a new committing action is answered inertly by construction
 * rather than by somebody remembering to come back here.
 */
export function theReadThatAnswersIt(plan: PlannedAction): PlannedAction {
    // A read is already the answer to a question about it.
    //
    // The list used to carry an entry that was not a read. `interact` sat on it
    // while seven of its ten intents spent days and stones, so this guard - the
    // one written to stop a question performing an act - was handing "can I
    // bribe the elder" straight back to the executor, and doing it BY DESIGN,
    // because trusting this list is how the post-pass stays complete. The
    // reclassification is at `READ_ONLY_ACTIONS` and `TIME_CONSUMING_ACTIONS`,
    // and this line asks {@link costsTheAskerNothing} rather than the list,
    // because for `interact` the two are different questions.
    if (costsTheAskerNothing(plan)) return plan;

    switch (plan.action) {
        case 'interact':
            /**
             * A READ OF THE PERSON, which is what the question was about.
             *
             * Only for the intents that press somebody. "Can I talk to the
             * gate steward" is a question about an act that settles nothing and
             * costs nothing, and the honest answer to it is the approach
             * itself - narrowing to {@link PRESSING_SOMEBODY} is the rule
             * `AGENTS.md` states as fixing the gap that was demonstrated rather
             * than the one you imagined. Those three never reach this case at
             * all: {@link costsTheAskerNothing} returns them above.
             *
             * `investigate` and not `assess`, which is this table's default for
             * everything it does not name and would have been wrong here.
             * Checked rather than assumed: `GameService.assess` sends every
             * subject that is not the asker to `handleAssess` with
             * `against: 'place'`, so a person's NAME is looked up as GROUND. It
             * would have answered a question about somebody with the weather
             * where they are standing, which is a good answer to a question
             * nobody asked - the deflection failure this codebase keeps
             * finding, and worse than a refusal because it reads like an
             * answer. `investigate` reads the person: the
             * rung they stand at, the years they carry, the house they answer
             * to, and then "that is what the record holds. What it means is a
             * separate question" - which is exactly the shape of an answer
             * somebody weighing a bribe is owed.
             *
             * And not the priced weighing `request` gives its own questions,
             * though that was the first candidate and it is the better read.
             * `GameService.request` re-reads the sentence to find what was
             * asked FOR; a bare "can I bribe X" names no object, falls to
             * `a_thing` with nothing in it, and is routed by `request`'s own
             * fallback into `interact` with intent `negotiate` - which is on
             * the pressing list. It would have re-entered the same spend
             * through a different door, and the purse would have come out the
             * same. Verified by reading that path rather than by assuming it.
             *
             * The target rides along unparsed. It is whatever `extractSubject`
             * took off the sentence - "Bai Jinglu with 10 spirit stones" for
             * the phrasing that started this - and the entity resolver takes
             * it, so nothing here has to understand the tail.
             *
             * AND A QUESTION THAT NAMED A SUBJECT KEEPS IT. "Could I question
             * Bai Jinglu about the ruins" carries a topic, and a topic put to a
             * person is already the free read - `GameService.interact` hands it
             * to `askAround` before the pressure model is reached. Sending that
             * one to `investigate` would have cost nothing and answered a
             * narrower question than the one asked, which is the deflection
             * again in the other direction. So the topic keeps its own read and
             * only the INTENT is dropped, to `talk`, which is the same free
             * branch it was already taking.
             *
             * Dropped to `talk` rather than left alone, because a topic does
             * NOT by itself guarantee the cheap path: `askAround` needs the
             * person to be standing here, and somebody known-of but elsewhere
             * falls past it into the attempt. `talk` is not on the pressing
             * list, so that door is shut whichever way the person resolves.
             */
            if (!PRESSING_SOMEBODY.has(plan.intent ?? '')) return plan;
            return plan.topic
                ? {
                    action: 'interact',
                    intent: 'talk',
                    ...(plan.target ? { target: plan.target } : {}),
                    topic: plan.topic
                }
                : { action: 'investigate', ...(plan.target ? { target: plan.target } : {}) };

        case 'sect':
            // Asking to get in is the listing; asking about the seat you hold
            // is your standing in it. Both are free and both already say the
            // right thing - the listing's own line is the one the played run
            // quoted approvingly one input before the parser broke it.
            // A question about sitting in somewhere keeps the house it named
            // and loses only the commitment. The terms read is free and says
            // everything the acceptance would - what is opened, what is kept
            // back, and the five things a guest place is not - so a player who
            // asked "could I study at the Frostmirror Court" is answered rather
            // than enrolled.
            if (plan.intent === 'guest') {
                return {
                    action: 'sect',
                    intent: 'guest',
                    ...(plan.target ? { target: plan.target } : {}),
                    ...(plan.topic === 'depart' ? { topic: 'depart' } : {})
                };
            }
            return plan.intent === undefined || plan.intent === 'join'
                ? { action: 'sect' }
                : plan.intent === 'duty' || plan.intent === 'siphon'
                    // Both of these have a READ mode reached by naming nothing
                    // further: the wall, and the position of the reserves.
                    ? { action: 'sect', intent: plan.intent }
                    // The standing read carries the two numbers a departure
                    // forfeits - the seat and the contribution - so it is the
                    // right answer to "could I leave". The topic rides along so
                    // it can also say what walking out would take, which is the
                    // half a bare standing read does not cover.
                    : plan.intent === 'leave'
                        ? { action: 'sect', intent: 'standing', topic: 'leaving' }
                        : { action: 'sect', intent: 'standing' };

        case 'learn_technique':
            // What the book would take, which is a read of the same facts the
            // refusal is built from. See `GameService.whatItWouldTake`.
            return { action: 'list_techniques', ...(plan.target ? { target: plan.target } : {}) };

        case 'train_technique':
            return { action: 'list_techniques', ...(plan.target ? { target: plan.target } : {}) };

        case 'buy':
        case 'sell':
            return { action: 'market', ...(plan.target ? { target: plan.target } : {}) };

        case 'provision':
        case 'eat':
            return { action: 'market', target: 'food' };

        case 'treat':
            return { action: 'market', target: 'medicine' };

        case 'consume_pill':
            return { action: 'inventory' };

        case 'refine':
            // The cauldron's own listing, which is what `refine` does when it
            // is handed no formula: forty-two recipes filtered by rank, with
            // what each wants and what the pouch is short of. "What can I
            // refine" was already answered that way and must keep being.
            return { action: 'refine' };

        case 'move':
        case 'ride':
        case 'fold':
            // Where they could go, priced. "Could I ride to Kettle" and "how
            // far can I fold" are both questions about the map rather than
            // journeys, and the destinations read answers each with the roads
            // the catalog states and the days on them.
            return { action: 'destinations' };

        case 'passage':
        case 'oath':
            // Both have a read as their DEFAULT intent, by the rule stated at
            // INTENT_ACTIONS: the board, and what the swearer already carries.
            // Dropping the intent reaches it. "What would passage to Kettle
            // cost" is the board, and the board is a price list.
            return { action: plan.action, ...(plan.target ? { target: plan.target } : {}) };

        case 'breakthrough':
        case 'cultivate':
        case 'seclude':
            // Where they stand and what is stopping them, which is the honest
            // answer to "can I" asked of the ladder.
            return { action: 'ceiling' };

        case 'site':
            // Reading it from outside is the free step of the four, and it is
            // exactly what somebody weighing an attempt is asking for.
            return { action: 'site', intent: 'outside', ...(plan.target ? { target: plan.target } : {}) };

        case 'legacy':
            return { action: 'legacy', intent: 'counters' };

        case 'request':
            /**
             * What it would take to ask them: every fact the attempt is built
             * from, and none of the days it spends.
             *
             * The same code path as the request itself - `GameService.request`
             * with `weigh` runs everything up to the roll and stops - so the
             * read cannot drift away from the thing it describes, which is the
             * failure mode a separately-written "what would happen if" always
             * walks into.
             */
            return {
                action: 'request',
                intent: 'weigh',
                ...(plan.target ? { target: plan.target } : {}),
                ...(plan.topic ? { topic: plan.topic } : {})
            };

        case 'posture':
        case 'seal':
        case 'offer':
            // Each of these has a read as its DEFAULT intent, by the rule
            // stated at INTENT_ACTIONS. Dropping the intent reaches it.
            // `petition` is the fourth of that family and is absent because it
            // is already in READ_ONLY_ACTIONS and returned above.
            return { action: plan.action, ...(plan.target ? { target: plan.target } : {}) };

        default:
            return { action: 'assess', ...(plan.target ? { target: plan.target } : {}) };
    }
}
