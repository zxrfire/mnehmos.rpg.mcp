/**
 * Siphoning a sect's reserves.
 *
 * Betrayal in this setting is not a single dramatic act. Nobody walks out of a
 * mountain gate with the treasury on their back - the people who could stop
 * them are the people they eat with, and the ones strong enough to try it
 * openly are precisely the ones with too much to lose. What actually happens is
 * quieter: somebody with access takes a little, for a long time, and either the
 * ledger catches up with them or it does not.
 *
 * So this is a rate, a clock and a risk, rather than a verb with an outcome.
 * Three things follow from that and they are the whole design:
 *
 *   ACCESS IS THE RANK. A disciple cannot embezzle because a disciple cannot
 *   reach anything. The reserves open to the senior ranks and only to them,
 *   which makes the betrayal available exactly when the player has spent
 *   decades earning the right to commit it. That is the point of it.
 *
 *   PATIENCE IS THE DIAL. The same total can be taken quickly and loudly or
 *   slowly and quietly. A greedy draw is noticed; a careful one may never be.
 *   Nothing here is a die roll the player cannot influence - they choose the
 *   rate, and the rate is the entire strategy.
 *
 *   THE HOUSE IS NOT STUPID. Suspicion accrues on the sect's side of the table
 *   and does not decay to nothing. An audit is a check against what has already
 *   been noticed, so a long enough theft is eventually a certainty, and the
 *   skill is in stopping.
 */

/**
 * The fraction of a sect's rank ladder that can reach the reserves at all.
 *
 * The top third, so a five-rung sect opens them at rung 3 and a six-rung sect
 * at rung 4. Expressed as a fraction rather than an index because the houses
 * have ladders of different lengths and "the senior ranks" has to mean the same
 * thing in a five-rung company and a six-rung pavilion.
 */
export const RESERVE_ACCESS_FRACTION = 2 / 3;

/** Whether this rank can reach the reserves at all. */
export function canReachReserves(rankIndex: number, rankCount: number): boolean {
    if (rankCount <= 0) return false;
    return rankIndex >= Math.ceil((rankCount - 1) * RESERVE_ACCESS_FRACTION);
}

/**
 * The most that can be moved in one period without the movement itself being
 * the thing that gets noticed, as a fraction of what is there.
 *
 * Small on purpose. A house that cannot account for a fifth of its reserves in
 * a season does not have reserves, it has a rumour.
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
 *
 * Scaled to the draw as a share of what was there, because a house notices a
 * proportion rather than an amount: a hundred stones missing from a company
 * that holds two hundred is a catastrophe, and from a pavilion that holds two
 * hundred thousand it is a rounding error.
 *
 * Seniority cuts it. The people who audit the reserves report to the person
 * taking them, and a house is slower to suspect the rung it takes orders from -
 * which is the other half of why this is the sect leader's crime.
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
 *
 * Notice on a single draw is not enough on its own, and the first version of
 * this got it badly wrong: a patient thief taking half a per cent a month drew
 * so little attention per period that they could run for eighty-nine years and
 * walk off with ninety-nine per cent of the house's reserves. Patience beat the
 * system completely, which is not a betrayal, it is a payroll.
 *
 * The missing term is that a house eventually notices the reserve is DOWN,
 * however gently it got there. Somebody counts it, or needs it and it is not
 * there. So suspicion carries a second component scaled to the cumulative
 * shortfall, and that one cannot be outwaited: at this weight a third of the
 * reserves missing is on its own most of the way to certain, no matter how many
 * decades it took to go.
 *
 * It also inverts the strategy in the right direction. Care buys you time and a
 * larger total; it does not buy you the whole house. Nobody drains a sect.
 */
export const DEPLETION_WEIGHT = 2.4;

/**
 * Suspicion from the size of the hole, ignoring how it was made.
 *
 * `taken` and `base` are the running total and the reserve the house started
 * with, so this is the part of the risk a thief cannot reduce by being careful -
 * only by stopping.
 */
export function noticeFromShortfall(taken: number, base: number): number {
    if (base <= 0) return CERTAIN_DISCOVERY;
    const share = Math.max(0, Math.min(1, taken / base));
    return share * 100 * DEPLETION_WEIGHT;
}

/**
 * Chance the house works it out this period.
 *
 * Rises with the square of accumulated suspicion rather than linearly, so a
 * thief who stops early is genuinely safe and one who keeps going past the
 * halfway mark is not gambling any more, they are stalling.
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
 * Resolve one period of siphoning. Pure - the caller rolls the discovery and
 * writes the rows.
 *
 * `base` is what the house held before any of this started; the shortfall term
 * is measured against it and is the part care cannot buy off.
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
 *
 * The contribution is gone because it was always the house's to withdraw, the
 * rank is gone because the rank was the access, and the record follows them:
 * this is the difference between resigning and being found out, and it is the
 * only thing in the sect system that any other house will ever hold against a
 * cultivator.
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
 *
 * Derived from the stipend ladder rather than stored, because the ladder is
 * already the honest measure of how rich a sect is - it is what the house pays
 * out every month, forever, and a house cannot pay what it does not have. The
 * reserve is what is behind that: the fund a sect draws on when a vein fails or
 * a war starts, and the reason it can keep paying through either.
 *
 * Twelve years of the full payroll, which is a house that can lose a decade and
 * survive it. Anything less and a bad century ends them; anything more and the
 * stipend ladder is lying about their size.
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
