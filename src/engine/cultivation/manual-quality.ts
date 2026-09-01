/**
 * How well a manual is written, and how much of it the reader actually takes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO AXES, AND WHY THIS IS THE SECOND ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A manual covers a realm to Perfection and stops. That is `requiredOrdinal`
 * and `cap`, it is COVERAGE, and `docs/world/manuals.md` settles it. This file
 * is the other axis:
 *
 *   A TRASH CORE FORMATION MANUAL AND AN EXCELLENT ONE COVER THE SAME RUNGS.
 *
 * The player-facing sentence the axis exists to produce is "I have a trash Core
 * Formation technique. I can continue, but it is going to take eighty years."
 * Both halves are load-bearing. It has to be genuinely bad, and it has to still
 * work, because a bad book that stops you locks every ordinary cultivator out
 * of the world.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY NOT `grade`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Grade was the obvious candidate and it cannot carry this. `GRADE_ORDINAL_BANDS`
 * in `data/cultivation/techniques.ts` binds grade to `requiredOrdinal` and
 * `GRADE_QI_BANDS` binds it to `qiCost`, and the content suite enforces both on
 * every row. Grade IS the height statement. So the market's 0-13 primer and an
 * apex house's 0-13 intake canon both open at ordinal 0 and are therefore both
 * necessarily `mortal` - the one pair the axis exists to separate is the one
 * pair grade is structurally unable to separate. See `ManualQualitySchema`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A BOOK MAKES A DEMAND, AND THAT IS WHAT STOPS THIS BEING A SHOPPING LIST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * "A mediocre person wouldn't understand a manual from a Tribulation
 * Transcendence cultivator either." A better book is denser, not longer, so the
 * better it is the more it asks of whoever opens it. A reader who cannot meet
 * the demand spends the years anyway and takes very little out, and the
 * arithmetic below makes that WORSE than a plain book matched to them - the
 * realised multiplier falls under 1 - because the time was spent and nothing
 * was understood.
 *
 * The bottom of the ladder is deliberately free of this. `corrupt` and `crude`
 * demand nothing, so nobody is ever punished for reading a bad book. They are
 * simply slow, and the existing clocks - `stagnationYearsForOrdinal` and
 * `lifespanForOrdinal` - decide whether slow is fatal. THERE IS NO DEATH RULE
 * IN THIS FILE and there must never be one; running out of time is the clocks
 * that already exist doing their job against a smaller number.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE IS AND IS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It is the single authority on what a quality tier is worth. It is NOT a
 * fourth resolver: rate, breakthrough odds and combat power each keep their own
 * one authority - `computeCultivationRate`, `computeBreakthroughOdds`,
 * `assessPower` - and each reads one number out of `readManual`. Nothing else
 * in the codebase may interpret a `ManualQuality` name.
 */

import type { Cultivator, ManualQuality } from '../../schema/cultivation.js';
import { foundationOf } from './foundation.js';
import { getSpiritRoot } from './spirit-roots.js';
import { understandingEffects, MAX_DEGREE, type RelevanceContext } from './understanding.js';
import type { FoundationQuality } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// THE TIERS
//
// Sized against the terms that already exist rather than against intuition.
// The whole legal attribute range is worth about x1.5; one realm is x4; a
// foundation runs 0.4 to 1.35 on the rate and -0.15 to +0.06 on the odds. So a
// quality spread of x0.45 to x1.8 on the rate is the largest single non-realm
// term in the game, which is correct - the book you practise is the thing you
// spend every day of your life on - and it is still less than one rung.
// ─────────────────────────────────────────────────────────────────────────

