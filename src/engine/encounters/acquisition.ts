/**
 * Getting hold of a manual, and being told in the same breath whether it would
 * be any use.
 *
 * Most of what anybody finds will not suit them and this module must never
 * soften that: it does not rank, does not suggest, and never generates a find to
 * suit the seeker. The load-bearing property is that a caller gets ALL of the
 * reasons in one response - a player must never acquire something and find out
 * the second reason afterwards.
 */

import {
    assessFit,
    type Find,
    type Seeker,
    type Suitability
} from './suitability.js';
import {
    canExtend,
    effectiveCapOf,
    manualGate,
    openingPenalty,
    type ExtendableManual,
    type DerivationCheck,
    type EffectiveCap,
    type Precedent,
    type GatedManual,
    type ManualGateResult,
    type OpeningPenalty
} from '../cultivation/acquisition.js';
import { rankName } from '../cultivation/realms.js';
import type { DaoAssessment } from '../cultivation/dao.js';

// E6. ONE BUILDER, SO THE ACQUISITION PATHS CANNOT DISAGREE

/**
 * The catalog columns a manual puts in front of a reader.
 */
export interface ManualLike {
    id: string;
    name: string;
    requiredOrdinal: number;
    cap: number | null;
    grade: 'mortal' | 'earth' | 'heaven' | 'immortal' | 'chaos';
    element?: string | null;
    /** Every road the art is on, not just its primary. See `isOnRoad`. */
    subjects?: readonly string[] | null;
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

// E4. FIT ON EVERY ACQUISITION, NOT ONLY ON AN ENCOUNTER FIND

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
    /**
     * The book cannot be read at all: no part of it is in hand, or the part
     * that opens it is not. One refusal rather than two, because the three
     * categories make `ruined` the single test - see `whatConditionAManualIsIn`.
     */
    | 'ruined'
    | 'standing_not_assessed';

/**
 * Everything that stands between this cultivator and this manual, at once.
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
        subjects: manual.subjects ?? [],
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

    // fit
    // First, and never softened. It is the one refusal nothing ever fixes.
    if (suitability.fit === 'unsuited') refusals.push('unsuited');
    else if (suitability.fit === 'out_of_reach') refusals.push('out_of_reach');
    else if (suitability.fit === 'outgrown') refusals.push('outgrown');
    else if (suitability.fit === 'partly') refusals.push('partly_suited');
    lines.push(suitability.line);

    // standing
    if (standing === null) {
        refusals.push('standing_not_assessed');
    } else if (!standing.permitted) {
        refusals.push(standing.reason === 'wrong_dao' ? 'wrong_dao' : 'no_matching_dao');
        lines.push(standing.detail);
    }

    // the ceiling
    //
    // RUINED IS ASKED FIRST, because a ruined book has no ceiling and the
    // cap comparison would otherwise refuse it as "already past its cap" -
    // which is a true sentence about the number and a false one about the
    // book. The reason somebody cannot use it is that it will not open.
    const techniqueCap = ceiling.cap;
    const raisesTheCeiling = techniqueCap === null || techniqueCap > ordinal;
    if (ceiling.condition === 'ruined') {
        refusals.push('ruined');
        lines.push(ceiling.line);
    } else if (!raisesTheCeiling) {
        refusals.push('already_past_its_cap');
        lines.push(
            `${manual.name} ends at ${rankName(techniqueCap)}, and this cultivator is ` +
            `standing at ${rankName(ordinal)}. Taking it up changes nothing: it is not ` +
            'slower there, it is stopped.'
        );
    } else if (ceiling.volumesTotal > 0) {
        lines.push(ceiling.line);
    }

    // the opening
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
        refusals.includes('ruined');

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

// DERIVATION, THROUGH THE SAME FUNNEL

/**
 * Whether writing the continuation is on the table, reported in the same shape as
 * every other route.
 */
export function extensionOption(
    dao: DaoAssessment,
    manual: ManualLike,
    /**
     * What the world holds at or above the rung this would write for. Omitted skips
     * the new-ground check, which is right for a caller only asking whether the
     * ROAD permits it - but a caller about to offer the verb should supply it, or
     * it will offer a derivation the world has no ground for. Build it with
     * `precedentAt`.
     */
    precedent?: Precedent
): DerivationCheck {
    const source: ExtendableManual = {
        id: manual.id,
        name: manual.name,
        requiredOrdinal: manual.requiredOrdinal,
        cap: manual.cap,
        volumes: manual.volumes ?? null,
        grade: manual.grade,
        element: manual.element ?? null,
        subjects: manual.subjects ?? [],
        category: manual.category ?? null,
        notExtendableReason: manual.notDerivableReason ?? null
    };
    return canExtend(dao, source, precedent);
}
