/**
 * Understanding - the axis that is not accumulation.
 *
 * Three quantities are kept separate and are allowed to be wildly out of step:
 *
 *   accumulation   how much qi has been gathered      (cultivationProgress)
 *   quality        what it was built on               (foundationQuality)
 *   understanding  what the cultivator comprehends    (this file)
 *
 * A cultivator with an enormous reserve and shallow understanding hits a wall
 * no further accumulation clears. A cultivator with less raw power and a deep
 * grasp of their own path crosses the moment they find the missing piece, and
 * fights well above where their rank suggests. Before this module, two
 * cultivators at identical progress had identical prospects, which made the
 * ladder the only story a run could tell.
 *
 * Three constraints matter more than any of the numbers below.
 *
 *  1. IT IS NOT A SKILL TREE. There is no menu and no fixed list. What a
 *     cultivator can discover is computed from their spirit root, attributes,
 *     techniques, location and what has actually happened to them - see
 *     `discoverableInsights`. Two cultivators may hold sets with no overlap,
 *     and the engine never enumerates "all insights" anywhere.
 *
 *  2. IT CANNOT BE BOUGHT. Nothing here takes spirit stones, nothing is
 *     granted by rank, and nothing arrives on a schedule. There is no function
 *     in this file that awards an insight for time served. If it could be
 *     ground, it would be designed wrong.
 *
 *  3. IT IS ALWAYS TRACEABLE. Every insight carries the achievement that
 *     produced it, and the achievement carries the event. This is enforced
 *     structurally rather than by convention: `formInsight` is the only
 *     constructor, it requires an Achievement, and the insight's own id is
 *     DERIVED from the achievement's. An insight with no provenance cannot be
 *     built by this module and cannot survive `InsightSchema.parse` at the
 *     storage boundary, because `provenance` has no default and no optional.
 *
 * Note what is absent: Fortune. Insight the ATTRIBUTE gates comprehension,
 * because reading a life you did not live is exactly what it measures. Fortune
 * does not appear anywhere in this file. Luck may generate the opportunity to
 * be somewhere interesting, but understanding is capability, and letting luck
 * buy capability through a side door is the trap this whole subsystem is
 * shaped to avoid.
 */

import {
    type Achievement,
    type AchievementKind,
    type Cultivator,
    type Element,
    type Insight,
    type InsightDegree,
    type InsightDomain,
    type InsightProvenance,
    type VisionSeed
} from '../../schema/cultivation.js';
import { getSpiritRoot } from './spirit-roots.js';
import { progressRequiredForOrdinal } from './realms.js';
import type { CultivationRNG } from './rng.js';
// TYPE-ONLY, and must remain so: social/common.ts imports from this
// package, so a value import here would close a runtime cycle. Type
// imports are erased, so this one is free - it buys the contract safety
// without the edge. See TEMPORAL PHENOMENA at the bottom of the file.
import type { KnowledgeInput } from '../social/knowledge.js';

// ─────────────────────────────────────────────────────────────────────────
// DEGREES
// The genre's own ladder, and the reason "sword intent" and "sword heart" are
// different things rather than the same thing with a bigger number. A degree
// is a qualitative state with a name, not a level.
// ─────────────────────────────────────────────────────────────────────────

export const DEGREE_NAMES: Record<InsightDegree, string> = {
    1: 'glimpse',
    2: 'grasp',
    3: 'intent',
    4: 'heart',
    5: 'dao'
};

export const MAX_DEGREE: InsightDegree = 5;

/**
 * Display name, composed rather than stored: subject plus degree word.
 * "sword intent", "sword heart", "water dao", "formation grasp".
 */
export function insightName(insight: Pick<Insight, 'subject' | 'degree'>): string {
    return `${insight.subject} ${DEGREE_NAMES[insight.degree]}`;
}

