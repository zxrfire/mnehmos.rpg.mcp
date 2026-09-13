/**
 * The glacier province and the grain province put up the same animals.
 *
 * `beastsOnThisGround` took a biome from the day it was written and no caller
 * ever passed one, so every square in the world drew from the whole catalog.
 * Measured on a seeded world before this landed: **one** distinct beast pool
 * across every location there is.
 *
 * These assertions pin the two halves that make that false - that a place
 * resolves to a ground at all, and that different places resolve to different
 * ones - and deliberately do NOT pin which biome any named province is. That is
 * authored content in `src/data/cultivation/regions/`, and pinning it here
 * would be the second copy of it.
 */

import { describe, it, expect } from 'vitest';

import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { whatGroundThisIs } from '../../../src/engine/world/what-ground-a-place-is.js';
import { beastsOnThisGround } from '../../../src/engine/world/hunting-a-spirit-beast.js';
import { BEASTS } from '../../../src/data/cultivation/beasts.js';
import { HERBS, findHerbsForOrdinal } from '../../../src/data/cultivation/herbs.js';

/**
 * The world the game actually plays in.
 *
 * `createWorld` on its own invents six regions with generated names and no link
 * back to the catalog, so it cannot answer what a province is made of and must
 * not be what this file measures. `seedWorld` asks it for none and lays the
 * authored provinces down instead, which is the path every run takes.
 */
async function seeded() {
    return seedWorld({
        seed: 'what-ground', population: 40, catalog: await loadCultivationCatalog()
    }).state;
}

describe('a place is made of something', () => {
    it('answers for every province the catalog seeded', async () => {
        const world = await seeded();
        const regions = world.locations.filter(row => row.kind === 'region');
        expect(regions.length).toBeGreaterThan(0);
        for (const region of regions) {
            expect([region.name, whatGroundThisIs(world, region)?.length ?? 0])
                .toEqual([region.name, expect.any(Number)]);
            expect(whatGroundThisIs(world, region)).not.toBeNull();
        }
    });

    it('gives a settlement the ground of the province it stands in', async () => {
        const world = await seeded();
        const town = world.locations.find(row => row.kind === 'settlement' && row.parentId);
        expect(town).toBeTruthy();
        const parent = world.locations.find(row => row.id === town!.parentId);
        expect(whatGroundThisIs(world, town!)).toEqual(whatGroundThisIs(world, parent!));
    });

    it('lets the kind win, because a cave is a cave whatever province it is in', async () => {
        const world = await seeded();
        const anyRegion = world.locations.find(row => row.kind === 'region')!;
        const cave = makeLocation({
            id: 'a-hole', name: 'A Hole In The Ground', kind: 'cave', parentId: anyRegion.id
        });
        world.locations.push(cave);
        expect(whatGroundThisIs(world, cave)).toEqual(['cave']);
        expect(whatGroundThisIs(world, cave)).not.toEqual(whatGroundThisIs(world, anyRegion));
    });

    it('says nothing for a place hanging off nothing, rather than guessing', async () => {
        const world = await seeded();
        const nowhere = makeLocation({ id: 'nowhere', name: 'Nowhere', kind: 'wilds' });
        world.locations.push(nowhere);
        expect(whatGroundThisIs(world, nowhere)).toBeNull();
    });
});

describe('and the world stops putting up the same animals everywhere', () => {
    it('draws a different pool in different provinces', async () => {
        const world = await seeded();
        const pools = new Set<string>();
        for (const region of world.locations.filter(row => row.kind === 'region')) {
            const pool = beastsOnThisGround({
                sealed: false,
                onAVein: false,
                grounds: whatGroundThisIs(world, region) ?? undefined
            });
            pools.add(pool.map(b => b.id).sort().join(','));
        }
        // The measurement this file exists for. It was 1.
        expect(pools.size).toBeGreaterThan(1);
    });

    it('narrows, rather than handing back the catalog', async () => {
        const world = await seeded();
        const region = world.locations.find(row => row.kind === 'region')!;
        const here = beastsOnThisGround({
            sealed: false, onAVein: false,
            grounds: whatGroundThisIs(world, region) ?? undefined
        });
        expect(here.length).toBeGreaterThan(0);
        expect(here.length).toBeLessThan(BEASTS.length);
    });
});

describe('and what grows on it is the ground too', () => {
    it('offers a different set of herbs in different provinces', async () => {
        const world = await seeded();
        const sets = new Set<string>();
        for (const region of world.locations.filter(row => row.kind === 'region')) {
            const here = findHerbsForOrdinal(
                45, whatGroundThisIs(world, region) ?? undefined
            );
            expect(here.length).toBeGreaterThan(0);
            expect(here.length).toBeLessThan(HERBS.length);
            sets.add(here.map(h => h.id).sort().join(','));
        }
        expect(sets.size).toBeGreaterThan(1);
    });

    it('leaves every province something a Qi Condensation cultivator can pick', async () => {
        // The narrowing is only worth having if it does not close a province.
        //
        // NOT AT ORDINAL ZERO, AND THE WHITE STAIR IS WHY. Its lowest reachable
        // herb sits at 1, which is the province agreeing with its own hazard
        // note - cold that kills a Foundation Establishment cultivator in an
        // afternoon does not leave a beginner picking flowers. What must hold
        // is that anybody who has finished the bottom realm can work anywhere,
        // and that is the assertion.
        const world = await seeded();
        for (const region of world.locations.filter(row => row.kind === 'region')) {
            const reachable = findHerbsForOrdinal(
                12, whatGroundThisIs(world, region) ?? undefined
            );
            expect([region.name, reachable.length > 0]).toEqual([region.name, true]);
        }
    });

    it('opens the province a beginner is actually born in', async () => {
        const world = await seeded();
        const home = world.locations.find(row =>
            row.kind === 'region' && row.tags.includes('home'));
        expect(home).toBeTruthy();
        expect(findHerbsForOrdinal(0, whatGroundThisIs(world, home!) ?? undefined).length)
            .toBeGreaterThan(0);
    });
});
