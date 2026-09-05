/**
 * How well a manual is written, and how much of it the reader actually takes out.
 *
 * The bottom of the ladder is deliberately free of this: `corrupt` and `crude`
 * demand nothing, so nobody is punished for reading a bad book - they are simply
 * slow, and the existing clocks decide whether slow is fatal. THERE IS NO DEATH
 * RULE IN THIS FILE and there must never be one.
 *
 * A SHELF IS NOT A BOOK. Pricing an origin at the top of its shelf made a
 * mediocre child of a Dao house climb SLOWER than a retainer's child, because the
 * house's worked canon was over their head - measured, the top tier reached
 * ordinal 9 where sect_retainer reached 12.
 */

import type { Cultivator, ManualQuality } from '../../schema/cultivation.js';
import { foundationOf } from './foundation.js';
import { getSpiritRoot } from './spirit-roots.js';
import { understandingEffects, MAX_DEGREE, type RelevanceContext } from './understanding.js';
import type { FoundationQuality } from '../../schema/cultivation.js';

// THE TIERS
//
// Sized against the terms that already exist rather than against intuition.
// The whole legal attribute range is worth about x1.5; one realm is x4; a
// foundation runs 0.4 to 1.35 on the rate and -0.15 to +0.06 on the odds. So a
// quality spread of x0.45 to x1.8 on the rate is the largest single non-realm
// term in the game, which is correct - the book you practise is the thing you
// spend every day of your life on - and it is still less than one rung.

export interface ManualQualityTier {
    /** Multiplier on the cultivation rate, before the reader is considered. */
    rate: number;
    /**
     * Flat modifier on breakthrough odds, before the reader is considered.
     */
    preparation: number;
    /** Multiplier on the technique factor in `assessPower`. */
    power: number;
    /**
     * What the book asks of whoever opens it, on the 0..5 insight-degree ladder, so
     * the demand is measured in a unit the game already has.
     */
    demand: number;
    /** Human-facing, for the rate breakdown and the odds ledger. */
    label: string;
    /** What made it this way. The causes are what the world actually produces. */
    cause: string;
}

export const MANUAL_QUALITY_TIERS: Record<ManualQuality, ManualQualityTier> = {
    corrupt: {
        rate: 0.45,
        preparation: -0.06,
        power: 0.85,
        demand: 0,
        label: 'A damaged text',
        cause: 'Miscopied, fragmentary, or set down by somebody who did not survive it. '
            + 'It still works. It works badly, and it leaves gaps where a foundation should be.'
    },
    crude: {
        rate: 0.75,
        preparation: -0.025,
        power: 0.94,
        demand: 0,
        label: 'A plain copy',
        cause: 'Plainly set down and honestly complete. What a market stall sells. '
            + 'Nothing wrong with it and nothing in it either.'
    },
    sound: {
        rate: 1,
        preparation: 0,
        power: 1,
        demand: 1.5,
        label: 'A working book',
        cause: 'A lineage behind it and somebody alive who has read it to the end.'
    },
    refined: {
        rate: 1.35,
        preparation: 0.035,
        power: 1.1,
        demand: 3,
        label: 'A worked canon',
        cause: 'Generations each took it to its end and wrote down what they found there. '
            + 'Denser than it looks, and it asks for a reader who can see that.'
    },
    pristine: {
        rate: 1.8,
        preparation: 0.07,
        power: 1.22,
        demand: 5,
        label: "The author's own hand",
        cause: 'Complete, nothing lost in transmission, and written by somebody who had '
            + 'stood where it ends. Most people who open one take almost nothing out of it.'
    }
};

/** Worst to best. The order the tiers are meant to be compared in. */
export const MANUAL_QUALITY_ORDER: readonly ManualQuality[] =
    ['corrupt', 'crude', 'sound', 'refined', 'pristine'] as const;

/**
 * Index on that ladder, for comparisons.
 */
export function manualQualityRank(quality: ManualQuality): number {
    return MANUAL_QUALITY_ORDER.indexOf(quality);
}

/**
 * What a copy made by somebody who never mastered the art comes out as. One step
 * down and no further than `corrupt`, and not authored per manual: it is the
 * copying rule in `world/manuals.ts` meeting the quality axis.
 */
