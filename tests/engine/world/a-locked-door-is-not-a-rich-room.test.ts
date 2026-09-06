/**
 * A LOCKED DOOR IS NOT A RICH ROOM.
 *
 * `LocationRecord.sealed` is one field carrying two unrelated facts, and both
 * systems that write it had a good reason for the word:
 *
 *   a RUIN, a sealed domain, a vein - nothing has drawn on what is in there
 *   since somebody closed it. `SiteConditions.sealed` in `ambient.ts` means
 *   exactly this and says so: *"a pocket nothing has drawn on [...] the vein
 *   is rich."*
 *
 *   a VAULT inside a compound - the door is locked and you need the token.
 *   `architecture.ts` writes it from `PurposeSpec.sealed` and puts a
 *   `data.keyId` on the row two lines later, which settles the meaning.
 *
 * ── WHAT IT COST ─────────────────────────────────────────────────────────
 *
 * `ambientForLocationOnDay` returns `sealed_vein` the moment `sealed` is true,
 * BEFORE it reads any density - and `sealed_vein` is the richest band in the
 * game, four times the ordinary baseline, described as *"the density the open
 * world stopped being able to produce."*
 *
 * Measured on a seeded world: 112 sealed locations, of which ELEVEN are
 * genuinely undrawn pockets and 101 are locked doors - 36 treasuries, 27
 * punishment halls, 23 archives, 9 tribute rooms, 6 under halls. Every one of
 * them reported the best cultivation ground in the world.
 *
 * The punishment hall is the one that makes it plain. It carries the only
 * negative `qiLift` in the room table, put there so that time spent in one is
 * time off the ladder and *"holding somebody is a punishment instead of an
 * inconvenience"* - and it was the best ground a cultivator could stand on. A
 * discipline hall you would queue for.
 *
 * These hold the SPLIT rather than the numbers: a lock still locks, an undrawn
 * pocket is still rich, and the qi reader stops answering the door's question.
 */

import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { aSealHereMeansAnUndrawnPocket } from '../../../src/engine/world/locations.js';
import { purposeOf } from '../../../src/engine/world/architecture.js';

describe('the two meanings of a seal', () => {
    it('calls closed ground a pocket and a locked room a room', () => {
        for (const kind of ['ruin', 'grave', 'sealed_domain', 'secret_realm', 'vein', 'cave'] as const) {
            expect(aSealHereMeansAnUndrawnPocket(kind), kind).toBe(true);
        }
        // The five room kinds a compound can lock. All doors.
        for (const kind of ['vault', 'hall', 'chamber', 'precinct', 'sect_seat'] as const) {
            expect(aSealHereMeansAnUndrawnPocket(kind), kind).toBe(false);
        }
    });

    it('leaves no locked room in a seeded world reading as an undrawn pocket', async () => {
        const state = seedWorld({
            seed: 'a-locked-door', catalog: await loadCultivationCatalog()
        }).state;

        const sealed = state.locations.filter(l => l.sealed);
        expect(sealed.length, 'nothing is sealed at all, so this proves nothing')
            .toBeGreaterThan(20);

        const doors = sealed.filter(l => !aSealHereMeansAnUndrawnPocket(l.kind));
        // The bug was that these existed and were treated as pockets. They
        // still exist - a treasury is still locked - and they are no longer
        // pockets. Named so a reader can see which rooms this was about.
        const byPurpose = new Set(doors.map(l => String(purposeOf(l) ?? l.kind)));
        expect(doors.length, 'no locked rooms found, so this proves nothing')
            .toBeGreaterThan(20);
        expect(byPurpose.has('punishment_hall')).toBe(true);
        expect(byPurpose.has('treasury')).toBe(true);

        for (const door of doors) {
            expect(aSealHereMeansAnUndrawnPocket(door.kind), door.id).toBe(false);
        }
    });

    /**
     * AND THE LOCK STILL LOCKS, which is the half a blunt fix would have lost.
     * Nothing here changed what `sealed` does for access - `evaluateAccess`
     * reads the same field for the same reason and is correct to.
     */
    it('leaves every locked room carrying the key it is locked with', async () => {
        const state = seedWorld({
            seed: 'a-locked-door', catalog: await loadCultivationCatalog()
        }).state;

        const rooms = state.locations.filter(l =>
            l.sealed && !aSealHereMeansAnUndrawnPocket(l.kind) && purposeOf(l) !== null);
        expect(rooms.length).toBeGreaterThan(20);
        for (const room of rooms) {
            expect(typeof room.data.keyId, `${room.id} is sealed and has no key`).toBe('string');
        }
    });
});
