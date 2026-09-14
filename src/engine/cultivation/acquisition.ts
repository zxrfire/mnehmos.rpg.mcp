/**
 * What a capped cultivator does next.
 *
 * Measured off the live catalog rather than assumed: seventeen cultivation
 * manuals, and above `requiredOrdinal` 13 the widest `cap - requiredOrdinal` is
 * 4. Every manual in the world spans exactly one realm, and that is not a tuning
 * choice - `capOf` is `realmForOrdinal(requiredOrdinal).ordinalEnd + 1`, so the
 * succession of books is a fact about realm geometry.
 */

import { MAX_ORDINAL, rankName, realmForOrdinal } from './realms.js';
import {
    asksNothingOfTheRoad,
    daoName,
    GRADE_REQUIREMENT,
    roadPermits,
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
    NO_MANUAL_CEILING,
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

// THE SHAPE OF A MANUAL
//
// Structural, not imported. `src/engine/cultivation/**` holds no dependency on
// `src/data/**` and this module does not introduce one - a caller assembles
// this from whatever catalog the book came out of, exactly as `GatedTechnique`
// is assembled for `daoGate`.

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
     * The comprehension the CATALOG says this manual cannot be worked without, if
     * it says anything. Read by `assessFit` in the encounters layer, which is where
     * it is enforced.
     */
    domain?: string | null;
    domainDegree?: number;
}

