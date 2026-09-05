/**
 * Ambient qi is anchored to the ground, not drawn from a global distribution.
 *
 * The bug this file exists to prevent: standing in Burnt Earth, being told the
 * qi is thin and always has been, and then ninety days later - never having
 * moved - being told the air is thick enough to notice on the first breath.
 * Ambient was stable per call but re-rolled freely per 30-day block from one
 * global table, so a drawn-down province came up dense about one month in
 * twenty and a rich vein came up thin half the time.
 *
 * The variation is weather. The baseline is geology, and geology does not
 * wander.
 */

import {
    AMBIENT_QI_ORDER,
    BAND_DENSITY_CENTRE,
    TIDE_SHARE,
    ambientForBlock,
    ambientForLocationOnDay,
    ambientWeightsForDensity,
    impliedDensityFor,
    isTypicalForGround,
    rollAmbientAtDensity,
    typicalAmbientFor
} from '../../../src/engine/cultivation/ambient.js';
import { type AmbientQi } from '../../../src/schema/cultivation.js';

/** Bands over a long stretch of months at one unmoving location. */
function months(density: number | undefined, locationId = 'sweptground', n = 600) {
    const counts: Record<string, number> = { thin: 0, normal: 0, dense: 0, spirit_tide: 0, sealed_vein: 0 };
    for (let i = 0; i < n; i++) {
        counts[ambientForBlock('run-seed', locationId, i * 30, { density })]++;
    }
    const share = (b: AmbientQi) => counts[b] / n;
    return { counts, share };
}

describe('a place has a baseline', () => {
    it('keeps a drawn-down province thin nearly always', () => {
        const { share } = months(0.15);
        expect(share('thin')).toBeGreaterThan(0.75);
        // An occasional better month, and that is all.
        expect(share('normal')).toBeLessThan(0.25);
        // Dense in Burnt Earth is essentially off the table.
        expect(share('dense')).toBeLessThan(0.01);
    });

    it('keeps a rich vein dense nearly always', () => {
        const { share } = months(0.8, 'azure-cloud-peak');
        expect(share('dense')).toBeGreaterThan(0.9);
        expect(share('thin')).toBeLessThan(0.02);
    });

    it('keeps ordinary inhabited land ordinary', () => {
        const { share } = months(0.45, 'low-fall');
        expect(share('normal')).toBeGreaterThan(0.8);
    });

    it('does not let ninety days turn thin ground rich', () => {
        // The exact playtest sequence: same place, three months apart.
        const density = 0.15;
        const day0 = ambientForBlock('run-seed', 'sweptground', 0, { density });
        const day90 = ambientForBlock('run-seed', 'sweptground', 90, { density });
        expect(day0).toBe('thin');
        expect(day90).toBe('thin');
    });

    it('never reports dense in a thin province across fifty years', () => {
        for (let day = 0; day < 50 * 365; day += 30) {
            expect(ambientForBlock('run-seed', 'sweptground', day, { density: 0.1 }))
                .not.toBe('dense');
        }
    });
});

describe('the weather still moves', () => {
    it('gives a thin place better months without giving it good ones', () => {
        const { share } = months(0.2);
        expect(share('normal')).toBeGreaterThan(0.01);
        expect(share('thin')).toBeGreaterThan(0.5);
    });

    it('is stable within a block and may differ between blocks', () => {
        const density = 0.3;
        const first = ambientForLocationOnDay('s', 'p', 0, { density });
        for (let day = 0; day < 30; day++) {
            expect(ambientForBlock('s', 'p', day, { density })).toBe(first);
        }
        const bands = new Set(
            Array.from({ length: 400 }, (_, i) => ambientForBlock('s', 'p', i * 30, { density }))
        );
        expect(bands.size).toBeGreaterThan(1);
    });
});

describe('spirit tides are not geology', () => {
    it('fall at the same rate on swept ground and on a sect mountain', () => {
        const poor = months(0.1, 'sweptground', 4000).share('spirit_tide');
        const rich = months(0.85, 'azure-cloud-peak', 4000).share('spirit_tide');
        expect(Math.abs(poor - rich)).toBeLessThan(0.01);
    });

    it('stay rare everywhere', () => {
        for (const density of [0.1, 0.3, 0.5, 0.7, 0.9]) {
            const weights = ambientWeightsForDensity(density);
            expect(weights.spirit_tide).toBe(TIDE_SHARE);
            expect(weights.spirit_tide).toBeLessThan(0.05);
        }
    });
});

