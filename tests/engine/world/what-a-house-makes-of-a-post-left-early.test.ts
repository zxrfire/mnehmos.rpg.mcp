/**
 * Leaving a post early is clean when the house would welcome the change, and a post abandoned
 * otherwise. The owner: "can i end early, is, will the sect be happy with my update?"
 */

import { describe, expect, it } from 'vitest';
import {
    whatTheHouseMakesOfAPostLeftEarly,
    type APostLeftEarly
} from '../../../src/engine/world/what-a-house-makes-of-a-post-left-early';

const nothingChanged: APostLeftEarly = {
    realmWhenTaken: { index: 0, name: 'Qi Condensation' },
    realmNow: { index: 0, name: 'Qi Condensation' },
    houseAtWar: false,
    sentForByTheHouse: false,
    meritSinceTaken: 0,
    whatTheRestWasWorth: 400,
    daysLeft: 800,
    termDays: 1825
};

describe('what a house makes of a post left early', () => {
    it('welcomes a full realm risen', () => {
        const made = whatTheHouseMakesOfAPostLeftEarly({
            ...nothingChanged, realmNow: { index: 1, name: 'Foundation Establishment' }
        });
        expect(made.welcome).toBe(true);
        expect(made.because).toContain('Foundation Establishment');
    });

    it('does not count a rise inside one realm', () => {
        expect(whatTheHouseMakesOfAPostLeftEarly(nothingChanged).welcome).toBe(false);
    });

    it('welcomes a house at war wanting its people', () => {
        expect(whatTheHouseMakesOfAPostLeftEarly({ ...nothingChanged, houseAtWar: true }).welcome).toBe(true);
    });

    it('welcomes being sent for by the house', () => {
        expect(whatTheHouseMakesOfAPostLeftEarly({ ...nothingChanged, sentForByTheHouse: true }).welcome).toBe(true);
    });

    it('welcomes merit brought in worth more than the rest of the term, and not less', () => {
        expect(whatTheHouseMakesOfAPostLeftEarly({ ...nothingChanged, meritSinceTaken: 400 }).welcome).toBe(true);
        expect(whatTheHouseMakesOfAPostLeftEarly({ ...nothingChanged, meritSinceTaken: 399 }).welcome).toBe(false);
    });

    it('names a post abandoned plainly, and weighs it by how much was left', () => {
        const made = whatTheHouseMakesOfAPostLeftEarly(nothingChanged);
        expect(made).toMatchObject({ welcome: false, severity: 'serious' });
        expect(made.because).toBe('The house takes it as a post abandoned: 800 days of the term were left.');
        const early = whatTheHouseMakesOfAPostLeftEarly({ ...nothingChanged, daysLeft: 1800 });
        const late = whatTheHouseMakesOfAPostLeftEarly({ ...nothingChanged, daysLeft: 100 });
        expect(early).toMatchObject({ severity: 'unforgivable' });
        expect(late).toMatchObject({ severity: 'slight' });
    });
});
