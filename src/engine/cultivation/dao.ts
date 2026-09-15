/**
 * Your Dao - what a cultivator turns out to have been doing.
 */

import {
    type Insight,
    type InsightDegree,
    type InsightDomain,
    type TechniqueGrade,
    isOnRoad
} from '../../schema/cultivation.js';
import { isUniversalDomain } from './understanding.js';
import { forStream, type CultivationRNG } from './rng.js';

// STANDING

export type DaoStanding = 'none' | 'leaning' | 'dao';

/** Degree at which a subject stops being a hobby. `intent`. */
export const LEANING_DEGREE: InsightDegree = 3;
/** Degree at which it can become an identity. `heart`. */
export const DAO_DEGREE: InsightDegree = 4;
/**
 * Corroborating insights required alongside that depth.
 *
 * "Reinforced", not "standing alone": one towering insight with nothing around
 * it is a remarkable thing a person knows, not a road they walk.
 */
export const DAO_BREADTH_REQUIRED = 1;

export interface DaoAssessment {
    standing: DaoStanding;
    /** The subject carried furthest. Null when there is no leaning at all. */
    subject: string | null;
    domain: InsightDomain | null;
    /** "the Dao of the Sword". Null unless the standing is a full Dao. */
    name: string | null;
    /** Highest degree held in `subject`. */
    depth: number;
    /** Corroborating insights in the same domain, excluding the deepest one. */
    breadth: number;
    /**
     * 0..1 how far along this road the cultivator is. Drives narrowing, and
     * nothing else - it is a measure of commitment, not of correctness.
     */
    intensity: number;
}

const NO_DAO: DaoAssessment = {
    standing: 'none',
    subject: null,
    domain: null,
    name: null,
    depth: 0,
    breadth: 0,
    intensity: 0
};

/**
 * What this cultivator turns out to have been doing.
 */
export function daoOf(insights: readonly Insight[]): DaoAssessment {
    if (insights.length === 0) return { ...NO_DAO };

    // Deepest degree held per subject, and how many insights corroborate it.
    const bySubject = new Map<string, { domain: InsightDomain; depth: number; count: number }>();
    for (const insight of insights) {
        const existing = bySubject.get(insight.subject);
        if (existing === undefined) {
            bySubject.set(insight.subject, {
                domain: insight.domain,
                depth: insight.degree,
                count: 1
            });
            continue;
        }
        existing.count++;
        if (insight.degree > existing.depth) {
            existing.depth = insight.degree;
            existing.domain = insight.domain;
        }
    }

    let best: { subject: string; domain: InsightDomain; depth: number } | null = null;
    for (const [subject, entry] of [...bySubject.entries()].sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
    )) {
        if (best === null || entry.depth > best.depth) {
            best = { subject, domain: entry.domain, depth: entry.depth };
        }
    }
    if (best === null || best.depth < LEANING_DEGREE) return { ...NO_DAO };

    // Breadth is corroboration: other insights in the same domain that are not
    // the deepest one. A road has more than one stone in it.
    const breadth = insights.filter(
        i => i.domain === best.domain && i.subject !== best.subject
    ).length +
        Math.max(0, (bySubject.get(best.subject)?.count ?? 1) - 1);

    const standing: DaoStanding =
        best.depth >= DAO_DEGREE && breadth >= DAO_BREADTH_REQUIRED ? 'dao' : 'leaning';

    const intensity = clamp01(
        ((best.depth - LEANING_DEGREE + 1) / (5 - LEANING_DEGREE + 1)) * 0.7 +
            (Math.min(breadth, 3) / 3) * 0.3
    );

    return {
        standing,
        subject: best.subject,
        domain: best.domain,
        name: standing === 'dao' ? daoName(best.subject, best.domain) : null,
        depth: best.depth,
        breadth,
        intensity
    };
}

