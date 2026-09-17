/**
 * A house takes people on at a selection, at an intake on its paper, or through
 * somebody of it out looking for disciples - and on no other day.
 *
 * The design owner: *"Houses hold selection ceremonies at their sect grounds too.
 * They aren't open 365 days a year. They send people out looking for seedlings,
 * and open up recruitment once every x years."*
 *
 * What is pinned is the calendar itself: a selection at a house's grounds comes
 * round once a cycle and runs for a stated number of days, the next one is never
 * a day already gone, an intake on a wall is held on the day its paper named and
 * not on the days around it, and the one who is out recruiting is read off the
 * errand the sending pass writes.
 *
 * Red-checked: with `theSelectionIn` returning a day every year, the once-a-cycle
 * test goes red; with `anIntakeHeldHere` reading only the paper's first day, the
 * waited-for-day test goes red.
 */

import { describe, expect, it } from 'vitest';

import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import {
    A_BILL_STAYS_UP_FOR_DAYS,
    anIntakeHeldHere,
    billsOnTheWall,
    type DoorInTheField
} from '../../../src/engine/world/houses-that-have-to-advertise-for-disciples.js';
import {
    A_HOUSE_OPENS_ITS_GROUNDS_EVERY_YEARS,
    A_SELECTION_RUNS_FOR_DAYS,
    isOutLookingForDisciples,
    theNextSelection,
    theSelectionIn,
    theSelectionOpenOn
} from '../../../src/engine/world/when-a-house-takes-people-on.js';

const SEED = 'a-house-takes-people-on';

describe('a selection at a house\'s grounds', () => {
    it('comes round once a cycle, and not every year', () => {
        for (const house of ['house-a', 'house-b', 'house-c', 'house-d']) {
            for (let cycle = 0; cycle < 10; cycle++) {
                const from = 400 + cycle * A_HOUSE_OPENS_ITS_GROUNDS_EVERY_YEARS;
                const held = Array.from({ length: A_HOUSE_OPENS_ITS_GROUNDS_EVERY_YEARS },
                    (_, i) => theSelectionIn(SEED, house, from + i)).filter(day => day !== null);
                expect(held, `${house} in the cycle from year ${from}`).toHaveLength(1);
            }
        }
    });

    it('is open for its run of days and not the day before or after', () => {
        const opens = theNextSelection(SEED, 'house-a', 400 * DAYS_PER_YEAR).opensOnDay;
        const closes = opens + A_SELECTION_RUNS_FOR_DAYS - 1;
        expect(theSelectionOpenOn(SEED, 'house-a', opens - 1)).toBeNull();
        expect(theSelectionOpenOn(SEED, 'house-a', opens)).toEqual({ opensOnDay: opens, closesOnDay: closes });
        expect(theSelectionOpenOn(SEED, 'house-a', closes)).not.toBeNull();
        expect(theSelectionOpenOn(SEED, 'house-a', closes + 1)).toBeNull();
    });

    it('names a next one that has not closed, and it is the one open on its day', () => {
        for (let day = 146_000; day < 146_000 + 3 * DAYS_PER_YEAR; day += 37) {
            const next = theNextSelection(SEED, 'house-b', day);
            expect(next.closesOnDay).toBeGreaterThanOrEqual(day);
            expect(next.opensOnDay - day).toBeLessThanOrEqual(2 * A_HOUSE_OPENS_ITS_GROUNDS_EVERY_YEARS * DAYS_PER_YEAR);
            expect(theSelectionOpenOn(SEED, 'house-b', Math.max(day, next.opensOnDay))).toEqual(next);
        }
    });
});

describe('an intake on a wall', () => {
    const field: DoorInTheField[] = Array.from({ length: 9 }, (_, i) => ({
        id: `house-${i}`, name: `House ${i}`, admissionOrdinal: i, powerOrdinal: 10 + i * 3,
        provinceId: i % 2 === 0 ? 'province-a' : 'province-b', postsInPublic: true
    }));
    const WALL = { field, placeName: 'Iron Ridge', ground: 'city' as const, placeProvinceId: 'province-a', seed: SEED };

    it('is held on the day the paper named, and not before', () => {
        const onDay = 5000;
        const bills = billsOnTheWall({ ...WALL, onDay });
        expect(bills.length, 'nothing is up on this wall').toBeGreaterThan(0);
        for (const bill of bills) {
            expect(anIntakeHeldHere(
                { ...WALL, onDay: bill.opensOnDay - 1 }, bill.houseId, A_SELECTION_RUNS_FOR_DAYS
            )).toBeNull();
            // WAITED FOR, which is what a player does with a date on a paper.
            const held = anIntakeHeldHere({ ...WALL, onDay: bill.opensOnDay }, bill.houseId, A_SELECTION_RUNS_FOR_DAYS);
            expect(held?.opensOnDay, `${bill.houseName}: waited ${bill.opensOnDay - onDay} days`).toBe(bill.opensOnDay);
            expect(anIntakeHeldHere(
                { ...WALL, onDay: bill.opensOnDay + A_SELECTION_RUNS_FOR_DAYS }, bill.houseId, A_SELECTION_RUNS_FOR_DAYS
            )).toBeNull();
        }
    });

    it('is never held for a house that has no paper on the wall', () => {
        for (let onDay = 5000; onDay < 5000 + 2 * A_BILL_STAYS_UP_FOR_DAYS; onDay++) {
            expect(anIntakeHeldHere({ ...WALL, onDay }, 'house-1', A_SELECTION_RUNS_FOR_DAYS)).toBeNull();
        }
    });
});

describe('somebody out looking for disciples', () => {
    it('is read off the errand the sending pass writes, and no other', () => {
        const out = (note: string) => ({ kind: 'out_with_a_party' as const, note });
        expect(isOutLookingForDisciples(out('Out for the Stone Gate on looking for disciples.'))).toBe(true);
        expect(isOutLookingForDisciples(out('Out for the Stone Gate on after materials.'))).toBe(false);
        expect(isOutLookingForDisciples({ kind: 'stationed', note: 'looking for disciples' })).toBe(false);
        expect(isOutLookingForDisciples(null)).toBe(false);
    });
});
