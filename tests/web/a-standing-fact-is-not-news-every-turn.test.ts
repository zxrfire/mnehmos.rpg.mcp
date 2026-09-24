/**
 * The first turn somewhere describes it in full; every later turn there reminds the player
 * where they are, briefly.
 *
 * FOUND BY PLAYING, against a real local model over six consecutive turns on one island: five
 * opened on the ambient reading in near enough the same words, because the reading was handed
 * over as news every turn. The owner's ruling on the cure: the place is still set on every turn,
 * as a reminder of where the player is - in full the first time, in a clause after that.
 *
 * The reading is never withheld. A cultivator who sits down to draw is acting on it.
 */

import { describe, it, expect } from 'vitest';

import { composeNarrationUser } from '../../src/web/prompt';
import { describeAmbientPerceived } from '../../src/web/facts';
import { makeGame, ScriptedProvider } from './harness';

/** The instruction for a place the player has already been told about. */
const AS_STANDING = /brief reminder of where they are/;
/** The instruction for a place the player has just come to. */
const AS_ARRIVAL = /just arrived here, so open by describing the place in full/;

const FACTS = {
    headline: 'Nothing in particular.',
    lines: ['Nothing in particular happened.'],
    structure: [],
    prose: 'Nothing in particular happened.',
    required: []
} as never;

const SCENE = { place: 'Sweet Spring Island', ambient: 'thin' as const };

describe('the scene header, when the scene has not changed', () => {
    it('asks for the place in full when the caller has not said otherwise', () => {
        // The honest default: a caller that did not track it is treated as never having said
        // it. That covers the first turn of every run.
        const text = composeNarrationUser(FACTS, SCENE);
        expect(text).toContain(describeAmbientPerceived('thin'));
        expect(text).toMatch(AS_ARRIVAL);
        expect(text).not.toMatch(AS_STANDING);
    });

    it('asks for a brief reminder, and still hands the reading over, once they have arrived', () => {
        const text = composeNarrationUser(FACTS, SCENE, { arrived: false, ambientIsNews: false });
        // WITHHOLDING IT WOULD BE THE OTHER BUG. Seclusion, a breakthrough attempt and a
        // decision about where to sit all turn on this reading.
        expect(text).toContain(describeAmbientPerceived('thin'));
        expect(text).toMatch(AS_STANDING);
        expect(text).not.toMatch(AS_ARRIVAL);
    });

    /** Played: eleven days to a town came back as the town, then the road tacked on after it. */
    it('puts the road before the place when the turn was a journey', () => {
        const text = composeNarrationUser(FACTS, SCENE, { arrived: true, ambientIsNews: true, acts: ['move'] });
        expect(text).toContain('The player has just travelled here. Open on the road');
        expect(text).not.toMatch(AS_ARRIVAL);
        // Arriving somewhere without covering ground - a first turn - is the place in full, as before.
        expect(composeNarrationUser(FACTS, SCENE, { arrived: true, ambientIsNews: true })).toMatch(AS_ARRIVAL);
    });

    it('is a place arrived at again when they have moved', () => {
        const text = composeNarrationUser(
            FACTS, { place: 'Sweet Spring Island', ambient: 'spirit_tide' }, { arrived: true, ambientIsNews: true }
        );
        expect(text).toMatch(AS_ARRIVAL);
    });
});

/**
 * And the memory sits at the funnel, which is what makes it hold in play.
 *
 * Five call sites in `turn-engine.ts` reach `narrate`, and none of them knows
 * what the previous one said. The narrator does, because every one of them
 * goes through it.
 */
describe('across turns of an actual run', () => {
    const narrationPrompts = (provider: ScriptedProvider) => provider.calls
        .filter(call => !(call.messages.find(m => m.role === 'system')?.content ?? '')
            .startsWith('You are the intent router'))
        .map(call => call.messages.find(m => m.role === 'user')?.content ?? '');

    it('describes it once and reminds after that, in the same place', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: ['You look around. Nothing has changed.']
        });
        const { game } = makeGame({ seed: 'ambient-repeat', provider });
        await game.newRun('Wen Shu');

        await game.act('I look around');
        await game.act('I look around');
        await game.act('I look around');

        const prompts = narrationPrompts(provider);
        expect(prompts.length, 'three turns should have reached the narrator').toBeGreaterThanOrEqual(3);

        // THE PROPERTY: described once, then reminded. Not described once and then hidden.
        expect(prompts[0]).not.toMatch(AS_STANDING);
        for (const later of prompts.slice(1)) {
            expect(later).toMatch(AS_STANDING);
        }
    });
});
