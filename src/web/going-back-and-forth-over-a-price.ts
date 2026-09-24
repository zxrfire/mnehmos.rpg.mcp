/**
 * Going back and forth over a price, which is not a day.
 *
 * The ruling: a haggle is not a span of time. You say what you are offering,
 * they say yes, no, or add more - and you may ask what the figure is before any
 * of that. The design owner, on the length of it: *"would it be a day in d&d?
 * heck no."*
 *
 * So this is a FREE read, and `trade` is deliberately not in `ATTEMPT_INTENTS`:
 * membership there makes an intent press somebody and spend a day, which is the
 * one thing this must not do. Adding it was tried and reverted, and
 * `haggling-is-not-a-day.test.ts` is the ratchet.
 *
 * ── WHAT THIS DOES NOT DECIDE ────────────────────────────────────────────
 *
 * Which medium somebody will take - stones, goods, a favour, a service, a hold -
 * is `what-they-will-take-instead-of-money.ts` and is not restated here. This
 * reads a figure against a figure and hands the ladder's own sentence back
 * whenever the answer is "not yet": one refusal, said once, in the place that
 * computes it.
 *
 * ── AND THE COUNTERPARTY IS A NAME, NOT A ROLE ───────────────────────────
 *
 * A stall is not a person and must not be resolved into a roster row. The
 * ruling, on a stallholder who came back as nobody: *"this should be handled by
 * the LLM. For an engine you'd specify their name."* So `sellerName` is whatever
 * name the world or the sentence already supplied, and where there is none the
 * answer is about the goods and the price rather than about who is missing.
 */

import { stonesNamedIn } from './tool-result-prose.js';
import type { WhereTheOfferLandedOnTheLadder } from '../engine/social-leverage/what-they-will-take-instead-of-money.js';

/**
 * What a haggling sentence is doing, which is one of four things.
 */
export type WhatTheHaggleSaid =
    | 'asked_the_price'
    | 'named_a_figure'
    | 'offered_something_instead'
    | 'pushed_back';

