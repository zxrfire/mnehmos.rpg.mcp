/**
 * How a house finds out something is gone off its own shelf.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner, asked whether a house notices a missing manual on a
 * schedule or when somebody goes looking:
 *
 *   > when somebody goes looking.
 *
 * Not a timer. Three things follow and the second is why it is worth building
 * rather than defaulting.
 *
 *   IT IS DERIVED RATHER THAN CLOCKED. A schedule is a number somebody picks.
 *   *When the shelf is next read* falls out of what the house is doing anyway -
 *   a busy library is read constantly, a shelf nobody has opened in forty years
 *   is not. **The house's own activity sets the risk and nobody tunes it.**
 *
 *   IT MAKES WHAT YOU TAKE MATTER, which is the whole game in a theft. Steal
 *   the manual six disciples are working from and it is missed this week; steal
 *   the one nobody has asked for since the last age and you may never be found
 *   out. That is a real calculation a player can make before acting, and it
 *   needed no new mechanism: the shelf already knows what it holds and the
 *   roster already knows who could be reading it.
 *
 *   AND IT IS NOT A CONCEALMENT ROLL. `when-somebody-works-out-what-you-did.ts`
 *   models somebody slowly piecing together a manoeuvre nobody witnessed, over
 *   years, against the subject's `insight`. **That is the wrong instrument
 *   here and using it would flatter the thief.** A manual taken off a shelf is
 *   not concealed - it is ABSENT FROM AN INVENTORY, and an inventory is either
 *   read or it is not. So there is no `insight` term anywhere in this file and
 *   no notion of how carefully anybody covered their tracks.
 *
 * The question is therefore **not whether but when**, and the whole of the
 * answer is how many people had a reason to open it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHO WOULD OPEN IT, WHICH IS TWO COLUMNS ALREADY ON THE SHELF
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `Manual` carries `requiredOrdinal` - the height you must already be to open
 * it - and `cap`, how far it carries you. Between them they say exactly who in
 * a house has business with a given book:
 *
 *     BELOW `requiredOrdinal`   cannot open it. Not a reader.
 *     AT OR PAST `cap`          has nothing left to get from it. Not a reader.
 *     BETWEEN THE TWO           is working from it, or could be tomorrow.
 *
 * Nothing is authored per manual and there is no popularity field. The deepest
 * book in a house is rarely read because almost nobody in the house clears its
 * bar, and the working road is read constantly because most of the roster sits
 * inside its band - which is the same shape `manuals.ts` already produces for
 * teaching, arrived at from the other end.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND A SUSPECT LIST IS NOT AN ACCUSATION
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The house learns a thing is gone and that a short list of people could have
 * taken it. Which of `discovery.ts`'s stages that lands in is the interesting
 * part, and it is decided by the LENGTH OF THE LIST rather than by a roll:
 *
 *     one person could have    `named`. They can point at you, and
 *                              `canPointAt` is true from that stage up.
 *     more than one            `whisper`. A wrong with nobody's name on it -
 *                              the house knows it happened and cannot say
 *                              whose it was.
 *
 * There is no threshold constant in that and there must not be one: the line
 * is at one because pointing at somebody requires there to be nobody else it
 * could have been. That is also why a member robbing his own library is a
 * worse idea than robbing a stranger's - **the roll of people who can reach an
 * inner shelf is short, and he is on it.**
 *
 * Pure and total. No state, no I/O, and NO STREAM OF ITS OWN: the caller
 * supplies the rng, exactly as `DiscoveryCheck` does, so this file adds no draw
 * to any world. A caller minting one should use the unused name
 * `'a-shelf-is-read'`.
 */

import type { CultivationRNG } from '../cultivation/rng.js';
import type { DayIndex } from '../social/common.js';
import { DAYS_PER_YEAR } from '../social/common.js';
import type { KnowingStage } from '../social/discovery.js';

// ─────────────────────────────────────────────────────────────────────────
// WHO WOULD OPEN IT
// ─────────────────────────────────────────────────────────────────────────

/** What a reader needs to be, off the two columns the shelf already carries. */
export interface WhatItTakesToRead {
    /** The height you must already be to open it. */
    requiredOrdinal: number;
    /** How far it carries you. Past this you have no reason to open it. */
    cap: number;
}

/**
 * How many people on this roll have business with this book.
 *
 * The band between the two columns, counted. Somebody exactly at `cap` is not
 * a reader: they have finished with it, which is the honest reading of a
 * ceiling and is what makes a house's deepest book its quietest shelf.
 */
export function whoWouldOpenIt(
    book: WhatItTakesToRead,
    memberOrdinals: readonly number[]
): number {
    return memberOrdinals.filter(o => o >= book.requiredOrdinal && o < book.cap).length;
}

// ─────────────────────────────────────────────────────────────────────────
// WHEN IT IS MISSED
// ─────────────────────────────────────────────────────────────────────────

/**
 * How often one reader has occasion to go to the shelf, in days.
 *
 * A season. Not a tuning dial for how hard theft is - it is a statement about
 * how often somebody working from a book actually goes back to the room it
 * lives in, and everything interesting about the risk comes from how many
 * readers there are rather than from this.
 */
export const DAYS_BETWEEN_ONE_READER_LOOKING = 90;

/**
 * The chance the shelf is read at all across a stretch of days.
 *
 * Independent readers, each with their own occasion to look: the chance NOBODY
 * looks falls off geometrically in the number of them, so one reader is a
 * coin-flip over a season and six make it near certain within the month. A book
 * with no readers is never opened and the odds are exactly zero - **not a small
 * number, zero** - because there is nobody for whom opening it is a thing that
 * would happen.
 */
export function oddsItIsMissed(input: {
    readers: number;
    daysElapsed: number;
}): number {
    const readers = Math.max(0, Math.floor(input.readers));
    const days = Math.max(0, input.daysElapsed);
    if (readers === 0 || days === 0) return 0;
    const perReader = days / DAYS_BETWEEN_ONE_READER_LOOKING;
    // The chance a given reader has NOT been in, compounded over all of them.
    const nobodyLooked = Math.pow(Math.exp(-perReader), readers);
    return Math.max(0, Math.min(1, 1 - nobodyLooked));
}

/**
 * Roughly how long before somebody goes looking, in years, or null for never.
 *
 * Exported so a player can be told what they are gambling BEFORE they take
 * something, which is the difference between a calculation and a surprise.
 * Null where nobody in the house has any business with the book - the honest
 * answer, and the one that makes the deepest shelf the right thing to steal.
 */
export function yearsBeforeSomebodyLooks(readers: number): number | null {
    const n = Math.max(0, Math.floor(readers));
    if (n === 0) return null;
    return round2(DAYS_BETWEEN_ONE_READER_LOOKING / n / DAYS_PER_YEAR);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE HOUSE LEARNS
// ─────────────────────────────────────────────────────────────────────────

export interface WhatTheHouseLearns {
    /** Whether anybody went to the shelf in this stretch and found it gone. */
    missed: boolean;
    /** Everybody who could have reached it. Not an accusation. */
    couldHaveTakenIt: readonly string[];
    /**
     * How well the house can attribute it, in `discovery.ts`'s own words.
     *
     * `unaware` until somebody looks. `named` where exactly one person could
     * have done it, which is the stage `canPointAt` is true from. `whisper`
     * otherwise - the house holds the wrong and holds no name.
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
 * The rng is the caller's and is rolled ONCE, for the one stochastic fact here:
 * did anybody have occasion to open the shelf in this stretch. Everything else
 * - who the suspects are, whether the house can point at one - is read off
 * rows and is not a draw.
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
