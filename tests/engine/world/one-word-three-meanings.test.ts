/**
 * `sealed` on a location meant three things, and two of them met.
 *
 * The design owner settled the vocabulary: SEAL is people, LOCKED is a room,
 * FORBIDDEN is a site. One boolean was carrying all three.
 *
 * `LocationRecord.sealed` is written by `architecture.ts` from
 * `PurposeSpec.sealed` and gets a `data.keyId` two lines later, so it means A
 * LOCKED DOOR. `ambientForLocationOnDay` read it as FORBIDDEN GROUND and
 * returned `sealed_vein` - the richest band in the game, and the only one that
 * carries anybody past ordinal 32 - the moment it was true, before reading any
 * density.
 *
 * Measured on a seeded world: 112 sealed locations, ELEVEN genuine pockets and
 * 101 locked doors, and every one of the 101 reported the best cultivation
 * ground in the world. A treasury was the richest place a cultivator could sit.
 *
 * This is the ratchet. It does not test the fix, it tests the world.
 */

import { describe, expect, it } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { aSealHereMeansAnUndrawnPocket } from '../../../src/engine/world/locations';
import type { WorldState } from '../../../src/engine/world/world-state';

const SEEDS = ['word-a', 'word-b', 'word-c'];
let cached: WorldState[] | null = null;

async function worlds(): Promise<WorldState[]> {
    if (cached) return cached;
    const catalog = await loadCultivationCatalog();
    cached = SEEDS.map(seed => seedWorld({ seed, catalog }).state);
    return cached;
}

describe('a locked door is not rich ground', () => {
    it('and most sealed rows are locked doors, which is why it mattered', async () => {
        for (const state of await worlds()) {
            const sealed = state.locations.filter(l => l.sealed);
            const doors = sealed.filter(l => !aSealHereMeansAnUndrawnPocket(l.kind));
            expect(sealed.length).toBeGreaterThan(0);
            // The great majority. If this ever inverts, the reading below stops
            // being the interesting one and somebody should look again.
            expect(doors.length).toBeGreaterThan(sealed.length / 2);
        }
    });

    it('reads the seal off the KIND, so the flag alone decides nothing', async () => {
        for (const state of await worlds()) {
            for (const place of state.locations.filter(l => l.sealed)) {
                const rich = aSealHereMeansAnUndrawnPocket(place.kind);
                // A vault is a locked door however the flag reads; a ruin is
                // closed ground however the flag reads. The kind answers.
                if (place.kind === 'vault') expect(rich).toBe(false);
                if (place.kind === 'ruin') expect(rich).toBe(true);
            }
        }
    });

    it('and the two are genuinely different sets, not one word twice', async () => {
        let pockets = 0;
        let doors = 0;
        for (const state of await worlds()) {
            for (const place of state.locations.filter(l => l.sealed)) {
                if (aSealHereMeansAnUndrawnPocket(place.kind)) pockets++;
                else doors++;
            }
        }
        // Both are non-empty across the seeds. A world with only one of them
        // would make the distinction untested rather than unnecessary.
        expect(pockets).toBeGreaterThan(0);
        expect(doors).toBeGreaterThan(0);
    });
});

describe('the three words, one per scope', () => {
    it('keeps a locked room and closed ground apart by kind alone', () => {
        // Stated as a table so the vocabulary is readable in one place, and so
        // a new location kind has to decide which side it is on.
        expect(aSealHereMeansAnUndrawnPocket('ruin')).toBe(true);
        expect(aSealHereMeansAnUndrawnPocket('grave')).toBe(true);
        expect(aSealHereMeansAnUndrawnPocket('sealed_domain')).toBe(true);
        expect(aSealHereMeansAnUndrawnPocket('secret_realm')).toBe(true);
        expect(aSealHereMeansAnUndrawnPocket('forbidden_zone')).toBe(true);
        expect(aSealHereMeansAnUndrawnPocket('vein')).toBe(true);
        expect(aSealHereMeansAnUndrawnPocket('cave')).toBe(true);

        expect(aSealHereMeansAnUndrawnPocket('vault')).toBe(false);
        expect(aSealHereMeansAnUndrawnPocket('hall')).toBe(false);
        expect(aSealHereMeansAnUndrawnPocket('chamber')).toBe(false);
    });
});
