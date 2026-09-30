/**
 * House communication talismans: ordinary pairs are counted; heaven pairs are tracked.
 * Ordinary reach is twelve walking days, the setting's thousand-li span.
 * A ten-thousand-li heaven slip carries ten times that distance. Both burn once.
 * Graded crafting, ownership, hall twins and provenance live in the ordinary object store.
 */

import { FOUNDATION_ORDINAL } from '../../engine/cultivation/realms.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';

export interface ACommunicationTalisman {
    id: string;
    /** The engine's own word for it. A player may call it other things. */
    name: string;
    /** The grade decides whether a slip is counted or tracked. */
    grade: TechniqueGrade;
    /** How far a burnt one carries word, in walking days. */
    reachWalkingDays: number;
    /** What it is, said once and plainly. */
    what: string;
}

export const THE_COMMUNICATION_TALISMAN: ACommunicationTalisman = {
    id: 'communication-talisman',
    name: 'communication talisman',
    grade: 'mortal',
    reachWalkingDays: 12,
    what: 'A slip marked with a house. Burnt, it carries a short message to that house the same '
        + 'day, as far as the near provinces, and then there is no slip.'
};

export const THE_LONG_RANGE_COMMUNICATION_TALISMAN: ACommunicationTalisman = {
    id: 'heaven-communication-talisman', name: 'heaven communication talisman',
    grade: 'heaven', reachWalkingDays: 120,
    what: 'A single-use slip keyed to its bearer and marked with a house. Its twin is kept in that house\'s hall. It carries word across ten thousand li.'
};

/**
 * The rung that can cut one. The owner: *"anyone foundation or above"*.
 *
 * One constant and not a grade gate. `canRefineGrade('mortal', ...)` would let a
 * Qi Condensation hand cut one, and the ruling says otherwise: putting a voice
 * into paper wants a foundation to put it there from.
 */
export const WHO_CAN_CUT_A_COMMUNICATION_TALISMAN = FOUNDATION_ORDINAL;

/**
 * How many one sitting cuts, and how long a sitting is.
 *
 * *"Making a few takes little time."* No recipe: a mortal-grade slip asks for
 * none (`isAWorkedGrade`), which is the same answer every other mortal slip at a
 * bench already gets. So the cost is the day.
 */
export const CUT_IN_A_SITTING = 3;
export const DAYS_A_SITTING_TAKES = 1;

/** Whether this hand can cut one. */
export function couldCutACommunicationTalisman(ordinal: number): boolean {
    return ordinal >= WHO_CAN_CUT_A_COMMUNICATION_TALISMAN;
}

/** Days at it to cut this many. Never zero for somebody who cuts any. */
export function daysToCut(count: number): number {
    const many = Math.max(0, Math.floor(count));
    if (many === 0) return 0;
    return Math.ceil(many / CUT_IN_A_SITTING) * DAYS_A_SITTING_TAKES;
}

// ─────────────────────────────────────────────────────────────────────────
// THE PAIRED COMMUNICATION JADE
// ─────────────────────────────────────────────────────────────────────────

/** A pair of jade halves, each of which sends word to the other. */
export interface APairedCommunicationJade {
    id: string;
    name: string;
    /** Tracked: a row with a history for each half, per `howMuchAGradeIsWorthTracking`. */
    grade: TechniqueGrade;
    what: string;
}

/**
 * The reusable channel. The design owner: two halves of one earth-grade object,
 * each keyed to its holder like a slip; either half sends to the other as many
 * times as wanted, and nothing is spent. Masters and elders carry them, and a
 * master gives one half to a disciple they value and keeps the twin.
 *
 * Earth grade, so it is made on the crafting curve by a hand that can work that
 * grade (`canRefineGrade('earth', ...)`) and priced on the maker's time
 * (`whatACommissionComesTo`). No reach: a jade answers to its twin, not to a map.
 */
export const THE_PAIRED_COMMUNICATION_JADE: APairedCommunicationJade = {
    id: 'paired-communication-jade',
    name: 'communication jade',
    grade: 'earth',
    // THE NOUN IS THE ONE ON THE LINE ABOVE. This read "one half of a pair of
    // jade TABLETS", which is a third word for a thing the design owner has
    // already named twice - communication jade, and jade pair. It also collides
    // with the settled sense of `tablet` in this world, which is a thing
    // written on and kept in a hall: a name on a tablet, a wax tablet, the
    // Pavilion's tablet hall.
    what: 'One half of a communication jade, keyed to its holder. Word spoken into it reaches whoever '
        + 'holds the other half, as often as it is used, until one of the two holders is dead.'
};