// ─────────────────────────────────────────────────────────────────────────
// RELEVANCE
//
// An insight helps with what it is actually about. A profound grasp of the
// spear does not make a water cultivator's meridians wider, and pretending
// otherwise would turn this back into a single number.
//
// Universal domains are the exception, and deliberately so: karma, life and
// death, time and void are comprehensions about existence rather than about a
// craft, so they bear on everything a cultivator does.
// ─────────────────────────────────────────────────────────────────────────

export const UNIVERSAL_DOMAINS: readonly InsightDomain[] = [
    'karma', 'life_death', 'time', 'void'
] as const;

export function isUniversalDomain(domain: InsightDomain): boolean {
    return UNIVERSAL_DOMAINS.includes(domain);
}

/**
 * How much this insight bears on a bottleneck in the cultivator's OWN path.
 *
 * A bottleneck is a question about your own dao, so insights about existence
 * count fully, insights about your own elements count fully, and a mastery of
 * some craft counts for something but not for everything. A sword saint does
 * not get to skip Core Formation on swordsmanship alone.
 */
export const PATH_WEIGHT: Record<InsightDomain, number> = {
    karma: 1,
    life_death: 1,
    time: 1,
    void: 1,
    element: 1,
    body: 0.5,
    weapon: 0.4,
    formation: 0.4,
    alchemy: 0.4
};

export interface RelevanceContext {
    /** Elements the cultivator's root can channel. */
    rootElements: readonly Element[];
    /** Element of the art currently being practised, if any. */
    techniqueElement?: Element | null;
    /** Free-form subject of the art being practised, e.g. 'sword', 'formation'. */
    techniqueSubject?: string | null;
}

/**
 * Whether an insight bears on what the cultivator is doing right now, for
 * cultivation-rate purposes.
 */
export function isRelevantToPractice(insight: Insight, ctx: RelevanceContext): boolean {
    if (isUniversalDomain(insight.domain)) return true;
    if (insight.domain === 'element') {
        const element = insight.subject as Element;
        if (ctx.rootElements.includes(element)) return true;
        return ctx.techniqueElement === element;
    }
    return (
        ctx.techniqueSubject !== null &&
        ctx.techniqueSubject !== undefined &&
        ctx.techniqueSubject === insight.subject
    );
}

/** Whether an insight bears on the cultivator's own path, for a bottleneck. */
export function pathWeightOf(insight: Insight, ctx: RelevanceContext): number {
    if (isUniversalDomain(insight.domain)) return PATH_WEIGHT[insight.domain];
    if (insight.domain === 'element') {
        return ctx.rootElements.includes(insight.subject as Element)
            ? PATH_WEIGHT.element
            : 0;
    }
    return PATH_WEIGHT[insight.domain];
}

// ─────────────────────────────────────────────────────────────────────────
// EFFECTS
//
// Deliberately modest per insight and hard-capped in aggregate. Understanding
// is meant to decide WHICH of two similar cultivators crosses, not to replace
// the ladder. A cultivator with five insights should be formidable; one with
// fifteen should not be unrecognisable.
// ─────────────────────────────────────────────────────────────────────────

/** Cultivation-rate bonus per degree of a relevant insight. */
export const RATE_PER_DEGREE = 0.03;
/** Ceiling on the total rate bonus from understanding. */
export const MAX_RATE_BONUS = 0.5;

/** Breakthrough-odds bonus per degree of a relevant insight. */
export const BREAKTHROUGH_PER_DEGREE = 0.015;
/** Ceiling on the total breakthrough bonus from understanding. */
export const MAX_BREAKTHROUGH_BONUS = 0.12;

/** Technique-effectiveness bonus per degree of a matching insight. */
export const TECHNIQUE_PER_DEGREE = 0.08;
/** Ceiling on technique effectiveness from understanding. */
export const MAX_TECHNIQUE_BONUS = 1.0;

/**
 * Fraction of a bottleneck's requirement that one degree of path-relevant
 * understanding can stand in for.
 */
