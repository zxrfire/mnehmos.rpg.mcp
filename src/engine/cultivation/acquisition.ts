/**
 * What a capped cultivator does next.
 *
 * `techniqueExhausted` in `cultivation.ts` stops a cultivator dead at their
 * manual's `cap`. Not a taper - a multiplier of zero. This module is the other
 * half of that: the arithmetic behind the doors out, specified in
 * [`docs/world/climbing/past-the-ceiling.md`](../../../docs/world/climbing/past-the-ceiling.md) as routes 1b and 7.
 *
 * Nothing here is a new subsystem. Every rule below is a function of something
 * the engine already reads:
 *
 *   the cap          `capOf`'s realm geometry, restated where realms live
 *   a partial set    `shardPower` - the ONE piece of "a piece is worth less
 *                    than the whole" arithmetic in this repo
 *   who may read it  `daoGate`'s shape and `daoMatches`' judgement
 *   who may write it the same, one standing higher
 *
 * ── THE FOUR REASONS A MANUAL FAILS SOMEBODY ─────────────────────────────
 *
 * There are now four, they are independent, and the whole design rests on a
 * player being able to tell which one bit. Collapsing any two of them loses
 * the fact that matters:
 *
 *   cap           it is for you, you can read it, and it ENDS. Another book.
 *                 `techniqueExhausted`. Fixed by going somewhere.
 *   suitability   it is sound and it is not written for your root. Nothing
 *                 fixes it, ever. `assessFit`, in the encounters layer.
 *   dao standing  you have not walked far enough along its road to begin it
 *                 at all. {@link manualGate}. Fixed by living, not by sitting.
 *   the opening   you can begin it and the first stretch is uphill.
 *                 {@link openingMultiplier}. Fixed by the years.
 *
 * Every function in this file returns its own reason string for exactly that
 * reason. A refusal without an attributable cause reads as an arbitrary
 * system, and the lesson a player draws from an arbitrary system is to sit
 * longer - which is the precise opposite of what the corridor is for.
 *
 * ── WHY THE MEASURE IS REALMS AND NOT RUNGS ──────────────────────────────
 *
 * Measured off the live catalog rather than assumed. Seventeen cultivation
 * manuals; above `requiredOrdinal` 13 the widest `cap - requiredOrdinal` is 4,
 * and the two wider than that (13 and 8 rungs) both sit inside Qi Condensation,
 * which is one realm thirteen rungs deep. In REALMS every manual in the world
 * spans exactly one. That is not a tuning choice - `capOf` is
 * `realmForOrdinal(requiredOrdinal).ordinalEnd + 1`, so a manual carries you
 * through its realm and one rung over the boundary, and the succession of books
 * is a fact about realm geometry.
 *
 * So {@link realmsSpannedBy} is the honest measure of "is this book
 * exceptional", it reads 1 for the entire current catalog, and every gate keyed
 * on it is INERT today in exactly the way `DAO_GATE_FROM_ORDINAL` is inert.
 * The day the data layer authors a two-realm manual, the gates fire on their
 * own without anybody remembering to wire them up.
 *
 * ── WHAT THIS MODULE DOES NOT DO ─────────────────────────────────────────
 *
 * It does not decide whether a manual suits a root. That is `assessFit` in
 * `../encounters/suitability.ts`, and the two are deliberately independent: a
 * perfectly suited manual still runs out and an ill-suited one teaches nothing
 * at any height. It does not write to anything. And it never asserts a manual
 * into existence on a narrator's say-so - {@link deriveContinuation} is the
 * only thing in this repo that creates an art at runtime, and it is a pure
 * function of a seeded stream.
 */

import { MAX_ORDINAL, rankName } from './realms.js';
import {
    daoMatches,
    daoName,
    GRADE_REQUIREMENT,
    type DaoAssessment,
    type DaoStanding,
    type GatedTechnique
} from './dao.js';
import { forStream } from './rng.js';
// Realm geometry and the opening penalty live beside `techniqueExhausted` in
// `cultivation.ts`, because this module reaches `shardPower` in the world layer
// and the world layer imports that file - defining them here and importing them
// back would close a runtime cycle. Re-exported below so callers of the
// routes have one import site.
import {
    ORDINARY_REALM_SPAN,
    OPENING_COST_PER_EXCESS_REALM,
    openingMultiplier,
    openingPenalty,
    ordinaryCapFor,
    realmsSpannedBy,
    type AuthoredOpening,
    type ManualBand,
    type OpeningPenalty
} from './cultivation.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
// The one piece of "a piece is worth less than the whole" arithmetic in the
// repo. A volume of a scattered canon is a manual capped one rung lower for
// exactly the reason a shattered blade is a worse blade, and there must not be
// a second function that says so. See `possessions.ts`'s own note: "There is no
// special case at the top of the scale and there must not be one."
import { shardPower } from '../world/possessions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SHAPE OF A MANUAL
//
// Structural, not imported. `src/engine/cultivation/**` holds no dependency on
// `src/data/**` and this module does not introduce one - a caller assembles
// this from whatever catalog the book came out of, exactly as `GatedTechnique`
// is assembled for `daoGate`.
// ─────────────────────────────────────────────────────────────────────────

/** A cultivation manual, reduced to what its ceiling is a function of. */
export interface CappedManual {
    id: string;
    name?: string;
    /** The rung it can first be taken up at. */
    requiredOrdinal: number;
    /**
     * The rung past which it teaches nothing. Null means it carries a reader
     * to the top of the ladder - the top prize in the setting, and legal only
     * because `MANUALS_MAY_EXCEED_THE_LID`.
     */
    cap: number | null;
    /**
     * Ordered ids of the OBJECT rows that carry this work in parts, or null
     * for a single-volume work. See {@link effectiveCapOf}.
     */
    volumes?: readonly string[] | null;
    /**
     * The catalog's own statement of how hard this manual is to begin, when it
     * makes one. Absent or null means realm geometry supplies the default -
     * see {@link openingPenalty}.
     */
    opening?: AuthoredOpening | null;
}

