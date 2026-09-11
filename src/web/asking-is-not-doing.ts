/**
 * A question about an act is not the act.
 */

import { READ_ONLY_ACTIONS } from './action-set.js';
import type { PlannedAction } from './planned-action.js';

/**
 * Which of those ten reach the pressure model rather than describing somebody.
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
 */
export function costsTheAskerNothing(plan: PlannedAction): boolean {
    return plan.action === 'interact'
        ? !PRESSING_SOMEBODY.has(plan.intent ?? '')
        : READ_ONLY_ACTIONS.includes(plan.action);
}

/**
 * A quantity that cannot mean what it says.
 */
export const MALFORMED_QUANTITY =
    /(?:^|[\s(([])-\s*\d|(?:^|\s)(?:0+|zero|none|no)\s+(?:year|month|week|day|season|decade|centur|ration|stone|disciple|time|of)/i;

// ASKING IS NOT DOING

/**
 * Sentences that are asking about an act rather than performing one.
 */
export const ASKING_RATHER_THAN_DOING = new RegExp([
    // The modals. "can I", "could I", "may I", "should I", "would I", "might I".
    /\b(?:can|could|may|might|should|would|shall)\s+i\b/,
    /\bam\s+i\s+(?:able|allowed|permitted|supposed)\s+to\b/,
    /\bdo\s+i\s+(?:have\s+to|need\s+to|get\s+to)\b/,
    // The impersonal forms of the same question. `safe` and `dangerous` were absent
    // and the gap was found by playing: "is it wise to sit and cultivate here" was
    // a question and "is it SAFE to sit and cultivate here" was not, which is
    // `AGENTS.md`'s near-synonym rule exactly - the phrasing that fails is the one
    // a player reaches for first, and they cannot find the working half except by
    // guessing. The antonym is here with it because "is it dangerous to X" is the
    // same question asked from the other end and would have been the next report.
    /\bis\s+it\s+(?:possible|allowed|permitted|worth\s+it|wise|safe|dangerous|any\s+use|a\s+good\s+idea)\b/,
    /\b(?:is|would)\s+(?:it|there)\s+(?:be\s+)?(?:any\s+)?(?:way|point|use)\s+(?:to|in|for)\b/,
    /\bwould\s+it\s+be\s+possible\b/,
    // What follows from an act nobody has taken yet.
    /\bwhat\s+(?:would|will|does|do)\s+(?:it\s+)?(?:cost|take)\b/,
    /\bhow\s+much\s+(?:would|will|does)\s+it\s+cost\b/,
    /\bwhat\s+happens?\s+(?:if|when)\s+i\b/,
    /\bwhat\s+would\s+happen\s+(?:if|when)\s+i\b/,
    // AND THE CONDITIONAL, WHICH IS THE SAME QUESTION WITHOUT "WHAT"
    /^\s*(?:will|would|does|do|can|could|should|might|is|are|am|has|have)\b[^.?!]{0,80}\bif\s+i\b/,
    // AND THE GROUND ASKED ABOUT BY NAME
    /\b(?:is|are|was|were)\s+(?:this|that|the)\s+(?:\w+\s+)?(?:safe|dangerous|risky|wise|any\s+use|a\s+good\s+idea|worth\s+it|worth\s+\w+ing)\b/,
    // The plainest form, and the one a player reaches for first.
    /\bwhat\s+(?:are|is)\s+the\s+(?:terms|price|cost)\s+(?:of|for)\b/,
    // AND THE METHOD QUESTIONS, WHICH ARE NOT INTERROGATIVE AT ALL
    /\bhow\s+(?:do|would|can|could|should|might)\s+i\b/,
    /\bhow\s+(?:does|do)\s+(?:one|somebody|someone|a\s+person)\b/,
    /\bwhat\s+would\s+it\s+take\s+to\b/,
    /\bwhere\s+(?:can|could|do|would|should)\s+i\b/,
    /\bwhat\s+(?:are|is)\s+my\s+options\b/,
    // AND THE PROGRESSIVE, WHICH IS A QUESTION ABOUT WHAT IS ALREADY SO
    /\bwhat\s+(?:am|are)\s+i\s+[a-z]+ing\b/,
    /\bwhat\s+(?:is|are)\s+(?:there\s+|left\s+)?(?:here\s+)?to\s+[a-z]+\b/,
    /\bwhat\s+(?:is|are)\s+(?:left|there)\b[^.?!]{0,20}\bto\s+[a-z]+\b/,
    // AND A CONDITIONAL IS NOT A COMMITMENT
    /^\s*if\s+(?!i\b)[^,.?!]{2,60},?\s*(?:then\s+)?i(?:'ll|'d|\s+will|\s+would|\s+shall)?\b/,
    // AND THE PLAINEST FORM OF ALL, WHICH WAS MISSING: the player saying, in
    // so many words, that they are asking.
    //
    // Measured by playing it. "I ask what work the sect has" was answered with
    // NINETY DAYS OF HAULING, because the phrase contains "work the" and the
    // mortal-economy rule takes that as employment. The same question with two
    // words moved - "what work does the sect have" - was a read all along,
    // which is exactly the near-synonym trap AGENTS.md names: the phrasing a
    // player reaches for first is the one that fails, and they cannot find the
    // working half except by guessing.
    //
    // AN INTERROGATIVE IS REQUIRED, and that is the whole distinction between a
    // question and a request. "I ask what he wants" is asking. "I ask him to
    // craft me a talisman" is somebody commissioning a talisman, and it has to
    // stay one - the design owner asked for that verb by name.
    // IMMEDIATELY AFTER THE VERB, with no person in the gap. "ask Jiang Anyi
    // what she wants" is somebody being asked something and the table already
    // reads it correctly as a free request; allowing a name in between put
    // that sentence through this pass and changed it. The costly case has
    // nothing in the gap at all.
    /\bask(?:s|ed|ing)?\s+(?:what|who|whom|which|where|when|why|whether|how)\b/,
    // ═══════════════════════════════════════════════════════════════════════
    // A QUESTION WITHOUT A QUESTION MARK IS STILL A QUESTION
    // ═══════════════════════════════════════════════════════════════════════
    //
    // FOUND BY PLAYING. Twenty question forms typed the way people type into a
    // game - lower case, no punctuation - and ALL TWENTY fell through:
    //
    //     am i at a bottleneck            is my foundation ready
    //     am i ready to break through     do i have enough to break through
    //     how far am i from a breakthrough    what rung am i at
    //     tell me if i can break through  check whether i can break through
    //     i want to know if i can break through
    //     i wonder if i should cultivate here
    //     see if i can break through      find out if the sect is recruiting
    //     how much longer until i break through
    //
    // Thirteen of them reached `unclear`, which is the cheap half: the player
    // is told their sentence made no sense and loses nothing but the ask.
    //
    // AND ONE OF THEM SPENT THE RUN. *"how much longer until i break through"*
    // routed to `breakthrough` - so asking how far there was left to go
    // ATTEMPTED THE CROSSING, with the Price of Advancement on the other side
    // of it. That is the defect the whole of this module exists to prevent, and
    // `theReadThatAnswersIt` has had a `breakthrough` case waiting for it the
    // entire time. Nothing needed designing; the sentence never arrived.
    //
    // (Recorded honestly: an earlier sweep reported this and nine hand-tried
    // phrasings did not reproduce it. They were all interrogative-first forms,
    // which the patterns above already catch. It reproduces on the declarative
    // ones, which is most of how people actually type.)
    //
    // WHY THESE ARE SAFE TO TAKE BROADLY. `am i`, `do i` and `have i` are
    // interrogative by construction - there is no declarative English sentence
    // with a bare `am i` in it - so they need no interrogative word after them
    // and requiring one is what left the list above failing.
    /\bam\s+i\b/,
    /\bhave\s+i\b/,
    /\bdo\s+i\s+(?:have|know|need|still|already)\b/,
    /\b(?:is|are)\s+(?:my|mine)\b/,
    // "what rung am i at", "what is my cultivation at", "how many days do i
    // have". A question about the player's own state, in the two shapes people
    // write it.
    /\bwhat\s+(?:\w+\s+){0,2}(?:am|is|are|do|does)\s+(?:i|my)\b/,
    /\bhow\s+(?:far|long|much|many|close|near)\b[^.?!]{0,40}\b(?:i|my|until|before|to\s+go)\b/,
    // ASKING SOMEBODY ELSE TO FIND OUT IS ASKING.
    //
    // `if` or `whether` is required after every one of these, and that is what
    // keeps them off the verbs they share a word with: "check whether the sect
    // is recruiting" is a question and "I check the manual" is a look.
    /\b(?:tell\s+me|let\s+me\s+know|check|see|find\s+out|work\s+out|figure\s+out)\s+(?:if|whether)\b/,
    /\bi\s+(?:want|need)\s+to\s+know\b/,
    /\bi\s+wonder\s+(?:if|whether|how|what|where|when|why|who)\b/,
    // "is it time to", which is "should i" asked the other way round and was
    // the one form of it the modal list never had.
    /\bis\s+it\s+time\s+to\b/,
    // ── WHAT A THING IS WORTH ────────────────────────────────────────
    //
    // The commonest money question there is, and every phrasing of it
    // reached nothing: "what is this worth", "what is my sword worth",
    // "how much for the manual", "what will he give me for it".
    //
    // AND THE ROUTING FIX ALONE WOULD HAVE BEEN WORSE THAN THE GAP. Those
    // sentences now reach `sell`, which SPENDS - so without this half, a
    // player asking what their sword was worth would have sold it. This is
    // the pass that turns the question back into a quote.
    // ANCHORED TO THE QUESTION SHAPE, and the first cut was not.
    //
    // A bare `go for` or `fetch` is ordinary English: "I go for the man with
    // the spear" became a QUESTION and was answered with an assessment
    // instead of a fight - a player committing to an attack was handed a
    // read. Bare `worth` is nearly as bad.
    //
    // The words only mean a price when a price is being asked for, which is
    // exactly the shape the verb table requires of them too.
    /\b(?:what(?:'s| is| are)?|how much)\b[^.?!]{0,40}\b(?:worth|go for|fetch|fetches)\b/,
    /\bhow much (?:for|would (?:he|she|they|anybody|anyone) give)\b/,
    /\bwhat (?:would|will|could) (?:he|she|they|anybody|anyone|i)\s+(?:get|give me) for\b/,
    // AND THE ONE THE PLAYER TYPED ON PURPOSE
    /\?\s*$/
].map(r => r.source).join('|'), 'i');

/**
 * Whether the WHOLE utterance is a question, asked of the sentence rather than of
 * any clause inside it.
 */
export function theWholeSentenceIsAQuestion(input: string): boolean {
    return ASKING_RATHER_THAN_DOING.test(input.trim().toLowerCase());
}

/**
 * The free read that answers a question about each committing verb.
 */
export function theReadThatAnswersIt(plan: PlannedAction): PlannedAction {
    // A read is already the answer to a question about it.
    if (costsTheAskerNothing(plan)) return plan;

    switch (plan.action) {
        case 'interact':
            /**
             * A READ OF THE PERSON, which is what the question was about.
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

        case 'work':
            /**
             * A QUESTION ABOUT WORK IS THE BOARD, NEVER A SEASON OF IT.
             */
            return { action: 'work', intent: 'board' };

        case 'sect':
            // Asking to get in is the listing; asking about the seat you hold is
            // your standing in it. Both are free and both already say the right
            // thing - the listing's own line is the one the played run quoted
            // approvingly one input before the parser broke it. A question about
            // sitting in somewhere keeps the house it named and loses only the
            // commitment. The terms read is free and says everything the acceptance
            // would - what is opened, what is kept back, and the five things a
            // guest place is not - so a player who asked "could I study at the
            // Frostmirror Court" is answered rather than enrolled.
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
                // ASKING WHAT REFUSING COSTS MUST NEVER REFUSE
                : plan.intent === 'summons' || plan.intent === 'refuse'
                    ? { action: 'sect', intent: 'summons' }
                : plan.intent === 'duty' || plan.intent === 'siphon'
                        || plan.intent === 'authority' || plan.intent === 'curriculum'
                    // These have a READ mode reached by naming nothing further:
                    // the wall, the position of the reserves, who answers for
                    // what, and what the house teaches.
                    //
                    // `authority` was falling through to `standing` below, so
                    // *"what do I run"* - a question about what is in your gift
                    // - was answered with your rank and contribution. Two
                    // different questions, and the second is not an answer to
                    // the first. It was already true of *"what do I run?"* with
                    // the question mark on, and only surfaced when the asking
                    // detector was widened to catch the form without one.
                    //
                    // `curriculum` is the same defect one intent over: *"what
                    // does my hall teach"* was answered with the asker's rank
                    // and contribution. Both are questions somebody is entitled
                    // to ask a hundred times for nothing, and neither is a
                    // question about the asker.
                    ? { action: 'sect', intent: plan.intent }
                    // The standing read carries the two numbers a departure
                    // forfeits - the seat and the contribution - so it is the
                    // right answer to "could I leave". The topic rides along so
                    // it can also say what walking out would take, which is the
                    // half a bare standing read does not cover.
                    : plan.intent === 'leave'
                        ? { action: 'sect', intent: 'standing', topic: 'leaving' }
                    // A HOUSE THE STANDING READ WAS ASKED ABOUT SURVIVES THE
                    // REWRITE. "who leads the Azure Dew Sect?" and the same
                    // sentence without the question mark are one question, and
                    // only the second reached the parser's own answer: this
                    // pass rebuilt the plan and dropped the house on the floor,
                    // so the version a player is likelier to type was the
                    // version that lost the name.
                    //
                    // Named on `standing` alone rather than on the fall-through
                    // as a whole. Every other intent that lands here arrived
                    // with a target meaning something else, and carrying it
                    // into a standing read would make the read answer about a
                    // house nobody asked about.
                    : plan.intent === 'standing'
                        ? {
                            action: 'sect',
                            intent: 'standing',
                            ...(plan.target ? { target: plan.target } : {})
                        }
                        : { action: 'sect', intent: 'standing' };

        case 'guard':
            // ASKING ABOUT A WATCH IS THE ROSTER OF WHO WOULD KEEP ONE
            return { action: 'guard', intent: 'ask' };

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

        case 'craft':
            // The bench's listing, for exactly the reason the cauldron's is
            // above: `planTheBuild` with nothing named returns every bill, the
            // rung gate on each, and what the pouch is short of. This table
            // went stale when `craft` joined `ACTION_NAMES` and the default
            // caught it, so "can I build a spirit boat?" was rewritten to
            // `assess` and answered with an ambient-qi reading of a PLACE
            // called "spirit boat".
            return { action: 'craft' };

        case 'move':
        case 'ride':
        case 'fold':
            // Where they could go, priced. "Could I ride to Iron Ridge" and "how
            // far can I fold" are both questions about the map rather than
            // journeys, and the destinations read answers each with the roads
            // the catalog states and the days on them.
            //
            // THE PLACE RIDES ALONG. Dropping it turned "could I ride to Iron
            // Ridge" into the whole map - a question about one road answered
            // with every road, which is the shape this pass exists to stop. The
            // read decides what to do with a name; the rewrite's job is not to
            // lose it. See `destinations`.
            return { action: 'destinations', ...(plan.target ? { target: plan.target } : {}) };

        case 'passage':
        case 'oath':
            // Both have a read as their DEFAULT intent, by the rule stated at
            // INTENT_ACTIONS: the board, and what the swearer already carries.
            // Dropping the intent reaches it. "What would passage to Iron Ridge
            // cost" is the board, and the board is a price list.
            //
            // AND FOR AN OATH THE READ IS NAMED RATHER THAN LEFT OFF. Dropping
            // it reaches the same place, but it arrives unlabelled - and three
            // separate tests read the label to say which question was answered.
            // "What am I owed" coming back as `oath` with no intent is the
            // right board and an answer nothing downstream can identify.
            // `passage` keeps the bare form: its read is `board`, and naming it
            // here would be asserting a route this change has not measured.
            return {
                action: plan.action,
                ...(plan.action === 'oath' ? { intent: 'read' as const } : {}),
                ...(plan.target ? { target: plan.target } : {})
            };

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
             * What it would take to ask them: every fact the attempt is built from,
             * and none of the days it spends.
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

/**
 * A question the parser handed to a bystander, read as the question it is.
 *
 * MEASURED BY PLAYING IT, and the shape is always the same. "I ask what my rank
 * is" resolved to TALKING TO SOMEBODY about a person called "what my rank is",
 * and the engine answered `resolveParty: matched nobody`. So did "I ask what
 * missions are open to me", and "I ask what has happened while I was in
 * seclusion". Meanwhile "what my rank is" on its own reads as `status`, "what
 * missions are open" as the duty board, and "what my contribution is" as
 * standing in the house - correct, every one of them.
 *
 * The two words in front were the whole difference. That is the near-synonym
 * rule in AGENTS.md: the phrasing a player reaches for first is the one that
 * fails, and there is no way to find the working half except by guessing.
 *
 * SO THIS ONLY EVER FIRES WHERE THE PARSER ALREADY FOUND NOBODY. The target has
 * to begin with an interrogative, which is not what a person is called, and the
 * answer has to be a read - a question is never allowed to become something
 * that spends a day. Where the inside is unclear, the outer plan stands and the
 * player is talking to whoever is in front of them, which is also right: "I ask
 * what he wants" is a person being asked something.
 */
const STARTS_WITH_AN_INTERROGATIVE =
    /^(?:what|who|whom|which|where|when|why|whether|how)\b/i;

export function theQuestionRatherThanTheBystander(
    plan: PlannedAction,
    reparse: (text: string) => PlannedAction
): PlannedAction {
    // The three verbs that take a person or a thing by name. `request` is here
    // with the other two because "I ask what missions are open to me" reached it
    // carrying "what missions are open" as the thing being requested, which is
    // the same failure wearing a different verb.
    if (plan.action !== 'interact'
        && plan.action !== 'investigate'
        && plan.action !== 'request') {
        return plan;
    }
    const said = (plan.target ?? '').trim();
    if (said.length === 0 || !STARTS_WITH_AN_INTERROGATIVE.test(said)) return plan;

    const inside = reparse(said);
    // Nothing better to say, so the person in front of them is the answer.
    if (inside.action === 'unclear') return plan;
    // And never round-trip into the same guess.
    if (inside.action === 'interact'
        || inside.action === 'investigate'
        || inside.action === 'request') {
        return plan;
    }
    // A QUESTION NEVER BECOMES A COST. The inside was read as a bare sentence,
    // so it can come back as the committing half of a verb - "what missions are
    // open" reads as TAKING one - and a question must not do that.
    //
    // But that is the rule directly above, and it already knows what the free
    // half of every verb is. So the inside is put through it rather than being
    // thrown away, and only refused if it still costs something afterwards.
    if (costsTheAskerNothing(inside)) return inside;
    const asked = theReadThatAnswersIt(inside);
    return costsTheAskerNothing(asked) ? asked : plan;
}