/** A manual as {@link canExtend} reads it. */
export interface ExtendableManual extends GatedManual {
    /**
     * NO LONGER READ, and kept only so a caller passing a catalog row still
     * typechecks.
     */
    derivable?: boolean;
    /**
     * Why this particular manual cannot be extended, however deep the reader, or
     * null/absent for the ordinary case where it can.
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
// Volumes and stages are the same idea at different grain
//
// Stated carefully, because the tidy version is false. A volume is a PHYSICAL
// container and a stage is a UNIT OF METHOD, and they do not divide evenly:
// the one scattered work in the catalog is 3 volumes across 4 rungs. So this
// module does not renumber the catalog or pretend a volume is a stage. What is
// shared is the reasoning - both are "somebody already wrote this part, and
// without it the book stops earlier" - and both therefore run through
// `shardPower` rather than through two different pieces of arithmetic.
//
// A written stage is transmissible
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

/**
 * One stage of a manual: the unit a manual grows by, and one rung of ceiling.
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
     */
    authorId: string | null;
    /** Day it was written. Null for the stages the manual was found with. */
    writtenOnDay: number | null;
    /**
     * How much of it failed to survive being written down, 0..1.
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
 */
export function contiguousRun(ordered: readonly string[], held: ReadonlySet<string>): number {
    let run = 0;
    for (const part of ordered) {
        if (!held.has(part)) break;
        run++;
    }
    return run;
}

/**
 * The three states a manual is ever in.
 *
 * Ruled by the design owner, and the list is closed: *"just have 3 categories
 * for manuals: ruined, missing sections, complete"*.
 */
export type ManualCondition = 'complete' | 'missing sections' | 'ruined';

/**
 * Which of the three, and UNREADABLE is the only test for the third.
 *
 * The engine deliberately does not track which parts are gone in order to
 * answer this. A work is readable from the beginning or it is not, which is
 * what `contiguousRun` already computes - so a book missing its opening is
 * ruined on the same rule as a book nobody holds a page of, rather than on a
 * second rule written for it. The design owner: *"just treat a manual with a
 * missing front section as ruined ... they're all classified as ruined if it's
 * unreadable."*
 *
 * `alreadyRuined` is the copy the world has ended - a heaven-grade book read
 * out to its last use, a thing somebody smashed. It short-circuits, because a
 * complete set of volumes does not argue with a destroyed object.
 */
export function whatConditionAManualIsIn(
    ordered: readonly string[],
    held: ReadonlySet<string>,
    alreadyRuined = false
): ManualCondition {
    if (alreadyRuined) return 'ruined';
    if (ordered.length === 0) return 'complete';
    const run = contiguousRun(ordered, held);
    if (run === 0) return 'ruined';
    return run === ordered.length ? 'complete' : 'missing sections';
}

// E1. THE SCATTERED SET
//
// Route 1b. A canon that exists only as separated volumes in three different
// hands is, to whoever holds one volume, a manual capped one rung lower than
// the complete work. Collect a volume, the ceiling rises by one. Collect the
// set and you hold the book.
//
// There is deliberately no second cap field anywhere - a partial set's ceiling
// is DERIVED, here, from how many volumes are held, using `shardPower`.

export interface EffectiveCap {
    /** What to feed `CultivationOptions.techniqueCap`. Null means uncapped. */
    cap: number | null;
    /**
     * Which of the three states this holder's copy is in.
     *
     * Said on every read so no caller has to work it out, which is what stops
     * a fourth description of a book appearing somewhere.
     */
    condition: ManualCondition;
    /** The complete work's own ceiling, for comparison. */
    wholeCap: number | null;
/**
 * How far the manual has been written BY ANYBODY, catalog plus every stage since.
 *
 * A runtime-written art used to be absent from the compiled catalog, so
 * `getTechnique` missed it, `techniqueCap` fell to `NO_MANUAL_CEILING` and a
 * cultivator who wrote their own continuation was bricked - measured by the verb
 * layer as `PROGRESS 0 -> 0`. A manual that GAINS A STAGE stays catalogued, but
 * "stays catalogued" is not "the catalog knows how far it now goes".
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
 */
/**
 * How far this manual has been written BY ANYBODY.
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
            condition: 'complete',
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
            condition: 'complete',
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
    const notional = wholeCap === null ? MAX_ORDINAL + 1 : wholeCap;

    // A RUINED BOOK HAS NO CEILING, because it has no first page.
    //
    // The arithmetic above stepped a three-volume canon capped at 41 down to 38
    // for a holder with NOTHING in hand, and printed "there is nothing here to
    // practise" in the same object. The number and the sentence disagreed, and
    // the sentence was the right one. Ruined is now the single test - see
    // `whatConditionAManualIsIn` - and it answers with the same value a
    // cultivator holding no manual at all gets.
    const condition = whatConditionAManualIsIn(volumes, held);
    const cap = condition === 'ruined'
        ? NO_MANUAL_CEILING
        : dropped === null || dropped > MAX_ORDINAL ? null : dropped;
    const rungsLost = condition === 'ruined'
        ? notional
        : Math.max(0, notional - (dropped ?? notional));

    return {
        cap,
        condition,
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
        line: condition === 'ruined'
            ? (volumesHeld === 0
                ? `${title} exists in ${volumes.length} volumes and none of them are in hand. ` +
                  'There is nothing here to practise.'
                : `${title} is ${volumes.length} volumes and ${volumesHeld} of them are in hand, ` +
                  'and the one it opens with is not. A work read out of order is not a work: ' +
                  'without the beginning there is nothing here to practise.')
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

const STANDING_ORDER: Record<DaoStanding, number> = { none: 0, leaning: 1, dao: 2 };

/** The higher of two standings. */
function deeper(a: DaoStanding, b: DaoStanding): DaoStanding {
    return STANDING_ORDER[a] >= STANDING_ORDER[b] ? a : b;
}

/**
 * Standing a manual's REACH demands, independent of its grade.
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
 * True when the manual states its own comprehension gate, so the span curve
 * stands down. A manual that states its own gate has answered "how much
 * understanding does this ask for", and the span curve must not stack a second,
 * harder answer on top of it.
 */
    spanDeferredToCatalog: boolean;
}

/**
 * What this manual asks of a reader before they may begin it at all.
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
     */
    reason: 'no_matching_dao' | 'wrong_dao' | null;
    requirement: ManualRequirement;
    heldStanding: DaoStanding;
    /** Factual account of the refusal, for the narrator to render verbatim. */
    detail: string;
}

