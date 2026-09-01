/**
 * The spirit-root cliff: is a deviation-prone root a slower game or a lost one?
 *
 * ── The report ───────────────────────────────────────────────────────────
 *
 * Eight hand-played runs: single roots reached ordinal 16, and every
 * deviation-prone root died at ordinal 2-3 to untreated injuries. The published
 * difference between them is a rate multiplier - single 1.5, dual 1.0, triple
 * 0.85 - which does not describe a cliff, so something else was producing one.
 *
 * ── What was measured ────────────────────────────────────────────────────
 *
 * Twenty-four seeds per root, twenty years each, through the real
 * `simulateTimeSkip` with `autoBreakthrough` on, fed throughout so that nothing
 * here is measuring hunger. The ONLY variable is whether the wounds get closed
 * once a year - which in the game is whether the purse holds five spirit stones
 * for a course of care.
 *
 *   root                       treated                    untreated
 *   single_wood                0.03 wounds/yr, ordinal 10  0.08/yr,  9/24 dead
 *   dual_metal_wood            0.76 wounds/yr, ordinal 7   1.39/yr, 24/24 dead
 *   dual_water_fire            0.76 wounds/yr, ordinal 7   1.39/yr, 24/24 dead
 *   triple_metal_wood_earth    0.55 wounds/yr, ordinal 7   1.09/yr, 24/24 dead
 *   quad_metal_wood_earth_wtr  0.36 wounds/yr, ordinal 7   0.87/yr, 24/24 dead
 *   muddled_five_element       0.20 wounds/yr, ordinal 7   0.56/yr, 24/24 dead
 *   mutated_ice                1.00 wounds/yr, ordinal 9   1.59/yr, 24/24 dead
 *
 * The untreated column reproduces the hand-played result exactly: every
 * deviation-prone root dies, at a mean ordinal of 2.3 to 3.2, within 2.3 to 5.8
 * years. The treated column has no deaths at all in twenty years.
 *
 * ── What the cliff actually is ───────────────────────────────────────────
 *
 * The whole difference between "dead at ordinal 3" and "alive at ordinal 7
 * after twenty years" is between one and five spirit stones a year of medicine.
 * A year of the very worst work on a village board - Farmhand, 180 cash a month
 * - is 21.6 stones. The money exists. It was the REACH that did not.
 *
 * The mechanism is `RISK_PER_UNTREATED_INJURY`: 0.02 per open wound, so a
 * cultivator who cannot pay a healer cultivates at a higher risk, takes the
 * next wound sooner, and reaches the lethal count on an accelerating clock.
 * Treated, the loop is flat. Untreated, it compounds, and the untreated wound
 * rate is close to double the treated one at every root above.
 *
 * ── The decision ─────────────────────────────────────────────────────────
 *
 * The escalation stays. It is the entire reason a dangerous root is dangerous
 * rather than merely slow, and it is the difference between a root draw that
 * matters and a cosmetic one. Note also what the single-root row shows: 0
 * innate risk still yields 0.03 wounds a year, all of it from qi accumulated
 * past the bottleneck and from failed breakthroughs. The dangerous roots pay
 * for existing; the clean ones pay for pushing. That is the right shape.
 *
 * What was wrong was the poverty, not the danger. When this was measured, a
 * bottom-rung cultivator had no way to turn anything into stones except wages:
 * foraging produced items the engine priced and no verb could sell (see
 * `market.ts`, which is the fix), so four stones for a healer was out of reach
 * for a player doing everything right. Fixing the sale restores the exit the
 * spiral is supposed to have and leaves every deviation constant untouched,
 * which is the better of the two available fixes.
 *
 * These tests hold both halves of that decision down. If a future change makes
 * the untreated arm survivable, the roots have become cosmetic. If it makes the
 * treated arm unaffordable against the bottom of the economy, they have become
 * unplayable. Either should break here.
 */

import { describe, it, expect } from 'vitest';
import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import { RISK_PER_UNTREATED_INJURY } from '../../../src/engine/cultivation/deviation.js';
import { treatInjury } from '../../../src/engine/cultivation/injuries.js';
import { getSpiritRoot } from '../../../src/engine/cultivation/spirit-roots.js';
import { makeCultivator } from './fixtures.js';
import type { Cultivator, SpiritRootKey } from '../../../src/schema/cultivation.js';