describe('the weight table itself', () => {
    it('sums to one at every density', () => {
        for (let d = 0; d <= 1.0001; d += 0.05) {
            const w = ambientWeightsForDensity(d);
            const total = AMBIENT_QI_ORDER.reduce((s, b) => s + w[b], 0);
            expect(total).toBeCloseTo(1, 10);
        }
    });

    it('moves the centre of mass upward as the ground gets richer', () => {
        let previous = -1;
        for (let d = 0.05; d <= 0.95; d += 0.1) {
            const w = ambientWeightsForDensity(d);
            const centre = w.thin * BAND_DENSITY_CENTRE.thin
                + w.normal * BAND_DENSITY_CENTRE.normal
                + w.dense * BAND_DENSITY_CENTRE.dense;
            expect(centre).toBeGreaterThan(previous);
            previous = centre;
        }
    });

    it('never produces a sealed vein, however rich the ground', () => {
        for (let d = 0; d <= 1; d += 0.02) {
            for (let i = 0; i < 200; i++) {
                expect(rollAmbientAtDensity(i / 200, d)).not.toBe('sealed_vein');
            }
        }
    });

    it('still honours a declared sealed site over the geology', () => {
        expect(ambientForBlock('s', 'ruin', 0, { density: 0.05, sealed: true }))
            .toBe('sealed_vein');
    });

    it('gives even an unknown location a baseline that holds all run', () => {
        // No world data, so the engine implies a density from the place's own
        // name - once. It is a guess, but it is a guess that does not change,
        // which is the whole difference from the bug.
        const shares: Record<string, number> = { thin: 0, normal: 0, dense: 0, spirit_tide: 0 };
        for (let i = 0; i < 600; i++) shares[ambientForBlock('s', 'nowhere', i * 30)]++;
        const dominant = Object.entries(shares).sort((a, b) => b[1] - a[1])[0];
        expect(dominant[1] / 600).toBeGreaterThan(0.7);
    });

    it('implies a stable density per place, and different ones per place', () => {
        const a = impliedDensityFor('run', 'sweptground');
        expect(impliedDensityFor('run', 'sweptground')).toBe(a);
        expect(impliedDensityFor('run', 'azure-cloud-peak')).not.toBe(a);
        // A different run is a different world.
        expect(impliedDensityFor('other-run', 'sweptground')).not.toBe(a);
    });

    it('makes most places poor, because the world is late', () => {
        const densities = Array.from({ length: 3000 }, (_, i) =>
            impliedDensityFor('run', `place-${i}`)
        );
        const poor = densities.filter(d => d < 0.3).length / densities.length;
        const rich = densities.filter(d => d > 0.6).length / densities.length;
        expect(poor).toBeGreaterThan(0.6);
        expect(rich).toBeLessThan(0.15);
        expect(rich).toBeGreaterThan(0);
    });
});

describe('the engine does not hand the narrator permanent claims', () => {
    it('reports what the ground ordinarily gives, separately from today', () => {
        expect(typicalAmbientFor(0.1)).toBe('thin');
        expect(typicalAmbientFor(0.45)).toBe('normal');
        expect(typicalAmbientFor(0.8)).toBe('dense');
    });

    it('lets a caller tell geology from weather', () => {
        // "Thin, and it always has been" is a claim about the ground, and is
        // only earned on ground that is actually thin.
        expect(isTypicalForGround('thin', 0.1)).toBe(true);
        expect(isTypicalForGround('thin', 0.45)).toBe(false);
        expect(isTypicalForGround('dense', 0.8)).toBe(true);
        expect(isTypicalForGround('spirit_tide', 0.8)).toBe(false);
    });

    it('agrees with what the place actually reports over a long stretch', () => {
        for (const density of [0.1, 0.3, 0.45, 0.62, 0.85]) {
            const { counts } = months(density, `place-${density}`, 800);
            const observed = (Object.entries(counts) as [AmbientQi, number][])
                .sort((a, b) => b[1] - a[1])[0][0];
            expect(observed).toBe(typicalAmbientFor(density));
        }
    });
});
