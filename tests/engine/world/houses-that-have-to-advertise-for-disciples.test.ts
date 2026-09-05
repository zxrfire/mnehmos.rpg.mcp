/**
 * A house that needs members advertises, and the derivation that decides which.
 *
 * The measurement this exists to protect: thirteen houses admit at rung 2 or
 * below and eight fresh lives could name exactly one of them. Half of that was
 * `commonlyNamedHouse` handing every life the same alphabetically-first name,
 * and another agent has fixed it. The other half is that a name granted at
 * birth is a FIXED LIST - it cannot produce a name later - and this is the
 * channel that keeps producing them as the player moves.
 *
 * What these tests hold down, in order of how expensive each would be to lose:
 *
 *   THE DERIVATION IS A DERIVATION. The moment somebody replaces the medians
 *   with an id list, the wall stops tracking the catalog and starts tracking
 *   whoever last edited it. Asserted by moving a house's numbers and watching
 *   the answer move with them.
 *
 *   IT IS IDEMPOTENT AND SEEDED. Two reads of the same wall on the same day
 *   agree. A discovery channel that reshuffles under a re-read is a slot
 *   machine, and it would also break every replay in the repo.
 *
 *   IT DOES NOT PERTURB ANYTHING. The draw is its own named stream, so a run
 *   that never reads a wall must produce byte-identical results either way.
 */

import { describe, it, expect } from 'vitest';
import {
    housesThatHaveToAdvertise,
    billsOnTheWall,
    reachesThisGround,
    whatABillGrants,
    BILLS_A_WALL_CARRIES,
    A_BILL_STAYS_UP_FOR_DAYS,
    type DoorInTheField
} from '../../../src/engine/world/houses-that-have-to-advertise-for-disciples.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { realmForOrdinal } from '../../../src/engine/cultivation/realms.js';

/**
 * A field with an unambiguous top and bottom.
 *
 * Nine doors: three at the bottom on both axes, three in the middle, three at
 * the top. Written out rather than taken from the catalog because these tests
 * are about the RULE, and a catalog edit must be able to move the shipped
 * answer without turning the rule red.
 */
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
    placeName: 'Iron Gate',
    ground: 'market_town' as const,
    placeProvinceId: 'province-a',
    onDay: 400,
    seed: 'wall-seed'
};

describe('who has to advertise is derived from the field, never listed', () => {
    it('takes the houses at or below the middle bar AND below the middle standing', () => {
        const advertisers = housesThatHaveToAdvertise(field());
        const ids = advertisers.map(h => h.id);

        // Bars 0..8, middle 4; powers 10..34, middle 22. So 0..4 on the bar
        // and strictly under 22 on power, which is 0, 1, 2, 3.
        expect(ids).toEqual(['house-0', 'house-1', 'house-2', 'house-3']);
    });

    it('lets a house out of it by getting stronger, with no edit here', () => {
        const raised = field().map(h =>
            h.id === 'house-3' ? { ...h, powerOrdinal: 40 } : h);

        // Raising one house's standing lifts the median too, so this is not a
        // one-row swap - which is the point. The set tracks the field.
        const before = housesThatHaveToAdvertise(field()).map(h => h.id);
        const after = housesThatHaveToAdvertise(raised).map(h => h.id);
        expect(before).toContain('house-3');
        expect(after).not.toContain('house-3');
    });

    it('is order-independent, so a shuffled catalog gives the same answer', () => {
        const forward = housesThatHaveToAdvertise(field()).map(h => h.id);
        const backward = housesThatHaveToAdvertise([...field()].reverse()).map(h => h.id);
        expect(backward).toEqual(forward);
    });

    it('answers nothing for an empty field rather than throwing', () => {
        expect(housesThatHaveToAdvertise([])).toEqual([]);
    });

    /**
     * The categories are not decoration: each is a different true statement
     * about the house, and they are what the paper gives away for free.
     */
    it('says why each one is up there, and no seat outranks an open door', () => {
        const seatless = housesThatHaveToAdvertise(
            field().map(h => (h.id === 'house-0' ? { ...h, provinceId: null } : h))
        );
        expect(seatless.find(h => h.id === 'house-0')?.why).toBe('no_seat');

        const seated = housesThatHaveToAdvertise(field());
        expect(seated.find(h => h.id === 'house-0')?.why).toBe('open_door');
        expect(seated.find(h => h.id === 'house-3')?.why).toBe('no_name');
    });
});

describe('whose word reaches which ground', () => {
    it('confines a house with a seat to its own province', () => {
        const seated = field()[0];
        expect(reachesThisGround(seated, 'province-a')).toBe(true);
        expect(reachesThisGround(seated, 'province-b')).toBe(false);
        expect(reachesThisGround(seated, null)).toBe(false);
    });

    /**
     * A null province is a fact rather than missing data. The houses that read
     * null in the shipped catalog are the ones that work a road - the Hollow
     * Bell Wanderers own nothing and signal with "a bell hung at a crossroads"
     * - and confining them to a province they do not have would delete them.
     */
    it('lets a house with no seat reach anywhere, including unplaced ground', () => {
        const itinerant = { ...field()[0], provinceId: null };
        expect(reachesThisGround(itinerant, 'province-a')).toBe(true);
        expect(reachesThisGround(itinerant, null)).toBe(true);
    });
});