export const SUBSTITUTION_PER_DEGREE = 0.04;
/**
 * Ceiling on substitution.
 *
 * A third, and not a sliver more. Understanding must be able to decide a
 * crossing that accumulation alone would lose, and must never be able to
 * replace the climb: a cultivator with no progress and profound understanding
 * still cannot cross, because 35% of the requirement is not the requirement.
 */
export const MAX_SUBSTITUTION = 0.35;

export interface UnderstandingEffects {
    /** Multiplier folded into the per-day cultivation rate. */
    cultivationMultiplier: number;
    /** Flat modifier on breakthrough probability. */
    breakthroughModifier: number;
    /** Insights that contributed, for the UI to name. */
    contributing: { name: string; domain: InsightDomain; degree: InsightDegree }[];
}

/**
 * What a cultivator's understanding is worth to them right now.
 *
 * Pure, and reads only the insights that bear on what is actually being done.
 */
export function understandingEffects(
    insights: readonly Insight[],
    ctx: RelevanceContext
): UnderstandingEffects {
    let rate = 0;
    let breakthrough = 0;
    const contributing: UnderstandingEffects['contributing'] = [];

    for (const insight of insights) {
        if (!isRelevantToPractice(insight, ctx)) continue;
        rate += insight.degree * RATE_PER_DEGREE;
        breakthrough += insight.degree * BREAKTHROUGH_PER_DEGREE;
        contributing.push({
            name: insightName(insight),
            domain: insight.domain,
            degree: insight.degree
        });
    }

    return {
        cultivationMultiplier: 1 + Math.min(rate, MAX_RATE_BONUS),
        breakthroughModifier: Math.min(breakthrough, MAX_BREAKTHROUGH_BONUS),
        contributing
    };
}

/**
 * How effective a technique is, combining spirit-root affinity with actual
 * comprehension of what the technique is about.
 *
 * This is where "fights far above where their rank suggests" lives: two
 * cultivators with the same manual at the same mastery do not hit equally hard
 * if one of them understands the sword and the other has been copying forms.
 */
export function techniqueEffectiveness(
    cultivator: Pick<Cultivator, 'spiritRoot'> & { insights?: readonly Insight[] },
    technique: { element?: Element | null; subject?: string | null; mastery?: number }
): { multiplier: number; fromRoot: number; fromUnderstanding: number } {
    const root = getSpiritRoot(cultivator.spiritRoot);
    const element = technique.element ?? null;
    const fromRoot =
        element !== null && root.elements.includes(element) ? root.matchedTechniqueBonus : 1;

    let understanding = 0;
    for (const insight of cultivator.insights ?? []) {
        const matchesElement = insight.domain === 'element' && insight.subject === element;
        const matchesSubject =
            technique.subject !== null &&
            technique.subject !== undefined &&
            insight.subject === technique.subject;
        if (!matchesElement && !matchesSubject) continue;
        understanding += insight.degree * TECHNIQUE_PER_DEGREE;
    }
    const fromUnderstanding = 1 + Math.min(understanding, MAX_TECHNIQUE_BONUS);

    const mastery = clamp01(technique.mastery ?? 1);
    return {
        multiplier: fromRoot * fromUnderstanding * (0.5 + 0.5 * mastery),
        fromRoot,
        fromUnderstanding
    };
}

// ─────────────────────────────────────────────────────────────────────────
// SUBSTITUTION AT A BOTTLENECK
// The whole point of the subsystem.
// ─────────────────────────────────────────────────────────────────────────

export interface SubstitutionResult {
    /** Qi-units of the requirement that understanding stands in for. */
    substituted: number;
    /** Fraction of the requirement, after the cap. */
    fraction: number;
    /** The requirement this was computed against. */
    required: number;
    /** Insights that contributed and their path weights. */
    contributing: { name: string; weight: number; degree: InsightDegree }[];
}

/**
 * How much of the next bottleneck understanding can stand in for.
 *
 * The substitution is expressed in qi-units against the CURRENT ordinal's
 * requirement, so it scales with the ladder rather than becoming irrelevant
 * at high realms or overwhelming at low ones. It is capped at
 * MAX_SUBSTITUTION, so understanding decides marginal crossings and never
 * replaces the climb.
 */
