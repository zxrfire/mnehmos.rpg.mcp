/**
 * Foundation quality - why two cultivators at the same ordinal have different
 * futures, and how the engine says so.
 *
 * The charter is explicit that progression must not read as
 * `XP -> XP -> next realm`, and the single largest lever on that is the
 * Foundation Establishment crossing at ordinal 12 -> 13. Everything above it is
 * built on whatever got laid down there. A cultivator who spent two years
 * finding a dense-ash cave, bought the right pill, healed their meridians first
 * and crossed unhurried is not "slightly ahead" of one who crossed in a ditch
 * with three torn meridians because something was chasing them - they are on a
 * different curve for the rest of the run.
 *
 * The quality is a permanent multiplier on cultivation rate, a permanent
 * modifier on breakthrough odds, and - because the Vault notices structure -
 * a modifier on the toll. A damaged foundation is not a debuff that wears off.
 * It is what the rest of the life is built on.
 *
 * IMPORTANT, and it is a charter rule: none of this is rubber-banded. The
 * assessment reads only preparation, ambient ash, injuries, pills, talent and
 * one seeded sample. It does not know how the run is going and it does not
 * care. A prodigy who rushes lays a bad foundation; a muddled root who prepares
 * for a decade lays a good one. That asymmetry is the point - it is the
 * mechanism by which "talent is not destiny" is actually true rather than
 * merely asserted.
 */

import {
    type AmbientQi,
    type Cultivator,
    type FoundationQuality
} from '../../schema/cultivation.js';
import { FOUNDATION_ORDINAL } from './realms.js';
import { getSpiritRoot } from './spirit-roots.js';
import { aggregateInjuryPenalties } from './injuries.js';

// ─────────────────────────────────────────────────────────────────────────
// EFFECTS
// One table, read by cultivation.ts, breakthrough.ts and toll.ts. Keeping the
// three consequences of a foundation in one place is what stops them drifting
// apart into a rate penalty that nobody feels and an odds penalty nobody can
// find.
// ─────────────────────────────────────────────────────────────────────────

export interface FoundationEffect {
    /** Multiplier folded into the per-day cultivation rate. */
    cultivationMultiplier: number;
    /** Flat modifier on breakthrough probability. */
    breakthroughModifier: number;
    /**
     * Flat modifier on toll risk. Positive means the Vault is MORE likely to
     * take something: a structure with holes in it is easier to reach into.
     */
    tollModifier: number;
    description: string;
}

export const FOUNDATION_EFFECTS: Record<FoundationQuality, FoundationEffect> = {
    none: {
        cultivationMultiplier: 1,
        breakthroughModifier: 0,
        tollModifier: 0,
        description: 'No foundation has been laid yet. Below Foundation Establishment there is nothing to have quality.'
    },
    exceptional: {
        cultivationMultiplier: 1.25,
        breakthroughModifier: 0.06,
        tollModifier: -0.05,
        description: 'Laid in dense ash, unhurried, with the right pill and clean meridians. Everything above it will be easier than it was for anyone else at this rank.'
    },
    stable: {
        cultivationMultiplier: 1,
        breakthroughModifier: 0,
        tollModifier: 0,
        description: 'A sound foundation. The ordinary good outcome, and more than most people get.'
    },
    unstable: {
        cultivationMultiplier: 0.85,
        breakthroughModifier: -0.05,
        tollModifier: 0.03,
        description: 'It holds, and it complains. Cultivation runs rough and bottlenecks bite harder than they should.'
    },
    incomplete: {
        cultivationMultiplier: 0.7,
        breakthroughModifier: -0.08,
        tollModifier: 0.05,
        description: 'Crossed before the structure had finished forming. Part of it was never there, and it cannot be added later.'
    },
    damaged: {
        cultivationMultiplier: 0.55,
        breakthroughModifier: -0.12,
        tollModifier: 0.06,
        description: 'Laid over torn meridians. The damage is now structural rather than an injury, and no pill treats it.'
    },
    transformed: {
        // The fastest thing in the table, and the only positive tollModifier:
        // whatever reworked this foundation made it legible to the Vault.
        cultivationMultiplier: 1.35,
        breakthroughModifier: 0.04,
        tollModifier: 0.02,
        description: 'Reworked by something that was not human. It is faster than any foundation should be, and it is easier to see from above.'
    },
    rebuilt: {
        cultivationMultiplier: 0.9,
        breakthroughModifier: -0.02,
        tollModifier: 0,
        description: 'Destroyed and laid again from the wreckage. Serviceable. Never pristine, and the second one always remembers the first.'
    },
    sacrificed: {
        cultivationMultiplier: 0.4,
        breakthroughModifier: -0.15,
        tollModifier: 0.08,
        description: 'Spent deliberately for something judged worth more. Whatever that was, this is what it cost.'
    }
};