/** A manual as the two dao gates read it: its ceiling plus its road. */
export interface GatedManual extends CappedManual, GatedTechnique {
    grade: TechniqueGrade;
    /**
     * The comprehension the CATALOG says this manual cannot be worked without,
     * if it says anything. Read by `assessFit` in the encounters layer, which
     * is where it is enforced.
     *
     * Present here only so {@link manualDaoRequirement} can stand down. A
     * manual that states its own comprehension gate has answered the question
     * "how much understanding does this ask for", and the span curve must not
     * stack a second, harder answer on top of it - five reasons a book can fail
     * somebody is four too many, and two of them measuring the same thing is
     * how a system starts reading as arbitrary.
     */
    domain?: string | null;
    domainDegree?: number;
}

/** A manual as {@link canExtend} reads it. */
export interface ExtendableManual extends GatedManual {
    /**
     * NO LONGER READ, and kept only so a caller passing a catalog row still
     * typechecks.
     *
     * It encoded an opt-in allowlist: certain manuals were extendable and the
     * rest were not. That is the wrong model. Writing the next stage is
     * something a CULTIVATOR does to the book in front of them, not a property
     * an author blesses certain rows with - so extension is available by
     * default and what varies is whether anybody could manage it, which is what
     * the new-ground curve measures.
     *
     * @deprecated Read `notExtendableReason` instead.
     */
    derivable?: boolean;
    /**
     * Why this particular manual cannot be extended, however deep the reader,
     * or null/absent for the ordinary case where it can.
     *
     * The opt-OUT, and the half of the old model worth keeping. These are the
     * interesting refusals - the ones where "you cannot write the next stage"
     * is a fact about the book rather than about the reader. The catalog's
     * `NOT_DERIVABLE_NOTES` are already exactly this and are read verbatim.
     */
    notExtendableReason?: string | null;
    /** The catalog's current name for the field above. Read as a fallback. */
    notDerivableReason?: string | null;
}

/** @deprecated Renamed to {@link ExtendableManual}. */
export type DerivableManual = ExtendableManual;

// Realm geometry and the opening penalty, re-exported from `cultivation.ts` so
// that everything the routes past a ceiling need reads off one import.
export {
    ORDINARY_REALM_SPAN,
    OPENING_COST_PER_EXCESS_REALM,
    openingMultiplier,
    openingPenalty,
    ordinaryCapFor,
    realmsSpannedBy,
    type AuthoredOpening,
    type ManualBand,
    type OpeningPenalty
};

// ─────────────────────────────────────────────────────────────────────────
// WHAT A MANUAL IS: A SEQUENCE OF STAGES
//
// The correction that reshaped this module, and it simplified more than it
// complicated. A manual is not a fixed object with a ceiling attached. It is a
// numbered sequence of stages, and the cap is simply HOW FAR IT HAS BEEN
// WRITTEN. A manual stops at stage twelve because nobody has written stage
// thirteen. Somebody with the understanding writes thirteen, and the manual now
// goes one rung further. Then fourteen. Then fifteen.
//
// Three consequences, and none of them is a new subsystem:
//
//   EXTENDING IS SOMETHING A CULTIVATOR DOES, not a property a catalog author
//   sets on certain rows. Any manual can in principle gain a stage; what varies
//   is whether anybody alive could manage it, which is what the new-ground
//   curve measures. `derivable` as an opt-in allowlist was the wrong model and
//   is no longer read - see {@link canExtend}.
//
//   ONE STAGE IS ONE RUNG. The one-rung rule was arrived at before the model
//   that explains it, and this is the explanation.
//
//   A MANUAL GAINS A STAGE THREE WAYS, interchangeable in effect and utterly
//   different in cost: find the volume somebody already wrote, be taught it, or
//   write it yourself. That is one mechanism with three doors rather than two
//   parallel systems, and `effectiveCapOf` was already most of it.
//
// ── Volumes and stages are the same idea at different grain ──────────────
//
// Stated carefully, because the tidy version is false. A volume is a PHYSICAL
// container and a stage is a UNIT OF METHOD, and they do not divide evenly:
// the one scattered work in the catalog is 3 volumes across 4 rungs. So this
// module does not renumber the catalog or pretend a volume is a stage. What is
// shared is the reasoning - both are "somebody already wrote this part, and
// without it the book stops earlier" - and both therefore run through
// `shardPower` rather than through two different pieces of arithmetic.
//
// ── A written stage is transmissible ─────────────────────────────────────
//
// "It can be passed on from master to student personally (or even written
// down)." So a derivation is not a private trick. It is how a manual actually
// grows, and how a house's library gets deeper over generations - which is the
// same fact dormant arts and deep-foundation sects state from the other end: a
// house holds stages somebody wrote long ago that nobody living has reached.
//
// Mechanically this needs nothing new. A stage somebody wrote is a stage like
// any other, so `canTransmit` in `../encounters/acquisition.ts` already carries
// it from master to student, and its "you cannot be shown further than the
// teacher went" rule is exactly right for it.
// ─────────────────────────────────────────────────────────────────────────

/**
 * One stage of a manual: the unit a manual grows by, and one rung of ceiling.
 *
 * This is what a derivation PRODUCES. It is not a technique row and must not be
 * persisted as one - see the note on {@link writeNextStage} for what the
 * storage layer actually needs.
 */
export interface Stage {
    /** The manual this is a stage OF. Stages do not exist on their own. */
    manualId: string;
    /**
     * 1-based. Stage n carries a reader from `requiredOrdinal + n - 1` to
     * `requiredOrdinal + n`, so the manual's cap is its highest written stage.
     */
    number: number;
    /**
     * Who wrote it, or null for the stages the manual has always had.
     *
     * The field that makes a library a history. A house holding stage 14 of
     * something, written four hundred years ago by somebody whose name is on
     * it, is a fact this column produces rather than one anybody authored.
     */
    authorId: string | null;
    /** Day it was written. Null for the stages the manual was found with. */
    writtenOnDay: number | null;
    /**
     * How much of it failed to survive being written down, 0..1.
     *
     * High for a newly written stage on purpose: one person's working notes are
     * not a house's polished canon. This is what makes a derived stage harder
     * for the NEXT reader than the stages before it, and it is the honest cost
     * of a library that grew by accretion.
     */
    opacity: number;
}