/**
 * Whether this cultivator's road permits them to BEGIN this manual.
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

    if (!roadPermits(dao, manual)) {
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
        detail: (asksNothingOfTheRoad(manual)
            ? `${title} is written on no road in particular and asks for none. It works off ` +
              'whatever qi the reader has, and this cultivator has walked far enough to hold it'
            : `${dao.name ?? `a leaning toward ${dao.subject}`} opens ${title}`) +
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
 * Whether this cultivator's road permits them to write this manual's continuation
 * rather than find it.
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

    if (!roadPermits(dao, manual)) {
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
        detail: asksNothingOfTheRoad(manual)
            ? `${title} is written on no road in particular, so there is no road of its own ` +
              `to have walked. What it teaches is how to move qi, and ${dao.name ?? `a leaning toward ${dao.subject}`} ` +
              'has been walked far enough to say where a method goes next. What comes after ' +
              'it can be written rather than found.'
            : `${dao.name ?? `a leaning toward ${dao.subject}`} is ${title}'s own road, walked ` +
              'far enough that the pages are no longer where the method lives. What comes ' +
              'after it can be written rather than found.'
    };
}

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
// AND IT MUST NOT BECOME A HOLE-CLOSER. What used to keep it from being one was
// a `derivable` allowlist in the catalog, deliberately tiny. That went when
// extending became something a CULTIVATOR does rather than a property a catalog
// author sets, and what holds the line now is the price: the curve below, keyed
// to the rung the stage is written for, and `no_precedent`, which shuts the door
// completely where nobody has ever stood. A price is the better instrument,
// because an allowlist is satisfied by a catalog with nothing at the choke
// points at all - which is how the curve went inert without anybody noticing.

// WHAT A RUNG OF NEW METHOD COSTS
//
// It was a flat twelve years at every height, and that had gone inert. Measured
// off the live catalog: `precedentAt` counts arts written for the target rung or
// above, and under the one-kind-of-art ruling that count is the whole catalog -
// 157 rows reach ordinal 13, 44 reach 33, 23 reach 45. `PRECEDENT_WELL_WALKED`
// is 8, so thinness was ZERO at every rung up to 45 and the whole curve charged
// its floor everywhere below the summit.
//
// The ruling that reshaped it: techniques get harder as you climb, and you also
// have more time. Both halves are already authored - `realmForOrdinal(n)
// .lifespanYears` runs 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 100000,
// 300000 up the ladder - so the price is worked out as a SHARE OF THE LIFE THE
// TARGET RUNG GRANTS rather than as a count of years. Twelve flat years were 12%
// of a mortal's whole life at the bottom and 0.12% of a Body Integration
// cultivator's at the top, which is the ruling exactly inverted.

/**
 * The share of a rung's granted lifespan one stage of new method costs.
 *
 * 0.12: twelve years of a mortal's hundred, which is what the flat figure was
 * and what the bottom of the ladder still pays.
 */
export const DERIVATION_LIFE_SHARE = 0.12;

/**
 * The lifespan a rung grants, as this curve prices against.
 *
 * The REALM's headline figure, never the per-rung override. A True Immortal's
 * span is not a number that means anything (see `rungLifespanYears`), and a
 * number that means nothing cannot price anything - so ordinal 46 is priced off
 * the False Immortal's 300,000 like the rung below it.
 */
function lifeAtRung(ordinal: number): number {
    return realmForOrdinal(ordinal).lifespanYears;
}

/**
 * Years the work costs before the ground is counted.
 *
 * THE GEOMETRIC MEAN OF THE TWO HONEST ANSWERS, and it is a mean because
 * neither answer alone survives the ladder. A flat price says a rung of new
 * method is the same work at every height, which is the defect above. A fixed
 * share of the rung's life says writing one stage at Tribulation Transcendence
 * is twelve thousand years of work - longer than the time-skip chunker will
 * resolve in one pass, and a price nothing in the game can spend.
 *
 * Halfway between them in log terms is `DERIVATION_LIFE_SHARE * sqrt(mortal *
 * here)`: the years grow 55-fold from the bottom of the ladder to the top while
 * the share of a life they cost falls from 12% to 0.22%. That falling share is
 * deliberate and is the second half of the ruling - above the mortal realms a
 * life stops being what is scarce, and the ground does. `no_precedent` is where
 * the ground closes the door outright, and it is a refusal rather than a price.
 */
export function derivationBaseYears(targetOrdinal: number): number {
    const mortal = DERIVATION_LIFE_SHARE * lifeAtRung(0);
    const here = DERIVATION_LIFE_SHARE * lifeAtRung(clampOrdinal(targetOrdinal));
    return Math.sqrt(mortal * here);
}

/**
 * What deriving costs at the bottom of the ladder, on well-walked ground.
 *
 * The floor of the curve, derived rather than authored: nothing above Qi
 * Condensation is ever cheaper than this.
 */
export const DERIVATION_FLOOR_YEARS = Math.round(derivationBaseYears(0));

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

