/**
 * The materials the top of the craft ladder needs are on this side, and sealed.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * Every immortal and chaos formula is readable, costable and attemptable. What
 * stops anybody making one is the INGREDIENTS, and the ingredients are not
 * unobtainable - they are sealed in pockets nothing has drawn on. Getting into
 * one and back out carrying something is the road to the top of the ladder. A
 * finished dose in circulation came from above because that road is hard, not
 * because it is closed. The gate is the door and the material behind it, never
 * a flag that forbids the attempt.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * Measured on a seeded world before `what-a-sealed-pocket-still-grows.ts`
 * existed: NOT ONE unit of immortal- or chaos-grade material was standing
 * anywhere in the world, held by anybody or lying in any hole. The house stock
 * pass cannot place it - `whatTheHouseKeepsToWorkWith` skips any grade whose
 * `refiningOrdinalFor` is above the best furnace a house could keep, and both
 * top grades sit at the True Immortal rung - and no forage below the Lid
 * reaches the harvest ordinals. The formulas named a bill nothing in the world
 * could supply, which is a gate that is correct and useless.
 *
 * ── WHAT IS ASSERTED ─────────────────────────────────────────────────────
 *
 * Behaviour, not the arithmetic that produces it:
 *
 *   it is there                 a world seeds material at this height, and the
 *                               set it can seed is derived off the formulas.
 *   it is behind a door         every unit stands in ground that is still shut.
 *   it is takeable              every unit is the triple `whatIsStandingFreeAt`
 *                               wants, so whoever gets in can pick it up.
 *   extinct stays extinct       nothing seeds `herb-thousand-autumn-
 *                               chrysanthemum`, and the formula naming it stays
 *                               readable and unfillable.
 *   scarcity is real            a pocket holds one material and at most the
 *                               cap of it, and no pocket fills a chaos formula -
 *                               every one of those names two different things
 *                               at this height. A full pocket DOES fill one of
 *                               the four immortal formulas that name one thing
 *                               twice, which is the intended reward for opening
 *                               a six-century door rather than a hole in it.
 *
 * ── THE NUMBERS, AND WHERE THEY CAME FROM ────────────────────────────────
 *
 * `scripts/probe-what-is-standing-in-the-sealed-ground.ts`, twelve pinned
 * worlds: 9.7 undrawn pockets per world, 1.8 of them worth six centuries
 * (19.0%), 2.1 stands seeded per world, and 3 of the 12 worlds hold enough for
 * any one formula at all. None of those figures is asserted here - they are
 * provenance, and they move when the door arc is retuned.
 *
 * RED-CHECKED. Dropping `seedWhatSealedPocketsStillGrow` from `seeding.ts`
 * fails "a world holds material at the top of the ladder". Loosening
 * `isAnUndrawnPocket` to accept ground standing open fails "every unit is
 * behind a door that is still shut". Removing the extinct filter from
 * `WHAT_THE_TOP_OF_THE_LADDER_NEEDS` fails "nothing that stopped growing is
 * standing anywhere".
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { isTracked, type ObjectRecord } from '../../../src/engine/world/possessions.js';
import { getLocation, type WorldState } from '../../../src/engine/world/world-state.js';
import {
    A_STAND_IN_SEALED_GROUND,
    MOST_IN_ONE_POCKET,
    WHAT_THE_TOP_OF_THE_LADDER_NEEDS,
    WORTH_SIX_CENTURIES,
    isAnUndrawnPocket,
    whatThisPocketStillGrows
} from '../../../src/engine/world/what-a-sealed-pocket-still-grows.js';
import {
    CYCLE_YEARS,
    CYCLE_YEARS_BY_WORTH
} from '../../../src/engine/world/how-long-a-door-stays-shut.js';
import { EXTINCT_HERB_IDS, getHerb } from '../../../src/data/cultivation/herbs.js';
import { RECIPES } from '../../../src/data/cultivation/recipes.js';
import { getPill } from '../../../src/data/cultivation/pills.js';

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];

function world(seed: string): WorldState {
    return seedWorld({
        seed, catalog: fixtureCatalog(), presentYear: 1000, population: 250
    }).state;
}

function standsIn(state: WorldState): ObjectRecord[] {
    return state.objects.filter(o => o.tags.includes(A_STAND_IN_SEALED_GROUND));
}

/** What each pocket is holding, keyed by the pocket. */
function byPocket(state: WorldState): Map<string, ObjectRecord[]> {
    const out = new Map<string, ObjectRecord[]>();
    for (const stand of standsIn(state)) {
        const at = String(stand.locationId);
        out.set(at, [...(out.get(at) ?? []), stand]);
    }
    return out;
}

/** Every formula the lower realm cannot supply. */
function topFormulas(): typeof RECIPES[number][] {
    return RECIPES.filter(r => {
        const grade = getPill(r.producesPillId)?.grade;
        return grade === 'immortal' || grade === 'chaos';
    });
}

