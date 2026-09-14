/**
 * A house that knows when a door opens walks to arrive, and one that does not
 * hears about it and starts late.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * `beingAtADoorOnTheDayItOpens` has priced those two roads apart since it was
 * written, and the gap between them is the largest number in the convergence
 * design: measured over twelve pinned worlds and 60 scheduled sites, 75.0% of
 * house seats can walk in and back out knowing the date against 43.9% hearing
 * it. `whoSendsWhenADoorOpens` asked the SECOND for every house in the world,
 * because nothing anywhere held a house's reading of a cycle - and the header of
 * that file said so, calling it the player's edge.
 *
 * ── THE RULING THESE ASSERTIONS ENCODE ───────────────────────────────────
 *
 * A HOUSE HOLDS NO SUCH READING. ITS PEOPLE DO. So the answer is derived from
 * the roll, and both halves have to hold: somebody who can read a schedule at
 * all, AND somebody with something of THAT ground. A house whose best scholar
 * has never heard of the pass is not early for it, and neither is a house that
 * has worked the ground for centuries with nobody who can read a calendar.
 *
 * NOTHING IS STORED. The two readings asked are `readSchedule` and the world's
 * own people reading of a place, both of which already existed and neither of
 * which writes a row.
 *
 * AND A CALLER THAT SUPPLIES NEITHER GETS WHAT IT ALWAYS GOT, which is what
 * keeps every other caller of the race honest rather than silently improved.
 *
 * RED-CHECKED: dropping the ground half (answering the predicate `true` for
 * everybody) fails `wants somebody who has something of the ground`; dropping
 * the rung half fails `wants somebody who can read a schedule`; passing the
 * house's party straight through to the priced reading instead of the reader's
 * fails `reaches a door the same house cannot reach hearing about it late`.
 */

import { describe, it, expect } from 'vitest';

import {
    makeLocation,
    makeThresholds,
    type LocationRecord
} from '../../../src/engine/world/locations.js';
import { SCHEDULE_READ_ORDINAL } from '../../../src/engine/world/convergence.js';
import {
    whoInTheHouseKnowsWhenItOpens
} from '../../../src/engine/world/a-house-knows-a-date-because-somebody-in-it-does.js';
import {
    whoSendsWhenADoorOpens,
    type AHouseThatCouldGo
} from '../../../src/engine/world/a-door-that-opens-is-a-race.js';
import { wingsOf } from '../../../src/engine/world/provenance.js';

const YEAR = 365;

/** Open on day 0 for as long as it is given, then shut for sixty years. */
function doorOpenFor(openDays: number): LocationRecord {
    return makeLocation({
        id: 'loc-ruin-that-opens',
        name: 'Cold Spring',
        kind: 'ruin',
        qiDensity: 80,
        thresholds: makeThresholds(4, 8, 14, 20),
        sealed: true,
        cycle: { periodDays: 60 * YEAR, openDays, phaseDay: 0 },
        data: {
            scheduleKey: 'cycles:loc-ruin-that-opens',
            scheduleReadOrdinal: SCHEDULE_READ_ORDINAL
        }
    });
}

/** Two on the roll: one who could never read a calendar, one who can. */
const A_SCHOLAR = { id: 'scholar', name: 'The scholar', ordinal: SCHEDULE_READ_ORDINAL + 2 };
const A_HAND = { id: 'hand', name: 'The hand', ordinal: 1 };

const EVERYBODY_HAS_THE_GROUND = (): boolean => true;
const NOBODY_HAS_THE_GROUND = (): boolean => false;

function askedOf(
    roster: readonly { id: string; name: string; ordinal: number }[],
    hasAnythingOfTheGround: (personId: string) => boolean,
    openDays = 30
) {
    return whoInTheHouseKnowsWhenItOpens({
        door: doorOpenFor(openDays),
        onDay: 0,
        houseId: 'house',
        roster,
        hasAnythingOfTheGround
    });
}

