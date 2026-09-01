/**
 * Realm intake: can the ladder actually be climbed?
 *
 * ── What was found ───────────────────────────────────────────────────────
 *
 * A scaling harness run across ordinals 0-45 on ONE seed reported `cultivate`
 * for a month giving identical progress at every rung, 0 through 46, while
 * `assessPower` moved by a factor of 355,000 over the same column. Confirmed
 * directly against `computeCultivationRate` with everything but the ordinal
 * held constant: 1.500 qi-units per day at ordinal 0 and 1.500 at ordinal 46.
 * The rate function read no ordinal at all.
 *
 * Against a cost curve that grows at PROGRESS_GROWTH^ordinal, that made 23 of
 * the 45 climbable rungs cost more years than the settling clock allows anyone
 * to spend on them - the last of them by a factor of 14.9. The upper two thirds
 * of the ladder were unclimbable by cultivation, which is exactly the defect the
 * `stagnationYearsForOrdinal` note in schema/cultivation.ts describes having
 * diagnosed and repaired. It repaired the allowance and left the intake flat,
 * and these measurements are what that half-fix looks like from the other side.
 *
 * ── What these tests hold down ───────────────────────────────────────────
 *
 * Not the exponent - the CRITERION that selected it, so that a later tuning
 * pass has to re-satisfy the design rather than re-derive the number:
 *
 *   1. Every rung is affordable inside its own settling allowance, with margin.
 *   2. The profile does not invert: the upper realms are not made easier, in
 *      allowance-relative terms, than the early game.
 *   3. The early game does not move at all.
 *   4. The whole climb still takes ages, because the ancients did.
 */

import { describe, it, expect } from 'vitest';
import {
    computeCultivationRate,
    realmIntakeMultiplier,
    REALM_INTAKE_EXPONENT
} from '../../../src/engine/cultivation/cultivation.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    FOUNDATION_ORDINAL,
    powerMultiplierForOrdinal,
    progressRequiredForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import { stagnationYearsForOrdinal } from '../../../src/schema/cultivation.js';
import { makeCultivator } from './fixtures.js';

const DAYS_PER_YEAR = 365;

/** Years to earn the next rung, for a good-but-not-perfect cultivator. */
function yearsForRung(ordinal: number): number {
    const required = progressRequiredForOrdinal(ordinal);
    if (required === null) return 0;
    const rate = computeCultivationRate(
        makeCultivator({ realmOrdinal: ordinal, spiritRoot: 'single_fire' }),
        'normal'
    ).perDay;
    return required / rate / DAYS_PER_YEAR;
}

/** How much of the rung's settling allowance earning it consumes. */
function allowanceRatio(ordinal: number): number {
    return yearsForRung(ordinal) / stagnationYearsForOrdinal(ordinal);
}

const CLIMBABLE = Array.from({ length: FALSE_IMMORTAL_ORDINAL }, (_, i) => i);

describe('the rate reads the rung it is standing on', () => {
    it('is not identical at the top and the bottom of the ladder', () => {
        // The regression, stated as bluntly as it was found.
        const bottom = computeCultivationRate(makeCultivator({ realmOrdinal: 0 }), 'normal').perDay;
        const top = computeCultivationRate(
            makeCultivator({ realmOrdinal: FALSE_IMMORTAL_ORDINAL - 1 }), 'normal'
        ).perDay;
        expect(top).toBeGreaterThan(bottom);
    });

    it('itemises the realm as its own factor, so a breakdown can be read', () => {
        const factors = computeCultivationRate(
            makeCultivator({ realmOrdinal: 30 }), 'normal'
        ).factors;
        const realm = factors.find(f => f.source === 'realm');
        expect(realm).toBeDefined();
        expect(realm!.multiplier).toBeGreaterThan(1);
        // The label names the realm it priced, so a caller that forgot to pass
        // an ordinal shows "Qi Condensation intake" while standing at 30.
        expect(realm!.label).toMatch(/Void Refinement/);
    });

    it('reads the ladder rather than carrying a table of its own', () => {
        for (const ordinal of [0, 13, 21, 33, 44]) {
            expect(realmIntakeMultiplier(ordinal)).toBeCloseTo(
                Math.pow(powerMultiplierForOrdinal(ordinal), REALM_INTAKE_EXPONENT), 10
            );
        }
    });
});

describe('criterion 1: every rung is affordable inside its own allowance', () => {
    it('leaves no rung on the ladder costing more years than it is given', () => {
        for (const ordinal of CLIMBABLE) {
            const ratio = allowanceRatio(ordinal);
            expect(
                ratio,
                `ordinal ${ordinal}: ${yearsForRung(ordinal).toFixed(0)} years against an ` +
                `allowance of ${Math.round(stagnationYearsForOrdinal(ordinal))}`
            ).toBeLessThan(1);
        }
    });

    it('and leaves margin, so one bad deviation does not strand a run', () => {
        // The failure the CROSSING_TAX note in realms.ts records removing: at a
        // ratio near 1 a cultivator who loses progress to a deviation high on
        // the ladder can never afford another attempt. Not killed - stranded.
        const worst = Math.max(...CLIMBABLE.map(allowanceRatio));
        expect(worst).toBeLessThan(0.75);
    });
});

describe('criterion 2: the difficulty profile does not invert', () => {
    it('keeps the hardest rung at a realm wall rather than in the open', () => {
        const ratios = CLIMBABLE.map(allowanceRatio);
        const hardest = ratios.indexOf(Math.max(...ratios));
        // Foundation Perfection - the last rung before Core Formation, and the
        // wall the setting says most people never get past.
        expect(hardest).toBe(16);
    });

    it('does not make the upper ladder easier in absolute years', () => {
        // Higher rungs must still take longer to earn. The allowance grows
        // faster than the cost, which is what makes them affordable; the years
        // themselves must not fall.
        expect(yearsForRung(44)).toBeGreaterThan(yearsForRung(30));
        expect(yearsForRung(30)).toBeGreaterThan(yearsForRung(20));
        expect(yearsForRung(20)).toBeGreaterThan(yearsForRung(12));
    });
});

describe('criterion 3: the early game does not move', () => {
    it('is exactly 1 across every rung of Qi Condensation', () => {
        for (let ordinal = 0; ordinal < FOUNDATION_ORDINAL; ordinal++) {
            expect(realmIntakeMultiplier(ordinal)).toBe(1);
        }
    });

    it('so a beginner cultivates at precisely the rate they always did', () => {
        const withOrdinal = computeCultivationRate(
            makeCultivator({ realmOrdinal: 0, spiritRoot: 'single_fire' }), 'normal'
        ).perDay;
        // What the function returned before the term existed, and what every
        // caller that omits an ordinal still gets.
        expect(withOrdinal).toBe(1.5);
    });
});

describe('criterion 4: the climb still takes ages', () => {
    it('costs thousands of years from Foundation to the last crossing', () => {
        let years = 0;
        for (let ordinal = FOUNDATION_ORDINAL; ordinal < FALSE_IMMORTAL_ORDINAL; ordinal++) {
            years += yearsForRung(ordinal);
        }
        // Measured at ~4,839 for a perfect single root in ordinary qi with no
        // attrition, no tolls and no interruptions of any kind - which is to
        // say, a floor nobody will ever actually achieve. An ancient is
        // somebody who has been at this for ages, and this keeps them so.
        expect(years).toBeGreaterThan(2_500);
    });

    it('and the last crossing is still by far the dearest single rung', () => {
        expect(yearsForRung(44)).toBeGreaterThan(yearsForRung(43) * 3);
    });
});
