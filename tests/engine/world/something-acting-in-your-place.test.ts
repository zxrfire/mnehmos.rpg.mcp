/**
 * Acting where you are not.
 *
 * The suite the design owner asked for by name. Every case here is about ONE
 * question the engine could not previously ask - which body is acting - and
 * none of them is about swords: the same three rules answer a nascent soul out
 * of the body and a clone standing in a room its maker has never seen.
 */

import { describe, expect, it } from 'vitest';

import {
    couldItBeSentAt,
    whatIsLeftUnguarded,
    whereYouCanActFrom,
    wouldTheyKnowWhoSentIt,
    type ActingInYourPlace
} from '../../../src/engine/world/something-acting-in-your-place';

const ME = 'me';
const HOME = 'loc-willow-village';
const AWAY = 'loc-nine-peaks';

const thing = (over: Partial<ActingInYourPlace> & { id: string }): ActingInYourPlace => ({
    kind: 'flying_sword', ownerId: ME, locationId: AWAY, name: null,
    recognisable: false, ordinal: 20, ...over
});

describe('which body is acting', () => {
    /**
     * The invariant that keeps this from being a mode. A cultivator with three
     * swords out is still standing somewhere and can still use their hands.
     */
    it('always offers the body, first, whatever else is out', () => {
        const from = whereYouCanActFrom({
            ownerId: ME, standingAt: HOME, proxies: [thing({ id: 'sword-1' })]
        });
        expect(from[0]).toMatchObject({ id: ME, what: 'yourself', locationId: HOME });
        expect(from).toHaveLength(2);
    });

    it('offers each thing where that thing actually is', () => {
        const from = whereYouCanActFrom({
            ownerId: ME,
            standingAt: HOME,
            proxies: [
                thing({ id: 'sword-1', name: 'Frostmirror', locationId: AWAY }),
                thing({ id: 'soul-1', kind: 'nascent_soul', locationId: 'loc-sand-well' })
            ]
        });
        expect(from.map(one => one.locationId)).toEqual([HOME, AWAY, 'loc-sand-well']);
        expect(from.map(one => one.what)).toEqual(['yourself', 'flying_sword', 'nascent_soul']);
    });

    /** Somebody else's sword is somebody else's sword. */
    it('never offers a thing belonging to somebody else', () => {
        const from = whereYouCanActFrom({
            ownerId: ME,
            standingAt: HOME,
            proxies: [thing({ id: 'theirs', ownerId: 'not-me' })]
        });
        expect(from).toHaveLength(1);
    });
});

describe('reach is knowledge, and never a distance', () => {
    /**
     * The design owner: *obviously you can't just say I kill x without knowing
     * where they are. that depends on your knowledge.* A cultivator who has no
     * idea where their enemy is cannot kill them from a province away, however
     * far the art reaches.
     */
    it('refuses when the owner does not know where they are', () => {
        const out = couldItBeSentAt({
            knownToBeAt: null, standingAt: HOME, proxies: [thing({ id: 'sword-1' })]
        });
        expect(out.reach).toBeNull();
        expect(out.why).toBe('you do not know where they are');
    });

    it('uses your own hands when they are standing in front of you', () => {
        const out = couldItBeSentAt({
            knownToBeAt: HOME, standingAt: HOME, proxies: [thing({ id: 'sword-1' })]
        });
        expect(out.reach).toBe('yourself');
    });

    it('reaches with the thing that is where they are', () => {
        const out = couldItBeSentAt({
            knownToBeAt: AWAY,
            standingAt: HOME,
            proxies: [thing({ id: 'sword-1', locationId: AWAY })]
        });
        expect(out.reach).toMatchObject({ id: 'sword-1' });
    });

    /** Knowing where they are is not the same as having anything out there. */
    it('refuses when nothing of yours is near them', () => {
        const out = couldItBeSentAt({
            knownToBeAt: 'loc-far-off',
            standingAt: HOME,
            proxies: [thing({ id: 'sword-1', locationId: AWAY })]
        });
        expect(out.reach).toBeNull();
        expect(out.why).toBe('nothing of yours is near them');
    });
});

describe('a recognisable thing is a signature', () => {
    /**
     * The design owner: *if you use a recognisable sword, PEOPLE KNOW.* The
     * deed goes into the world with a name on it, and an anonymous one leaves
     * the world holding that something happened and nobody saying who -
     * `aDeedEntersTheWorld` already takes both, so this only decides which.
     */
    it('says whose it was, when the blade is known', () => {
        expect(wouldTheyKnowWhoSentIt(thing({ id: 's', name: 'Frostmirror', recognisable: true })))
            .toBe(true);
        expect(wouldTheyKnowWhoSentIt(thing({ id: 's', recognisable: false }))).toBe(false);
    });
});

describe('what is left behind while it is out', () => {
    /**
     * The price of the one that reaches furthest. A soul out of the body leaves
     * a body, and the body is a body.
     */
    it('leaves a body nobody is defending, for a nascent soul', () => {
        expect(whatIsLeftUnguarded(thing({ id: 'soul', kind: 'nascent_soul' })))
            .toMatch(/body/i);
    });

    it('leaves nothing behind for a sword or a clone', () => {
        expect(whatIsLeftUnguarded(thing({ id: 'sword' }))).toBeNull();
        expect(whatIsLeftUnguarded(thing({ id: 'clone', kind: 'clone' }))).toBeNull();
    });
});
