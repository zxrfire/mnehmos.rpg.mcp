/**
 * The range curve is entirely numbers, so every decision in it is named here.
 *
 * AGENTS.md: a design decision that lives only as a number gets silently
 * reverted by the next person who finds it surprising. These cases state the
 * decisions in their own names, and the ones that read a figure off the region
 * catalog fail loudly if a content pass moves a road.
 */

import { describe, it, expect } from 'vitest';

import {
    FOLD_FLOOR_ORDINAL,
    FOLD_GRANT,
    FOLD_RANGE_AT_THE_FLOOR,
    FOLD_RANGE_GROWTH_PER_RUNG,
    SEEN_FIX_ERROR,
    SETTLING_DAYS_AT_FULL_STRETCH,
    couldFoldThere,
    foldRangeInWalkingDays,
    landsShortByDays,
    priceFold,
    settlingDaysFor,
    whatArrivingByFoldSays
} from '../../../src/engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';
import {
    PIERCE_GRANT,
    PIERCE_REACH_DAYS,
    convergenceOf,
    pierceReach
} from '../../../src/engine/world/convergence.js';
import {
    grantsAvailableAt,
    grantsHeldWith,
    isGrantAvailableAt
} from '../../../src/engine/world/capability.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { REGIONS } from '../../../src/data/cultivation/regions.js';
import { horizonInDays } from '../../../src/web/what-you-can-see-from-up-there.js';
import type { LocationRecord } from '../../../src/engine/world/locations.js';

/** Every stated road in the world, in walking days. */
const ROADS: number[] = REGIONS.flatMap(region =>
    region.connections.map(connection => connection.travelDays)
);
const SHORTEST_ROAD = Math.min(...ROADS);
const WIDEST_ROAD = Math.max(...ROADS);

const HOLDS = [FOLD_GRANT] as const;

describe('the floor is the rung the capability layer already puts folding at', () => {
    it('starts exactly where spatial_folding becomes available', () => {
        expect(isGrantAvailableAt(FOLD_FLOOR_ORDINAL, FOLD_GRANT)).toBe(true);
        expect(isGrantAvailableAt(FOLD_FLOOR_ORDINAL - 1, FOLD_GRANT)).toBe(false);
    });

    it('reaches nothing at all below the floor, whatever anybody claims to hold', () => {
        for (let ordinal = 0; ordinal < FOLD_FLOOR_ORDINAL; ordinal++) {
            expect(foldRangeInWalkingDays(ordinal)).toBe(0);
            expect(couldFoldThere(ordinal, HOLDS, 1)).toBe(false);
        }
    });

    it('is a switch on the grant and a curve on the rung, and needs both', () => {
        const reached = priceFold({ ordinal: 40, heldGrants: [], walkingDays: 6, fix: 'stood' });
        expect(reached.canFoldAtAll).toBe(false);
        expect(reached.rangeDays).toBe(0);

        const held = priceFold({ ordinal: 40, heldGrants: HOLDS, walkingDays: 6, fix: 'stood' });
        expect(held.canFoldAtAll).toBe(true);
        expect(held.withinRange).toBe(true);
    });

    it('is denied to a partial refinement, which is the design owner\'s own ruling', () => {
        const whole = grantsHeldWith(FOLD_FLOOR_ORDINAL, []);
        const partial = grantsHeldWith(FOLD_FLOOR_ORDINAL, ['partial-refinement']);
        expect(whole).toContain(FOLD_GRANT);
        expect(partial).not.toContain(FOLD_GRANT);

        expect(priceFold({
            ordinal: FOLD_FLOOR_ORDINAL, heldGrants: partial, walkingDays: 6, fix: 'stood'
        }).canFoldAtAll).toBe(false);
    });
});

