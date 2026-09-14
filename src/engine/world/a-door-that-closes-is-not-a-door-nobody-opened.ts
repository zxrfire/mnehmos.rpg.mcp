/**
 * Which kind of shut a piece of ground is shut, and when the door next opens.
 *
 * Two kinds of shut, and the record used to answer both at once:
 *
 *   a door nobody has opened    `ruin_opened` unseals it once, tags it
 *                               `emptied`, and it never shuts again. Nothing
 *                               is scheduled; somebody has to go and open it.
 *   a door that closes          an `OpeningCycle` shuts and unshuts it on its
 *                               own schedule, and the schedule is the fact.
 *                               Nothing anybody does opens one for good and
 *                               nothing has to go and re-shut it.
 *
 * Both mean nobody gets in today, which is all any consumer needed, so the
 * distinction only bites when something wants to WAIT for a door - and waiting
 * is the whole of what makes a cycle playable. The discriminator is the cycle
 * itself: measured over twelve seeded worlds, 72 of 144 ruins carry one, and
 * every one of the 72 also carries `sealed`. That column is now a reading of
 * the schedule rather than a second answer beside it - `isOpenOn` ignores it
 * wherever a cycle exists - so a pass that set it could no longer leave a door
 * standing open against its own season.
 *
 * A READING, not a state field. Nothing here is stored.
 *
 * WHAT IS TRUE, NOT WHAT ANYBODY KNOWS. Working out when a site is next due
 * takes records nobody local keeps, and `readSchedule` is the gated half -
 * same arithmetic, behind `scheduleReadOrdinal` and a comprehension key. Hand
 * a narrator this one and it will say the day out loud to somebody who has no
 * way of knowing it.
 *
 * Pure. A record and a day in, an answer out.
 */

import { convergenceOf } from './convergence.js';
import { CYCLE_YEARS } from './how-long-a-door-stays-shut.js';
import type { LocationRecord } from './locations.js';

/** The tag `ruin_opened` leaves on ground somebody has already been through. */
export const SPENT = 'emptied';

/** Days in a year, on the world clock. */
const YEAR = 365;

/**
 * What shuts a door that shuts itself.
 *
 * Ordinary furniture, and it is content rather than a mechanic: nothing reads
 * the answer to decide anything, and the schedule is the same schedule whichever
 * of the three a site gets. It is here because a player standing at a ruin that
 * will not let them in is owed the reason the world gives, and "it is shut"
 * on its own reads as something somebody did to it.
 *
 * Read off the row so it is not one sentence everywhere: ground with a formation
 * still standing on it closes because the formation closes, and ground without
 * one closes on whatever it was keyed to. The long waits get the stars, because
 * a season nobody alive has seen twice is not a season.
 */
export type WhatShutsIt = 'the_formation' | 'the_season' | 'the_stars';

export const WHAT_SHUTS_IT: Readonly<Record<WhatShutsIt, string>> = {
    the_formation: 'The formation closes it.',
    the_season: 'It closes when the season turns.',
    the_stars: 'It closes when the stars come out of line.'
};

/** Null for anything that does not shut itself. */
export function whatShutsThisDoor(location: LocationRecord): WhatShutsIt | null {
    const cycle = location.cycle;
    if (!cycle || cycle.periodDays <= 0 || cycle.openDays <= 0) return null;
    if (location.hazards.includes('formation')) return 'the_formation';
    return cycle.periodDays >= CYCLE_YEARS.middling * YEAR ? 'the_stars' : 'the_season';
}

export type HowItIsShut =
    /** Standing open today. Whether anybody may go in is a separate question. */
    | 'open'
    /** Shut, and a schedule opens it again. The day is on the reading. */
    | 'shut_until_its_season'
    /** Shut, and nothing opens it but somebody going and opening it. */
    | 'shut_until_somebody_opens_it';

export interface WhetherTheDoorOpensAgain {
    howItIsShut: HowItIsShut;
    /** Absolute day the door next stands open. Null when nothing is due. */
    opensOnDay: number | null;
    /** Days from the day asked about. Null when nothing is due. */
    daysUntilItOpens: number | null;
    /**
     * How long it stands open once it does. Zero where nothing is scheduled.
     */
    openDays: number;
    /** Somebody has already been through and taken what was in it. */
    spent: boolean;
}

/**
 * Which of the two kinds of shut this is.
 *
 * The `emptied` tag is reported rather than folded into the answer: a spent
 * ruin is open ground and reads as open, and what it is worth to walk into is
 * the caller's question, not this one's.
 */
export function howThisGroundIsShut(
    location: LocationRecord,
    onDay: number
): WhetherTheDoorOpensAgain {
    const convergence = convergenceOf(location, onDay);
    const spent = location.tags.includes(SPENT);

    if (convergence.open) {
        return {
            howItIsShut: 'open',
            opensOnDay: onDay,
            daysUntilItOpens: 0,
            openDays: convergence.cyclical ? convergence.windowDays : 0,
            spent
        };
    }

    // A cycle with a period or a window of zero is a schedule that never comes
    // round, which is the same fact as having no schedule at all.
    const opensOnDay = convergence.opensOnDay;
    if (!convergence.cyclical || opensOnDay === null) {
        return {
            howItIsShut: 'shut_until_somebody_opens_it',
            opensOnDay: null,
            daysUntilItOpens: null,
            openDays: 0,
            spent
        };
    }

    return {
        howItIsShut: 'shut_until_its_season',
        opensOnDay,
        daysUntilItOpens: Math.max(0, opensOnDay - onDay),
        openDays: convergence.windowDays,
        spent
    };
}
