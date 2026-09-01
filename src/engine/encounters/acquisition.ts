/**
 * Getting hold of a manual, and being told in the same breath whether it was
 * for you.
 *
 * `assessFit` answers "does this fit this person" and was reachable from the
 * encounter path only. Everything else that hands somebody a book - a grave
 * prize, a corpse's inventory, a bought volume, a trial's reward, a teacher who
 * agrees to transmit it - decided fit independently or not at all. That is the
 * exact failure `escapes.md` names: a player walks out of a tomb with a
 * heaven-grade manual, nothing happens, and the lesson they learn is to sit
 * longer instead of going further.
 *
 * So this module is one funnel. Every acquisition path calls
 * {@link assessAcquisition}, which is the only place the four independent
 * reasons a manual can fail somebody are assembled in one answer:
 *
 *   reach + fit    `assessFit`. It is sound and it is not written for you.
 *   standing       `manualGate`. You have not walked far enough to begin it.
 *   the ceiling    `effectiveCapOf`. It is for you and it ENDS - and if it is
 *                  a scattered work, it ends lower than the whole does.
 *   the opening    `openingPenalty`. You can begin it and the start is uphill.
 *
 * Each carries its own reason, and {@link AcquisitionReport.lines} puts them in
 * one list so a caller can say all of them out loud at once. A refusal a player
 * cannot attribute reads as an arbitrary system.
 *
 * ── THE MISS IS THE POINT ────────────────────────────────────────────────
 *
 * Most of what anybody finds will not suit them, and this module must never
 * soften that. It does not rank, it does not suggest, and it never generates a
 * find to suit the seeker - the caller supplies what is actually in the room
 * and the verdict falls where it falls. `Suitability.line` already says that a
 * thing is sound and is not for you; nothing here rewrites it.
 *
 * ── WHAT THIS MODULE DOES NOT DO ─────────────────────────────────────────
 *
 * It does not persist, price, or move anything. Whether the corpse is looted,
 * the volume is bought or the teacher is paid is the verb layer's. This answers
 * only what the thing is worth to the person in front of it.
 */

import {
    assessFit,
    type Find,
    type Seeker,
    type Suitability
} from './suitability.js';
import {
    canDerive,
    effectiveCapOf,
    manualGate,
    openingPenalty,
    type DerivableManual,
    type DerivationCheck,
    type EffectiveCap,
    type GatedManual,
    type ManualGateResult,
    type OpeningPenalty
} from '../cultivation/escapes.js';
import { rankName } from '../cultivation/realms.js';
import { guidanceMultiplier } from '../cultivation/cultivation.js';
import type { DaoAssessment } from '../cultivation/dao.js';

// ─────────────────────────────────────────────────────────────────────────
// E6. ONE BUILDER, SO THE ACQUISITION PATHS CANNOT DISAGREE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The catalog columns a manual puts in front of a reader.
 *
 * Structural rather than `TechniqueEntry`, on purpose: a manual somebody
 * DERIVED is not a catalog row and must be assessable by exactly the same
 * machinery as one that is. A `TechniqueEntry` and a `DerivedManual` both
 * satisfy this.
 */
export interface ManualLike {
    id: string;
    name: string;
    requiredOrdinal: number;
    cap: number | null;
    grade: 'mortal' | 'earth' | 'heaven' | 'immortal' | 'chaos';
    element?: string | null;
    subject?: string | null;
    category?: string | null;
    rootGrades?: readonly string[];
    domain?: string | null;
    domainDegree?: number;
    volumes?: readonly string[] | null;
    opening?: { rungs: number; rateMultiplier: number } | null;
    derivable?: boolean;
    notDerivableReason?: string | null;
}

