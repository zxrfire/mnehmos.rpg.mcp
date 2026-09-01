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
import { forStream, type CultivationRNG } from './rng.js';
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
    // Understanding substitutes for accumulation at a bottleneck. Above the Lid
    // there is no bottleneck and no accumulation, so there is nothing to stand
    // in for and no fraction of it to report.
    if (required === null) return { substituted: 0, fraction: 0, required: 0, contributing: [] };
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
// DISCOVERY, AND THE ACCESS THAT GATES IT
//
// You cannot comprehend what you have never been near.
//
// A Dao is not latent in a person waiting to be unlocked by effort. It needs
// something to comprehend FROM: a teacher who holds it and is willing, a
// manual the cultivator can actually read, a site or phenomenon or vein or
// scar, an artifact that carries it, a tradition that practises it at all, or
// an inheritance left by someone who had it.
//
// WITHOUT ACCESS, A DAO IS NOT HARDER. IT IS ABSENT. It never enters the
// candidate set, so it can never be rolled, and the cultivator never learns it
// was missing. This is a hard filter, not a modifier on the odds - which is
// the difference between a road not taken and a road that was never there.
//
// The structural enforcement mirrors insight provenance one level down: an
// InsightCandidate REQUIRES an AccessSource, so a candidate with nothing
// behind it cannot be constructed. Every source is built from real state the
// caller supplies - a sect membership, a manual on the shelf that this person
// can actually read, a tag on the ground they are standing on. The engine
// holds no map and no library.
//
// This is where most lives are actually decided. A cultivator in a thin
// province with no sect, no library and no living teacher has a genuinely
// narrow set, and EFFORT DOES NOT WIDEN IT: there is no term below that time
// or diligence can move. They can work two hundred years and remain unable to
// reach what a mediocre inner disciple got by walking into a room. It is also
// why the Late Age bites - every lost manual and every dead teacher is a Dao
// that has left the world, not merely a technique nobody can cast.
// ─────────────────────────────────────────────────────────────────────────

/** How a cultivator came to be near enough to comprehend something. */
export type AccessKind =
    | 'own_root'      // the shape of your own aperture. The one thing everyone has.
    | 'teacher'       // someone who holds it, and is willing
    | 'manual'        // a text this person can actually READ, not merely own
    | 'site'          // a place, a vein, a scar, a phenomenon standing still
    | 'phenomenon'    // a thing that happened in front of them
    | 'artifact'      // an object that carries it
    | 'tradition'     // a house that practises it, entered
    | 'inheritance';  // left behind by someone who had it

export interface AccessSource {
    kind: AccessKind;
    /** Id of the real row behind it, when there is one. */
    id?: string | null;
    /** Human-facing: "the Pavilion's inner library", "Elder Shu", "a forbidden river". */
    label: string;
}

export interface InsightCandidate {
    domain: InsightDomain;
    subject: string;
    /**
     * REQUIRED. What put this within reach. A candidate cannot be built
     * without one, which is what makes "absent, not harder" structural rather
     * than a rule someone has to remember.
     */
    access: AccessSource;
    /** Why this is on the table, composed from the access source. */
    opening: string;
}

/** An art this cultivator can actually read, or a teacher's specialism. */
export interface ExposureInput {
    /** What it is about, e.g. 'sword', 'formation'. */
    subject?: string | null;
    /** Element it is about, if any. */
    element?: Element | null;
    /** Named in provenance: "the Ninefold Pavilion library". */
    label: string;
    id?: string | null;
}