export function bottleneckSubstitution(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'spiritRoot'> & { insights?: readonly Insight[] },
    ctx?: Partial<RelevanceContext>
): SubstitutionResult {
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);
    const relevance = relevanceFor(cultivator, ctx);

    let raw = 0;
    const contributing: SubstitutionResult['contributing'] = [];
    for (const insight of cultivator.insights ?? []) {
        const weight = pathWeightOf(insight, relevance);
        if (weight <= 0) continue;
        raw += insight.degree * SUBSTITUTION_PER_DEGREE * weight;
        contributing.push({ name: insightName(insight), weight, degree: insight.degree });
    }

    const fraction = Math.min(raw, MAX_SUBSTITUTION);
    return { substituted: required * fraction, fraction, required, contributing };
}

/**
 * Progress as a bottleneck actually sees it: what was accumulated, plus what
 * understanding stands in for.
 *
 * Every eligibility question in the engine routes through this rather than
 * reading `cultivationProgress` directly, which is what makes the substitution
 * real instead of decorative.
 */
export function effectiveProgress(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'spiritRoot' | 'cultivationProgress'> & {
        insights?: readonly Insight[];
    },
    ctx?: Partial<RelevanceContext>
): number {
    return cultivator.cultivationProgress + bottleneckSubstitution(cultivator, ctx).substituted;
}

/** Fill in the relevance context from the cultivator when a caller omits it. */
function relevanceFor(
    cultivator: Pick<Cultivator, 'spiritRoot'>,
    ctx?: Partial<RelevanceContext>
): RelevanceContext {
    return {
        rootElements: ctx?.rootElements ?? getSpiritRoot(cultivator.spiritRoot).elements,
        techniqueElement: ctx?.techniqueElement ?? null,
        techniqueSubject: ctx?.techniqueSubject ?? null
    };
}

// ─────────────────────────────────────────────────────────────────────────
// DISCOVERY
//
// What a given cultivator is even capable of comprehending. Computed from the
// individual, never from a global list - this function IS the answer to "is
// this a skill tree", and the answer is that two cultivators can walk out of
// here with candidate sets that do not intersect at all.
// ─────────────────────────────────────────────────────────────────────────

export interface DiscoveryContext {
    /** Subjects the cultivator's practised arts are about, e.g. ['sword']. */
    techniqueSubjects?: readonly string[];
    /** Element of the art being practised. */
    techniqueElement?: Element | null;
    /**
     * Tags on where the cultivator is standing. A forbidden river, an ancient
     * battlefield, a formation nobody alive can read. Supplied by the caller
     * from real world state; the engine holds no map.
     */
    locationTags?: readonly string[];
    /** Something extraordinary happened, opening domains ordinary life does not. */
    survived?: 'tribulation' | 'deviation' | 'near_death' | null;
    /** An extraordinary teacher is present. */
    instruction?: boolean;
}

export interface InsightCandidate {
    domain: InsightDomain;
    subject: string;
    /** Why this is even on the table for this cultivator. */
    opening: string;
}

/**
 * Candidate comprehensions, derived entirely from this cultivator's situation.
 *
 * Returns an empty list for a cultivator to whom nothing has happened and who
 * is doing nothing in particular, which is the ordinary case and the reason
 * most runs end with no insights at all.
 */
