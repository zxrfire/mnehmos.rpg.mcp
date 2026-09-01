/**
 * Provisioning - pricing a stretch of days BEFORE it is entered.
 *
 * These are design guards rather than unit tests of arithmetic. The thing being
 * held down is that the engine can answer "what will this stretch do to them"
 * with the same numbers it will later use to do it, so a caller has no excuse
 * for accepting a request whose end the simulation can already see.
 *
 * The load-bearing block is the last one: every projection is checked against a
 * real `simulateTimeSkip` run rather than against a restated formula. A
 * projection that agrees with a copy of the code it is projecting is worth
 * nothing.
 */

import { describe, it, expect } from 'vitest';
import {
    ACTIONS_PER_FULL_SATIETY,
    assessProvisioning,
    daysOfBelly,
    daysPerRation,
    rationsToCover
} from '../../../src/engine/cultivation/survival.js';
import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import { SATIETY_MAX, STARVATION_TURNS } from '../../../src/schema/cultivation.js';
import { REALM_TIERS, type RealmKey } from '../../../src/engine/cultivation/realms.js';
import { makeCultivator } from './fixtures.js';

const DAYS_PER_YEAR = 365;

/** First ordinal of a named realm, read off the ladder rather than retyped. */
function firstOrdinalOf(key: RealmKey): number {
    const tier = REALM_TIERS.find(t => t.key === key);
    if (!tier) throw new Error(`No realm ${key}`);
    return tier.ordinalStart;
}

describe('daysPerRation / daysOfBelly', () => {
    it('a mortal-scale belly covers exactly the documented number of days', () => {
        expect(daysPerRation(0)).toBe(ACTIONS_PER_FULL_SATIETY);
        expect(daysOfBelly(SATIETY_MAX, 0)).toBe(ACTIONS_PER_FULL_SATIETY);
        expect(daysOfBelly(SATIETY_MAX / 2, 0)).toBe(ACTIONS_PER_FULL_SATIETY / 2);
    });

    it('hunger tapers up the ladder, so a ration buys more the higher you stand', () => {
        const foundation = firstOrdinalOf('foundation_establishment');
        expect(daysPerRation(foundation)).toBeGreaterThan(daysPerRation(0));
    });

    it('is infinite where hunger has stopped, so nobody is sold food they cannot eat', () => {
        const deity = firstOrdinalOf('deity_transformation');
        expect(daysPerRation(deity)).toBe(Infinity);
        expect(rationsToCover(10 * DAYS_PER_YEAR, deity, 0)).toBe(0);
    });
});

describe('rationsToCover', () => {
    it('counts the belly first, so nobody is charged for days their stomach covers', () => {
        expect(rationsToCover(ACTIONS_PER_FULL_SATIETY, 0, SATIETY_MAX)).toBe(0);
        expect(rationsToCover(ACTIONS_PER_FULL_SATIETY + 1, 0, SATIETY_MAX)).toBe(1);
    });

    it('prices a decade of seclusion at the figure a player has to be told', () => {
        expect(rationsToCover(10 * DAYS_PER_YEAR, 0, SATIETY_MAX)).toBe(72);
    });
});

describe('assessProvisioning', () => {
    it('passes a fully provisioned stretch with nothing to say', () => {
        const a = assessProvisioning({ days: 100, realmOrdinal: 0, satiety: SATIETY_MAX, rations: 2 });
        expect(a.outcome).toBe('fed');
        expect(a.rationsShort).toBe(0);
        expect(a.wastedDays).toBe(0);
        expect(a.reason).toBeNull();
    });

    it('names the shortfall for the case that started this: ten years, empty pack', () => {
        const a = assessProvisioning({
            days: 10 * DAYS_PER_YEAR,
            realmOrdinal: 0,
            satiety: SATIETY_MAX,
            rations: 0
        });
        // A full belly still has an interrupt left, so this is a decade thrown
        // away rather than a death - and it is exactly as worth refusing.
        expect(a.outcome).toBe('ejected');
        expect(a.rationsNeeded).toBe(72);
        expect(a.rationsShort).toBe(72);
        expect(a.emptyOnDay).toBe(ACTIONS_PER_FULL_SATIETY);
        expect(a.wastedDays).toBe(10 * DAYS_PER_YEAR - ACTIONS_PER_FULL_SATIETY);
        expect(a.fatalOnDay).toBeNull();
        // The refusal has to carry the numbers, not just the verdict.
        expect(a.reason).toContain('72');
        expect(a.reason).toContain(String(ACTIONS_PER_FULL_SATIETY));
    });

    it('is fatal only when there is no interrupt left to spend', () => {
        // The second command of the pair. Ejected at an empty belly, they sit
        // straight back down - and this time nothing stops the clock.
        const a = assessProvisioning({
            days: 10 * DAYS_PER_YEAR,
            realmOrdinal: 0,
            satiety: 0,
            rations: 0
        });
        expect(a.outcome).toBe('fatal');
        expect(a.fatalOnDay).toBe(STARVATION_TURNS);
        expect(a.reason).toContain('fatal');
    });

    it('counts starvation already on the clock: entering hungry leaves less room', () => {
        const a = assessProvisioning({
            days: 3,
            realmOrdinal: 0,
            satiety: 0,
            rations: 0,
            starvationTurns: STARVATION_TURNS - 2
        });
        expect(a.outcome).toBe('fatal');
        expect(a.fatalOnDay).toBe(2);
    });

    it('one ration in the pack is an interrupt, and therefore not a death', () => {
        const a = assessProvisioning({
            days: 10 * DAYS_PER_YEAR,
            realmOrdinal: 0,
            satiety: 0,
            rations: 1
        });
        expect(a.outcome).toBe('ejected');
    });

    it('grain abstinence prices nothing, because nothing is eaten', () => {
        const a = assessProvisioning({
            days: 40 * DAYS_PER_YEAR,
            realmOrdinal: 0,
            satiety: 0,
            rations: 0,
            grainAbstinence: true
        });
        expect(a.outcome).toBe('fed');
        expect(a.reason).toBeNull();
    });
});