export interface ManualQualityTier {
    /** Multiplier on the cultivation rate, before the reader is considered. */
    rate: number;
    /**
     * Flat modifier on breakthrough odds, before the reader is considered.
     *
     * NOT the book teaching the crossing. `triggersHeavenlyTribulation` takes
     * an ordinal and nothing else, and no manual can change what is waiting.
     * This is the foundation the book spent the whole realm building, arriving
     * at the boundary with you. Preparation, never instruction.
     */
    preparation: number;
    /** Multiplier on the technique factor in `assessPower`. */
    power: number;
    /**
     * What the book asks of whoever opens it, on the 0..5 insight-degree
     * ladder, so the demand is measured in a unit the game already has.
     *
     * Zero at the bottom two tiers ON PURPOSE. A plain book is plain; it has no
     * depth to miss. This is what guarantees an untalented cultivator can
     * always proceed on something.
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

/** Index on that ladder, for comparisons. Mirrors `gradeRank`. */
export function manualQualityRank(quality: ManualQuality): number {
    return MANUAL_QUALITY_ORDER.indexOf(quality);
}

/**
 * What a copy made by somebody who never mastered the art comes out as.
 *
 * One step down, and no further than `corrupt`. This is not authored per
 * manual and must not be: it is the copying rule in `world/manuals.ts` -
 * "only somebody who took the book to its end" can reproduce one - meeting the
 * quality axis, and a bad copy falls out of the two of them without anybody
 * writing a row for it.
 *
 * It also produces the scarcity curve on its own. Mass copying needs masters,
 * masters of a high book barely exist, so nothing above the middle of the
 * ladder ever becomes stock. A bad book up there is `corrupt` - damaged - and
 * never `crude`, because there was never a crowd to wear it down.
 */
export function degradedCopy(quality: ManualQuality): ManualQuality {
    const i = manualQualityRank(quality);
    return MANUAL_QUALITY_ORDER[Math.max(0, i - 1)];
}

// ─────────────────────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * A missing `attributes` reads as the schema pivot rather than as zero: most
 * callers in the world layer carry a partial cultivator, and pricing them as
 * comprehending nothing would make every NPC in the world unable to read a
 * `sound` manual, which is the ordinary case and must not be.
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
 * What a reader with no attribute block is priced at.
 *
 * The schema pivot, which is also `INSIGHT_PIVOT` in `breakthrough.ts`. Stated
 * here rather than imported because importing it would close a cycle -
 * `breakthrough.ts` reads this file.
 */
export const DEFAULT_READER_INSIGHT = 2;

/**
 * How fast the unread part of a book is wasted, per degree of shortfall.
 *
 * 0.35 as a divisor coefficient: one degree short realises 74% of the book,
 * three degrees short 49%. Sized so that a mediocre reader on a `pristine`
 * canon lands at 1.8 x 0.49 = 0.88, which is BELOW the 1.0 of a `sound` book
 * matched to them. That inequality is the design requirement - a manual far
 * above you is a paperweight, and reading it is worse than reading one pitched
 * at you - so it is the thing to preserve if these numbers are ever retuned.
 */
export const SHORTFALL_COST_PER_DEGREE = 0.35;

// ─────────────────────────────────────────────────────────────────────────
// THE READING
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * The three effects are NOT symmetric, and the asymmetry is deliberate:
 *
 *   RATE scales straight through the realisation, so an unread book is
 *   actively worse than a plain one. The years were spent. That is the cost.
 *
 *   PREPARATION scales through it too, because the foundation the book built
 *   is exactly the part that was not built. A reader who took nothing out
 *   arrives at the crossing with nothing extra - not with a penalty, because
 *   they did still practise something.
 *
 *   POWER interpolates from 1 instead, because an art you do not understand is
 *   an art you do not use. Being handed a great method does not make you worse
 *   in a fight; it just does not make you better.
 *
 * The bottom two tiers demand nothing, so their realisation is always 1 and all
 * three lines are simply the tier. A bad book is slow, and never a trap.
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
 *
 * A SHELF IS NOT A BOOK, and conflating them produced a genuinely perverse
 * result: pricing an origin at the top of its shelf made a mediocre child of a
 * Dao house climb SLOWER than a retainer's child, because the house's worked
 * canon was over their head and the retainer's working book was not. Measured,
 * the top tier reached ordinal 9 where sect_retainer reached 12 - taken under
 * the single `great_house` row that is now `dao_house_bloodline` and two
 * siblings, so the figures are traceable to a table that no longer exists.
 *
 * That is the paperweight rule applied where it does not belong. It is correct
 * for a book somebody HOLDS - a ruin find, a stolen canon, the one object in
 * the room - because there is nothing else to read. It is wrong for an
 * institution, which holds a shelf: `docs/world/manuals.md` says rank reaches
 * up the shelf and that admission buys something and never the core, so what a
 * house hands a disciple is the best thing they can actually work.
 *
 * So: the highest tier at or below `best` that this reader gets the most out
 * of, ties going to the better book because it is also worth more at a crossing
 * and in a fight. A prodigy reaches the top of the shelf; somebody ordinary
 * takes the working book and is not punished for having been born somewhere
 * good.
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
 *
 * The setting wants the scene where somebody who has practised a market primer
 * picks up a house's version of the same rungs and can SEE that it is better.
 * They can, up to the point where the better book stops being legible to them:
 * you cannot recognise depth you could not have used.
 *
 * Pure, no roll, no state. The narrator asks and gets an answer.
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