describe('what a sealed pocket still grows', () => {
    it('sits a stand behind the door the arc prices at six centuries', () => {
        // The one design number in the module, pinned to the thing it is a
        // reading of rather than to a literal: the top step of the wait, which
        // is the six-hundred-year cycle.
        expect(CYCLE_YEARS_BY_WORTH[WORTH_SIX_CENTURIES]).toBe(CYCLE_YEARS.long);
        expect(WORTH_SIX_CENTURIES).toBe(CYCLE_YEARS_BY_WORTH.length - 1);
    });

    it('names the materials off the formulas that need them, not off a list', () => {
        expect(WHAT_THE_TOP_OF_THE_LADDER_NEEDS.length).toBeGreaterThan(0);

        const wanted = new Set(topFormulas().flatMap(r => r.ingredients.map(i => i.itemId)));
        for (const herb of WHAT_THE_TOP_OF_THE_LADDER_NEEDS) {
            // Everything in the pool is wanted by one of those formulas...
            expect(wanted.has(herb.id)).toBe(true);
            // ...and is at the height those formulas are at.
            expect(['immortal', 'chaos']).toContain(herb.grade);
        }
    });

    it('leaves nothing that stopped growing in the pool', () => {
        for (const herb of WHAT_THE_TOP_OF_THE_LADDER_NEEDS) {
            expect(EXTINCT_HERB_IDS.has(herb.id)).toBe(false);
        }
    });

    it('keeps the formula nobody can fill readable and unfillable', () => {
        // The whole mechanism is one set membership, and it must stay that way:
        // the recipe resolves, every ingredient resolves, and one of them is
        // not in the world.
        const formula = RECIPES.find(r => r.id === 'recipe-immortal-longevity');
        expect(formula).toBeDefined();
        const ids = formula!.ingredients.map(i => i.itemId);
        for (const id of ids) expect(getHerb(id)).toBeDefined();
        expect(ids.some(id => EXTINCT_HERB_IDS.has(id))).toBe(true);
    });

    it('a world holds material at the top of the ladder', () => {
        const seeded = SEEDS.map(seed => standsIn(world(seed)).length);
        // Not every world - a world with no pocket worth six centuries holds
        // none, and that is the scarcity rather than a failure. Across the
        // pinned set there is material.
        expect(seeded.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    });

    it('puts every unit behind a door that is still shut', () => {
        for (const seed of SEEDS) {
            const state = world(seed);
            for (const stand of standsIn(state)) {
                const place = getLocation(state, String(stand.locationId));
                expect(place).not.toBeNull();
                expect(isAnUndrawnPocket(place!)).toBe(true);
            }
        }
    });

    it('leaves every unit where whoever gets in can pick it up', () => {
        for (const seed of SEEDS) {
            const state = world(seed);
            for (const stand of standsIn(state)) {
                // The exact triple `whatIsStandingFreeAt` looks for, plus the
                // tracked tier, which is what makes it visible to the taking
                // verb at all.
                expect(stand.possessorId).toBeNull();
                expect(stand.ownerId).toBeNull();
                expect(stand.locationId).not.toBeNull();
                expect(isTracked(stand)).toBe(true);
                // And it says which catalog row it is, in the key the beast
                // material rows already use.
                expect(getHerb(String(stand.data.materialId))).toBeDefined();
            }
        }
    });

    it('never stands anything in ground that stopped being shut', () => {
        for (const seed of SEEDS) {
            const state = world(seed);
            const open = state.locations.filter(l => !isAnUndrawnPocket(l));
            for (const place of open) {
                expect(whatThisPocketStillGrows(state.seed, place)).toBeNull();
            }
        }
    });

    it('gives one answer however often a pocket is asked', () => {
        const state = world('alpha');
        for (const place of state.locations) {
            const once = whatThisPocketStillGrows(state.seed, place);
            const twice = whatThisPocketStillGrows(state.seed, place);
            expect(twice?.id ?? null).toBe(once?.id ?? null);
        }
    });

    it('holds one material per pocket and never more than the cap', () => {
        for (const seed of SEEDS) {
            const state = world(seed);
            for (const [, held] of byPocket(state)) {
                expect(new Set(held.map(o => String(o.data.materialId))).size).toBe(1);
                expect(held.length).toBeLessThanOrEqual(MOST_IN_ONE_POCKET);
            }
        }
    });

    it('never lets one pocket fill a chaos formula', () => {
        // The scarcity claim where it bites hardest, and it is structural
        // rather than tuned: every chaos formula names at least two different
        // things at this height, and a pocket holds one. An immortal formula
        // that names one thing twice IS fillable out of a full pocket, which is
        // the intended reward for opening a six-century door.
        for (const seed of SEEDS) {
            const state = world(seed);
            for (const [, held] of byPocket(state)) {
                const materialId = String(held[0].data.materialId);
                const chaosFilled = topFormulas()
                    .filter(r => getPill(r.producesPillId)?.grade === 'chaos')
                    .filter(r => r.ingredients.every(i => {
                        const herb = getHerb(i.itemId);
                        if (!herb) return false;
                        if (herb.grade !== 'immortal' && herb.grade !== 'chaos') return true;
                        return herb.id === materialId && held.length >= i.quantity;
                    }))
                    .map(r => r.id);
                expect(chaosFilled).toEqual([]);
            }
        }
    });
});
