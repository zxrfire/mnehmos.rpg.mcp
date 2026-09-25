/**
 * Nights outdoors cost a body below Foundation Establishment, and never take it
 * below a quarter of its maximum.
 *
 * The owner's ruling: an inn is worth staying at because a body below Foundation
 * takes weather damage outdoors. The floor is the default pending the owner:
 * weather wears a body down and does not kill it.
 */

import { describe, expect, it } from 'vitest';

import {
    EXPOSURE_FLOOR_FRACTION,
    whatTheNightsInTheOpenCost
} from '../../../src/engine/cultivation/a-night-in-the-open';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms';

const DAYS = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);
const NEVER_WINTER = () => false;

describe('a night in the open', () => {
    it('wears a body below Foundation down over a long enough stretch', () => {
        const cost = whatTheNightsInTheOpenCost({
            nights: DAYS(0, 60), seed: 'nights', realmOrdinal: 0, hp: 40, maxHp: 40,
            hardCountry: false, isWinter: NEVER_WINTER
        });
        expect(cost.taken).toBeGreaterThan(0);
        expect(cost.hpAfter).toBe(40 - cost.taken);
        expect(cost.rawNights + cost.foulNights).toBeGreaterThan(0);
    });

    it('never takes the body below the floor, however long the stretch', () => {
        const cost = whatTheNightsInTheOpenCost({
            nights: DAYS(0, 3650), seed: 'nights', realmOrdinal: 0, hp: 40, maxHp: 40,
            hardCountry: true, isWinter: () => true
        });
        expect(cost.hpAfter).toBe(Math.ceil(40 * EXPOSURE_FLOOR_FRACTION));
        expect(cost.heldAtTheFloor).toBe(true);
    });

    it('takes nothing from a body already below the floor', () => {
        const cost = whatTheNightsInTheOpenCost({
            nights: DAYS(0, 30), seed: 'nights', realmOrdinal: 0, hp: 5, maxHp: 40,
            hardCountry: true, isWinter: () => true
        });
        expect(cost.taken).toBe(0);
        expect(cost.hpAfter).toBe(5);
    });

    it('takes nothing at Foundation Establishment and above', () => {
        const cost = whatTheNightsInTheOpenCost({
            nights: DAYS(0, 365), seed: 'nights', realmOrdinal: FOUNDATION_ORDINAL, hp: 100, maxHp: 100,
            hardCountry: true, isWinter: () => true
        });
        expect(cost.taken).toBe(0);
        expect(cost.rawNights + cost.foulNights).toBe(0);
    });

    it('draws each night on its own day, so a night reads the same in a longer stretch', () => {
        const one = whatTheNightsInTheOpenCost({
            nights: [7], seed: 'nights', realmOrdinal: 0, hp: 1000, maxHp: 1000,
            hardCountry: false, isWinter: NEVER_WINTER
        });
        const again = whatTheNightsInTheOpenCost({
            nights: [7], seed: 'nights', realmOrdinal: 0, hp: 1000, maxHp: 1000,
            hardCountry: false, isWinter: NEVER_WINTER
        });
        expect(again).toEqual(one);
    });

    it('is harder in winter in hard country than in an ordinary season', () => {
        const input = { nights: DAYS(0, 20), seed: 'nights', realmOrdinal: 0, hp: 10_000, maxHp: 10_000 };
        const mild = whatTheNightsInTheOpenCost({ ...input, hardCountry: false, isWinter: NEVER_WINTER });
        const hard = whatTheNightsInTheOpenCost({ ...input, hardCountry: true, isWinter: () => true });
        expect(hard.taken).toBeGreaterThan(mild.taken);
    });
});
