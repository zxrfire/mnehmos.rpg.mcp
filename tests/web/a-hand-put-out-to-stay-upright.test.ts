/**
 * Leaning on somebody to stay upright killed the player.
 *
 * FOUND BY PLAYING, and it ended the run. On 7 of 40 after breaking off a fist
 * fight, standing in front of the woman who raised this cultivator:
 *
 *     "I sway, and grab Kong Zhaolu's sleeve to keep from falling"
 *
 * `grab` is an attack verb, so the pattern table read the sentence as a blow.
 * The model made it `coerce`. The cost rule waved that through - correctly by
 * its own lights, because a model may pick a different DANGEROUS verb once the
 * reader without one has already reached a dangerous verb. So the engine
 * pressed her, she answered with a strike for seven, and:
 *
 *     Shen Wuyou is dead (combat_defeat)
 *
 * ── WHERE THE VETO HAD TO GO, AND WHY IT IS NOT IN EITHER READER ──────────
 *
 * Not the model: the model was not the reason this turn became dangerous, the
 * table was, so nothing in
 * `a-model-may-read-differently-but-not-more-expensively` could have caught it.
 * Not the table either: teaching it this sentence teaches it one phrasing, and
 * the next one is written differently. It is the same guard the haggle and the
 * curse already have, in the same place - `carryOut`, on the action whoever
 * produced it - because what makes this safe is not the verb but the STATED
 * PURPOSE of the hand, and the sentence says it outright.
 *
 * THE PURPOSE CLAUSE IS THE ANCHOR AND IT IS REQUIRED. `I grab her sleeve` is
 * untouched and is still an attack, because it is one.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { A_HAND_PUT_OUT_TO_STAY_UPRIGHT } from '../../src/web/what-a-sentence-only-does';
import { ScriptedProvider, makeGameInWorld } from './harness';

function calls(result: unknown): string {
    return ((result as { toolCalls?: { name: string }[] }).toolCalls ?? [])
        .map(c => c.name).join(' ');
}

describe('a hand put out to stay upright', () => {
    /** The played sentence, and the ways the same thing gets typed. */
    it.each([
        "I sway, and grab Kong Zhaolu's sleeve to keep from falling",
        'I catch his arm to steady myself',
        'I grab the rail to stop myself going down',
        'I take her elbow to stay on my feet',
        'I reach for the post so I do not fall',
        'I lean on Kong Zhaolu',
        'I hold the doorframe for support'
    ])('is read as what it says it is, in %j', said => {
        expect(A_HAND_PUT_OUT_TO_STAY_UPRIGHT.test(said)).toBe(true);
    });

    /**
     * AND A HAND THAT WAS NOT PUT OUT FOR BALANCE IS LEFT EXACTLY ALONE. A
     * veto that swallowed these would be worse than the bug it fixes: a player
     * who takes somebody by the throat meant it.
     */
    it.each([
        'I grab her sleeve',
        'I grab him by the throat',
        'I seize her arm and twist it',
        'I take his sword',
        'I hold him down',
        'I catch him with a fist',
        'I grab her and throw her to the ground'
    ])('is not read into %j', said => {
        expect(A_HAND_PUT_OUT_TO_STAY_UPRIGHT.test(said)).toBe(false);
    });
});

describe('and the turn it ended', () => {
    beforeEach(() => { process.env.ADMIN_MODE = 'true'; });
    afterEach(() => { delete process.env.ADMIN_MODE; });

    /**
     * ENGINE-ONLY, which is the table's own reading and the one that was
     * wrong first. No model runs here at all.
     */
    it('does not press the person the sentence reached for', async () => {
        const { game } = await makeGameInWorld({
            seed: 'sleeve', worldSeed: 'sway', adminMode: true
        });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');
        await game.act('ADMIN spawn_encounter ordinal=8 name=Kong Zhaolu');

        const done = await game.act("I sway, and grab Kong Zhaolu's sleeve to keep from falling");
        expect(calls(done)).not.toMatch(/combat|resolveAttempt/);
    }, 120_000);

    /**
     * AND WITH THE MODEL SAYING WHAT IT SAID ON THE DAY. `coerce`, on her, by
     * name - the reading that pressed her.
     */
    it('does not press her when the model calls it a coercion', async () => {
        const { game } = await makeGameInWorld({
            seed: 'sleeve', worldSeed: 'sway', adminMode: true,
            provider: new ScriptedProvider({
                plans: ['{"action":"coerce","target":"Kong Zhaolu"}']
            })
        });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');
        await game.act('ADMIN spawn_encounter ordinal=8 name=Kong Zhaolu');

        const done = await game.act("I sway, and grab Kong Zhaolu's sleeve to keep from falling");
        expect(calls(done)).not.toMatch(/combat|resolveAttempt/);
    }, 120_000);
});
