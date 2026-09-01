/**
 * Meridian injuries - the ratchet.
 */

import {
    INJURY_WEIGHTS,
    LETHAL_UNTREATED_INJURIES
} from '../../../src/schema/cultivation.js';
import {
    MAX_INJURY_BREAKTHROUGH_PENALTY,
    MAX_INJURY_CULTIVATION_PENALTY,
    MAX_TEMPERING,
    TEMPERING_PER_SCAR,
    scarTempering,
    aggregateInjuryPenalties,
    createInjury,
    defaultInjuryDescription,
    isLethalInjuryState,
    rollInjurySeverity,
    treatInjury,
    treatWorstInjuries,
    treatWorstInjury,
    untreatedInjuries,
    untreatedInjuryCount
} from '../../../src/engine/cultivation/injuries.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

describe('createInjury', () => {
    it('copies the severity weights onto the record', () => {
        const rng = new CultivationRNG('injury');
        for (const severity of ['minor', 'serious', 'crippling'] as const) {
            const injury = createInjury({ severity, source: 'combat', turn: 3 }, rng);
            expect(injury.cultivationPenalty).toBe(INJURY_WEIGHTS[severity].cultivationPenalty);
            expect(injury.breakthroughPenalty).toBe(INJURY_WEIGHTS[severity].breakthroughPenalty);
            expect(injury.treated).toBe(false);
            expect(injury.sustainedOnTurn).toBe(3);
        }
    });

    it('mints a reproducible id from the seeded stream', () => {
        const a = createInjury({ severity: 'minor', source: 'combat', turn: 1 }, new CultivationRNG('s'));
        const b = createInjury({ severity: 'minor', source: 'combat', turn: 1 }, new CultivationRNG('s'));
        expect(a.id).toBe(b.id);
        expect(a).toEqual(b);
    });

    it('composes a factual default description', () => {
        const rng = new CultivationRNG('desc');
        const injury = createInjury({ severity: 'serious', source: 'tribulation', turn: 0 }, rng);
        expect(injury.description).toBe(defaultInjuryDescription('serious', 'tribulation'));
        expect(injury.description).toContain('serious');
    });

    it('accepts an explicit description override', () => {
        const rng = new CultivationRNG('desc');
        const injury = createInjury(
            { severity: 'minor', source: 'poison', turn: 0, description: 'Corpse-lily venom.' },
            rng
        );
        expect(injury.description).toBe('Corpse-lily venom.');
    });
});

describe('rollInjurySeverity', () => {
    it('produces every severity and skews worse when escalated', () => {
        const plain = new CultivationRNG('sev-plain');
        const escalated = new CultivationRNG('sev-escalated');
        let plainCrippling = 0;
        let escalatedCrippling = 0;
        const N = 20_000;
        for (let i = 0; i < N; i++) {
            if (rollInjurySeverity(plain, false) === 'crippling') plainCrippling++;
            if (rollInjurySeverity(escalated, true) === 'crippling') escalatedCrippling++;
        }
        expect(plainCrippling).toBeGreaterThan(0);
        expect(escalatedCrippling).toBeGreaterThan(plainCrippling * 2);
    });
});

describe('aggregateInjuryPenalties', () => {
    it('reports nothing for an unwounded cultivator', () => {
        const penalties = aggregateInjuryPenalties([]);
        expect(penalties).toEqual({
            cultivationPenalty: 0,
            breakthroughPenalty: 0,
            // Wounds nothing in the world closes. Zero for anybody unwounded,
            // and counted separately because a permanent wound is priced like
            // an open one and excluded from the bleed clock. See
            // `bleedingInjuryCount`.
            permanentCount: 0,
            untreatedCount: 0,
            cultivationMultiplier: 1,
            lethalThresholdReached: false
        });
    });

    it('sums untreated injuries and ignores treated ones', () => {
        const injuries = makeInjuries(3, 'minor');
        const partially = treatInjury(injuries, injuries[0].id);
        const penalties = aggregateInjuryPenalties(partially);
        expect(penalties.untreatedCount).toBe(2);
        expect(penalties.cultivationPenalty).toBeCloseTo(0.2, 10);
        expect(penalties.breakthroughPenalty).toBeCloseTo(0.1, 10);
        expect(penalties.cultivationMultiplier).toBeCloseTo(0.8, 10);
    });

    it('clamps rather than letting the arithmetic go absurd', () => {
        const penalties = aggregateInjuryPenalties(makeInjuries(20, 'crippling'));
        expect(penalties.cultivationPenalty).toBe(MAX_INJURY_CULTIVATION_PENALTY);
        expect(penalties.breakthroughPenalty).toBe(MAX_INJURY_BREAKTHROUGH_PENALTY);
        expect(penalties.cultivationMultiplier).toBeGreaterThan(0);
    });
});

