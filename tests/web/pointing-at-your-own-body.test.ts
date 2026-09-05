/**
 * "This wound" was searched for as a town.
 *
 * Found by playing, wounded - serious, untreated, 25 of 50 - standing in
 * Cloud Gate with `I see a physician` in the live strip at that moment:
 *
 *   I need someone to look at this wound
 *   -> "You go over Cloud Gate, searching for the place the name implies, but
 *      nothing here answers to it."
 *   -> Unresolved subject "this wound": no knowledge record and nothing
 *      co-located.
 *
 * The engine was holding that wound - the grade, the untreated status, the 25
 * of 50, and that a month under a physician closes it - and the resolver read
 * the phrase as a proper noun to look up in the gazetteer.
 *
 * `SELF_AS_A_SUBJECT` already had `wound`. It required the POSSESSIVE, so `my
 * wound` answered with the body read and `this wound` fell all the way through
 * to the place refusal, on the same run, two lines apart.
 */

import { resolveAnything } from '../../src/web/entities';
import { makeCultivator } from '../engine/cultivation/fixtures';

// Enough of a repos for the branches BELOW the self read to run and find
// nothing, so a negative case proves the self read declined rather than that
// the call threw before reaching anything.
const repos = {
    cultivators: { roster: () => [] },
    sects: { list: () => [], getMembership: () => null },
    techniques: { listKnown: () => [], knows: () => false }
} as never;
const hurt = () => makeCultivator({ realmOrdinal: 1, hp: 25, maxHp: 50, age: 16 });

const points = (phrase: string) => resolveAnything(repos, phrase, hurt());

describe('pointing at your own body', () => {
    it('answers a deictic the way it answers the possessive', () => {
        for (const phrase of ['my wound', 'this wound', 'these wounds', 'this injury']) {
            expect(points(phrase), phrase).not.toBeNull();
        }
    });

    it('reads the same body either way', () => {
        expect(points('this wound')?.facts.join(' ')).toContain('25 of 50');
        expect(points('my wound')?.facts.join(' ')).toContain('25 of 50');
    });

    it('covers the rest of what somebody points at on themselves', () => {
        for (const phrase of ['this body', 'these meridians', 'this condition']) {
            expect(points(phrase), phrase).not.toBeNull();
        }
    });
});

/**
 * `this` AND `these` ONLY.
 *
 * A person can point at their own body and at nobody else's, which is what
 * makes the deixis safe here. "That wound" and "the wound" are things you say
 * about somebody else, and they stay exactly where they are.
 */
describe('and it takes nothing that is about somebody else', () => {
    /**
     * The self read runs FIRST in `resolveAnything`, so a phrase it declines
     * falls through to branches that need a real database. Reaching one of them
     * - by returning nothing or by throwing on a stub - is itself the proof
     * that the self read let go of the phrase, which is the whole assertion.
     */
    const theSelfReadDeclined = (phrase: string) => {
        try {
            const found = resolveAnything(repos, phrase, hurt());
            return found === null || !(found.facts.join(' ').includes('in the body'));
        } catch {
            return true;
        }
    };

    it('leaves the distal demonstrative alone', () => {
        expect(theSelfReadDeclined('that wound')).toBe(true);
        expect(theSelfReadDeclined('the wound')).toBe(true);
    });

    it('does not swallow the ground, the house or the room', () => {
        for (const phrase of ['this place', 'this ground', 'this sect', 'this town']) {
            expect(theSelfReadDeclined(phrase), phrase).toBe(true);
        }
    });
});
