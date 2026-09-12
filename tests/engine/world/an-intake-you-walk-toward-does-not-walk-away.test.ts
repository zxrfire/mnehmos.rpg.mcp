/**
 * The day a recruiting bill names stands still while the paper is up.
 *
 * MEASURED, by `scripts/probe-is-there-enough-to-do-and-can-it-be-reached.ts`
 * across 37 places, three rung bands and two pinned worlds: **0 of 30
 * advertised intakes were reachable at any band, in any world, at any place**,
 * and the gate was the same sentence every time - *"does not open for N days"*.
 *
 * The reason was not a bar nobody clears. It was the date.
 *
 * `opensOnDay` was drawn as `floor(onDay) + rng.int(1, remaining)` - anchored to
 * the day of whoever was READING the wall rather than to the wall - so it was
 * recomputed, further off, every time anybody looked. Read against the shipped
 * catalog at Green Water City, seed `run-seed`:
 *
 *     day  0   Clear River Alliance   opens d28   (in 28 days)
 *     day  5   Clear River Alliance   opens d31   (in 26)
 *     day 20   Clear River Alliance   opens d42   (in 22)
 *     day 60   Clear River Alliance   opens d70   (in 10)
 *     day 89   Clear River Alliance   opens d90   (in  1)
 *
 * Twenty-eight days of walking bought eighteen days of countdown, and the
 * intake was still ahead on the last day of the window - after which the wall
 * redrew and it was a different house and a different date. **The intake never
 * arrived.**
 *
 * That is not cosmetic, because the date is wired to a verb. `datedThingsHere`
 * publishes every bill as something to WAIT for - *"the intake"* reaches them
 * all by name - and `whatThereIsToWaitFor` settles the phrase onto one. So the
 * engine offered a player a thing to wait for, and then moved it every day they
 * waited.
 *
 * ── WHAT CHANGED ─────────────────────────────────────────────────────────
 *
 * The draw is anchored to the WINDOW. The paper is the same paper all season,
 * so the day on it is the same day all season, and the number of days left
 * falls by one per day the way a number of days left does.
 *
 * The invariant the old anchor existed to keep is unchanged and still tested
 * next door: a bill never advertises a day that has gone past. When the drawn
 * day has passed, the paper names the next season's intake rather than a date
 * behind the reader - a jump of one whole posting window, at the moment the
 * intake happens, which is the intake happening rather than the date drifting.
 *
 * ── AND WHAT IS STILL MISSING, WHICH THIS DOES NOT CLOSE ─────────────────
 *
 * Nothing happens ON the day. A player who waits the days the paper names
 * arrives to find the bill naming next season, because no code anywhere reads a
 * bill's day and holds an intake. That is a gap somebody has written down and
 * not yet closed, not an argued decision: the countdown is now true, and what
 * it counts down to is not built.
 */

import { describe, it, expect } from 'vitest';
import {
    billsOnTheWall,
    A_BILL_STAYS_UP_FOR_DAYS,
    type DoorInTheField
} from '../../../src/engine/world/houses-that-have-to-advertise-for-disciples.js';

/** The same nine-door field the sibling file uses, for the same reason. */
function field(): DoorInTheField[] {
    const rows: DoorInTheField[] = [];
    for (let i = 0; i < 9; i++) {
        rows.push({
            id: `house-${i}`,
            name: `House ${i}`,
            admissionOrdinal: i,
            powerOrdinal: 10 + i * 3,
            provinceId: i % 2 === 0 ? 'province-a' : 'province-b',
            postsInPublic: true
        });
    }
    return rows;
}

const WALL = {
    placeName: 'Iron Ridge',
    ground: 'city' as const,
    placeProvinceId: 'province-a',
    seed: 'wall-seed'
};

const wallOn = (onDay: number) => billsOnTheWall({ ...WALL, field: field(), onDay });

/** Every day of one whole posting window, which is the life of one paper. */
const WINDOW_STARTS_ON = 360;
const DAYS_OF_THE_WINDOW = Array.from(
    { length: A_BILL_STAYS_UP_FOR_DAYS }, (_, i) => WINDOW_STARTS_ON + i
);

describe('a dated intake holds its date while the paper is up', () => {
    it('names the same day however many times it is read', () => {
        // The whole defect in one assertion. For each house, every day of the
        // window on which its paper still names a future intake must name the
        // SAME future intake.
        const saidBy = new Map<string, Set<number>>();
        for (const day of DAYS_OF_THE_WINDOW) {
            for (const bill of wallOn(day)) {
                if (bill.opensOnDay >= WINDOW_STARTS_ON + A_BILL_STAYS_UP_FOR_DAYS) continue;
                saidBy.set(bill.houseId, (saidBy.get(bill.houseId) ?? new Set()).add(bill.opensOnDay));
            }
        }
        expect(saidBy.size).toBeGreaterThan(0);
        for (const [houseId, days] of saidBy) {
            expect([...days], `${houseId} named ${days.size} different intake days`)
                .toHaveLength(1);
        }
    });

    it('and the days left fall by one for every day that is waited', () => {
        // What a countdown is. Measured on the old anchor, 28 days of waiting
        // took 18 days off the number, and the rest of the time it went up.
        const start = WINDOW_STARTS_ON + 1;
        const first = wallOn(start)[0];
        expect(first).toBeDefined();
        const namedDay = first!.opensOnDay;
        // Only while the paper is still advertising THAT intake.
        for (let day = start; day < namedDay; day += 1) {
            const again = wallOn(day).find(b => b.houseId === first!.houseId);
            expect(again, `${first!.houseId} left the wall on day ${day}`).toBeDefined();
            expect(again!.opensOnDay - day, `days left on day ${day}`).toBe(namedDay - day);
        }
    });

    it('and what the paper SAYS is the same number the field carries', () => {
        // The sentence is the player-facing half, and a sentence that disagrees
        // with the field it was built from is a worse bug than either.
        for (const day of [WINDOW_STARTS_ON, WINDOW_STARTS_ON + 45, WINDOW_STARTS_ON + 88]) {
            for (const bill of wallOn(day)) {
                expect(bill.saying).toContain(`in ${bill.opensOnDay - day} days`);
            }
        }
    });

    it('and still never advertises a day that has gone past', () => {
        // The invariant the sliding anchor was there to keep. It is kept by
        // rolling a spent date on to the next season instead.
        for (let day = 0; day < A_BILL_STAYS_UP_FOR_DAYS * 4; day += 3) {
            for (const bill of wallOn(day)) {
                expect(bill.opensOnDay, `day ${day}`).toBeGreaterThan(day);
            }
        }
    });

    it('and a wall that is read twice on one day reads the same twice', () => {
        // Already held next door; repeated because the fix touches the draw and
        // an instrument that reshuffles under a re-read would break every
        // replay in the repo.
        expect(wallOn(WINDOW_STARTS_ON + 30)).toEqual(wallOn(WINDOW_STARTS_ON + 30));
    });
});