/**
 * The one `Find` builder.
 *
 * Three acquisition paths existed and each assembled its own `Find`, which is
 * how a corpse's manual and a shelf's manual could come to demand different
 * things of the same reader. There is one function now, and it reads the
 * catalog's `rootGrades` and `domain` - the fields that were authored precisely
 * so the root and comprehension axes fire, instead of every miss reading as an
 * element miss.
 *
 * `gradeOrdinal` is `requiredOrdinal`: what a manual is worth, to somebody, is
 * the rung it was written for.
 */
export function findFromManual(manual: ManualLike): Find {
    return {
        id: manual.id,
        name: manual.name,
        kind: 'manual',
        gradeOrdinal: manual.requiredOrdinal,
        elements: manual.element ? [manual.element] : [],
        domain: manual.domain ?? null,
        domainDegree: manual.domainDegree ?? 1,
        rootGrades: manual.rootGrades ?? []
    };
}

// ─────────────────────────────────────────────────────────────────────────
// E4. FIT ON EVERY ACQUISITION, NOT ONLY ON AN ENCOUNTER FIND
// ─────────────────────────────────────────────────────────────────────────

/** Where a manual is coming from. Colour for the report, never a rule. */
export type AcquisitionRoute =
    | 'taught'        // route 5 - a house's shelf
    | 'transmitted'   // a living teacher, route 4 and 5's human half
    | 'found'         // route 1 - an encounter, a carving, a parting gift
    | 'volume'        // route 1b - one part of a scattered work
    | 'trial'         // route 2 - an inheritance prize
    | 'corpse'        // route 3 - what somebody was practising
    | 'grave'         // route 3 - what somebody was buried with
    | 'taken'         // route 8 - siphoned, or spoils
    | 'derived';      // route 7 - written rather than found

export interface AcquisitionInput {
    manual: ManualLike;
    seeker: Seeker;
    route: AcquisitionRoute;
    /** Where the seeker is standing. Defaults to `seeker.ordinal`. */
    realmOrdinal?: number;
    /** Volume ids of this work already in hand. Route 1b. */
    heldVolumeIds?: readonly string[];
    /**
     * What the seeker turns out to have been doing. `daoOf(insights)`.
     * Omitted means the standing gate is not evaluated and says so, rather
     * than silently passing.
     */
    dao?: DaoAssessment | null;
}

export interface AcquisitionReport {
    /** Whether this manual can raise this cultivator's ceiling at all. */
    usable: boolean;
    /**
     * The single most important thing to say first, chosen by which gate bit.
     * Never composed by a narrator; always one of the engine's own lines.
     */
    headline: string;
    /** Everything that bit, in order, each already a complete sentence. */
    lines: string[];
    /** Machine-readable, so a caller can branch without parsing prose. */
    refusals: AcquisitionRefusal[];
    route: AcquisitionRoute;
    suitability: Suitability;
    /** Null when no dao was supplied. Not a pass - an unevaluated gate. */
    standing: ManualGateResult | null;
    ceiling: EffectiveCap;
    opening: OpeningPenalty;
    /**
     * What to feed `CultivationOptions.techniqueCap` if this is taken up.
     * Already accounts for a partial volume set.
     */
    techniqueCap: number | null;
    /** Whether the ceiling is above where they already stand. */
    raisesTheCeiling: boolean;
}

export type AcquisitionRefusal =
    | 'unsuited'
    | 'out_of_reach'
    | 'outgrown'
    | 'partly_suited'
    | 'no_matching_dao'
    | 'wrong_dao'
    | 'already_past_its_cap'
    | 'no_volumes_in_hand'
    | 'standing_not_assessed';

/**
 * Everything that stands between this cultivator and this manual, at once.
 *
 * The load-bearing property is that a caller gets ALL of it in one response
 * rather than discovering the second reason after acting on the first. A player
 * must never acquire something and find out later.
 */
