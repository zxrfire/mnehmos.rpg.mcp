/**
 * What a capped cultivator does next.
 *
 * `techniqueExhausted` in `cultivation.ts` stops a cultivator dead at their
 * manual's `cap`. Not a taper - a multiplier of zero. This module is the other
 * half of that: the arithmetic behind the doors out, specified in
 * [`docs/world/escapes.md`](../../../docs/world/escapes.md) as routes 1b and 7.
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
// back would close a runtime cycle. Re-exported below so callers of the escape
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
import { ElementSchema, type Element, type TechniqueGrade } from '../../schema/cultivation.js';
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

/** A manual as {@link canDerive} reads it. */
export interface DerivableManual extends GatedManual {
    /** Whether a sufficient dao could write the continuation. */
    derivable?: boolean;
    /** Why not, when it cannot. An absence with a reason attached. */
    notDerivableReason?: string | null;
}

// Realm geometry and the opening penalty, re-exported from `cultivation.ts` so
// that everything the escape routes need reads off one import.
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
export function effectiveCapOf(
    manual: Pick<CappedManual, 'id' | 'name' | 'cap' | 'volumes'>,
    heldVolumeIds: readonly string[] = []
): EffectiveCap {
    const title = manual.name ?? manual.id;
    const volumes = manual.volumes ?? null;
    const wholeCap = manual.cap === null ? null : clampOrdinal(manual.cap);

    if (volumes === null || volumes.length === 0) {
        return {
            cap: wholeCap,
            wholeCap,
            volumesHeld: 0,
            volumesTotal: 0,
            missing: [],
            rungsLost: 0,
            line: `${title} is one work and it is whole. ` +
                (wholeCap === null
                    ? 'Nothing in it stops.'
                    : `It ends at ${rankName(wholeCap)}.`)
        };
    }

    const held = new Set(heldVolumeIds);
    const missing = volumes.filter(v => !held.has(v));
    const volumesHeld = volumes.length - missing.length;

    if (missing.length === 0) {
        return {
            cap: wholeCap,
            wholeCap,
            volumesHeld,
            volumesTotal: volumes.length,
            missing: [],
            rungsLost: 0,
            line: `${title} is complete in ${volumes.length} volumes and all ${volumes.length} ` +
                `are in hand. ` +
                (wholeCap === null
                    ? 'Nothing in it stops.'
                    : `It ends at ${rankName(wholeCap)}, which is where the work ends.`)
        };
    }

    // The notional whole. An uncapped work is measured from the top of the
    // ladder, because a piece of a thing that never stops still stops.
    let cursor: number | null = wholeCap === null ? MAX_ORDINAL + 1 : wholeCap;
    for (let i = 0; i < missing.length; i++) {
        cursor = shardPower(cursor);
    }
    const dropped = cursor === null ? null : Math.max(0, cursor);
    const cap = dropped === null || dropped > MAX_ORDINAL ? null : dropped;
    const notional = wholeCap === null ? MAX_ORDINAL + 1 : wholeCap;
    const rungsLost = Math.max(0, notional - (dropped ?? notional));

    return {
        cap,
        wholeCap,
        volumesHeld,
        volumesTotal: volumes.length,
        missing: [...missing],
        rungsLost,
        line: volumesHeld === 0
            ? `${title} exists in ${volumes.length} volumes and none of them are in hand. ` +
              'There is nothing here to practise.'
            : `${title} is ${volumes.length} volumes and ${volumesHeld} of them are in hand. ` +
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
    /** The book itself cannot be reconstructed, for a stated reason. */
    | 'not_derivable'
    /** No road at all, or one too shallow to build on. `daoGate`'s word. */
    | 'no_matching_dao'
    /** A road deep enough to READ this and not to EXTEND it. */
    | 'leaning_only'
    /** A road, and a different one. `daoGate`'s word. */
    | 'wrong_dao'
    /** It ends where the ladder ends. There is no continuation to write. */
    | 'nothing_above';

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
export function canDerive(dao: DaoAssessment, manual: DerivableManual): DerivationCheck {
    const title = manual.name ?? manual.id;
    const base = { requiredStanding: DERIVATION_STANDING, heldStanding: dao.standing };

    if (manual.derivable === false || manual.derivable === undefined) {
        return {
            ...base,
            permitted: false,
            reason: 'not_derivable',
            detail: manual.notDerivableReason
                ?? `${title} is not a work anybody reconstructs. What is in it was ` +
                   'transmitted rather than arrived at, and there is no road that ends ' +
                   'at these pages.'
        };
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
// The one genuinely new mechanism in `escapes.md`, and the one most likely to
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

/**
 * The shape of a manual this module wrote.
 *
 * Every field `TechniqueSchema` parses, plus the ones `TechniqueEntry` carries,
 * so the storage layer can persist it as an ordinary technique row with no
 * special case anywhere. It is an ordinary book that happens to have been
 * written recently, by somebody the player knows.
 *
 * `provenance` is the one value the data layer does not have yet - see the
 * report. Typed here as the string it must become.
 */
export interface DerivedManual {
    id: string;
    name: string;
    category: 'cultivation';
    grade: TechniqueGrade;
    element: Element | null;
    requiredOrdinal: number;
    cap: number | null;
    class: 'cultivation';
    description: string;
    mastery: 0;
    qiCost: 0;
    damage: null;
    cooldown: 0;
    /** A NEW `TechniqueProvenance` value. The data layer must admit it. */
    provenance: 'derived';
    survivingCopy: true;
    sourceNote: string;
    fragmentOf: null;
    notDerivableReason: null;
    /**
     * How much of it failed to survive being written down, 0..1.
     *
     * The one thing the seeded stream decides, and a real consequence: a
     * derived manual is one person's working notes, not a house's polished
     * canon, so it is harder for anybody ELSE to read than the book it
     * continues. Drawn high on purpose.
     */
    opacity: number;
    /** Root grades it will take. Empty - it asks nothing it was not written by. */
    rootGrades: readonly string[];
    domain: null;
    domainDegree: number;
    volumes: null;
    /**
     * A derived work has no hard opening for the person who wrote it - they
     * arrived at it rather than being handed it, so there is no stretch where
     * the method is foreign to them. To anybody ELSE the same book is one
     * person's working notes, which is what `opacity` above is for.
     */
    opening: null;
    /** A derived work is derivable in turn. A road that goes on goes on. */
    derivable: true;
}

export interface DerivationRequest {
    runSeed: string;
    cultivatorId: string;
    /** The manual whose continuation is being written. */
    source: DerivableManual;
    /** What the deriver turns out to have been doing. `daoOf(insights)`. */
    dao: DaoAssessment;
}

export type DerivationResult =
    | { derived: false; check: DerivationCheck; manual: null; years: 0; line: string }
    | { derived: true; check: DerivationCheck; manual: DerivedManual; years: number; line: string };

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
export function deriveContinuation(request: DerivationRequest): DerivationResult {
    const { runSeed, cultivatorId, source, dao } = request;
    const check = canDerive(dao, source);
    if (!check.permitted) {
        return { derived: false, check, manual: null, years: 0, line: check.detail };
    }

    // Guarded by `canDerive`'s `nothing_above` branch; narrowed for the type.
    const sourceCap = source.cap as number;
    const cap = ordinaryCapFor(sourceCap);
    const subject = dao.subject ?? 'the method';
    const road = dao.name ?? daoName(subject, dao.domain ?? 'element');

    const rng = forStream(runSeed, 'derivation', cultivatorId, source.id, subject);
    // Deterministic and stable across replays - `uuid()` draws from the stream
    // rather than from `crypto`, for exactly this reason.
    const id = `derived-${source.id}-${rng.uuid().slice(0, 8)}`;
    // High, and high on purpose. One person's working notes are not a canon.
    const opacity = round2(rng.float(0.35, 0.7));

    // Suited by construction: the road the deriver walks IS the road the book
    // is written on. An element road yields an elemental method; any other road
    // yields an elementless one, which every root may practise safely.
    const parsedElement = dao.domain === 'element' ? ElementSchema.safeParse(dao.subject) : null;
    const element: Element | null = parsedElement?.success ? parsedElement.data : null;

    const rungs = cap === null ? Math.max(1, MAX_ORDINAL + 1 - sourceCap) : Math.max(1, cap - sourceCap);
    const years = rungs * DERIVATION_YEARS_PER_RUNG;

    const sourceTitle = source.name ?? source.id;
    const name = `${road}: What Follows ${sourceTitle}`;

    const manual: DerivedManual = {
        id,
        name,
        category: 'cultivation',
        // A continuation is the grade of what it continues. The engine does not
        // promote a book by writing it; what changed is the ceiling.
        grade: source.grade,
        element,
        requiredOrdinal: sourceCap,
        cap,
        class: 'cultivation',
        description:
            `Written rather than found. ${sourceTitle} ends at ${rankName(sourceCap)}, and ` +
            `${road} does not. These are the pages that come after, worked out by somebody ` +
            'who had walked far enough along that road to say where it went next rather than ' +
            'read it somewhere. They are notes and not a canon: everything in them is ' +
            'correct and a great deal of it is only legible to the person who wrote it.',
        mastery: 0,
        qiCost: 0,
        damage: null,
        cooldown: 0,
        provenance: 'derived',
        survivingCopy: true,
        sourceNote:
            'Derived. There is one copy, it is in the hand of whoever wrote it, and nobody ' +
            'else in the world knows this work exists.',
        fragmentOf: null,
        notDerivableReason: null,
        opacity,
        rootGrades: [],
        domain: null,
        domainDegree: 1,
        volumes: null,
        opening: null,
        derivable: true
    };

    return {
        derived: true,
        check,
        manual,
        years,
        line:
            `${sourceTitle} ends at ${rankName(sourceCap)}. ${road} does not, and this ` +
            `cultivator has walked it far enough to write what comes after: ` +
            `${name}, carrying to ${cap === null ? 'the top of the ladder' : rankName(cap)}. ` +
            `${years} years of work, and it is theirs by construction - nobody had to ` +
            'have written it for them, because they wrote it.'
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
