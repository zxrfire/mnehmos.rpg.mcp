/**
 * Asking what a thing was worth reached nothing, and routing it nearly sold it.
 *
 * FOUND BY PLAYING. Twenty-five money sentences; ten reached nothing. The
 * largest cluster was the commonest money question there is:
 *
 *     "what is this worth"            "what is my sword worth"
 *     "how much for the manual"       "what will he give me for it"
 *     "what does a pill cost"
 *
 * Somebody deciding whether to part with something had no sentence that reached
 * anything at all.
 *
 * ── AND THE ROUTING FIX ALONE WOULD HAVE BEEN WORSE THAN THE GAP ─────────
 *
 * Those sentences are about SELLING, so they route to `sell` - which spends.
 * With only that half in place, a player asking what their sword was worth
 * would have sold it. The asking pass is the other half and is what turns the
 * question back into a quote, and this file pins BOTH: every one of them must
 * reach a read, and none of them may reach `sell`.
 *
 * ── THE WORDS THAT MEAN TWO THINGS ───────────────────────────────────────
 *
 * Three patterns written for this were too greedy, and every one was caught by
 * a test rather than by reading them:
 *
 *   `go for`, `fetch`  - ordinary English. "I go for the man with the spear"
 *                        became a QUESTION and was answered with an assessment
 *                        instead of a fight.
 *   `counter`          - a piece of furniture. "Is there a Span counter here"
 *                        became a haggle, and a counter is precisely where
 *                        somebody goes to buy passage.
 *   `cost`             - "What would a ticket to Iron Ridge cost" is the
 *                        passage counter's question, not a market stall's.
 *
 * And two more have a price reading AND a measuring-up reading, which is the
 * interesting pair: `worth` and `too much`. A thing is worth stones; a person
 * is worth measuring yourself against. Both exemplars belong to `assess` and
 * the table had no pattern for either, so they reached `unclear` until the
 * money pass briefly took them.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

const verb = (said: string) => parseIntent(said).action;

describe('asking what a thing is worth', () => {
    it.each([
        'what is this worth',
        'what is my sword worth',
        'how much for the manual',
        'what will he give me for it',
        'what does a pill cost'
    ])('reaches a read from %j', said => {
        expect(verb(said)).not.toBe('unclear');
    });

    /**
     * THE ONE THAT MATTERS. A question may never spend the thing it asks about.
     */
    it.each([
        'what is this worth',
        'what is my sword worth',
        'how much for the manual',
        'what will he give me for it'
    ])('never sells anything from %j', said => {
        expect(verb(said)).not.toBe('sell');
    });

    it.each(['I sell the herbs', 'I sell my sword', 'I offload the pills'])(
        'still sells from %j', said => {
            expect(verb(said)).toBe('sell');
        });
});

describe('haggling, and what did that pay', () => {
    /**
     * The bare verb worked and the real sentences did not - a counter-offer and
     * a complaint about the asking price, which are what somebody types when
     * they are actually haggling. A number said in WORDS is how people write
     * one, and a digits-only clause missed every instance.
     */
    it.each(['I offer him twenty stones', 'I offer him 20 stones', 'that is too expensive'])(
        'reaches the trade approach from %j', said => {
            expect(verb(said)).toBe('interact');
        });

    it.each(['what did I earn', 'how much did that pay'])(
        'reaches the purse from %j', said => {
            expect(verb(said)).toBe('inventory');
        });

    it('takes a posted job by the word the board uses for it', () => {
        // The board names JOBS. `take ... work` was here and `take the job`
        // was not, so the sentence somebody types after reading it reached
        // nothing.
        expect(verb('I take the job')).toBe('work');
    });
});

describe('the words that mean two things', () => {
    /**
     * EVERY ONE OF THESE WAS A REGRESSION THIS PASS CAUSED AND A TEST CAUGHT.
     * They are pinned here so the next widening has to walk past them.
     */
    it.each([
        ['I go for the man with the spear', 'attack'],
        ['is there a Span counter here', 'passage'],
        ['what would a ticket to Iron Ridge cost', 'passage'],
        ['what runs from the Span counter', 'passage']
    ])('keeps %j with its own verb', (said, want) => {
        expect(verb(said)).toBe(want);
    });

    /**
     * AND THE PAIR WITH TWO HONEST READINGS. A thing is worth stones; a person
     * is worth measuring yourself against. Both of these are `assess`
     * exemplars in `how-a-player-says-each-verb.ts` and neither had a pattern.
     */
    it.each(['what is he worth against me', 'is this place too much for me'])(
        'reads %j as measuring up rather than as a price', said => {
            expect(verb(said)).toBe('assess');
        });

    it('still reads the price versions as prices', () => {
        expect(verb('what is this worth')).toBe('market');
        expect(verb('that is too expensive')).toBe('interact');
    });
});