describe('the two anchors are the catalog\'s figures, not chosen ones', () => {
    it('reaches exactly one province over at the floor: the shortest stated road', () => {
        expect(SHORTEST_ROAD).toBe(FOLD_RANGE_AT_THE_FLOOR);
        expect(foldRangeInWalkingDays(FOLD_FLOOR_ORDINAL)).toBe(FOLD_RANGE_AT_THE_FLOOR);
        expect(couldFoldThere(FOLD_FLOOR_ORDINAL, HOLDS, SHORTEST_ROAD)).toBe(true);
        expect(couldFoldThere(FOLD_FLOOR_ORDINAL, HOLDS, SHORTEST_ROAD + 1)).toBe(false);
    });

    it('leaves the widest road in the world just out of one step at Grand Ascension', () => {
        // 37 is `gates_places`: the rung at which somebody stops being gated by
        // places. The growth constant is fitted so the world stops being wide
        // there, and it lands just short of it - nothing was tuned to make that
        // happen and nothing should be tuned to make it exact.
        expect(WIDEST_ROAD).toBe(34);
        expect(foldRangeInWalkingDays(37)).toBeLessThan(WIDEST_ROAD);
        expect(foldRangeInWalkingDays(37)).toBeGreaterThan(WIDEST_ROAD * 0.95);
        expect(foldRangeInWalkingDays(38)).toBeGreaterThan(WIDEST_ROAD);
    });

    it('opens a road that was shut the rung before, over most of the climb', () => {
        // The legibility claim: climbing between Void Refinement and Grand
        // Ascension is supposed to keep handing somebody a destination. Counted
        // rather than asserted - of the distinct roads in the world, how many
        // come into reach across those nine rungs.
        const distinct = [...new Set(ROADS)].sort((a, b) => a - b);
        const opened = distinct.filter(road =>
            !couldFoldThere(FOLD_FLOOR_ORDINAL, HOLDS, road) && couldFoldThere(38, HOLDS, road)
        );
        expect(opened.length).toBeGreaterThanOrEqual(distinct.length - 1);
    });

    it('grows monotonically and never doubles in a single rung', () => {
        // A rung is worth something and never worth a realm. 1.24 is well under
        // the x4 a realm is worth in power, which is deliberate: range is not a
        // second ladder.
        expect(FOLD_RANGE_GROWTH_PER_RUNG).toBeGreaterThan(1);
        expect(FOLD_RANGE_GROWTH_PER_RUNG).toBeLessThan(2);
        for (let ordinal = FOLD_FLOOR_ORDINAL; ordinal < MAX_ORDINAL; ordinal++) {
            expect(foldRangeInWalkingDays(ordinal + 1))
                .toBeGreaterThan(foldRangeInWalkingDays(ordinal));
        }
    });

    it('saturates against the map rather than against a cap somebody maintains', () => {
        // Past 38 the whole world is inside one step, so the curve stops
        // distinguishing anybody and needs no ceiling written for it.
        for (let ordinal = 38; ordinal <= MAX_ORDINAL; ordinal++) {
            expect(foldRangeInWalkingDays(ordinal)).toBeGreaterThan(WIDEST_ROAD);
        }
    });
});

describe('you cannot fold further than you can see', () => {
    it('keeps the range strictly inside the sight horizon at every rung', () => {
        // The invariant behind the fix: a fold needs somewhere to aim, and the
        // furthest anybody can make anything out is the sight horizon. Asserted
        // here rather than imported into the engine, because perception lives
        // in the web layer and the engine must not reach up into it.
        for (let ordinal = FOLD_FLOOR_ORDINAL; ordinal <= MAX_ORDINAL; ordinal++) {
            expect(foldRangeInWalkingDays(ordinal)).toBeLessThan(horizonInDays(ordinal));
        }
    });
});