/**
 * How many stages this manual has been written to.
 *
 * Derived, not authored: the cap IS the count of written stages, so there is no
 * new field and nothing for a catalog author to keep in sync.
 */
export function stagesWrittenOf(manual: Pick<CappedManual, 'requiredOrdinal' | 'cap'>): number {
    const from = clampOrdinal(manual.requiredOrdinal);
    const to = manual.cap === null ? MAX_ORDINAL : clampOrdinal(manual.cap);
    return Math.max(0, to - from);
}

/**
 * How many parts of an ordered work are held from the beginning, unbroken.
 *
 * The contiguity rule, and it is the whole reason stages are numbered: nobody
 * practises stage fifteen without fourteen. Holding the first and third volumes
 * of a canon is holding the first volume, plus a book you cannot read yet.
 */
export function contiguousRun(ordered: readonly string[], held: ReadonlySet<string>): number {
    let run = 0;
    for (const part of ordered) {
        if (!held.has(part)) break;
        run++;
    }
    return run;
}

// ─────────────────────────────────────────────────────────────────────────
// E1. THE SCATTERED SET
//
// Route 1b. A canon that exists only as separated volumes in three different
// hands is, to whoever holds one volume, a manual capped one rung lower than
// the complete work. Collect a volume, the ceiling rises by one. Collect the
// set and you hold the book.
//
// There is deliberately no second cap field anywhere - a partial set's ceiling
// is DERIVED, here, from how many volumes are held, using `shardPower`.
// ─────────────────────────────────────────────────────────────────────────

export interface EffectiveCap {
    /** What to feed `CultivationOptions.techniqueCap`. Null means uncapped. */
    cap: number | null;
    /** The complete work's own ceiling, for comparison. */
    wholeCap: number | null;
    /**
     * How far the manual has been written BY ANYBODY, catalog plus every stage
     * added since. The world fact, as against `cap`, which is this holder's.
     *
     * These two used to be the same number and silently stopped being one the
     * first time a stage was written. See {@link writtenTo}.
     */
    writtenTo: number | null;
    /** Stages beyond the catalog's that this holder actually stands on. */
    stagesHeld: number;
    volumesHeld: number;
    volumesTotal: number;
    /** Volume ids the holder is missing. Empty for a complete or single work. */
    missing: string[];
    /** Rungs the missing volumes cost. Zero for a complete or single work. */
    rungsLost: number;
    /** Engine-authored and factual. Says what the holder actually has. */
    line: string;
}

/**
 * The ceiling of what somebody is actually holding.
 *
 * A single-volume work, or a complete set, returns the manual's own cap. Each
 * missing volume drops it by one rung, through {@link shardPower}, so there is
 * one piece of that arithmetic in this repo and not two.
 *
 * An UNCAPPED work that is scattered is the interesting case and it is
 * deliberately not a special case: the notional whole is the top of the ladder,
 * and each missing volume comes off that. Three quarters of the top prize in
 * the setting is a very good book with a ceiling, which is the outcome route 1b
 * is for - and the bitter version of it, where the complete work turns out to
 * be unsuited and you now own three quarters of something you cannot read, is
 * `assessFit`'s to say and not this function's.
 */
/**
 * How far this manual has been written BY ANYBODY.
 *
 * ── THE FACT THAT STOPPED BEING FREE ─────────────────────────────────────
 *
 * `stagesWrittenOf(manual)` is `cap - requiredOrdinal`, and that is exact for a
 * catalog row precisely BECAUSE no stage has been written yet. The moment one
 * is, the catalog's cap and the manual's real ceiling disagree - and the
 * catalog is the only thing the rate layer can currently reach, so a manual
 * that just gained a stage would go on reporting the ceiling it had before.
 *
 * That is the stage model's version of a defect the row model had in a worse
 * form: a runtime-written art was not in the compiled catalog at all, so
 * `getTechnique` missed it, `techniqueCap` fell to `NO_MANUAL_CEILING` and a
 * cultivator who wrote their own continuation was bricked by it. Measured by
 * the verb layer as `PROGRESS 0 -> 0`. A manual that GAINS A STAGE stays
 * catalogued, which is most of why this model is the right one - but "stays
 * catalogued" is not "the catalog knows how far it now goes", and this is the
 * seam.
 *
 * So the ceiling is composed rather than read: the catalog's own written
 * stages, plus every stage recorded against the manual since. Whatever
 * resolves `techniqueCap` must call this, not `manual.cap`.
 */
export function writtenTo(
    manual: Pick<CappedManual, 'cap'>,
    stagesWrittenSince = 0
): number | null {
    if (manual.cap === null) return null;
    const added = Math.max(0, Math.floor(stagesWrittenSince));
    const to = clampOrdinal(manual.cap) + added;
    return to > MAX_ORDINAL ? null : to;
}

