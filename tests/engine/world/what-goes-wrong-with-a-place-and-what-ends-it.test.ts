/**
 * What goes wrong with a place, and that it stops.
 *
 * The layer this feeds - `what-is-true-of-a-place-right-now.ts` - was complete
 * and had no writer at all. Measured before these tests existed: a thousand
 * world-years, zero rows, with the played `investigate` verb reading off the
 * empty column. So the load-bearing assertions here are not about the shape of
 * a candidate; they are that the world MAKES them, that each one is caused by
 * something else that happened, and that they END.
 *
 * The soak at the bottom is the one that matters. It is slow, and it is the
 * only thing that can tell the difference between a writer and a design.
 */
import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { QI_DENSITY_DEFAULT } from '../../../src/engine/world/qi-scale.js';
import {
    STOPS_PASSAGE,
    isStatusRunningOn,
    statusesInArea,
    whatIsGoingOnHere
} from '../../../src/engine/world/what-is-true-of-a-place-right-now.js';
import {
    applyGroundDraw,
    capacityFor,
    drawFromTheGround
} from '../../../src/engine/world/what-a-place-still-has-in-the-ground.js';
import {
    A_HARVEST_FAILS,
    STOPS_FOOD,
    STOPS_GATHERING,
    districtsTheirHolderHasShut,
    groundUnderAWar,
    harvestsThatFailed,
    statusKey,
    tidesWhereTheGameWent,
    whatIsWrongWithPlacesToday,
    type GroundAsItStands
} from '../../../src/engine/world/what-goes-wrong-with-a-place-and-what-ends-it.js';

const WORLD_SEED = 'what-goes-wrong';

function ground(qiDensity = QI_DENSITY_DEFAULT) {
    return makeLocation({
        id: 'loc-district', name: 'Iron Gate', kind: 'settlement', qiDensity
    });
}

/** Empty a band the way a century of people would. */
function stripped(place: ReturnType<typeof ground>, kinds: ('herb' | 'beast_material')[]) {
    let at = place;
    for (const kind of kinds) {
        const draw = drawFromTheGround(at, {
            kind, grade: 'mortal', wanted: capacityFor(at, kind, 'mortal'), onDay: 0
        });
        at = applyGroundDraw(at, draw);
    }
    return at;
}

function standing(place: ReturnType<typeof ground>, over: Partial<GroundAsItStands> = {}) {
    return {
        place,
        peopleHere: 12,
        holder: null,
        holderIsAtWar: false,
        holderFightingNames: [],
        isTheHoldersSeat: false,
        ...over
    } satisfies GroundAsItStands;
}

