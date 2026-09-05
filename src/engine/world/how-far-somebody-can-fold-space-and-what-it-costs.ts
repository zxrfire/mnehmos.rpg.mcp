/**
 * How far somebody can fold space, what it costs them, and what it does not buy.
 */

import { clampOrdinal, rankName } from '../cultivation/realms.js';
import type { CapabilityGrant } from './capability.js';

// ─────────────────────────────────────────────────────────────────────────
// THE GRANT
// ─────────────────────────────────────────────────────────────────────────

/** The grant that makes any of this possible. Void Refinement, and no lower. */
export const FOLD_GRANT: CapabilityGrant = 'spatial_folding';

/**
 * The rung at which folding becomes possible at all.
 */
export const FOLD_FLOOR_ORDINAL = 29;

// THE RANGE

/**
 * How far a fold reaches at the rung where folding starts, in walking days.
 */
export const FOLD_RANGE_AT_THE_FLOOR = 6;

/**
 * What one more rung is worth, multiplicatively.
 */
export const FOLD_RANGE_GROWTH_PER_RUNG = 1.24;

/**
 * How far this rung can fold, in walking days. Zero below the floor.
 */
export function foldRangeInWalkingDays(ordinal: number): number {
    const o = clampOrdinal(ordinal);
    if (o < FOLD_FLOOR_ORDINAL) return 0;
    return FOLD_RANGE_AT_THE_FLOOR
        * FOLD_RANGE_GROWTH_PER_RUNG ** (o - FOLD_FLOOR_ORDINAL);
}

// THE FIX

/**
 * How the folder knows where the far end is.
 */
export type FoldFix = 'stood' | 'seen';

/**
 * How far short a fold lands when the fix is a sighting, as a fraction of the
 * distance folded.
 */
export const SEEN_FIX_ERROR = 0.1;

/**
 * Walking days still to cover after arriving, for a given fix.
 *
 * Whole days, because a road is a road - the same reasoning `daysByConveyance`
 * gives for never returning a fraction.
 */
