/**
 * THE NUMBERS BEHIND A REQUEST, SAID IN WORDS - TO THE PLAYER AND TO THE LOG.
 *
 * One module for both audiences, because they turned out to be the same
 * sentence written twice, and finding that out cost a played run.
 *
 * ── WHAT WAS MEASURED ────────────────────────────────────────────────────
 *
 * Somebody bought the same person a drink EIGHTEEN TIMES. Every reply came
 * back "civil about it and it goes nowhere", byte-identical after the third,
 * and they nearly filed the verb as broken. It was not: the character was Charm
 * 1, Fortune 1, on a muddled five-element root - the worst social character the
 * game can roll - and the approach was landing at 13%, so eighteen misses is
 * about an 8% run. Bad luck, correctly modelled.
 *
 * The engine knew all of that. It was on the mechanical channel, as this:
 *
 *     request(nothing): outcome=refused, odds=0.13, ask=a_courtesy, days=1,
 *                       theyKnowWhatYouTried=true, reachedTheHouse=false,
 *                       priorAsks=17
 *
 * Two defects in one line. The player-facing prose never said the odds or the
 * count, so the one player most likely to conclude the feature is broken - the
 * one with the worst numbers - was given the least information. And the channel
 * that DID have them said them as a field dump, which the landing page's own
 * promise forbids: *"Every number below is the engine's, shown as it was
 * computed."* A dump of `key=value` does not honour that; it shows the value and
 * hides what it is.
 *
 * So the fix is one fix. Say the arithmetic in words, and hand the same words to
 * both surfaces. The prose gets the shape of it - how often a thing like this
 * lands, and how many times it has been tried. The channel gets all of it,
 * every term named and every enum resolved.
 *
 * ── THE STANDARD THIS MATCHES ────────────────────────────────────────────
 *
 * Set by the two passes over the rest of the channel, which took it from 142
 * key=value emitters to 78 and `entities.ts` to zero. The bar, from the
 * destinations read:
 *
 *     Fourhands, in The White Stair: thin qi, half rate. 9 drawing on ground
 *     that comfortably carries 7, which is over it.
 *
 * Every figure kept, every enum resolved, said as a sentence. Ordinals go
 * through `rungAndOrdinal`, which is the single place that decision is made -
 * five modules had been making it separately and had already drifted, and the
 * parenthetical form is the one that composes anywhere.
 *
 * Pure. Numbers in, sentences out.
 */

import type { AskWeight } from '../engine/social-leverage/index.js';
import type { ApproachLeverage } from '../schema/cultivation.js';
import { rungAndOrdinal } from './facts.js';

// ─────────────────────────────────────────────────────────────────────────
// HOW OFTEN A THING LIKE THIS LANDS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The odds, in the form somebody can act on.
 *
 * A percentage alone is a number a player has to do arithmetic on before it
 * means anything; "one time in eight" is the same fact already divided. Both,
 * because the first is what an operator compares and the second is what a
 * person understands, and this channel promises the first while the prose needs
 * the second.
 */
export function howOftenThisLands(odds: number): string {
    const safe = Math.min(Math.max(odds, 0.0001), 1);
    const inAHundred = Math.round(safe * 100);
    const oneIn = Math.max(1, Math.round(1 / safe));
    return oneIn <= 2
        ? `${inAHundred} times in a hundred`
        : `about one time in ${oneIn} (${inAHundred} in a hundred)`;
}

/**
 * What the odds and the count mean together, for the player.
 *
 * The half that was missing, and the reason eighteen identical replies read as
 * a broken verb rather than as a run of bad luck. Note what it does NOT do: it
 * never says the approach was wrong, because it usually was not. It says how
 * often a thing like this comes off and how many times it has been tried, and
 * lets the player draw the conclusion.
 *
 * The last clause is arithmetic rather than sympathy: an attempt count at or
 * past twice the expected wait is, factually, an unlucky run, and saying so is
 * the difference between a player who tries once more and a player who files a
 * bug.
 */