export function degradedCopy(quality: ManualQuality): ManualQuality {
    const i = manualQualityRank(quality);
    return MANUAL_QUALITY_ORDER[Math.max(0, i - 1)];
}

// WHAT THE READER BRINGS
//
// Measured in insight degrees, the ladder `understanding.ts` already uses, so
// "this book asks for three degrees" means something a player has seen before.
// Three terms and no more, each of them a quantity that already exists:
//
//   INNATE INSIGHT    is this person a prodigy. 1..4 by schema, and the whole
//                     legal range is 3 points, which is most of the scale.
//   WHAT THEY HAVE    the deepest insight that actually BEARS on what they are
//   ACTUALLY SEEN     practising, halved. `understandingEffects` decides
//                     relevance; a sword saint reading a water canon brings
//                     nothing to it, which is already this file's rule.
//   FOUNDATION        what the last realm left them standing on. Small, because
//                     a foundation is preparation rather than comprehension.

/** Insight degrees a foundation is worth when reading something difficult. */
const FOUNDATION_COMPREHENSION: Record<FoundationQuality, number> = {
    none: 0,
    exceptional: 1,
    stable: 0.5,
    unstable: 0.25,
    incomplete: 0,
    damaged: 0,
    transformed: 0.75,
    rebuilt: 0.25,
    sacrificed: 0
};

/** Half a degree per degree seen, capped at the ladder's own top. */
const SEEN_PER_DEGREE = 0.5;

export type ManualReader =
    Pick<Cultivator, 'spiritRoot'>
    & Partial<Pick<Cultivator, 'attributes' | 'insights' | 'foundationQuality'>>;

export interface ReaderComprehension {
    /** Total, in insight degrees. */
    degrees: number;
    fromInsight: number;
    fromSeen: number;
    fromFoundation: number;
}

/**
 * How much depth this reader can take out of a difficult book.
 */
export function readerComprehension(
    reader: ManualReader,
    relevance?: Partial<RelevanceContext>
): ReaderComprehension {
    const insight = reader.attributes?.insight ?? DEFAULT_READER_INSIGHT;
    const root = getSpiritRoot(reader.spiritRoot);
    const understanding = understandingEffects(reader.insights ?? [], {
        rootElements: root.elements,
        techniqueElement: relevance?.techniqueElement ?? null,
        techniqueSubject: relevance?.techniqueSubject ?? null
    });
    const deepest = understanding.contributing.reduce(
        (best, c) => Math.max(best, c.degree), 0
    );

    const fromInsight = insight;
    const fromSeen = Math.min(MAX_DEGREE, deepest) * SEEN_PER_DEGREE;
    const fromFoundation = FOUNDATION_COMPREHENSION[foundationOf(reader)];

    return {
        degrees: fromInsight + fromSeen + fromFoundation,
        fromInsight,
        fromSeen,
        fromFoundation
    };
}

/**
 * What a reader with no attribute block is priced at. A missing `attributes`
 * reads as the schema pivot rather than as zero: most world-layer callers carry a
 * partial cultivator, and pricing them as comprehending nothing would make every
 * NPC unable to read a `sound` manual, which is the ordinary case.
 */
export const DEFAULT_READER_INSIGHT = 2;

/**
 * How fast the unread part of a book is wasted, per degree of shortfall. 0.35 as
 * a divisor coefficient: one degree short realises 74% of the book, three degrees
 * short 49%. Sized so a mediocre reader on a `pristine` canon lands at
 * 1.8 x 0.49 = 0.88, BELOW the 1.0 of a `sound` book matched to them. That
 * inequality is the design requirement and is what to preserve on a retune.
 */
export const SHORTFALL_COST_PER_DEGREE = 0.35;

// THE READING

export interface ManualReading {
    quality: ManualQuality;
    /** What the book asks, in insight degrees. */
    demand: number;
    /** What the reader brought, in insight degrees. */
    comprehension: number;
    /** Degrees short. Zero when the reader meets or exceeds the demand. */
    shortfall: number;
    /** 0..1. How much of what is on the page this reader gets off it. */
    realised: number;
    /** Multiplier for `computeCultivationRate`'s manual factor. */
    rateMultiplier: number;
    /** Flat delta for `computeBreakthroughOdds`. Preparation, not instruction. */
    breakthroughModifier: number;
    /** Multiplier on the technique factor in `assessPower`. */
    powerMultiplier: number;
    /** Human-facing, for the breakdown line and the odds ledger. */
    label: string;
}

