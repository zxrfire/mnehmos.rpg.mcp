/**
 * Crowds cut both ways, and the two ways are different kinds of danger.
 *
 * The design owner's rule: "the encounter rate isn't simply a function of
 * people - it's a function of people / people in seclusion." And beside it:
 * "two people could fight outside your cave and spill poison gas, so being the
 * only cave in an area isn't BAD, especially cuz its concealed."
 *
 * What was measured before this: sealing inside a sect town produced MORE
 * interruptions than anywhere else - three consecutive twenty-year seals
 * returning 2.4 years, 30 days and 1 day - so a sect's own cultivation ground
 * was the most dangerous place in the world to sit. Backwards, and it left no
 * reason to ever cultivate inside a sect, which is what sects are for.
 *
 * These assert DIRECTION and BOUNDS, never a tuned figure. The owner's scoping
 * note is explicit that this is a small modifier on an already-tiny base and
 * must not be tuned until it demonstrably needs to be.
 */

import { companyEffect } from '../../../src/engine/encounters/activity.js';
import type { EncounterEntry } from '../../../src/data/cultivation/encounters.js';
import type { EncounterPlace } from '../../../src/engine/encounters/types.js';

const of = (kind: string) => ({ kind, id: 'e', name: 'e', tags: [], threatOrdinal: null } as unknown as EncounterEntry);

const RIVAL = of('rival_cultivator');
const BANDITS = of('bandits');
const SPILL = of('misfortune');
const SECT = of('sect_event');

const at = (kind: string, heads: number, settledShare: number): EncounterPlace =>
    ({ id: 'p', name: 'p', kind, company: { heads, settledShare } });

const LONE_CAVE = at('cave', 1, 0.9);
const SECT_MOUNTAIN = at('sect_seat', 40, 0.75);
const MARKET = at('settlement', 40, 0.1);

describe('a place with no company recorded', () => {
    it('has no opinion at all, rather than a guess', () => {
        const nowhere: EncounterPlace = { id: 'p', name: 'p', kind: 'wilds' };
        for (const entry of [RIVAL, SPILL, SECT]) {
            expect(companyEffect(entry, nowhere)).toBe(1);
        }
    });
});

describe('being singled out', () => {
    it('is likelier alone than in a house full of sealed cultivators', () => {
        expect(companyEffect(RIVAL, SECT_MOUNTAIN)).toBeLessThan(companyEffect(RIVAL, LONE_CAVE));
        expect(companyEffect(BANDITS, SECT_MOUNTAIN)).toBeLessThan(companyEffect(BANDITS, LONE_CAVE));
    });

    /**
     * The denominator, isolated. Same headcount, opposite behaviour - which is
     * exactly the pair population alone cannot tell apart, and the reason the
     * old model got a sect's ground backwards.
     */
    it('falls further the more of that crowd is sitting rather than moving', () => {
        const sealed = at('sect_seat', 40, 0.9);
        const milling = at('sect_seat', 40, 0.1);
        expect(companyEffect(RIVAL, sealed)).toBeLessThan(companyEffect(RIVAL, milling));
    });
});

describe('being near something that was going to happen anyway', () => {
    it('is likeliest where most people are OUT, not merely where most people are', () => {
        // Same forty bodies. The market has them moving; the mountain has them
        // behind doors. Collateral tracks the numerator.
        expect(companyEffect(SPILL, MARKET)).toBeGreaterThan(companyEffect(SPILL, SECT_MOUNTAIN));
    });

    it('barely touches the only cave in an empty region', () => {
        expect(companyEffect(SPILL, LONE_CAVE)).toBe(1);
    });

    it('moves the opposite way from being singled out', () => {
        expect(companyEffect(SPILL, MARKET)).toBeGreaterThan(1);
        expect(companyEffect(RIVAL, MARKET)).toBeLessThan(1);
    });
});

describe('what the crowd is not protecting you from', () => {
    /**
     * A fellow disciple with a message and a summons from an elder are part of
     * the traffic in one sense and are not the thing anybody is being protected
     * FROM. A busy house arguably carries more of them, not fewer.
     */
    it('leaves sect business, commerce and dao houses alone entirely', () => {
        for (const place of [LONE_CAVE, SECT_MOUNTAIN, MARKET]) {
            expect(companyEffect(SECT, place)).toBe(1);
            expect(companyEffect(of('commerce'), place)).toBe(1);
            expect(companyEffect(of('dao_house'), place)).toBe(1);
        }
    });
});

describe('the bounds, which matter more than the values', () => {
    /**
     * A shut door is not a ward. That is committed and tested elsewhere, and
     * this term must not make it one by arithmetic - so nothing here may reach
     * zero however full and however sealed the ground gets.
     */
    it('never drives a weight to zero, however crowded and however sealed', () => {
        for (const heads of [1, 12, 100, 10_000]) {
            for (const share of [0, 0.5, 1]) {
                const weight = companyEffect(RIVAL, at('sect_seat', heads, share));
                expect(weight).toBeGreaterThan(0.5);
                expect(weight).toBeLessThanOrEqual(1);
            }
        }
    });

    it('stays a modifier rather than a swing, in both directions', () => {
        for (const place of [LONE_CAVE, SECT_MOUNTAIN, MARKET, at('settlement', 500, 0)]) {
            for (const entry of [RIVAL, BANDITS, SPILL, SECT]) {
                const weight = companyEffect(entry, place);
                expect(weight).toBeGreaterThanOrEqual(0.55);
                expect(weight).toBeLessThanOrEqual(1.45);
            }
        }
    });
});
