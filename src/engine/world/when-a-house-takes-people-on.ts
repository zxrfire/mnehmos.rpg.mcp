/**
 * When and where a house takes people on, and who is doing the taking.
 *
 * The design owner, on somebody joining a house with nobody of it there: *"How
 * is that possible? Houses hold selection ceremonies at their sect grounds too.
 * They aren't open 365 days a year. They send people out looking for seedlings,
 * and open up recruitment once every x years."*
 *
 * So there are two roads onto a roll, and nothing else is one:
 *
 *   a recruiter in person   somebody of the house out looking for disciples,
 *                           standing where you are. `isOutLookingForDisciples`
 *                           reads it off the activity the sending pass writes,
 *                           by the sending's own catalog name.
 *   a selection             the house opens its grounds for a few days once
 *                           every few years ({@link theSelectionOpenOn}), or
 *                           holds the intake its paper on a town wall names
 *                           (`anIntakeHeldHere` beside `billsOnTheWall`, which
 *                           dates the same paper).
 *
 * Whoever runs the selection, or does the recruiting, took you on, and owes the
 * house the report `a-house-expects-somebody-it-took-on.ts` is about.
 *
 * ── THE CALENDAR IS A FUNCTION, NOT A STORE ──────────────────────────────
 *
 * The year a house opens its grounds is its phase in a cycle drawn once from
 * the seed and the house, and the day is drawn from the seed, the house and the
 * year - the same way an open competition's day is (`theDayItFallsIn`). Reading
 * it twice gives the same answer, and a cycle rather than a chance per year
 * means a house never goes a decade without one by bad luck.
 *
 * {@link A_HOUSE_OPENS_ITS_GROUNDS_EVERY_YEARS} and
 * {@link A_SELECTION_RUNS_FOR_DAYS} are dials chosen here, not measured: the
 * owner said "once every x years" and left x open.
 */

import { forStream } from '../cultivation/rng.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { SENDING_REASONS } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import type { NpcActivity } from './npc-state.js';

/** How often a house opens its own grounds to people who want to be taken on, in years. */
export const A_HOUSE_OPENS_ITS_GROUNDS_EVERY_YEARS = 3;

/** How many days a selection runs, from the day it opens. An intake on a wall runs as long. */
export const A_SELECTION_RUNS_FOR_DAYS = 10;

/** The day this house's grounds open in the given year, or null for a year it does not open them. */
export function theSelectionIn(seed: string, houseId: string, year: number): number | null {
    const phase = forStream(seed, 'selection-at-the-grounds', houseId)
        .int(0, A_HOUSE_OPENS_ITS_GROUNDS_EVERY_YEARS - 1);
    if (((year % A_HOUSE_OPENS_ITS_GROUNDS_EVERY_YEARS) + A_HOUSE_OPENS_ITS_GROUNDS_EVERY_YEARS)
        % A_HOUSE_OPENS_ITS_GROUNDS_EVERY_YEARS !== phase) return null;
    return year * DAYS_PER_YEAR + forStream(seed, 'selection-at-the-grounds', houseId, year)
        .int(0, DAYS_PER_YEAR - 1);
}

export interface ASelection {
    opensOnDay: number;
    /** The last day it runs. */
    closesOnDay: number;
}

function selectionOpeningIn(seed: string, houseId: string, year: number): ASelection | null {
    const opens = theSelectionIn(seed, houseId, year);
    return opens === null ? null : { opensOnDay: opens, closesOnDay: opens + A_SELECTION_RUNS_FOR_DAYS - 1 };
}

/** The selection this house's grounds are open for on this day, or null. */
export function theSelectionOpenOn(seed: string, houseId: string, onDay: number): ASelection | null {
    const day = Math.floor(onDay);
    const year = Math.floor(day / DAYS_PER_YEAR);
    for (const y of [year, year - 1]) {
        const held = selectionOpeningIn(seed, houseId, y);
        if (held && held.opensOnDay <= day && day <= held.closesOnDay) return held;
    }
    return null;
}

/** The next selection at this house's grounds that has not closed by this day. */
export function theNextSelection(seed: string, houseId: string, onDay: number): ASelection {
    const day = Math.floor(onDay);
    const year = Math.floor(day / DAYS_PER_YEAR);
    for (let y = year - 1; ; y++) {
        const held = selectionOpeningIn(seed, houseId, y);
        if (held && held.closesOnDay >= day) return held;
    }
}

const RECRUITING = SENDING_REASONS.find(reason => reason.id === 'sending-to-recruit');

/**
 * Whether this is somebody out looking for disciples. Read off the note the
 * sending pass and the board write, which carry the sending's catalog name.
 */
export function isOutLookingForDisciples(activity: Pick<NpcActivity, 'kind' | 'note'> | null | undefined): boolean {
    if (!activity || activity.kind !== 'out_with_a_party' || RECRUITING === undefined) return false;
    return activity.note.toLowerCase().includes(RECRUITING.name.toLowerCase());
}
