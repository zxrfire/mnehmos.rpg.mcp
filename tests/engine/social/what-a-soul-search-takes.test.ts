/**
 * Reading somebody, and the four ways nothing comes back.
 *
 * The capability is gated on a REALM rather than on an art: it opens with the
 * nascent soul and everybody above that line has it. That is what makes the
 * poison pill worth carrying - not a counter to a technique somebody might
 * know, but the standing answer to being taken alive by anybody at all.
 *
 * What is pinned here is mostly what it CANNOT do. A search that generated a
 * fact, raised a whisper into certainty, or read somebody who had already
 * swallowed the pill would each be a different kind of lie, and the last one
 * would quietly cancel the mechanic the whole thing exists for.
 */

import { describe, expect, it } from 'vitest';

import {
    type AMemoryHeld,
    canSearchASoul,
    soulSearchOpensAt,
    TAKEN_OUT_OF_SOMEBODY,
    whatASoulSearchTakes
} from '../../../src/engine/social/what-a-soul-search-takes.js';
import { stageCeilingFor } from '../../../src/engine/social/discovery.js';
import { REALM_TIERS, realmForOrdinal } from '../../../src/engine/cultivation/realms.js';

const WHOLE = { soulState: 'intact', identityContinuity: 1 };
const EMPTIED = { soulState: 'fading', identityContinuity: 0 };

const held = (over: Partial<AMemoryHeld> = {}): AMemoryHeld => ({
    id: 'k1',
    claimKey: 'place:halfwater',
    statement: 'The ledger is under the third floorboard',
    stance: 'knows',
    confidence: 0.9,
    stage: 'known',
    ...over
});

const FOUR = [
    held({ id: 'k1', confidence: 0.9 }),
    held({ id: 'k2', confidence: 0.8 }),
    held({ id: 'k3', confidence: 0.7 }),
    held({ id: 'k4', confidence: 0.6 })
];

describe('who can search a soul at all', () => {
    /**
     * Read off the ladder rather than written as 21. The ladder has been
     * rewritten more than once, and a constant copied out of it is a
     * coincidence maintained by attention.
     */
    it('opens at the nascent soul, wherever the ladder puts it', () => {
        const tier = REALM_TIERS.find(row => row.key === 'nascent_soul')!;
        expect(soulSearchOpensAt()).toBe(tier.ordinalStart);
        expect(canSearchASoul(tier.ordinalStart)).toBe(true);
        expect(canSearchASoul(tier.ordinalStart - 1)).toBe(false);
        expect(realmForOrdinal(tier.ordinalStart - 1).key).not.toBe('nascent_soul');
    });

    /** Everybody above it, not only the realm it opens at. */
    it('is held by everybody above the line', () => {
        for (const tier of REALM_TIERS) {
            const expected = tier.ordinalStart >= soulSearchOpensAt();
            expect(canSearchASoul(tier.ordinalStart), tier.key).toBe(expected);
        }
    });

    /**
     * BELOW THE LINE IS NOT A FAILED ATTEMPT. Two different refusals, and the
     * second is the interesting sentence: not "it did not work" but "there is
     * nothing to do it with".
     */
    it('says the floor is a floor and not a bad result', () => {
        const search = whatASoulSearchTakes({
            searcherOrdinal: soulSearchOpensAt() - 1,
            subjectOrdinal: 1,
            subject: WHOLE,
            held: FOUR
        });
        expect(search.opened).toBe(false);
        expect(search.why).toBe('below_the_line');
        expect(search.took).toEqual([]);
    });
});

