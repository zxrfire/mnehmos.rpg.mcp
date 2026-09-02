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
    expeditionBudget,
    pierceReach,
    rescuersFor
} from '../../../src/engine/world/convergence.js';
import { withWings, type RuinWing } from '../../../src/engine/world/provenance.js';
import { createNpc, setRealm, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { makeLocation, makeThresholds } from '../../../src/engine/world/locations.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
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

/** A cycling site with wings at four depths, shallow to past the window. */
function ruinWithWings(): LocationRecord {
    const wing = (id: string, depthDays: number): RuinWing => ({
        id, name: id, sealed: false, state: 'untouched',
        workings: 0, lastWorkedOnDay: null, depthDays
    });
    return withWings(
        makeLocation({
            id: 'loc-fold-ruin',
            name: 'the deep compound',
            kind: 'ruin',
            thresholds: makeThresholds(4, 8, 14, 20),
            cycle: { periodDays: 3600, openDays: 30, phaseDay: 0 }
        }),
        [wing('near', 4), wing('mid', 14), wing('deep', 22), wing('far', 60)]
    );
}

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

describe('the convergence pierce is priced on the same curve as every other fold', () => {
    const site = (): LocationRecord => ({
        cycle: { periodDays: 3600, openDays: 30, phaseDay: 0 },
        sealed: false
    } as unknown as LocationRecord);

    it('starts a pierce at the fold\'s reach at the floor, and calls it the floor', () => {
        expect(PIERCE_REACH_DAYS).toBe(FOLD_RANGE_AT_THE_FLOOR);
        expect(PIERCE_REACH_DAYS).toBe(6);
        expect(PIERCE_GRANT).toBe(FOLD_GRANT);
        // The floor of the curve, not a ceiling on it: somebody standing at the
        // rung where folding begins gets exactly this and everybody above gets
        // more.
        const convergence = convergenceOf(site(), 0);
        expect(pierceReach(convergence, { realmOrdinal: FOLD_FLOOR_ORDINAL, heldGrants: HOLDS }))
            .toBe(PIERCE_REACH_DAYS);
    });

    it('reaches further into a closing site the higher the folder stands', () => {
        // The ruling is range increases with ordinal, and a ruin door is not an
        // exception to it. A master four realms above the one who came last
        // time comes further in.
        const convergence = convergenceOf(site(), 0);
        const low = pierceReach(convergence, { realmOrdinal: 29, heldGrants: HOLDS });
        const high = pierceReach(convergence, { realmOrdinal: 44, heldGrants: HOLDS });
        expect(high).toBeGreaterThan(low);
        expect(high).toBeCloseTo(foldRangeInWalkingDays(44), 1);
    });

    it('still returns nothing to anybody who cannot fold', () => {
        const convergence = convergenceOf(site(), 0);
        expect(pierceReach(convergence, { realmOrdinal: 20, heldGrants: HOLDS })).toBe(0);
        expect(pierceReach(convergence, { realmOrdinal: 44, heldGrants: [] })).toBe(0);
    });

    it('still wanes to nothing as the window closes, at every rung', () => {
        // The property that does the work here was never shortness, it is the
        // waning - and the waning multiplies whatever the folder brought, so it
        // still reaches zero at the close for the highest person alive.
        const location = site();
        for (const ordinal of [FOLD_FLOOR_ORDINAL, 37, 44]) {
            const atOpen = pierceReach(convergenceOf(location, 0), { realmOrdinal: ordinal, heldGrants: HOLDS });
            const halfway = pierceReach(convergenceOf(location, 15), { realmOrdinal: ordinal, heldGrants: HOLDS });
            const atClose = pierceReach(convergenceOf(location, 30), { realmOrdinal: ordinal, heldGrants: HOLDS });
            expect(atOpen).toBeCloseTo(foldRangeInWalkingDays(ordinal), 1);
            expect(halfway).toBeLessThan(atOpen);
            expect(atClose).toBe(0);
        }
    });

    it('does not let a wing be both foldable and beyond the window', () => {
        // `bestEver` used to credit every actor with the floor reach, including
        // the mortals who are the only people actually in here. Now that the
        // reach is theirs, the ceiling has to be theirs too, or a wing comes
        // back reachable-by-fold and out of reach in the same row.
        const location = ruinWithWings();
        for (const ordinal of [4, 20, FOLD_FLOOR_ORDINAL, 40]) {
            const budget = expeditionBudget(location, 0, {
                realmOrdinal: ordinal, heldGrants: HOLDS
            });
            for (const wing of budget.wings) {
                expect(wing.needsPierce && wing.beyondTheWindow).toBe(false);
            }
        }
    });

    it('gives somebody higher a shorter list of wings they cannot reach', () => {
        const location = ruinWithWings();
        const low = expeditionBudget(location, 0, { realmOrdinal: 4, heldGrants: HOLDS });
        const high = expeditionBudget(location, 0, { realmOrdinal: 40, heldGrants: HOLDS });
        expect(high.unreachableWings.length).toBeLessThanOrEqual(low.unreachableWings.length);
        expect(high.piercedDepth).toBeGreaterThan(low.piercedDepth);
    });
});

describe('a rescuer\'s reach is their own, which is what makes the tie matter', () => {
    const pavilion = (): LocationRecord => ({
        id: 'loc-pav',
        name: 'the Pavilion',
        cycle: { periodDays: 400 * 365, openDays: 40, phaseDay: 0 },
        sealed: false
    } as unknown as LocationRecord);

    function worldWithMaster(ordinal: number): WorldState {
        const subject = setRealm(createNpc('inside', {
            id: 'npc-inside', bornOnDay: 0, onDay: 3650, locationId: 'loc-pav'
        }), 8, 3650);
        const master = upsertRelationship(
            setRealm(createNpc('master', {
                id: 'npc-master', bornOnDay: 0, onDay: 3650, locationId: 'loc-hall'
            }), ordinal, 3650),
            {
                targetId: 'npc-inside', targetName: subject.name,
                kind: 'master', standing: 0.9, note: ''
            },
            0
        );
        return { npcs: [subject, master] } as unknown as WorldState;
    }

    const ask = (ordinal: number, depthDays: number, day: number) =>
        rescuersFor(worldWithMaster(ordinal), {
            subject: worldWithMaster(ordinal).npcs[0],
            location: pavilion(), depthDays, day
        });

    it('reaches deeper for a higher master, on the same day, into the same site', () => {
        const near = ask(FOLD_FLOOR_ORDINAL, 1, 1)[0];
        const far = ask(44, 1, 1)[0];
        expect(far.reach).toBeGreaterThan(near.reach);
    });

    it('turns a depth one master cannot cover into one another can', () => {
        // The design consequence worth having: whose student you are is now a
        // fact about how deep you may go, and it is legible before you go.
        const depth = 20;
        expect(ask(FOLD_FLOOR_ORDINAL, depth, 1)[0].reachesYou).toBe(false);
        expect(ask(40, depth, 1)[0].reachesYou).toBe(true);
    });

    it('still fails on geometry when the call goes out late, at any rung', () => {
        // Day 39 of a 40-day window. The waning multiplies whatever they
        // brought, so rank does not buy back the time.
        for (const ordinal of [FOLD_FLOOR_ORDINAL, 40, 44]) {
            expect(ask(ordinal, 20, 39)[0].reachesYou).toBe(false);
        }
    });

    it('still reports nobody where the tie is to somebody who cannot fold', () => {
        expect(ask(FOLD_FLOOR_ORDINAL - 1, 1, 1)).toHaveLength(0);
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
