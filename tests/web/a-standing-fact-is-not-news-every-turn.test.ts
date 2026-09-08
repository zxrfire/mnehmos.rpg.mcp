/**
 * The qi is thin. You were told. Stop telling me.
 *
 * FOUND BY PLAYING, against a real local model over six consecutive turns on
 * one island. Five of the six opened on the ambient reading, in near enough the
 * same words each time:
 *
 *   turn 1  "The air here gives very little back. A long sitting yields what a
 *            short one should, and everybody local has stopped remarking on it."
 *   turn 2  "The air of Sweet Spring Island is thin. A long sitting yields only
 *            what a short one should, a fact so ingrained in the locals that
 *            they have stopped mentioning it."
 *   turn 3  "He stands there on Sweet Spring Island, where the air is thin and
 *            stagnant, providing no more to a long sitting than a short one."
 *   turn 4  "The Silver Island Market is a place of thin air..."
 *   turn 5  "The air on Sweet Spring Island is thin..."
 *   turn 6  a time skip, which has no scene header at all
 *
 * Turn 3 is the one that gives it away: the player asked to LOOK AT A PERSON
 * and got a paragraph about the weather first. The model was not being florid.
 * `composeNarrationUser` put the reading on the third line of the prompt every
 * single turn, so it arrived on the first line of the prose every single turn.
 *
 * THIS REPO HAS HAD THIS DEFECT BEFORE AND CURED IT ONCE ALREADY. See
 * `describeStanding`'s header: "the deterministic renderer prints these
 * verbatim, so the same eighteen words arrived under every person in every
 * scene, every turn. A sentence a player has read four times is not atmosphere
 * any more." Same disease, different fact: a STANDING CONDITION handed over as
 * if it were news.
 *
 * The fix is not to withhold it. A cultivator who sits down to draw is acting
 * on the ambient and the narrator has to be able to say what that is like. It
 * is handed over on every turn either way; what changes is whether it is
 * offered as something that just became true.
 */

import { describe, it, expect } from 'vitest';

import { composeNarrationUser } from '../../src/web/prompt';
import { describeAmbientPerceived } from '../../src/web/facts';
import { makeGame, ScriptedProvider } from './harness';

/** The marker the prompt uses to say "you have already been told this". */
const AS_STANDING = /Standing condition, unchanged/;

const FACTS = {
    headline: 'Nothing in particular.',
    lines: ['Nothing in particular happened.'],
    structure: [],
    prose: 'Nothing in particular happened.',
    required: []
} as never;

const SCENE = { place: 'Sweet Spring Island', ambient: 'thin' as const };

describe('the scene header, when the scene has not changed', () => {
    it('offers the reading plainly when the caller has not said otherwise', () => {
        // The honest default: a caller that did not track it is treated as
        // never having said it. That covers the first turn of every run.
        const text = composeNarrationUser(FACTS, SCENE);
        expect(text).toContain(describeAmbientPerceived('thin'));
        expect(text).not.toMatch(AS_STANDING);
    });

    it('marks it as standing, and still hands it over, when it is not news', () => {
        const text = composeNarrationUser(FACTS, SCENE, { ambientIsNews: false });
        // WITHHOLDING IT WOULD BE THE OTHER BUG. Seclusion, a breakthrough
        // attempt and a decision about where to sit all turn on this reading.
        expect(text).toContain(describeAmbientPerceived('thin'));
        expect(text).toMatch(AS_STANDING);
        // And the instruction travels on the same line as the fact, so a model
        // cannot pick up the one without the other.
        const line = text.split('\n').find(l => AS_STANDING.test(l))!;
        expect(line).toContain(describeAmbientPerceived('thin'));
        expect(line).toMatch(/do not open on it/);
    });

    it('is news again when the reading itself changes under them', () => {
        const text = composeNarrationUser(
            FACTS, { place: 'Sweet Spring Island', ambient: 'spirit_tide' }, { ambientIsNews: true }
        );
        expect(text).not.toMatch(AS_STANDING);
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

    it('says it once and marks it standing after that, in the same place', async () => {
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

        // THE PROPERTY: told once, then marked. Not told once and then hidden.
        expect(prompts[0]).not.toMatch(AS_STANDING);
        for (const later of prompts.slice(1)) {
            expect(later).toMatch(AS_STANDING);
        }
    });
});
