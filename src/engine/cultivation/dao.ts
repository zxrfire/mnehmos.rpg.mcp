/**
 * Your Dao - what a cultivator turns out to have been doing.
 *
 * Ask a cultivator what they are and the honest answer is not their realm. It
 * is what dao they cultivate. So this is not a class, not a specialisation
 * picked at creation, and not something spirit stones reach: it is DERIVED,
 * every time, from the insight set in `understanding.ts`.
 *
 * That derivation is the whole discipline. There is no `dao` column, no
 * setter, and no field a writer could populate, which makes it structurally
 * impossible for a cultivator to have a Dao without the comprehension behind
 * it - the same rule as insight provenance, applied one level up. If caching
 * is ever needed, cache `daoOf()` explicitly as a derived value; never
 * introduce it as independent state.
 *
 *   a few shallow insights, scattered  ->  none. Most cultivators, most of the time.
 *   depth in one subject               ->  a leaning. Others start to notice.
 *   heart or dao degree, reinforced    ->  a Dao. He walks the Dao of the Sword.
 *
 * ── A warning about warnings ─────────────────────────────────────────────
 *
 * A cultivator can spend two centuries on a Dao their root, tradition or
 * circumstances never suited, be genuinely good at it, and never pass a
 * boundary on it. NOTHING IN THIS FILE TELLS THEM SO.
 *
 * There is no `suited` field, no `mismatch` flag, no advisory string, and no
 * hint in any return value. The engine simply does not reward the mismatch:
 * `pathWeightOf` in understanding.ts gives a foreign element zero weight at a
 * bottleneck, so the substitution never arrives and the wall never moves.
 * They keep their technique effectiveness - they really are good at it - and
 * the boundary stays shut.
 *
 * This is deliberate and it is load-bearing. The realisation is one of the
 * worse things that happens to people here, and it has to be arrived at by
 * living it. A helpful flag would convert a tragedy into a tooltip. Anyone
 * adding one later should read this paragraph first.
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

// ─────────────────────────────────────────────────────────────────────────
// STANDING
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * Pure, cheap, and derived from nothing but the insight set. Ties are broken
 * by breadth and then by subject name so the answer is stable rather than
 * dependent on the order rows came back from a query.
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

// ─────────────────────────────────────────────────────────────────────────
// 1. IT GATES THE HIGHEST ARTS
//
// The reason top-grade manuals sit in ruins unread. Someone can hold one for a
// century, have the ordinal and the qi to spare, and never open it - because
// what the art requires is not power, it is having walked the road.
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * Kept structural rather than reading TechniqueSchema directly, so this does
 * not depend on which of `subject` / `element` / `category` the content layer
 * happens to carry for a given art.
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

    if (!daoMatches(dao, technique)) {
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
        detail: `${dao.name ?? `a leaning toward ${dao.subject}`} opens this art.`
    };
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

// ─────────────────────────────────────────────────────────────────────────
// 2. IT NARROWS AS IT DEEPENS
//
// Not forbidden, increasingly foreign. What you comprehend deeply, you
// comprehend at the cost of comprehending otherwise - so a cultivator far
// along one road finds other subjects harder to take in, and finds their own
// road easier than anyone else would.
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
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
 * subject in ten draws an aptitude, one in forty-five something strong, and
 * one in three hundred something extraordinary. Across the handful of subjects
 * a world actually contains, that makes an extraordinary affinity the sort of
 * thing a generation produces a few of.
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
 *
 * An extraordinary affinity does not start at a glimpse and work up: the thing
 * is simply obvious, at a speed nothing in the cultivator's experience
 * prepares them for.
 */
export const AFFINITY_INITIAL_DEGREE: Record<AffinityDegree, InsightDegree> = {
    none: 1,
    aptitude: 1,
    strong: 2,
    extraordinary: 3
};

/**
 * This cultivator's latent predisposition toward one Dao.
 *
 * Pure and derived - the same (runSeed, cultivatorId, domain, subject) always
 * yields the same answer, from the moment the cultivator exists. Nothing about
 * their history, their sect, their rank or their exposure enters it.
 *
 * DO NOT call this from `discoverableInsights` or from anything that decides
 * what a cultivator can reach. Access is the filter; this is the slope.
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