describe('what a search takes', () => {
    it('opens a body several realms below entirely', () => {
        const search = whatASoulSearchTakes({
            searcherOrdinal: 40, subjectOrdinal: 1, subject: WHOLE, held: FOUR
        });
        expect(search.opened).toBe(true);
        expect(search.took).toHaveLength(4);
    });

    /** A rung buys HOW MUCH comes across. Never how good it is. */
    it('takes more the wider the gap and never more than they held', () => {
        const at = (searcherOrdinal: number) => whatASoulSearchTakes({
            searcherOrdinal, subjectOrdinal: 1, subject: WHOLE, held: FOUR
        }).took.length;
        const one = at(22);
        const wide = at(40);
        expect(one).toBeGreaterThan(0);
        expect(wide).toBeGreaterThanOrEqual(one);
        expect(wide).toBeLessThanOrEqual(FOUR.length);
    });

    /** A partial read is the strongest of what they had, and is repeatable. */
    it('gives up the same things in the same order every time', () => {
        const once = whatASoulSearchTakes({
            searcherOrdinal: 22, subjectOrdinal: 1, subject: WHOLE, held: FOUR
        });
        const twice = whatASoulSearchTakes({
            searcherOrdinal: 22, subjectOrdinal: 1, subject: WHOLE, held: [...FOUR].reverse()
        });
        expect(once.took.map(r => r.id)).toEqual(twice.took.map(r => r.id));
    });

    /**
     * IT GENERATES NOTHING. Every row out is a row that was in, and neither
     * the stage nor the confidence may exceed what the subject held.
     */
    it('never comes away surer than the person it read', () => {
        const vague = [held({ id: 'k1', stage: 'whisper', confidence: 0.2 })];
        const search = whatASoulSearchTakes({
            searcherOrdinal: 44, subjectOrdinal: 1, subject: WHOLE, held: vague
        });
        expect(search.took).toHaveLength(1);
        expect(search.took[0].stage).toBe('whisper');
        expect(search.took[0].confidence).toBe(0.2);
        // And the id is the row it came out of, so the copy has a provenance.
        expect(search.took[0].id).toBe('k1');
    });

    /**
     * The source is its own kind with a `known` ceiling, or every taken memory
     * would be filed as hearsay. `stageCeilingFor` ends in a `whisper`
     * default, so this is the assertion that catches somebody adding a kind to
     * one file and not the other.
     */
    it('files what it took under a source that can carry it', () => {
        expect(stageCeilingFor(TAKEN_OUT_OF_SOMEBODY)).toBe('known');
    });

    /** Ignorance is the absence of a memory. There is nothing to take. */
    it('does not take somebody not knowing something', () => {
        const search = whatASoulSearchTakes({
            searcherOrdinal: 40,
            subjectOrdinal: 1,
            subject: WHOLE,
            held: [held({ stance: 'ignorant' })]
        });
        expect(search.opened).toBe(false);
        expect(search.why).toBe('nothing_held');
    });

    /** Level with them, nothing opens, and it is a contest rather than a floor. */
    it('does not open somebody standing at the same realm', () => {
        const search = whatASoulSearchTakes({
            searcherOrdinal: 22, subjectOrdinal: 23, subject: WHOLE, held: FOUR
        });
        expect(search.opened).toBe(false);
        expect(search.why).toBe('they_held');
    });
});

describe('and what the pill leaves', () => {
    /**
     * THE ONE THE WHOLE MECHANIC RESTS ON.
     *
     * The poison destroys what a search reads rather than merely stopping the
     * heart, so the answer is a denial and not a race. Built here before the
     * pill exists: when it is added it only has to set the state, and this
     * already knows what an emptied soul reads as.
     */
    it('finds nothing in a soul that has been put out', () => {
        const search = whatASoulSearchTakes({
            searcherOrdinal: 44, subjectOrdinal: 1, subject: EMPTIED, held: FOUR
        });
        expect(search.opened).toBe(false);
        expect(search.why).toBe('nothing_left');
        expect(search.took).toEqual([]);
        // The rows are still filed under their id - death deletes nothing -
        // and that is exactly why the emptiness has to be a state on the
        // person rather than an absence of rows.
        expect(search.heldInAll).toBe(4);
    });

    /** Either half of the state is enough. A pill may do one or both. */
    it('is emptied by a fading soul or by an identity at zero', () => {
        for (const subject of [
            { soulState: 'fading', identityContinuity: 1 },
            { soulState: 'intact', identityContinuity: 0 }
        ]) {
            expect(whatASoulSearchTakes({
                searcherOrdinal: 44, subjectOrdinal: 1, subject, held: FOUR
            }).why, subject.soulState).toBe('nothing_left');
        }
    });

    /** A damaged soul is not an empty one. Only the bottom of the scale ends it. */
    it('still reads a damaged soul', () => {
        const search = whatASoulSearchTakes({
            searcherOrdinal: 44,
            subjectOrdinal: 1,
            subject: { soulState: 'damaged', identityContinuity: 0.4 },
            held: FOUR
        });
        expect(search.opened).toBe(true);
    });
});