/** Asking what a thing costs, in the shapes people actually type. */
const ASKING_THE_PRICE =
    /\bhow much\b|\bwhat(?:'s| is| are)?\s+(?:your|the|his|her|their)\s+(?:price|best price|asking price|figure)\b|\bwhat\s+(?:do|does|would|will)\s+(?:you|he|she|they|it)\s+(?:want|take|ask|charge)\b|\bwhat\s+(?:are|is)\s+(?:you|he|she|they)\s+asking\b|\bgoing rate\b|\bname your price\b|\bhow many stones\b/i;


/** Putting a thing rather than a figure across the table. */
const SOMETHING_INSTEAD =
    /\b(?:instead|in exchange|in trade|for it|swap|trade you|throw in)\b/i;

/**
 * Which of the four a sentence is.
 *
 * Order is load-bearing. "How much would you take for my sword instead" is a
 * price question that happens to mention a swap, and reading it as an offer
 * would answer a question nobody asked.
 */
export function whatAHaggleSentenceIs(input: string): WhatTheHaggleSaid {
    if (ASKING_THE_PRICE.test(input)) return 'asked_the_price';
    if (stonesNamedIn(input) !== null) return 'named_a_figure';
    if (SOMETHING_INSTEAD.test(input)) return 'offered_something_instead';
    return 'pushed_back';
}

/**
 * What the player named as the thing they want, out of a haggling sentence.
 *
 * Only the tail after "for" - the verb table already carries a topic wherever
 * the sentence had a clean one, and this is the half it does not: "how much for
 * the X", "what would you take for the X".
 */
export function whatTheHaggleIsOver(input: string): string | null {
    const after = /\bfor\s+(?:the\s+|a\s+|an\s+|one\s+|your\s+|his\s+|her\s+|their\s+)?([^.?!,]{2,60})/i
        .exec(input);
    if (!after) return null;
    const named = after[1].trim().replace(/\s+(?:instead|please|then)$/i, '').trim();
    // A PRONOUN IS NOT A NAME. "How much for it" points at the last turn, which
    // the caller resolves; answering it here would be this module guessing.
    if (/^(?:it|that|this|them|those|these|me|him|her|us|you|sale)$/i.test(named)) return null;
    return named.length >= 2 ? named : null;
}

/**
 * What the player is holding out in place of stones, as they said it.
 *
 * Not resolved against anything. Whether they actually hold it is `heldByYou`'s
 * question and is asked where a thing would change hands; a haggle that has not
 * closed moves nothing, so naming it back is all this owes anybody.
 */
export function whatIsHeldOut(input: string): string | null {
    const held =
        /\b(?:give|giving|hand|handing|offer|offering|trade|swap|throw in)\s+(?:you|him|her|them|it)?\s*((?:my|the|a|an|this|that|these|those)?\s*[^.?!,]{2,50}?)\s*(?:instead|in exchange|in trade|in return|for it\b|$)/i
            .exec(input.trim());
    if (!held) return null;
    // THE PLAYER'S OWN DETERMINER, TURNED ROUND. They typed "my sword" and the
    // engine is speaking to them, so the sentence it says back is "your sword".
    const named = held[1].trim().replace(/^my\b/i, 'your');
    if (/^(?:you|him|her|them|it|that|this|more|less|nothing)$/i.test(named)) return null;
    // A FIGURE IS NOT GOODS. "I'll give you twenty stones instead" is a
    // counter-offer and `stonesNamedIn` has already read it.
    if (/\bstones?\b/i.test(named)) return null;
    return named.length >= 2 ? named : null;
}

/**
 * The whole of what a sentence put across a table: which of the four it is,
 * and what went with it.
 *
 * One function because the two are one reading, and because a second caller
 * assembling them by hand is how the goods half comes to be read on one road
 * and not on the other. `whatIsHeldOut` is consulted only where the sentence
 * held something out, which is the precedence `whatAHaggleSentenceIs` already
 * settled.
 */
export function whatWasPutAcrossTheTable(
    input: string
): { sentence: WhatTheHaggleSaid; putDown: WhatWasPutDown } {
    const sentence = whatAHaggleSentenceIs(input);
    return {
        sentence,
        putDown: {
            stones: stonesNamedIn(input),
            goods: sentence === 'offered_something_instead' ? whatIsHeldOut(input) : null
        }
    };
}

/**
 * The thing, the figure, and whoever is asking for it.
 */
export interface WhatIsOnTheCounter {
    name: string;
    /** What is being asked, in whole spirit stones. */
    askStones: number;
    /**
     * Who is asking. Null where the price comes off a board and there is
     * nobody to name - which is a fact about the counter, not a missing person.
     */
    sellerName: string | null;
    /**
     * True where the figure is quoted rather than set by whoever is handing the
     * thing over. A board rate does not move, and saying so is the answer.
     */
    theRateIsTheRate: boolean;
    /** Why it does not move, from the one function that says so. Board rates only. */
    whyItDoesNotMove?: string;
}

/** What the player put across the table. */
export interface WhatWasPutDown {
    stones: number | null;
    goods: string | null;
}

export interface HowTheHaggleWent {
    /**
     * The four answers a counterparty gives. `stated` is the price question
     * answered; the other three are the ruling's yes, no and add-more.
     */
    answer: 'stated' | 'yes' | 'no' | 'add_more';
    /** How far short the figure was, in stones. Zero where nothing was short. */
    shortBy: number;
    headline: string;
    lines: string[];
    structure: string;
}

const said = (who: string | null): string => who ?? 'Whoever is holding it';

/**
 * The exchange, resolved.
 *
 * `ladder` is the offer-ladder's own reading of what this person will take, and
 * its `line` is used verbatim wherever the answer is not a plain yes: it is the
 * only thing in the engine that knows a refusal can be information, and a
 * second sentence here saying the same thing differently is how the two drift.
 * Null where the price is a board rate, because nobody is on a rung.
 */
export function howTheHaggleWent(
    sentence: WhatTheHaggleSaid,
    counter: WhatIsOnTheCounter,
    putDown: WhatWasPutDown,
    ladder: WhereTheOfferLandedOnTheLadder | null,
    purse: number
): HowTheHaggleWent {
    const stones = (n: number) => `${n} spirit stone${n === 1 ? '' : 's'}`;
    const who = said(counter.sellerName);
    const priced = `${counter.name} is ${stones(counter.askStones)}. You are carrying `
        + `${purse}.`;
    const account = `${counter.name} at ${counter.askStones} stone(s) from `
        + `${counter.sellerName ?? 'a board rate with nobody behind it'}; put down `
        + `${putDown.stones ?? (putDown.goods ?? 'nothing')}. `
        + `Rate is fixed = ${counter.theRateIsTheRate}. Nothing spent, no time passed.`;

    if (sentence === 'asked_the_price') {
        return {
            answer: 'stated',
            shortBy: 0,
            headline: `${counter.name}, priced.`,
            lines: [
                `${who} names a figure. ${priced}`,
                ...(counter.whyItDoesNotMove ? [counter.whyItDoesNotMove] : []),
                'Asking costs nothing, and so does saying what you would give instead.'
            ],
            structure: account
        };
    }

    // A QUOTED RATE IS THE SAME RATE FOR THE NEXT PERSON IN THE QUEUE, and
    // what moves it is not how hard anybody pushed. Said once, out of the
    // function that owns the sentence, whatever was put down.
    if (counter.theRateIsTheRate) {
        return {
            answer: 'no',
            shortBy: Math.max(0, counter.askStones - (putDown.stones ?? 0)),
            headline: `${counter.name}: the figure does not move.`,
            lines: [
                counter.whyItDoesNotMove ?? '',
                priced
            ].filter(line => line.length > 0),
            structure: account
        };
    }

    // ── THE KIND OF THING COMES BEFORE THE AMOUNT OF IT ──────────────────
    //
    // A figure that clears the ask is still the wrong answer to somebody who
    // will not take money for this, and the arithmetic below would have said
    // yes to it. The ladder is the only thing that knows which medium they are
    // on, and its own sentence names the one that would have worked.
    if (ladder && !ladder.theRightKindOfThing) {
        return {
            answer: 'no',
            shortBy: 0,
            headline: `${counter.name}: not for that.`,
            lines: [ladder.line, priced],
            structure: `${account} Ladder: wants ${ladder.wants}, offered ${ladder.offered}.`
        };
    }

    const offered = putDown.stones;
    if (offered !== null && offered >= counter.askStones) {
        return {
            answer: 'yes',
            shortBy: 0,
            headline: `${counter.name}, at ${stones(offered)}.`,
            lines: [`${who} takes it. ${priced}`],
            structure: account
        };
    }

    if (offered !== null) {
        const short = counter.askStones - offered;
        return {
            answer: 'add_more',
            shortBy: short,
            headline: `${stones(short)} short.`,
            lines: [
                `You say ${stones(offered)}. ${who} wants ${stones(counter.askStones)}, so `
                + `${stones(short)} more closes it.`,
                ...(ladder ? [ladder.line] : [])
            ],
            structure: account
        };
    }

    // NOTHING WAS NAMED, which is the commonest half of a haggle: a complaint
    // about the price, or a thing held out with no figure on it. The ruling
    // says they answer rather than ask back, so the answer is the figure and
    // the rung, and the player still has to say what they are putting down.
    return {
        answer: 'add_more',
        shortBy: counter.askStones,
        headline: putDown.goods === null
            ? `${counter.name}: still ${stones(counter.askStones)}.`
            : `${putDown.goods}, against ${counter.name}.`,
        lines: [
            putDown.goods === null
                ? `${who} does not move off the figure for being told it is high. ${priced}`
                : `You hold out ${putDown.goods}. ${priced}`,
            ...(ladder ? [ladder.line] : []),
            'Name a figure or name what goes across, and the answer is yes or it is not.'
        ],
        structure: account
    };
}
