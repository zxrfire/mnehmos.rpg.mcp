/**
 * "I offer him a deal" came back with the target "him a deal".
 *
 * FOUND BY PLAYING, in the social sweep, and a WRONG name is worse than none: an
 * absent target means whoever is at hand, and `him a deal` means a refusal
 * about somebody who is not standing there.
 *
 * Measured, three ways of putting the same thing to somebody:
 *
 *     "I strike a deal with him"  -> target `him`   (the preposition carried it)
 *     "I offer him a deal"        -> NOBODY
 *     "I make him an offer"       -> NOBODY
 *
 * And a fourth that reached nothing at all:
 *
 *     "I offer him the manual"    -> UNCLEAR
 *
 * ── A DITRANSITIVE VERB PUTS THE PERSON FIRST ────────────────────────────
 *
 * `extractSubject` takes everything after the verb, which is the right read for
 * `negotiate with him` and the wrong one for `offer him a deal`. The repo
 * already has this exact problem solved one verb along: `steal` does not use
 * `extractSubject` either, because a theft is aimed at a person and the sentence
 * is about a thing, so `whoATheftIsAimedAt` reads it instead.
 * `whoIsBeingOfferedSomething` is the same answer for the same reason.
 *
 * Only a pronoun or a capitalised name is taken from the person slot, because
 * `offer the manual` puts a THING there, and a shape that cannot tell the two
 * apart would hand a resolver a book to look for a face in.
 *
 * ── AND OFFERING A THING WAS NOT A SENTENCE ──────────────────────────────
 *
 * The trade intent's word list is `trade|buy|sell|purchase|barter|haggle|market|
 * shop|price`, so "I offer him a trade" worked on the word `trade` and "I offer
 * him the manual" - which names the actual thing - reached nothing.
 *
 * It is a trade and not a gift, and the difference is the verb. `give` asks for
 * nothing back, which is why it opens an account without leverage; an offer is
 * holding a thing out to see what comes the other way. It sits below the price
 * branch, so naming a sum stays a haggle.
 */

import { describe, it, expect } from 'vitest';

import {
    parseIntent,
    whoIsBeingOfferedSomething
} from '../../src/web/verb-pattern-table';

describe('the person an offer is made to', () => {
    it.each([
        ['I offer him a deal', 'him'],
        ['I offer her a deal', 'her'],
        ['I make him an offer', 'him'],
        ['I made Shen Liefeng an offer', 'Shen Liefeng'],
        ['I offer him the manual', 'him'],
        ['I offer Shen Liefeng the manual', 'Shen Liefeng'],
        ['I offer him twenty stones', 'him'],
        ['I offer him my sword', 'him']
    ])('%j is put to %j', (said, who) => {
        expect(parseIntent(said).target).toBe(who);
    });

    /**
     * AND THE SHAPE THAT ALWAYS WORKED STILL WORKS. A preposition carries the
     * person perfectly well and this must not take those sentences over.
     */
    it.each([
        ['I strike a deal with him', 'him'],
        ['I negotiate with him', 'him']
    ])('%j still reaches %j', (said, who) => {
        expect(parseIntent(said).target).toBe(who);
    });

    /**
     * A THING IN THE PERSON SLOT IS STILL A THING. `A_PORTABLE_THING` is the
     * repo's own answer to thing-or-person and both readers of it ask the same
     * question.
     */
    it.each([
        'I offer the manual',
        'I offer my sword',
        'I offer twenty stones'
    ])('%j names nobody, because nobody is named', said => {
        expect(whoIsBeingOfferedSomething(said)).toBeUndefined();
    });

    /**
     * AND A PERSON ALONE IS NOT AN OFFER. Something has to be on the table.
     */
    it.each(['I offer her', 'I make him'])('%j is not an offer of anything', said => {
        expect(whoIsBeingOfferedSomething(said)).toBeUndefined();
    });
});

describe('offering somebody a thing is putting it on the table', () => {
    it.each([
        'I offer him the manual',
        'I offer him my sword',
        'I offer Shen Liefeng the manual'
    ])('%j is a trade', said => {
        const parsed = parseIntent(said);
        expect(parsed.action).toBe('interact');
        expect(parsed.intent).toBe('trade');
    });

    /**
     * NAMING A SUM IS STILL A HAGGLE, which is the branch above this one and
     * owns the counter-offer.
     */
    it('a sum on the table is the haggle it always was', () => {
        const parsed = parseIntent('I offer him twenty stones');
        expect(parsed.action).toBe('interact');
        expect(parsed.intent).toBe('trade');
    });

    /**
     * AND THE VERBS NEXT DOOR KEEP WHAT THEY REACH. `offer` is also an ACTION
     * in this game - the offering made upward to a house - and `make` opens
     * half a dozen sentences that are not offers at all.
     */
    it.each([
        ['I make an offering', 'offer'],
        ['I make an offering to the ancestors', 'offer'],
        ['I give him the manual', 'give'],
        ['I make camp', 'cultivate'],
        ['I make him talk', 'coerce']
    ])('%j stays %s', (said, want) => {
        expect(parseIntent(said).action).toBe(want);
    });
});