describe('a house knows a date because somebody in it does', () => {
    it('wants somebody who can read a schedule', () => {
        const onlyHands = askedOf([A_HAND], EVERYBODY_HAS_THE_GROUND);
        expect(onlyHands.known).toBe(false);
        expect(onlyHands.readerId).toBeNull();
        // And the same roll with a scholar on it does know.
        expect(askedOf([A_HAND, A_SCHOLAR], EVERYBODY_HAS_THE_GROUND).known).toBe(true);
    });

    it('wants somebody who has something of the ground', () => {
        // The rung is met and the ground is not. Being able to work out when a
        // place is next due is not the same as having heard of the place.
        expect(askedOf([A_SCHOLAR], NOBODY_HAS_THE_GROUND).known).toBe(false);
    });

    it('names the person whose reading it is, and it is somebody on the roll', () => {
        const held = askedOf([A_HAND, A_SCHOLAR], id => id === A_SCHOLAR.id);
        expect(held.known).toBe(true);
        // Read out of the answer rather than asserted against a fixture name:
        // any id the reading returns has to be one that was handed to it.
        expect([A_HAND.id, A_SCHOLAR.id]).toContain(held.readerId);
        expect(held.party.realmOrdinal).toBeGreaterThanOrEqual(SCHEDULE_READ_ORDINAL);
    });

    it('does not depend on the order the roll is handed over in', () => {
        const one = askedOf([A_HAND, A_SCHOLAR], EVERYBODY_HAS_THE_GROUND);
        const other = askedOf([A_SCHOLAR, A_HAND], EVERYBODY_HAS_THE_GROUND);
        expect(one.readerId).toBe(other.readerId);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE RACE WALKS ON IT
// ─────────────────────────────────────────────────────────────────────────

/** A house seated `days` of road away, with a scholar and a hand on the roll. */
function houseAt(id: string, days: number): AHouseThatCouldGo & { days: number } {
    return {
        id,
        name: `The ${id} Sect`,
        seatLocationId: `seat-${id}`,
        roster: [
            { id: `${id}-scholar`, name: `${id} scholar`, ordinal: SCHEDULE_READ_ORDINAL + 2 },
            { id: `${id}-hand`, name: `${id} hand`, ordinal: 1 }
        ],
        days
    };
}

describe('a door that opens is a race the informed house starts early', () => {
    /**
     * A window and a road that come apart.
     *
     * The door is found rather than pinned: what matters is that there IS a
     * window at which the road eats the difference, not which one it is - that
     * is arithmetic in `beingAtADoorOnTheDayItOpens` and pinning it here would
     * pin the implementation. The search is over the honest range and the test
     * says plainly when the two arms never come apart.
     */
    function aWindowWhereTheRoadDecides(): {
        openDays: number;
        house: AHouseThatCouldGo & { days: number };
    } | null {
        for (const days of [8, 12, 16, 20, 24]) {
            const house = houseAt('far', days);
            const walking = new Map([[house.seatLocationId!, house.days]]);
            for (let openDays = 4; openDays <= 120; openDays += 2) {
                const door = doorOpenFor(openDays);
                if (wingsOf(door).length === 0) continue;
                const late = whoSendsWhenADoorOpens({
                    door, onDay: 0, houses: [house],
                    walkingDaysTo: id => walking.get(id)
                });
                const early = whoSendsWhenADoorOpens({
                    door, onDay: 0, houses: [house],
                    walkingDaysTo: id => walking.get(id),
                    hasAnythingOfTheGround: EVERYBODY_HAS_THE_GROUND
                });
                if (late.length === 0 && early.length === 1) return { openDays, house };
            }
        }
        return null;
    }

    it('reaches a door the same house cannot reach hearing about it late', () => {
        const found = aWindowWhereTheRoadDecides();
        expect(found, 'the road has to be able to decide a window somewhere').not.toBeNull();

        const { openDays, house } = found!;
        const walking = new Map([[house.seatLocationId!, house.days]]);
        const early = whoSendsWhenADoorOpens({
            door: doorOpenFor(openDays), onDay: 0, houses: [house],
            walkingDaysTo: id => walking.get(id),
            hasAnythingOfTheGround: EVERYBODY_HAS_THE_GROUND
        });
        expect(early[0].knewTheDate).toBe(true);
        expect(early[0].readerId).not.toBeNull();
    });

    it('leaves a house whose people have nothing of the ground where it was', () => {
        const found = aWindowWhereTheRoadDecides();
        const { openDays, house } = found!;
        const walking = new Map([[house.seatLocationId!, house.days]]);

        // The reading is supplied and answers no for everybody, which is the
        // ordinary case for ground nobody in this house has ever been near.
        const strangers = whoSendsWhenADoorOpens({
            door: doorOpenFor(openDays), onDay: 0, houses: [house],
            walkingDaysTo: id => walking.get(id),
            hasAnythingOfTheGround: NOBODY_HAS_THE_GROUND
        });
        expect(strangers).toEqual([]);
    });

    it('behaves exactly as it did where no reading is supplied at all', () => {
        // Every existing caller of the race passes nothing, and none of them
        // should have quietly got the better arm.
        const house = houseAt('near', 2);
        const walking = new Map([[house.seatLocationId!, house.days]]);
        for (const openDays of [7, 30, 90, 180]) {
            const door = doorOpenFor(openDays);
            const bare = whoSendsWhenADoorOpens({
                door, onDay: 0, houses: [house], walkingDaysTo: id => walking.get(id)
            });
            const told = whoSendsWhenADoorOpens({
                door, onDay: 0, houses: [house],
                walkingDaysTo: id => walking.get(id),
                hasAnythingOfTheGround: NOBODY_HAS_THE_GROUND
            });
            expect(bare.map(h => h.houseId)).toEqual(told.map(h => h.houseId));
            for (const going of bare) expect(going.knewTheDate).toBe(false);
        }
    });
});
