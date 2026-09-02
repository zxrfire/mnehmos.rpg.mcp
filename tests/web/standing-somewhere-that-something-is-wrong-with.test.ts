/**
 * Somebody standing where something is wrong with the place, and being told.
 *
 * The area-status layer was complete and had no writer at all, and the read
 * side had just been wired into `investigate` - so the played verb was
 * consulting a permanently empty column and reporting, with total confidence,
 * that nothing was wrong anywhere. This is the other end of that: a world that
 * has been running, a player standing on the ground, and the sentence.
 *
 * It also pins the half of the discovery rule that was missing. `encountered`
 * is the ladder's own word for *they have been in it, so they have the signs*,
 * and the read was capped there without being floored there - so the answer was
 * gated on a knowledge row that nothing grants for standing still. Somebody
 * could walk into a famine and be told the place was fine, over a status that
 * was stopping the food and quadrupling the prices the whole time.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { isStatusRunningOn } from '../../src/engine/world/what-is-true-of-a-place-right-now.js';

const WORLD = 'a-world-that-has-lived';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string; error?: string }

describe('standing somewhere that something is wrong with', () => {
    it('says what is wrong, at the stage standing there buys', async () => {
        const { game } = await makeGameInWorld({ seed: 'wrong-a', worldSeed: WORLD });
        await game.newRun('Walker');
        const say = (s: string) => game.act(s) as Promise<Said>;
        await say('ADMIN set_realm ordinal=20');
        // Let the world get on with its own affairs. Through `advance_days`,
        // which is real time at idle focus - the years have to be LIVED for
        // the world's own passes to run, and a cultivator sitting through them
        // on `cultivate` sometimes does not come out the other side, which is
        // the ladder's business and not this test's.
        await say('ADMIN advance_days years=120');

        const world = (game as unknown as { atHand: {
            currentDay: number;
            statuses: { areaId: string; kind: string }[];
            locations: { id: string; name: string }[];
        } }).atHand;
        const day = Math.floor(world.currentDay);
        const live = world.statuses.filter(
            s => isStatusRunningOn(s as never, day)
        );

        // The world made some. This is the assertion the whole layer rests on:
        // measured before it had a writer, a thousand world-years produced
        // zero rows.
        expect(live.length).toBeGreaterThan(0);

        const somewhere = live
            .map(s => ({ status: s, place: world.locations.find(l => l.id === s.areaId) }))
            .find(row => row.place !== undefined)!;
        expect(somewhere).toBeTruthy();

        await say(`ADMIN move ${somewhere.place!.name}`);
        const looked = await say(`I examine ${somewhere.place!.name}`);
        const said = looked.narration ?? '';

        // The status is in the answer, and so are the signs - which is what
        // `encountered` buys and what standing there has to be worth.
        expect(said.length).toBeGreaterThan(0);
        expect(said).toMatch(/It (has been like this for|started today)/);

        // And the ground reading is there too, because they are two different
        // facts about one place and the seam between them is deliberate: how
        // much is in the ground is a count, and what is TRUE of the place is
        // not derived from any count.
        expect(said).toMatch(/The ground around/);
    }, 900_000);

    it('reads as sentences rather than as a run-on', async () => {
        // Played: "It has been like this for 1455 days. the caravans have
        // stopped and the road east is not being used there are more people
        // sleeping outside the walls than there were". Each sign is its own
        // line and a caller joining them with a space gets a paragraph with no
        // punctuation in it.
        const { game } = await makeGameInWorld({ seed: 'wrong-b', worldSeed: WORLD });
        await game.newRun('Walker');
        const say = (s: string) => game.act(s) as Promise<Said>;
        await say('ADMIN set_realm ordinal=20');
        await say('ADMIN advance_days years=120');

        const world = (game as unknown as { atHand: {
            currentDay: number;
            statuses: { areaId: string; kind: string }[];
            locations: { id: string; name: string }[];
        } }).atHand;
        const day = Math.floor(world.currentDay);
        const live = world.statuses.filter(s => isStatusRunningOn(s as never, day));
        const somewhere = live
            .map(s => world.locations.find(l => l.id === s.areaId))
            .find(place => place !== undefined);
        if (!somewhere) return;

        await say(`ADMIN move ${somewhere.name}`);
        const said = (await say(`I examine ${somewhere.name}`)).narration ?? '';
        // No lower-case letter opening a clause straight after a full stop.
        expect(said).not.toMatch(/\.\s+[a-z]/);
    }, 900_000);
});
