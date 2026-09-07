/**
 * `assess` on a person, which is the commonest thing anybody does with the verb
 * and was the one thing it could not do.
 *
 * PLAYED, and the answer was about a different kind of thing entirely:
 *
 *   > I assess He Anwu
 *   cultivation_perception.assess: place_not_known
 *   Nobody has never heard of "He Anwu".
 *
 * He Anwu was standing in the same square, and the very next sentence in the
 * same session read them correctly down to their rank, their spirit root and
 * their open accounts. The verb had exactly two readings - yourself, and the
 * ground under your feet - and anything else named fell through to the ground.
 *
 * The fix routes a person to the read that already exists rather than giving
 * `assess` one of its own: a second account of what somebody looks like would
 * be a second opinion about it.
 *
 * AND THE WORLD IS PINNED. `makeGame` leaves the world to be built by whatever
 * happened first in the process, so which people are standing in the square
 * moves with what ran before - a test that reads "the first name in the answer"
 * is then measuring the file order. `makeGameInWorld` creates it from a named
 * seed. Tests set up their own state.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';

async function inASquareWithSomebody(seed: string) {
    const { game } = await makeGameInWorld({ seed, worldSeed: seed, worldEnabled: true });
    await game.newRun('Nobody');
    await game.act('I look around');
    const here = await game.act('who is here') as unknown as { narration: string };
    const name = /([A-Z]\w+ \w+)/.exec(here.narration)?.[1] ?? null;
    return { game, name };
}

describe('sizing somebody up', () => {
    it('reads the person, not a place nobody has heard of', async () => {
        const { game, name } = await inASquareWithSomebody('assess-a-person');
        expect(name, 'nobody was standing here to assess').not.toBeNull();

        const read = await game.act(`I assess ${name}`) as unknown as {
            narration: string;
            toolCalls: { name: string; summary: string }[];
        };
        const structure = read.toolCalls.map(c => `${c.name} ${c.summary}`).join(' ');

        // Not the place refusal, which is what this used to be.
        expect(structure).not.toMatch(/place_not_known/);
        expect(read.narration).not.toMatch(/never heard of/i);

        // And it is the structural account of a person: where they stand, and
        // what the world holds about them.
        expect(structure).toMatch(/Stands at/);
        expect(structure).toMatch(/Root/);
    }, 300_000);

    it('and still reads the ground when the ground is what was named', async () => {
        // The reading that was already there has to survive the one added
        // beside it. "here" is the ground, and so is a place by name.
        const { game } = await makeGameInWorld({
            seed: 'assess-the-ground', worldSeed: 'assess-the-ground', worldEnabled: true
        });
        await game.newRun('Nobody');
        await game.act('I look around');
        const read = await game.act('I assess this place') as unknown as {
            toolCalls: { name: string; summary: string }[];
        };
        expect(read.toolCalls.some(c => c.name === 'cultivation_perception.assess')).toBe(true);
    }, 300_000);

    it('and still reads the player when nobody is named', async () => {
        const { game } = await makeGameInWorld({
            seed: 'assess-myself', worldSeed: 'assess-myself', worldEnabled: true
        });
        await game.newRun('Nobody');
        await game.act('I look around');
        const read = await game.act('I assess myself') as unknown as {
            toolCalls: { name: string; summary: string }[];
        };
        expect(read.toolCalls.some(c => c.name === 'cultivation_perception.assess')).toBe(true);
    }, 300_000);
});