describe('the wall', () => {
    it('carries nothing where there is no wall', () => {
        for (const ground of ['hamlet', 'site', 'unplaceable'] as const) {
            expect(BILLS_A_WALL_CARRIES[ground]).toBe(0);
            expect(billsOnTheWall({ ...WALL, ground })).toEqual([]);
        }
    });

    it('carries more where more people walk past', () => {
        expect(BILLS_A_WALL_CARRIES.city)
            .toBeGreaterThan(BILLS_A_WALL_CARRIES.market_town);
        expect(BILLS_A_WALL_CARRIES.market_town)
            .toBeGreaterThan(BILLS_A_WALL_CARRIES.village);
        expect(billsOnTheWall({ ...WALL, field: field(), ground: 'city' }).length)
            .toBeGreaterThan(billsOnTheWall({ ...WALL, field: field(), ground: 'village' }).length);
    });

    it('never papers a wall with one house twice', () => {
        const bills = billsOnTheWall({ ...WALL, field: field(), ground: 'city' });
        expect(new Set(bills.map(b => b.houseId)).size).toBe(bills.length);
    });

    it('gives the same wall the same paper on the same day', () => {
        const once = billsOnTheWall({ ...WALL, field: field() });
        const twice = billsOnTheWall({ ...WALL, field: field() });
        expect(twice).toEqual(once);
    });

    it('changes when the season does, which is what makes it a channel', () => {
        const now = billsOnTheWall({ ...WALL, field: field() });
        const laterSameWindow = billsOnTheWall({ ...WALL, field: field(), onDay: WALL.onDay + 1 });
        const nextWindow = billsOnTheWall({
            ...WALL, field: field(), onDay: WALL.onDay + A_BILL_STAYS_UP_FOR_DAYS
        });

        expect(laterSameWindow.map(b => b.houseId)).toEqual(now.map(b => b.houseId));
        // Different window, different draw. Asserted on the stream rather than
        // on the outcome, because two draws from nine houses may honestly
        // coincide and a test that demanded they differ would be flaky.
        expect(forStream('x', 'recruiting_bills', 'Iron Gate', 4).seed)
            .not.toBe(forStream('x', 'recruiting_bills', 'Iron Gate', 5).seed);
        expect(nextWindow.every(b => b.opensOnDay > WALL.onDay)).toBe(true);
    });

    it('never advertises a day that has already gone past', () => {
        for (let day = 0; day < A_BILL_STAYS_UP_FOR_DAYS * 3; day += 7) {
            for (const bill of billsOnTheWall({ ...WALL, field: field(), onDay: day })) {
                expect(bill.opensOnDay).toBeGreaterThan(day);
            }
        }
    });

    it('leaves a house that cannot post its name in public off the wall', () => {
        const quiet = field().map(h =>
            h.id === 'house-0' ? { ...h, postsInPublic: false } : h);
        const bills = billsOnTheWall({ ...WALL, field: quiet, ground: 'city' });
        expect(bills.map(b => b.houseId)).not.toContain('house-0');
        // And it is still in the field the medians are taken over: a house
        // that recruits by mouth needs bodies exactly as badly.
        expect(housesThatHaveToAdvertise(quiet).map(h => h.id)).toContain('house-0');
    });

    /**
     * `tests/web/voice.test.ts` asserts the narrator never recites the sheet
     * back at the player, and it caught this line when the bill quoted a full
     * rank name. A poster states a band; the precise ordinal stays on the row
     * for anything that needs to compare rather than to say.
     */
    it('states a realm and never a layer', () => {
        for (const bill of billsOnTheWall({ ...WALL, field: field(), ground: 'city' })) {
            expect(bill.saying).not.toMatch(/Layer \d/);
            expect(bill.takesFrom).toContain(realmForOrdinal(bill.admissionOrdinal).name);
            expect(typeof bill.admissionOrdinal).toBe('number');
        }
    });
});

describe('what a bill grants', () => {
    /**
     * `placed` is the whole of what a poster is worth: the reader knows the
     * house exists and where to go, which licenses travel and an application
     * and is exactly not an introduction. `read` is the ceiling for that
     * stage in `engine/social/discovery.ts`, so nothing here is claiming more
     * than the source can carry.
     */
    it('is an ordinary knowledge row at the stage a read source can carry', () => {
        const bill = billsOnTheWall({ ...WALL, field: field() })[0];
        const grant = whatABillGrants(bill);

        expect(grant.kind).toBe('sect');
        expect(grant.id).toBe(bill.houseId);
        expect(grant.sourceKind).toBe('read');
        expect(grant.stage).toBe('placed');
        expect(grant.sourceNote).toContain(bill.placeName);
        expect(grant.statement).toContain(bill.houseName);
    });
});

describe('the draw perturbs nothing', () => {
    /**
     * A new RNG draw that consumes from an existing stream shifts every later
     * draw in the run and is a real regression. This one is its own named
     * stream derived from the seed, the place and the window, so a run that
     * never reads a wall draws exactly what it drew before.
     *
     * Asserted structurally: reading a wall must not be able to touch any
     * other stream's sequence, and the only way it could is by sharing one.
     */
    it('draws from a stream nothing else uses, and reading it changes no other', () => {
        const before = [
            forStream('run', 'breakthrough', 1, 0).next(),
            forStream('run', 'creation', 'origin').next(),
            forStream('run', 'web_practice', 3, 'look', 'c').next()
        ];

        billsOnTheWall({ ...WALL, field: field(), seed: 'run', ground: 'city' });
        billsOnTheWall({ ...WALL, field: field(), seed: 'run', onDay: 900 });

        const after = [
            forStream('run', 'breakthrough', 1, 0).next(),
            forStream('run', 'creation', 'origin').next(),
            forStream('run', 'web_practice', 3, 'look', 'c').next()
        ];
        expect(after).toEqual(before);

        expect(forStream('run', 'recruiting_bills', 'Iron Gate', 4).seed)
            .not.toBe(forStream('run', 'breakthrough', 'Iron Gate', 4).seed);
    });
});