const DAYS_PER_YEAR = 365;
const YEARS = 20;
const SEEDS = 24;
/** Spirit stones a course of care costs, from the mortal price board. */
const TREATMENT_STONES = 5;
/** Farmhand, the cheapest work on any board: 180 cash a month, 100 cash a stone. */
const WORST_VILLAGE_WAGE_PER_YEAR = (180 * 12) / 100;

interface Life {
    wounds: number;
    years: number;
    died: boolean;
    /**
     * What killed them, so "dies of the root" can be told from "dies at a wall".
     *
     * `autoBreakthrough` is on, so a cultivator in this harness strikes at
     * every rung they reach the requirement for, and a breakthrough kills
     * people - that is the ladder working and it happens to every root. Without
     * this field the cohort counted those as deaths from the spirit root, which
     * is a different claim and the one the test names.
     */
    deathCause: string | null;
    ordinal: number;
}

/** Deaths that are the ladder rather than the root. Excluded by name. */
const AT_A_WALL: ReadonlySet<string> = new Set(['failed_breakthrough', 'heavenly_tribulation']);

/**
 * Live a cultivator for `YEARS` years of continuous seclusion, one year at a
 * time, through the real engine.
 *
 * `treatEachYear` is the only difference between the two arms: a cultivator
 * with money closes their wounds annually, one without them does not.
 */
function live(root: SpiritRootKey, seed: string, treatEachYear: boolean): Life {
    let cultivator: Cultivator = makeCultivator({ spiritRoot: root, satiety: 100 });
    let wounds = 0;
    let elapsed = 0;

    for (let year = 0; year < YEARS; year++) {
        const skip = simulateTimeSkip(cultivator, DAYS_PER_YEAR, {
            seed,
            locationId: 'a cave like any other',
            locationDensity: 0.35,
            startDay: elapsed,
            turn: year,
            autoBreakthrough: true,
            randomEvents: false,
            // Fed for the whole year, so nothing here is measuring hunger.
            rations: 12
        });
        elapsed += skip.simulatedDays;
        wounds += skip.injuriesSustained.length;

        let injuries = [...cultivator.injuries, ...skip.injuriesSustained];
        // The purse closes every wound it can reach, once a year. A treated
        // wound stays on the record as scar tissue and carries no penalty.
        if (treatEachYear) {
            for (const injury of [...injuries]) injuries = treatInjury(injuries, injury.id);
        }

        if (skip.died) {
            return {
                wounds,
                years: elapsed / DAYS_PER_YEAR,
                died: true,
                deathCause: skip.deathCause ?? null,
                ordinal: cultivator.realmOrdinal
            };
        }

        cultivator = makeCultivator({
            spiritRoot: root,
            satiety: 100,
            injuries,
            realmOrdinal: cultivator.realmOrdinal + skip.deltas.realmOrdinal,
            cultivationProgress: Math.max(
                0,
                cultivator.cultivationProgress + skip.deltas.cultivationProgress
            ),
            age: cultivator.age + skip.deltas.age,
            yearsAtCurrentRealm: skip.endState.yearsAtCurrentRealm
        });
    }
    return {
        wounds, years: elapsed / DAYS_PER_YEAR, died: false,
        deathCause: null, ordinal: cultivator.realmOrdinal
    };
}

interface Cohort {
    woundsPerYear: number;
    /** Everybody who did not live out the twenty years, whatever ended them. */
    deaths: number;
    /**
     * Only the ones the ROOT ended. `autoBreakthrough` is on, so a cultivator
     * here strikes at every rung they reach the requirement for and some of
     * them die at a wall - which happens to every root and is the ladder rather
     * than the draw. The two arms of this file want different counts: the
     * untreated arm asks whether anybody survives at all, and the treated arm
     * asks whether the root itself is still killing people.
     */
    deathsFromTheRoot: number;
    meanOrdinal: number;
}