export function effectiveCapOf(
    manual: Pick<CappedManual, 'id' | 'name' | 'cap' | 'volumes'>,
    heldVolumeIds: readonly string[] = [],
    /**
     * Stages written beyond the catalog's that THIS holder stands on.
     *
     * Contiguity applies here exactly as it does to volumes: a stage past the
     * end of the book is worth nothing to somebody who has not got to the end
     * of the book, so this is ignored for a holder missing any part of the
     * work. Ignoring it is the honest answer rather than a simplification -
     * nobody practises stage 14 while stuck at stage 2.
     */
    stagesHeldSince = 0
): EffectiveCap {
    const title = manual.name ?? manual.id;
    const volumes = manual.volumes ?? null;
    const wholeCap = manual.cap === null ? null : clampOrdinal(manual.cap);
    const added = Math.max(0, Math.floor(stagesHeldSince));
    const reached = writtenTo(manual, added);

    if (volumes === null || volumes.length === 0) {
        return {
            cap: reached,
            wholeCap,
            writtenTo: reached,
            stagesHeld: added,
            volumesHeld: 0,
            volumesTotal: 0,
            missing: [],
            rungsLost: 0,
            line: `${title} is one work and it is whole. ` +
                (reached === null
                    ? 'Nothing in it stops.'
                    : added > 0
                        ? `It was written as far as ${rankName(wholeCap ?? 0)}, and ` +
                          `${added} further ${added === 1 ? 'stage has' : 'stages have'} been ` +
                          `written since: it ends at ${rankName(reached)}.`
                        : `It ends at ${rankName(reached)}.`)
        };
    }

    const held = new Set(heldVolumeIds);
    const missing = volumes.filter(v => !held.has(v));
    const volumesHeld = volumes.length - missing.length;
    // CONTIGUITY. A work in parts is read in order, so what a holder can
    // actually practise is the unbroken run from the beginning. Holding the
    // first and third volumes is holding the first volume and owning a book
    // they cannot read yet, which is a different and more interesting position
    // than "one volume short".
    const run = contiguousRun(volumes, held);
    const unusable = volumes.length - run;

    if (missing.length === 0) {
        // The complete work IS the whole book, so stages written since count.
        return {
            cap: reached,
            wholeCap,
            writtenTo: reached,
            stagesHeld: added,
            volumesHeld,
            volumesTotal: volumes.length,
            missing: [],
            rungsLost: 0,
            line: `${title} is complete in ${volumes.length} volumes and all ${volumes.length} ` +
                `are in hand. ` +
                (reached === null
                    ? 'Nothing in it stops.'
                    : added > 0
                        ? `The work ended at ${rankName(wholeCap ?? 0)} and ${added} further ` +
                          `${added === 1 ? 'stage has' : 'stages have'} been written since: ` +
                          `it now carries to ${rankName(reached)}.`
                        : `It ends at ${rankName(reached)}, which is where the work ends.`)
        };
    }

    // The notional whole. An uncapped work is measured from the top of the
    // ladder, because a piece of a thing that never stops still stops.
    //
    // Stepped down once per part BEYOND THE UNBROKEN RUN rather than once per
    // missing part, which is the contiguity rule above expressed in the one
    // piece of "a piece is worth less than the whole" arithmetic this repo has.
    let cursor: number | null = wholeCap === null ? MAX_ORDINAL + 1 : wholeCap;
    for (let i = 0; i < unusable; i++) {
        cursor = shardPower(cursor);
    }
    const dropped = cursor === null ? null : Math.max(0, cursor);
    const cap = dropped === null || dropped > MAX_ORDINAL ? null : dropped;
    const notional = wholeCap === null ? MAX_ORDINAL + 1 : wholeCap;
    const rungsLost = Math.max(0, notional - (dropped ?? notional));

    return {
        cap,
        wholeCap,
        // The world may have written further; this holder cannot stand on it
        // while any part of the book itself is missing. Reported anyway, so a
        // caller can say "it goes further than you can follow it".
        writtenTo: reached,
        stagesHeld: 0,
        volumesHeld,
        volumesTotal: volumes.length,
        missing: [...missing],
        rungsLost,
        line: volumesHeld === 0
            ? `${title} exists in ${volumes.length} volumes and none of them are in hand. ` +
              'There is nothing here to practise.'
            : `${title} is ${volumes.length} volumes and ${volumesHeld} of them are in hand` +
              `${run < volumesHeld
                  ? `, but only the first ${run} run unbroken - the rest cannot be read past ` +
                    'the gap, and a later volume is worth nothing without the one before it'
                  : ''}. ` +
              `What is missing costs ${rungsLost} ${rungsLost === 1 ? 'rung' : 'rungs'} of ceiling: ` +
              (cap === null
                  ? 'and it still does not stop.'
                  : `it ends at ${rankName(cap)} instead of ` +
                    `${wholeCap === null ? 'nowhere' : rankName(wholeCap)}. ` +
                    'Finding another volume raises it.')
    };
}

// ─────────────────────────────────────────────────────────────────────────
// E2b. THE STANDING A MANUAL ASKS BEFORE IT CAN BE TAKEN UP
//
// The corridor is meant to be leapfroggable by finding an exceptional book,
// and the cost of that is deliberately NOT a rank requirement - gating a
// wide-span manual behind a high `requiredOrdinal` is exactly what makes it
// unable to skip anything.
//
// So it is gated on comprehension instead, which is the axis money cannot buy:
// understanding comes from what happened to you out in the world. Somebody
// handed a two-realm canon at ordinal 5 cannot coast on it, because they have
// not lived enough to begin it. That is the same property that makes derivation
// the one door money cannot open, and the two share this machinery rather than
// each inventing a check.
//
// It composes with suitability rather than competing with it. Fit asks "is this
// written for me". Standing asks "am I far enough along to read it". Two
// independent axes, and both carry their reason.
// ─────────────────────────────────────────────────────────────────────────

const STANDING_ORDER: Record<DaoStanding, number> = { none: 0, leaning: 1, dao: 2 };

/** The higher of two standings. */
function deeper(a: DaoStanding, b: DaoStanding): DaoStanding {
    return STANDING_ORDER[a] >= STANDING_ORDER[b] ? a : b;
}

/**
 * Standing a manual's REACH demands, independent of its grade.
 *
 * One realm asks nothing - that is every book in the world and the ordinary
 * case. Two asks for a leaning. Three or more asks for a full Dao, which is the
 * same bar `chaos` grade sets and the same bar derivation sets.
 */