describe('the fix is the scarce thing, and it is the Measured Span\'s scarcity', () => {
    it('lands a sighting short and ground somebody has stood on exact', () => {
        expect(landsShortByDays(20, 'stood')).toBe(0);
        expect(landsShortByDays(20, 'seen')).toBe(Math.ceil(20 * SEEN_FIX_ERROR));
    });

    it('does not improve the fix with the rung, because the error is in the fix', () => {
        // The Span can read a distance and cannot state one, and no amount of
        // being good at surveying fixes that. The personal version is the same:
        // somebody at the top of the ladder folding to a valley they have only
        // looked at lands exactly as far out as somebody at the floor does.
        const atTheFloor = priceFold({
            ordinal: FOLD_FLOOR_ORDINAL, heldGrants: HOLDS, walkingDays: 6, fix: 'seen'
        });
        const atTheTop = priceFold({
            ordinal: 44, heldGrants: HOLDS, walkingDays: 6, fix: 'seen'
        });
        expect(atTheTop.landsShortBy).toBe(atTheFloor.landsShortBy);
    });

    it('makes having stood somewhere worth strictly more than having seen it', () => {
        const stood = priceFold({ ordinal: 34, heldGrants: HOLDS, walkingDays: 17, fix: 'stood' });
        const seen = priceFold({ ordinal: 34, heldGrants: HOLDS, walkingDays: 17, fix: 'seen' });
        expect(seen.daysSpent).toBeGreaterThan(stood.daysSpent);
    });
});

describe('what it costs, and why a fold at full stretch is not the fast option', () => {
    it('charges nothing worth counting well inside the range', () => {
        const easy = priceFold({ ordinal: 40, heldGrants: HOLDS, walkingDays: 6, fix: 'stood' });
        expect(easy.daysSpent).toBe(1);
        expect(easy.daysSavedAgainstWalking).toBe(5);
    });

    it('charges the full stretch at the edge, so the edge is soft and not a cliff', () => {
        const strained = priceFold({
            ordinal: FOLD_FLOOR_ORDINAL, heldGrants: HOLDS, walkingDays: 6, fix: 'stood'
        });
        expect(strained.settlingDays).toBe(SETTLING_DAYS_AT_FULL_STRETCH);
        expect(strained.daysSpent).toBe(SETTLING_DAYS_AT_FULL_STRETCH);
        // A heaven-grade hull does six walking days in two. Somebody at the very
        // floor of the realm, folding as hard as they can, is slower than the
        // best boat in the world - which is what keeps the conveyance ladder's
        // top rungs worth owning.
        expect(strained.daysSpent).toBeGreaterThan(2);
    });

    it('prices the reach and never the distance, so it is relative to the rung', () => {
        // Same road, different rungs. The cost is how hard they reached.
        const floor = priceFold({
            ordinal: FOLD_FLOOR_ORDINAL, heldGrants: HOLDS, walkingDays: 6, fix: 'stood'
        });
        const high = priceFold({ ordinal: 38, heldGrants: HOLDS, walkingDays: 6, fix: 'stood' });
        expect(high.daysSpent).toBeLessThan(floor.daysSpent);
    });

    it('rises quadratically, so the price is negligible until the last third', () => {
        expect(settlingDaysFor(5, 10)).toBe(1);
        expect(settlingDaysFor(7, 10)).toBe(2);
        expect(settlingDaysFor(10, 10)).toBe(SETTLING_DAYS_AT_FULL_STRETCH);
    });

    it('never spends less than a day, the way every other journey in this engine does not', () => {
        const tiny = priceFold({ ordinal: 44, heldGrants: HOLDS, walkingDays: 1, fix: 'stood' });
        expect(tiny.daysSpent).toBe(1);
    });

    it('never claims a saving it did not make', () => {
        for (const ordinal of [29, 33, 37, 41, 44]) {
            for (const road of [...new Set(ROADS)]) {
                const cost = priceFold({ ordinal, heldGrants: HOLDS, walkingDays: road, fix: 'seen' });
                if (!cost.withinRange) {
                    expect(cost.daysSpent).toBe(road);
                    expect(cost.daysSavedAgainstWalking).toBe(0);
                    continue;
                }
                expect(cost.daysSpent).toBeLessThanOrEqual(road);
                expect(cost.daysSavedAgainstWalking).toBe(road - cost.daysSpent);
            }
        }
    });
});

