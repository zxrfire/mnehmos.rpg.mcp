/**
 * Coming by something to ride, played.
 *
 * `whatTheyCouldRide` offered exactly two things - your own blade, which
 * cannot be bought, and a tracked craft you own - and there was no way in the
 * game to come to own one. Its own note said as much: everything else in
 * `CONVEYANCES` is a counted holding, and nothing in this engine counted them
 * for a person. So `adjustCountedHolding` had no writer anywhere and the
 * counted tier existed as a type and never as a thing anybody held.
 *
 * Played and reported before this:
 *
 *   > I buy a horse   -> "a thing that is not sold"
 *
 * over an animal the price board has carried since it was written, at fourteen
 * stones, described there as the single largest purchase most mortals ever
 * make.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';

const WORLD = 'something-to-ride';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string; error?: string }

async function withAPurse(seed: string) {
    const { game, db } = await makeGameInWorld({ seed, worldSeed: WORLD });
    await game.newRun('Rider');
    const say = (s: string) => game.act(s) as Promise<Said>;
    return { game, db, say };
}

describe('coming by something to ride', () => {
    it('sells a mule to somebody who asked for a horse', async () => {
        // If a near-synonym works, the phrasing that fails is a bug. The board
        // calls it a mule and a person says horse.
        const { say } = await withAPurse('ride-a');
        const bought = await say('I buy a horse');
        expect(bought.narration ?? '').not.toMatch(/thing that is not sold/);
        expect(bought.narration ?? '').toMatch(/spirit stones?/);
    }, 300_000);

    it('takes the money and puts the thing in the yard', async () => {
        const { say, db } = await withAPurse('ride-b');
        const before = (db as unknown as { prepare(q: string): { get(): { spirit_stones: number } } })
            .prepare('SELECT spirit_stones FROM cultivators LIMIT 1').get().spirit_stones;
        await say('I buy a mule');
        const after = (db as unknown as { prepare(q: string): { get(): { spirit_stones: number } } })
            .prepare('SELECT spirit_stones FROM cultivators LIMIT 1').get().spirit_stones;
        expect(after).toBeLessThan(before);

        // Counted, and not tracked. A carriage leaving somebody is a number
        // going down by one; there is nothing to recognise and nobody to be
        // asked about it, which is why it is arithmetic on a holding rather
        // than a row with a provenance chain.
        const rows = (db as unknown as { prepare(q: string): { all(): { item_id: string; quantity: number }[] } })
            .prepare("SELECT item_id, quantity FROM cultivator_pouch WHERE item_id LIKE 'conv-%'")
            .all();
        expect(rows).toHaveLength(1);
        expect(rows[0].quantity).toBe(1);
    }, 300_000);

    it('says what is in the yard when asked what you have', async () => {
        // The same defect this file records having found twice before - a
        // granted artifact and a bought manual, both real rows that no
        // sentence a player could type could see. A write nobody can read is
        // indistinguishable from a write that did not happen.
        const { say } = await withAPurse('ride-c');
        await say('I buy a horse');
        const held = await say('what am I carrying');
        expect(held.narration ?? '').toMatch(/In the yard/);
        expect(held.narration ?? '').not.toMatch(/Nothing in the pouch at all/);
    }, 300_000);

    it('puts it under them on the road, and the road is shorter for it', async () => {
        // The whole point of the counted tier, and the thing `whatTheyCouldRide`
        // could not previously offer anybody.
        // Same seed both arms, so the road is the same road and the only
        // thing that differs is what is under them.
        const { say } = await withAPurse('ride-d');
        const walked = await say('I ride to Nine Peaks');
        expect(walked.narration ?? '').toMatch(/^On foot/);

        const { say: say2 } = await withAPurse('ride-d');
        await say2('I buy a horse');
        const rode = await say2('I ride to Nine Peaks');
        expect(rode.narration ?? '').not.toMatch(/^On foot/);
        expect(rode.narration ?? '').toMatch(/broken spirit beast/i);
    }, 300_000);

    it('does not take a carriage to mean the fixed rate for moving a corpse', async () => {
        // `resolvePrice` matched "carriage" to Carriage of a body and quoted a
        // funeral rate at somebody buying a cart. A whole word against a closed
        // list is stronger evidence than a prefix against a name.
        const { say } = await withAPurse('ride-f');
        const asked = await say('I buy a carriage');
        expect(asked.narration ?? '').not.toMatch(/Carriage of a body|per stage/i);
        expect(asked.narration ?? '').toMatch(/Cart/);
    }, 300_000);
});
