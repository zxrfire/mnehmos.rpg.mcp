/**
 * Communication talismans: the slip a house's people carry to send word home.
 *
 * The design owner: *"you can imagine people out on a sect have communication
 * talismans"*, *"that also gives a way for the people the sect stations out to
 * report back"*. And on what kind of thing one is: *"these are too common and
 * single use, don't bother making them tracked, they're just counted"*, *"you
 * just have a fungible stack"*, *"each communication talisman is marked with a
 * house"*, and they can be made by *"anyone foundation or above"*.
 *
 * So this is one catalog row and three facts about it, and nothing here decides
 * anything:
 *
 *   what it carries    a short message, to the house whose mark it carries, the
 *                      day it is burnt. Not a strike and not a way out; see
 *                      `a-talisman-is-one-act-somebody-already-paid-for.ts` for
 *                      the two slips that are rows with a history
 *   how far            {@link THE_COMMUNICATION_TALISMAN}'s own reach, in walking
 *                      days. A property of the slip, not of whoever cut it
 *   who can cut one    {@link WHO_CAN_CUT_A_COMMUNICATION_TALISMAN}, one rung
 *
 * ── ONE ROW, AND WHY NOT A GRADE TABLE ───────────────────────────────────
 *
 * Mortal grade, because that is the owner's ruling said in this engine's words:
 * `howAGradeIsStored('mortal')` is `counted`, so a stack is a number and a burnt
 * one leaves nothing. A longer-reaching slip would be worth having - the genre's
 * ten-thousand-li slip, which a house would sign for - and it would be a
 * heaven-grade row, which `howAGradeIsStored` makes TRACKED, a row with a
 * history like the strike and the way out. It is not built. A second counted
 * row would only be a second number for how far word goes.
 *
 * ── THE REACH ────────────────────────────────────────────────────────────
 *
 * Twelve walking days: the near provinces. That is the figure this setting
 * already gives a thousand li when it is flown (`thousand-li-cloud-tread`, in
 * `docs/world/climbing/capability-gaps-by-realm.md`), and it is chosen against
 * the map rather than for a round number. Measured on two seeded worlds at
 * twenty-five years, walking days from a house's seat: every post a house keeps
 * is 0 (a town in its own province), every door in its province is 0, a party
 * out on an errand runs p50 0-15 and p90 11-17 with a longest of 26, and the
 * whole world is 28 across. So a stationed member always reaches home, a party
 * usually does, and a party on the far side of the world has to wait - which is
 * the limit being a fact about the map rather than a rule.
 */

import { FOUNDATION_ORDINAL } from '../../engine/cultivation/realms.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';

export interface ACommunicationTalisman {
    id: string;
    /** The engine's own word for it. A player may call it other things. */
    name: string;
    /** Counted grades only. See the header for the one that would not be. */
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