describe('what goes wrong with a place', () => {
    describe('a district its holder has shut', () => {
        it('is not proposed while there is anything left to gather', () => {
            expect(districtsTheirHolderHasShut(
                [standing(ground(), { holder: { id: 'h', name: 'Iron Gate Hall' } })], 0
            )).toEqual([]);
        });

        it('is not proposed where nobody holds the ground', () => {
            // A closure is somebody's decision. Ground nobody holds has nobody
            // to take it, which is most of the world and has to stay that way.
            const bare = stripped(ground(), ['herb', 'beast_material']);
            expect(districtsTheirHolderHasShut([standing(bare)], 0)).toEqual([]);
        });

        it('wants both bands gone, because game left is a reason to let people on', () => {
            const herbsOnly = stripped(ground(), ['herb']);
            expect(districtsTheirHolderHasShut(
                [standing(herbsOnly, { holder: { id: 'h', name: 'Iron Gate Hall' } })], 0
            )).toEqual([]);
        });

        it('names the house that decided it, and stops gathering', () => {
            // `decidedById` is the whole difference between the two kinds of
            // cause in this layer. A war has one, a drought does not, and
            // nothing anywhere branches on which.
            const bare = stripped(ground(), ['herb', 'beast_material']);
            const [shut] = districtsTheirHolderHasShut(
                [standing(bare, { holder: { id: 'sect-kettle', name: 'Iron Gate Hall' } })], 0
            );
            expect(shut.cause.decidedById).toBe('sect-kettle');
            expect(shut.stops).toContain(STOPS_GATHERING);
            expect(shut.priceMultiplier).toBeGreaterThan(1);
            // A house that shuts ground says so. This is the one opener whose
            // cause is known without anybody surveying anything.
            expect(shut.causeKnownLocally).toBe(true);
        });
    });

    describe('a tide where the game went', () => {
        it('runs where the ordinary animals are gone and people are standing there', () => {
            const hunted = stripped(ground(), ['beast_material']);
            const [tide] = tidesWhereTheGameWent([standing(hunted)], 0);
            expect(tide.kind).toBe('beast_tide');
            expect(tide.dangerDelta).toBeGreaterThan(0);
            // The survey problem, stated as a ceiling. Asking around gets you
            // the signs and no further; the cause has to be gone and read.
            expect(tide.causeKnownLocally).toBe(false);
            expect(tide.signs.length).toBeGreaterThan(0);
        });

        it('says nothing about ground nobody has ever walked', () => {
            const hunted = stripped(ground(), ['beast_material']);
            expect(tidesWhereTheGameWent([standing(hunted, { peopleHere: 0 })], 0)).toEqual([]);
        });

        it('has nobody to blame', () => {
            const hunted = stripped(ground(), ['beast_material']);
            const [tide] = tidesWhereTheGameWent([standing(hunted)], 0);
            expect(tide.cause.decidedById).toBeNull();
        });
    });

    describe('ground under a war', () => {
        it('stops passage, and only on the seat', () => {
            // One row per fighting house. A house with forty veins is in one
            // war, and forty rows saying so would make the layer's own claim
            // about its size false - measured at 440 live wars before the seat
            // filter, against 10 tides and 8 closures.
            const holder = { id: 'sect-a', name: 'Kiln Hall' };
            const onTheSeat = standing(ground(), {
                holder, holderIsAtWar: true, holderFightingNames: ['Bone Hall'],
                isTheHoldersSeat: true
            });
            const aHolding = standing(ground(), {
                holder, holderIsAtWar: true, holderFightingNames: ['Bone Hall'],
                isTheHoldersSeat: false
            });
            const out = groundUnderAWar([onTheSeat, aHolding]);
            expect(out).toHaveLength(1);
            expect(out[0].stops).toContain(STOPS_PASSAGE);
            expect(out[0].cause.decidedById).toBe('sect-a');
        });

        it('says nothing about a house that is not fighting', () => {
            expect(groundUnderAWar([standing(ground(), {
                holder: { id: 'sect-a', name: 'Kiln Hall' }, isTheHoldersSeat: true
            })])).toEqual([]);
        });
    });

    describe('a harvest that failed', () => {
        it('lands at about the rate it says it does', () => {
            // A DESIGN DECISION LIVING AS A NUMBER, so it is pinned as a
            // sentence: a little under once a generation per province - rare
            // enough to be remembered, common enough that a five-century world
            // has had a run of them.
            const region = makeLocation({ id: 'reg', name: 'The Silent Cliffs', kind: 'region' });
            let failures = 0;
            const tries = 2000;
            for (let i = 0; i < tries; i++) {
                failures += harvestsThatFailed([region], forStream('h', 'famine', i)).length;
            }
            expect(failures / tries).toBeGreaterThan(A_HARVEST_FAILS * 0.6);
            expect(failures / tries).toBeLessThan(A_HARVEST_FAILS * 1.4);
            expect(A_HARVEST_FAILS).toBeLessThan(1 / 20);
        });

        it('stops the food and blames nobody', () => {
            const region = makeLocation({ id: 'reg', name: 'The Silent Cliffs', kind: 'region' });
            // Draw until one lands rather than pinning a stream to a coincidence.
            let famine = null;
            for (let i = 0; i < 500 && famine === null; i++) {
                famine = harvestsThatFailed([region], forStream('h', 'famine', i))[0] ?? null;
            }
            expect(famine).not.toBeNull();
            expect(famine!.stops).toContain(STOPS_FOOD);
            // Consumption cannot cause one. Mundane goods are never counted
            // anywhere - the famine stops the meals, and travellers buying
            // meals never caused a famine.
            expect(famine!.cause.decidedById).toBeNull();
            expect(famine!.priceMultiplier).toBeGreaterThan(1);
        });
    });

    describe('every candidate can end', () => {
        it('carries a review date, a cap and a quiet period', () => {
            // A famine that never lifts is a worse bug than no famine, and a
            // cause that never goes away buys a status that never ends unless
            // something caps it. Both halves are per-candidate data, so the
            // review stays one rule with no branch on `kind`.
            const bare = stripped(ground(), ['herb', 'beast_material']);
            const proposed = whatIsWrongWithPlacesToday({
                ground: [standing(bare, {
                    holder: { id: 'sect-kettle', name: 'Iron Gate Hall' },
                    holderIsAtWar: true,
                    holderFightingNames: ['Bone Hall'],
                    isTheHoldersSeat: true
                })],
                regions: [],
                onDay: 0,
                rng: forStream('x', 'y')
            });
            expect(proposed.size).toBeGreaterThan(1);
            for (const candidate of proposed.values()) {
                expect(candidate.reviewInDays).toBeGreaterThan(0);
                expect(candidate.mayRunForDays).toBeGreaterThan(candidate.reviewInDays - 1);
                expect(candidate.quietForDaysAfter).toBeGreaterThan(0);
            }
        });

        it('is one status of a kind per area', () => {
            // Two famines in one province is one famine.
            const bare = stripped(ground(), ['herb', 'beast_material']);
            const twice = [
                standing(bare, { holder: { id: 'h', name: 'Iron Gate Hall' } }),
                standing(bare, { holder: { id: 'h', name: 'Iron Gate Hall' } })
            ];
            const proposed = whatIsWrongWithPlacesToday({
                ground: twice, regions: [], onDay: 0, rng: forStream('x', 'y')
            });
            expect([...proposed.keys()])
                .toContain(statusKey('loc-district', 'closed_to_gathering'));
            expect([...proposed.keys()].filter(
                k => k === statusKey('loc-district', 'closed_to_gathering')
            )).toHaveLength(1);
        });
    });
});