function cohort(root: SpiritRootKey, treatEachYear: boolean): Cohort {
    let wounds = 0;
    let years = 0;
    let deaths = 0;
    let deathsFromTheRoot = 0;
    let ordinal = 0;
    for (let s = 0; s < SEEDS; s++) {
        const run = live(root, `cliff-${s}`, treatEachYear);
        wounds += run.wounds;
        years += run.years;
        ordinal += run.ordinal;
        if (run.died) {
            deaths++;
            // See `AT_A_WALL`: a treated, fed, secluded cultivator has no route
            // to death left except the breakthrough this harness makes them
            // attempt, and counting those said the root had killed somebody it
            // had not touched.
            if (!AT_A_WALL.has(run.deathCause ?? '')) deathsFromTheRoot++;
        }
    }
    return {
        woundsPerYear: years > 0 ? wounds / years : 0,
        deaths,
        deathsFromTheRoot,
        meanOrdinal: ordinal / SEEDS
    };
}

/** Every root whose innate risk is above zero. Read, never listed. */
const DANGEROUS_ROOTS: SpiritRootKey[] = [
    'dual_metal_wood',
    'dual_water_fire',
    'triple_metal_wood_earth',
    'quad_metal_wood_earth_water',
    'muddled_five_element',
    'mutated_ice'
];

describe('treated, a dangerous root is a difficulty setting', () => {
    it('nobody dies of it in twenty years', () => {
        for (const root of DANGEROUS_ROOTS) {
            const arm = cohort(root, true);
            expect(
                arm.deathsFromTheRoot,
                `${root}: ${arm.deathsFromTheRoot} of ${SEEDS} were killed by the root `
                + `despite treatment (${arm.deaths} died in total, the rest at a wall)`
            ).toBe(0);
        }
    });

    it('and the medicine bill is inside what the worst work on any board pays', () => {
        // The load-bearing number, and the one the whole finding turns on. If a
        // dangerous root's medicine ever costs more in a year than a farmhand
        // earns in one, the root draw has stopped being a difficulty setting
        // and become a verdict.
        for (const root of DANGEROUS_ROOTS) {
            const perYear = cohort(root, true).woundsPerYear * TREATMENT_STONES;
            expect(
                perYear,
                `${root}: ${perYear.toFixed(1)} stones/year of medicine against a ` +
                `${WORST_VILLAGE_WAGE_PER_YEAR} stone/year wage`
            ).toBeLessThan(WORST_VILLAGE_WAGE_PER_YEAR);
        }
    });

    it('a treated dual root takes wounds at roughly its own innate risk', () => {
        const rate = cohort('dual_metal_wood', true).woundsPerYear;
        const innate = getSpiritRoot('dual_metal_wood').deviationRisk;
        // Twelve checks a year at the innate rate, give or take the checks lost
        // to a rank advance resetting the grid.
        expect(rate).toBeGreaterThan(0);
        expect(rate).toBeLessThan(innate * 12 * 1.6);
    });

    it('a single root takes them far more rarely, which is what makes it the good draw', () => {
        // Not zero, and the reason is worth knowing: a single root has 0 innate
        // risk, so every wound it takes comes from something it CHOSE - qi
        // accumulated past the bottleneck, or a breakthrough that failed. The
        // dangerous roots pay for existing; the clean ones pay for pushing.
        expect(cohort('single_wood', true).woundsPerYear)
            .toBeLessThan(cohort('dual_metal_wood', true).woundsPerYear / 4);
    });
});

describe('untreated, the same root is a death sentence, and that is the design', () => {
    it('open wounds raise the risk of the next one', () => {
        expect(RISK_PER_UNTREATED_INJURY).toBeGreaterThan(0);
    });

    it('so the untreated wound rate is far above the treated one', () => {
        for (const root of DANGEROUS_ROOTS) {
            const treated = cohort(root, true).woundsPerYear;
            const untreated = cohort(root, false).woundsPerYear;
            expect(untreated, `${root}`).toBeGreaterThan(treated * 1.3);
        }
    });

    it('and every one of them dies, low, exactly as the playthroughs found', () => {
        for (const root of DANGEROUS_ROOTS) {
            const arm = cohort(root, false);
            expect(arm.deaths, `${root} untreated`).toBe(SEEDS);
            // The hand-played runs died at ordinal 2-3. So does this.
            expect(arm.meanOrdinal, `${root} untreated mean ordinal`).toBeLessThan(5);
        }
    });

    it('while a clean root mostly survives the same neglect', () => {
        // The contrast that makes the escalation a root property rather than a
        // general cruelty: not immune, but not doomed either.
        expect(cohort('single_wood', false).deaths).toBeLessThan(SEEDS);
    });
});
