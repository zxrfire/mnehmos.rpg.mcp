/**
 * Cultivation progress accrual.
 *
 * Progress is the XP replacement, and unlike XP it is earned by *time*, not by
 * events. A cultivator sitting in a cave accrues a rate per day; that rate is
 * the product of a handful of multipliers, and the ladder's cost curve
 * (`progressRequiredForOrdinal`) grows at 1.35^ordinal. Multiplying a rate
 * against an exponential cost is what produces the genre's core shape: talent
 * does not add a bonus, it decides which realms are reachable inside a lifespan
 * at all.
 *
 * Worked example, at BASE_PROGRESS_PER_DAY = 1 and normal ambient qi:
 *   - single root (1.5x): clearing all of Qi Condensation costs ~40 years.
 *   - muddled root (0.55x): the same climb costs ~110 years, which exceeds
 *     STAGNATION_YEARS and a 100-year mortal lifespan. A muddled root does not
 *     get a penalty; a muddled root loses.
 * That asymmetry is the design, not a tuning accident.
 *
 * Everything here is pure. Take state in, return deltas out. Nothing in this
 * file mutates a cultivator, touches the database, or knows what a turn is.
 */

import {
    type AmbientQi,
    type Cultivator
} from '../../schema/cultivation.js';
import { getSpiritRoot } from './spirit-roots.js';
import { progressRequiredForOrdinal } from './realms.js';
import { ambientRateMultiplier } from './ambient.js';
import { aggregateInjuryPenalties } from './injuries.js';

// ─────────────────────────────────────────────────────────────────────────
// BASE RATE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Qi-units a cultivator with no modifiers at all gains per day of dedicated
 * cultivation. The unit that `progressRequiredForOrdinal` is denominated in.
 *
 * Fixed at 1 on purpose: it makes progress requirements readable directly as
 * "unmodified days", which is the number a balance discussion actually wants.
 */
export const BASE_PROGRESS_PER_DAY = 1;

/** Days per in-world year. No calendars, no leap years, no argument. */
export const DAYS_PER_YEAR = 365;

// ─────────────────────────────────────────────────────────────────────────
// RATE BREAKDOWN
// Every factor is itemised. The UI must be able to answer "why am I so slow?"
// without the player guessing, and a balance pass must be able to read the
// contribution of each system without instrumenting the engine.
// ─────────────────────────────────────────────────────────────────────────

export interface RateFactor {
    /** Stable machine-readable key, e.g. `spirit_root`. */
    source: string;
    /** Human-facing label the UI can print verbatim. */
    label: string;
    /** Multiplier applied to the running rate. 1 means "no effect". */
    multiplier: number;
}

export interface CultivationRateBreakdown {
    /** BASE_PROGRESS_PER_DAY, before anything is applied. */
    base: number;
    /** Ordered multipliers; `perDay` is `base` times all of them. */
    factors: RateFactor[];
    /** Final qi-units per day. Never negative; may be zero. */
    perDay: number;
}

