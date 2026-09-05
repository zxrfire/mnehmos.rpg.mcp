/**
 * The ruling under test is that the Span sends OTHER PEOPLE through, and that
 * the passenger's rung is not what carries them. Every case below is named for
 * the decision it pins, because most of them are numbers.
 *
 * The worked example throughout is the Four Graves Terminal, which is in
 * `regions.ts` already: one of the nine stations, an hour from a station
 * seventeen days' walk away, open four days in nine. Nothing here invented a
 * route shape - it was read off a branch entry that has been in the catalog the
 * whole time.
 */

import { describe, it, expect } from 'vitest';

import {
    PASSENGER_SETTLING_AT_THE_BOTTOM,
    boardAt,
    quotePassageAtACounter,
    settlingDaysForPassenger,
    whatTheBoardDoesNotSay,
    type SpanRoute
} from '../../../src/engine/world/buying-passage-at-a-measured-span-counter.js';
import {
    FOLD_FLOOR_ORDINAL,
    FOLD_GRANT,
    priceFold
} from '../../../src/engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';

/** The Four Graves span: seventeen walked days, four days open in nine. */
const FOUR_GRAVES: SpanRoute = {
    id: 'span-fourhands',
    fromPlace: 'Four Graves',
    toPlace: 'the far station',
    walkedDaysItReplaces: 17,
    schedule: { periodDays: 9, openDays: 4, phaseDay: 0 },
    inheritedTerminal: true
};

const RATE = 40;

const quote = (ordinal: number, onDay = 0, heads = 1) =>
    quotePassageAtACounter(FOUR_GRAVES, {
        heads, worstPassengerOrdinal: ordinal, cashPerWalkedDayReplaced: RATE, onDay
    });

describe('the passenger\'s rung does not carry them, which is the whole ruling', () => {
    it('sends somebody who could never fold a step on their own', () => {
        // A courier at ordinal 10 is below the folding floor by nineteen rungs
        // and cannot fold at all. They still cross seventeen days.
        expect(priceFold({
            ordinal: 10, heldGrants: [FOLD_GRANT], walkingDays: 17, fix: 'stood'
        }).canFoldAtAll).toBe(false);

        const sent = quote(10, 0);
        expect(sent.openToday).toBe(true);
        expect(sent.daysSavedAgainstWalking).toBeGreaterThan(0);
    });

    it('refuses nobody for being low, because that is not what a refusal is for', () => {
        // Agency: the engine says what a thing costs, never who may attempt it.
        // Every rung on the ladder gets a quote and a saving.
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const q = quote(ordinal, 0);
            expect(q.fareCash).toBeGreaterThan(0);
            expect(q.daysSavedAgainstWalking).toBeGreaterThan(0);
        }
    });

    it('charges the same fare whoever is standing there', () => {
        // The fare is a fact about the distance, not about the buyer. A house
        // that priced on who you are would be a house with a second ladder in
        // its price list.
        expect(quote(0).fareCash).toBe(quote(44).fareCash);
        expect(quote(0).fareCash).toBe(17 * RATE);
    });

    it('scales the fare on heads and never on rung', () => {
        expect(quote(0, 0, 4).fareCash).toBe(4 * 17 * RATE);
    });
});

describe('what the rung DOES change is what the crossing costs the body', () => {
    it('costs most at the bottom and nothing at the folding floor', () => {
        expect(settlingDaysForPassenger(0)).toBe(PASSENGER_SETTLING_AT_THE_BOTTOM);
        expect(settlingDaysForPassenger(FOLD_FLOOR_ORDINAL)).toBe(0);
        expect(settlingDaysForPassenger(MAX_ORDINAL)).toBe(0);
    });

    it('never rises as the passenger climbs', () => {
        for (let ordinal = 1; ordinal <= MAX_ORDINAL; ordinal++) {
            expect(settlingDaysForPassenger(ordinal))
                .toBeLessThanOrEqual(settlingDaysForPassenger(ordinal - 1));
        }
    });

    it('runs the exact inverse of a personal fold', () => {
        // Standing high buys you further when you fold yourself, and costs you
        // less when somebody folds you. Two curves, opposite directions, and
        // the crossing point is the same floor.
        const low = 4;
        const high = 40;
        expect(settlingDaysForPassenger(low))
            .toBeGreaterThan(settlingDaysForPassenger(high));
        expect(priceFold({ ordinal: low, heldGrants: [FOLD_GRANT], walkingDays: 6, fix: 'stood' }).rangeDays)
            .toBeLessThan(priceFold({ ordinal: high, heldGrants: [FOLD_GRANT], walkingDays: 6, fix: 'stood' }).rangeDays);
    });

    it('stays decisively worth buying for the people it is for', () => {
        // The feasibility check, and it is the reason the constant is three. If
        // settling ever ate the saving, the one door somebody below the floor
        // has to the rest of the world would close.
        const mortal = quote(0, 0);
        expect(mortal.settlingDays).toBe(PASSENGER_SETTLING_AT_THE_BOTTOM);
        expect(mortal.daysSavedAgainstWalking).toBe(14);
    });

    it('takes the worst passenger, because a party arrives together', () => {
        expect(quote(0).settlingDays).toBeGreaterThan(quote(FOLD_FLOOR_ORDINAL).settlingDays);
    });
});