describe('isLethalInjuryState', () => {
    it('flips exactly at LETHAL_UNTREATED_INJURIES and not before', () => {
        for (let n = 0; n < LETHAL_UNTREATED_INJURIES; n++) {
            const cultivator = makeCultivator({ injuries: makeInjuries(n) });
            expect(isLethalInjuryState(cultivator)).toBe(false);
        }
        const atThreshold = makeCultivator({
            injuries: makeInjuries(LETHAL_UNTREATED_INJURIES)
        });
        expect(isLethalInjuryState(atThreshold)).toBe(true);
    });

    it('counts only untreated injuries', () => {
        const injuries = makeInjuries(LETHAL_UNTREATED_INJURIES);
        const treated = treatInjury(injuries, injuries[0].id);
        expect(isLethalInjuryState(makeCultivator({ injuries: treated }))).toBe(false);
        expect(untreatedInjuryCount(treated)).toBe(LETHAL_UNTREATED_INJURIES - 1);
        expect(untreatedInjuries(treated)).toHaveLength(LETHAL_UNTREATED_INJURIES - 1);
    });
});

describe('scarTempering', () => {
    it('pays nothing for a cultivator who has never been hurt', () => {
        expect(scarTempering([])).toEqual({
            scars: 0,
            breakthroughBonus: 0,
            deviationRelief: 0,
            wornScars: 0,
            rateAttrition: 0,
            breakthroughAttrition: 0,
            netBreakthroughModifier: 0
        });
    });

    it('pays nothing for wounds that are still open', () => {
        // The ratchet is untouched: an untreated injury is a liability and
        // never quietly becomes an asset.
        expect(scarTempering(makeInjuries(5, 'crippling')).breakthroughBonus).toBe(0);
    });

    it('pays only once the wound has actually been closed', () => {
        const injuries = makeInjuries(2, 'serious');
        expect(scarTempering(injuries).scars).toBe(0);
        const closed = treatWorstInjuries(injuries, 2).injuries;
        expect(scarTempering(closed).scars).toBe(2);
        expect(scarTempering(closed).breakthroughBonus).toBeCloseTo(
            2 * TEMPERING_PER_SCAR.serious,
            10
        );
    });

    it('pays more for a worse wound survived', () => {
        const closed = (severity: Parameters<typeof makeInjuries>[1]) =>
            scarTempering(treatWorstInjuries(makeInjuries(1, severity), 1).injuries)
                .breakthroughBonus;
        expect(closed('crippling')).toBeGreaterThan(closed('serious'));
        expect(closed('serious')).toBeGreaterThan(closed('minor'));
    });

    it('caps hard, so experience never becomes a second talent stat', () => {
        const veteran = treatWorstInjuries(makeInjuries(100, 'crippling'), 100).injuries;
        expect(scarTempering(veteran).breakthroughBonus).toBe(MAX_TEMPERING);
    });

    it('is worth half as much against deviation as at a breakthrough', () => {
        const closed = treatWorstInjuries(makeInjuries(3, 'serious'), 3).injuries;
        const tempering = scarTempering(closed);
        expect(tempering.deviationRelief).toBeCloseTo(tempering.breakthroughBonus / 2, 12);
    });
});

describe('treatment', () => {
    it('never mutates the input array or its records', () => {
        const injuries = makeInjuries(2);
        const before = JSON.parse(JSON.stringify(injuries));
        treatInjury(injuries, injuries[0].id);
        treatWorstInjury(injuries);
        treatWorstInjuries(injuries, 5);
        expect(injuries).toEqual(before);
    });

    it('is a no-op for an unknown id', () => {
        const injuries = makeInjuries(2);
        expect(treatInjury(injuries, 'not-an-id')).toEqual(injuries);
    });

    it('treats the worst wound first', () => {
        const rng = new CultivationRNG('triage');
        const injuries = [
            createInjury({ severity: 'minor', source: 'combat', turn: 1 }, rng),
            createInjury({ severity: 'crippling', source: 'qi_deviation', turn: 2 }, rng),
            createInjury({ severity: 'serious', source: 'combat', turn: 3 }, rng)
        ];
        const result = treatWorstInjury(injuries);
        expect(result.treated?.severity).toBe('crippling');
        expect(untreatedInjuryCount(result.injuries)).toBe(2);
    });

    it('breaks severity ties toward the oldest wound', () => {
        const rng = new CultivationRNG('triage-tie');
        const injuries = [
            createInjury({ severity: 'serious', source: 'combat', turn: 9 }, rng),
            createInjury({ severity: 'serious', source: 'combat', turn: 2 }, rng)
        ];
        expect(treatWorstInjury(injuries).treated?.sustainedOnTurn).toBe(2);
    });

    it('reports nothing to treat when everything is treated', () => {
        const result = treatWorstInjuries(makeInjuries(2), 10);
        expect(result.treatedCount).toBe(2);
        expect(untreatedInjuryCount(result.injuries)).toBe(0);
        expect(treatWorstInjury(result.injuries).treated).toBeNull();
    });
});