/** The identity element on all three lines. See the guard in `readManual`. */
export const NO_MANUAL_DECLARED: ManualReading = {
    quality: 'sound',
    demand: 0,
    comprehension: 0,
    shortfall: 0,
    realised: 1,
    rateMultiplier: 1,
    breakthroughModifier: 0,
    powerMultiplier: 1,
    label: 'No manual declared'
};

/**
 * What this book is worth to this reader.
 */
export function readManual(
    manual: { quality?: ManualQuality | null } | null | undefined,
    reader: ManualReader,
    relevance?: Partial<RelevanceContext>
): ManualReading {
    // NO BOOK DECLARED IS NOT THE SAME AS A `sound` BOOK, and conflating them
    // was a real bug for one edit: `sound` has a demand, so a caller that had
    // never heard of this axis would have started paying a shortfall on a
    // manual it never named. An undeclared manual is the identity element on
    // all three lines, exactly as it was before this axis existed.
    if (!manual) return NO_MANUAL_DECLARED;
    const quality: ManualQuality = manual.quality ?? 'sound';
    const tier = MANUAL_QUALITY_TIERS[quality];
    const comprehension = readerComprehension(reader, relevance).degrees;
    const shortfall = Math.max(0, tier.demand - comprehension);
    const realised = 1 / (1 + shortfall * SHORTFALL_COST_PER_DEGREE);

    return {
        quality,
        demand: tier.demand,
        comprehension,
        shortfall,
        realised,
        rateMultiplier: tier.rate * realised,
        breakthroughModifier: tier.preparation * realised,
        powerMultiplier: 1 + (tier.power - 1) * realised,
        label: shortfall <= 0
            ? tier.label
            : `${tier.label}, and ${round1(shortfall)} degree(s) over this reader `
              + `(${Math.round(realised * 100)}% of it lands)`
    };
}

/**
 * The best book on a shelf that reaches this far, for this reader.
 */
export function bestReadable(best: ManualQuality, reader: ManualReader): ManualQuality {
    let chosen = best;
    let chosenRate = -1;
    for (let i = manualQualityRank(best); i >= 0; i--) {
        const candidate = MANUAL_QUALITY_ORDER[i];
        const rate = readManual({ quality: candidate }, reader).rateMultiplier;
        if (rate > chosenRate) {
            chosenRate = rate;
            chosen = candidate;
        }
    }
    return chosen;
}

/** The rate multiplier alone. 1 when no manual was declared. */
export function manualRateMultiplier(
    manual: { quality?: ManualQuality | null } | null | undefined,
    reader: ManualReader,
    relevance?: Partial<RelevanceContext>
): number {
    if (!manual) return 1;
    return readManual(manual, reader, relevance).rateMultiplier;
}

function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

/**
 * Can this reader tell the two books apart before spending a decade on one?
 */
export function canTellApart(
    a: { quality?: ManualQuality | null } | null | undefined,
    b: { quality?: ManualQuality | null } | null | undefined,
    reader: ManualReader
): boolean {
    const qa: ManualQuality = a?.quality ?? 'sound';
    const qb: ManualQuality = b?.quality ?? 'sound';
    if (qa === qb) return false;
    const better = manualQualityRank(qa) > manualQualityRank(qb) ? qa : qb;
    const worse = better === qa ? qb : qa;
    const comprehension = readerComprehension(reader).degrees;
    // The worse book is fully legible by definition of being worse; what is in
    // question is whether the better one shows the reader anything the worse
    // one did not. Half the shortfall is the threshold, not the whole of it -
    // seeing that a book is deeper is easier than working it.
    const gap = MANUAL_QUALITY_TIERS[better].demand - MANUAL_QUALITY_TIERS[worse].demand;
    return comprehension + gap * 0.5 >= MANUAL_QUALITY_TIERS[better].demand;
}
