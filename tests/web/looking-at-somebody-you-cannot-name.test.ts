/**
 * POINTING AT SOMEBODY, WITH THE COMMONEST VERB IN THE GAME.
 *
 * `somebodyAtHand` is this repo's one resolver for a person a sentence points
 * at instead of naming, and its own header says every verb aimed at a person
 * goes through it. `investigate` did not. Measured, seven ways of pointing at
 * whoever is in reach:
 *
 *     I greet the nearest person    ->  You go to Ji Tianshi.
 *     I look at the nearest person  ->  You go over Cloud Gate looking for it
 *                                       and nothing here answers to it.
 *
 * The commonest sentence in the game, answered by searching the ground for a
 * person and then calling them "it". One of the seven failed for a second
 * reason: every word of "the person next to me" is already filler in the
 * description reader except `next`.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';

describe('looking at somebody nobody has named', () => {
    it('reaches a face for every way of pointing at one', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'point-at-a-face', worldSeed: 'point-at-a-face', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Zhen Wuxia');
        db.prepare('UPDATE cultivators SET realm_ordinal = 12 WHERE id = ?').run(cultivator.id);
        await game.act('who is here');

        const unreached: string[] = [];
        for (const said of [
            'I look at the nearest person',
            'I look at the closest person',
            'I look at somebody here',
            'I look at the person next to me',
            'I look at the man nearest me',
            'I look at the oldest person here',
            'I look at whoever is closest'
        ]) {
            const answer = await game.act(said) as unknown as { narration: string };
            // The place-shaped refusal, which is what a person-target used to
            // get. Asserted on the refusal rather than on a name, because who
            // is standing there is the world's business and not this test's.
            if (answer.narration.includes('nothing here answers to it')) unreached.push(said);
        }
        expect(unreached, 'a face was searched for as though it were ground').toEqual([]);
    }, 600_000);

    it('still answers about the ground when the ground is what was named', async () => {
        const { game } = await makeGameInWorld({
            seed: 'point-at-ground', worldSeed: 'point-at-ground', worldEnabled: true
        });
        await game.newRun('Zhen Wuxia');
        const answer = await game.act('I look at this place') as unknown as { narration: string };
        expect(answer.narration).not.toContain('nothing here answers to it');
    }, 600_000);
});
