/**
 * Played: meet something with a core, and the world remembers which one.
 *
 * ── WHAT WAS BROKEN, WALKED END TO END ───────────────────────────────────
 *
 * `whatIsOnThisGround` answers out of the CATALOG, so the hawk somebody spared
 * was one of a count. `ObligationRecord.holderId` is a plain string and would
 * happily point at a beast; nothing ever gave one an id, so there was nothing
 * to hang a favour on - `whoAnswersForTheKill` says so in its own comment,
 * *"NEVER the beast"*. Every link of "I helped a beast and it turned into a
 * person and guarded me" failed at the first one.
 *
 * Two things were also measured while walking it, and both are pinned below:
 *
 *   The mercy vocabulary could not say it. `I spare it` and `I let it go` came
 *   back `unclear` with a fight standing, because every sparing phrasing in
 *   `fight-answers.ts` took a human pronoun and `it` sat in the stop list -
 *   correctly, for "I let the rope go". A beast with a core is a row among the
 *   people and `it` is the only pronoun anybody uses for one, so the bare-stop
 *   half, which only a standing fight consults, now takes it.
 *
 *   The hunt never decides the player was merciful. `hunt` throws everything,
 *   so the resolver returns `lethal` or `withdrawal` and never the `capture`
 *   that means beaten and alive - measured at ordinals 17, 18, 20, 22, 26 and
 *   30 against a Thunder Hawk at 17. A branch reading mercy off a hunt would be
 *   dead code that grades the player.
 *
 * RED-CHECKED. Dropping the row from the hunt fails every assertion here;
 * restoring `it` to the sparing stop list puts the sentence back to `unclear`.
 *
 * The arrangement uses ADMIN because a fixture forty played turns deep goes
 * flaky, and the whole chain after it is played.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { activeWorld } from '../../src/server/state/cultivation-world.js';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import {
    theSpeciesItIs,
    whatItIsNow
} from '../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import { whichWayItPoints } from '../../src/engine/social/grudges.js';

/**
 * PINNED, AND THE PAIR IS THE ARRANGEMENT. The run seed fixes the fight and the
 * world seed fixes the ground under it; at this pair the hunt's own exchange
 * breaks off and leaves the hawk standing, which is the state the sparing needs.
 * At other pairs it is finished where it stands, which is the same engine
 * answering a different roll and is what the last case here is for.
 */
const WORLD = 'spare-a-cored-beast';

let admin: string | undefined;
beforeAll(() => { admin = process.env.ADMIN_MODE; process.env.ADMIN_MODE = 'true'; });
afterAll(() => { if (admin === undefined) delete process.env.ADMIN_MODE; else process.env.ADMIN_MODE = admin; });

async function huntOne() {
    const harness = await makeGameInWorld({ seed: WORLD, worldSeed: `${WORLD}-world`, adminMode: true });
    await harness.game.newRun('Hawk Keeper');
    // High enough to reach a Core Formation beast at all, low enough that
    // taking it is not a foregone conclusion. Arranged, not played.
    await harness.game.act('ADMIN set my realm to 22');
    const hunted = await harness.game.act('I hunt a Thunder Hawk');
    return { ...harness, hunted };
}

async function beastRows() {
    const handle = await activeWorld() as unknown as { state?: { npcs: unknown[] } };
    const world = (handle.state ?? handle) as { npcs: Parameters<typeof theSpeciesItIs>[0][] };
    return world.npcs.filter(npc => theSpeciesItIs(npc) !== null);
}

describe('something with a core is somebody you can spare', () => {
    it('gives the one that was met a row, and the species reads off it', async () => {
        await huntOne();
        const rows = await beastRows() as any[];
        expect(rows).toHaveLength(1);
        const now = whatItIsNow(rows[0])!;
        expect(now.species.id).toBe('beast-thunder-hawk');
        expect(now.band).toBe('tracked');
        // Below the change it is an animal, and the row does not pretend
        // otherwise. What it is NOT is a count.
        expect(now.crossed).toBe(false);
        expect(now.speaks).toBe(false);
        expect(rows[0].locationId).not.toBeNull();
    });

    it('writes one row for the ground, not one for every meeting', async () => {
        const { game } = await huntOne();
        const first = (await beastRows() as any[])[0]!.id;
        await game.act('I hunt a Thunder Hawk');
        const rows = await beastRows() as any[];
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(first);
    });

    it('takes "I spare it" with a fight standing, where it used to go blank', async () => {
        const { game } = await huntOne();
        await game.act('I attack the Thunder Hawk');
        const spared = await game.act('I spare it');

        // THE BLANK LOOK IS THE FAILURE THIS PINS, so it is read off what the
        // player is actually shown rather than off a call name.
        expect(spared.narration).not.toMatch(/does not resolve into anything/i);
        expect(spared.narration).toMatch(/still alive/i);
    });

    it('leaves a favour the thing it was done to is owed, held against the player', async () => {
        const { game, db } = await huntOne();
        await game.act('I attack the Thunder Hawk');
        await game.act('I spare it');

        const beast = (await beastRows() as any[])[0]!;
        expect(beast.status).toBe('alive');

        const ledger = ledgerAbout(db as never, beast.id);
        const spared = ledger.find(r => r.cause === 'spared');
        expect(spared, 'a sparing leaves a favour').toBeDefined();

        // A favour is owed TO its holder - `whichWayItPoints` is the authority
        // on that and is asked rather than assumed, because a reader that gets
        // it backwards tells the player they are owed what they in fact owe.
        const points = whichWayItPoints(spared!);
        expect(points.sense).toBe('owes');
        expect(points.sense === 'owes' && points.owerId).toBe(beast.id);

        // AND BEING SPARED IS NOT BEING FORGIVEN. The other half is the
        // ordinary one a humiliation opens, and it is the beast that holds it.
        const held = ledger.find(r => r.kind === 'grudge' && r.holderId === beast.id);
        expect(held, 'the thing that was beaten holds what was done to it').toBeDefined();
    });

    it('marks the row dead when the thing is killed, so nothing owes anybody', async () => {
        const harness = await makeGameInWorld({
            seed: WORLD, worldSeed: `${WORLD}-world`, adminMode: true
        });
        await harness.game.newRun('Hawk Taker');
        // Far enough above it that the resolver finishes it where it stands.
        await harness.game.act('ADMIN set my realm to 30');
        await harness.game.act('I hunt a Thunder Hawk');

        const rows = await beastRows() as any[];
        expect(rows).toHaveLength(1);
        expect(rows[0].status).not.toBe('alive');
        expect(ledgerAbout(harness.db as never, rows[0].id)).toHaveLength(0);
    });
});