export function spanStanding(realmsSpanned: number): DaoStanding {
    if (realmsSpanned <= ORDINARY_REALM_SPAN) return 'none';
    if (realmsSpanned === ORDINARY_REALM_SPAN + 1) return 'leaning';
    return 'dao';
}

export interface ManualRequirement {
    standing: DaoStanding;
    /** Which of the two asks set the bar. `none` when neither asks anything. */
    from: 'none' | 'grade' | 'span' | 'both';
    realmsSpanned: number;
    gradeStanding: DaoStanding;
    spanStanding: DaoStanding;
    /**
     * True when the manual states its own comprehension gate, so the span
     * curve stood down in favour of it. See {@link GatedManual.domain}.
     */
    spanDeferredToCatalog: boolean;
}

/**
 * What this manual asks of a reader before they may begin it at all.
 *
 * The deeper of two independent asks. `GRADE_REQUIREMENT` is why top-grade
 * manuals sit in ruins unread; the span requirement is why an exceptional one
 * cannot simply be handed to a novice as a shortcut.
 *
 * THE CATALOG WINS. A wide manual that authors its own `domain`/`domainDegree`
 * has already said how much understanding it asks for, in the field `assessFit`
 * enforces. The span curve is the DEFAULT for a wide manual that says nothing -
 * so a book authored wide and ungated is not a free shortcut, and a book
 * authored wide and gated is gated exactly once, in the place its author chose.
 */
export function manualDaoRequirement(manual: GatedManual): ManualRequirement {
    const realmsSpanned = realmsSpannedBy(manual);
    const gradeStanding = GRADE_REQUIREMENT[manual.grade] ?? 'none';
    const spanDeferredToCatalog = Boolean(manual.domain);
    const spanning = spanDeferredToCatalog ? 'none' : spanStanding(realmsSpanned);
    const standing = deeper(gradeStanding, spanning);
    const gradeAsks = STANDING_ORDER[gradeStanding] === STANDING_ORDER[standing] && standing !== 'none';
    const spanAsks = STANDING_ORDER[spanning] === STANDING_ORDER[standing] && standing !== 'none';
    return {
        standing,
        from: standing === 'none' ? 'none' : gradeAsks && spanAsks ? 'both' : gradeAsks ? 'grade' : 'span',
        realmsSpanned,
        gradeStanding,
        spanStanding: spanning,
        spanDeferredToCatalog
    };
}

export interface ManualGateResult {
    /** Whether the manual may be taken up at all. */
    permitted: boolean;
    /**
     * Machine-readable reason when refused; null when permitted.
     *
     * `daoGate`'s own vocabulary, extended rather than duplicated, so the two
     * refusals read alike: `no_matching_dao` when the road is not deep enough,
     * `wrong_dao` when it is deep and it is a different road.
     */
    reason: 'no_matching_dao' | 'wrong_dao' | null;
    requirement: ManualRequirement;
    heldStanding: DaoStanding;
    /** Factual account of the refusal, for the narrator to render verbatim. */
    detail: string;
}

/**
 * Whether this cultivator's road permits them to BEGIN this manual.
 *
 * `daoGate`'s shape, applied to learning rather than to breaking through, and
 * reading the same `daoMatches`. Refusal is a statement about the reader and
 * not about the book: the pages are legible, the qi is there, and the reader
 * has not been anywhere that would let the meaning arrive.
 */
export function manualGate(dao: DaoAssessment, manual: GatedManual): ManualGateResult {
    const requirement = manualDaoRequirement(manual);
    const title = manual.name ?? manual.id;

    if (requirement.standing === 'none') {
        return {
            permitted: true,
            reason: null,
            requirement,
            heldStanding: dao.standing,
            detail: `${title} asks nothing of the reader beyond the qi to hold it.`
        };
    }

    if (STANDING_ORDER[dao.standing] < STANDING_ORDER[requirement.standing]) {
        return {
            permitted: false,
            reason: 'no_matching_dao',
            requirement,
            heldStanding: dao.standing,
            detail:
                `${title} ${reachClause(requirement)} and the pages are perfectly legible. ` +
                `${dao.standing === 'none'
                    ? 'This cultivator has not begun a road'
                    : 'This cultivator has begun a road and is not yet far enough along it'}` +
                ', so the meaning does not arrive. Nothing about sitting with it changes that; ' +
                'what it asks for is comprehension, and comprehension comes from what happens ' +
                'to a person rather than from the years.'
        };
    }

    if (!daoMatches(dao, manual)) {
        return {
            permitted: false,
            reason: 'wrong_dao',
            requirement,
            heldStanding: dao.standing,
            detail:
                `${dao.name ?? `a leaning toward ${dao.subject}`} is a road, and it is not ` +
                `${title}'s. The art is written in a language this cultivator has spent ` +
                'their life not learning.'
        };
    }

    return {
        permitted: true,
        reason: null,
        requirement,
        heldStanding: dao.standing,
        detail: `${dao.name ?? `a leaning toward ${dao.subject}`} opens ${title}` +
            `${requirement.from === 'span' || requirement.from === 'both'
                ? `, which ${reachClause(requirement)}`
                : ''}.`
    };
}

function reachClause(requirement: ManualRequirement): string {
    return requirement.realmsSpanned > ORDINARY_REALM_SPAN
        ? `carries a reader across ${requirement.realmsSpanned} realms where an ordinary ` +
          'manual carries them across one'
        : 'is written for somebody who has walked a road';
}

// ─────────────────────────────────────────────────────────────────────────
// E2. WHETHER THE CONTINUATION CAN BE WRITTEN
//
// Route 7, the prodigy's road, and the only route whose output is
// definitionally suited to the person who took it - because they derived it
// from their own road rather than finding it on somebody else's.
//
// `daoGate` refuses a reader who cannot follow the pages. Turn that around:
// somebody who stands at `dao` in the subject a manual is about does not need
// the pages. A LEANING is enough to read an immortal-grade art and is not
// enough to extend one, and that distinction is the whole gate.
// ─────────────────────────────────────────────────────────────────────────