export function landsShortByDays(walkingDays: number, fix: FoldFix): number {
    if (fix === 'stood') return 0;
    return Math.ceil(Math.max(0, walkingDays) * SEEN_FIX_ERROR);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT COSTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Days spent settling after a fold at the very edge of the range.
 */
export const SETTLING_DAYS_AT_FULL_STRETCH = 3;

/**
 * Days lost to settling, quadratic in how much of the range was spent.
 */
export function settlingDaysFor(walkingDays: number, rangeDays: number): number {
    if (rangeDays <= 0) return 0;
    const spent = Math.max(0, walkingDays) / rangeDays;
    return Math.ceil(SETTLING_DAYS_AT_FULL_STRETCH * spent * spent);
}

// ─────────────────────────────────────────────────────────────────────────
// PRICING ONE FOLD
// ─────────────────────────────────────────────────────────────────────────

export interface FoldInput {
    ordinal: number;
    /**
     * What this cultivator actually holds.
     */
    heldGrants?: readonly CapabilityGrant[];
    /** What the road costs on foot. `travelDays` on a `RegionConnection`. */
    walkingDays: number;
    fix: FoldFix;
}

export interface FoldCost {
    /** How far this rung reaches today, in walking days. */
    rangeDays: number;
    /** Whether the far end is inside it. */
    withinRange: boolean;
    /** False for everybody who does not hold the grant, which is nearly everybody. */
    canFoldAtAll: boolean;
    /** Walking days still to cover on arrival. Zero where they have stood there. */
    landsShortBy: number;
    /** Days lost to settling. Never fractional, never zero. */
    settlingDays: number;
    /** Everything the fold costs, in days. Compare against `walkingDays`. */
    daysSpent: number;
    /** Days saved against walking it. The figure that makes a rung legible. */
    daysSavedAgainstWalking: number;
    /** What a watcher at the far end reads off the arrival. Never blank. */
    arrivalReads: string;
    /** The honest sentence, including when the answer is no. */
    reason: string;
}

/**
 * Price one fold.
 */
export function priceFold(input: FoldInput): FoldCost {
    const rangeDays = foldRangeInWalkingDays(input.ordinal);
    const holds = (input.heldGrants ?? []).includes(FOLD_GRANT);
    const canFoldAtAll = rangeDays > 0 && holds;
    const walkingDays = Math.max(0, Math.ceil(input.walkingDays));

    if (!canFoldAtAll) {
        return {
            rangeDays: holds ? rangeDays : 0,
            withinRange: false,
            canFoldAtAll: false,
            landsShortBy: 0,
            settlingDays: 0,
            daysSpent: walkingDays,
            daysSavedAgainstWalking: 0,
            arrivalReads: '',
            // BOTH REFUSALS NAME WHAT WOULD CHANGE THEM. A player who types
            // this has no reason to know the setting's word for it, let alone
            // the rung it starts at - and "no" with nothing behind it is the
            // one answer this engine is not allowed to give.
            reason: rangeDays <= 0
                ? 'Space does not fold for them. It is a road, and it is as long as it is. '
                    + `Nothing folds it below ${rankName(FOLD_FLOOR_ORDINAL)}, and standing `
                    + 'there is not enough on its own: it is refined against, the way anything '
                    + 'else is.'
                : 'They stand high enough for it and it is not theirs. Whatever they refined '
                    + 'themselves against, it was not this.'
        };
    }

    if (walkingDays > rangeDays) {
        return {
            rangeDays,
            withinRange: false,
            canFoldAtAll: true,
            landsShortBy: 0,
            settlingDays: 0,
            daysSpent: walkingDays,
            daysSavedAgainstWalking: 0,
            arrivalReads: '',
            reason: `${walkingDays} days of road against ${rangeDays.toFixed(1)} days of reach. `
                + 'It is not a refusal, it is a distance: they go the way everybody goes, or they '
                + 'go part of the way and fold the rest.'
        };
    }

    const landsShortBy = landsShortByDays(walkingDays, input.fix);
    const settlingDays = settlingDaysFor(walkingDays, rangeDays);
    const daysSpent = Math.max(1, settlingDays + landsShortBy);

    return {
        rangeDays,
        withinRange: true,
        canFoldAtAll: true,
        landsShortBy,
        settlingDays,
        daysSpent,
        daysSavedAgainstWalking: Math.max(0, walkingDays - daysSpent),
        arrivalReads: whatArrivingByFoldSays(landsShortBy),
        reason: input.fix === 'stood'
            ? `${walkingDays} days of road inside ${rangeDays.toFixed(1)} days of reach, to `
                + `ground they have stood on. They arrive where they meant to, and ${settlingDays} `
                + `day${settlingDays === 1 ? '' : 's'} of them is somewhere else for a while.`
            : `${walkingDays} days of road inside ${rangeDays.toFixed(1)} days of reach, to `
                + `something they have only looked at. They come out ${landsShortBy} day`
                + `${landsShortBy === 1 ? '' : 's'} short of it and walk the rest, which is what `
                + 'a sighting is worth and what having stood somewhere is worth instead.'
    };
}

/**
 * What arriving this way says about somebody, before a word is spoken.
 *
 * The same axis as a spirit boat and a delegation on foot, and the end of it.
 * One sentence, engine-authored, no branch on faction or title anywhere.
 */
export function whatArrivingByFoldSays(landsShortBy: number): string {
    const walked = landsShortBy > 0
        ? ' They walked the last of it, which fools the gate and nobody who counts days.'
        : '';
    return 'They were not on the road. Nobody passed them, no station wrote them down, and '
        + 'nothing was paid at true distance for a journey that was not made - which is the one '
        + 'arrival in this world that cannot be arranged, borrowed or faked.' + walked;
}

/**
 * Whether this cultivator could get there in one step. The single question a
 * caller most often has.
 */
export function couldFoldThere(
    ordinal: number,
    heldGrants: readonly CapabilityGrant[] | undefined,
    walkingDays: number
): boolean {
    return priceFold({ ordinal, heldGrants, walkingDays, fix: 'stood' }).withinRange;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THIS DOES NOT REACH YET
// ─────────────────────────────────────────────────────────────────────────

/**
 * Recorded rather than quietly left, the way `SEA_CROSSING_ENGINE_GAP` is.
 */
/**
 * Why only one of the two fixes is reachable, and what the other one wants.
 */
export const A_SIGHTING_HAS_NO_NAME_ON_IT = {
    what: 'Nothing in the world records that somebody made out a named place from a height, so the `seen` fix has no writer and only `stood` is reachable.',
    whereItWouldGo: 'The overlook in the destinations read in src/web/game.ts, which already computes what is visible from this rung and throws the names away on purpose.',
    whatItWouldTake: 'A knowledge record against the place, from a source that means "I saw it myself and cannot place it exactly" - which is a source kind the discovery ladder does not have and should not be given lightly.',
    whyItIsNotDoneHere: 'A Sighting has no name on it by design, and adding one to satisfy a fold would spend the discovery the sight horizon exists to withhold.'
} as const;

export const FOLD_TRAVEL_ENGINE_GAP = {
    what: 'No journey in the running game is priced in walking days, so the range curve above saves nobody any time yet.',
    whereItWouldGo: 'The move handler in src/web/game.ts, which spends SHORT_ACTION_DAYS for every journey regardless of distance, and bestForThisRoad in src/engine/world/what-a-conveyance-does-to-a-journey.ts, which ranks conveyances and does not know about folding.',
    whatItWouldTake: 'The catalog travelDays for the chosen road in place of the flat constant, and one branch that prefers a fold when priceFold reports withinRange and fewer days.',
    whyItIsNotDoneHere: 'Both files are owned by other agents and one of them is uncommitted. A journey seam edited from two ends at once is the failure AGENTS.md names.'
} as const;

// The curve has no exceptions. `convergence.ts` prices its escape from a
// closing window off `foldRangeInWalkingDays` like everything else, then scales
// it by what is left of the window - so rank buys depth and never time, and a
// call that goes out late fails on geometry however high the person answering
// stands. `PIERCE_REACH_DAYS` there is the floor of this curve rather than a
// ceiling on it.