export function howItHasBeenGoing(odds: number, priorAsks: number, landed: boolean): string {
    const attempt = priorAsks + 1;
    const expectedWait = Math.max(1, Math.round(1 / Math.min(Math.max(odds, 0.0001), 1)));
    const often = howOftenThisLands(odds);

    if (landed) {
        return attempt === 1
            ? `Something like this comes off ${often}, and it came off first time.`
            : `Something like this comes off ${often}. That was attempt ${attempt}.`;
    }
    if (attempt === 1) {
        return `Something like this comes off ${often}, and this was the first try.`;
    }
    const unlucky = attempt >= expectedWait * 2
        ? ' That is further than the arithmetic expects, which makes it a bad run rather than a '
          + 'wall.'
        : '';
    return `Something like this comes off ${often}. That was attempt ${attempt}.${unlucky}`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ENUMS, RESOLVED
//
// Every one of these was a bare token on the channel. A player reading
// `ask=a_real_favour` has been shown a field value; a player reading "a real
// favour, which costs them something" has been shown what the engine decided.
// ─────────────────────────────────────────────────────────────────────────

const WHAT_THE_ASK_WAS: Readonly<Record<AskWeight, string>> = {
    a_courtesy: 'a courtesy, which costs them nothing',
    a_real_favour: 'a real favour, which costs them something',
    against_their_interest: 'something that leaves them worse off',
    a_betrayal: 'a betrayal, which ends them if it is found out'
};

const WHAT_WAS_ON_THE_TABLE: Readonly<Record<string, string>> = {
    none: 'nothing on the table but the asking',
    coin: 'money on the table',
    favour: 'a favour to call in',
    debt: 'a debt they could not deny',
    name: 'their own name',
    sect: 'a house standing behind them',
    force: 'what they could do about a refusal',
    secret: 'something they would pay not to have said aloud',
    attachment: 'themselves'
};

const WHAT_WAS_BEING_ASKED_FOR: Readonly<Record<string, string>> = {
    teaching: 'to be taught an art',
    discipleship: 'to be taken on as a disciple',
    introduction: 'to be introduced to somebody',
    telling: 'to be told something they know',
    a_thing: 'for a thing',
    nothing: 'for nothing at all',
    weigh: 'nothing yet - this was weighed and not put'
};

const HOW_IT_WENT: Readonly<Record<string, string>> = {
    taken: 'they agreed',
    turned: 'they agreed, and took hold of the fact that they were asked',
    refused: 'they said no, and it stayed between the two of them',
    reported: 'they said no, and it reached their house'
};

const resolved = (table: Readonly<Record<string, string>>, key: string): string =>
    table[key] ?? key;

// ─────────────────────────────────────────────────────────────────────────
// THE TERMS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What each term of the odds actually is.
 *
 * `resolveAttempt` hands back its whole breakdown by design - "every term,
 * named, so a probe can print why it went the way it did" - and printing the
 * keys was showing the probe's vocabulary rather than the engine's reasoning.
 * The keys are the resolver's and are not renamed anywhere; this is the reading
 * of them.
 */
const WHAT_EACH_TERM_IS: Readonly<Record<string, string>> = {
    base: 'the starting answer to any request, which is no',
    standing: 'the gap in standing between them',
    charm: 'charm',
    tie: 'what they already make of the asker',
    owed: 'what is owed the asker\'s way',
    wants: 'something they want that the asker could reach',
    grudge: 'an open grudge they hold',
    ask: 'the weight of the thing asked for',
    purse: 'the money put down',
    room: 'who else was in the room'
};

const points = (value: number): string => {
    const n = Math.round(Math.abs(value) * 100);
    return `${n} point${n === 1 ? '' : 's'}`;
};

/**
 * Every term of the odds, as a sentence.
 *
 * Non-zero terms get a clause each, in the order the resolver computed them, so
 * the arithmetic can be followed. The zero terms are named together rather than
 * dropped, because "nothing was owed and nobody was watching" is a fact about
 * the approach and an absent line reads as an omission.
 */
export function theTermsInWords(
    terms: Readonly<Record<string, number>>,
    /**
     * The odds the resolver actually used.
     *
     * Supplied so the CLAMP can be said. The terms are a sum, and a reader who
     * adds them up gets -1 in a hundred against stated odds of 2 - which looks
     * like the breakdown lying, and is in fact `ODDS_FLOOR` doing the one job
     * it exists for: "the floor is what keeps 'typically does not' from
     * becoming 'never'". An arithmetic trail that does not reach the number it
     * is explaining is worse than none.
     */
    odds?: number
): string {
    const moved: string[] = [];
    const flat: string[] = [];

    for (const [key, value] of Object.entries(terms)) {
        const name = WHAT_EACH_TERM_IS[key] ?? key;
        if (key === 'base') continue;
        if (Math.round(value * 100) === 0) {
            flat.push(name);
            continue;
        }
        moved.push(`${name} ${value > 0 ? 'added' : 'cost'} ${points(value)}`);
    }

    // Points, like every other term, so that "in a hundred" is left meaning
    // the ODDS and nothing else. Two units in one sentence is how a reader -
    // and a test - ends up parsing the wrong number out of it.
    const start = terms.base === undefined
        ? ''
        : `Starting from ${points(terms.base)}: `;
    const body = moved.length > 0 ? moved.join(', ') : 'nothing moved it either way';
    const nothing = flat.length > 0
        ? ` Nothing came from ${flat.join(', ')}.`
        : '';

    // Where the sum and the answer disagree, say which one moved and why. Both
    // ends: the floor exists because nothing here is impossible, and the
    // ceiling because nothing here is a formality.
    let clamp = '';
    if (odds !== undefined) {
        const summed = Object.values(terms).reduce((total, value) => total + value, 0);
        const inAHundred = Math.round(odds * 100);
        const summedInAHundred = Math.round(summed * 100);
        if (summedInAHundred < inAHundred) {
            clamp = ` The terms come to ${summedInAHundred}, and the floor lifts the answer to `
                + `${inAHundred} in a hundred, because nothing in this world is impossible.`;
        } else if (summedInAHundred > inAHundred) {
            clamp = ` The terms come to ${summedInAHundred}, and the ceiling holds the answer at `
                + `${inAHundred} in a hundred, because nothing in this world is a formality.`;
        }
    }
    return `${start}${body}.${nothing}${clamp}`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE WHOLE ATTEMPT, FOR THE CHANNEL
// ─────────────────────────────────────────────────────────────────────────

export interface AnAskThatWasPut {
    subject: string;
    /** A `RequestKind`, or `weigh` for the read that stops before the roll. */
    kind: string;
    ask: AskWeight;
    leverage: ApproachLeverage | undefined;
    odds: number;
    terms: Readonly<Record<string, number>>;
    /** Absent for the read, which resolves nothing. */
    outcome?: string;
    days?: number;
    stonesSpent?: number;
    priorAsks: number;
    /** True once the caller has actually written the records down. */
    wroteToTheLedger?: boolean;
    reachedTheHouse?: boolean;
}

/**
 * One request, said as the engine decided it.
 *
 * Everything the field dump carried, and nothing it did not: outcome, odds,
 * every term, the ask, the leverage, the days, the stones, the attempt count.
 * The difference is that it can be read.
 */
export function whatTheAskCameTo(put: AnAskThatWasPut): string {
    const what = resolved(WHAT_WAS_BEING_ASKED_FOR, put.kind);
    const table = resolved(WHAT_WAS_ON_THE_TABLE, put.leverage ?? 'none');
    const weight = WHAT_THE_ASK_WAS[put.ask];
    const attempt = put.priorAsks > 0
        ? ` This was attempt ${put.priorAsks + 1} at it.`
        : '';

    if (put.outcome === undefined) {
        return `${put.subject}, asked ${what} with ${table}: not put, only weighed. `
            + `It is ${weight}, and it would come off ${howOftenThisLands(put.odds)}. `
            + `${theTermsInWords(put.terms, put.odds)}${attempt} No day passed and nothing `
            + 'changed hands.';
    }

    // The stones are said even at zero, for the same reason the unmoved terms
    // are named: an absent figure reads as an omission, and "no spirit stones
    // went with it" is a fact about a refusal that somebody checking the purse
    // needs.
    const spent = [
        put.days === undefined
            ? null
            : `${put.days} day${put.days === 1 ? '' : 's'} went into it`,
        put.stonesSpent === undefined
            ? null
            : put.stonesSpent > 0
                ? `${put.stonesSpent} spirit stone`
                  + `${put.stonesSpent === 1 ? '' : 's'} went with it`
                : 'no spirit stones went with it'
    ].filter((clause): clause is string => clause !== null).join(', ');

    const after = [
        put.wroteToTheLedger ? 'It is on the ledger' : 'Nothing went onto the ledger',
        put.reachedTheHouse ? 'and their house was told' : null
    ].filter((clause): clause is string => clause !== null).join(' ');

    return `${put.subject}, asked ${what} with ${table}: `
        + `${resolved(HOW_IT_WENT, put.outcome)}. It is ${weight}, and it comes off `
        + `${howOftenThisLands(put.odds)}.${attempt} ${theTermsInWords(put.terms, put.odds)} `
        + `${spent}. ${after}.`;
}

// ─────────────────────────────────────────────────────────────────────────
// THE PIECES THE COSTING LAYER NEEDS
// ─────────────────────────────────────────────────────────────────────────

/** How far apart two people stand, said as rungs and as both rungs. */
export function theGapInWords(theirs: number, ours: number): string {
    const gap = theirs - ours;
    if (gap === 0) return `both at ${rungAndOrdinal(ours)}`;
    return `${rungAndOrdinal(theirs)} against ${rungAndOrdinal(ours)}, `
        + `${Math.abs(gap)} rung${Math.abs(gap) === 1 ? '' : 's'} `
        + `${gap > 0 ? 'above' : 'below'}`;
}

/** The ask weight, resolved, for a costing line. */
export function theAskInWords(ask: AskWeight): string {
    return WHAT_THE_ASK_WAS[ask];
}
