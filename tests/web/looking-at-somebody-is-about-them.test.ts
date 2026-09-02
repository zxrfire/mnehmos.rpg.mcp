/**
 * "I look at <somebody>" must answer about the person, not about the weather.
 *
 * FOUND BY PLAYING. The parser matched `^i looks?\b` and returned a bare
 * `look`, throwing the object of the sentence away, so a player who asked about
 * a face standing in front of them got the ambient band, the recruiting bills
 * and who else was about. That is the deflection failure this repo keeps
 * finding: it reads like an answer and is not one.
 *
 * The routing half is in `actions.ts` - a look with an object reaches
 * `investigate`, which is the verb whose own glossary line says *examine a
 * place, a PERSON, a record, an inscription, an object*, and which is read-only
 * so a misparse cannot spend a day.
 *
 * The half worth testing beyond routing is what the read then SAYS.
 * `docs/world/houses/trust.md` rules that what a reader gets out of a person turns on
 * two independent things about the reader - realm for what they can perceive,
 * worldview for what they have a reference for - and that the two must never be
 * collapsed into one number. Only the first ever reached the played game. The
 * second is `KnowingStage`, and `engine/social/what-a-look-at-somebody-reaches.ts`
 * is the one sentence of it that a look is entitled to.
 *
 * And the ceiling, which is the part `WHAT_GIVES_A_CHANGED_BEAST_AWAY` settles:
 * the deepest thing there is to notice about anybody surfaces in ordinary
 * conversation over time and never in a look. A read that stopped at the rung
 * would invite a narrator to imply there was more in the picture than the
 * engine put there.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent, READ_ONLY_ACTIONS } from '../../src/web/actions';
import {
    whatALookAtSomebodyReaches,
    A_FACE_YOU_HAVE_SOMETHING_BEHIND
} from '../../src/engine/social/what-a-look-at-somebody-reaches';
import { KNOWING_STAGES, isAtLeast } from '../../src/engine/social/discovery';
import { makeGameInWorld, engineCalls } from './harness';

describe('a look with an object in it keeps the object', () => {
    it.each([
        'I look at Shen Wanshi',
        'I look at the elder',
        'I look over the old woman',
        // Not at the head of the sentence, and this one reached nothing at all
        // before: the room read is anchored on `^i looks?`, so every phrasing
        // that did not start with the verb fell through to `unclear`.
        'looking at the stele'
    ])('%s reaches the verb that reads a subject', said => {
        const parsed = parseIntent(said);
        expect(parsed.action).toBe('investigate');
        expect(parsed.target, said).toBeTruthy();
    });

    it('leaves a plain look alone', () => {
        expect(parseIntent('I look around').action).toBe('look');
        expect(parseIntent('I look').action).toBe('look');
        expect(parseIntent('I look for someone').intent).toBe('company');
    });

    /**
     * The scene is not a subject, and this is the guard against the obvious
     * over-reach. "I look at the sky" has an object grammatically and none as
     * far as the world is concerned - there is no sky row - so routing it to
     * the resolver would answer a moment of atmosphere with "nothing here
     * answers to it".
     */
    it.each(['I look at the sky', 'I look at the stars', 'I look at my surroundings'])(
        '%s is still the room', said => {
            expect(parseIntent(said).action).toBe('look');
        }
    );

    it('costs nothing either way', () => {
        // The invariant every parser widening in this repo is checked against.
        expect(READ_ONLY_ACTIONS).toContain('investigate');
        expect(READ_ONLY_ACTIONS).toContain('look');
    });
});

describe('the reference axis is a separate axis and is not a rung', () => {
    /**
     * The charter of `src/engine/social/`, asserted rather than trusted: no
     * query in that directory orders, filters or prioritises people by
     * cultivation. This function takes a stage and a name, and there is nowhere
     * for an ordinal to enter it.
     */
    it('answers from the stage alone', () => {
        for (const stage of KNOWING_STAGES) {
            const read = whatALookAtSomebodyReaches(stage, 'Shen Wanshi');
            expect(read.stage).toBe(stage);
            expect(read.line).toContain('Shen Wanshi');
            expect(read.hasDealtWithThem)
                .toBe(isAtLeast(stage, A_FACE_YOU_HAVE_SOMETHING_BEHIND));
        }
    });

    /**
     * The ceiling is the same sentence at every rung of the ladder, and that is
     * the claim rather than an implementation detail: a look does not get
     * better at the thing a look cannot do.
     */
    it('says the same thing about what a look cannot reach, at every stage', () => {
        const ceilings = new Set(
            KNOWING_STAGES.map(s => whatALookAtSomebodyReaches(s, 'Shen Wanshi').ceiling)
        );
        expect(ceilings.size).toBe(1);
        expect([...ceilings][0]).toMatch(/reference/);
        expect([...ceilings][0]).toMatch(/not in a face/);
    });
});

describe('played, in the mode the defect was found in', () => {
    it('names the person and says what the look could not reach', async () => {
        const { game } = await makeGameInWorld({ seed: 'looked', worldSeed: 'world-looked' });
        await game.newRun('Wen Shuyi');

        const seen = await game.act('I look around');
        const here = /^(.+?)(?:,| and | are here| is here)/.exec(
            seen.narration.split('\n').find(line => / (?:is|are) here\b/.test(line)) ?? ''
        )?.[1];
        expect(here, 'nobody is standing in the opening square').toBeTruthy();

        const read = await game.act(`I look at ${here}`);

        // About them, and not about the place they happen to be standing in.
        expect(read.narration).toContain(here!);
        expect(read.narration, 'still answering with the room')
            .not.toMatch(/The air here gives|ambient/i);
        // The ceiling reached the player. `prose` and not only `lines`: the
        // deterministic narrator ships prose verbatim and would otherwise have
        // dropped it, which is the mode this was found in.
        expect(read.narration).toMatch(/not in a face/);

        // And the mechanical channel carries the rung itself, in the ladder's
        // own words, where an inspector can read it.
        const structure = engineCalls(read).map(c => c.summary).join(' ');
        expect(structure + read.narration).toMatch(/reference axis at stage|nothing behind it yet|stood in front of/);
    }, 200_000);
});
