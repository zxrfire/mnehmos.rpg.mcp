/**
 * The protector's chair is an office with a bar, and most of them are empty.
 *
 * The design is `docs/world/houses/offices-and-succession.md`, "The Protector",
 * and `THE_OFFICE` in `false-immortals.ts`. What is pinned here is that the
 * reader agrees with them:
 *
 *   THE OFFICE EXISTS    one chair per house, whoever is or is not in it. The
 *                        schema's own rule - a declared null is not a missing
 *                        field - is unrepresentable if a house has no chair.
 *   RESERVED IS EMPTY    and empty because nobody meets the bar, which is the
 *                        design owner's ruling: an open office nobody qualifies
 *                        for, the merit bar at a different scale.
 *   ONE PERSON, ONE CHAIR  found by measuring: the strongest rogue in the
 *                        province held four houses at once before the chairs
 *                        were dealt against each other.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { seedWorld } from '../../../src/engine/world/seeding';
import {
    theChairIsHeldForAFalseImmortal,
    theChairsOfTheWorld,
    whatTheChairAsks
} from '../../../src/engine/world/who-stands-over-a-house';
import { APEX_INSTITUTIONS } from '../../../src/data/cultivation/governance-and-water-rights';
import { protectorsOf } from '../../../src/data/cultivation/false-immortals';

const SEEDS = ['chairs-a', 'chairs-b'];

async function world(seed: string) {
    const catalog = await loadCultivationCatalog();
    return seedWorld({ seed, catalog, population: 240 }).state;
}

describe('the chair over a house', () => {
    it('exists for every house, held or not', async () => {
        for (const seed of SEEDS) {
            const state = await world(seed);
            const chairs = theChairsOfTheWorld(state);
            const standing = state.factions.filter(f => f.dissolvedOnDay === null);
            expect(chairs.length, `${seed}: a house with no chair has no office`)
                .toBe(standing.length);
            expect(new Set(chairs.map(c => c.factionId)).size).toBe(standing.length);
        }
    }, 120_000);

    /**
     * The whole point of the reserved post, and the reason it is not a branch:
     * the bar is a False Immortal and there is no False Immortal in post
     * anywhere. `THE_OFFICE` carries that count.
     */
    it('leaves the reserved chairs open, and they are the apexes and the ones that seated one', async () => {
        for (const seed of SEEDS) {
            const state = await world(seed);
            const chairs = theChairsOfTheWorld(state);
            const reserved = chairs.filter(c => c.bar === 'reserved');
            expect(reserved.length, `${seed}: nobody reserves a chair`).toBeGreaterThan(0);
            for (const chair of reserved) {
                expect(chair.heldBy, `${seed}: ${chair.factionId} seated somebody in a reserved chair`)
                    .toBeNull();
                // And it is reserved for one of the two reasons, never a third.
                expect(
                    protectorsOf(chair.factionId).length > 0
                    || APEX_INSTITUTIONS.some(a => a.factionId === chair.factionId)
                ).toBe(true);
            }
            // Every apex reserves one.
            for (const apex of APEX_INSTITUTIONS) {
                if (apex.factionId === null) continue;
                if (!state.factions.some(f => f.id === apex.factionId)) continue;
                expect(theChairIsHeldForAFalseImmortal(apex.factionId), `${apex.name} does not reserve`)
                    .toBe(true);
            }
        }
    }, 120_000);

    it('never seats one person over two houses', async () => {
        for (const seed of SEEDS) {
            const state = await world(seed);
            const held = theChairsOfTheWorld(state)
                .map(c => c.heldBy)
                .filter((id): id is string => id !== null);
            expect(new Set(held).size, `${seed}: somebody is standing over two houses`)
                .toBe(held.length);
        }
    }, 120_000);

    /**
     * A protector adds something the house does not already field, which is
     * what separates the post from a senior elder. Nobody the house could put
     * up itself clears the bar.
     */
    it('asks for more than the house can field on its own', async () => {
        const state = await world(SEEDS[0]!);
        for (const house of state.factions.filter(f => f.dissolvedOnDay === null)) {
            expect(whatTheChairAsks(house))
                .toBeGreaterThan(Number(house.resources.power_ordinal ?? 0));
        }
    }, 120_000);

    it('fills some ordinary chairs and leaves others open', async () => {
        const state = await world(SEEDS[0]!);
        const ordinary = theChairsOfTheWorld(state).filter(c => c.bar === 'ordinary');
        const filled = ordinary.filter(c => c.heldBy !== null).length;
        // Both states have to occur, or the bar is decorative in one direction.
        expect(filled, 'no ordinary chair is ever filled').toBeGreaterThan(0);
        expect(ordinary.length - filled, 'every ordinary chair fills, so the bar decides nothing')
            .toBeGreaterThan(0);
    }, 120_000);
});
