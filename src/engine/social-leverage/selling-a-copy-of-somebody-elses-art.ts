/**
 * Writing out a house's art and selling the copy.
 */

import type { KnowingStage } from '../social/discovery.js';
import type { Certainty } from '../world/recognising-whose-art-you-just-watched.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationCause } from '../social/grudges.js';
import type { Deed } from './what-a-deed-leaves.js';

/**
 * `betrayalOfSelling`'s rungs, as the fraction of what the house had - the
 * difference between what it holds and what anybody else can get.
 */
export const WHAT_A_LEAK_COSTS_THE_HOUSE: Readonly<Record<1 | 2 | 3, number>> =
    Object.freeze({ 1: 0.25, 2: 0.5, 3: 0.9 });

/**
 * The ledger's own word for it, which differs by whose art it was. A handle for
 * a reader in forty years, never an input: `grudges.ts` forbids branching on a
 * cause.
 */
export function theLedgersWordForALeak(rung: 1 | 2 | 3, sellerIsOfTheHouse: boolean): ObligationCause {
    return sellerIsOfTheHouse || rung === 3 ? 'betrayal' : 'robbery';
}

/**
 * How far a house gets on the ladder of knowing, from what one person standing
 * there made of the thing that changed hands.
 */
export function theStageAWitnessReaches(reference: Certainty): KnowingStage {
    if (reference === 'certain') return 'placed';
    if (reference === 'consistent') return 'named';
    return 'unaware';
}

export interface ALeak {
    /** `betrayalOfSelling`'s rung. 0 is nobody's art and opens nothing. */
    rung: 0 | 1 | 2 | 3;
    /** The house whose art it was, or null when it is nobody's. */
    ownerFactionId: string | null;
    /** True when the seller wears that house's colours. */
    sellerIsOfTheHouse: boolean;
    sellerName: string;
    artName: string;
    /** What they were paid, for the record. Never a weight. */
    stones: number;
    onDay: DayIndex;
    /**
     * Everybody who got far enough up the ladder of knowing to name it, faction ids
     * and person ids both.
     */
    knownTo: readonly string[];
    /** How many people were standing there at all. A tag, never a weight. */
    witnesses: number;
}

/**
 * The leak, as an ordinary deed the ordinary machinery prices.
 *
 * Null at rung 0, which is not a softening: an art four houses teach is nobody's
 * and selling a copy of it is a living rather than a wrong.
 */
export function theLeakAsADeed(leak: ALeak): Deed | null {
    if (leak.rung === 0 || leak.ownerFactionId === null) return null;
    return {
        cause: theLedgersWordForALeak(leak.rung, leak.sellerIsOfTheHouse),
        // The house paid. `paidBy: 'subject'` is the direction the ledger uses
        // for a wrong done TO the party the record is about.
        paidBy: 'subject',
        cost: WHAT_A_LEAK_COSTS_THE_HOUSE[leak.rung],
        // ALWAYS. Once it is out it is out, and no amount of anything puts it
        // back - the one fact separating this from every theft in the world.
        irreversible: true,
        // A member gave a word when they took the colours. Somebody who never
        // did has broken no promise, whatever else they have done.
        ...(leak.sellerIsOfTheHouse ? { promised: true } : {}),
        onDay: leak.onDay,
        description:
            `${leak.sellerName} wrote out a copy of ${leak.artName} and sold it for `
            + `${leak.stones} spirit stone${leak.stones === 1 ? '' : 's'}.`,
        knownTo: leak.knownTo,
        witnesses: leak.witnesses,
        participants: [leak.ownerFactionId],
        tags: [
            'leaked_an_art',
            `rung:${leak.rung}`,
            ...(leak.sellerIsOfTheHouse ? ['their_own_house'] : [])
        ]
    };
}