/**
 * What the world holds at or above the rung being written for.
 */
export interface Precedent {
/**
 * How many arts in the world are written for the target rung or above.
 *
 * PASS WHAT IS ON THIS MANUAL'S OWN ROAD, NOT EVERY ART. The old note here said
 * "cultivation manuals, not every art", and that distinction is gone - there is
 * one kind of art now and every row carries a cap, so "every manual" IS the
 * whole catalog and the count never falls below `PRECEDENT_WELL_WALKED` until
 * the summit. Measured: 157 rows reach ordinal 13, 44 reach 33, 23 reach 45.
 *
 * The road is the cut that survived the ruling, and it is the one the word
 * actually means: deriving is composing against what has been written ON THIS
 * ROAD, and a sword form is not precedent for a pill. Measured the same way,
 * over the median road: 15 at ordinal 13, 5 at 33, 2 at 45, 1 at 46. That is
 * live at every height and it thins where the corridor says it should.
 */
    artsAtOrAbove: number;
}

/**
 * Arts at or above the target rung, counted off the ordinals a caller holds.
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
 */
export const PRECEDENT_WELL_WALKED = 8;

/**
 * How much thin ground multiplies the work, at its very thinnest.
 *
 * Was 4, and came down when the base started growing with the rung. It was 4
 * because it was carrying the whole of "harder as you climb" on its own against
 * a flat base; the rung carries that now, and what is left for this term to
 * measure is how thin the road is HERE - a house that lost its library, a road
 * nobody has written much of. At its thinnest it doubles the work. Two
 * multiplicative answers to one question is how a price at the top reached
 * three thousand years.
 */
export const DERIVATION_THINNESS_COST = 1;

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

/**
 * What deriving at this height costs in years.
 *
 * `targetOrdinal` is the rung the new stage would carry a reader TO, which is
 * also the rung whose granted lifespan the work is priced against.
 */
export function derivationYears(precedent: Precedent, targetOrdinal: number): number {
    return Math.round(
        derivationBaseYears(targetOrdinal)
        * (1 + DERIVATION_THINNESS_COST * thinnessAt(precedent))
    );
}

/**
 * What the price is as a share of the life the target rung grants.
 *
 * The number the curve is calibrated on, so anything reporting the price can
 * say what it actually costs somebody standing there rather than a bare count
 * of years that means something different at every height.
 */
export function derivationShareOfALife(precedent: Precedent, targetOrdinal: number): number {
    return derivationYears(precedent, targetOrdinal) / lifeAtRung(clampOrdinal(targetOrdinal));
}

/**
 * WHAT USED TO BE HERE: `DerivedManual`, a complete technique row this module
 * invented, with its own id, name, grade, element and a `provenance: 'derived'` the
 * data layer was asked to admit.
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
     */
    precedent: Precedent;
    /**
     * Stages already written against this manual beyond the catalog's own.
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

    const years = derivationYears(request.precedent, newCap);
    const thinness = thinnessAt(request.precedent);
    const share = derivationShareOfALife(request.precedent, newCap);
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
            `somebody writes stage ${number + 1}. ${years} years of work, which is ` +
            `${asShare(share)} of the ${lifeAtRung(newCap)} years ${rankName(newCap)} grants` +
            `${thinness > 0
                ? `. ${request.precedent.artsAtOrAbove} ` +
                  `${request.precedent.artsAtOrAbove === 1 ? 'art' : 'arts'} on this road ` +
                  'reach that height, which is what the work above the base is'
                : ', on a road well enough walked that the precedent is there to build on'}` +
            '. It is theirs by construction - nobody had to have written it for them, ' +
            'because they wrote it. And it can be taught, or copied out: a stage somebody ' +
            'wrote is a stage like any other, which is how a library gets deeper.'
    };
}


function clampOrdinal(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * A share of a life, written the way somebody would say it.
 *
 * Two significant figures rather than a rounded percentage, because the share
 * runs from 12% at the bottom of the ladder to a fifth of one percent at the
 * top and `0%` is not what a 657-year project costs.
 */
export function asShare(fraction: number): string {
    const pct = Math.max(0, fraction) * 100;
    if (pct >= 10) return `${Math.round(pct)}%`;
    if (pct >= 1) return `${pct.toFixed(1)}%`;
    return `${pct.toFixed(2)}%`;
}
