/**
 * The owner's two axes: the rarity of the medicine scales with the severity of
 * the injury and the realm of the injured.
 *
 * Neither was in the resolver. Measured: a Nascent Soul cultivator at ordinal 26
 * carrying CRIPPLING torn meridians walked into a village, bought thirty days of
 * mortal splints for fourteen spirit stones, and was fully healed.
 *
 * The constraint that matters most here is the one pointing the other way.
 * Untreated meridian injuries were the leading cause of death in this game, and
 * the whole of it was the cure being invisible rather than absent; making it
 * visible moved the median peak from rung 2 to rung 9 and the median age at
 * death from 22 to 100. NOTHING HERE MAY UNDO THAT, so the bottom of the ladder
 * is pinned as hard as the top.
 */

import {
    medicineNeededFor,
    medicineReaches,
    medicineRank,
    realmFloor,
    severityFloor
} from '../../../src/engine/cultivation/what-grade-of-medicine-a-wound-needs.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';

describe('the bottom of the ladder stays open', () => {
    /**
     * The beginner route, pinned. A minor or serious tear through Qi
     * Condensation and Foundation Establishment is mortal grade - a month and a
     * few stones - which is where 84% of runs live and die.
     */
    it('leaves an ordinary tear on an ordinary cultivator to ordinary care', () => {
        for (let ordinal = 0; ordinal <= FOUNDATION_ORDINAL; ordinal++) {
            for (const severity of ['minor', 'serious'] as const) {
                expect(
                    medicineReaches('mortal', severity, ordinal),
                    `${severity} at ordinal ${ordinal} was gated out of mortal care`
                ).toBe(true);
            }
        }
    });
});

describe('the severity axis', () => {
    /**
     * Straight from the catalog: the Meridian Rebirth Pill's own description
     * says it is "the only medicine below immortal grade that touches crippling
     * damage", and it is heaven grade.
     */
    it('puts crippling damage at heaven grade, wherever it is carried', () => {
        expect(severityFloor('crippling')).toBe('heaven');
        expect(medicineReaches('mortal', 'crippling', 0)).toBe(false);
        expect(medicineReaches('earth', 'crippling', 0)).toBe(false);
        expect(medicineReaches('heaven', 'crippling', 0)).toBe(true);
    });

    it('does not invent a rule for minor or serious', () => {
        expect(severityFloor('minor')).toBe('mortal');
        expect(severityFloor('serious')).toBe('mortal');
    });
});

describe('the realm axis', () => {
    it('rises with the body, never falls', () => {
        let last = -1;
        for (let ordinal = 0; ordinal <= 45; ordinal++) {
            const rank = medicineRank(realmFloor(ordinal));
            expect(rank, `realm floor fell at ordinal ${ordinal}`).toBeGreaterThanOrEqual(last);
            last = rank;
        }
    });

    /**
     * The reported case, exactly. A Nascent Soul body is not mended by a
     * village splint, whatever is wrong with it.
     */
    it('puts a Nascent Soul beyond mortal care even for a scratch', () => {
        expect(medicineReaches('mortal', 'minor', 26)).toBe(false);
        expect(medicineNeededFor('crippling', 26)).toBe('heaven');
    });
});

describe('the two together', () => {
    it('takes the rarer of the two floors', () => {
        // Severity wins low: crippling on a novice.
        expect(medicineNeededFor('crippling', 0)).toBe(severityFloor('crippling'));
        // Realm wins high: a scratch at the top of the ladder.
        expect(medicineNeededFor('minor', 45)).toBe(realmFloor(45));
    });

    it('never asks for less than either floor alone', () => {
        for (const ordinal of [0, 13, 20, 26, 31, 40, 45]) {
            for (const severity of ['minor', 'serious', 'crippling'] as const) {
                const needed = medicineRank(medicineNeededFor(severity, ordinal));
                expect(needed).toBeGreaterThanOrEqual(medicineRank(severityFloor(severity)));
                expect(needed).toBeGreaterThanOrEqual(medicineRank(realmFloor(ordinal)));
            }
        }
    });
});
