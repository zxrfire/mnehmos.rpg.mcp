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

        case 'move':
        case 'ride':
        case 'fold':
            // Where they could go, priced. "Could I ride to Iron Gate" and "how
            // far can I fold" are both questions about the map rather than
            // journeys, and the destinations read answers each with the roads
            // the catalog states and the days on them.
            return { action: 'destinations' };

        case 'passage':
        case 'oath':
            // Both have a read as their DEFAULT intent, by the rule stated at
            // INTENT_ACTIONS: the board, and what the swearer already carries.
            // Dropping the intent reaches it. "What would passage to Iron Gate
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
