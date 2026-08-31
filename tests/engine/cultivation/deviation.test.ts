/**
 * Qi deviation.
 */

import {
    CONFLICTING_TECHNIQUE_RISK,
    DEVIATION_PROGRESS_LOSS,
    MAX_DEVIATION_RISK,
    OVERFULL_PROGRESS_RISK,
    RISK_PER_UNTREATED_INJURY,
    deviationRisk,
    resolveDeviation,
    rollDeviation,
    rollDeviationSeverity
} from '../../../src/engine/cultivation/deviation.js';
import { getSpiritRoot } from '../../../src/engine/cultivation/spirit-roots.js';
import { CultivationRNG, forStream } from '../../../src/engine/cultivation/rng.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

describe('deviationRisk', () => {
    it('is zero for a clean root cultivating an elementless art', () => {
        const breakdown = deviationRisk(makeCultivator({ spiritRoot: 'single_fire' }));
        expect(breakdown.risk).toBe(0);
        expect(breakdown.techniqueConflicts).toBe(false);
        expect(breakdown.sources.map(s => s.source)).toEqual(['spirit_root']);
    });

    it('is permanently non-zero for a dual root, whatever it cultivates', () => {
        const cultivator = makeCultivator({ spiritRoot: 'dual_water_fire' });
        expect(deviationRisk(cultivator).risk).toBe(
            getSpiritRoot('dual_water_fire').deviationRisk
        );
        expect(deviationRisk(cultivator, { techniqueElement: 'water' }).techniqueConflicts).toBe(true);
    });

    it('prices a conflicting technique above any root\'s innate instability', () => {
        // Water overcomes fire; a single fire root practising a water art is
        // making a choice, and that choice must cost more than merely existing
        // as a dual root.
        const conflicted = deviationRisk(makeCultivator({ spiritRoot: 'single_fire' }), {
            techniqueElement: 'water'
        });
        expect(conflicted.risk).toBeCloseTo(CONFLICTING_TECHNIQUE_RISK, 10);
        expect(conflicted.risk).toBeGreaterThan(getSpiritRoot('dual_water_fire').deviationRisk);
        expect(conflicted.sources.map(s => s.source)).toContain('conflicting_technique');
    });

    it('does not flag a matched or neutral element as a conflict', () => {
        const fire = makeCultivator({ spiritRoot: 'single_fire' });
        expect(deviationRisk(fire, { techniqueElement: 'fire' }).risk).toBe(0);
        expect(deviationRisk(fire, { techniqueElement: 'lightning' }).risk).toBe(0);
    });

    it('compounds with untreated injuries', () => {
        const wounded = makeCultivator({
            spiritRoot: 'single_fire',
            injuries: makeInjuries(3, 'minor')
        });
        const breakdown = deviationRisk(wounded);
        expect(breakdown.risk).toBeCloseTo(3 * RISK_PER_UNTREATED_INJURY, 10);
    });

    it('adds a penalty for sitting on progress past the bottleneck', () => {
        const breakdown = deviationRisk(makeCultivator(), { overfullProgress: true });
        expect(breakdown.risk).toBeCloseTo(OVERFULL_PROGRESS_RISK, 10);
    });

    it('sums its itemised sources to the pre-clamp risk', () => {
        const cultivator = makeCultivator({
            spiritRoot: 'dual_water_fire',
            injuries: makeInjuries(2, 'serious')
        });
        const breakdown = deviationRisk(cultivator, {
            techniqueElement: 'water',
            overfullProgress: true
        });
        const sum = breakdown.sources.reduce((n, s) => n + s.delta, 0);
        expect(Math.min(sum, MAX_DEVIATION_RISK)).toBeCloseTo(breakdown.risk, 12);
    });

    it('never exceeds the ceiling, however catastrophic the build', () => {
        const doomed = makeCultivator({
            spiritRoot: 'mutated_ice',
            injuries: makeInjuries(40, 'crippling')
        });
        const breakdown = deviationRisk(doomed, {
            techniqueElement: 'water',
            overfullProgress: true
        });
        expect(breakdown.risk).toBe(MAX_DEVIATION_RISK);
    });
});