describe('the schedule is the honest no, and it is not about the person', () => {
    it('runs four days in nine, read off the same cycle a ruin uses', () => {
        for (const day of [0, 1, 2, 3]) expect(quote(20, day).openToday).toBe(true);
        for (const day of [4, 5, 6, 7, 8]) expect(quote(20, day).openToday).toBe(false);
        expect(quote(20, 9).openToday).toBe(true);
    });

    it('names the next departure rather than simply saying no', () => {
        const shut = quote(20, 5);
        expect(shut.openToday).toBe(false);
        expect(shut.nextDepartureDay).toBe(9);
        // And waiting is counted, so the choice against walking stays honest.
        expect(shut.daysSpent).toBeGreaterThan(quote(20, 0).daysSpent);
    });

    it('still beats the road even after the longest wait', () => {
        const worst = quote(0, 4);
        expect(worst.daysSpent).toBeLessThan(FOUR_GRAVES.walkedDaysItReplaces);
    });

    it('spends no day on the crossing itself for somebody at the floor', () => {
        // The whole product is that no day was spent on the road. Rounding an
        // hour up to a day would price away the thing being bought.
        expect(quote(FOLD_FLOOR_ORDINAL, 0).daysSpent).toBe(0);
        expect(quote(FOLD_FLOOR_ORDINAL, 0).daysSavedAgainstWalking).toBe(17);
    });
});

describe('the board is the map, and the absence on it is the information', () => {
    const routes: SpanRoute[] = [
        FOUR_GRAVES,
        {
            id: 'span-near', fromPlace: 'Four Graves', toPlace: 'the near yard',
            walkedDaysItReplaces: 6, schedule: { periodDays: 9, openDays: 4, phaseDay: 0 },
            inheritedTerminal: false
        },
        {
            id: 'span-elsewhere', fromPlace: 'Somewhere else', toPlace: 'nowhere near',
            walkedDaysItReplaces: 11, schedule: { periodDays: 9, openDays: 4, phaseDay: 0 },
            inheritedTerminal: false
        }
    ];

    it('lists only what leaves from where you are standing', () => {
        const board = boardAt('Four Graves', routes, RATE, 0);
        expect(board.running).toBe(2);
        expect(board.lines.map(l => l.routeId)).not.toContain('span-elsewhere');
    });

    it('reads nearest first, and reads the same way twice', () => {
        const board = boardAt('Four Graves', routes, RATE, 0);
        expect(board.lines.map(l => l.walkedDaysItReplaces)).toEqual([6, 17]);
        expect(boardAt('Four Graves', routes, RATE, 0)).toEqual(board);
    });

    it('teaches a place, a distance and a price, which is a map', () => {
        // The discoverability claim, asserted rather than described: somebody
        // who has never left their province reads three facts per line.
        for (const line of boardAt('Four Graves', routes, RATE, 0).lines) {
            expect(line.toPlace.length).toBeGreaterThan(0);
            expect(line.walkedDaysItReplaces).toBeGreaterThan(0);
            expect(line.fareCash).toBeGreaterThan(0);
        }
    });

    it('says what is not on it, and never leaves the gap unexplained', () => {
        expect(boardAt('Four Graves', routes, RATE, 0).limits).toContain('survey');
        // A counter with nothing running is a real state and gets its own
        // sentence, because a blank board reads as a missing feature otherwise.
        const empty = boardAt('Nowhere', routes, RATE, 0);
        expect(empty.running).toBe(0);
        expect(empty.limits).toContain('stopped answering');
        expect(whatTheBoardDoesNotSay(0)).not.toBe(whatTheBoardDoesNotSay(1));
    });

    it('has no way to express a route the house has not surveyed', () => {
        // Deliberate: an unsurveyed route is not a row with a false on it, it
        // is a row that is not there. If a `surveyed` flag ever appears on
        // SpanRoute, this is the case that should have stopped it.
        const keys = Object.keys(FOUR_GRAVES);
        expect(keys).not.toContain('surveyed');
        expect(keys).not.toContain('available');
    });
});
