/**
 * An art could be learned by name and then never practised or aimed by name.
 *
 * FOUND BY PLAYING. Twenty-three sentences about the technique catalog; eleven
 * reached nothing. Two of the misses are the mechanic:
 *
 * PRACTISING ONE. Every branch of the train rule needed an art NOUN - `art`,
 * `technique`, `stance`, `form` - and a proper name has none:
 *
 *     "I practise the sword art"          -> train_technique
 *     "I practise Cross-Meridian Strike"  -> UNCLEAR
 *
 * `learn_technique` accepts a bare name and every catalog art HAS one, so an
 * art could be acquired by name and then never drilled by that name again. The
 * whole 111-art dao catalog was reachable to learn and unreachable to practise.
 *
 * AIMING ONE. Worse, because it failed in two directions at once:
 *
 *     "I attack him with Cross-Meridian Strike"
 *         -> attack, target "him with Cross-Meridian Strike"
 *
 * The art was folded into the person's name, so it resolved to nobody clean AND
 * was never read as an art. `combat-verbs.ts` then called
 * `artTheyWouldFightWith(cultivator)` and picked one on the player's behalf.
 * Naming an art in a fight did nothing at all: the sentence lost it and the
 * engine overrode it. All 41 attack arts were reachable to learn and
 * unreachable to AIM.
 *
 * ── AND A NOTE ON HOW THIS NEARLY SHIPPED BROKEN ─────────────────────────
 *
 * The first cut of the art-name pattern was written through a shell heredoc,
 * which ate `\b` into a literal 0x08 backspace - the fourth time that happened
 * in one session. The regex then silently matched nothing and `withArt` came
 * back undefined while the same source read correctly on screen.
 * `tests/docs/no-control-characters.test.ts` exists for exactly this and would
 * have caught it on the next full run.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

const read = (said: string) => parseIntent(said);

describe('practising an art that has a name', () => {
    it.each([
        'I practise Cross-Meridian Strike',
        'I train Cross-Meridian Strike',
        'I drill Cross-Meridian Strike',
        'I work on Cross-Meridian Strike'
    ])('reaches the drill from %j', said => {
        const got = read(said);
        expect(got.action).toBe('train_technique');
        expect(got.target).toBe('Cross-Meridian Strike');
    });

    /**
     * AND THE NOUN FORMS THAT ALWAYS WORKED STILL DO. The name branch is added
     * beside them rather than instead of them.
     */
    it.each(['I practise the sword art', 'I train my method', 'I drill the stance'])(
        'still reaches the drill from %j', said => {
            expect(read(said).action).toBe('train_technique');
        });

    /**
     * AND IT IS GATED ON A CAPITAL, which is how the catalog spells every art
     * and how a player types one back. Lower case falls through to the noun
     * branches, so the sentences next door are untouched - and two of those are
     * a whole different mechanic, which is what makes the gate worth having.
     */
    it.each([
        ['I train for a month', 'cultivate'],
        ['I work on my cultivation', 'cultivate'],
        ['I practise my breathing', 'cultivate'],
        ['I learn Cross-Meridian Strike', 'learn_technique']
    ])('leaves %j alone', (said, verb) => {
        expect(read(said).action).toBe(verb);
    });
});

describe('aiming an art that has a name', () => {
    /**
     * THE PERSON AND THE ART ARE TWO FACTS AND THE SENTENCE CARRIES BOTH.
     */
    it.each([
        'I attack him with Cross-Meridian Strike',
        'I hit him with Cross-Meridian Strike',
        'I strike him using Cross-Meridian Strike'
    ])('separates who from what in %j', said => {
        const got = read(said);
        expect(got.action).toBe('attack');
        expect(got.target).toBe('him');
        expect(got.withArt).toBe('Cross-Meridian Strike');
    });

    it('keeps a named person as the person', () => {
        const got = read('I attack Bai Wanchen with Cross-Meridian Strike');
        expect(got.target).toBe('Bai Wanchen');
        expect(got.withArt).toBe('Cross-Meridian Strike');
    });

    /**
     * AND A SENTENCE THAT NAMES NO ART CARRIES NONE.
     *
     * "with a sword" and "with the palm art" are not names out of the catalog,
     * and inventing an art from them would be worse than the defect: the engine
     * would be aiming something the player did not choose while appearing to
     * honour a choice they made.
     */
    it.each([
        'I attack him',
        'I run him through',
        'I strike him with the palm art',
        'I attack him with a sword'
    ])('carries no art for %j', said => {
        expect(read(said).withArt).toBeUndefined();
        // And the person still comes out clean, which is the half that was
        // broken before any of this.
        expect(read(said).target).toBeTruthy();
    });
});
