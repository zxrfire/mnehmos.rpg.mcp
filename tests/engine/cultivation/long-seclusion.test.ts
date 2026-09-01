/**
 * Long seclusion, and the starvation that is not the engine's.
 *
 * ── The report, and what it actually was ─────────────────────────────────
 *
 * A soak reported that provisions "cannot exceed about 2.1 years", that there
 * was a carry cap of ~15 rations, that money was not the constraint (the purse
 * was said to hold 50,000 spirit stones), and that 40 of 40 lives ended in
 * `starvation` at age 17-18.
 *
 * There is no carry cap. `provision()` in the web layer clamps nothing except
 * affordability, and the reported sequence reproduces exactly from the STARTING
 * PURSE:
 *
 *   30 stones / 2 per ration        = 15 rations = 750 days = 2.1 years
 *   buy a year -> min(8, 30/2 = 15) = 8 rations, 14 stones left
 *   buy a year -> min(8, 14/2 =  7) = 7 rations,  0 stones left  ("less than
 *                                                  you went in for")
 *   buy a year -> min(8,  0/2 =  0) = 0           -> the refusal
 *
 * Money is precisely the constraint, and 2.1 years is exactly what a starting
 * cultivator can afford. The 50,000 figure was not the cultivator's purse.
 *
 * ── The engine does not starve anyone here ───────────────────────────────
 *
 * Measured: a five-year seclusion on 15 rations runs 750 days, stops with
 * `provisions_exhausted`, and the cultivator walks out ALIVE with a full belly,
 * because `consumeFood` ends on a meal when there is one. Repeated six times it
 * ejects six times and never kills. That is the contract, and these tests pin
 * it so this claim can be rechecked in one command.
 *
 * ── Where the 40 deaths actually come from ───────────────────────────────
 *
 * The two-command trap, reached reliably once the purse is empty. It is
 * documented in survival.ts and it is a CALLER defect, not an engine one:
 *
 *   1. seclude, food runs out  -> ejected alive, belly full, pack empty
 *   2. seclude again, no food  -> ejected alive at day 50, belly EMPTY
 *   3. seclude again           -> `starvationAnnounced` is seeded true for
 *                                 somebody entering already empty, so no
 *                                 interrupt fires and they are dead on day 5
 *
 * Step 3 is deliberate - a cultivator who has been told once must be able to
 * actually die of it - and it is safe only if the caller refuses first.
 * `assessProvisioning` exists to be that refusal and is still not wired into
 * the seclusion verb. Until it is, the third command is silently lethal.
 */

import { describe, it, expect } from 'vitest';
import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import { assessProvisioning, daysPerRation } from '../../../src/engine/cultivation/survival.js';
import { STARTING_SPIRIT_STONES, STARVATION_TURNS } from '../../../src/schema/cultivation.js';
import { makeCultivator } from './fixtures.js';

/** What the web layer charges per ration. Asserted against, never imported:
 *  importing game.ts here would drag the whole database in. */
const PROVISION_COST_STONES = 2;

function seclude(years: number, rations: number, satiety = 100, startDay = 0) {
    return simulateTimeSkip(makeCultivator({ satiety }), years * 365, {
        seed: 'long-seclusion',
        locationId: 'a cave like any other',
        locationDensity: 0.35,
        startDay,
        autoBreakthrough: true,
        randomEvents: false,
        rations
    });
}

describe('what the starting purse actually buys', () => {
    it('is 2.1 years, and that is money rather than a carry limit', () => {
        const affordable = Math.floor(STARTING_SPIRIT_STONES / PROVISION_COST_STONES);
        expect(affordable).toBe(15);
        const years = (affordable * daysPerRation(0)) / 365;
        expect(years).toBeGreaterThan(2);
        expect(years).toBeLessThan(2.2);
    });

    it('reproduces the reported buy sequence exactly from the purse alone', () => {
        // wanted = ceil(365 / 50) = 8 for "a year of provisions".
        const wanted = Math.ceil(365 / daysPerRation(0));
        let purse = STARTING_SPIRIT_STONES;
        const bought: number[] = [];
        for (let i = 0; i < 3; i++) {
            const got = Math.min(wanted, Math.floor(purse / PROVISION_COST_STONES));
            bought.push(got);
            purse -= got * PROVISION_COST_STONES;
        }
        expect(bought).toEqual([8, 7, 0]);
        expect(purse).toBe(0);
    });
});

describe('a long seclusion ejects rather than starves', () => {
    it('stops at the food and walks out alive, at every duration', () => {
        for (const years of [3, 5, 10, 40]) {
            const skip = seclude(years, 15);
            expect(skip.died, `${years} years`).toBe(false);
            expect(skip.interruptReason, `${years} years`).toBe('provisions_exhausted');
            expect(skip.simulatedDays, `${years} years`).toBe(15 * daysPerRation(0));
        }
    });

    it('leaves them fed, so the NEXT action does not start starving', () => {
        // `consumeFood` finishes on a meal when there is one. Without this a
        // player was ejected at exactly zero and died on their next move with
        // food still on their back.
        const skip = seclude(5, 15);
        expect(skip.endState.starvationTurns).toBe(0);
        expect(skip.deltas.satiety).toBe(0);
    });

    it('is repeatable indefinitely and never becomes lethal on its own', () => {
        let day = 0;
        for (let turn = 0; turn < 6; turn++) {
            const skip = seclude(5, 15, 100, day);
            expect(skip.died, `turn ${turn}`).toBe(false);
            day += skip.simulatedDays;
        }
    });

    it('agrees with what assessProvisioning projected beforehand', () => {
        for (const years of [1, 2, 3, 5, 10]) {
            const days = years * 365;
            const projected = assessProvisioning({
                days, realmOrdinal: 0, satiety: 100, rations: 15
            });
            const skip = seclude(years, 15);
            expect(skip.died).toBe(projected.outcome === 'fatal');
            if (projected.outcome === 'ejected') {
                expect(skip.simulatedDays).toBeLessThanOrEqual(projected.coveredDays);
            }
        }
    });
});

describe('the trap the caller must close', () => {
    it('is the THIRD command, and it is silent', () => {
        // Step 2: ejected alive at an empty belly, having been told.
        const warned = seclude(5, 0, 100);
        expect(warned.died).toBe(false);
        expect(warned.interruptReason).toBe('starvation_begun');

        // Step 3: sitting straight back down. No interrupt is left to fire.
        const fatal = seclude(5, 0, 0);
        expect(fatal.died).toBe(true);
        expect(fatal.deathCause).toBe('starvation');
        expect(fatal.simulatedDays).toBe(STARVATION_TURNS);
    });

    it('is exactly what assessProvisioning was built to refuse', () => {
        // The refusal exists, carries the numbers, and is still not wired into
        // the seclusion verb. This test is the standing reminder.
        const verdict = assessProvisioning({
            days: 5 * 365, realmOrdinal: 0, satiety: 0, rations: 0
        });
        expect(verdict.outcome).toBe('fatal');
        expect(verdict.fatalOnDay).toBe(STARVATION_TURNS);
        expect(verdict.reason).toContain('fatal');
    });
});
