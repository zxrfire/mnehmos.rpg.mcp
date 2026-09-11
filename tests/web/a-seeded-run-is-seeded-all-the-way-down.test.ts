/**
 * A run pinned to a seed was not pinned, because two ids were random.
 *
 * FOUND AS A FLAKY SUITE, which is the worst way to find anything.
 * `forcing-an-attempt-to-land.test.ts` spawns a Nascent Soul on seed `theft-1`,
 * has a Qi Condensation cultivator steal from them without the force, and
 * asserts that it is refused. It passed for a long time. On a full-suite run it
 * came back:
 *
 *     486 spirit stones off Yun Shizhen, out of the 900 they were carrying.
 *
 * The test's own comment states the odds: *"ordinary play reaches it about one
 * time in fifty"*. It reached it.
 *
 * ── AN ID IS NOT ONLY A LABEL ────────────────────────────────────────────
 *
 * `spawn_encounter` derives everything about the person it makes from
 * `run.seed` and a nonce - the spirit root, the attributes, the house. Two
 * lines did not: `opponentId` and `siteId` were `randomUUID()`.
 *
 * And an opponent's id is part of an RNG STREAM NAME. `resolveAttempt` draws
 * from `forStream(run.seed, 'social_leverage', day, party.id)`, so every roll
 * ever made against a spawned encounter came from a stream nobody could name
 * twice. Seeding the run seeded the body and left the dice loose.
 *
 * ── WHY THIS IS WORTH ITS OWN FILE ───────────────────────────────────────
 *
 * A test that reads as deterministic and is not is worse than a slow one,
 * because it teaches everybody to re-run the suite until it is green. That
 * habit is how a real crash in `askAround` sat behind an intermittent failure
 * long enough to look like flakiness rather than a `TypeError` on every seed
 * that reached it.
 *
 * So what is pinned here is not the theft. It is that a seeded run produces the
 * same person twice, down to the id, because that is the property the rolls
 * downstream are built on.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { makeGame } from './harness';

/**
 * `isAdminModeEnabled` reads `process.env` at call time, so the spawn verb
 * needs it set for the whole file. Put back afterwards, the same way
 * `forcing-an-attempt-to-land.test.ts` does it.
 */
let adminBefore: string | undefined;
beforeAll(() => {
    adminBefore = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
});
afterAll(() => {
    if (adminBefore === undefined) delete process.env.ADMIN_MODE;
    else process.env.ADMIN_MODE = adminBefore;
});

/** Spawn one encounter on a named seed and report the ids the world now holds. */
async function spawnOn(seed: string): Promise<{ npcId: string; name: string }> {
    const { game, db } = makeGame({ adminMode: true, seed });
    await game.newRun('Shen Yuan');
    await game.act('ADMIN spawn_encounter ordinal=29 name=Yun Shizhen');
    const row = db
        .prepare("SELECT id, name FROM cultivators WHERE name = 'Yun Shizhen' LIMIT 1")
        .get() as { id: string; name: string } | undefined;
    expect(row, 'the spawn produced nobody').toBeDefined();
    return { npcId: row!.id, name: row!.name };
}

describe('the same seed makes the same person', () => {
    it('gives a spawned encounter the same id twice', async () => {
        const once = await spawnOn('theft-1');
        const twice = await spawnOn('theft-1');
        expect(twice.npcId).toBe(once.npcId);
    }, 120_000);

    /**
     * AND A DIFFERENT SEED MAKES A DIFFERENT ONE. Without this, the assertion
     * above would pass against an id that is simply constant, which would put
     * every run in the game on one RNG stream.
     */
    it('gives a different seed a different id', async () => {
        const here = await spawnOn('theft-1');
        const elsewhere = await spawnOn('theft-2');
        expect(elsewhere.npcId).not.toBe(here.npcId);
    }, 120_000);

    /**
     * AND IT IS STILL SHAPED LIKE A UUID. The id replaced a `randomUUID()` and
     * is stored, logged and passed around exactly where that value was, so the
     * shape is part of the contract: nothing downstream should be able to tell
     * a derived id from a random one.
     */
    it('is shaped like the uuid it replaced', async () => {
        const { npcId } = await spawnOn('theft-1');
        expect(npcId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
    }, 120_000);

    /**
     * AND TWO SPAWNS IN ONE RUN ARE TWO PEOPLE. The nonce is the count of
     * cultivators already in the run, which is what keeps the derivation from
     * collapsing every encounter onto one id - and one id would be a far worse
     * bug than the random one it replaced.
     */
    it('gives two spawns in one run different ids', async () => {
        const { game, db } = makeGame({ adminMode: true, seed: 'two-spawns' });
        await game.newRun('Shen Yuan');
        await game.act('ADMIN spawn_encounter ordinal=29 name=Yun Shizhen');
        await game.act('ADMIN spawn_encounter ordinal=29 name=Mo Anzhi');
        const rows = db
            .prepare("SELECT id FROM cultivators WHERE name IN ('Yun Shizhen', 'Mo Anzhi')")
            .all() as { id: string }[];
        expect(rows).toHaveLength(2);
        expect(rows[0]!.id).not.toBe(rows[1]!.id);
    }, 120_000);
});