export function foundationEffect(quality: FoundationQuality): FoundationEffect {
    return FOUNDATION_EFFECTS[quality];
}

/** Engine-authored factual account. The "why" behind two diverging futures. */
export function describeFoundation(quality: FoundationQuality): string {
    return FOUNDATION_EFFECTS[quality].description;
}

/**
 * Read a cultivator's foundation defensively.
 *
 * Everything that consumes a foundation accepts a partial cultivator, because
 * most callers - the time-skip's internal snapshot, an NPC stub, a row written
 * before foundations existed - legitimately do not carry the field. Missing
 * reads as 'none', which is the identity element in every table above.
 */
export function foundationOf(
    cultivator: Partial<Pick<Cultivator, 'foundationQuality'>>
): FoundationQuality {
    return cultivator.foundationQuality ?? 'none';
}

// ─────────────────────────────────────────────────────────────────────────
// LAYING THE FOUNDATION
// Scored, not rolled from a flat table: the inputs are things the player
// actually spent, so the outcome is earned rather than dealt.
// ─────────────────────────────────────────────────────────────────────────

/** Ambient ash contribution. Thin ash cannot fill a structure this size. */
export const FOUNDATION_AMBIENT_SCORE: Record<AmbientQi, number> = {
    thin: -2,
    normal: 0,
    dense: 2,
    spirit_tide: 3
};

/** How far the seeded sample may shift the score in either direction. */
export const FOUNDATION_ROLL_SPREAD = 1.5;

/** Score thresholds, best first. The first one met wins. */
export const FOUNDATION_THRESHOLDS: readonly { min: number; quality: FoundationQuality }[] = [
    { min: 5, quality: 'exceptional' },
    { min: 2, quality: 'stable' },
    { min: 0, quality: 'unstable' },
    { min: -2.5, quality: 'incomplete' },
    { min: Number.NEGATIVE_INFINITY, quality: 'damaged' }
] as const;

export interface FoundationFactor {
    source: string;
    label: string;
    delta: number;
}

export interface FoundationAssessment {
    quality: FoundationQuality;
    /** Final score after the sample. */
    score: number;
    /** Itemised, and sums exactly to `score`. */
    factors: FoundationFactor[];
    narrationHint: string;
}

export interface FoundationConditions {
    ambient: AmbientQi;
    /**
     * How well the crossing was prepared, 0..1: a chosen site, a cleared
     * schedule, nobody hunting you. The caller composes this from world state.
     */
    preparation?: number;
    /** Potency of a foundation-grade pill consumed for the crossing, 0..1. */
    pillPotency?: number;
    /** Crossed under pressure - pursued, ambushed, out of time. */
    hurried?: boolean;
}

/**
 * Assess the foundation laid by a successful 12 -> 13 crossing.
 *
 * Takes a uniform [0,1) `sample` rather than an RNG, matching `rollSpiritRoot`
 * and `rollAmbientQi`: the caller owns seeding, always. Exactly one sample is
 * consumed, which is what lets `attemptBreakthrough` draw it from its own
 * stream without desynchronising anything downstream.
 */