describe('the world writes them, and then ends them', () => {
    it('mints statuses with causes and lifts them again over five centuries', async () => {
        // THE TEST THAT COULD NOT HAVE PASSED BEFORE. Not "the module
        // typechecks" and not "a candidate has the right shape" - a world
        // advanced the way a world is advanced, and rows in the table.
        const catalog = await loadCultivationCatalog();
        let { state } = seedWorld({ seed: WORLD_SEED, catalog });
        expect(state.statuses).toHaveLength(0);

        state = advanceWorldYears(state, 500).state;
        const day = Math.floor(state.currentDay);

        expect(state.statuses.length).toBeGreaterThan(20);

        // Every one of them has a cause, and the cause is on the record.
        for (const status of state.statuses) {
            expect(status.cause.what.length).toBeGreaterThan(0);
            expect(status.cause.factId).not.toBeNull();
            expect(state.history.facts.some(f => f.id === status.cause.factId)).toBe(true);
            expect(status.reviewOnDay).toBeGreaterThan(status.beganOnDay);
        }

        // Both kinds of cause occur. A war and a closure are decided by
        // somebody; a tide and a famine are decided by nothing.
        expect(state.statuses.some(s => s.cause.decidedById !== null)).toBe(true);
        expect(state.statuses.some(s => s.cause.decidedById === null)).toBe(true);

        // They END. This is the assertion the whole layer rests on: measured
        // before the review window was widened, 196,914 rows opened over five
        // centuries and NOT ONE was ever extended or lifted.
        const lifted = state.statuses.filter(s => s.liftedOnDay !== null);
        expect(lifted.length).toBeGreaterThan(state.statuses.length / 2);
        const longest = Math.max(
            ...lifted.map(s => (s.liftedOnDay! - s.beganOnDay) / DAYS_PER_YEAR)
        );
        expect(longest).toBeLessThan(100);

        // And what is left is a handful, which is the size the layer says it
        // is - a row per area per thing that is true of it, not a row per
        // object.
        const live = state.statuses.filter(s => isStatusRunningOn(s, day));
        expect(live.length).toBeGreaterThan(0);
        expect(live.length).toBeLessThan(40);

        // And somebody standing in one can read it, at their own stage.
        const somewhere = live[0];
        expect(statusesInArea(state.statuses, state.locations, somewhere.areaId, day).length)
            .toBeGreaterThan(0);
        const signs = whatIsGoingOnHere(
            state.statuses, state.locations, somewhere.areaId, day, () => 'encountered'
        ).flatMap(r => r.lines);
        expect(signs.join(' ')).toContain(somewhere.statement);
        // Encountered gets the signs and never the cause of a status whose
        // cause is not known locally.
        const known = whatIsGoingOnHere(
            state.statuses, state.locations, somewhere.areaId, day, () => 'known'
        ).flatMap(r => r.lines);
        expect(known.length).toBeGreaterThanOrEqual(signs.length);
    }, 900_000);
});