/** What a derivation attempt is refused for, when it is. */
export type DerivationRefusal =
    /** This particular book cannot be extended, for a stated reason. */
    | 'not_extendable'
    /** No road at all, or one too shallow to build on. `daoGate`'s word. */
    | 'no_matching_dao'
    /** A road deep enough to READ this and not to EXTEND it. */
    | 'leaning_only'
    /** A road, and a different one. `daoGate`'s word. */
    | 'wrong_dao'
    /** It ends where the ladder ends. There is no continuation to write. */
    | 'nothing_above'
    /**
     * Nobody has ever written anything at this height, so there is nothing to
     * compose against.
     *
     * The far end of the new-ground curve, and a refusal rather than a very
     * large price - which is what stops derivation being a general escape from
     * the corridor. Above the last taught book the world holds almost nothing,
     * and a road with no precedent at all is not a hard derivation, it is the
     * crossing, and the crossing is not a book.
     */
    | 'no_precedent';

export interface DerivationCheck {
    permitted: boolean;
    reason: DerivationRefusal | null;
    /** Always `dao`. Derivation is the one bar nothing lowers. */
    requiredStanding: DaoStanding;
    heldStanding: DaoStanding;
    detail: string;
}

/** The standing derivation demands. A leaning reads; only a Dao writes. */
export const DERIVATION_STANDING: DaoStanding = 'dao';

/**
 * Whether this cultivator's road permits them to write this manual's
 * continuation rather than find it.
 *
 * Shaped exactly like `daoGate` and reusing `daoMatches`, so the two refusals
 * read alike and a caller that already renders one renders the other.
 */