export interface DiscoveryContext {
    /**
     * Manuals this person can ACTUALLY READ - a much smaller set than the
     * manuals they own. An unreadable text grants nothing and is simply not
     * listed here.
     */
    readableManuals?: readonly ExposureInput[];
    /** Teachers who hold something and are willing to pass it on. */
    teachers?: readonly ExposureInput[];
    /** Artifacts carrying a comprehension. */
    artifacts?: readonly ExposureInput[];
    /** Inheritances opened. A sealed site can hold the last access to something. */
    inheritances?: readonly ExposureInput[];
    /**
     * The principle of a Dao house the cultivator is INSIDE. Not secret
     * because the words are hidden; inaccessible because standing where it can
     * be comprehended requires being let in, and they decide who comes in.
     */
    tradition?: ExposureInput | null;
    /**
     * Tags on where the cultivator is standing. Supplied by the caller from
     * real world state; the engine holds no map.
     */
    locationTags?: readonly string[];
    /** Something extraordinary happened in front of them. */
    survived?: 'tribulation' | 'deviation' | 'near_death' | null;

    /**
     * Convenience for the common case of an art being practised, which is
     * access by way of a manual the cultivator can evidently read.
     */
    techniqueSubjects?: readonly string[];
    techniqueElement?: Element | null;

    /**
     * The run seed. Supplying it turns SUITABILITY on: candidates that do not
     * fit this cultivator are dropped. Omit only where there is no run to seed
     * from - an odds harness, an NPC stub - and understand that omitting it
     * models a world in which everything fits everybody.
     */
    runSeed?: string;
    /**
     * Latent affinity, injected. Supplying it turns the prodigy path on: a
     * cultivator built for a thing is suited to it on first contact. Omitted
     * means ordinary fit only.
     */
    affinityOf?: AffinityResolver;
}

// ─────────────────────────────────────────────────────────────────────────
// SUITABILITY
//
// Access is necessary and it is NOT sufficient. A manual is not universally
// legible; a treasury is an opportunity, not a delivery. What a cultivator can
// take out of a room depends on what they already are, and most of what is in
// most rooms will never fit them.
//
// This is the mechanism that makes searching rational rather than decorative.
// If most things suited most people, a library would be a general solution and
// the right play would be to find the nearest one and stop. Because fit is
// personal and scarce, the manual, pill, inheritance or art that answers to
// YOUR root and YOUR comprehension is somewhere, and the odds of it being in
// the place you were born next to are small. So people go out looking - which
// is what ruins, sealed compounds, inheritance trials, the discovery ladder and
// the encounter system have all been waiting for a reason to be used.
//
// The library-and-treasury path - fully supplied, sitting still, climbing to
// the top - stays real and stays open. It is simply the province of somebody
// who happens to be perfectly suited to what that particular library holds,
// which is vanishingly rare and should be. A well-born cultivator is granted
// access to A library, never to THEIR library, which is exactly why the birth
// axis is loud at the opening and quiet in the outcome.
//
// ── What is always suited, and why it must be ────────────────────────────
//
//   own_root     you are always suited to your own aperture. Anything else
//                breaks the game at ordinal 0.
//   phenomenon   it happened TO you. A cultivator who came back from a
//                deviation felt the circulation turn whether or not the
//                subject was ever going to suit them.
//
// ── What is drawn ────────────────────────────────────────────────────────
//
// Everything reached through a manual, teacher, artifact, inheritance,
// tradition or site, at SUITABILITY_BASE - unless the cultivator already holds
// a comprehension in that domain, in which case they have a foothold on that
// road and can keep walking it. Without that clause, progress along a road
// would be a fresh coin flip every time and understanding would be noise
// rather than a road at all.
//
// The draw is seeded on (cultivator, domain, subject) and never on the day, so
// re-reading a manual gives the same answer forever. A thing that does not fit
// you does not start fitting you because you tried again, and a player must be
// able to learn that by trying twice.
//
// ── A miss is stated, never silent ───────────────────────────────────────
//
// `assessAccess` returns what did NOT fit alongside what did, with the reason
// attached, so a caller can say "you read it through twice and it stayed a
// list of somebody else's conclusions" rather than reporting nothing at all. A
// silent miss teaches a player to sit longer, which is the exact opposite of
// the lesson.
// ─────────────────────────────────────────────────────────────────────────