export function assessAcquisition(input: AcquisitionInput): AcquisitionReport {
    const { manual, seeker, route } = input;
    const ordinal = input.realmOrdinal ?? seeker.ordinal;

    const suitability = assessFit(findFromManual(manual), seeker);
    const ceiling = effectiveCapOf(manual, input.heldVolumeIds ?? []);
    const opening = openingPenalty(
        { requiredOrdinal: manual.requiredOrdinal, cap: manual.cap, opening: manual.opening ?? null },
        ordinal
    );

    const gated: GatedManual = {
        id: manual.id,
        name: manual.name,
        requiredOrdinal: manual.requiredOrdinal,
        cap: manual.cap,
        volumes: manual.volumes ?? null,
        grade: manual.grade,
        element: manual.element ?? null,
        subject: manual.subject ?? null,
        category: manual.category ?? null,
        // Passed through so the span curve stands down where the catalog has
        // stated its own comprehension gate - the `comprehension` axis of
        // `assessFit` above is then the ONE place that ask is enforced.
        domain: manual.domain ?? null,
        domainDegree: manual.domainDegree
    };
    const standing = input.dao ? manualGate(input.dao, gated) : null;

    const refusals: AcquisitionRefusal[] = [];
    const lines: string[] = [];

    // ── fit ─────────────────────────────────────────────────────────────
    // First, and never softened. It is the one refusal nothing ever fixes.
    if (suitability.fit === 'unsuited') refusals.push('unsuited');
    else if (suitability.fit === 'out_of_reach') refusals.push('out_of_reach');
    else if (suitability.fit === 'outgrown') refusals.push('outgrown');
    else if (suitability.fit === 'partly') refusals.push('partly_suited');
    lines.push(suitability.line);

    // ── standing ────────────────────────────────────────────────────────
    if (standing === null) {
        refusals.push('standing_not_assessed');
    } else if (!standing.permitted) {
        refusals.push(standing.reason === 'wrong_dao' ? 'wrong_dao' : 'no_matching_dao');
        lines.push(standing.detail);
    }

    // ── the ceiling ─────────────────────────────────────────────────────
    const techniqueCap = ceiling.cap;
    const raisesTheCeiling = techniqueCap === null || techniqueCap > ordinal;
    if (!raisesTheCeiling) {
        refusals.push('already_past_its_cap');
        lines.push(
            `${manual.name} ends at ${rankName(techniqueCap)}, and this cultivator is ` +
            `standing at ${rankName(ordinal)}. Taking it up changes nothing: it is not ` +
            'slower there, it is stopped.'
        );
    } else if (ceiling.volumesTotal > 0) {
        if (ceiling.volumesHeld === 0) refusals.push('no_volumes_in_hand');
        lines.push(ceiling.line);
    }

    // ── the opening ─────────────────────────────────────────────────────
    // Not a refusal. A cost, and one a player must be able to read before
    // committing the decade rather than after.
    if (opening.multiplier < 1) {
        lines.push(
            `${manual.name} does not simply work when you sit down with it. Progress in ` +
            `its opening stretch is worth ${opening.multiplier.toFixed(2)} against 1, and ` +
            `that lifts to 1 by ${rankName(
                Math.min(
                    manual.cap ?? ordinal,
                    manual.requiredOrdinal + (manual.opening?.rungs ?? 0)
                ) || ordinal
            )}. The ordinary book a house teaches is the better choice for the next stretch; ` +
            'this one only wins over the long run.'
        );
    }

    const hardRefusal =
        refusals.includes('unsuited') ||
        refusals.includes('out_of_reach') ||
        refusals.includes('outgrown') ||
        refusals.includes('wrong_dao') ||
        refusals.includes('no_matching_dao') ||
        refusals.includes('already_past_its_cap') ||
        refusals.includes('no_volumes_in_hand');

    return {
        usable: !hardRefusal,
        headline: lines[0] ?? suitability.line,
        lines,
        refusals,
        route,
        suitability,
        standing,
        ceiling,
        opening,
        techniqueCap,
        raisesTheCeiling
    };
}

