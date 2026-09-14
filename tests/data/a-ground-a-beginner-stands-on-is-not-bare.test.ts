/**
 * A player born in Deep Snow Village could gather herbs for the rest of their
 * life and never once come back with anything.
 *
 * Once the played `gather` verb started reading what is underfoot, the herb
 * catalog's shape became visible for the first time. Measured on the seeded
 * world (`seedWorld`, seed `what-ground`), counting places whose grounds offer
 * an ordinal-0 cultivator nothing:
 *
 *     155 of 1,149 locations, and 11 of the 61 places people live in
 *
 * Among them four White Stair villages, both Burial Sands towns, every room of
 * three sect seats, every scar and every ruin. Five biomes of nineteen had
 * anything at all at ordinal 0 and all five were low, temperate, settled
 * ground; `desert` had no row at any rung. A run opening on cold ground was
 * told "the catalog offered nothing within reach at this realm", and would be
 * told that forever, because nothing on cold or high ground opened below Core
 * Formation.
 *
 * After the beginner rows landed: **9 of 1,149, and 0 of 61**. The nine are
 * five spirit veins, Dragonvein Rock, and two squares of open water.
 *
 * ── THE RULE, AND WHY IT HAS TWO HALVES ──────────────────────────────────
 *
 * Filling every ground at ordinal 0 would flatten the map exactly as
 * thoroughly as ignoring the ground did, in the other direction. So barren
 * ground is a statement and it is declared here, with its reason, and both
 * directions are asserted: a declared ground must really be empty at the
 * bottom, and every ground NOT declared must really have something. That is
 * what stops the catalog drifting either way without anybody noticing.
 *
 * The reachability half is the one that matters, and it is the same ratchet
 * `what-ground-a-place-is.test.ts` holds for beasts - no square in the world
 * has nothing living on it. Here: nowhere somebody can be standing offers them
 * nothing, unless every ground under them is one of the declared few.
 */

import { describe, it, expect } from 'vitest';

import { seedWorld } from '../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../src/engine/world/catalog.js';
import { whatGroundThisIs } from '../../src/engine/world/what-ground-a-place-is.js';
import {
    HerbBiomeSchema,
    findOfferedHerbs,
    type HerbBiome
} from '../../src/data/cultivation/herbs.js';

/**
 * Ground that gives a beginner nothing, and why each one is meant to.
 *
 * Not a convenience list: it is the design statement, and the catalog is
 * checked against it rather than read into it.
 */
const NOTHING_AT_THE_BOTTOM: Readonly<Record<string, string>> = {
    abyss: 'A rift is not somewhere a new cultivator stands. Everything in one hangs below daylight and is reached by going down on a rope.',
    sky_island: 'Floating stone is reached by flight, and flight is not a beginner thing. The ground below it is ordinary and has its own rows.',
    spirit_vein: 'A vein whose whole stock is high is a statement about what a vein is worth. If a beginner could work one, nothing would be worth fighting over.',
    deep_forest: 'Gone into rather than stood on, and every province carrying it carries ordinary forest as well, which is where a beginner works.',
    lake_bottom: 'What grows on a lake floor is under the water. Holding your breath that long is the gate, and it is a real one.',
    bamboo_sea: 'One stalk in ten thousand has anything in it. That is the whole character of the place and a beginner row would delete it.'
} as const;

/** The world the game actually plays in, laid down from the authored provinces. */
async function seeded() {
    return seedWorld({
        seed: 'what-ground', population: 40, catalog: await loadCultivationCatalog()
    }).state;
}

describe('what the catalog gives somebody who has just started', () => {
    it('is nothing on exactly the grounds that say so, and something everywhere else', () => {
        const bare: string[] = [];
        const stocked: string[] = [];
        for (const biome of HerbBiomeSchema.options) {
            (findOfferedHerbs(0, biome as HerbBiome).length === 0 ? bare : stocked).push(biome);
        }
        // Both directions. The first catches a ground quietly losing its only
        // beginner row; the second catches somebody closing the gap by filling
        // in all nineteen, which would flatten the map as thoroughly as the
        // bug did.
        expect(bare.sort()).toEqual(Object.keys(NOTHING_AT_THE_BOTTOM).sort());
        for (const biome of stocked) {
            expect([biome, biome in NOTHING_AT_THE_BOTTOM]).toEqual([biome, false]);
        }
    });

    it('says why each barren ground is barren, rather than leaving a gap unlabelled', () => {
        for (const [biome, reason] of Object.entries(NOTHING_AT_THE_BOTTOM)) {
            expect(reason.length, `${biome} is barren and does not say why`).toBeGreaterThan(60);
        }
    });

    it('does not charge more for a weed because the ground it grows on is hard', () => {
        // A herb reachable at ordinal 0 on a glacier is the same humble thing
        // growing somewhere colder. Stated as a comparison rather than a
        // number, because a number here is a figure the next person edits.
        const SETTLED: readonly HerbBiome[] = ['roadside', 'farmland', 'marsh', 'riverbank', 'forest'];
        const atTheBottom = findOfferedHerbs(0);
        const settled = atTheBottom.filter(h => SETTLED.includes(h.biome));
        const hard = atTheBottom.filter(h => !SETTLED.includes(h.biome));
        expect(settled.length).toBeGreaterThan(0);
        expect(hard.length).toBeGreaterThan(0);
        expect(Math.max(...hard.map(h => h.value)))
            .toBeLessThanOrEqual(Math.max(...settled.map(h => h.value)));
    });
});

describe('and nowhere somebody can stand offers them nothing', () => {
    it('leaves no place in the seeded world bare, barring the declared few', async () => {
        // The measurement this arm exists for: 155 of 1,149 locations, and 11
        // of the 61 settlements and seats people live in.
        const world = await seeded();
        const bare = world.locations.filter(row =>
            findOfferedHerbs(0, whatGroundThisIs(world, row) ?? undefined).length === 0);

        for (const row of bare) {
            const grounds = whatGroundThisIs(world, row) ?? [];
            expect(grounds.length, `${row.name} resolves to no ground at all`).toBeGreaterThan(0);
            expect(
                [row.name, grounds.filter(g => !(g in NOTHING_AT_THE_BOTTOM))],
                `${row.name} is bare and is not standing on declared barren ground`
            ).toEqual([row.name, []]);
        }
    });
});