/** Access kinds that are suited by their nature and are never drawn for. */
const ALWAYS_SUITED: readonly AccessKind[] = ['own_root', 'phenomenon'];

/**
 * Chance an unrelated thing turns out to fit a cultivator who has no foothold
 * on that road.
 *
 * 0.2 - so a room of five unrelated manuals yields about one that means
 * anything, and a life turns on finding one or two things rather than on
 * finding a shelf. Low enough that a cultivator can be rich, well-placed and
 * still stuck because the fit was never there; high enough that going out to
 * look is a rational plan rather than a lottery.
 */
export const SUITABILITY_BASE = 0.2;

/**
 * Latent predisposition toward one comprehension, injected by the caller.
 *
 * Returns 's AffinityDegree. Typed structurally rather than imported
 * so this module keeps its one-way dependency on dao.ts.
 */
export type AffinityResolver =
    (target: { domain: InsightDomain; subject: string }) => 'none' | 'aptitude' | 'strong' | 'extraordinary';

export interface SuitabilityVerdict {
    suited: boolean;
    /** Engine-authored factual reason. Never narration. */
    why: string;
}

/**
 * Whether this cultivator can take anything out of this particular opening.
 *
 * Deterministic in (runSeed, cultivator, domain, subject). Pure.
 */
export function insightSuitability(
    cultivator: Pick<Cultivator, 'spiritRoot'> & Partial<Pick<Cultivator, 'id' | 'insights'>>,
    candidate: InsightCandidate,
    runSeed: string,
    affinityOf?: AffinityResolver
): SuitabilityVerdict {
    if (ALWAYS_SUITED.includes(candidate.access.kind)) {
        return { suited: true, why: 'it is your own, or it happened to you' };
    }

    const root = getSpiritRoot(cultivator.spiritRoot);
    if (candidate.domain === 'element' && root.elements.includes(candidate.subject as never)) {
        return { suited: true, why: `a ${root.name} is built to hold ${candidate.subject}` };
    }

    const holdsRoad = (cultivator.insights ?? []).some(i => i.domain === candidate.domain);
    if (holdsRoad) {
        return { suited: true, why: `already walking the ${candidate.domain} road` };
    }

    // Latent affinity IS fit, and this is the prodigy path: somebody who turns
    // out to have been built for a thing is suited to it the moment they are
    // let near it. It is what makes "supplied, sitting still, climbing to the
    // top" a real road for the rare person perfectly matched to the particular
    // library they got into.
    //
    // Note the boundary this respects. `affinityFor` carries a standing
    // instruction not to decide what a cultivator can REACH, and it still does
    // not: access was settled above, by the room. This asks only whether what
    // is already in reach fits, which is the question affinity answers.
    //
    // INJECTED rather than imported: `dao.ts` value-imports `isUniversalDomain`
    // from this module, so reaching back for `affinityFor` would close a
    // runtime cycle. `time-skip.ts` imports both and supplies it.
    if (affinityOf) {
        const affinity = affinityOf({ domain: candidate.domain, subject: candidate.subject });
        if (affinity === 'strong' || affinity === 'extraordinary') {
            return { suited: true, why: `an ${affinity} affinity for ${candidate.subject}` };
        }
    }

    const draw = forStream(
        runSeed, 'suitability', cultivator.id ?? 'anonymous', candidate.domain, candidate.subject
    ).next();
    return draw < SUITABILITY_BASE
        ? { suited: true, why: 'it happens to fit' }
        : {
            suited: false,
            why: `nothing in ${cultivator.spiritRoot} answers to ${candidate.subject}, ` +
                'and there is no foothold on that road to read it from'
        };
}

export interface AccessAssessment {
    /** In reach AND suited. What `discoverableInsights` returns. */
    suited: InsightCandidate[];
    /** In reach and NOT suited. The half that must be said out loud. */
    unsuited: (InsightCandidate & { why: string })[];
}

/**
 * Everything in reach, split by whether it fits.
 *
 * The legible form. Callers that want to tell a player why the manual on their
 * knee is doing nothing use this; callers that only need the usable list use
 * `discoverableInsights`.
 */