describe('beyond the range is a distance and never a refusal', () => {
    it('says what the road costs instead of saying no', () => {
        const far = priceFold({
            ordinal: FOLD_FLOOR_ORDINAL, heldGrants: HOLDS, walkingDays: 34, fix: 'stood'
        });
        expect(far.canFoldAtAll).toBe(true);
        expect(far.withinRange).toBe(false);
        expect(far.daysSpent).toBe(34);
        expect(far.reason).toContain('not a refusal');
    });

    it('gives everybody a reason, including the people it says nothing to', () => {
        expect(priceFold({ ordinal: 5, walkingDays: 6, fix: 'stood' }).reason.length)
            .toBeGreaterThan(0);
        expect(priceFold({ ordinal: 40, heldGrants: [], walkingDays: 6, fix: 'stood' }).reason.length)
            .toBeGreaterThan(0);
    });
});

describe('arriving without having travelled is a fact a witness reads', () => {
    it('says so, in both cases, and never blank on a fold that happened', () => {
        expect(whatArrivingByFoldSays(0)).toContain('not on the road');
        expect(whatArrivingByFoldSays(2)).toContain('walked the last of it');
        const cost = priceFold({ ordinal: 40, heldGrants: HOLDS, walkingDays: 9, fix: 'stood' });
        expect(cost.arrivalReads.length).toBeGreaterThan(0);
    });
});

describe('the convergence pierce still behaves exactly as it did', () => {
    const site = (): LocationRecord => ({
        cycle: { periodDays: 3600, openDays: 30, phaseDay: 0 },
        sealed: false
    } as unknown as LocationRecord);

    it('prices a full-strength pierce at the fold\'s reach at the floor', () => {
        expect(PIERCE_REACH_DAYS).toBe(FOLD_RANGE_AT_THE_FLOOR);
        expect(PIERCE_REACH_DAYS).toBe(6);
        expect(PIERCE_GRANT).toBe(FOLD_GRANT);
    });

    it('does not grow with the rung there, and that boundary is deliberate', () => {
        // What a waning convergence spends is the site receding, and a receding
        // far end is not a distance on anybody's table. Everywhere else a fold
        // reaches further the higher the folder stands; here it does not, and a
        // change that "fixes" this is changing that module's design.
        const convergence = convergenceOf(site(), 0);
        const low = pierceReach(convergence, { realmOrdinal: 29, heldGrants: HOLDS });
        const high = pierceReach(convergence, { realmOrdinal: 44, heldGrants: HOLDS });
        expect(low).toBe(high);
        expect(low).toBe(PIERCE_REACH_DAYS);
    });

    it('still returns nothing to anybody who cannot fold', () => {
        const convergence = convergenceOf(site(), 0);
        expect(pierceReach(convergence, { realmOrdinal: 20, heldGrants: HOLDS })).toBe(0);
        expect(pierceReach(convergence, { realmOrdinal: 44, heldGrants: [] })).toBe(0);
    });

    it('still wanes to nothing as the window closes', () => {
        const location = site();
        const atOpen = pierceReach(convergenceOf(location, 0), { realmOrdinal: 44, heldGrants: HOLDS });
        const atClose = pierceReach(convergenceOf(location, 30), { realmOrdinal: 44, heldGrants: HOLDS });
        expect(atOpen).toBe(PIERCE_REACH_DAYS);
        expect(atClose).toBe(0);
    });
});

describe('almost nobody is up here, and that is checked rather than assumed', () => {
    it('confers folding on exactly one class floor and above', () => {
        // Guard against the floor drifting: `grantsAvailableAt` is cumulative,
        // so the first ordinal that offers the grant is the whole of the claim.
        const first = Array.from({ length: MAX_ORDINAL + 1 }, (_, o) => o)
            .find(o => grantsAvailableAt(o).includes(FOLD_GRANT));
        expect(first).toBe(FOLD_FLOOR_ORDINAL);
    });
});
