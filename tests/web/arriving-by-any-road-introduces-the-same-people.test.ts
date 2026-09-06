/**
 * Three of the four ways of arriving introduced nobody.
 *
 * `move` writes three facts on arriving - the place stops being a rumour, the
 * house that holds the ground is written, and the people of your OWN house
 * standing on it become nameable. `arriveAfterSpending`, which is the whole of
 * `ride`, `fold` and `passage`, wrote the first two and returned no `perceived`
 * at all, so none of the three callers could hand any to the turn. The same
 * disciple walking and buying passage to the same ground met different people.
 * That is the "Sword Elder who could not name one person in his own house"
 * defect the `move` comment cites, live on three of the four ways of arriving.
 *
 * ── AND THE FINDING NEXT TO IT WAS NOT ONE ───────────────────────────────
 *
 * The audit also reported `fold` as wrong for declaring its `FoldFix` as
 * `'stood'` or refusing, since `'seen'` has no producer anywhere in `src/`.
 * That is true and it is deliberate: `seen` derived from the sight horizon was
 * built once and measured wrong - the horizon dwarfs the fold range at every
 * rung on the curve, so the check is a no-op and anybody above the floor has a
 * fix on every name they have ever heard.
 * `getting-there-without-walking-it.test.ts` pins that and gives the figures.
 * The door is closed with the reason written on it, so it stays closed.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { getMembersOf } from '../../src/data/cultivation/members';

const HOUSE = 'sect-azure-cloud-pavilion';

/** How many of the house's own roll this cultivator can put a name to. */
function nameable(game: any, holderId: string): number {
    return getMembersOf(HOUSE)
        .filter(member => game.knowledge.isAwareOf(holderId, 'cultivator', member.id))
        .length;
}

describe('who an arrival introduces', () => {
    /**
     * Ridden rather than walked, which is the arrival that shares the helper
     * with `fold` and `passage` and had none of this.
     */
    it('introduces a rider to their own house the way a walk does', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'ride-introduces', worldSeed: 'world-ride-introduces'
        });
        const { cultivator } = await game.newRun('Rider');
        game.repos.sects.addMember(HOUSE, cultivator.id, 3);
        expect(nameable(game, cultivator.id), 'enrolled and already knows them').toBe(0);

        // Somewhere else in the world, read off the world rather than named, so
        // a catalog change moves the place and the test still measures this.
        const here = (cultivator.location ?? '').toLowerCase();
        const elsewhere = ((game as any).atHand?.locations ?? [])
            .map((row: { name: string }) => row.name)
            .find((name: string) => name.toLowerCase() !== here);
        expect(elsewhere, 'the world has nowhere else in it').toBeDefined();

        await game.act(`I ride to ${elsewhere}`);

        const where = (db.prepare('SELECT location FROM cultivators WHERE id = ?')
            .get(cultivator.id) as { location: string }).location;
        expect(where, 'the ride did not arrive').toBe(elsewhere);
        expect(nameable(game, cultivator.id)).toBeGreaterThan(0);
    }, 300_000);
});
