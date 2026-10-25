/**
 * "No road goes there", about a man standing an arm's length away.
 *
 * FOUND BY PLAYING, on the parting - the beat an opening is built around:
 *
 *     "I go back to He Xuxue and kneel before him. Grandfather, I leave with
 *      the caravan tomorrow."
 *
 * The kneel resolved and landed on him. The first clause went to the travel
 * verb, because "go back to <name>" is what the table reads and the table
 * cannot see who is in the room, and the turn was spent on *"No road goes
 * there. Unresolved destination 'He Xuxue'"*.
 *
 * Going back to somebody in the same place is a local approach.
 * Crossing an actual area costs the ordinary fifteen minutes. It is also the sentence people open a
 * parting or an apology with, which is why it is worth a beat rather than a
 * refusal.
 *
 * ── AND IT HAS TO BE THE ENGINE, NOT THE TABLE ───────────────────────────
 *
 * `I go back to He Xuxue` and `I go back to the market` are the same sentence
 * to the reader - both `move/travel` - and nothing in the words separates
 * them. Who is standing here is the world's to know, so the answer is where
 * the world is.
 * Oct11 integration spent the local walking time but could not finish the approach:
 * the spawned sheet had no chosen area, so its sparse placement changed with
 * the hour. This control fixes its meeting area through ordinary standingIn
 * and requires an actual local crossing before measuring its single charge.
 * The replay head's ADMIN can create a native world NPC rather than a SQL
 * sheet. Read the actual added person and pin their meeting through its owner.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { worldLocationFor } from '../../src/web/entities';
import { peopleInThisPlace } from '../../src/web/hearsay';
import { crossToWhoeverTheyNamed } from '../../src/web/walking-across-a-place';
import { routineTime } from '../../src/engine/world/npc-routines.js';

function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

describe('going back to somebody standing here', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    it('crosses to them instead of looking for a road', async () => {
        const { game, repos } = await makeGameInWorld({
            seed: 'crossing', worldSeed: 'parting', adminMode: true
        });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');
        const beforeSpawn = new Set([...game.atHand!.npcs.map(person => person.id),
            ...repos.cultivators.list().map(person => person.id)]);
        await game.act('ADMIN spawn_encounter ordinal=8 name=He Xuxue');

        const body = game.currentRun().cultivator;
        const world = game.atHand!;
        const place = worldLocationFor(world, body.location)!;
        // ADMIN can create a native world person. The actual presence reader,
        // rather than an assumed SQL row or requested name, owns this fixture.
        const people = peopleInThisPlace(repos, body, world, place);
        const person = people.people.find(person => !beforeSpawn.has(person.id));
        expect(person).toBeDefined();
        const meetingArea = people.whereIs.get(person!.id);
        expect(meetingArea).toBeDefined();
        if (repos.cultivators.getById(person!.id)) repos.cultivators.standIn(person!.id, meetingArea!);
        else {
            const native = world.npcs.find(row => row.id === person!.id)!;
            native.activity = { kind: 'talking', note: 'Holding this meeting.', withIds: [body.id],
                sinceDay: routineTime(world), untilDay: routineTime(world) + 1, standingIn: meetingArea! };
            game.theWorldMoved();
        }
        const departure = people.areas.find(area => area.id !== meetingArea && area.for === 'street')!;
        expect(departure).toBeDefined();
        repos.cultivators.standIn(body.id, departure.id);
        expect(crossToWhoeverTheyNamed(game, game.currentRun().cultivator, person!.name, false)).not.toBeNull();

        const before = game.state().run.elapsedDays;
        const done = await game.act(`I go back to ${person!.name}`);

        expect(said(done), said(done)).not.toMatch(/No road goes there/i);
        expect(said(done)).not.toMatch(/Unresolved destination/i);
        expect(said(done)).toContain(person!.name);
        expect(done.toolCalls.some(call => call.name === 'engine.approachUnfinished')).toBe(false);
        expect(game.currentRun().cultivator.standingIn).toBe(meetingArea);
        // A local crossing has one charge and no additional action charge.
        expect(done.toolCalls.filter(call =>
            call.name === 'engine.approachTime' || call.name === 'engine.lesserActionTime')).toHaveLength(1);
        // Replay3's landing-to-well crossing spent six hours. A local approach
        // is fifteen minutes, including when speech follows the walk.
        expect((game.state().run.elapsedDays - before) * 24 * 60, JSON.stringify(done.toolCalls)).toBeCloseTo(15);
    }, 120_000);

    /**
     * AND A NAME NOBODY HERE ANSWERS TO IS STILL A NAME WITH NO ROAD. The
     * refusal above it is doing its job - "I follow the cultivator" once moved
     * a player to a location called `cultivator` and spent the days - and a
     * fix that reached past it would be worse than the defect.
     */
    it('still refuses a name that is nobody standing here', async () => {
        const { game } = await makeGameInWorld({
            seed: 'crossing-miss', worldSeed: 'parting', adminMode: true
        });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');

        const before = game.state().run.elapsedDays;
        const done = await game.act('I go back to Ruan Qifeng of the Ninth Abyss');
        // The refusal has several wordings depending on whether the square is
        // empty and whether the name is one this cultivator has heard of, so
        // what is asserted is that nobody was crossed to and no day was spent.
        expect(said(done)).not.toMatch(/cross to/i);
        expect(game.state().run.elapsedDays - before).toBe(0);
    }, 120_000);
});