export function assessAccess(
    cultivator: Pick<Cultivator, 'spiritRoot'> & Partial<Pick<Cultivator, 'id' | 'insights'>>,
    ctx: DiscoveryContext,
    runSeed: string
): AccessAssessment {
    const affinityOf = ctx.affinityOf;
    const suited: InsightCandidate[] = [];
    const unsuited: (InsightCandidate & { why: string })[] = [];
    for (const candidate of discoverableInsights(cultivator, { ...ctx, runSeed: undefined })) {
        const verdict = insightSuitability(cultivator, candidate, runSeed, affinityOf);
        if (verdict.suited) suited.push(candidate);
        else unsuited.push({ ...candidate, why: verdict.why });
    }
    return { suited, unsuited };
}

/**
 * Everything this cultivator is near enough to comprehend.
 *
 * Every entry names the source that put it within reach. An empty-ish result
 * is the ordinary case and the honest one: a hermit with no library, no
 * teacher and nothing remarkable underfoot can reach their own root and
 * nothing else, however long they sit.
 *
 * When `ctx.runSeed` is supplied the list is also filtered by SUITABILITY -
 * see the banner above. Without it nothing is filtered, which is the old
 * behaviour and the right answer for a caller with no run to seed from
 * (odds harnesses, NPC stubs). Anything resolving a real cultivator's real
 * turn should pass it.
 */
export function discoverableInsights(
    cultivator: Pick<Cultivator, 'spiritRoot'> & Partial<Pick<Cultivator, 'id' | 'insights'>>,
    ctx: DiscoveryContext = {}
): InsightCandidate[] {
    const root = getSpiritRoot(cultivator.spiritRoot);
    const candidates: InsightCandidate[] = [];

    const add = (
        domain: InsightDomain,
        subject: string,
        access: AccessSource,
        opening: string
    ): void => {
        candidates.push({ domain, subject, access, opening });
    };

    // The one access everyone is born with: the shape of their own aperture.
    // It is also the whole of what an isolated cultivator can reach.
    for (const element of root.elements) {
        add('element', element, { kind: 'own_root', label: root.name },
            `${root.name} channels ${element}`);
    }

    // Manuals that can actually be read, including whatever is being practised.
    for (const manual of ctx.readableManuals ?? []) {
        exposureCandidates(manual, 'manual', add);
    }
    for (const subject of ctx.techniqueSubjects ?? []) {
        add(domainForSubject(subject), subject,
            { kind: 'manual', label: `a text on ${subject}` },
            `years of practice at ${subject}`);
    }
    if (ctx.techniqueElement && !root.elements.includes(ctx.techniqueElement)) {
        add('element', ctx.techniqueElement,
            { kind: 'manual', label: `a ${ctx.techniqueElement} art` },
            `practising a ${ctx.techniqueElement} art`);
    }

    // A teacher who holds it and is willing. The scarcest source in the Late Age.
    for (const teacher of ctx.teachers ?? []) {
        exposureCandidates(teacher, 'teacher', add);
    }
    for (const artifact of ctx.artifacts ?? []) {
        exposureCandidates(artifact, 'artifact', add);
    }
    for (const inheritance of ctx.inheritances ?? []) {
        exposureCandidates(inheritance, 'inheritance', add);
    }

    // A house's principle, reachable only from inside the house.
    if (ctx.tradition) {
        exposureCandidates(ctx.tradition, 'tradition', add);
    }

    // Places. A forbidden river teaches water; a battlefield where the craters
    // are too regular teaches formations.
    for (const tag of ctx.locationTags ?? []) {
        const opened = LOCATION_OPENINGS[tag];
        if (opened) {
            add(opened.domain, opened.subject,
                { kind: 'site', id: tag, label: describeSite(tag) },
                `the nature of this place (${tag})`);
        }
    }

    // Something that happened in front of them. Access by having been there.
    if (ctx.survived === 'tribulation') {
        const access: AccessSource = { kind: 'phenomenon', label: 'heavenly tribulation' };
        add('life_death', 'mortality', access,
            'stood under heavenly lightning and was still standing after');
        add('void', 'the seam', access, 'saw the Lid discharge at close range');
    }
    if (ctx.survived === 'deviation') {
        add('body', 'the meridians', { kind: 'phenomenon', label: 'qi deviation' },
            'felt the qi turn and came back from it');
    }
    if (ctx.survived === 'near_death') {
        add('life_death', 'mortality', { kind: 'phenomenon', label: 'a near death' },
            'came close enough to see it');
    }

    const reachable = dedupe(candidates);
    // Access, then fit. Everything above decided what is in the room; this
    // decides what this particular person can take out of it. See the
    // SUITABILITY banner.
    if (ctx.runSeed === undefined) return reachable;
    return reachable.filter(
        candidate => insightSuitability(cultivator, candidate, ctx.runSeed!, ctx.affinityOf).suited
    );
}

