/**
 * "I walk north for three days" set out for a place called *three days*.
 *
 * FOUND BY PLAYING, probing the travel phrasings a player actually types. It is
 * systematic rather than one unlucky sentence - every direction with a length on
 * it lost the direction:
 *
 *     i travel north for a while     ->  move, target "a while"
 *     i walk north for a few days    ->  move, target "a few days"
 *     i head north for three days    ->  move, target "three days"
 *     i go north for a bit           ->  move, target "a bit"
 *
 * ── THE CAUSE IS ONE WORD DOING TWO JOBS ─────────────────────────────────
 *
 * `for` has to be a movement preposition, because *I set out for Clear River
 * Ford* is how people say it. It is also the word everybody says how LONG they
 * are going for. `extractDestination` reads the text after the first movement
 * preposition it finds, so in a sentence with no `to` in it, `for` won the race
 * and the span was handed back as the place.
 *
 * `theNounPhrase` has known how to cut a `for <duration>` tail since it was
 * written, and it was being run - on the CAPTURE. By that point the tail was the
 * whole of the string and there was nothing left to cut back to.
 *
 * So the span comes off the SENTENCE, before any preposition is read, and a
 * time noun is required so that "I set out for Clear River Ford" is untouched.
 *
 * ── AND THE OTHER END OF IT ──────────────────────────────────────────────
 *
 * With the destination gone, "I travel for a while" fell through to
 * `extractSubject`, which reads past `for` in its own right and handed back the
 * same span from the other side. Rather than trim in two places, `cleanPlace`
 * now refuses a phrase that is NOTHING BUT a length of time - which covers every
 * extractor in the file at once, and is anchored whole-string so that a name
 * with a time word in it is untouched.
 *
 * Naming no destination is the honest outcome for that sentence: the caller
 * gets `undefined` and can ask where, which is the right question.
 */

import { describe, it, expect } from 'vitest';

import { cleanPlace, extractDestination } from '../../src/web/sentence-parts';
import { parseIntent } from '../../src/web/verb-pattern-table';

describe('a length of time is not a place', () => {
    it.each([
        ['i travel north for a while', 'north'],
        ['i walk north for a few days', 'north'],
        ['i head north for three days', 'north'],
        ['i go north for a bit', 'north'],
        ['i go south for a season', 'south'],
        ['i go to the mountain for three years', 'mountain']
    ])('%s keeps the destination', (said, place) => {
        expect(parseIntent(said).target).toBe(place);
    });

    /**
     * AND `for` IS STILL A MOVEMENT PREPOSITION. This is the half the fix could
     * have broken, and it is the commonest way of naming a destination there is.
     */
    it.each([
        ['i set out for clear river ford', 'clear river ford'],
        ['i leave for the capital', 'capital'],
        ['i go to clear river ford', 'clear river ford'],
        ['i go to nine seasons hall', 'nine seasons hall']
    ])('%s still names a place', (said, place) => {
        expect(parseIntent(said).target).toBe(place);
    });

    /**
     * AND A SENTENCE THAT NAMES NO PLACE NAMES NO PLACE. Asserted as an absence
     * because the defect was a value invented to fill a hole, and inventing a
     * quieter one would pass every assertion above.
     */
    it('names nothing where only a span was said', () => {
        expect(parseIntent('i travel for a while').target).toBeUndefined();
        expect(extractDestination('i travel for a while')).toBeUndefined();
    });

    /** The whole-string anchor, stated on its own so it cannot be widened. */
    it('refuses a phrase that is only a span, and keeps one that merely contains a time word', () => {
        for (const span of ['a while', 'three days', 'a bit', 'the next season', 'ages']) {
            expect(cleanPlace(span), span).toBeUndefined();
        }
        expect(cleanPlace('Nine Seasons Hall')).toBe('Nine Seasons Hall');
        expect(cleanPlace('Day Market')).toBe('Day Market');
    });

    /**
     * AND THE VERBS THAT ARE ABOUT A SPAN STILL READ IT AS ONE. Nothing here
     * touches duration parsing, and this says so: the same words that stop being
     * a destination are still a length of time to the verbs that spend one.
     */
    it('leaves a span alone where a span is what was asked for', () => {
        expect(parseIntent('i cultivate for three years').days).toBe(1095);
        expect(parseIntent('i sit for a while').days).toBeGreaterThan(0);
    });
});