/**
 * The best of a haul, and honestly.
 *
 * An expedition returns several things and the interesting question is never
 * what the pile is worth - it is whether ANY of it was for them. Returns null
 * for an empty haul, which is a real result and a common one.
 *
 * Ordered by fit and then by how much ceiling it buys, so a suited book that
 * ends one rung up does not outrank a suited book that ends five up. It never
 * reorders to flatter: an all-unsuited haul returns an unsuited best.
 */
export function bestAcquisition(
    manuals: readonly ManualLike[],
    shared: Omit<AcquisitionInput, 'manual'>
): AcquisitionReport | null {
    let best: AcquisitionReport | null = null;
    for (const manual of manuals) {
        const report = assessAcquisition({ ...shared, manual });
        if (best === null || acquisitionRank(report) < acquisitionRank(best)) best = report;
    }
    return best;
}

const FIT_RANK: Record<Suitability['fit'], number> = {
    suited: 0,
    partly: 1,
    out_of_reach: 2,
    unsuited: 3,
    outgrown: 4
};

function acquisitionRank(report: AcquisitionReport): number {
    // Usable first, then fit, then ceiling. A high ceiling never promotes an
    // unsuited book above a suited one - that would be the interface telling a
    // player to sit with something that will teach them nothing.
    const usable = report.usable ? 0 : 1;
    const ceiling = report.techniqueCap === null ? 0 : 1 / (1 + report.techniqueCap);
    return usable * 100 + FIT_RANK[report.suitability.fit] * 10 + ceiling;
}

// ─────────────────────────────────────────────────────────────────────────
// THE LIVING TEACHER
//
// Different people specialise in different things, and a method reaches a
// student through a person at least as often as through a shelf. `guidance` is
// already a RATE term keyed on a guide's ordinal; this makes a person an ACCESS
// route as well - which is what the corridor needs, because at several rungs
// the entire world offers one book and the question is who will show it to you.
//
// It reads the same suitability and cap machinery as everything else. A teacher
// is a door, not a discount: what comes through the door is judged by
// `assessAcquisition` exactly as a book found in a ruin is, and a beloved
// master handing you their life's work can still be handing you something that
// will teach you nothing.
//
// AND YOU CANNOT BE SHOWN FURTHER THAN THEY WENT. The ceiling a transmission
// carries is the book's, reduced to where the teacher themselves stopped - the
// one honest limit on this route, and the reason a house's best elder is not a
// substitute for the house's library.
// ─────────────────────────────────────────────────────────────────────────

export interface Transmitter {
    id: string;
    name: string;
    /** Where they stand. Caps what they can take a student to. */
    ordinal: number;
    /** Manual ids this person is actually able to pass on. */
    transmits: readonly string[];
    /** Volume ids of a scattered work they hold. Route 1b through a person. */
    volumesHeld?: readonly string[];
    /**
     * Whether they will. Social state, decided elsewhere - the relationship
     * layer, a sect rank, a debt, a grudge. Defaults to true so a caller that
     * has already settled the question does not have to say so twice.
     */
    willing?: boolean;
}

export type TransmissionRefusal =
    /** They do not have it to give. */
    | 'does_not_hold_it'
    /** They have it and will not. A social problem, not a strength one. */
    | 'unwilling'
    /** They never got far enough into it to take the student anywhere new. */
    | 'went_no_further';

export interface TransmissionCheck {
    permitted: boolean;
    reason: TransmissionRefusal | null;
    /**
     * The ceiling the STUDENT gets out of this, which is the lower of the
     * book's and the teacher's own standing. Null only when neither stops.
     */
    cap: number | null;
    /** What being taught by this person is worth as a rate term, at this rung. */
    guidance: number;
    /**
     * Everything else that stands between the student and the book. Null when
     * the transmission itself is refused, because there is nothing to assess.
     */
    acquisition: AcquisitionReport | null;
    detail: string;
}

/**
 * Whether this person can transmit this manual to this student.
 *
 * Access first - do they hold it, will they, and did they get far enough into
 * it to have anything to show. Then the ordinary judgement: `assessAcquisition`,
 * the same one a book found in a tomb goes through.
 */