describe('rollDeviation', () => {
    it('never deviates at zero risk, however many times it is rolled', () => {
        const clean = makeCultivator({ spiritRoot: 'single_fire' });
        for (let day = 0; day < 500; day++) {
            const check = rollDeviation(clean, forStream('seed', 'deviation', day));
            expect(check.deviated).toBe(false);
            expect(check.risk).toBe(0);
        }
    });

    it('deviates at approximately the stated rate', () => {
        const dual = makeCultivator({ spiritRoot: 'dual_water_fire' });
        const rng = new CultivationRNG('deviation-rate');
        const N = 50_000;
        let deviations = 0;
        for (let i = 0; i < N; i++) {
            if (rollDeviation(dual, rng).deviated) deviations++;
        }
        expect(deviations / N).toBeCloseTo(getSpiritRoot('dual_water_fire').deviationRisk, 2);
    });

    it('consumes exactly one sample regardless of the risk', () => {
        const clean = new CultivationRNG('alignment');
        const dual = new CultivationRNG('alignment');
        rollDeviation(makeCultivator({ spiritRoot: 'single_fire' }), clean);
        rollDeviation(makeCultivator({ spiritRoot: 'dual_water_fire' }), dual);
        // Both streams have advanced by the same amount, so they still agree.
        expect(clean.next()).toBe(dual.next());
    });

    it('is reproducible from the day-keyed stream', () => {
        const dual = makeCultivator({ spiritRoot: 'dual_water_fire' });
        const first = rollDeviation(dual, forStream('seed', 'deviation', 900));
        const second = rollDeviation(dual, forStream('seed', 'deviation', 900));
        expect(second).toEqual(first);
    });
});

describe('resolveDeviation', () => {
    it('returns deltas without mutating the cultivator', () => {
        const cultivator = makeCultivator({ cultivationProgress: 1000, hp: 50 });
        const before = JSON.parse(JSON.stringify(cultivator));
        const resolution = resolveDeviation(cultivator, new CultivationRNG('r'), { turn: 4 });

        expect(cultivator).toEqual(before);
        expect(resolution.injuries).toHaveLength(1);
        expect(resolution.injuries[0].source).toBe('qi_deviation');
        expect(resolution.injuries[0].sustainedOnTurn).toBe(4);
        expect(resolution.progressLost).toBeCloseTo(
            1000 * DEVIATION_PROGRESS_LOSS[resolution.severity],
            10
        );
        expect(resolution.summary).toContain('Qi deviation');
    });

    it('never takes more HP than the cultivator has', () => {
        for (let i = 0; i < 200; i++) {
            const cultivator = makeCultivator({ hp: 3, maxHp: 50, cultivationProgress: 10 });
            const resolution = resolveDeviation(cultivator, forStream('s', 'dev', i), { turn: 0 });
            expect(resolution.hpLost).toBeGreaterThan(0);
            expect(resolution.hpLost).toBeLessThanOrEqual(3);
        }
    });

    it('scales progress loss proportionally rather than by a flat amount', () => {
        const small = resolveDeviation(
            makeCultivator({ cultivationProgress: 100 }),
            new CultivationRNG('same'),
            { turn: 0 }
        );
        const large = resolveDeviation(
            makeCultivator({ cultivationProgress: 1_000_000 }),
            new CultivationRNG('same'),
            { turn: 0 }
        );
        expect(large.severity).toBe(small.severity);
        expect(large.progressLost / small.progressLost).toBeCloseTo(10_000, 6);
    });

    it('escalates severity when the deviation happens somewhere worse', () => {
        let plainCrippling = 0;
        let escalatedCrippling = 0;
        const plain = new CultivationRNG('sev-plain');
        const escalated = new CultivationRNG('sev-escalated');
        const N = 20_000;
        for (let i = 0; i < N; i++) {
            if (rollDeviationSeverity(plain, false) === 'crippling') plainCrippling++;
            if (rollDeviationSeverity(escalated, true) === 'crippling') escalatedCrippling++;
        }
        expect(escalatedCrippling).toBeGreaterThan(plainCrippling * 2);
    });
});
