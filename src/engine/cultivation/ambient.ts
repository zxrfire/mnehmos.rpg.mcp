/**
 * Ambient spiritual energy.
 */

import {
    AMBIENT_QI_WEIGHTS,
    AMBIENT_QI_BREAKTHROUGH_MOD,
    AMBIENT_QI_RATE_MULTIPLIER,
    type AmbientQi
} from '../../schema/cultivation.js';
import { forStream } from './rng.js';

// TABLE ACCESS

/**
 * Canonical iteration order for the weight table.
 */
export const AMBIENT_QI_ORDER: readonly AmbientQi[] = [
    'thin', 'normal', 'spirit_tide', 'dense'
] as const;

/**
 * Bands that exist but the world never rolls.
 */
export const SITE_ONLY_BANDS: readonly AmbientQi[] = ['sealed_vein'] as const;

/** Whether this band can arise from ordinary ambient conditions anywhere. */
export function isReachableByTravel(band: AmbientQi): boolean {
    return !SITE_ONLY_BANDS.includes(band);
}

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

// ROLLING

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
 */
// GEOLOGY, AND THE WEATHER ON TOP OF IT
//
// Ambient qi is anchored to what the ground under a place actually holds. The
// month-to-month variation is weather; the baseline is geology, and geology
// does not wander.
//
// This was wrong for a while and the bug is worth recording. `rollAmbientQi`
// sampled one global distribution for every location, using the place only as
// a seed input, so a drawn-down province came up `dense` roughly one month in
// twenty and a rich vein came up `thin` half the time. Standing in Burnt Earth
// for ninety days was enough to watch it turn from "thin, and it always has
// been" into "thick enough to notice on the first breath".
//
// That is not a cosmetic problem. It undoes the vein economy, it undoes sects
// being old because they sit on rich ground, it undoes thin regions having a
// hard local ceiling, and it makes standing anywhere equivalent to standing
// anywhere else given enough months - which removes the consequence from the
// one decision the setting most wants to have consequences.
//
// So the draw is centred on the location's own usable density. A thin place is
// thin nearly always, with an occasional better month; a rich place is dense
// nearly always. Spirit tides are NOT geology - somebody ascending is not a
// property of the ground under your feet - so they carry the same small weight
// everywhere.
//
// The half of that fix which is still not wired
//
// Measured in a live run, and recorded here because the code above reads as
// though the problem is solved and from inside the module it is:
//
// NOTHING IN THIS REPOSITORY EVER PASSES `SiteConditions.density`.
//
// Not `src/web/game.ts` (`ambientFor`, and all six of its `simulateTimeSkip`
// call sites), not `cultivation-manage.ts`, not `cultivation-support.ts`. Every
// one of them omits it, so every one of them takes `impliedDensityFor` - which
// guesses from the place's NAME, and guesses poor on purpose. Over the whole
// implied curve, 64% of places come out typically thin, 25% normal, 11% dense.
//
// The consequence, watched happening: a cultivator standing on a location the
// world layer holds at `env_spiritual_density = 1.0`, unsealed - the richest
// drawable ground in the world, where `ambientWeightsForDensity(1)` puts 98.4%
// of its weight on `dense` - was told the qi was thin, six months running. None
// of that 1.0 was in the arguments. The same omission also means `sealed` is
// never passed, so `sealed_vein` is unreachable in play.
//
// This is not a regression in the roll. The roll is correct and `geology.test.ts`
// proves it. It is that the world layer knows the density, the engine accepts
// the density, and no line of code joins them: `resolvePlace` in
// `src/web/entities.ts` still says in as many words that "places are free text
// in this engine; nothing about them is simulated", and carries a TODO(world)
// to resolve against real `world_locations`. Until that TODO is done, the fix
// recorded above is inert wherever it matters, and the largest multiplier in
// the game - up to 6x on progress rate - is decided by a hash of a place name.
//
// `tests/engine/cultivation/ground-in-the-skip.test.ts` holds the engine half
// of this down and states the caller half it cannot reach.

/**
 * Where each band sits on the 0..1 density axis.
 */
export const BAND_DENSITY_CENTRE: Record<'thin' | 'normal' | 'dense', number> = {
    thin: 0.1,
    normal: 0.42,
    dense: 0.78
};

