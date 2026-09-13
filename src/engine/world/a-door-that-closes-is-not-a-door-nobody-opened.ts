/**
 * Which kind of shut a piece of ground is shut, and when the door next opens.
 *
 * `sealed` on a ruin has carried two states and the record has never said
 * which:
 *
 *   a door nobody has opened    `ruin_opened` unseals it once, tags it
 *                               `emptied`, and it never shuts again. Nothing
 *                               is scheduled; somebody has to go and open it.
 *   a door that closes          an `OpeningCycle` shuts and unshuts it on its
 *                               own schedule. The sealed realm.
 *
 * Both mean nobody gets in today, which is all any consumer needed, so the
 * distinction only bites when something wants to WAIT for a door - and waiting
 * is the whole of what makes a cycle playable. The discriminator is the cycle
 * itself: measured over twelve seeded worlds, 72 of 144 ruins carry one, and
 * every one of the 72 is sealed, which is why the schedule has to be read past
 * the flag. See `whenTheScheduleNextOpens`.
 *
 * A READING, not a state field. Nothing here is stored, so nothing can drift
 * from `cycle`, `sealed` and the `emptied` tag, which remain the only record.
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
import type { LocationRecord } from './locations.js';

/** The tag `ruin_opened` leaves on ground somebody has already been through. */
export const SPENT = 'emptied';

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
