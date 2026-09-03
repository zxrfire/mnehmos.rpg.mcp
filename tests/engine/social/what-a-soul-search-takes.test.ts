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
    whatASoulSearchCost,
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


/**
 * WHAT IT COSTS THE PERSON WHO WAS READ.
 *
 * The damage is inverse to the gap. That is not the intuitive way round and
 * it is the one the rest of the engine already argues for: a reader barely
 * able to open somebody gets in by tearing, and a reader far above does not
 * have to, because "resolved in one action with nothing contested" is what a
 * sufficiently one-sided event already means here.
 *
 * Measured, for a Nascent Soul reader at ordinal 22:
 *
 *     subject at Core Formation   gap 1   took 1 of 4   forced
 *     subject at Foundation       gap 2   took 2 of 4   forced
 *     subject at Qi Condensation  gap 3   took 4 of 4   opened without forcing
 *     subject at Nascent Soul     gap 0   nothing       they held
 *
 * So the dangerous band is the narrow one just below the reader, which is
 * where players spend their lives. Somebody four realms down is opened like a
 * book and walks away whole; their near-peer does not.
 */
describe('what a soul search cost the person it read', () => {
    /** Core Formation - one realm under a Nascent Soul reader. Forced. */
    const NEAR_PEER = 18;
    /** Qi Condensation - three under. Opened without effort. */
    const FAR_BELOW = 1;

    const searchOf = (
        subjectOrdinal: number,
        subject: { soulState: string; identityContinuity: number } = WHOLE
    ) => whatASoulSearchTakes({ searcherOrdinal: 22, subjectOrdinal, subject, held: FOUR });

    it('tears when the reader is barely able to open them', () => {
        const search = searchOf(NEAR_PEER);
        const paid = whatASoulSearchCost(search, WHOLE);
        expect(paid.because).toBe('forced');
        expect(paid.stepsDown).toBe(1);
        expect(paid.after).toBe('damaged');
    });

    it('leaves no mark when the reader is far enough above', () => {
        const search = searchOf(FAR_BELOW);
        const paid = whatASoulSearchCost(search, WHOLE);
        expect(paid.because).toBe('opened_without_forcing');
        expect(paid.stepsDown).toBe(0);
        expect(paid.after).toBe('intact');
    });

    /**
     * ONE AXIS, TWO CONSEQUENCES. Wherever it tears, the read was partial;
     * wherever it did not, the read was whole. If those bands ever came apart
     * somebody would be taking a full read at a price meant for a partial one.
     */
    it('stops tearing at exactly the gap where it stops taking partial reads', () => {
        const forced: number[] = [];
        const clean: number[] = [];
        for (const subjectOrdinal of [18, 14, 10, 5, 1]) {
            const search = searchOf(subjectOrdinal);
            if (!search.opened) continue;
            const paid = whatASoulSearchCost(search, WHOLE);
            if (paid.because === 'forced') {
                forced.push(search.realmGap);
                expect(search.took.length, `gap ${search.realmGap}`).toBeLessThan(FOUR.length);
            } else {
                clean.push(search.realmGap);
                expect(search.took.length, `gap ${search.realmGap}`).toBe(FOUR.length);
            }
        }
        expect(forced.length).toBeGreaterThan(0);
        expect(clean.length).toBeGreaterThan(0);
        expect(Math.max(...forced)).toBeLessThan(Math.min(...clean));
    });

    /**
     * Nothing got in, so nothing was torn. That covers the floor and it covers
     * somebody who HELD - keeping a reader out is not surviving one.
     */
    it('costs nothing when nothing was opened', () => {
        const below = whatASoulSearchTakes({
            searcherOrdinal: soulSearchOpensAt() - 1,
            subjectOrdinal: FAR_BELOW, subject: WHOLE, held: FOUR
        });
        expect(whatASoulSearchCost(below, WHOLE).because).toBe('nothing_was_opened');

        const held = searchOf(23);
        expect(held.why).toBe('they_held');
        expect(whatASoulSearchCost(held, WHOLE).stepsDown).toBe(0);
    });

    /**
     * READ UNTIL THERE IS NOTHING LEFT.
     *
     * Three forced searches walk somebody from `intact` to `fading` - exactly
     * where the poison pill puts them. The same axis at a different setting,
     * reached by a different road, with no special case at either end. A
     * fourth reader then finds an empty body, through the branch the pill uses.
     */
    it('can be repeated until the soul is going, which is where the pill leads too', () => {
        let state = { soulState: 'intact', identityContinuity: 1 };
        const walked = [state.soulState];

        for (let i = 0; i < 3; i++) {
            const search = searchOf(NEAR_PEER, state);
            expect(search.opened, `search ${i + 1}`).toBe(true);
            state = { ...state, soulState: whatASoulSearchCost(search, state).after };
            walked.push(state.soulState);
        }
        expect(walked).toEqual(['intact', 'damaged', 'fragmented', 'fading']);
        expect(searchOf(FAR_BELOW, state).why).toBe('nothing_left');
    });

    /**
     * HEAVEN DOES NOT GRADE IT. A rescuer reading a captive to find where the
     * children were taken pays the same out of the same soul as an
     * inquisitor. What it was FOR is the ledger's business, not this one's.
     */
    it('charges the same whatever the search was for', () => {
        expect(whatASoulSearchCost(searchOf(NEAR_PEER), WHOLE))
            .toEqual(whatASoulSearchCost(searchOf(NEAR_PEER), WHOLE));
    });

    /** A schema change fails loudly rather than resetting somebody to intact. */
    it('refuses a soul state it has never heard of', () => {
        const cracked = { soulState: 'cracked', identityContinuity: 1 };
        expect(() => whatASoulSearchCost(searchOf(NEAR_PEER, cracked), cracked))
            .toThrow(/Unknown soul state/);
    });
});