/** "the Dao of the Sword", "the Dao of Water", "the Dao of Severance". */
export function daoName(subject: string, domain: InsightDomain): string {
    const titled = subject
        .split(/[\s_-]+/)
        .map(w => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
        .join(' ');
    // Crafts and instruments take the article; elements and abstractions do not.
    const article = domain === 'weapon' || domain === 'formation' ? 'the ' : '';
    return `the Dao of ${article}${titled}`;
}

// 1. IT GATES THE HIGHEST ARTS
//
// The reason top-grade manuals sit in ruins unread. Someone can hold one for a
// century, have the ordinal and the qi to spare, and never open it - because
// what the art requires is not power, it is having walked the road.

/** Standing a grade demands before it can be learned at all. */
export const GRADE_REQUIREMENT: Record<TechniqueGrade, DaoStanding> = {
    mortal: 'none',
    earth: 'none',
    heaven: 'none',
    immortal: 'leaning',
    chaos: 'dao'
};

const STANDING_ORDER: Record<DaoStanding, number> = { none: 0, leaning: 1, dao: 2 };

/**
 * What a technique is about, as far as the Dao gate is concerned.
 */
export interface GatedTechnique {
    grade: TechniqueGrade;
    element?: string | null;
    /** Every road the art is on, not just its primary. See `isOnRoad`. */
    subjects?: readonly string[] | null;
    category?: string | null;
}

export interface DaoGateResult {
    /** Whether the art can be learned at all. */
    permitted: boolean;
    /** Machine-readable reason when refused; null when permitted. */
    reason: string | null;
    requiredStanding: DaoStanding;
    heldStanding: DaoStanding;
    /** Factual account of the refusal, for the narrator. */
    detail: string;
}

/**
 * Whether this cultivator's road permits this art.
 *
 * Refusal is a statement about the reader, not about the manual: the pages are
 * legible, the qi is there, and the meaning does not arrive.
 */
export function daoGate(dao: DaoAssessment, technique: GatedTechnique): DaoGateResult {
    const required = GRADE_REQUIREMENT[technique.grade];
    if (required === 'none') {
        return {
            permitted: true,
            reason: null,
            requiredStanding: required,
            heldStanding: dao.standing,
            detail: 'This grade asks nothing of the reader beyond the qi to hold it.'
        };
    }

    if (STANDING_ORDER[dao.standing] < STANDING_ORDER[required]) {
        return {
            permitted: false,
            reason: 'no_matching_dao',
            requiredStanding: required,
            heldStanding: dao.standing,
            detail:
                `The pages are perfectly legible and the meaning does not arrive. ` +
                `An art of this grade is written for someone who has walked a road, and ` +
                `${dao.standing === 'none' ? 'this cultivator has not begun one' : 'this one is not yet far enough along'}.`
        };
    }

    if (!roadPermits(dao, technique)) {
        return {
            permitted: false,
            reason: 'wrong_dao',
            requiredStanding: required,
            heldStanding: dao.standing,
            detail:
                `${dao.name ?? `a leaning toward ${dao.subject}`} is a road, and it is not this one. ` +
                'The art is written in a language this cultivator has spent their life not learning.'
        };
    }

    return {
        permitted: true,
        reason: null,
        requiredStanding: required,
        heldStanding: dao.standing,
        detail: asksNothingOfTheRoad(technique)
            ? 'The art is about nothing in particular and asks nothing of the road. ' +
              'It works off whatever qi the reader has, and this cultivator has walked ' +
              'far enough to hold it.'
            : `${dao.name ?? `a leaning toward ${dao.subject}`} opens this art.`
    };
}

/**
 * Whether the art makes any claim about the road at all.
 *
 * {@link daoMatches} compares a comprehension against three things: the roads
 * the art names, the element it is written in, and - for a forbidden art -
 * existence itself. An art carrying none of the three gives that predicate
 * nothing to compare against, so it refuses every cultivator who has ever
 * lived. That is not a hard art. It is a GENERAL one: it makes no claim about
 * the road, it runs off the practitioner's own qi, and everybody's qi is qi.
 * The element belongs to the cultivator rather than to the book.
 *
 * Measured off the live catalog: 17 of 157 rows name neither a road nor an
 * element, the block-printed primer everybody starts with among them, and every
 * derivation attempt against one refused `wrong_dao` forever.
 *
 * The element axis has always read this way. `assessFit` answers a null element
 * with *it asks for no particular element* and a match, so an elementless art
 * admits every root. This is that sentence on the road axis.
 *
 * On both axes admission is where it stops. An elementless art takes no root
 * bonus in `assessPower` or in `techniqueEffectiveness`, for the reason
 * {@link wieldingWeight} gives below, and 73 of 157 catalog rows are elementless
 * so the difference is most of the catalog rather than a corner of it.
 */
export function asksNothingOfTheRoad(technique: GatedTechnique): boolean {
    return (technique.subjects ?? []).length === 0
        && (technique.element ?? null) === null
        && technique.category !== 'forbidden';
}

/**
 * Whether a cultivator's road is a bar to this art.
 *
 * The LEARNING question, and deliberately not {@link daoMatches}. Making no
 * demand and being a perfect fit are two different facts: a general art refuses
 * nobody, and it sharpens nobody either. So every GATE reads this and
 * {@link wieldingWeight} keeps reading the match - sharing one predicate would
 * pay every cultivator the on-road multiplier for understanding nothing in
 * particular, which is a balance change nobody asked for.
 */
export function roadPermits(dao: DaoAssessment, technique: GatedTechnique): boolean {
    return asksNothingOfTheRoad(technique) || daoMatches(dao, technique);
}

/** Whether a road and an art are about the same thing. */
export function daoMatches(dao: DaoAssessment, technique: GatedTechnique): boolean {
    if (dao.subject === null || dao.domain === null) return false;
    // ANY of the art's roads matching is a match, which is the widening
    // arriving here: a sword-and-formation art is opened by sword
    // comprehension AND by formation comprehension, and refusing the second
    // would make the extra road decorative.
    if (isOnRoad(technique, dao.subject)) return true;
    if (dao.domain === 'element' && technique.element === dao.subject) return true;
    // Forbidden arts are about existence rather than about a craft, so the
    // comprehensions that open them are the universal ones.
    if (technique.category === 'forbidden' && isUniversalDomain(dao.domain)) return true;
    return false;
}

// 2. IT MAKES THE ART WORK
//
// A cultivation technique requires dao, most of the time. `daoGate` above is
// that rule at its hardest: the top two grades cannot be opened at all without
// the standing. Below those grades it said nothing, so an art thrown by
// somebody with no comprehension of what it is about landed exactly as hard as
// the same art thrown by somebody who has spent forty years on that road. The
// form was there and the thing the form is for was not, and the engine could
// not tell the difference.
//
// Read by the technique line of `assessPower`. Sized against `EDGE_VALUES` in
// the same file: walking the art's own road is worth a little less than good
// ground (terrain, x1.3 - a leaning is x1.15 and a Dao x1.35), and nothing like
// what a rung is worth (x4 a realm). Comprehension decides which of two
// cultivators at a height wins. It does not lift anybody past a height.
//
// A cultivator with no standing, or one whose road is not this art's road,
// takes exactly 1. The absence is not a penalty - it is the art working as
// written and no better, which is what flashy and hollow means here.

export const WIELDING_FACTOR: Record<DaoStanding, number> = {
    none: 1,
    leaning: 1.15,
    dao: 1.35
};

/**
 * What the road already walked is worth to an art wielded on it.
 *
 * `daoMatches` and not `roadPermits`, and the split is load-bearing. The gates
 * ask whether the art makes a DEMAND of the road; this asks whether the
 * comprehension is ABOUT the thing the art is about. An art on no road in
 * particular demands nothing, so it refuses nobody - and it gives a
 * comprehension nothing to be about, so it sharpens nobody. Reading
 * `roadPermits` here would hand every cultivator the on-road multiplier on
 * every general art in the catalog.
 */
export function wieldingWeight(
    dao: DaoAssessment,
    technique: GatedTechnique | null | undefined
): number {
    if (!technique) return 1;
    if (!daoMatches(dao, technique)) return 1;
    return WIELDING_FACTOR[dao.standing];
}

// 3. IT NARROWS AS IT DEEPENS
//
// Not forbidden, increasingly foreign. What you comprehend deeply, you
// comprehend at the cost of comprehending otherwise - so a cultivator far
// along one road finds other subjects harder to take in, and finds their own
// road easier than anyone else would.

/** How far a candidate sits from the road already walked. */
export type DaoDistance = 'same_subject' | 'same_domain' | 'distant';

/**
 * Weight lost at full intensity, by distance.
 *
 * Never reaches 1: a distant comprehension at maximum narrowing still keeps a
 * quarter of its weight, because a Dao closes doors without locking them.
 */
export const NARROWING_PENALTY: Record<DaoDistance, number> = {
    same_subject: 0,
    same_domain: 0.35,
    distant: 0.75
};

export function daoDistance(
    dao: DaoAssessment,
    candidate: { domain: InsightDomain; subject: string }
): DaoDistance {
    if (dao.subject === null) return 'distant';
    if (candidate.subject === dao.subject) return 'same_subject';
    if (candidate.domain === dao.domain) return 'same_domain';
    return 'distant';
}

/**
 * Relative likelihood of comprehending this candidate, given the road already
 * walked. 1 for a cultivator with no Dao: nothing is foreign yet.
 */
export function narrowingWeight(
    dao: DaoAssessment,
    candidate: { domain: InsightDomain; subject: string }
): number {
    if (dao.standing === 'none') return 1;
    const penalty = NARROWING_PENALTY[daoDistance(dao, candidate)];
    return Math.max(0.05, 1 - dao.intensity * penalty);
}

/**
 * Choose a comprehension, with the road already walked bending the odds.
 *
 * Consumes exactly one sample regardless of the candidate set, so swapping
 * this in for a uniform pick does not shift anything drawn afterwards.
 */
export function pickNarrowed<T extends { domain: InsightDomain; subject: string }>(
    rng: CultivationRNG,
    candidates: readonly T[],
    dao: DaoAssessment,
    /**
     * Optional latent slope. Supplied by the caller as (runSeed, cultivatorId)
     * so this module never reaches for identity itself. Omitted means an even
     * slope, which is what an NPC stub or a preview gets.
     */
    affinity?: { runSeed: string; cultivatorId: string }
): T {
    if (candidates.length === 0) throw new Error('pickNarrowed() over an empty candidate set');
    const weights = candidates.map(c => {
        const narrowing = narrowingWeight(dao, c);
        if (affinity === undefined) return narrowing;
        return narrowing * AFFINITY_WEIGHT[
            affinityFor(affinity.runSeed, affinity.cultivatorId, c)
        ];
    });
    const total = weights.reduce((sum, w) => sum + w, 0);
    let cursor = rng.next() * total;
    for (let i = 0; i < candidates.length; i++) {
        cursor -= weights[i];
        if (cursor < 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
}

// AFFINITY, AND FINDING OUT TOO LATE
//
// Every cultivator has predispositions toward Daos they may never encounter.
// Most ordinary, a few extraordinary, and NOBODY KNOWS - not an elder, not an
// aptitude test, not the character sheet, not the cultivator.
//
// Three properties, each of which is load-bearing:
//
//  1. IT IS ROLLED AT CREATION. Derived from (runSeed, cultivatorId), both of
//     which exist the moment the cultivator does, so the value is fixed from
//     creation and cannot possibly be a function of who they later met. That
//     matters: a run has to be able to contain "they had it all along and died
//     without knowing", and a gift conjured on first contact could not.
//
//  2. IT IS NEVER SURFACED. Deriving rather than storing is what makes this
//     structural. There is no column, so no serialiser can leak it; no field,
//     so no UI can render it; no setter, so no writer can forge it. It is not
//     information withheld from the player that exists somewhere legible - the
//     world genuinely does not know either.
//
//  3. IT ONLY MANIFESTS THROUGH ACCESS. Affinity is the SLOPE, never the
//     FILTER. It does not put a candidate within reach and it must never be
//     consulted by `discoverableInsights` - a towering affinity for something
//     never encountered is worth exactly zero, forever, which is the ordinary
//     outcome for very nearly everyone.
//
// The engine never had the chance to reward a thing it was never offered, and
// that is the entire point. Anyone tempted to add a "you seem suited to this"
// hint should read the scenario this exists to produce: taken in by a body
// sect at eleven because that is whose recruiter came through the village,
// competent and unremarkable for twenty-nine years, and then one afternoon
// watching someone work karma and finding it obvious.

export type AffinityDegree = 'none' | 'aptitude' | 'strong' | 'extraordinary';

/**
 * Cumulative thresholds on one uniform sample. Deliberately steep: roughly one
 * subject in ten draws an aptitude, one in forty-five something strong, and one in
 * three hundred something extraordinary. Across the handful of subjects a world
 * actually contains, that makes an extraordinary affinity the sort of thing a
 * generation produces a few of.
 */
export const AFFINITY_THRESHOLDS: readonly { min: number; degree: AffinityDegree }[] = [
    { min: 0.997, degree: 'extraordinary' },
    { min: 0.975, degree: 'strong' },
    { min: 0.9, degree: 'aptitude' },
    { min: 0, degree: 'none' }
] as const;

/**
 * How much faster comprehension arrives once access exists. Applied to the
 * candidate weighting, never to whether a candidate appears.
 */
export const AFFINITY_WEIGHT: Record<AffinityDegree, number> = {
    none: 1,
    aptitude: 1.6,
    strong: 3,
    extraordinary: 6
};

/**
 * Degree the first comprehension lands at.
 */
export const AFFINITY_INITIAL_DEGREE: Record<AffinityDegree, InsightDegree> = {
    none: 1,
    aptitude: 1,
    strong: 2,
    extraordinary: 3
};

/**
 * This cultivator's latent predisposition toward one Dao.
 */
export function affinityFor(
    runSeed: string,
    cultivatorId: string,
    target: { domain: InsightDomain; subject: string }
): AffinityDegree {
    const sample = forStream(
        runSeed, 'affinity', cultivatorId, target.domain, target.subject
    ).next();
    for (const band of AFFINITY_THRESHOLDS) {
        if (sample >= band.min) return band.degree;
    }
    return 'none';
}

/**
 * Whether first contact with this Dao is the kind of moment that announces
 * itself. Only an extraordinary affinity does - a strong one is a real slope
 * that arrives without fanfare, which is why most gifted people simply seem
 * to pick things up quickly.
 */
export function isRecognition(affinity: AffinityDegree): boolean {
    return affinity === 'extraordinary';
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
