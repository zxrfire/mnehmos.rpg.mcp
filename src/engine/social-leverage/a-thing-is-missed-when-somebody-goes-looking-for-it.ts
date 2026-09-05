/**
 * How a house finds out something is gone off its own shelf.
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import type { DayIndex } from '../social/common.js';
import { DAYS_PER_YEAR } from '../social/common.js';
import type { KnowingStage } from '../social/discovery.js';

/** What a reader needs to be, off the two columns the shelf already carries. */
export interface WhatItTakesToRead {
    /** The height you must already be to open it. */
    requiredOrdinal: number;
    /** How far it carries you. Past this you have no reason to open it. */
    cap: number;
}

/**
 * How many people on this roll have business with this book. Somebody exactly at
 * `cap` is not a reader: they have finished with it, which is what makes a
 * house's deepest book its quietest shelf.
 */
export function whoWouldOpenIt(
    book: WhatItTakesToRead,
    memberOrdinals: readonly number[]
): number {
    return memberOrdinals.filter(o => o >= book.requiredOrdinal && o < book.cap).length;
}

/**
 * How often one reader has occasion to go to the shelf, in days.
 *
 * Not a tuning dial for how hard theft is - everything interesting about the risk
 * comes from how many readers there are rather than from this.
 */
export const DAYS_BETWEEN_ONE_READER_LOOKING = 90;

/**
 * The chance the shelf is read at all across a stretch of days.
 */
export function oddsItIsMissed(input: {
    readers: number;
    daysElapsed: number;
}): number {
    const readers = Math.max(0, Math.floor(input.readers));
    const days = Math.max(0, input.daysElapsed);
    if (readers === 0 || days === 0) return 0;
    const perReader = days / DAYS_BETWEEN_ONE_READER_LOOKING;
    const nobodyLooked = Math.pow(Math.exp(-perReader), readers);
    return Math.max(0, Math.min(1, 1 - nobodyLooked));
}

/**
 * Roughly how long before somebody goes looking, in years, or null for never.
 *
 * Exported so a player can be told what they are gambling BEFORE they take
 * something, which is the difference between a calculation and a surprise.
 */
export function yearsBeforeSomebodyLooks(readers: number): number | null {
    const n = Math.max(0, Math.floor(readers));
    if (n === 0) return null;
    return round2(DAYS_BETWEEN_ONE_READER_LOOKING / n / DAYS_PER_YEAR);
}

export interface WhatTheHouseLearns {
    /** Whether anybody went to the shelf in this stretch and found it gone. */
    missed: boolean;
    /** Everybody who could have reached it. Not an accusation. */
    couldHaveTakenIt: readonly string[];
    /**
     * How well the house can attribute it, in `discovery.ts`'s own words.
     */
    stage: KnowingStage;
    /** How long a house would ordinarily wait to find out. Null for never. */
    yearsItWouldTake: number | null;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * Whether the house went looking, and what it can say if it did.
 *
 * The rng is rolled ONCE, for the one stochastic fact here: did anybody have
 * occasion to open the shelf. Everything else is read off rows.
 */
export function whatTheHouseLearns(input: {
    book: WhatItTakesToRead;
    /** Rungs of everybody on the roll. Decides who would open it. */
    memberOrdinals: readonly number[];
    /** Who could physically have reached the room. The caller's, off the bar. */
    couldHaveReachedIt: readonly string[];
    daysElapsed: number;
    onDay: DayIndex;
    rng: CultivationRNG;
}): WhatTheHouseLearns {
    const readers = whoWouldOpenIt(input.book, input.memberOrdinals);
    const odds = oddsItIsMissed({ readers, daysElapsed: input.daysElapsed });
    const missed = odds > 0 && input.rng.next() < odds;
    const suspects = [...input.couldHaveReachedIt];
    const yearsItWouldTake = yearsBeforeSomebodyLooks(readers);

    const stage: KnowingStage = !missed
        ? 'unaware'
        : suspects.length === 1
            ? 'named'
            : 'whisper';

    return {
        missed,
        couldHaveTakenIt: suspects,
        stage,
        yearsItWouldTake,
        line: !missed
            ? readers === 0
                ? 'Nobody in this house has any business with that book, so nobody has opened '
                  + 'the shelf and nobody is going to. It is not that they have failed to '
                  + 'notice - there is no occasion on which they would.'
                : `${readers} people work from it and none of them has been in yet. It is still `
                  + 'sitting there as far as anybody here knows.'
            : suspects.length === 1
                ? 'Somebody went for it and it was not there. Exactly one person could have '
                  + 'reached that shelf, so the house is not wondering who - it knows, and it '
                  + 'has known since the moment it looked.'
                : `Somebody went for it and it was not there. ${suspects.length} people could `
                  + 'have reached that shelf, so what the house is holding is the wrong and not '
                  + 'a name.'
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
