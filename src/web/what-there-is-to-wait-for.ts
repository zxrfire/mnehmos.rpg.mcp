/**
 * Which dated thing a wait lands on, and what there is when it lands on none.
 *
 * FOUND BY PLAYING, engine-only at Wind Turn: `i wait until the intake` and
 * `i wait for the intake` both spent ONE DAY against a wall that said the
 * soonest intake was 24 days off. `parseDuration` reads a span, a named event
 * is not one, and the sentence fell through to the handler's default - so the
 * turn reported success and the player had no way to see that none of what
 * they said had been read.
 *
 * A selection, like `whatIsLiveForYouHere`. Nothing here is stored and nothing
 * is spawned: a date comes from the paper on the wall or from a word this
 * cultivator has given, both of which were already computed before the sentence
 * was typed.
 *
 * `likeness` comes from the caller for the reason `whatSomebodyHereWouldAsk`
 * gives for the same parameter: one answer to "are these the same name" serves
 * the resolver and this, and the two cannot drift into disagreeing.
 */

/** One thing with a day on it, as the engine that dated it says it. */
export interface ADatedThing {
    /** What the player would call it, for the match. */
    readonly name: string;
    /** What it is and when, in the engine's own words. Never rewritten here. */
    readonly saying: string;
    /** Days from now until it falls. A date already past is not passed in. */
    readonly inDays: number;
    /**
     * Whether it is nailed up where the player is standing.
     *
     * `the intake` is a reference to PAPER rather than a name, and the read
     * that owns what it means - `whichHouseThePaperMeans` - answers off the
     * wall. A word somebody gave is dated and is not on the wall, so it cannot
     * be what that phrase points at.
     */
    readonly onPaper: boolean;
}

export interface WhatAWaitLandsOn {
    /** The one thing the phrase reached, or null. */
    readonly settled: ADatedThing | null;
    /**
     * What there is to wait for, when the phrase reached none or more than one.
     *
     * The near candidates where there were any, and everything dated where
     * there were not - because a player who named a thing this ground has never
     * heard of is owed the list rather than a blank look.
     */
    readonly couldHaveBeen: readonly ADatedThing[];
}

export function whatThereIsToWaitFor(input: {
    /** The phrase the player used, as they typed it. */
    readonly askedFor: string;
    readonly dated: readonly ADatedThing[];
    readonly likeness: (said: string, name: string) => number;
    /** The bar a match has to clear, in `likeness`'s own units. */
    readonly closeEnough: number;
    /** The lower bar for offering something back as what they might have meant. */
    readonly nearEnoughToOffer: number;
}): WhatAWaitLandsOn {
    const scored = input.dated
        .map(thing => ({ thing, score: input.likeness(input.askedFor, thing.name) }));

    const best = scored.reduce((high, one) => Math.max(high, one.score), 0);
    if (best >= input.closeEnough) {
        const winners = scored.filter(one => one.score === best).map(one => one.thing);
        // TWO THINGS SCORING ALIKE POINT AT NEITHER. `the intake` against a wall
        // carrying two of them is the case, and it is the ruling
        // `whichHouseThePaperMeans` already keeps for the same phrase.
        if (winners.length === 1) return { settled: winners[0]!, couldHaveBeen: winners };
        return { settled: null, couldHaveBeen: winners };
    }

    const near = scored
        .filter(one => one.score >= input.nearEnoughToOffer)
        .sort((a, b) => b.score - a.score)
        .map(one => one.thing);
    return {
        settled: null,
        couldHaveBeen: near.length > 0
            ? near
            : [...input.dated].sort((a, b) => a.inDays - b.inDays)
    };
}
