/**
 * 道心, played: a cultivator's own past is read at the wall, and they can ask
 * about it before they strike.
 *
 * The mechanic is a JOIN and this is the test that it is actually joined. The
 * obligation ledger has always existed, breakthrough has always existed, and
 * nothing on the breakthrough path had ever read a deed - so the two things
 * asserted here are the two that were missing:
 *
 *   THE READ IS REACHABLE   "what is stopping me" says how much is unfinished,
 *                           before a day is spent and before anything is
 *                           risked. A term a player only learns about from the
 *                           modifier list of the attempt that killed them is a
 *                           term they learn by dying of it.
 *   THE WALL ACTUALLY ASKS  the crossing books the line, off rows the ordinary
 *                           `interact` verbs wrote.
 *
 * Both seeds are pinned. ADMIN is used only to ARRANGE - the rung, the qi in
 * the accumulator, and the reprisals not killing the subject before the wall.
 * Nothing here forces an outcome; the obligations asserted on are the ones the
 * ordinary path wrote.
 */

import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { daoHeartFor } from '../../src/server/consolidated/cultivation-support';
import { makeGameInWorld } from './harness';

/** A realm wall. The dao heart is charged here and at no other rung. */
const AT_A_WALL = 12;

/** Ordinary verbs, none of which is a special case anywhere. */
const WHAT_THEY_DID = ['rob', 'threaten', 'deceive'];

/** ADMIN_MODE is read at call time, so a test can turn it on and put it back. */
function withAdmin(): void {
    const before = process.env.ADMIN_MODE;
    beforeAll(() => { process.env.ADMIN_MODE = 'true'; });
    afterAll(() => {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    });
}

/** Who the game just said was standing here, in the words it used. */
async function whoIsHere(
    game: { act(text: string): Promise<{ narration: string }> }
): Promise<string[]> {
    const look = await game.act('I look around');
    const line = /^(.*?) (?:is|are) here\./m.exec(look.narration);
    if (!line) return [];
    return line[1].split(/,| and /).map(s => s.trim()).filter(Boolean);
}

describe('a cultivator can ask what their own record weighs, and the wall asks too', () => {
    withAdmin();

    it('reports nothing unfinished for somebody who has done nothing', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'dao-heart-clean', worldSeed: 'world-dao-heart', adminMode: true
        });
        const { cultivator } = await game.newRun('Nobody');

        const read = daoHeartFor(db as never, cultivator);
        expect(read.open).toBe(0);
        expect(read.share).toBe(0);

        // And "what is stopping me" does not invent a gate that is not there.
        const ceiling = await game.act('what is stopping me');
        const said = [ceiling.narration, ...(ceiling.structure ?? [])].join('\n');
        expect(said).not.toMatch(/unfinished/i);
    }, 180_000);

    it('answers "what is stopping me" with the record, once there is one', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'dao-heart-record', worldSeed: 'world-dao-heart', adminMode: true
        });
        const { cultivator } = await game.newRun('Climber');
        await game.act(`ADMIN set_realm ${AT_A_WALL}`);

        const neighbours = await whoIsHere(game);
        expect(neighbours.length, 'nobody was standing here to wrong').toBeGreaterThan(0);

        for (const who of neighbours.slice(0, 2)) {
            for (const verb of WHAT_THEY_DID) {
                await game.act(`ADMIN interact I ${verb} ${who}`);
                // Arranging: the reprisals cost the body and a dead cultivator
                // reaches no wall at all.
                await game.act(`ADMIN set_realm ${AT_A_WALL}`);
            }
        }

        const after = daoHeartFor(db as never, cultivator);
        expect(after.open, 'the ordinary verbs wrote no accounts').toBeGreaterThan(0);
        expect(after.share).toBeGreaterThan(0);

        // THE REACHABILITY CLAIM. A sentence a player would type, answered with
        // the same fact the wall is about to charge them for.
        const ceiling = await game.act('what is stopping me');
        const said = [ceiling.narration, ...(ceiling.structure ?? [])].join('\n');
        expect(said).toMatch(/unfinished/i);
        // And the read says the count without publishing the causes.
        expect(said).not.toMatch(/robbery|humiliation|slander/i);
    }, 300_000);

    it('books the line at the wall, off rows the ordinary verbs wrote', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'dao-heart-wall', worldSeed: 'world-dao-heart', adminMode: true
        });
        const { cultivator } = await game.newRun('Striker');
        await game.act(`ADMIN set_realm ${AT_A_WALL}`);

        const neighbours = await whoIsHere(game);
        expect(neighbours.length).toBeGreaterThan(0);
        for (const verb of WHAT_THEY_DID) {
            await game.act(`ADMIN interact I ${verb} ${neighbours[0]}`);
            await game.act(`ADMIN set_realm ${AT_A_WALL}`);
        }
        expect(daoHeartFor(db as never, cultivator).open).toBeGreaterThan(0);

        // Arranged, not decided: the accumulator is filled so the attempt is
        // LEGAL. What the wall then does with it is the engine's.
        await game.act('ADMIN grant_progress fill');
        const struck = await game.act('I attempt a breakthrough');

        const said = [
            struck.narration,
            ...struck.toolCalls.map(c => `${c.name} ${c.summary}`)
        ].join('\n');
        expect(said, 'the crossing did not read the record').toMatch(/dao_heart:\d+_unfinished/);
        expect(said).toContain('engine.whatACrossingAsksOfTheDaoHeart');
    }, 300_000);
});
