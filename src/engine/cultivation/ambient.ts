/**
 * Ambient spiritual energy.
 *
 * Where you cultivate matters roughly as much as what you cultivate. Ambient qi
 * is a 6x swing on progress rate (thin 0.5x to spirit_tide 3x) and a 35-point
 * swing on breakthrough odds (thin -0.15 to spirit_tide +0.20). It is the main
 * lever a player has over a fate they otherwise cannot negotiate with: you
 * cannot change your spirit root, but you can walk to a better mountain.
 *
 * The distribution is deliberately miserly - half the world is `thin` - so that
 * finding a dense-qi cave is an event rather than scenery.
 *
 * LOCATION STABILITY: ambient qi must be a pure function of (seed, location,
 * day). If it were drawn from a sequential stream, reading the same cave twice
 * on the same afternoon would give different answers and the world would
 * shimmer. {@link ambientForLocationOnDay} derives a dedicated sub-stream from
 * exactly those three coordinates, so re-reads are free and idempotent, and the
 * time-skip can sample day 900's ambient without having simulated day 899.
 */

import {
    AMBIENT_QI_WEIGHTS,
    AMBIENT_QI_BREAKTHROUGH_MOD,
    AMBIENT_QI_RATE_MULTIPLIER,
    type AmbientQi
} from '../../schema/cultivation.js';
import { forStream } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────
// TABLE ACCESS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Canonical iteration order for the weight table.
 *
 * Pinned here rather than relying on `Object.keys(AMBIENT_QI_WEIGHTS)` so that
 * a future reordering of the schema literal - a harmless-looking edit - cannot
 * silently shift every ambient roll in every existing replay.
 */
export const AMBIENT_QI_ORDER: readonly AmbientQi[] = [
    'thin', 'normal', 'spirit_tide', 'dense'
] as const;

/** Sum of the ambient weights. 100 by construction, computed so it stays true. */
export const AMBIENT_WEIGHT_TOTAL = AMBIENT_QI_ORDER.reduce(
    (sum, key) => sum + AMBIENT_QI_WEIGHTS[key],
    0
);

/** Cultivation-rate multiplier for these conditions. */
export function ambientRateMultiplier(ambient: AmbientQi): number {
    return AMBIENT_QI_RATE_MULTIPLIER[ambient];
}

/** Flat breakthrough-odds modifier for these conditions. */
export function ambientBreakthroughMod(ambient: AmbientQi): number {
    return AMBIENT_QI_BREAKTHROUGH_MOD[ambient];
}

/** Probability of drawing this band from an unbiased roll. */
export function ambientProbability(ambient: AmbientQi): number {
    return AMBIENT_QI_WEIGHTS[ambient] / AMBIENT_WEIGHT_TOTAL;
}

// ─────────────────────────────────────────────────────────────────────────
// ROLLING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Draw an ambient band from a uniform [0,1) sample.
 *
 * Takes the sample rather than an RNG, matching `rollSpiritRoot`: the caller
 * owns seeding, always.
 */
export function rollAmbientQi(sample: number): AmbientQi {
    const clamped = Math.max(0, Math.min(0.999999999, sample));
    let cursor = clamped * AMBIENT_WEIGHT_TOTAL;
    for (const key of AMBIENT_QI_ORDER) {
        cursor -= AMBIENT_QI_WEIGHTS[key];
        if (cursor < 0) return key;
    }
    // Float drift at the very top of the range; the last band is correct.
    return AMBIENT_QI_ORDER[AMBIENT_QI_ORDER.length - 1];
}

/**
 * The ambient qi at a location on a given day.
 *
 * Stable: same (seed, locationId, day) always yields the same band, no matter
 * how many times it is asked or in what order. `day` is floored, so fractional
 * in-world times within one day agree.
 */
export function ambientForLocationOnDay(
    runSeed: string,
    locationId: string,
    day: number
): AmbientQi {
    const wholeDay = Number.isFinite(day) ? Math.floor(day) : 0;
    const rng = forStream(runSeed, 'ambient', locationId, wholeDay);
    return rollAmbientQi(rng.next());
}

/**
 * How often ambient conditions are re-rolled during a long simulation.
 *
 * Weather-for-qi. Re-rolling daily would produce a digest full of noise and
 * make rate arithmetic pointless; re-rolling yearly would make location choice
 * a one-time decision. A month is the granularity at which "the tide came in
 * and I pushed for the breakthrough" is a story rather than a coin flip.
 */
export const AMBIENT_REFRESH_DAYS = 30;

/**
 * Start day of the ambient block containing `day`. Sampling on block starts is
 * what makes ambient independent of how the simulation chunked its time.
 */
export function ambientBlockStart(day: number): number {
    const wholeDay = Number.isFinite(day) ? Math.floor(day) : 0;
    return Math.floor(wholeDay / AMBIENT_REFRESH_DAYS) * AMBIENT_REFRESH_DAYS;
}

/** Ambient band governing the whole 30-day block that `day` falls in. */
export function ambientForBlock(
    runSeed: string,
    locationId: string,
    day: number
): AmbientQi {
    return ambientForLocationOnDay(runSeed, locationId, ambientBlockStart(day));
}

// ─────────────────────────────────────────────────────────────────────────
// DESCRIPTION
// Engine-authored factual phrasing. The narrator dresses these up; it does not
// get to invent a spirit tide that the engine did not roll.
// ─────────────────────────────────────────────────────────────────────────

const AMBIENT_DESCRIPTIONS: Record<AmbientQi, string> = {
    thin: 'The spiritual energy here is thin; cultivation is half as fast and breakthroughs are noticeably riskier.',
    normal: 'Spiritual energy here is unremarkable - neither help nor hindrance.',
    dense: 'Spiritual energy here is dense; cultivation runs at double rate and breakthroughs are easier.',
    spirit_tide: 'A spirit tide is running. Qi is three times as abundant as normal and the heavens are unusually permissive.'
};

export function describeAmbient(ambient: AmbientQi): string {
    return AMBIENT_DESCRIPTIONS[ambient];
}
