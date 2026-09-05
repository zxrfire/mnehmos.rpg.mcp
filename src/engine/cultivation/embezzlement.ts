/**
 * Siphoning a sect's reserves.
 */

import { isElderRank } from './leadership.js';

/**
 * The fraction that used to decide who could reach the reserves.
 */
export const RESERVE_ACCESS_FRACTION = 2 / 3;

/**
 * Whether this rank can reach the reserves at all.
 */
export function canReachReserves(rankIndex: number, rankCount: number): boolean {
    if (rankCount <= 0) return false;
    return isElderRank(rankIndex, rankCount);
}

/**
 * The most that can be moved in one period without the movement itself being the
 * thing that gets noticed, as a fraction of what is there.
 */
export const MAX_SAFE_DRAW_FRACTION = 0.02;

/** Days in one siphoning period. The same month the stipend runs on. */
export const SIPHON_PERIOD_DAYS = 30;

/** How greedily the reserves are being drawn, and what each costs in notice. */
export type SiphonPace = 'careful' | 'steady' | 'greedy';

export interface PaceProfile {
    /** Fraction of remaining reserves taken per period. */
    drawFraction: number;
    /**
     * Multiplier on the notice a draw of a given size attracts. Taking the same
     * total faster is worse than taking it slowly, over and above the size.
     */
    noticeMultiplier: number;
    description: string;
}

export const SIPHON_PACES: Readonly<Record<SiphonPace, PaceProfile>> = {
    careful: {
        drawFraction: MAX_SAFE_DRAW_FRACTION / 4,
        noticeMultiplier: 0.5,
        description:
            'Half a per cent a month, against expenses that were always approximate. This is the pace at which a patient thief is never caught and never rich.'
    },
    steady: {
        drawFraction: MAX_SAFE_DRAW_FRACTION,
        noticeMultiplier: 1,
        description:
            'Two per cent a month. It reconciles if nobody is looking hard, and somebody looks hard eventually.'
    },
    greedy: {
        drawFraction: MAX_SAFE_DRAW_FRACTION * 4,
        noticeMultiplier: 2.5,
        description:
            'Eight per cent a month. This is not embezzlement, it is a countdown - it will be found, and the only question is how much is gone first.'
    }
};

/** Stones moved in one period at this pace, given what is left in the reserves. */
export function drawForPeriod(reserves: number, pace: SiphonPace): number {
    if (reserves <= 0) return 0;
    return Math.floor(Math.max(0, reserves) * SIPHON_PACES[pace].drawFraction);
}

/**
 * Notice a single period's draw attracts, in suspicion points.
 */
export function noticeFromDraw(
    draw: number,
    reservesBefore: number,
    pace: SiphonPace,
    rankIndex: number,
    rankCount: number
): number {
    if (draw <= 0 || reservesBefore <= 0) return 0;
    const share = draw / reservesBefore;
    const seniority = rankCount <= 1 ? 0 : rankIndex / (rankCount - 1);
    // At the top rung the same theft draws 40% of the notice it would at the
    // bottom of the ranks that can reach it at all.
    const cover = 1 - 0.6 * seniority;
    return share * 100 * SIPHON_PACES[pace].noticeMultiplier * cover;
}

/** Suspicion at which discovery becomes certain on the next audit. */
export const CERTAIN_DISCOVERY = 100;

/**
 * How loudly the hole itself speaks, independent of how quietly it was made.
 */
export const DEPLETION_WEIGHT = 2.4;

/**
 * Suspicion from the size of the hole, ignoring how it was made. `base` is what
 * the house held before any of this started; the shortfall term is measured
 * against it and is the part care cannot buy off.
 */
export function noticeFromShortfall(taken: number, base: number): number {
    if (base <= 0) return CERTAIN_DISCOVERY;
    const share = Math.max(0, Math.min(1, taken / base));
    return share * 100 * DEPLETION_WEIGHT;
}

/**
 * Chance the house works it out this period.
 */
export function discoveryChance(suspicion: number): number {
    const s = Math.max(0, Math.min(CERTAIN_DISCOVERY, suspicion)) / CERTAIN_DISCOVERY;
    return Math.max(0, Math.min(1, s * s));
}

export interface SiphonPeriod {
    /** Stones taken this period. */
    taken: number;
    /** Running total taken across every period so far. */
    takenTotal: number;
    /** Reserves after the draw. */
    reservesAfter: number;
    /**
     * Notice accumulated from the draws themselves. Carried between periods,
     * because a house that half-noticed something does not un-notice it.
     */
    drawNotice: number;
    /** Draw notice plus what the size of the hole says on its own. */
    suspicion: number;
    /** Odds the house works it out, evaluated after the draw. */
    discoveryChance: number;
}

export interface SiphonState {
    /** Notice accrued from the draws so far, before the shortfall term. */
    drawNotice: number;
    /** Stones taken in total. */
    takenTotal: number;
}

/**
 * Resolve one period of siphoning. Pure - the caller rolls the discovery and writes
 * the rows.
 */
export function siphonPeriod(
    state: SiphonState,
    base: number,
    pace: SiphonPace,
    rankIndex: number,
    rankCount: number
): SiphonPeriod {
    const reserves = Math.max(0, base - Math.max(0, state.takenTotal));
    const taken = drawForPeriod(reserves, pace);
    const drawNotice =
        Math.max(0, state.drawNotice) +
        noticeFromDraw(taken, reserves, pace, rankIndex, rankCount);
    const takenTotal = Math.max(0, state.takenTotal) + taken;
    const suspicion = drawNotice + noticeFromShortfall(takenTotal, base);

    return {
        taken,
        takenTotal,
        reservesAfter: Math.max(0, base - takenTotal),
        drawNotice,
        suspicion,
        discoveryChance: discoveryChance(suspicion)
    };
}

/**
 * What a house does about it, which is not a fine.
 */
export interface DiscoveryOutcome {
    expelled: true;
    contributionForfeited: number;
    /** Stones the house claws back. It cannot take what has been spent. */
    recovered: number;
    /** Permanent, and visible to every other house. */
    markedAsThief: true;
}

/** What the house takes back when it finds out. */
export function resolveDiscovery(
    heldByThief: number,
    stolenTotal: number,
    contribution: number
): DiscoveryOutcome {
    return {
        expelled: true,
        contributionForfeited: Math.max(0, contribution),
        recovered: Math.max(0, Math.min(heldByThief, stolenTotal)),
        markedAsThief: true
    };
}

/**
 * What a house of this wealth keeps in reserve, in spirit stones.
 */
export const RESERVE_MONTHS = 144;

export function baseReservesFor(stipend: readonly number[]): number {
    // The payroll is dominated by the ranks nobody holds, so the reserve is
    // scaled off the whole ladder rather than the top of it - a house with six
    // rungs is carrying six rungs' worth of people.
    const payroll = stipend.reduce((sum, s) => sum + Math.max(0, s), 0);
    return Math.round(payroll * RESERVE_MONTHS);
}

/** What is left after everything already taken. */
export function reservesRemaining(stipend: readonly number[], alreadyTaken: number): number {
    return Math.max(0, baseReservesFor(stipend) - Math.max(0, alreadyTaken));
}
