/**
 * What somebody can be told about being reached, before they spend the span.
 *
 * Arrivals into an idle span were built on the ruling that sitting still keeps
 * you from giving anybody a reason and does not keep anybody from having one.
 * The machinery was one-directional: the player could be found and had no way
 * to ask about being found, because every input to it was consulted at
 * execution and nowhere else.
 *
 * Two things are asserted here and the first is the constraint rather than the
 * feature: **the read reports the inputs and never the roll.** Reporting what
 * `encountersFor` drew for a span nobody has committed to would hand the player
 * an outcome the engine has not filed, and it would be trivial to do, because
 * that function takes the span length as a parameter and is deterministic.
 */

import { describe, it, expect } from 'vitest';

import {
    locatabilityFrom,
    theArrivalReadFor
} from '../../../src/engine/encounters/arrival-exposure-read';

const read = (over: Partial<Parameters<typeof theArrivalReadFor>[0]> = {}) =>
    theArrivalReadFor({
        placeName: 'The Sounding',
        locatability: 'private',
        heads: 2,
        realmOrdinal: 8,
        ...over
    });

describe('the read is of the inputs, never of the roll', () => {
    /**
     * The load-bearing one. Every line has to be true of the ground whether or
     * not anybody ever sits down, so nothing may read as a prediction that
     * something WILL happen - that is a claim only a resolved span can make.
     */
    it('never says whether anybody will actually come', () => {
        for (const locatability of ['known', 'private', 'hidden'] as const) {
            const said = read({ locatability }).join(' ');
            expect(said, locatability).not.toMatch(
                /\b(?:will (?:arrive|come|find|reach|interrupt)|is going to|expect(?:ed)? to|likely to (?:come|arrive)|chance of)\b/i
            );
        }
    });

    /**
     * No figures, for anybody.
     *
     * `what-you-can-tell-about-the-ground.ts` gates surveyor's numbers behind
     * the rung. This read sidesteps that gate by carrying no numbers at all -
     * a rate or a multiplier is a mechanism, and the narrator is forbidden to
     * state one. The head count is the exception and is a count of people
     * standing there, which the ground read already prints.
     */
    it('states no rate, ratio or multiplier at any rung', () => {
        for (const realmOrdinal of [0, 8, 20, 33, 44]) {
            for (const line of read({ realmOrdinal, heads: 0 })) {
                expect(line, `ordinal ${realmOrdinal}`).not.toMatch(/\d*\.\d+|\d+\s?%|x\s?\d/);
            }
        }
    });

    it('is pure - the same ground reads the same way twice', () => {
        expect(read()).toEqual(read());
    });
});

describe('what it actually tells somebody', () => {
    it('says which of the three kinds of ground this is', () => {
        expect(read({ locatability: 'known' }).join(' ')).toMatch(/know to look/i);
        expect(read({ locatability: 'hidden' }).join(' ')).toMatch(/[Nn]obody knows to look/);
        expect(read({ locatability: 'private' }).join(' ')).toMatch(/would think to look/i);
    });

    /**
     * Being hidden costs as well as buys, and the read has to say so.
     *
     * `SOCIAL_REACH` keeps `hidden` low and not zero for exactly this reason -
     * nothing social reaches you INCLUDING THE HELP - and a read that sold
     * disappearing as free would be advising the dominant strategy the table
     * was tuned to prevent.
     */
    it('says that hiding costs you the help as well as the trouble', () => {
        expect(read({ locatability: 'hidden' }).join(' ')).toMatch(/come to help|the help/i);
    });

    it('says a shut door is the quietest option and is not a ward', () => {
        const said = read().join(' ');
        expect(said).toMatch(/quietest/i);
        expect(said).toMatch(/not silence|gets to the door/i);
    });

    /**
     * The one line that moves with the asker.
     *
     * Hiding a door is a RUNG FILTER rather than a rate cut, so what it buys is
     * a fact about how far up the ladder somebody is standing. The bottom of
     * the ladder has excluded almost nobody; the top has excluded the world.
     * `concealmentScale` is read off the measured band counts, so this is the
     * population pyramid showing up in a sentence.
     */
    it('prices hiding the entrance differently at the bottom and the top', () => {
        const low = read({ realmOrdinal: 0 }).join(' ');
        const high = read({ realmOrdinal: 40 }).join(' ');

        expect(low).toMatch(/would not buy you much/i);
        expect(high).toMatch(/very nearly everybody/i);
        expect(low).not.toBe(high);
    });

    it('counts the people standing here, and says so in the singular too', () => {
        expect(read({ heads: 0 }).join(' ')).toMatch(/[Nn]obody is standing on it with you/);
        expect(read({ heads: 1 }).join(' ')).toMatch(/One person is standing/);
        expect(read({ heads: 5 }).join(' ')).toMatch(/5 people are standing/);
    });

    it('closes by saying what it did not answer', () => {
        // Without this, a player told everything above and given no verdict
        // reads the absence as a promise. The same shape as `request`'s weigh.
        expect(read().at(-1)).toMatch(/says who could/i);
    });
});

describe('locatability, moved down and unchanged', () => {
    it('reads the same five branches off the same columns', () => {
        expect(locatabilityFrom(null, null)).toBe('private');
        expect(locatabilityFrom({ kind: 'wilds', discovered: false }, null)).toBe('hidden');
        expect(locatabilityFrom({ kind: 'settlement' }, null)).toBe('known');
        expect(locatabilityFrom({ kind: 'sect_seat' }, null)).toBe('known');
        expect(locatabilityFrom({ kind: 'wilds' }, null)).toBe('hidden');
        expect(locatabilityFrom({ kind: 'sealed_domain' }, null)).toBe('hidden');
        expect(locatabilityFrom({ kind: 'ruin' }, null)).toBe('private');
    });

    it('counts your own house ground as ground people know to look on', () => {
        expect(locatabilityFrom({ kind: 'ruin', controllingFactionId: 'sect-a' }, 'sect-a'))
            .toBe('known');
        expect(locatabilityFrom({ kind: 'ruin', controllingFactionId: 'sect-a' }, 'sect-b'))
            .toBe('private');
    });
});
