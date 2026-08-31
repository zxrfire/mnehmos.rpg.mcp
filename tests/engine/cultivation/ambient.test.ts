/**
 * Ambient spiritual energy.
 *
 * The property that matters most here is stability: reading the same place on
 * the same day twice must give the same answer, or the world shimmers and the
 * time-skip stops being reproducible.
 */

import {
    AMBIENT_QI_BREAKTHROUGH_MOD,
    AMBIENT_QI_RATE_MULTIPLIER,
    AMBIENT_QI_WEIGHTS,
    type AmbientQi
} from '../../../src/schema/cultivation.js';
import {
    AMBIENT_QI_ORDER,
    AMBIENT_REFRESH_DAYS,
    AMBIENT_WEIGHT_TOTAL,
    ambientBlockStart,
    ambientBreakthroughMod,
    ambientForBlock,
    ambientForLocationOnDay,
    ambientProbability,
    ambientRateMultiplier,
    describeAmbient,
    rollAmbientQi
} from '../../../src/engine/cultivation/ambient.js';

describe('ambient qi tables', () => {
    it('sums the declared weights to 100', () => {
        expect(AMBIENT_WEIGHT_TOTAL).toBe(100);
        // Every ROLLABLE band is in the order, and the order is the only thing
        // the roll walks. `sealed_vein` is deliberately absent: it carries
        // weight 0 and exists only where a caller declares a sealed site, so
        // no amount of travelling can produce one.
        const rollable = (Object.keys(AMBIENT_QI_WEIGHTS) as AmbientQi[])
            .filter(band => AMBIENT_QI_WEIGHTS[band] > 0);
        expect([...AMBIENT_QI_ORDER].sort()).toEqual([...rollable].sort());
        expect(AMBIENT_QI_ORDER).not.toContain('sealed_vein');
        expect(AMBIENT_QI_WEIGHTS.sealed_vein).toBe(0);
    });

    it('reads its multipliers straight from the schema', () => {
        for (const band of AMBIENT_QI_ORDER) {
            expect(ambientRateMultiplier(band)).toBe(AMBIENT_QI_RATE_MULTIPLIER[band]);
            expect(ambientBreakthroughMod(band)).toBe(AMBIENT_QI_BREAKTHROUGH_MOD[band]);
            expect(describeAmbient(band).length).toBeGreaterThan(0);
        }
    });

    it('keeps thin qi a real penalty and a spirit tide a real gift', () => {
        expect(ambientRateMultiplier('thin')).toBeLessThan(1);
        expect(ambientRateMultiplier('spirit_tide')).toBeGreaterThan(
            ambientRateMultiplier('dense')
        );
        expect(ambientBreakthroughMod('thin')).toBeLessThan(0);
        expect(ambientBreakthroughMod('normal')).toBe(0);
        expect(ambientBreakthroughMod('spirit_tide')).toBeGreaterThan(0);
    });
});

describe('rollAmbientQi', () => {
    it('maps the cumulative weight bands exactly', () => {
        // thin 0-50, normal 50-85, spirit_tide 85-95, dense 95-100.
        expect(rollAmbientQi(0)).toBe('thin');
        expect(rollAmbientQi(0.4999)).toBe('thin');
        expect(rollAmbientQi(0.5)).toBe('normal');
        expect(rollAmbientQi(0.8499)).toBe('normal');
        expect(rollAmbientQi(0.85)).toBe('spirit_tide');
        expect(rollAmbientQi(0.9499)).toBe('spirit_tide');
        expect(rollAmbientQi(0.95)).toBe('dense');
        expect(rollAmbientQi(0.999999999)).toBe('dense');
    });

    it('clamps out-of-range samples instead of returning undefined', () => {
        expect(rollAmbientQi(-1)).toBe('thin');
        expect(rollAmbientQi(2)).toBe('dense');
    });

    it('reproduces the declared distribution over a uniform sweep', () => {
        const counts: Record<AmbientQi, number> = {
            thin: 0, normal: 0, dense: 0, spirit_tide: 0
        };
        const N = 100_000;
        for (let i = 0; i < N; i++) counts[rollAmbientQi(i / N)]++;
        for (const band of AMBIENT_QI_ORDER) {
            expect(counts[band] / N).toBeCloseTo(ambientProbability(band), 3);
        }
    });
});

describe('location stability', () => {
    it('gives the same answer for the same location and day, every time', () => {
        const first = ambientForLocationOnDay('seed-1', 'cave-of-echoes', 42);
        for (let i = 0; i < 25; i++) {
            expect(ambientForLocationOnDay('seed-1', 'cave-of-echoes', 42)).toBe(first);
        }
    });

    it('ignores the fractional part of the day', () => {
        expect(ambientForLocationOnDay('seed-1', 'cave', 42.0)).toBe(
            ambientForLocationOnDay('seed-1', 'cave', 42.99)
        );
    });

    it('varies across locations and across days', () => {
        // Not a per-call assertion - two draws can legitimately agree. Over a
        // sweep the two locations must not be locked together.
        const days = Array.from({ length: 400 }, (_, d) => d);
        const here = days.map(d => ambientForLocationOnDay('seed-1', 'cave', d));
        const there = days.map(d => ambientForLocationOnDay('seed-1', 'peak', d));
        expect(here).not.toEqual(there);
        expect(new Set(here).size).toBeGreaterThan(1);
    });

    it('varies across run seeds so two runs are not the same world', () => {
        const days = Array.from({ length: 400 }, (_, d) => d);
        const runA = days.map(d => ambientForLocationOnDay('seed-A', 'cave', d));
        const runB = days.map(d => ambientForLocationOnDay('seed-B', 'cave', d));
        expect(runA).not.toEqual(runB);
    });
});

describe('ambient blocks', () => {
    it('holds one band for the whole refresh window', () => {
        const start = ambientBlockStart(37);
        expect(start).toBe(AMBIENT_REFRESH_DAYS);
        const band = ambientForBlock('seed-1', 'cave', start);
        for (let d = start; d < start + AMBIENT_REFRESH_DAYS; d++) {
            expect(ambientForBlock('seed-1', 'cave', d)).toBe(band);
        }
    });

    it('agrees with the day-level lookup at the block start', () => {
        expect(ambientForBlock('seed-1', 'cave', 45)).toBe(
            ambientForLocationOnDay('seed-1', 'cave', 30)
        );
    });

    it('does not shimmer when a caller re-reads the same block out of order', () => {
        const days = [900, 12, 900, 3650, 12, 3650];
        const readings = days.map(d => ambientForBlock('seed-1', 'cave', d));
        expect(readings[0]).toBe(readings[2]);
        expect(readings[1]).toBe(readings[4]);
        expect(readings[3]).toBe(readings[5]);
    });
});