export interface CultivationOptions {
    /**
     * Multiplier from the cultivation manual being practised. A mortal-grade
     * qi-gathering manual is ~1.1; an immortal-grade one is several times that.
     * 1 means cultivating raw, with no manual at all.
     */
    techniqueBonus?: number;
    /**
     * Multiplier from sect membership - spirit-gathering arrays, elder
     * guidance, a stipend that means you are not foraging.
     */
    sectBonus?: number;
    /**
     * Multiplier from the specific site, on top of its ambient band: a spirit
     * vein, a heritage cave, a formation someone else paid for.
     */
    locationBonus?: number;
    /**
     * Multiplier for how the time is being spent. Sealed seclusion is the full
     * 1.0; cultivating while travelling, working sect duties, or fighting is a
     * fraction of that.
     */
    focusMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<CultivationOptions> = {
    techniqueBonus: 1,
    sectBonus: 1,
    locationBonus: 1,
    focusMultiplier: 1
};

/**
 * The itemised per-day cultivation rate.
 *
 * Order of factors is fixed (root, ambient, injuries, technique, sect,
 * location, focus) so that two breakdowns from the same state compare equal
 * element-by-element - a property the determinism tests lean on.
 */
export function computeCultivationRate(
    cultivator: Pick<Cultivator, 'spiritRoot' | 'injuries'>,
    ambient: AmbientQi,
    opts: CultivationOptions = {}
): CultivationRateBreakdown {
    const options = { ...DEFAULT_OPTIONS, ...opts };
    const root = getSpiritRoot(cultivator.spiritRoot);
    const injuries = aggregateInjuryPenalties(cultivator.injuries);

    const factors: RateFactor[] = [
        {
            source: 'spirit_root',
            label: root.name,
            multiplier: root.cultivationSpeed
        },
        {
            source: 'ambient_qi',
            label: `Ambient qi (${ambient})`,
            multiplier: ambientRateMultiplier(ambient)
        },
        {
            source: 'untreated_injuries',
            label:
                injuries.untreatedCount === 0
                    ? 'No untreated injuries'
                    : `${injuries.untreatedCount} untreated meridian injur${injuries.untreatedCount === 1 ? 'y' : 'ies'}`,
            multiplier: injuries.cultivationMultiplier
        },
        {
            source: 'technique',
            label: 'Cultivation manual',
            multiplier: nonNegative(options.techniqueBonus)
        },
        {
            source: 'sect',
            label: 'Sect support',
            multiplier: nonNegative(options.sectBonus)
        },
        {
            source: 'location',
            label: 'Site bonus',
            multiplier: nonNegative(options.locationBonus)
        },
        {
            source: 'focus',
            label: 'Focus',
            multiplier: nonNegative(options.focusMultiplier)
        }
    ];

    const perDay = factors.reduce((rate, f) => rate * f.multiplier, BASE_PROGRESS_PER_DAY);

    return {
        base: BASE_PROGRESS_PER_DAY,
        factors,
        // Guard against a caller handing in NaN via a bonus; a NaN rate would
        // silently poison every downstream day-count and never throw.
        perDay: Number.isFinite(perDay) ? Math.max(0, perDay) : 0
    };
}

function nonNegative(n: number): number {
    return Number.isFinite(n) && n > 0 ? n : n === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────
// ACCRUAL
// ─────────────────────────────────────────────────────────────────────────

export interface AccrualContext {
    ambient: AmbientQi;
    options?: CultivationOptions;
}

export interface AccrualResult {
    /** Days actually accounted for (floored at 0). */
    days: number;
    /** Progress delta. Add this to `cultivationProgress`; never negative. */
    progressGained: number;
    /** Convenience: progress after the delta. The caller still owns the write. */
    newProgress: number;
    rate: CultivationRateBreakdown;
}

/**
 * Accrue `days` of cultivation. Returns the delta and the breakdown that
 * produced it; the caller applies the delta to state.
 *
 * Linear in `days` by construction - there is no per-day loop, because there is
 * nothing in the rate that varies within a constant-ambient stretch. That is
 * exactly what lets `simulateTimeSkip` resolve a decade in a hundred steps.
 */
export function accrueProgress(
    cultivator: Pick<Cultivator, 'spiritRoot' | 'injuries' | 'cultivationProgress'>,
    days: number,
    ctx: AccrualContext
): AccrualResult {
    const rate = computeCultivationRate(cultivator, ctx.ambient, ctx.options);
    const safeDays = Number.isFinite(days) ? Math.max(0, days) : 0;
    const progressGained = rate.perDay * safeDays;
    return {
        days: safeDays,
        progressGained,
        newProgress: cultivator.cultivationProgress + progressGained,
        rate
    };
}

/**
 * Whether enough progress has accumulated to attempt the next rank.
 *
 * "Eligible" is not "advisable". The engine will happily let a cultivator with
 * three torn meridians attempt a realm boundary in thin qi.
 */
export function isBreakthroughEligible(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress'>
): boolean {
    return cultivator.cultivationProgress >= progressRequiredForOrdinal(cultivator.realmOrdinal);
}

/** Progress still needed before the next attempt is legal. Zero when eligible. */
export function progressRemaining(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress'>
): number {
    return Math.max(
        0,
        progressRequiredForOrdinal(cultivator.realmOrdinal) - cultivator.cultivationProgress
    );
}

/**
 * Whole days at `perDay` before the next breakthrough becomes legal.
 *
 * `Infinity` when the rate is zero - a cultivator whose meridians are shut and
 * whose qi is thin is not slow, they are stopped, and the simulation must not
 * pretend a finite number of days will fix it.
 */
export function daysToNextBreakthrough(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress'>,
    perDay: number
): number {
    const remaining = progressRemaining(cultivator);
    if (remaining <= 0) return 0;
    if (!Number.isFinite(perDay) || perDay <= 0) return Infinity;
    return Math.ceil(remaining / perDay);
}

/** Fraction of the way to the next rank, in [0, 1]. For progress bars. */
export function progressFraction(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress'>
): number {
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);
    if (required <= 0) return 1;
    return Math.max(0, Math.min(1, cultivator.cultivationProgress / required));
}
