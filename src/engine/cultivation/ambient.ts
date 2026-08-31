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

/**
 * Bands that exist but the world never rolls.
 *
 * `sealed_vein` is absent from AMBIENT_QI_ORDER above, which is the structural
 * guarantee that no amount of travelling, waiting or re-reading can produce
 * one: `rollAmbientQi` only ever walks the rollable order. A sealed vein is a
 * place a caller declares, not a band a cultivator can wander into.
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
// ─────────────────────────────────────────────────────────────────────────
// GEOLOGY, AND THE WEATHER ON TOP OF IT
//
// Ambient qi is anchored to what the ground under a place actually holds. The
// month-to-month variation is weather; the baseline is geology, and geology
// does not wander.
//
// This was wrong for a while and the bug is worth recording. `rollAmbientQi`
// sampled one global distribution for every location, using the place only as
// a seed input, so a drawn-down province came up `dense` roughly one month in
// twenty and a rich vein came up `thin` half the time. Standing in Sweptground
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
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where each band sits on the 0..1 density axis.
 *
 * These are the density a location would have to hold for that band to be its
 * ordinary weather. Read alongside `AMBIENT_QI_RATE_MULTIPLIER`: a place at
 * 0.78 is one whose vein sustains double rate as its normal condition.
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
 *
 * Not geology. A tide is somebody finishing, and the ground has no opinion
 * about that, so a swept-out province is exactly as likely to catch one as a
 * sect's own mountain. Deliberately small - it is the best thing that can
 * happen to a cultivator, and it happens because someone else's life ended.
 */
export const TIDE_SHARE = 0.015;

/**
 * The band weights a location of this density actually experiences.
 *
 * Returns a full weight table over the rollable bands. `sealed_vein` is absent
 * for the same reason it is absent from AMBIENT_QI_ORDER: it is a place, not a
 * forecast.
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
 *
 * The world is late and mostly drawn down; a location picked at random is far
 * likelier to be swept ground than a vein somebody would fight over. A linear
 * draw would make rich ground ordinary, which is the opposite of the setting.
 */
export const IMPLIED_DENSITY_SKEW = 3;
export const IMPLIED_DENSITY_FLOOR = 0.06;
export const IMPLIED_DENSITY_RANGE = 0.76;

/**
 * A stable baseline for a location the caller knows nothing else about.
 *
 * Drawn ONCE from (runSeed, locationId) and never again, so the ground under a
 * named place is a fact about that place for the whole run. This is what makes
 * "the qi is thin here, and it always has been" a sentence the engine is
 * entitled to hand the narrator.
 *
 * It is a fallback and it is worse than the real thing: the world layer knows
 * the actual `spiritualDensity` of its locations, and a caller holding one
 * should pass it rather than let the engine guess. But guessing ONCE per place
 * is categorically better than re-rolling the band every thirty days, which is
 * what produced a drawn-down province turning rich for a season.
 */
export function impliedDensityFor(runSeed: string, locationId: string): number {
    const u = forStream(runSeed, 'geology', locationId).next();
    return IMPLIED_DENSITY_FLOOR + IMPLIED_DENSITY_RANGE * Math.pow(u, IMPLIED_DENSITY_SKEW);
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
 *
 * Exists for the narrator, and specifically so it stops making permanent
 * claims out of temporary facts. "The qi is thin here; it always has been" is
 * a statement about the GROUND, and it is only true when thin is what the
 * ground gives - a merely thin month in ordinary country deserves "the air is
 * poor this season", which is a different sentence and an honest one.
 *
 * The engine should never hand narration language that outlives the fact it
 * describes, and this is the flag that lets it avoid doing so.
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
     * `qiDensity`. The distinction is load-bearing: a sealed ruin sits on a
     * pocket nothing has drawn on and offers nobody any of it until the seal
     * is open, so the vein is rich and the usable density is nil.
     *
     * This is the CENTRE the month's weather varies around. Omit it only when
     * the location genuinely is not known.
     */
    density?: number;
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
    day: number,
    opts: SiteConditions = {}
): AmbientQi {
    return ambientForLocationOnDay(runSeed, locationId, ambientBlockStart(day), opts);
}

// ─────────────────────────────────────────────────────────────────────────
// DESCRIPTION
// Engine-authored factual phrasing. The narrator dresses these up; it does not
// get to invent a spirit tide that the engine did not roll.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Rate multiplier implied by an ERA's qi density, 0..1.
 *
 * The world layer's `world_eras` carries a density that only ever falls, and
 * this is how that number becomes cultivation arithmetic. It exists so the
 * upper stratum of the world can be derived HONESTLY: a Grand Ascension
 * ancient is not an exemption in the maths, they are somebody who walked the
 * same cost curve in an age whose open-world baseline was richer than
 * anything now available.
 *
 * Anchored on the present-day bands so the two scales cannot drift apart, and
 * deliberately reaching past `sealed_vein` at the top: the first ages were
 * richer in the open air than a preserved pocket is today.
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