/**
 * How far a month may stray from the geology. Small on purpose: this is the
 * width of the weather, and the whole point is that it does not reach the next
 * band but rarely.
 */
export const DENSITY_SPREAD = 0.14;

/**
 * Share of months that are a spirit tide, anywhere at all.
 */
export const TIDE_SHARE = 0.015;

/**
 * The band weights a location of this density actually experiences.
 */
let weightCacheKey = Number.NaN;
let weightCacheValue: Record<string, number> | null = null;

export function ambientWeightsForDensity(density: number): Record<string, number> {
    const d = Number.isFinite(density) ? Math.max(0, Math.min(1, density)) : 0.35;
    // Last-value memo. Geology is constant for the length of a seclusion, so a
    // time-skip asks the same question a hundred times running; three `exp`
    // calls per ambient lookup is not much until it is a hundred per decade
    // per simulated life. Pure function of `d`, so the cache cannot go stale.
    if (d === weightCacheKey && weightCacheValue !== null) return weightCacheValue;

    const twoSigmaSq = 2 * DENSITY_SPREAD * DENSITY_SPREAD;
    const kernel = (centre: number): number =>
        Math.exp(-((d - centre) * (d - centre)) / twoSigmaSq);

    const raw = {
        thin: kernel(BAND_DENSITY_CENTRE.thin),
        normal: kernel(BAND_DENSITY_CENTRE.normal),
        dense: kernel(BAND_DENSITY_CENTRE.dense)
    };
    const total = raw.thin + raw.normal + raw.dense;
    const share = (1 - TIDE_SHARE) / (total > 0 ? total : 1);

    weightCacheKey = d;
    // Frozen: the cache hands out the same reference every time, so a caller
    // that mutated it would poison every later lookup.
    weightCacheValue = Object.freeze({
        thin: raw.thin * share,
        normal: raw.normal * share,
        spirit_tide: TIDE_SHARE,
        dense: raw.dense * share
    });
    return weightCacheValue;
}

/**
 * Draw a band for a location of this density from a uniform [0,1) sample.
 *
 * Walks AMBIENT_QI_ORDER, so it can no more produce a `sealed_vein` than
 * `rollAmbientQi` can.
 */
export function rollAmbientAtDensity(sample: number, density: number): AmbientQi {
    const clamped = Math.max(0, Math.min(0.999999999, sample));
    const weights = ambientWeightsForDensity(density);
    const total = AMBIENT_QI_ORDER.reduce((sum, band) => sum + (weights[band] ?? 0), 0);
    let cursor = clamped * total;
    for (const band of AMBIENT_QI_ORDER) {
        cursor -= weights[band] ?? 0;
        if (cursor < 0) return band;
    }
    return AMBIENT_QI_ORDER[AMBIENT_QI_ORDER.length - 1];
}


/**
 * Skew of the implied-density draw. Cubed, so most places come out poor.
 */
export const IMPLIED_DENSITY_SKEW = 3;
export const IMPLIED_DENSITY_FLOOR = 0.06;
export const IMPLIED_DENSITY_RANGE = 0.76;

/**
 * A stable baseline for a location the caller knows nothing else about.
 */
export function impliedDensityFor(runSeed: string, locationId: string): number {
    const u = forStream(runSeed, 'geology', locationId).next();
    return IMPLIED_DENSITY_FLOOR + IMPLIED_DENSITY_RANGE * Math.pow(u, IMPLIED_DENSITY_SKEW);
}

/**
 * The geology a declared band implies - the inverse of `typicalAmbientFor`.
 */
export function densityForBand(band: AmbientQi): number {
    switch (band) {
        case 'thin': return BAND_DENSITY_CENTRE.thin;
        case 'normal': return BAND_DENSITY_CENTRE.normal;
        default: return BAND_DENSITY_CENTRE.dense;
    }
}

/**
 * The band this ground gives in an ordinary month - its geology, as opposed to
 * this month's weather.
 */
export function typicalAmbientFor(density: number): AmbientQi {
    const weights = ambientWeightsForDensity(density);
    let best: AmbientQi = 'thin';
    for (const band of AMBIENT_QI_ORDER) {
        if ((weights[band] ?? 0) > (weights[best] ?? 0)) best = band;
    }
    return best;
}

/**
 * Whether today's band is what this place ordinarily gives.
 */
