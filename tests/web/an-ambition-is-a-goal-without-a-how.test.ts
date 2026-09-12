/**
 * An ambition is a known goal with an unknown how.
 *
 * FOUND BY MEASURING. `cultivate` refused 24 of 24 turns in a probe run, and
 * every one was the no-method gate. Two of the four sentences that reached it
 * were not acts at all - "I want to get stronger", "I want to be the strongest".
 * They matched no pattern, so the embedding tier guessed, and it guessed
 * `cultivate`: a player asking where to begin was told that beginning was
 * impossible.
 *
 * The design owner: an ambition is *"literally unclear - you know the goal but
 * you don't know HOW"*, and the answer should be the character turning it over
 * and weighing what they know of. That is the read `unclear` already runs for
 * "what can I do here", so the sentence belongs to it.
 *
 * And the standing rule it comes from: THERE IS ALWAYS A CALL, AND THERE IS NOT
 * ALWAYS AN ACT THAT BURNS A TURN.
 */

import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { ASKING_WHAT_IS_POSSIBLE } from '../../src/web/what-is-worth-doing-standing-here';
import { makeGameInWorld } from './harness';

/** Wishes. None of these names an act. */
const AMBITIONS = [
    'I want to get stronger',
    'I want to be the strongest',
    'I need to get stronger',
    'I want to advance',
    'I want to find a master',
    'how do I begin'
];

/** Acts. These still name one, and must not be swallowed. */
const ACTS = [
    'I sit down',
    'I sit and cultivate',
    'I meditate'
];

describe('an ambition is a goal without a how', () => {
    it('reads a wish as the question about what would work', () => {
        for (const said of AMBITIONS) {
            expect(ASKING_WHAT_IS_POSSIBLE.test(said), said).toBe(true);
        }
    });

    it('still lets a sentence that names an act take it', () => {
        for (const said of ACTS) {
            expect(parseIntent(said).action, said).toBe('cultivate');
        }
    });

    /**
     * The whole point: the answer is the things that WOULD serve, not a gate
     * saying the thing they did not ask for is unavailable.
     */
    it('answers with what is live rather than with the no-method gate', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'nine-peaks', worldEnabled: true });
        await game.newRun('Shen Wuyou');
        const out = await game.act('I want to get stronger') as { narration?: string };
        const said = out.narration ?? '';

        // The live things, which is the answer. The no-method line may ride
        // along - it is WHY, and saying why beside what would fix it is the
        // point - but it must not be the whole of the turn, which is what the
        // cultivate gate gave.
        expect(said).toMatch(/what is live for you/i);
        expect(said).toMatch(/I travel to|teach me|what is posted/);
    }, 120_000);

    /** A read spends nothing. There is always a call; not always an act. */
    it('costs the player no time', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'nine-peaks', worldEnabled: true });
        const { cultivator } = await game.newRun('Shen Wuyou');
        const before = game.state().cultivator.age;
        await game.act('I want to get stronger');
        expect(game.state().cultivator.age).toBe(before);
        expect(cultivator).toBeDefined();
    }, 120_000);
});
