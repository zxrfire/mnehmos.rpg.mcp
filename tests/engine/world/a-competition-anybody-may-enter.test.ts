/**
 * The calendar an open competition is announced off.
 *
 * ── THE DEFECT THIS IS THE FIRST HALF OF ─────────────────────────────────
 *
 * `gatherings.ts` has held competitions on the yearly line since it was
 * written, and `what-people-are-saying.ts:690` is the only channel any of it
 * ever reached: *"held something and the placings went round afterwards, N
 * years ago"*. Past tense, no date, no host you could go to. So a competition
 * could be heard about only once it was over, which means no player could ever
 * attend one, which means - by the standard this project holds - it was not
 * built. Measured while writing this: zero references to `Gathering`,
 * `applyGatherings` or any conclave anywhere in `src/web/` or `src/server/`.
 *
 * ── WHAT IS PINNED HERE, AND WHY IT IS THE DATE RATHER THAN THE PROSE ────
 *
 * One rule carries the whole feature and it is not about wording:
 *
 *     A DATE THE WORLD STATES DOES NOT MOVE BECAUSE SOMEBODY LOOKED AT IT.
 *
 * It is the rule `RecruitingBill.opensOnDay` records having learned expensively
 * - a wall read twice a month apart must name one day a month closer, not two
 * different days - and a player who cannot trust a date cannot plan a journey
 * around one, which is the whole of what this slice is for. Everything below is
 * that rule and its two corollaries: a paper never advertises a day that has
 * already passed, and it goes up on a stated horizon rather than whenever.
 *
 * RED-CHECKED. Each assertion was confirmed to fail against the mechanism
 * broken in the obvious way - the date redrawn per read, the past-day guard
 * removed, and the next-year branch removed - and the fourth case below exists
 * because removing that branch is silent: it fails only across a year boundary.
 */

import { describe, it, expect } from 'vitest';

import {
    AN_OPEN_COMPETITION_EVERY_YEARS,
    A_NOTICE_GOES_UP_DAYS,
    theDayItFallsIn,
    whatThisHouseHasOnPaper
} from '../../../src/engine/world/a-competition-anybody-may-enter.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';

const SEED = 'open-competition-suite';

/** Enough houses that the calendar is exercised rather than sampled once. */
const HOUSES = Array.from({ length: 40 }, (_, i) => ({
    id: `house-${i}`,
    name: `House ${i}`
}));

describe('the day an open competition falls', () => {
    it('is the same day however often it is read', () => {
        // The property stated directly: hold the house and the world fixed,
        // move only the day the wall is read, and every reading that names a
        // day names the SAME day until that day has gone by.
        let checked = 0;
        for (const house of HOUSES) {
            let named: number | null = null;
            for (let day = 0; day < DAYS_PER_YEAR * 4; day++) {
                const paper = whatThisHouseHasOnPaper(SEED, house, day);
                if (paper === null) { named = null; continue; }
                if (named !== null && paper.onDay >= named) {
                    expect(paper.onDay, `${house.id} moved its own date under a reader`)
                        .toBe(named);
                    checked++;
                }
                named = paper.onDay;
            }
        }
        expect(checked, 'no house was on paper twice, so nothing was actually compared')
            .toBeGreaterThan(100);
    });

    it('never advertises a day that has already passed', () => {
        for (const house of HOUSES) {
            for (let day = 0; day < DAYS_PER_YEAR * 4; day++) {
                const paper = whatThisHouseHasOnPaper(SEED, house, day);
                if (paper === null) continue;
                expect(paper.onDay).toBeGreaterThanOrEqual(day);
            }
        }
    });

    it('goes up on the stated horizon and not before', () => {
        for (const house of HOUSES) {
            for (let day = 0; day < DAYS_PER_YEAR * 4; day++) {
                const paper = whatThisHouseHasOnPaper(SEED, house, day);
                if (paper === null) continue;
                expect(paper.onDay - day).toBeLessThanOrEqual(A_NOTICE_GOES_UP_DAYS);
            }
        }
    });

    /**
     * The case that is silent when it breaks. A competition falling in the
     * first weeks of a year has to be on the wall in the last weeks of the one
     * before, or a house's paper goes blank every new year for no reason a
     * player could see. Checking only inside a year never notices.
     */
    it('is on the wall before the year it falls in turns', () => {
        const found: string[] = [];
        for (const house of HOUSES) {
            for (let year = 1; year < 12; year++) {
                const falls = theDayItFallsIn(SEED, house, year);
                if (falls === null) continue;

                // The first day the horizon says the paper is up. The case
                // being tested is the one where that day is in the year before.
                const goesUp = falls - A_NOTICE_GOES_UP_DAYS;
                if (goesUp < 0 || goesUp >= year * DAYS_PER_YEAR) continue;

                // Never blank. It may legitimately name a NEARER day instead -
                // a house that also holds one late in the year it is standing
                // in - and that is the paper working, not the boundary failing.
                const paper = whatThisHouseHasOnPaper(SEED, house, goesUp);
                expect(paper, `${house.id} went blank across the turn of year ${year}`)
                    .not.toBeNull();
                expect(paper!.onDay).toBeGreaterThanOrEqual(goesUp);

                // And somewhere in the previous year, this competition is the
                // one being named - which is the crossing itself.
                for (let day = goesUp; day < year * DAYS_PER_YEAR; day++) {
                    if (whatThisHouseHasOnPaper(SEED, house, day)?.onDay === falls) {
                        found.push(house.id);
                        break;
                    }
                }
            }
        }
        expect(found.length, 'no competition fell early enough in a year to test the boundary')
            .toBeGreaterThan(0);
    });
});

describe('how often a house opens its gate', () => {
    /**
     * The rate is a dial and a dial with no measurement beside it is a number
     * the next person will assume is arbitrary and edit. Stated as a band
     * rather than a figure, because what is being held down is that the
     * calendar is a calendar - a house holds one every few years, not every
     * year and not once a century.
     */
    it('is about once every AN_OPEN_COMPETITION_EVERY_YEARS years per house', () => {
        const YEARS = 600;
        let held = 0;
        for (const house of HOUSES) {
            for (let year = 0; year < YEARS; year++) {
                if (theDayItFallsIn(SEED, house, year) !== null) held++;
            }
        }
        const everyYears = (HOUSES.length * YEARS) / held;
        expect(everyYears).toBeGreaterThan(AN_OPEN_COMPETITION_EVERY_YEARS - 0.5);
        expect(everyYears).toBeLessThan(AN_OPEN_COMPETITION_EVERY_YEARS + 0.5);
    });

    it('does not hold one every year, which would be a season rather than an occasion', () => {
        const house = HOUSES[0]!;
        const years = Array.from({ length: 40 }, (_, y) => theDayItFallsIn(SEED, house, y));
        expect(years.some(d => d === null)).toBe(true);
        expect(years.some(d => d !== null)).toBe(true);
    });
});
