/** Competition notices use fixed catalog cadences; reading a date never moves it. */
import { forStream } from '../cultivation/rng.js';
import { COMPETITION_CALENDARS } from '../../data/cultivation/competition-calendars.js';
import { getRegionForFaction } from '../../data/cultivation/regions.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';

export const AN_OPEN_COMPETITION_EVERY_YEARS = 7;

/**
 * How long before it falls the paper goes up.
 *
 * The same horizon `A_BILL_STAYS_UP_FOR_DAYS` gives an intake, so the two dated
 * papers on a wall are dated on one horizon: a player who can plan for an
 * admission day can plan for this, and neither is a date so far out that the
 * sentence "I wait for it" means giving up a season to a rumour.
 */
export const A_NOTICE_GOES_UP_DAYS = 90;

/** A house with a gate it could open. The whole of what deciding needs. */
export interface AHouseWithAGateItCouldOpen {
    id: string;
    name: string;
    everyYears?: number;
}

/** One open competition, as the paper about it needs it. */
export interface ACompetitionAnybodyMayEnter {
    hostId: string;
    hostName: string;
    /** Absolute day it falls, on whatever clock the caller keeps. */
    onDay: number;
}

/**
 * The day this house's open competition falls in the given year, or null where
 * it holds none that year.
 *
 * Null is the ordinary answer. A house that held one every year would be
 * running a season rather than an occasion.
 */
export function theDayItFallsIn(
    seed: string,
    house: AHouseWithAGateItCouldOpen,
    year: number
): number | null {
    const every = house.everyYears ?? COMPETITION_CALENDARS.find(row => row.houseId === house.id)?.everyYears
        ?? AN_OPEN_COMPETITION_EVERY_YEARS;
    const rng = forStream(seed, 'competition-calendar', house.id);
    const phase = rng.int(0, every - 1);
    const offset = rng.int(0, DAYS_PER_YEAR - 1);
    return ((year % every) + every) % every === phase ? year * DAYS_PER_YEAR + offset : null;
}

/**
 * What this house has on paper today, or null where it has nothing.
 *
 * NEVER A DAY THAT HAS PASSED, which is the rule `billsOnTheWall` keeps in so
 * many words - a bill is never advertising something that has already happened.
 * This year is checked first and next year after it, so a competition falling in
 * the first weeks of a year is on the wall before the year turns.
 */
export function whatThisHouseHasOnPaper(
    seed: string,
    house: AHouseWithAGateItCouldOpen,
    onDay: number
): ACompetitionAnybodyMayEnter | null {
    const region = getRegionForFaction(house.id);
    const city = COMPETITION_CALENDARS.find(row => row.open && region?.places.some(p => p.name === row.venueName));
    const calendar = city ? { id: city.id, name: city.venueName!, everyYears: city.everyYears } : house;
    const thisYear = Math.floor(Math.max(0, onDay) / DAYS_PER_YEAR);
    for (const year of [thisYear, thisYear + 1]) {
        const day = theDayItFallsIn(seed, calendar, year);
        if (day === null) continue;
        if (day < onDay) continue;
        if (day - onDay > A_NOTICE_GOES_UP_DAYS) continue;
        return { hostId: house.id, hostName: calendar.name, onDay: day };
    }
    return null;
}