export function discoverableInsights(
    cultivator: Pick<Cultivator, 'spiritRoot'>,
    ctx: DiscoveryContext = {}
): InsightCandidate[] {
    const root = getSpiritRoot(cultivator.spiritRoot);
    const candidates: InsightCandidate[] = [];

    // Your own elements are always comprehensible to you, given the chance.
    for (const element of root.elements) {
        candidates.push({
            domain: 'element',
            subject: element,
            opening: `${root.name} channels ${element}`
        });
    }

    // The element of an art actually being practised, even a foreign one.
    if (ctx.techniqueElement && !root.elements.includes(ctx.techniqueElement)) {
        candidates.push({
            domain: 'element',
            subject: ctx.techniqueElement,
            opening: `practising a ${ctx.techniqueElement} art`
        });
    }

    // Crafts follow from what is actually being practised, never from a menu.
    for (const subject of ctx.techniqueSubjects ?? []) {
        candidates.push({
            domain: domainForSubject(subject),
            subject,
            opening: `years of practice at ${subject}`
        });
    }

    // Places open things. A forbidden river teaches water; a battlefield where
    // the craters are too regular teaches formations.
    for (const tag of ctx.locationTags ?? []) {
        const opened = LOCATION_OPENINGS[tag];
        if (opened) {
            candidates.push({ ...opened, opening: `the nature of this place (${tag})` });
        }
    }

    // Surviving something extraordinary opens what ordinary life does not.
    if (ctx.survived === 'tribulation') {
        candidates.push({
            domain: 'life_death',
            subject: 'mortality',
            opening: 'stood under heavenly lightning and was still standing after'
        });
        candidates.push({
            domain: 'void',
            subject: 'the seam',
            opening: 'saw the Lid discharge at close range'
        });
    }
    if (ctx.survived === 'deviation') {
        candidates.push({
            domain: 'body',
            subject: 'the meridians',
            opening: 'felt the qi turn and came back from it'
        });
    }
    if (ctx.survived === 'near_death') {
        candidates.push({
            domain: 'life_death',
            subject: 'mortality',
            opening: 'came close enough to see it'
        });
    }

    if (ctx.instruction) {
        candidates.push({
            domain: 'karma',
            subject: 'debt',
            opening: 'was taught by someone who did not have to'
        });
    }

    return dedupe(candidates);
}

/** Location tags that open a comprehension. Extended by content, not by rank. */
const LOCATION_OPENINGS: Record<string, { domain: InsightDomain; subject: string }> = {
    forbidden_river: { domain: 'element', subject: 'water' },
    ancient_battlefield: { domain: 'formation', subject: 'formation' },
    tribulation_scar: { domain: 'void', subject: 'the seam' },
    volcanic_vent: { domain: 'element', subject: 'fire' },
    old_forest: { domain: 'element', subject: 'wood' },
    deep_cave: { domain: 'element', subject: 'earth' },
    sealed_tomb: { domain: 'karma', subject: 'debt' },
    alchemy_hall: { domain: 'alchemy', subject: 'refinement' },
    sword_tomb: { domain: 'weapon', subject: 'sword' }
};

const SUBJECT_DOMAINS: Record<string, InsightDomain> = {
    sword: 'weapon',
    spear: 'weapon',
    blade: 'weapon',
    fist: 'body',
    body: 'body',
    formation: 'formation',
    refinement: 'alchemy',
    alchemy: 'alchemy'
};

function domainForSubject(subject: string): InsightDomain {
    return SUBJECT_DOMAINS[subject] ?? 'weapon';
}

