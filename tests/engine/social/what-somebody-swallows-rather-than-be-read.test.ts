/**
 * Somebody about to be read, deciding about their own death.
 *
 * The mechanism is small. What is pinned here is that it is a CHOICE with
 * reasons, and that the engine never spends a life for nothing: three of the
 * five outcomes are a person with a pill in their sleeve declining to take it,
 * and each has a different reason a person could say out loud.
 */

import { describe, expect, it } from 'vitest';

import { SOUL_QUENCHING_PILL_ID } from '../../../src/data/cultivation/pills.js';
import type { AMemoryHeld } from '../../../src/engine/social/what-a-soul-search-takes.js';
import {
    carriesTheQuietPill,
    worthDyingToKeep,
    wouldTheySwallowIt
} from '../../../src/engine/social/what-somebody-swallows-rather-than-be-read.js';

const WHOLE = { soulState: 'intact', identityContinuity: 1 };

const memory = (over: Partial<AMemoryHeld> = {}): AMemoryHeld => ({
    id: 'k1',
    claimKey: 'place:the-cache',
    statement: 'The Pavilion keeps its reserve under the east hall',
    stance: 'knows',
    confidence: 0.9,
    stage: 'known',
    ...over
});

/** A courier at Foundation, taken by somebody far enough above to read them. */
const courier = (over: Partial<Parameters<typeof wouldTheySwallowIt>[0]> = {}) => ({
    carrying: [SOUL_QUENCHING_PILL_ID],
    ordinal: 14,
    soul: WHOLE,
    holds: [memory()],
    readerOrdinal: 40,
    ...over
});

describe('whether somebody swallows it', () => {
    it('takes it when what they carry is worth more than they are', () => {
        const answer = wouldTheySwallowIt(courier());
        expect(answer.swallowed).toBe(true);
        expect(answer.why).toBe('it_is_worth_more_than_they_are');
        expect(answer.wouldHaveLost).toBe(1);
    });

    /** Almost everybody. Not a decision at all. */
    it('does not take a pill nobody gave them', () => {
        const answer = wouldTheySwallowIt(courier({ carrying: [] }));
        expect(answer.swallowed).toBe(false);
        expect(answer.why).toBe('has_none');
    });

    /**
     * A farmhand with a pill in their sleeve does not take it. Nobody dies
     * over gossip, and the rows are what say which this is.
     */
    it('does not take it over something nobody would cross a room for', () => {
        const answer = wouldTheySwallowIt(courier({
            holds: [memory({ stage: 'whisper', confidence: 0.2 })]
        }));
        expect(answer.swallowed).toBe(false);
        expect(answer.why).toBe('nothing_worth_it');
    });

    /**
     * THE ENGINE DOES NOT SPEND A LIFE FOR NOTHING. The search is asked
     * rather than assumed: a captor who could not have opened them leaves
     * nothing to forestall.
     */
    it('does not take it when the search would have failed anyway', () => {
        for (const readerOrdinal of [
            // Below the line - no nascent soul, so not an attempt at all.
            14,
            // A peer, who would have held.
            15
        ]) {
            const answer = wouldTheySwallowIt(courier({ readerOrdinal }));
            expect(answer.swallowed, String(readerOrdinal)).toBe(false);
            expect(answer.why).toBe('the_search_would_have_failed');
            expect(answer.wouldHaveLost).toBe(0);
        }
    });

    /** There is nobody left in there to decide. */
    it('is not taken by somebody already emptied', () => {
        const answer = wouldTheySwallowIt(courier({
            soul: { soulState: 'fading', identityContinuity: 0 }
        }));
        expect(answer.swallowed).toBe(false);
        expect(answer.why).toBe('already_gone');
    });

    /**
     * NO ROLL. The same person in the same situation answers the same way,
     * because a die here would make them a different person on the second run
     * of the same seed for no fact about them.
     */
    it('answers the same way twice', () => {
        expect(wouldTheySwallowIt(courier())).toEqual(wouldTheySwallowIt(courier()));
    });

    /**
     * NO ALIGNMENT AND NO LOYALTY. A righteous courier and a demonic one both
     * swallow it, for the same reason, and neither is braver. There is no
     * input here that could tell them apart, which is the assertion.
     */
    it('has nothing in its inputs that could tell a righteous courier from a demonic one', () => {
        const inputs = Object.keys(courier()).sort();
        expect(inputs).toEqual(
            ['carrying', 'holds', 'ordinal', 'readerOrdinal', 'soul'].sort()
        );
    });
});

describe('what is worth dying to keep', () => {
    /** Being there is what makes it yours, and what makes it dangerous. */
    it('counts what somebody was there for and not what they overheard', () => {
        const kept = worthDyingToKeep([
            memory({ id: 'a', stage: 'known', confidence: 0.9 }),
            memory({ id: 'b', stage: 'placed', confidence: 0.8 }),
            memory({ id: 'c', stage: 'whisper', confidence: 0.9 }),
            memory({ id: 'd', stage: 'known', confidence: 0.3 }),
            memory({ id: 'e', stage: 'known', confidence: 0.9, stance: 'ignorant' })
        ]);
        expect(kept.map(row => row.id)).toEqual(['a', 'b']);
    });

    it('knows the pill by the catalog id and not by a name typed twice', () => {
        expect(carriesTheQuietPill([SOUL_QUENCHING_PILL_ID])).toBe(true);
        expect(carriesTheQuietPill(['pill-qi-gathering'])).toBe(false);
    });
});