export function canTransmit(
    teacher: Transmitter,
    manual: ManualLike,
    student: Omit<AcquisitionInput, 'manual' | 'route'>
): TransmissionCheck {
    const ordinal = student.realmOrdinal ?? student.seeker.ordinal;
    const guidance = guidanceMultiplier(ordinal, teacher.ordinal);

    if (!teacher.transmits.includes(manual.id)) {
        return {
            permitted: false,
            reason: 'does_not_hold_it',
            cap: null,
            guidance,
            acquisition: null,
            detail: `${teacher.name} does not have ${manual.name} to give. Whatever else ` +
                'they know, this is not among it.'
        };
    }

    if (teacher.willing === false) {
        return {
            permitted: false,
            reason: 'unwilling',
            cap: null,
            guidance,
            acquisition: null,
            detail: `${teacher.name} holds ${manual.name} and will not pass it on. That is a ` +
                'question about the two of them and not about the book, and no amount of ' +
                'cultivation answers it.'
        };
    }

    // What the teacher can actually hand over. Their own volumes decide it when
    // the work is scattered - a master with two thirds of a canon teaches two
    // thirds of a canon.
    const held = teacher.volumesHeld ?? student.heldVolumeIds ?? [];
    const bookCap = effectiveCapOf(manual, held).cap;

    // The honest limit. Nobody is shown further than the person showing them
    // went, whatever the book is rated for - which is the same fact
    // `guidanceMultiplier` already states as a rate, said once more as a
    // ceiling. A teacher standing on their own cap teaches the rung they are on
    // and nothing above it.
    const cap = bookCap === null ? teacher.ordinal : Math.min(bookCap, teacher.ordinal);

    if (cap <= ordinal) {
        return {
            permitted: false,
            reason: 'went_no_further',
            cap,
            guidance,
            acquisition: null,
            detail:
                `${teacher.name} stands at ${rankName(teacher.ordinal)} and this student at ` +
                `${rankName(ordinal)}. ${teacher.name} can hand over the pages and cannot ` +
                'show them anything: somebody who has not stood where you are standing ' +
                'cannot tell you anything about it. This is the moment a master sends a ' +
                'student away.'
        };
    }

    const acquisition = assessAcquisition({ ...student, manual, route: 'transmitted', heldVolumeIds: held });

    return {
        permitted: true,
        reason: null,
        cap,
        guidance,
        acquisition,
        detail:
            `${teacher.name} stands at ${rankName(teacher.ordinal)} and can take this ` +
            `student as far as ${rankName(cap)}` +
            `${bookCap !== null && cap < bookCap
                ? `, which is short of where ${manual.name} ends - the limit is the teacher, ` +
                  'not the book'
                : ''}. ${acquisition.headline}`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// DERIVATION, THROUGH THE SAME FUNNEL
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether writing the continuation is on the table, reported in the same shape
 * as every other route.
 *
 * The one thing worth saying loudly here: a manual whose continuation this
 * cultivator could write is a real answer to being capped, and it is the answer
 * available to somebody with no resources at all. Callers should offer it in
 * the same breath as the misses, because a player holding four books that are
 * not for them and a road they have walked for eighty years should be told the
 * fourth option exists.
 */
export function derivationOption(
    dao: DaoAssessment,
    manual: ManualLike
): DerivationCheck {
    const source: DerivableManual = {
        id: manual.id,
        name: manual.name,
        requiredOrdinal: manual.requiredOrdinal,
        cap: manual.cap,
        volumes: manual.volumes ?? null,
        grade: manual.grade,
        element: manual.element ?? null,
        subject: manual.subject ?? null,
        category: manual.category ?? null,
        derivable: manual.derivable ?? false,
        notDerivableReason: manual.notDerivableReason ?? null
    };
    return canDerive(dao, source);
}
