/**
 * A model answered, and the engine printed its own sentences underneath.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS PLAYED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `I talk to the nearest cultivator`, with the local model narrating. It wrote
 * the square, the approach, the person's bearing and their answer - every fact
 * the engine had handed it, in its own words - and then twelve engine sentences
 * followed the prose saying the same things again: the rung, the age, the
 * house, where they were last known to be, and the ways of asking.
 *
 * It is not the model copying. With a scripted provider returning nothing but
 * `PROSE ONLY.` the same block still came back appended, so the concatenation
 * is the engine's.
 *
 * WHAT WAS CONCATENATING: the walked-up-to branch of `interact` built its facts
 * with `factsForAQuestionPutBack`, which puts its lines on `required` so that a
 * narrator cannot reorder a list an ordinal is counted against.
 * `withRequiredLines` then appends whatever of the engine's own wording did not
 * survive into the narration, and the phase-3 prompt orders the model to write
 * every fact again from nothing - so a model doing its job perfectly never
 * carries the engine's wording and gets the whole block stapled under it.
 *
 * The builder was not at fault; the call site was. Nothing in that block is a
 * list anything points into - it is who is standing in front of you and the
 * ways of asking - so it now goes into `prose`, which is what a player with no
 * model reads anyway. That is 591e3a85's ruling for turn 0, which double
 * printed the whole live situation through the same channel.
 *
 * `factsForAQuestionPutBack` keeps `required` where it is answering a question
 * by ordinal, and its header now says which lines may go through it.
 *
 * ── WHY BOTH HALVES ARE HERE ─────────────────────────────────────────────
 *
 * The first assertion alone would pass if the list stopped reaching the player
 * at all, which is the other way to get this wrong: starting a run without a
 * model is a shipping mode, and in it the list is the whole of the answer.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';
import { KnowledgeGate } from '../../src/web/knowledge';

const WORLD = 'people-channel-world';
const RUN = 'people-channel';

/** Prose with none of the engine's wording in it, so an append is visible. */
const NOTHING_THE_ENGINE_SAID = 'The ford runs loud enough to swallow half of it.';

/** Sentences the engine composes about somebody who was walked up to. */
const THE_ENGINE_S_OWN = [
    /is here, and reads as/,
    /They are \d+ years old\./,
    /Last known to be/,
    /could be asked, said the way you would say it/
];

async function somebodyToWalkUpTo(provider?: ScriptedProvider) {
    const harness = await makeGameInWorld({ seed: RUN, worldSeed: WORLD, provider });
    const { cultivator } = await harness.game.newRun('Probe');
    const gate = new KnowledgeGate(harness.db);
    const nameable = harness.game.present(cultivator)
        .filter(row => gate.isAwareOf(cultivator.id, 'cultivator', row.id));
    expect(nameable.length).toBeGreaterThan(0);
    return { ...harness, them: nameable[0].name };
}

describe('a question the engine put back', () => {
    it('is not printed again under prose that already answered it', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"interact"}'],
            narrations: [NOTHING_THE_ENGINE_SAID]
        });
        const { game, them } = await somebodyToWalkUpTo(provider);

        const turn = await game.act(`I talk to ${them}`);

        expect(turn.narration).toContain(NOTHING_THE_ENGINE_SAID);
        for (const said of THE_ENGINE_S_OWN) {
            expect(turn.narration, turn.narration).not.toMatch(said);
        }
    });

    it('is the whole of the answer when no model is configured', async () => {
        const { game, them } = await somebodyToWalkUpTo();

        const turn = await game.act(`I talk to ${them}`);

        for (const said of THE_ENGINE_S_OWN) {
            expect(turn.narration, turn.narration).toMatch(said);
        }
        // The order is what an ordinal is counted against, so it is pinned as
        // an order rather than as a set.
        const ways = turn.narration.indexOf('could be asked');
        expect(turn.narration.indexOf('is here, and reads as')).toBeLessThan(ways);
    });
});
