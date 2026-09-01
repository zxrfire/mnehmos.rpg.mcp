/**
 * Does the ground under a place actually reach the time skip?
 *
 * `geology.test.ts` proves `ambient.ts` anchors the band on a location's
 * density. That proof is worth nothing if the density never arrives, and for a
 * while it did not: `TimeSkipContext.locationDensity` and `SiteConditions`
 * exist, are correct, are tested, and were passed by nobody. Every skip in the
 * running game fell through to `impliedDensityFor`, which guesses from the
 * place's NAME - and guesses poor, by design, because the world is late.
 *
 * Measured while writing this file, over the whole implied-density curve:
 *
 *   64.1% of places come out typically thin
 *   25.2% typically normal
 *   10.8% typically dense
 *
 * So a location the world layer holds at usable density 1.0 - the richest
 * drawable ground there is, where `ambientWeightsForDensity(1)` puts 98.4% of
 * its weight on `dense` - was reported thin six months running, because none of
 * that 1.0 was in the arguments. The ambient band is up to a 6x swing on
 * progress rate (thin 0.5, spirit tide 3.0), which is the difference between a
 * ladder that can be climbed past the middle and one that cannot.
 *
 * These tests hold the engine half of that contract down. The caller half - the
 * web layer joining `cultivator.location` to a real world location and passing
 * its `environment.spiritualDensity` - is not testable from here and is not in
 * this file's tree. What is testable, and what would have caught it, is that
 * supplying the density changes the outcome and omitting it does not merely
 * lose accuracy but actively substitutes a different world.
 */

import { describe, it, expect } from 'vitest';
import { simulateTimeSkip, ambientDuringSkip } from '../../../src/engine/cultivation/time-skip.js';
import {
    ambientWeightsForDensity,
    impliedDensityFor,
    typicalAmbientFor
} from '../../../src/engine/cultivation/ambient.js';
import { AMBIENT_QI_RATE_MULTIPLIER } from '../../../src/schema/cultivation.js';
import { makeCultivator } from './fixtures.js';

const RICH_PLACE = 'the sealed compound at Blackbank';
const SEED = 'ground-in-the-skip';

function skipAt(density: number | undefined, days = 3600) {
    return simulateTimeSkip(makeCultivator({ satiety: 100 }), days, {
        seed: SEED,
        locationId: RICH_PLACE,
        ...(density === undefined ? {} : { locationDensity: density }),
        autoBreakthrough: false,
        randomEvents: false,
        // Fed throughout, so the only thing separating these runs is the ground.
        rations: 100
    });
}

describe('the skip honours the ground it is handed', () => {
    it('turns a rich location into a rich decade', () => {
        const rich = skipAt(1.0);
        const poor = skipAt(0.08);
        expect(rich.deltas.cultivationProgress)
            .toBeGreaterThan(poor.deltas.cultivationProgress * 2);
    });

    it('reports the band from the density, not from the place name', () => {
        for (const day of [0, 30, 300, 3000]) {
            expect(ambientDuringSkip(
                { seed: SEED, locationId: RICH_PLACE, locationDensity: 1.0 }, day
            )).not.toBe('thin');
        }
    });

    it('still lets a sealed pocket override the geology entirely', () => {
        expect(ambientDuringSkip(
            { seed: SEED, locationId: RICH_PLACE, locationDensity: 1.0, sealed: true }, 0
        )).toBe('sealed_vein');
    });
});

describe('omitting the density is not a small loss', () => {
    it('substitutes a guess that is usually poor, whatever the ground holds', () => {
        // The hazard, stated as a number so it cannot be waved away. If this
        // ever stops being true the fallback has become harmless and this file
        // can relax; while it IS true, every caller must pass the real density.
        let thin = 0;
        const samples = 5000;
        for (let i = 0; i < samples; i++) {
            if (typicalAmbientFor(impliedDensityFor(SEED, `place-${i}`)) === 'thin') thin++;
        }
        expect(thin / samples).toBeGreaterThan(0.5);
    });

    it('costs a rich place most of what its ground is worth', () => {
        // Same seed, same place, same span, same food. The only difference is
        // whether the caller told the engine what it was standing on.
        const told = skipAt(1.0);
        const untold = skipAt(undefined);
        expect(untold.deltas.cultivationProgress)
            .toBeLessThan(told.deltas.cultivationProgress);
    });

    it('and the swing it throws away is the biggest multiplier in the game', () => {
        // Not a tuning detail. Thin to spirit tide is 6x, and thin to dense -
        // the ordinary weather of ordinary rich ground - is 4x.
        expect(AMBIENT_QI_RATE_MULTIPLIER.spirit_tide / AMBIENT_QI_RATE_MULTIPLIER.thin)
            .toBeGreaterThanOrEqual(6);
        expect(AMBIENT_QI_RATE_MULTIPLIER.dense / AMBIENT_QI_RATE_MULTIPLIER.thin)
            .toBeGreaterThanOrEqual(4);
    });

    it('the maximum-density weight table is overwhelmingly dense, so the engine is not at fault', () => {
        const w = ambientWeightsForDensity(1.0);
        expect(w.dense).toBeGreaterThan(0.95);
        expect(w.thin).toBeLessThan(1e-6);
    });
});