describe('the projection agrees with the simulation it is projecting', () => {
    /**
     * The guard that matters. `assessProvisioning` is only worth having if its
     * verdict and a real time skip end the same way - otherwise a caller that
     * refuses on it is refusing something survivable, or accepting something
     * lethal, and either is worse than the bug it replaced.
     */
    const cases: Array<{ days: number; rations: number; satiety: number }> = [
        { days: 10 * DAYS_PER_YEAR, rations: 0, satiety: SATIETY_MAX },
        { days: 10 * DAYS_PER_YEAR, rations: 0, satiety: SATIETY_MAX * 0.6 },
        { days: 10 * DAYS_PER_YEAR, rations: 0, satiety: 0 },
        { days: 10 * DAYS_PER_YEAR, rations: 8, satiety: SATIETY_MAX },
        { days: 10 * DAYS_PER_YEAR, rations: 72, satiety: SATIETY_MAX },
        { days: DAYS_PER_YEAR, rations: 0, satiety: 0 },
        { days: DAYS_PER_YEAR, rations: 8, satiety: SATIETY_MAX },
        { days: ACTIONS_PER_FULL_SATIETY, rations: 0, satiety: SATIETY_MAX },
        { days: 200, rations: 1, satiety: SATIETY_MAX / 2 },
        { days: STARVATION_TURNS, rations: 0, satiety: 0 }
    ];

    for (const c of cases) {
        it(`${c.days} days on ${c.rations} ration(s) at satiety ${c.satiety}`, () => {
            const cultivator = makeCultivator({ satiety: c.satiety });
            const projected = assessProvisioning({
                days: c.days,
                realmOrdinal: cultivator.realmOrdinal,
                satiety: cultivator.satiety,
                rations: c.rations
            });

            const skip = simulateTimeSkip(cultivator, c.days, {
                seed: 'provisioning-guard',
                locationId: 'nowhere-in-particular',
                locationDensity: 0.4,
                // Everything that could end the stretch for an unrelated reason
                // is off: what is measured here is hunger and only hunger.
                autoBreakthrough: false,
                randomEvents: false,
                rations: c.rations
            });

            const starved = skip.died && skip.deathCause === 'starvation';
            expect(starved).toBe(projected.outcome === 'fatal');

            if (projected.outcome === 'fatal') {
                // Death lands on the projected day, not near it.
                expect(skip.simulatedDays).toBe(projected.fatalOnDay);
            }
            if (projected.outcome === 'ejected') {
                // Stopped rather than killed, and stopped where the food ran
                // out - which is what makes `wastedDays` a real figure.
                expect(skip.interrupted).toBe(true);
                expect(skip.simulatedDays).toBeLessThan(c.days);
                expect(skip.simulatedDays).toBeLessThanOrEqual(projected.coveredDays);
            }
            if (projected.outcome === 'fed') {
                // Deliberately not `simulatedDays === days`: a provisioned
                // decade can still be cut short by a wound, and that is a
                // different subsystem. What must hold is that no day of the
                // stretch was lost to FOOD.
                //
                // A stretch that ends exactly as the belly empties still fires
                // the warning on its closing day - correctly, since the next
                // action would start hungry - and loses nothing by it, which is
                // why the whole run completing is enough.
                const lostToFood =
                    skip.simulatedDays < c.days &&
                    (skip.interruptReason === 'starvation_begun' ||
                        skip.interruptReason === 'provisions_exhausted');
                expect(lostToFood).toBe(false);
            }
        });
    }
});
