/**
 * A ruin the world was seeded with is somewhere on the map.
 *
 * THE DEFECT. `seedPriorAges` writes the prior ages of history before any province
 * exists, so `locationFromRuin` and `locationFromScar` had no province to name
 * and minted their records with `parentId: null`. The id carries the AGE the
 * house fell in - `ruin-<age>-<n>` - which reads like a province and is not
 * one, so the name said the site was placed while the record said it was
 * nowhere.
 *
 * MEASURED, twelve pinned worlds at day 0, counting locations below the Lid
 * that a province walk reaches: 144 seeded ruins and 65 scars in no province,
 * against hall 4620/4620, precinct 2940/2940, sect_seat 456/456 and every other
 * kind fully placed. Ruins the simulation mints later take the province that
 * found them, which is why the same reading answered 405 of 429 houses at two
 * hundred years and 0 of 456 on the day a run opens.
 *
 * WHAT IT COST. Two callers had already worked around it in place -
 * `findUndiscoveredUnder` let a party from anywhere claim a parentless site,
 * and `foundGroundIn` skipped the province filter for one - and a third,
 * `aFindThisHouseCouldSendFor`, simply found nothing: a house asking what open
 * ground stands in its own province got an empty answer in every world on turn
 * one, because the one prior-age ruin that stands open was in no province to
 * be in. Over the same twelve worlds, houses with open ground in their own
 * province went 0 of 456 to 60 of 456, and at two hundred years the
 * `a_find` occasion went 151 open / 288 offered / 114 escorted to 306 / 596 /
 * 239 (`scripts/probe-what-occasions-a-house-can-offer.ts`, both arms run on
 * one tree).
 *
 * AND THE DAY-0 OCCASION IS STILL ZERO, which is a SECOND gate and not this
 * one. `aFindThisHouseCouldSendFor` also asks whether anybody on the roll has
 * stood on the ground, and `whatStandingOnItGives` reads that off facts sited
 * at a location id. Measured: 0 facts in a fresh world are sited at the ruin
 * that stands open, because the prior ages record a place as free text. That
 * gap is stated in `whatStandingOnItGives` already; it is why this file pins
 * the province half and not the occasion.
 *
 * WHAT IS PINNED. That the seeded past is on the map, that it is on the map by
 * the same province walk everything else uses, and that a house's own province
 * can reach the open ground in it. Not which province anything landed in: there
 * is no fact in the prior ages that says, so the province is drawn, and pinning
 * a draw would pin the stream rather than the rule.
 *
 * RED-CHECKED by removing the `settleTheSeededPastIntoProvinces` call from
 * `seedWorld` and from `createWorld`: four of the five go red, every seeded
 * ruin and scar coming back unplaced and the open-ground reading coming back
 * empty. The fifth is the determinism one, which agrees on two nulls as
 * readily as on two provinces - so it asks for a province first.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { theProvinceAround } from '../../../src/engine/world/ground-holder.js';
import { whereTheOpenGroundIs } from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import type { LocationRecord } from '../../../src/engine/world/locations.js';

const SEEDS = ['stands-0', 'stands-1', 'stands-2'] as const;

/** What the prior ages leave behind, whatever else the world has in it. */
function whatThePriorAgesLeft(locations: readonly LocationRecord[]): LocationRecord[] {
    return locations.filter(l => l.kind === 'ruin' || l.kind === 'scar');
}

describe('what the prior ages left', () => {
    it('stands in a province, in a world the catalog built', () => {
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog: fixtureCatalog(), population: 40 });
            const left = whatThePriorAgesLeft(state.locations);
            expect(left.length).toBeGreaterThan(0);
            const unplaced = left.filter(l => theProvinceAround(state.locations, l.id) === null);
            expect(unplaced.map(l => l.id)).toEqual([]);
        }
    });

    it('stands in a province in a bare world too, which is the other seeding path', () => {
        const state = createWorld({ seed: 'stands-bare', regionCount: 6 });
        const left = whatThePriorAgesLeft(state.locations);
        expect(left.length).toBeGreaterThan(0);
        expect(left.filter(l => theProvinceAround(state.locations, l.id) === null)).toEqual([]);
    });

    /**
     * The parent is a province RECORD on the site's own layer, not an id that
     * happens to be shaped like one. A walk that ends at a missing row and a
     * walk that ends at a region are both non-null to a weaker assertion.
     */
    it('hangs off a province that is really there, on its own layer', () => {
        const { state } = seedWorld({ seed: SEEDS[0], catalog: fixtureCatalog(), population: 40 });
        for (const site of whatThePriorAgesLeft(state.locations)) {
            const province = state.locations.find(l => l.id === theProvinceAround(state.locations, site.id));
            expect(province?.kind).toBe('region');
            expect(province?.layer).toBe(site.layer);
        }
    });

    /**
     * The reading the defect was found through. A house asks what open ground
     * stands in its province; the prior ages open exactly one ruin per world
     * (`openTheShallowestRuin`), and before this it was in none.
     */
    it('puts the one ruin that stands open into some province a house could be seated in', () => {
        for (const seed of SEEDS) {
            const { state } = seedWorld({ seed, catalog: fixtureCatalog(), population: 40 });
            const open = state.locations.filter(l => l.kind === 'ruin' && !l.sealed);
            expect(open.length).toBeGreaterThan(0);

            const ground = whereTheOpenGroundIs(state.locations);
            for (const ruin of open) {
                const province = ground.provinceOf(ruin.id);
                expect(province).not.toBeNull();
                expect(ground.openGroundIn(province!).map(l => l.id)).toContain(ruin.id);
            }
        }
    });

    it('lands in the same province every time the same seed is asked', () => {
        const once = seedWorld({ seed: 'stands-twice', catalog: fixtureCatalog(), population: 40 }).state;
        const twice = seedWorld({ seed: 'stands-twice', catalog: fixtureCatalog(), population: 40 }).state;
        const parents = (state: typeof once): string[] =>
            whatThePriorAgesLeft(state.locations).map(l => `${l.id}:${l.parentId}`);
        // Two nulls agree as readily as two provinces do, so this asks for a
        // province first and for the same one second.
        expect(parents(once).filter(row => row.endsWith(':null'))).toEqual([]);
        expect(parents(once)).toEqual(parents(twice));
    });
});