export function isTypicalForGround(band: AmbientQi, density: number): boolean {
    return band === typicalAmbientFor(density);
}

export function ambientForLocationOnDay(
    runSeed: string,
    locationId: string,
    day: number,
    opts: SiteConditions = {}
): AmbientQi {
    // A sealed site does not roll and does not refresh. What is in there has
    // been in there since somebody closed it, and it stays until it is drawn
    // down - which is what makes it something to hold rather than to visit.
    if (opts.sealed) return 'sealed_vein';
    const wholeDay = Number.isFinite(day) ? Math.floor(day) : 0;
    const rng = forStream(runSeed, 'ambient', locationId, wholeDay);
    // Anchored to the ground, always. A caller that knows the location's real
    // usable density passes it; a caller that does not gets a stable baseline
    // implied from the place's own name, which is a guess but is a guess made
    // ONCE. Nothing here re-rolls the band freely per month any more.
    const density = opts.density ?? impliedDensityFor(runSeed, locationId);
    return rollAmbientAtDensity(rng.next(), density);
}

/** What the caller knows about a place that the ambient roll does not. */
export interface SiteConditions {
    /**
     * This location is a pocket nothing has drawn on: an unopened ruin, a
     * sealed vein, a secret realm. Supplied by the world layer from real
     * state; the engine holds no map and will never infer it.
     */
    sealed?: boolean;
    /**
     * USABLE qi here, 0..1 - the world layer's `spiritualDensity`, not its
     * `qiDensity`. The distinction is load-bearing: a sealed ruin sits on a pocket
     * nothing has drawn on and offers nobody any of it until the seal is open, so
     * the vein is rich and the usable density is nil.
     */
    density?: number;
}

/**
 * How often ambient conditions are re-rolled during a long simulation.
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
    day: number,
    opts: SiteConditions = {}
): AmbientQi {
    return ambientForLocationOnDay(runSeed, locationId, ambientBlockStart(day), opts);
}

// DESCRIPTION
// Engine-authored factual phrasing. The narrator dresses these up; it does not
// get to invent a spirit tide that the engine did not roll.

/**
 * Rate multiplier implied by an ERA's qi density, 0..1.
 */
const ERA_DENSITY_ANCHORS: readonly { density: number; multiplier: number }[] = [
    { density: 0.15, multiplier: 0.5 },  // scoured ground, thin
    { density: 0.35, multiplier: 1 },    // the Late Age baseline, normal
    { density: 0.55, multiplier: 2 },    // dense
    { density: 0.75, multiplier: 3.2 },
    { density: 0.95, multiplier: 4.5 }   // the first ages, in the open air
] as const;

export function eraAmbientMultiplier(qiDensity: number): number {
    const d = Number.isFinite(qiDensity) ? Math.max(0, Math.min(1, qiDensity)) : 0.35;
    const first = ERA_DENSITY_ANCHORS[0];
    if (d <= first.density) return first.multiplier;
    for (let i = 1; i < ERA_DENSITY_ANCHORS.length; i++) {
        const lo = ERA_DENSITY_ANCHORS[i - 1];
        const hi = ERA_DENSITY_ANCHORS[i];
        if (d <= hi.density) {
            const t = (d - lo.density) / (hi.density - lo.density);
            return lo.multiplier + t * (hi.multiplier - lo.multiplier);
        }
    }
    return ERA_DENSITY_ANCHORS[ERA_DENSITY_ANCHORS.length - 1].multiplier;
}

const AMBIENT_DESCRIPTIONS: Record<AmbientQi, string> = {
    thin: 'The spiritual energy here is thin; cultivation is half as fast and breakthroughs are noticeably riskier.',
    normal: 'Spiritual energy here is unremarkable - neither help nor hindrance.',
    dense: 'Spiritual energy here is dense; cultivation runs at double rate and breakthroughs are easier.',
    spirit_tide: 'A spirit tide is running. Qi is three times as abundant as normal and the heavens are unusually permissive.',
    sealed_vein: 'A pocket nothing has drawn on. Qi stands four times the ordinary baseline and does not thin while it holds - the density the open world stopped being able to produce.'
};

export function describeAmbient(ambient: AmbientQi): string {
    return AMBIENT_DESCRIPTIONS[ambient];
}
