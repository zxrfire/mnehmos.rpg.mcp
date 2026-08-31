/**
 * Qi deviation (走火入魔) - cultivation going wrong inside the body.
 *
 * Two things cause it, and they are structurally different:
 *
 *  1. WHO YOU ARE. A dual root holds two elements that destroy each other. The
 *     conflict is not a situation you can leave; it is standing inside your own
 *     meridians for the entire run. `SpiritRoot.deviationRisk` is that standing
 *     per-check probability, and it is why a dual root is a worse draw than its
 *     1.0 cultivation speed suggests.
 *
 *  2. WHAT YOU CHOSE TO CULTIVATE. Practising an art whose element overcomes
 *     one of yours in the wuxing cycle is a choice - usually made because the
 *     manual was the only one available, or the only one worth having. That is
 *     the classic xianxia trade: take the fire manual you found, or stay weak.
 *     `conflictsWithRoot` is the arbiter and this module prices the decision.
 *
 * Deviation is not instant death. It tears meridians and burns accumulated
 * progress, which is worse in a slow way: it moves you toward the three-
 * untreated-injuries state where the *next* fight is what kills you.
 */

import {
    type Cultivator,
    type Element,
    type Injury,
    type InjurySeverity
} from '../../schema/cultivation.js';
import { conflictsWithRoot, getSpiritRoot } from './spirit-roots.js';
import { createInjury, scarTempering, untreatedInjuryCount } from './injuries.js';
import type { CultivationRNG } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────
// RISK CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Added risk for cultivating an art whose element overcomes one of the root's.
 *
 * Set at 0.12 - larger than any root's innate risk - because it must dominate.
 * A clean single root that picks up a conflicting manual should be taking on
 * *more* danger than a dual root simply existing, otherwise "cultivate the
 * wrong element" reads as free and the wuxing table becomes decoration.
 */
export const CONFLICTING_TECHNIQUE_RISK = 0.12;

/**
 * Added risk per untreated meridian injury. Small individually; the point is
 * the feedback loop - deviation causes injuries, injuries make deviation more
 * likely, and a run that starts sliding keeps sliding.
 */
export const RISK_PER_UNTREATED_INJURY = 0.02;

/**
 * Added risk for pushing past the progress needed for the next rank without
 * attempting it. Qi that has nowhere to go turns on its owner; this is the
 * mechanical reason "sit on your progress and stay safe" is not a strategy.
 */
export const OVERFULL_PROGRESS_RISK = 0.05;

/** Hard ceiling. Even a catastrophic build should not be a coin flip per check. */
export const MAX_DEVIATION_RISK = 0.45;

/** Fraction of accumulated progress destroyed, by resulting injury severity. */
export const DEVIATION_PROGRESS_LOSS: Record<InjurySeverity, number> = {
    minor: 0.1,
    serious: 0.3,
    crippling: 0.6
};

// ─────────────────────────────────────────────────────────────────────────
// RISK CALCULATION
// ─────────────────────────────────────────────────────────────────────────

export interface DeviationRiskSource {
    source: string;
    label: string;
    /** Probability contribution. Positive increases risk. */
    delta: number;
}

export interface DeviationRiskBreakdown {
    /** Final per-check probability, clamped to [0, MAX_DEVIATION_RISK]. */
    risk: number;
    /** Itemised contributions. Sums to the pre-clamp risk. */
    sources: DeviationRiskSource[];
    /** True when the practised technique's element opposes the root. */
    techniqueConflicts: boolean;
}

export interface DeviationRiskOptions {
    /**
     * Element of the art currently being cultivated. `null`/omitted means an
     * elementless art or raw qi-gathering, which any root may practise safely.
     */
    techniqueElement?: Element | null;
    /**
     * Progress already exceeds what the next rank requires but no attempt has
     * been made. Supplied by the caller because only it knows the ladder state.
     */
    overfullProgress?: boolean;
}

/**
 * Per-check probability of qi deviation.
 *
 * A "check" is one deviation interval, not one day - see
 * DEVIATION_CHECK_DAYS in `time-skip.ts`. Handing this a daily cadence would
 * make a dual root's 0.08 lethal within a season.
 */
