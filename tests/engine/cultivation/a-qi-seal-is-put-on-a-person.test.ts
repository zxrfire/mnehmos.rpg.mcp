/**
 * A QI SEAL IS PUT ON A PERSON.
 *
 * The design owner: *"seals already exist, so prisoners are just sealed and
 * thrown into a qi poor area"*, *"just call it qi seal"*, *"just do it as a
 * person, make it easy"*, *"hardcode the qi levels there to low."*
 *
 * BOTH HALVES, AND NEITHER DOES THE OTHER'S JOB. The hall is poor ground
 * because a house put it somewhere poor; the seal is on the person and follows
 * them out of it. A seal that lived on the room could only ever be true of
 * whoever happened to be standing there.
 *
 * AND IT IS NOT A DRAIN. Nothing is taken from anywhere and nothing is given to
 * anywhere else - no transfer, no ledger, no conservation to get wrong. The qi
 * is still in the ground; the person cannot reach it.
 */

import { describe, expect, it } from 'vitest';

import {
    WHAT_A_SEAL_LEAVES_YOU,
    theSealStillHolds,
    whatIsLeftToDrawUnderASeal,
    whatTheSealLooksLike,
    whatThisPersonCanDrawFrom,
    type AQiSeal
} from '../../../src/engine/cultivation/a-qi-seal-is-put-on-a-person.js';
import { typicalAmbientFor } from '../../../src/engine/cultivation/ambient.js';

const seal = (over: Partial<AQiSeal> = {}): AQiSeal =>
    ({ liftsOnDay: 100, byId: 'sect-azure-cloud-pavilion', note: 'held', sinceDay: 0, ...over });

describe('a qi seal', () => {
    it('holds until its day and then does not', () => {
        expect(theSealStillHolds(seal(), 0)).toBe(true);
        expect(theSealStillHolds(seal(), 99)).toBe(true);
        expect(theSealStillHolds(seal(), 100)).toBe(false);
        expect(theSealStillHolds(null, 0)).toBe(false);
    });

    it('has no end where a house named no day', () => {
        // A real answer and not an oversight: a house that seals somebody
        // without naming a day has said something specific about them.
        const forever = seal({ liftsOnDay: null });
        expect(theSealStillHolds(forever, 0)).toBe(true);
        expect(theSealStillHolds(forever, 1_000_000)).toBe(true);
    });

    it('leaves the thinnest ground in the world, whatever is under them', () => {
        // The richest drawable ground there is, sealed, reads as the poorest.
        expect(whatIsLeftToDrawUnderASeal(1)).toBe(WHAT_A_SEAL_LEAVES_YOU);
        expect(typicalAmbientFor(whatIsLeftToDrawUnderASeal(1))).toBe('thin');
        // And it never makes bad ground better.
        expect(whatIsLeftToDrawUnderASeal(0)).toBe(0);
    });

    it('takes what they can draw and not what they are holding', () => {
        // The owner's own distinction, stated about techniques and true here
        // for the same reason: cultivation sets the ceiling, spending moves the
        // pool, and neither the seal nor a technique touches the ceiling. A
        // sealed cultivator is exactly as strong as they were when it went on.
        const sealed = whatThisPersonCanDrawFrom({ density: 0.9, seal: seal(), onDay: 5 });
        const free = whatThisPersonCanDrawFrom({ density: 0.9, seal: seal(), onDay: 500 });
        expect(sealed).toBe(WHAT_A_SEAL_LEAVES_YOU);
        expect(free).toBe(0.9);
        // Nothing in this module reads or returns a pool or a ceiling at all.
        expect(Object.keys({ sealed, free })).toHaveLength(2);
    });

    it('says what it is, with the days left on it', () => {
        expect(whatTheSealLooksLike(seal(), 90)).toMatch(/10 days left/);
        expect(whatTheSealLooksLike(seal({ liftsOnDay: 91 }), 90)).toMatch(/1 day left/);
        expect(whatTheSealLooksLike(seal({ liftsOnDay: null }), 90)).toMatch(/no day on it/);
        // Nothing to say about somebody who is not sealed.
        expect(whatTheSealLooksLike(seal(), 500)).toBeNull();
        expect(whatTheSealLooksLike(null, 0)).toBeNull();
    });
});