/** Turn one exposure into whatever it puts within reach. */
function exposureCandidates(
    exposure: ExposureInput,
    kind: AccessKind,
    add: (domain: InsightDomain, subject: string, access: AccessSource, opening: string) => void
): void {
    const access: AccessSource = { kind, id: exposure.id ?? null, label: exposure.label };
    const opening = ACCESS_PHRASES[kind](exposure.label);
    if (exposure.subject) {
        add(domainForSubject(exposure.subject), exposure.subject, access, opening);
    }
    if (exposure.element) {
        add('element', exposure.element, access, opening);
    }
}

const ACCESS_PHRASES: Record<AccessKind, (label: string) => string> = {
    own_root: label => `${label} is what they were born with`,
    teacher: label => `taught by ${label}`,
    manual: label => `read in ${label}`,
    site: label => `comprehended at ${label}`,
    phenomenon: label => `witnessed ${label} at close range`,
    artifact: label => `carried in ${label}`,
    tradition: label => `standing inside ${label}`,
    inheritance: label => `left behind in ${label}`
};

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

function describeSite(tag: string): string {
    return tag.replace(/_/g, ' ');
}

const SUBJECT_DOMAINS: Record<string, InsightDomain> = {
    sword: 'weapon',
    spear: 'weapon',
    blade: 'weapon',
    fist: 'body',
    body: 'body',
    formation: 'formation',
    refinement: 'alchemy',
    alchemy: 'alchemy',
    mortality: 'life_death',
    debt: 'karma'
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

/**
 * Whether a cultivator can reach a given comprehension at all.
 *
 * The predicate behind "absent, not harder". Exported so the sect, ruin and
 * tool layers can answer "would joining this house put anything new within
 * reach" without duplicating the derivation - which is, mechanically, the
 * thing a sect is actually selling.
 */
export function hasAccessTo(
    cultivator: Pick<Cultivator, 'spiritRoot'>,
    target: { domain: InsightDomain; subject: string },
    ctx: DiscoveryContext = {}
): AccessSource | null {
    const match = discoverableInsights(cultivator, ctx).find(
        c => c.domain === target.domain && c.subject === target.subject
    );
    return match ? match.access : null;
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
        // The access source is named, not just the event: "comprehended in the
        // Pavilion's inner library" is provenance a reader can act on, where
        // "comprehended" is not.
        //
        // Read defensively. `access` is required on InsightCandidate, which is
        // the compile-time guarantee that generation cannot skip it, but this
        // constructor is shared and a hand-built candidate from a test or an
        // older call site should produce a slightly poorer account rather than
        // throwing. The hard requirement here is the ACHIEVEMENT; access is
        // the gate on which candidates exist at all, enforced upstream.
        account:
            `${achievement.summary} (${candidate.opening}` +
            (candidate.access
                ? `; access: ${candidate.access.kind} - ${candidate.access.label})`
                : ')')
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
