/**
 * WHICH READING AN ENTRY OFFER RUNS ON, AND WHY THE DEFAULT IS WRONG HERE.
 *
 * `whatTheBodyWants` takes an optional `readingOf` and defaults it to
 * `openHandednessOf` - how freely a person parts with what they have, drawn
 * deterministically off their id. That default is correct for the barter and
 * match callers, which ask a body to GIVE SOMETHING UP.
 *
 * An entry offer is not that question, and the wrong answer does not fail
 * loudly. Measured on a four-person roll while wiring the council: an
 * indifferent council read +0.37 purely because the head's id happened to draw
 * high. When the seat followed the leaning that would have seated every
 * walk-up a rung higher. The seat no longer follows it - the owner ruled
 * newcomers in at the bottom rung or as an external elder, by height - but the
 * door still does: a council whose ids happened to draw low would shut the
 * door on a stranger nobody had an opinion of, which is the same regression
 * pointing the other way.
 *
 * So this file pins the two properties that keep it from happening:
 *
 *   AN UNKNOWN STRANGER READS EXACTLY ZERO on the renown axis, and zero is the
 *   ordinary offer. Nobody has heard of them; that is not a mild opinion, it
 *   is the absence of one, and the two must not be confused.
 *
 *   AND THE GENEROSITY DRAW IS NOT ZERO for real ids, in either direction. If
 *   it ever were, this file would pass while asserting nothing.
 */

import { describe, expect, it } from 'vitest';

import { openHandednessOf } from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have';
import { whatTheBodyWants } from '../../../src/engine/social-leverage/what-a-body-wants-is-what-its-deciders-want';
import { entryOfferFor, renownReading } from '../../../src/engine/social-leverage/entry-offer';

const RANKS = ['servant', 'outer', 'inner', 'core', 'elder', 'head'];
const ROLL = [
    { id: 'e1', rankIndex: 4 },
    { id: 'e2', rankIndex: 4 },
    { id: 'e3', rankIndex: 3 },
    { id: 'head', rankIndex: 5 }
];
/** A stranger below the bar for an elder from outside. */
const HOUSE = {
    ranks: RANKS,
    askerOrdinal: 25,
    elderBar: 30
};

const councilOn = (readingOf?: (id: string) => number) => whatTheBodyWants({
    roll: ROLL,
    rankCount: RANKS.length,
    asking: 'me',
    ledger: [],
    asOfDay: 100,
    readingOf
});

describe('the reading an entry offer runs on', () => {
    it('opens the door to an unknown stranger, at the bottom rung', () => {
        const council = councilOn(renownReading([]));
        expect(council.leaning).toBe(0);

        const offer = entryOfferFor({ ...HOUSE, leaning: council.leaning });
        expect(offer.band).toBe('outer_disciple');
        expect(offer.offered).toBe(0);
    });

    it('does not answer the same as the generosity default, which is the trap', () => {
        // The assertion that would have caught the near-miss. If these two ever
        // agree, either the default changed or this roll stopped exercising it,
        // and the guard below says which.
        const renown = councilOn(renownReading([]));
        const generosity = councilOn();
        expect(generosity.leaning).not.toBe(renown.leaning);
    });

    it('keeps the generosity draw non-zero, or this file asserts nothing', () => {
        // `openHandednessOf` is a triangular draw peaked at nought, so a roll
        // could in principle sum to zero and make the test above vacuous.
        const drawn = ROLL.map(p => openHandednessOf(p.id));
        expect(drawn.some(n => n !== 0)).toBe(true);
        // And the specific shape of the near-miss: the head draws high enough
        // on its own to carry an indifferent room into a better band.
        expect(openHandednessOf('head')).toBeGreaterThan(0.15);
    });

    it('still lets a name that travelled badly shut the door', () => {
        // The other half: zeroing the default must not have zeroed the axis.
        const heard = renownReading(
            ROLL.map(p => ({ deciderId: p.id, heard: 3, saidToBe: 'ill spoken of' as const }))
        );
        const council = councilOn(heard);
        expect(council.leaning).toBeLessThan(-0.5);

        const offer = entryOfferFor({ ...HOUSE, leaning: council.leaning });
        expect(offer.band).toBe('closed_door');
        expect(offer.offered).toBeNull();
    });
});