export function assessFoundation(
    cultivator: Pick<Cultivator, 'spiritRoot' | 'attributes' | 'injuries'>,
    conditions: FoundationConditions,
    sample: number
): FoundationAssessment {
    const root = getSpiritRoot(cultivator.spiritRoot);
    const injuries = aggregateInjuryPenalties(cultivator.injuries);
    const preparation = clamp01(conditions.preparation ?? 0);
    const pillPotency = clamp01(conditions.pillPotency ?? 0);

    const factors: FoundationFactor[] = [
        {
            source: 'ambient_ash',
            label: `Ambient ash (${conditions.ambient})`,
            delta: FOUNDATION_AMBIENT_SCORE[conditions.ambient]
        },
        {
            source: 'preparation',
            label: 'Preparation and site',
            delta: preparation * 3
        },
        {
            source: 'pill',
            label: 'Foundation pill',
            delta: pillPotency * 2.5
        },
        {
            source: 'untreated_injuries',
            // Injuries are the single most destructive input, and deliberately
            // so: laying a foundation over torn meridians is the canonical way
            // a promising run quietly ends four realms later.
            label:
                injuries.untreatedCount === 0
                    ? 'Meridians clear'
                    : `${injuries.untreatedCount} untreated meridian injur${injuries.untreatedCount === 1 ? 'y' : 'ies'}`,
            delta: -injuries.untreatedCount * 1.5
        },
        {
            source: 'insight',
            label: 'Insight',
            delta: cultivator.attributes.insight - 2
        },
        {
            source: 'spirit_root',
            label: root.name,
            delta: ROOT_FOUNDATION_SCORE[root.grade]
        }
    ];

    if (conditions.hurried) {
        factors.push({
            source: 'hurried',
            label: 'Crossed under pressure',
            delta: -2
        });
    }

    // One sample, mapped to a symmetric spread. Not a fudge factor - it is the
    // part nobody controls, and it is why the same preparation twice does not
    // produce the same foundation twice.
    const clampedSample = Math.max(0, Math.min(0.999999999, sample));
    factors.push({
        source: 'roll',
        label: 'The crossing itself',
        delta: (clampedSample * 2 - 1) * FOUNDATION_ROLL_SPREAD
    });

    const score = factors.reduce((sum, f) => sum + f.delta, 0);
    const quality =
        FOUNDATION_THRESHOLDS.find(t => score >= t.min)?.quality ?? 'damaged';

    return {
        quality,
        score,
        factors,
        narrationHint:
            `Foundation Establishment crossed. The foundation laid is ${quality} ` +
            `(score ${score.toFixed(2)}). ${describeFoundation(quality)}`
    };
}

/**
 * Talent helps lay a foundation, but far less than preparation does: the whole
 * range here is 2 points against preparation's 3 and injuries' unbounded
 * negative. A muddled root who prepares out-lays a single root who rushes.
 */
const ROOT_FOUNDATION_SCORE: Record<string, number> = {
    single: 1,
    mutated: 1,
    dual: -0.5,
    muddled: -1
};

/**
 * Whether a successful attempt from `fromOrdinal` is the crossing that lays a
 * foundation. Exactly one crossing in a run ever is.
 */
export function laysFoundation(fromOrdinal: number): boolean {
    return fromOrdinal + 1 === FOUNDATION_ORDINAL;
}

/**
 * Rebuild a destroyed foundation.
 *
 * The charter's "loss branches rather than subtracts": a cultivator whose
 * foundation was shattered is not simply a smaller number, they are someone
 * who now has to lay one again from wreckage and will carry the seam forever.
 * 'rebuilt' is strictly worse than 'stable' and strictly better than the
 * 'damaged' it usually replaces, which is what makes the attempt worth making.
 *
 * The other two qualities this module does not assign - 'transformed' and
 * 'sacrificed' - are set by events outside the cultivation layer (a body
 * refining inheritance, a deliberate expenditure), and are listed in the
 * effects table so those systems have somewhere to write to.
 */
export function rebuildFoundation(previous: FoundationQuality): FoundationQuality {
    if (previous === 'none') return 'none';
    return 'rebuilt';
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