export function deviationRisk(
    cultivator: Pick<Cultivator, 'spiritRoot' | 'injuries'>,
    opts: DeviationRiskOptions = {}
): DeviationRiskBreakdown {
    const root = getSpiritRoot(cultivator.spiritRoot);
    const element = opts.techniqueElement ?? null;
    const techniqueConflicts = element !== null && conflictsWithRoot(root, element);
    const untreated = untreatedInjuryCount(cultivator.injuries);

    const sources: DeviationRiskSource[] = [
        {
            source: 'spirit_root',
            label: `${root.name} innate instability`,
            delta: root.deviationRisk
        }
    ];

    if (techniqueConflicts) {
        sources.push({
            source: 'conflicting_technique',
            label: `Cultivating a ${element} art against a ${root.name}`,
            delta: CONFLICTING_TECHNIQUE_RISK
        });
    }

    if (untreated > 0) {
        sources.push({
            source: 'untreated_injuries',
            label: `${untreated} untreated meridian injur${untreated === 1 ? 'y' : 'ies'}`,
            delta: untreated * RISK_PER_UNTREATED_INJURY
        });
    }

    if (opts.overfullProgress) {
        sources.push({
            source: 'overfull_progress',
            label: 'Qi accumulated past the next bottleneck',
            delta: OVERFULL_PROGRESS_RISK
        });
    }

    // Closed wounds. A cultivator who has been through deviation and paid to
    // knit the meridians back recognises the onset and can break the
    // circulation early. Half the value it carries at a breakthrough, and
    // capped by MAX_TEMPERING - it never makes a conflicted build safe.
    const tempering = scarTempering(cultivator.injuries);
    if (tempering.scars > 0) {
        sources.push({
            source: 'tempering',
            label: `${tempering.scars} closed wound${tempering.scars === 1 ? '' : 's'}`,
            delta: -tempering.deviationRelief
        });
    }

    const raw = sources.reduce((sum, s) => sum + s.delta, 0);
    return {
        risk: Math.max(0, Math.min(MAX_DEVIATION_RISK, raw)),
        sources,
        techniqueConflicts
    };
}

// ─────────────────────────────────────────────────────────────────────────
// ROLLING AND RESOLUTION
// ─────────────────────────────────────────────────────────────────────────

export interface DeviationCheck {
    deviated: boolean;
    /** The probability that was tested, for display. */
    risk: number;
    /** The raw [0,1) sample. Exposed so replays and audits can be verified. */
    roll: number;
    breakdown: DeviationRiskBreakdown;
}

/**
 * Roll one deviation check. Consumes exactly one sample from `rng`, always -
 * including when the risk is zero - so that a stream keyed to a day index
 * stays aligned regardless of the cultivator's build.
 */
export function rollDeviation(
    cultivator: Pick<Cultivator, 'spiritRoot' | 'injuries'>,
    rng: CultivationRNG,
    opts: DeviationRiskOptions = {}
): DeviationCheck {
    const breakdown = deviationRisk(cultivator, opts);
    const roll = rng.next();
    return {
        deviated: roll < breakdown.risk,
        risk: breakdown.risk,
        roll,
        breakdown
    };
}

export interface DeviationResolution {
    severity: InjurySeverity;
    injuries: Injury[];
    /** Qi-units of accumulated progress destroyed. Subtract from progress. */
    progressLost: number;
    /** HP lost to the backlash. Subtract from hp. */
    hpLost: number;
    /** Engine-authored factual summary. The narrator renders this. */
    summary: string;
}

export interface DeviationResolutionContext {
    turn: number;
    /**
     * Escalate the severity table. Set when the deviation happened somewhere
     * that makes it worse - mid-breakthrough, mid-tribulation, mid-fight.
     */
    escalate?: boolean;
}

/**
 * Turn a failed deviation check into consequences: one meridian injury, a bite
 * out of accumulated progress, and some HP.
 *
 * Pure - returns deltas, applies nothing. Progress loss is expressed as a
 * fraction of what has been accumulated rather than a flat amount, so it hurts
 * proportionally at every point on a ladder whose costs span four orders of
 * magnitude.
 */
export function resolveDeviation(
    cultivator: Pick<Cultivator, 'cultivationProgress' | 'hp' | 'maxHp'>,
    rng: CultivationRNG,
    ctx: DeviationResolutionContext
): DeviationResolution {
    const severity = rollDeviationSeverity(rng, ctx.escalate ?? false);
    const injury = createInjury(
        { severity, source: 'qi_deviation', turn: ctx.turn },
        rng
    );
    const progressLost = cultivator.cultivationProgress * DEVIATION_PROGRESS_LOSS[severity];
    const hpLost = Math.min(
        cultivator.hp,
        Math.max(1, Math.round(cultivator.maxHp * HP_LOSS_FRACTION[severity]))
    );

    return {
        severity,
        injuries: [injury],
        progressLost,
        hpLost,
        summary:
            `Qi deviation: a ${severity} meridian injury, ` +
            `${Math.round(progressLost)} qi-units of cultivation destroyed, ` +
            `${hpLost} HP lost.`
    };
}

/** HP burned by the backlash, as a fraction of max HP. */
const HP_LOSS_FRACTION: Record<InjurySeverity, number> = {
    minor: 0.1,
    serious: 0.25,
    crippling: 0.45
};

/**
 * Severity table for deviation specifically. Kept separate from
 * `rollInjurySeverity` because deviation is meaningfully nastier than a bad
 * sparring match - it happens inside the meridians rather than to the body.
 */
export function rollDeviationSeverity(rng: CultivationRNG, escalate: boolean): InjurySeverity {
    const roll = rng.next();
    if (escalate) {
        if (roll < 0.25) return 'minor';
        if (roll < 0.7) return 'serious';
        return 'crippling';
    }
    if (roll < 0.55) return 'minor';
    if (roll < 0.9) return 'serious';
    return 'crippling';
}
