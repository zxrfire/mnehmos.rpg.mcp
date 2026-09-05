/**
 * Qi deviation (走火入魔) - cultivation going wrong inside the body.
 *
 * Ruled by the design owner: *"Idle shouldn't RANDOMLY accumulate injuries.
 * Injuries come from what you DO. Events, right?"* A wound has a cause you can
 * point at, so nothing here fires on its own: `deviationRisk` prices a danger and
 * `rollDeviation` tests it, and both wait to be asked by something that happened.
 * There is no third caller and there must not be one that keys on the calendar.
 *
 * The time skip used to roll every thirty days regardless. Measured through
 * `ADMIN advance_days`, a body that did nothing at all took better than one wound
 * a year and died of qi deviation inside a decade, whatever it paid for food.
 */

import {
    type Cultivator,
    type Element,
    type Injury,
    type InjurySeverity
} from '../../schema/cultivation.js';
import { conflictsWithRoot, getSpiritRoot } from './spirit-roots.js';
import { createInjury, scarTempering, untreatedInjuryCount } from './injuries.js';
import { ordinaryWoundFor } from './which-wound-an-ordinary-injury-is.js';
import type { CultivationRNG } from './rng.js';

// RISK CONSTANTS

/**
 * Added risk for cultivating an art whose element overcomes one of the roots.
 * Measured, treated against untreated, 24 lives each:
 *
 *   dual_metal_wood   treated 0.76 wounds/yr, 0 of 24 dead, ordinal 7
 *                     untreated 1.39 wounds/yr, 24 of 24 dead, ordinal 2.3
 *   muddled_five      treated 0.20 wounds/yr, 0 of 24 dead, ordinal 7
 *                     untreated 0.56 wounds/yr, 24 of 24 dead, ordinal 2.7
 */
export const CONFLICTING_TECHNIQUE_RISK = 0.12;

/**
 * Added risk per untreated meridian injury. Small individually; the point is the
 * feedback loop - deviation causes injuries, injuries make deviation more likely,
 * and a run that starts sliding keeps sliding.
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

// RISK CALCULATION

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

// ROLLING AND RESOLUTION

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
 * Turn a failed deviation check into consequences: one meridian injury, a bite out
 * of accumulated progress, and some HP.
 */
export function resolveDeviation(
    cultivator: Pick<Cultivator, 'cultivationProgress' | 'hp' | 'maxHp'>,
    rng: CultivationRNG,
    ctx: DeviationResolutionContext
): DeviationResolution {
    const severity = rollDeviationSeverity(rng, ctx.escalate ?? false);
    const injury = createInjury(
        { severity, source: 'qi_deviation', turn: ctx.turn, woundType: ordinaryWoundFor('qi_deviation', severity) },
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