function dedupe(candidates: InsightCandidate[]): InsightCandidate[] {
    const seen = new Set<string>();
    const out: InsightCandidate[] = [];
    for (const candidate of candidates) {
        const key = `${candidate.domain}:${candidate.subject}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(candidate);
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// ACHIEVEMENTS AND PROVENANCE
//
// The only way an insight comes into existence.
// ─────────────────────────────────────────────────────────────────────────

export interface AchievementInput {
    kind: AchievementKind;
    /** Absolute day the thing happened on. */
    onDay: number;
    turn: number;
    /** Engine-authored factual account of the event. */
    summary: string;
    /** Whatever specifics the event had. */
    detail?: Record<string, string | number>;
}

/**
 * Record that something remarkable actually happened.
 *
 * An achievement is a record of an EVENT, not a reward. Nothing in this engine
 * creates one on a schedule; every call site is a place where the simulation
 * had already resolved something out of the ordinary.
 */
export function recordAchievement(input: AchievementInput, rng: CultivationRNG): Achievement {
    return {
        id: rng.uuid(),
        kind: input.kind,
        onDay: Math.max(0, Math.floor(input.onDay)),
        turn: Math.max(0, Math.floor(input.turn)),
        summary: input.summary,
        detail: { ...(input.detail ?? {}) }
    };
}

/**
 * Form an insight from an achievement.
 *
 * The ONLY constructor, and it takes the achievement by value rather than by
 * id so a caller cannot invent a provenance that points at nothing. The
 * insight's id is derived from the achievement's, which makes an untraceable
 * insight not merely discouraged but unrepresentable: there is no id to give
 * it.
 */
export function formInsight(
    candidate: InsightCandidate,
    degree: InsightDegree,
    achievement: Achievement
): Insight {
    const provenance: InsightProvenance = {
        achievementId: achievement.id,
        achievementKind: achievement.kind,
        onDay: achievement.onDay,
        deepenedBy: [],
        account: `${achievement.summary} (${candidate.opening})`
    };
    return {
        id: `insight:${achievement.id}:${candidate.domain}:${candidate.subject}`,
        domain: candidate.domain,
        subject: candidate.subject,
        degree,
        provenance
    };
}

/**
 * Deepen an insight already held, keeping the WHOLE history legible.
 *
 * Comprehension does not restart at a higher degree; it goes further. So the
 * origin achievement stays put - it is what the insight's id is derived from,
 * and repointing it would sever the trace - and the later event is appended to
 * `deepenedBy` and to the account. A fifth-degree insight can still name every
 * event that built it, in order.
 */
export function deepenInsight(existing: Insight, achievement: Achievement): Insight {
    if (existing.degree >= MAX_DEGREE) return existing;
    const degree = (existing.degree + 1) as InsightDegree;
    return {
        ...existing,
        degree,
        provenance: {
            ...existing.provenance,
            deepenedBy: [...existing.provenance.deepenedBy, achievement.id],
            account: `${existing.provenance.account} Then: ${achievement.summary}`
        }
    };
}

/**
 * Add or deepen, whichever applies. The insight set is keyed by
 * (domain, subject), so a cultivator holds one comprehension of water that
 * grows rather than five shallow ones.
 */
export function integrateInsight(
    insights: readonly Insight[],
    candidate: InsightCandidate,
    achievement: Achievement
): { insights: Insight[]; insight: Insight; deepened: boolean } {
    const index = insights.findIndex(
        i => i.domain === candidate.domain && i.subject === candidate.subject
    );
    if (index === -1) {
        const insight = formInsight(candidate, 1, achievement);
        return { insights: [...insights, insight], insight, deepened: false };
    }
    const insight = deepenInsight(insights[index], achievement);
    const next = [...insights];
    next[index] = insight;
    return { insights: next, insight, deepened: insight.degree > insights[index].degree };
}

/**
 * Whether every insight in a set can say where it came from.
 *
 * Should be vacuously true for anything this module built. Exported so the
 * storage and tool layers can assert it at their own boundaries rather than
 * trusting that nothing upstream hand-rolled a row.
 */
export function isTraceable(insights: readonly Insight[]): boolean {
    return insights.every(
        i =>
            typeof i.provenance?.achievementId === 'string' &&
            i.provenance.achievementId.length > 0 &&
            // The structural lock: the id was DERIVED from the origin
            // achievement, so an insight whose provenance has been swapped out
            // no longer matches its own id and is caught here.
            i.id.includes(i.provenance.achievementId) &&
            i.provenance.account.length > 0 &&
            // Cannot claim more deepening events than degrees gained. Not an
            // equality: one overwhelming event can grant a deep first
            // comprehension outright - being taught something about water that
            // would have taken three centuries to find alone is a single
            // achievement, not four.
            i.provenance.deepenedBy.length <= i.degree - 1
    );
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

// -------------------------------------------------------------------------
// GENERATION RATES
//
// Deliberately tiny, and gated on circumstance rather than on a flat chance.
// The target is that MOST CULTIVATORS FINISH A RUN WITH NONE, and that a
// player who deliberately arranges good conditions for a decade has a real but
// uncertain shot at one. Nothing here fires because someone is due.
//
// Note there is no term for time served, no term for spirit stones, and no
// term for Fortune. The only attribute that appears is Insight, because
// comprehension is exactly what it measures.
// -------------------------------------------------------------------------

/**
 * Days between checks for a rare meditative state.
 *
 * Once a year. A shorter grid was tried and was wrong: twenty checks a decade
 * turned a deliberately-arranged decade into a coin flip, which made
 * understanding something a patient player accumulates rather than something
 * that happens to them.
 */
export const INSIGHT_CHECK_DAYS = 360;

/**
 * Days between checks for a temporal phenomenon. Two years, and deliberately
 * NOT a multiple of INSIGHT_CHECK_DAYS: coincident grids put a vision and a
 * comprehension on the same day of the digest over and over, which reads as
 * the vision having granted the insight. It never does, and the digest should
 * not keep implying it.
 */
export const VISION_CHECK_DAYS = 730;

/** Contribution to the meditative-state chance, by ambient qi density. */
export const INSIGHT_AMBIENT_CHANCE: Record<string, number> = {
    thin: 0,
    normal: 0,
    dense: 0.005,
    spirit_tide: 0.01
};
/** Practising an art the root actually channels deepens comprehension of it. */
export const INSIGHT_MATCHED_TECHNIQUE_CHANCE = 0.006;
/** Standing somewhere that has something to teach. */
export const INSIGHT_SITE_CHANCE = 0.012;
/** Per point of Insight above the pivot. Comprehension, not luck. */
export const INSIGHT_PER_COMPREHENSION = 0.006;
export const INSIGHT_COMPREHENSION_PIVOT = 2;

/** Chance a survived heavenly tribulation teaches something. */
export const INSIGHT_FROM_TRIBULATION = 0.25;
/** Chance a survived crippling qi deviation teaches something. */
export const INSIGHT_FROM_CRIPPLING_DEVIATION = 0.12;

/** Base chance of a temporal phenomenon, before circumstance. */
export const VISION_BASE_CHANCE = 0.004;
export const VISION_SITE_CHANCE = 0.01;

export interface MeditativeChanceInput {
    ambient: string;
    /** Practising an art whose element the root actually channels. */
    matchedTechnique: boolean;
    /** Standing somewhere with something to teach. */
    atSiteOfUnderstanding: boolean;
    insight: number;
}

export interface ChanceBreakdown {
    chance: number;
    terms: { source: string; delta: number }[];
}

/**
 * Chance that a check produces a rare meditative state.
 *
 * Zero for a cultivator sitting in ordinary qi practising nothing in
 * particular, which is most of them, most of the time. That zero is the
 * feature: understanding is not on a timer, and there is no term here that
 * time alone can advance.
 */
export function meditativeStateChance(input: MeditativeChanceInput): ChanceBreakdown {
    const terms: { source: string; delta: number }[] = [];

    const ambient = INSIGHT_AMBIENT_CHANCE[input.ambient] ?? 0;
    if (ambient > 0) terms.push({ source: 'ambient:' + input.ambient, delta: ambient });
    if (input.matchedTechnique) {
        terms.push({ source: 'matched_technique', delta: INSIGHT_MATCHED_TECHNIQUE_CHANCE });
    }
    if (input.atSiteOfUnderstanding) {
        terms.push({ source: 'site', delta: INSIGHT_SITE_CHANCE });
    }
    const comprehension = Math.max(0, input.insight - INSIGHT_COMPREHENSION_PIVOT);
    if (comprehension > 0) {
        terms.push({ source: 'insight', delta: comprehension * INSIGHT_PER_COMPREHENSION });
    }

    return { chance: terms.reduce((sum, t) => sum + t.delta, 0), terms };
}

/** Chance that a check produces a temporal phenomenon. */
export function visionChance(atSiteOfUnderstanding: boolean): number {
    return VISION_BASE_CHANCE + (atSiteOfUnderstanding ? VISION_SITE_CHANCE : 0);
}

// -------------------------------------------------------------------------
// TEMPORAL PHENOMENA
//
// Visions, echoes of a possible future, fragments of a previous incarnation,
// borrowed clarity about an unlearned technique.
//
// These grant INFORMATION, NEVER CAPABILITY, and so they are emphatically not
// modelled here as a buff. Nothing in this section touches a rate, an odds
// modifier or a substitution. What it produces is a belief with no ground
// truth behind it: a knowledge record whose matching fact does not exist and
// may never. The social layer's epistemics already separate what is true from
// what someone holds to be true, so a prophecy can be acted on, doubted,
// traded, and turn out to have been wrong all along, with nothing new built.
// -------------------------------------------------------------------------

export type VisionKind =
    | 'possible_future'
    | 'previous_incarnation'
    | 'path_not_walked'
    | 'borrowed_clarity';

export const VISION_KINDS: readonly VisionKind[] = [
    'possible_future', 'previous_incarnation', 'path_not_walked', 'borrowed_clarity'
] as const;

const VISION_STATEMENTS: Record<VisionKind, { claim: string; statement: string; tag: string }> = {
    possible_future: {
        claim: 'vision:possible_future',
        statement:
            'A moment that has not happened: a place, and something going wrong in it. ' +
            'It may be a warning. It may be true of only one possible future.',
        tag: 'prophecy'
    },
    previous_incarnation: {
        claim: 'vision:previous_incarnation',
        statement:
            'A fragment that does not belong to this life - a room, a name, a debt - ' +
            'held with the certainty of memory and no way at all to check it.',
        tag: 'incarnation'
    },
    path_not_walked: {
        claim: 'vision:path_not_walked',
        statement:
            'A glimpse of what this cultivation would have become on a road not taken. ' +
            'Instructive, and not necessarily true of anything.',
        tag: 'echo'
    },
    borrowed_clarity: {
        claim: 'vision:borrowed_clarity',
        statement:
            'A technique never learned, understood for a moment and then gone. ' +
            'What remains is the shape of it and the conviction that it exists.',
        tag: 'clarity'
    }
};

/**
 * Compile-time proof that a VisionSeed can be handed straight to the knowledge
 * layer's `recordKnowledge` with no adapter.
 *
 * This is the entire reason the type-only import at the top of the file
 * exists. If either shape drifts, this alias stops resolving to `true` and the
 * build says so - which is a great deal better than discovering at runtime
 * that visions cannot be filed. It costs nothing at runtime: both the import
 * and the alias are erased.
 */
export type VisionSeedFitsKnowledgeLayer = VisionSeed extends KnowledgeInput ? true : never;

/**
 * Produce one temporal phenomenon as a belief.
 *
 * Confidence is deliberately low and stored rather than computed: the
 * cultivator came away this sure, and nothing recalculates it behind them.
 */
export function formVision(
    holderId: string,
    kind: VisionKind,
    onDay: number,
    confidence: number
): VisionSeed {
    const template = VISION_STATEMENTS[kind];
    const day = Math.max(0, Math.floor(onDay));
    return {
        holderId,
        claimKey: template.claim + ':' + holderId + ':' + day,
        stance: 'believes',
        statement: template.statement,
        onDay: day,
        // Not witnessed, not told, not read. `divined` is the honest label for
        // something that arrived with no chain of custody at all.
        source: { kind: 'divined', note: 'temporal phenomenon (' + kind + ')' },
        // No fact. There is nothing behind this, and there may never be.
        factId: null,
        confidence: clamp01(confidence),
        tags: ['vision', template.tag, kind]
    };
}