export function canExtend(
    dao: DaoAssessment,
    manual: ExtendableManual,
    precedent?: Precedent
): DerivationCheck {
    const title = manual.name ?? manual.id;
    const base = { requiredStanding: DERIVATION_STANDING, heldStanding: dao.standing };

    // Opt-OUT, not opt-in. Any manual can in principle gain a stage; a few
    // carry a stated reason they cannot, and those are the interesting ones -
    // a book written for a condition no reader is in, or one whose only test is
    // a crossing nobody gets to attempt twice.
    const blocked = manual.notExtendableReason ?? manual.notDerivableReason ?? null;
    if (blocked) {
        return { ...base, permitted: false, reason: 'not_extendable', detail: blocked };
    }

    if (manual.cap === null || manual.cap > MAX_ORDINAL) {
        return {
            ...base,
            permitted: false,
            reason: 'nothing_above',
            detail: `${title} does not stop, so there is no continuation to write. ` +
                'Whatever is above it is not a book.'
        };
    }

    // New ground, at its far end. Checked after `nothing_above` so a manual
    // that stops at the top of the ladder is refused for the reason that
    // actually applies to it, and before the road questions so that a
    // cultivator is never told their Dao is wrong for a book nobody could
    // write from where they stand.
    if (precedent !== undefined && precedent.artsAtOrAbove <= 0) {
        return {
            ...base,
            permitted: false,
            reason: 'no_precedent',
            detail:
                `Nothing anybody has ever written stands at or above ${rankName(
                    Math.min(MAX_ORDINAL, (manual.cap as number) + 1)
                )}. ` +
                'Deriving is composing against what has been done, and at this height ' +
                'there is nothing to compose against - not a library that is closed, ' +
                'not a book somebody will not part with. Nobody has been here. What ' +
                'comes next is not a thing that can be written down in advance.'
        };
    }

    if (dao.standing === 'none') {
        return {
            ...base,
            permitted: false,
            reason: 'no_matching_dao',
            detail:
                'Writing the continuation of a method is not reading it faster. This ' +
                'cultivator has not begun a road, and there is nothing to extend it from.'
        };
    }

    if (dao.standing === 'leaning') {
        return {
            ...base,
            permitted: false,
            reason: 'leaning_only',
            detail:
                `A leaning toward ${dao.subject} is enough to READ an art of this kind and ` +
                'it is not enough to extend one. The difference is not effort and it is not ' +
                'rank: a leaning follows a road somebody else laid, and only somebody who ' +
                'has made the road their own can say where it goes next.'
        };
    }

    if (!daoMatches(dao, manual)) {
        return {
            ...base,
            permitted: false,
            reason: 'wrong_dao',
            detail:
                `${dao.name ?? `a leaning toward ${dao.subject}`} is a road, and it is not ` +
                `${title}'s. No amount of standing on one road produces the other, and no ` +
                'depth on this one ever will.'
        };
    }

    return {
        ...base,
        permitted: true,
        reason: null,
        detail:
            `${dao.name ?? `a leaning toward ${dao.subject}`} is ${title}'s own road, walked ` +
            'far enough that the pages are no longer where the method lives. What comes ' +
            'after it can be written rather than found.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// E3. WRITING IT
//
// The one genuinely new mechanism in `past-the-ceiling.md`, and the one most likely to
// break the founding rule if it is built carelessly.
//
// THE ENGINE PRODUCES THE ROW. The narrator may never assert a manual into
// existence, may never name one, and may never decide what it teaches. This is
// a pure function of `(runSeed, cultivatorId, sourceManualId, dao)` and it
// returns a record the storage layer persists verbatim, exactly the way
// `simulateTimeSkip` returns insights the caller writes.
//
// SUITED BY CONSTRUCTION. The element and the road of the result are taken from
// the deriver's own road, because they wrote it out of their own understanding.
// That is why derivation legitimately bypasses the 0.2 `SUITABILITY_BASE` draw
// every found manual is subject to - and it is precisely what makes this the
// one door money cannot open. A found book might be for somebody else; a
// written one cannot be.
//
// AND IT MUST NOT BECOME A HOLE-CLOSER. The same discipline
// `NO_SURVIVING_COPY_TECHNIQUE_IDS` is held to applies: the `derivable` set in
// the catalog is opt-in and deliberately tiny. Derivation is the prodigy's
// road, not the way missing content gets papered over. If that set ever grows
// to cover the choke points, the corridor has been abolished rather than
// opened.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Years of work a derived rung costs.
 *
 * Charged per rung of new ceiling, and readable BEFORE the work is committed -
 * "never hide the cap" cuts both ways, and a price a player can only discover
 * by paying it is the same failure as a ceiling they can only discover by
 * hitting it. Deliberately not drawn from the stream for that reason.
 */
export const DERIVATION_YEARS_PER_RUNG = 12;

// ─────────────────────────────────────────────────────────────────────────
// NEW GROUND
//
// "Obviously it gets harder as you go up cuz you're on new ground."
//
// Derivation as first built was equally available at every height, which would
// have made it a general way out of the corridor rather than a desperate one.
// It is not equally available, and the reason is not a difficulty dial: the
// higher the rung, the fewer people have ever been there, the less exists to
// compose against, and near the top a deriver is genuinely writing something
// nobody has written.
//
// So the difficulty is DERIVED from how much the world holds at or above the
// target rung, rather than chosen. That makes "new ground" literal and
// measurable, and it moves on its own as the catalog changes - a house that
// loses its library makes derivation above it harder for everybody, with
// nothing anywhere needing to be retuned.
//
// It reads the same thinning the corridor already describes, arriving on the
// authorship axis: taught books run out at 37, above that everything is ruin
// or grave, and only a handful of arts exist near the Lid at all. Low down the
// road is well walked and precedent is everywhere, so somebody with real
// understanding writing the next stretch of an ordinary method is a believable
// thing. High up there is almost nothing to write from.
//
// TWO THINGS IT MUST NOT BREAK, both load-bearing:
//
//   Determinism. No new roll. The whole curve is a pure function of the target
//   rung and what the world holds, so a cultivator who tries again gets the
//   same answer - and what changes between attempts is them, never the dice.
//
//   Suited by construction. The price is years and possibility, never stones,
//   never rank, never standing in a house. The moment difficulty becomes a
//   resource cost this stops being the one door money cannot open.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the world holds at or above the rung being written for.
 *
 * Supplied by the caller, not read here: `src/engine/cultivation/**` holds no
 * dependency on `src/data/**` and this does not introduce one. Build it with
 * {@link precedentAt} from the catalog's own ordinals.
 */
export interface Precedent {
    /**
     * How many arts in the world are written for the target rung or above.
     *
     * The measure of how much there is to compose against. Zero means nobody
     * has ever written anything at this height, which is a refusal rather than
     * a penalty - see `no_precedent`.
     */
    artsAtOrAbove: number;
}

/**
 * Arts at or above the target rung, counted off the ordinals a caller holds.
 *
 * PASS CULTIVATION MANUALS, NOT EVERY ART. What a derivation composes against
 * is the body of work on the road it is extending, and the whole catalog is
 * mostly dao arts - which have no cap, are not on this ladder, and would
 * dilute the count past the point of meaning. Measured: counting everything
 * leaves 13 arts standing at ordinal 44 and the curve inert across the entire
 * ladder; counting manuals leaves 2, which is the scarcity the corridor
 * actually describes.
 *
 *   precedentAt(
 *       TECHNIQUES.filter(t => classOf(t) === 'cultivation')
 *                 .map(t => t.requiredOrdinal),
 *       targetOrdinal
 *   )
 *
 * Kept here so every caller counts the same thing the same way rather than
 * each deciding what "precedent" means.
 */
export function precedentAt(
    artOrdinals: readonly number[],
    targetOrdinal: number
): Precedent {
    return {
        artsAtOrAbove: artOrdinals.filter(o => Number.isFinite(o) && o >= targetOrdinal).length
    };
}

/**
 * Manuals at or above the target that count as a well-walked road.
 *
 * Eight, calibrated against the live catalog rather than picked. Counting the
 * 22 cultivation manuals the world holds, the number standing at or above a
 * rung runs 18 at Foundation, 9 at 29, 7 at 33, 4 at 37, 2 at 42 and 1 at the
 * summit - so eight puts the floor of the curve just below the middle of the
 * ladder and lets it bite exactly where the corridor narrows.
 *
 * The resulting price: 12 years anywhere below rung 33, 18 at 33, 36 at 37,
 * and 54 near the top. Low down that is a long project on a road with
 * precedent everywhere; high up it is most of a mortal life spent writing
 * where four books exist.
 */
export const PRECEDENT_WELL_WALKED = 8;

/**
 * How much thin ground multiplies the work, at its very thinnest.
 *
 * Four, so a derivation with one lonely precedent costs about five times what
 * one with a full shelf behind it costs. Sized against the price it scales:
 * `DERIVATION_YEARS_PER_RUNG` is 12, so the range runs from twelve years low
 * on the ladder to sixty near the top of what is writable at all - the
 * difference between a long project and most of a mortal life.
 */
export const DERIVATION_THINNESS_COST = 4;

/**
 * How much of the work is the ground being new, 0..1.
 *
 * 0 where the road is well walked, 1 where a single art stands above the
 * target. Pure, and the reason no roll is needed anywhere in this curve.
 */
export function thinnessAt(precedent: Precedent): number {
    const held = Math.max(0, precedent.artsAtOrAbove);
    if (held >= PRECEDENT_WELL_WALKED) return 0;
    return 1 - held / PRECEDENT_WELL_WALKED;
}

/** What deriving at this height costs in years. */
export function derivationYears(precedent: Precedent): number {
    return Math.round(
        DERIVATION_YEARS_PER_RUNG * (1 + DERIVATION_THINNESS_COST * thinnessAt(precedent))
    );
}

/**
 * WHAT USED TO BE HERE: `DerivedManual`, a complete technique row this module
 * invented, with its own id, name, grade, element and a `provenance: 'derived'`
 * the data layer was asked to admit.
 *
 * It was the wrong model and it is gone. A derivation is not a new book - it is
 * the next STAGE of the book already in hand, so what comes out is a
 * {@link Stage} belonging to an existing manual, and the manual's own cap moves
 * up one rung. See the note on {@link writeNextStage} for what that means for
 * storage, which is materially less than a new row per derivation.
 */

export interface DerivationRequest {
    runSeed: string;
    cultivatorId: string;
    /** The manual being extended. The stage produced belongs to it. */
    source: ExtendableManual;
    /** What the deriver turns out to have been doing. `daoOf(insights)`. */
    dao: DaoAssessment;
    /**
     * What the world holds at or above the rung being written for.
     *
     * REQUIRED, and deliberately not optional with a generous default: a
     * caller that forgot it would get the cheapest derivation in the game at
     * the exact height where it should be hardest, which is the failure this
     * whole curve exists to prevent. Build it with {@link precedentAt}.
     */
    precedent: Precedent;
    /**
     * Stages already written against this manual beyond the catalog's own.
     *
     * REQUIRED IN EFFECT even though it defaults to 0: without it a cultivator
     * extending a manual that somebody already extended would write the stage
     * that exists rather than the one after it, and the ceiling would never
     * move past the first derivation. Read it off the stages table.
     */
    stagesWrittenSince?: number;
}

export type DerivationResult =
    | {
        written: false;
        check: DerivationCheck;
        stage: null;
        /** The manual's ceiling, unchanged. */
        newCap: number | null;
        years: 0;
        line: string;
    }
    | {
        written: true;
        check: DerivationCheck;
        /** What was actually produced. A stage OF the source manual. */
        stage: Stage;
        /**
         * The source manual's ceiling once this stage is appended - one rung
         * above where it stopped. The caller raises the manual to this; it does
         * not create a second book.
         */
        newCap: number;
        years: number;
        line: string;
    };

/**
 * Write the continuation.
 *
 * Deterministic in `(runSeed, cultivatorId, source.id, dao.subject)` and
 * nothing else - not the day, not the ordinal, not how many times it was
 * attempted. A cultivator who tries again gets the same book, because the book
 * is a fact about their road and roads do not reroll.
 *
 * Returns a refusal rather than throwing, so a caller can put {@link canDerive}
 * and this behind one verb.
 */
export function writeNextStage(request: DerivationRequest): DerivationResult {
    const { runSeed, cultivatorId, source, dao } = request;
    const check = canExtend(dao, source, request.precedent);
    if (!check.permitted) {
        return {
            written: false,
            check,
            stage: null,
            newCap: source.cap,
            years: 0,
            line: check.detail
        };
    }

    // Guarded by `canExtend`'s `nothing_above` branch; narrowed for the type.
    //
    // Composed rather than read straight off the row: the manual may already
    // have been extended, in which case the next stage is the one after THAT
    // and not the one after the catalog's. See `writtenTo`.
    const already = Math.max(0, Math.floor(request.stagesWrittenSince ?? 0));
    const reached = writtenTo(source, already);
    // `canExtend` refuses a manual whose CATALOG cap runs off the ladder, and
    // cannot see the stages written since. A manual extended to the summit by
    // earlier hands hits the same wall for the same reason, and gets the same
    // refusal rather than silently writing a stage that goes nowhere.
    if (reached === null || reached >= MAX_ORDINAL) {
        const detail =
            `${source.name ?? source.id} has been written as far as anything on this ladder ` +
            'goes. Whatever is above it is not a stage and not a book.';
        return {
            written: false,
            check: { ...check, permitted: false, reason: 'nothing_above', detail },
            stage: null,
            newCap: reached,
            years: 0,
            line: detail
        };
    }
    const sourceCap = reached;
    // ONE STAGE IS ONE RUNG, which is the whole model rather than a balance
    // choice. The manual stopped at its last written stage; this is the next
    // one. Every further rung needs its own, written against thinner ground
    // than the last, so the new-ground cost is paid again each time rather
    // than once.
    const newCap = Math.min(MAX_ORDINAL, sourceCap + 1);
    const number = stagesWrittenOf(source) + already + 1;
    const subject = dao.subject ?? 'the method';
    const road = dao.name ?? daoName(subject, dao.domain ?? 'element');

    const rng = forStream(runSeed, 'derivation', cultivatorId, source.id, subject);
    // High, and high on purpose. One person's working notes are not a house's
    // polished canon, and this is what makes a stage somebody wrote harder for
    // the NEXT reader than the stages before it - the honest cost of a library
    // that grew by accretion.
    const opacity = round2(rng.float(0.35, 0.7));

    const years = derivationYears(request.precedent);
    const thinness = thinnessAt(request.precedent);
    const sourceTitle = source.name ?? source.id;

    const stage: Stage = {
        manualId: source.id,
        number,
        authorId: cultivatorId,
        writtenOnDay: null,
        opacity
    };

    return {
        written: true,
        check,
        stage,
        newCap,
        years,
        line:
            `${sourceTitle} had been written as far as stage ${number - 1}, which is why it ` +
            `stopped at ${rankName(sourceCap)}. ${road} does not stop there, and this ` +
            'cultivator has walked it far enough to write stage ' +
            `${number}: the manual now carries to ${rankName(newCap)}, and no further until ` +
            `somebody writes stage ${number + 1}. ${years} years of work` +
            `${thinness > 0
                ? `, most of it because almost nothing stands at this height to write from - ` +
                  `${request.precedent.artsAtOrAbove} ` +
                  `${request.precedent.artsAtOrAbove === 1 ? 'manual' : 'manuals'} in the ` +
                  'whole world reach it, and the next stage will be worse'
                : ', on a road well enough walked that the precedent is there to build on'}` +
            '. It is theirs by construction - nobody had to have written it for them, ' +
            'because they wrote it. And it can be taught, or copied out: a stage somebody ' +
            'wrote is a stage like any other, which is how a library gets deeper.'
    };
}

// ─────────────────────────────────────────────────────────────────────────

function clampOrdinal(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
