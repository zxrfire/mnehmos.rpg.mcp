/**
 * Capability: five questions, never a gate.
 */

import { MAX_ORDINAL, clampOrdinal, rankName } from '../cultivation/realms.js';
import type { InnateAttributes } from '../cultivation/spirit-roots.js';
import {
    environmentalCompatibility,
    isOpenOn,
    type ActorEnvironmentProfile,
    type LocationRecord,
    type ThresholdModifier
} from './locations.js';
import {
    passageStoppedInArea,
    type AreaStatus
} from './what-is-true-of-a-place-right-now.js';

// ─────────────────────────────────────────────────────────────────────────
// PREDICATES
// ─────────────────────────────────────────────────────────────────────────

export type CapabilityPredicate = 'attempt' | 'survive' | 'succeed' | 'understand' | 'force';

export const CAPABILITY_PREDICATES: readonly CapabilityPredicate[] = [
    'attempt', 'survive', 'succeed', 'understand', 'force'
] as const;

// -------------------------------------------------------------------------
// REALM CAPABILITY CLASSES
// -------------------------------------------------------------------------

/**
 * A realm is a capability class, not a damage multiplier.
 */
export type RealmCapabilityClass =
    | 'mortal'
    | 'core'
    | 'nascent_soul'
    | 'deity'
    | 'void'
    | 'body_integration'
    | 'grand_ascension'
    | 'tribulation';

/**
 * A specific thing a realm makes possible.
 */
export type CapabilityGrant =
    /** Nascent Soul: the soul persists without the body. */
    | 'soul_persists'
    /** Nascent Soul: can enter places that kill the body - if the soul has somewhere to go. */
    | 'prepared_vessel'
    /** Deity Transformation: carries its own ambient conditions; thin ground stops mattering. */
    | 'carries_own_ambient'
    /** Deity Transformation: presence alone suppresses lesser cultivators. */
    | 'suppresses_lesser'
    /**
     * Void Refinement: needs no ambient qi at all.
     */
    | 'no_ambient_needed'
    /** Void Refinement: dead zones, scars and voids become survivable. */
    | 'enters_dead_zones'
    /**
     * Void Refinement: folding space rather than crossing it.
     */
    | 'spatial_folding'
    /** Void Refinement: reads regional formation structure whole. */
    | 'reads_formations'
    /** Body Integration: no seam between body and soul to attack. */
    | 'no_seam'
    /** Body Integration: contamination, corruption and forbidden ground stop being hazards. */
    | 'immune_contamination'
    /** Grand Ascension: no longer gated by places; gates places instead. */
    | 'gates_places'
    /** Grand Ascension: makes and unmakes spiritual veins. */
    | 'makes_veins'
    /** Grand Ascension: seals and unseals domains. */
    | 'seals_domains'
    /** Grand Ascension: perceives the seams of the Lid directly. */
    | 'reads_lid'
    /** Tribulation Transcendence: opens the Lid partially, which is what a portal is. */
    | 'opens_lid';

/** First ordinal of each class. Mirrors the realm ladder in `realms.ts`. */
const CLASS_FLOOR: readonly { ordinal: number; klass: RealmCapabilityClass }[] = [
    { ordinal: 41, klass: 'tribulation' },
    { ordinal: 37, klass: 'grand_ascension' },
    { ordinal: 33, klass: 'body_integration' },
    { ordinal: 29, klass: 'void' },
    { ordinal: 25, klass: 'deity' },
    { ordinal: 21, klass: 'nascent_soul' },
    { ordinal: 17, klass: 'core' },
    { ordinal: 0, klass: 'mortal' }
];

export function realmClassForOrdinal(ordinal: number): RealmCapabilityClass {
    const o = clampOrdinal(ordinal);
    for (const row of CLASS_FLOOR) if (o >= row.ordinal) return row.klass;
    return 'mortal';
}

/** Grants each class adds. Cumulative upward: a class inherits what is below it. */
const CLASS_GRANTS: Record<RealmCapabilityClass, CapabilityGrant[]> = {
    mortal: [],
    core: [],
    nascent_soul: ['soul_persists', 'prepared_vessel'],
    deity: ['carries_own_ambient', 'suppresses_lesser'],
    void: ['no_ambient_needed', 'enters_dead_zones', 'spatial_folding', 'reads_formations'],
    body_integration: ['no_seam', 'immune_contamination'],
    grand_ascension: ['gates_places', 'makes_veins', 'seals_domains', 'reads_lid'],
    tribulation: ['opens_lid']
};

const CLASS_ORDER: readonly RealmCapabilityClass[] = [
    'mortal', 'core', 'nascent_soul', 'deity', 'void',
    'body_integration', 'grand_ascension', 'tribulation'
];

/**
 * Everything this realm makes possible, cumulatively.
 *
 * The list of what a cultivator at this rank COULD hold. It is never the list
 * of what they do hold - see {@link heldGrants}.
 */
export function grantsAvailableAt(ordinal: number): CapabilityGrant[] {
    const klass = realmClassForOrdinal(ordinal);
    const upto = CLASS_ORDER.indexOf(klass);
    const out: CapabilityGrant[] = [];
    for (let i = 0; i <= upto; i++) out.push(...CLASS_GRANTS[CLASS_ORDER[i]]);
    return out;
}

export function isGrantAvailableAt(ordinal: number, grant: CapabilityGrant): boolean {
    return grantsAvailableAt(ordinal).includes(grant);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT REACHING A REALM ACTUALLY HANDS SOMEBODY
//
// REALM CAPABILITY IS ENFORCED, NOT ASSERTED. That is the ruling this block
// exists to serve, and it was in question: `heldGrants` was empty for every
// cultivator in the game, so all fifteen grants were unreachable and every
// consumer downstream of them was off. A capability with no consumer is not
// finished, and a capability nobody can hold is not a capability.
//
// The distinction the original design was built on is kept, because it is
// right: a realm confers POTENTIAL, and a few capabilities still have to be
// ARRANGED rather than simply given. Being at home in ice is conferred. A
// prepared vessel is not - it is an actual vessel, somewhere, that somebody
// went and readied.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Grants that reaching the realm does NOT hand over.
 */
export const ARRANGED_GRANTS: readonly CapabilityGrant[] = ['prepared_vessel'];

/**
 * Grants a cultivator holds by having reached this rung.
 *
 * What `capabilityActorFor` should hand the capability layer, as against
 * `grantsAvailableAt`, which is the wider "what is possible here at all".
 */
export function grantsConferredAt(ordinal: number): CapabilityGrant[] {
    return grantsAvailableAt(ordinal).filter(g => !ARRANGED_GRANTS.includes(g));
}

/**
 * What each structural break takes back, by wound key.
 */
export const GRANTS_DENIED_BY_BREAK: Readonly<Record<string, readonly CapabilityGrant[]>> = {
    // "it cannot survive very long outside the body." The soul is real and
    // crippled, so what the realm was for - persisting without the body - is
    // what it cannot do. `prepared_vessel` goes with it: a soul in this state
    // has nothing to send.
    'crippled-nascent-soul': ['soul_persists', 'prepared_vessel'],

    // "perhaps it doesn't carry its own conditions everywhere like other
    // deities do, but it has to channel it for a limited time before it burns
    // out." So the one thing a Deity is - a body that brings its conditions
    // with it, continuously and in every direction - is exactly what this one
    // does not have. The range, duration and coverage it keeps instead are not
    // expressible as a boolean and are documented rather than faked.
    'failed-transformation': ['carries_own_ambient', 'suppresses_lesser'],

    // "doesn't allow spatial folding ... also they still need ambient qi, but
    // A LOT less." Two denials and one deliberate keep: `enters_dead_zones`
    // stays, because they do survive the weak scars and voids - just not the
    // ones a whole refinement walks into. That degradation is real and this
    // layer cannot say it.
    'partial-refinement': ['spatial_folding', 'no_ambient_needed'],

    // "there is still a seam and a soul to attack. but a lot of it IS
    // stitched." So `no_seam` goes and `immune_contamination` stays, and the
    // second half matters as much as the first: this is an impairment among
    // the great, not a demotion to the realm below.
    'failed-integration': ['no_seam'],

    // "they can still do it, but their abilities burn out a lot sooner."
    // `gates_places` is a continuous, permanent property - not being gated by
    // places, ever - and that is precisely what somebody who burns out cannot
    // hold.
    'unfulfilled-ascension': ['gates_places']

    // NOT LISTED, and each absence is deliberate:
    //
    // 'imperfect-tribulation-body' - what it loses is the adaptive elemental
    //   defence, which lives in damage resolution and not in a grant. There is
    //   no grant here to take, and inventing one to have something to remove
    //   would be the declared-and-inert defect all over again.
    // 'broken-foundation', 'cracked-core' - both sit below Nascent Soul, where
    //   no grants exist to deny. The road closing IS their whole cost.
};

/**
 * The grants this cultivator actually holds: what the rung confers, less what their
 * breaks have taken back.
 */
export function grantsHeldWith(
    ordinal: number,
    brokenStatusKeys: readonly string[] = []
): CapabilityGrant[] {
    if (brokenStatusKeys.length === 0) return grantsConferredAt(ordinal);
    const denied = new Set<CapabilityGrant>();
    for (const key of brokenStatusKeys) {
        for (const g of GRANTS_DENIED_BY_BREAK[key] ?? []) denied.add(g);
    }
    return grantsConferredAt(ordinal).filter(g => !denied.has(g));
}

/**
 * Hazards each grant makes irrelevant.
 */
const GRANT_NEUTRALISES: Partial<Record<CapabilityGrant, readonly string[]>> = {
    prepared_vessel: ['body_lethal', 'crushing', 'pressure'],
    carries_own_ambient: ['thin_qi'],
    no_ambient_needed: ['thin_qi', 'dead_zone', 'void', 'sealed_qi'],
    enters_dead_zones: ['thin_qi', 'dead_zone', 'void', 'scar'],
    no_seam: ['soul_pressure', 'soul_suppression'],
    immune_contamination: ['corrosive', 'contaminated', 'corrupted', 'poison', 'plague', 'forbidden']
};

/** Ordinals of survival relief per hazard a grant neutralises. */
export const NEUTRALISED_HAZARD_RELIEF = 5;

/**
 * What this cultivator actually has.
 */
export function heldGrants(actor: CapabilityActor): CapabilityGrant[] {
    const available = new Set(grantsAvailableAt(actor.realmOrdinal));
    return (actor.heldGrants ?? []).filter(g => available.has(g));
}

/** Why a grant is not in force: never reached, or reached and never acquired. */
export function grantStatus(
    actor: CapabilityActor,
    grant: CapabilityGrant
): 'held' | 'available_not_held' | 'out_of_reach' {
    if (!isGrantAvailableAt(actor.realmOrdinal, grant)) return 'out_of_reach';
    return (actor.heldGrants ?? []).includes(grant) ? 'held' : 'available_not_held';
}

/**
 * Hazards this actor's grants make irrelevant, and which grant did it.
 */
export function neutralisedHazards(
    actor: CapabilityActor,
    hazards: readonly string[]
): { hazard: string; grant: CapabilityGrant }[] {
    const held = heldGrants(actor);
    const out: { hazard: string; grant: CapabilityGrant }[] = [];
    for (const hazard of hazards) {
        for (const grant of held) {
            if ((GRANT_NEUTRALISES[grant] ?? []).includes(hazard)) {
                out.push({ hazard, grant });
                break;
            }
        }
    }
    return out;
}

/**
 * What each predicate costs, in realm ordinals.
 */
export type CapabilityRequirements = Record<CapabilityPredicate, number>;

export function makeRequirements(init: Partial<CapabilityRequirements> = {}): CapabilityRequirements {
    return {
        attempt: clampOrdinal(init.attempt ?? 0),
        survive: clampOrdinal(init.survive ?? 0),
        succeed: clampOrdinal(init.succeed ?? 0),
        understand: clampOrdinal(init.understand ?? 0),
        force: clampOrdinal(init.force ?? 0)
    };
}

export type CapabilityModifierSource =
    | 'technique'
    | 'artifact'
    | 'physique'
    | 'spirit_root'
    | 'knowledge'
    | 'formation'
    | 'pill'
    | 'ally'
    | 'faction'
    | 'bloodline'
    | 'preparation'
    | 'environment';

/**
 * Something the actor has that changes one or more predicates.
 */
export interface CapabilityModifier {
    id: string;
    source: CapabilityModifierSource;
    sourceId: string;
    label: string;
    offsets: Partial<Record<CapabilityPredicate, number>>;
    /** Applies only where one of these hazards is present. Empty = anywhere. */
    hazards: string[];
    /** Applies only against these subjects (location ids, opponent ids). Empty = any. */
    subjectIds: string[];
    /** Applies only where the subject carries one of these tags. Empty = any. */
    subjectTags: string[];
    note: string;
}

export function makeCapabilityModifier(
    init: Partial<CapabilityModifier> &
        Pick<CapabilityModifier, 'id' | 'source' | 'sourceId' | 'offsets'>
): CapabilityModifier {
    return {
        label: init.label ?? init.sourceId,
        hazards: init.hazards ?? [],
        subjectIds: init.subjectIds ?? [],
        subjectTags: init.subjectTags ?? [],
        note: init.note ?? '',
        ...init
    };
}

/**
 * Adapter for the location layer's threshold modifiers.
 */
export function fromThresholdModifier(mod: ThresholdModifier): CapabilityModifier {
    return {
        id: mod.id,
        source: mod.source as CapabilityModifierSource,
        sourceId: mod.sourceId,
        label: mod.label,
        offsets: {
            attempt: mod.offsets.entry,
            survive: mod.offsets.survival,
            succeed: mod.offsets.operational,
            force: mod.offsets.mastery
        },
        hazards: mod.hazards.slice(),
        subjectIds: mod.locationIds.slice(),
        subjectTags: [],
        note: mod.note
    };
}

// ─────────────────────────────────────────────────────────────────────────
// SUBJECT AND ACTOR
// ─────────────────────────────────────────────────────────────────────────

export type CapabilitySubjectKind =
    | 'location'
    | 'inscription'
    | 'artifact'
    | 'opponent'
    | 'formation'
    | 'action';

/**
 * What is being attempted, expressed as requirements plus the physical facts
 * that can stop an attempt before it starts.
 */
export interface CapabilitySubject {
    kind: CapabilitySubjectKind;
    id: string;
    name: string;
    requirements: CapabilityRequirements;
    /** Hazards present, for gating hazard-specific modifiers. */
    hazards: string[];
    tags: string[];
    /** Physically shut. `attempt` fails unless the actor holds `keyId`. */
    sealed: boolean;
    keyId: string | null;
    /** Shut for reasons of timing rather than power. */
    windowClosed: boolean;
    /**
     * Knowledge that makes the thing legible. An actor holding any of these
     * reads it regardless of realm - which is how a scholar with the right
     * notes outperforms a cultivator four realms above them.
     */
    comprehensionKeys: string[];
}

export function makeSubject(
    init: Partial<CapabilitySubject> & Pick<CapabilitySubject, 'kind' | 'id' | 'name' | 'requirements'>
): CapabilitySubject {
    return {
        hazards: [],
        tags: [],
        sealed: false,
        keyId: null,
        windowClosed: false,
        comprehensionKeys: [],
        ...init
    };
}

export interface CapabilityActor {
    id: string;
    realmOrdinal: number;
    /** Insight helps understanding; Might helps forcing. Both optional. */
    attributes?: Partial<InnateAttributes>;
    modifiers?: readonly CapabilityModifier[];
    /** Specialties and vulnerabilities, for environmental compatibility. */
    profile?: ActorEnvironmentProfile;
    keyIds?: readonly string[];
    /** Manuals read, doors translated, rumours confirmed. */
    knowledgeIds?: readonly string[];
    /**
     * Realm-class capabilities this cultivator has actually acquired.
     */
    heldGrants?: readonly CapabilityGrant[];
    /** False when they are not there. An absent actor cannot attempt anything. */
    present?: boolean;
    alive?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// VERDICTS
// ─────────────────────────────────────────────────────────────────────────

export interface AppliedCapabilityModifier {
    modifierId: string;
    label: string;
    predicate: CapabilityPredicate;
    /** Ordinals removed from the requirement. Negative made it harder. */
    offset: number;
    via: string | null;
}

/**
 * A qualitative answer, because the narrator needs one.
 */
export type Likelihood = 'certain' | 'likely' | 'even' | 'unlikely' | 'impossible';

export interface PredicateVerdict {
    predicate: CapabilityPredicate;
    holds: boolean;
    /** The qualitative answer. What the narrator reads. */
    likelihood: Likelihood;
    /** Hazards present that nothing the actor holds addresses. */
    unhandledHazards: string[];
    /** Hazards the actor's realm-class grants make irrelevant, and which grant. */
    neutralised: { hazard: string; grant: CapabilityGrant }[];
    /** Requirement as stored, before anything the actor brings. */
    baseRequirement: number;
    /** Requirement after modifiers. What the comparison actually used. */
    requirement: number;
    /** What the actor brought, in ordinals. */
    standing: number;
    /** standing minus requirement. Negative is the shortfall. */
    margin: number;
    applied: AppliedCapabilityModifier[];
    /**
     * Non-power reasons this fails: a seal, a shut window, being absent. Only
     * `attempt` normally carries these, and only these can refuse an attempt.
     */
    blockers: string[];
    reason: string;
}

export interface CapabilityAssessment {
    actorId: string;
    subject: { kind: CapabilitySubjectKind; id: string; name: string };
    onDay: number | null;
    attempt: PredicateVerdict;
    survive: PredicateVerdict;
    succeed: PredicateVerdict;
    understand: PredicateVerdict;
    force: PredicateVerdict;
    /** Effectiveness multiplier from environmental compatibility, if any. */
    environmentMultiplier: number;
    /** One line the narrator can read straight out. Never a yes or a no. */
    summary: string;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ASSESSMENT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Answer all five questions.
 */
export function assessCapability(
    actor: CapabilityActor,
    subject: CapabilitySubject,
    onDay: number | null = null
): CapabilityAssessment {
    const modifiers = (actor.modifiers ?? []).filter(m => modifierApplies(m, subject));
    const env = actor.profile
        ? environmentalCompatibilityForSubject(subject, actor.profile)
        : { multiplier: 1, thresholdOffset: 0, tags: [] as string[] };

    const attemptBlockers = physicalBlockers(actor, subject);

    const verdicts = {} as Record<CapabilityPredicate, PredicateVerdict>;
    for (const predicate of CAPABILITY_PREDICATES) {
        verdicts[predicate] = judge(actor, subject, predicate, modifiers, env, attemptBlockers);
    }

    return {
        actorId: actor.id,
        subject: { kind: subject.kind, id: subject.id, name: subject.name },
        onDay,
        attempt: verdicts.attempt,
        survive: verdicts.survive,
        succeed: verdicts.succeed,
        understand: verdicts.understand,
        force: verdicts.force,
        environmentMultiplier: env.multiplier,
        summary: summarise(subject, verdicts)
    };
}

/**
 * Reasons the attempt cannot physically begin.
 */
function physicalBlockers(actor: CapabilityActor, subject: CapabilitySubject): string[] {
    const blockers: string[] = [];
    if (actor.alive === false) blockers.push('The actor is dead.');
    if (actor.present === false) blockers.push('The actor is not there.');
    if (subject.windowClosed) blockers.push(`${subject.name} is not open at this time.`);
    if (subject.sealed) {
        const key = subject.keyId;
        const held = key != null && (actor.keyIds ?? []).includes(key);
        if (!held) {
            blockers.push(
                key != null
                    ? `${subject.name} is sealed and the actor does not hold ${key}.`
                    : `${subject.name} is sealed.`
            );
        }
    }
    return blockers;
}

interface EnvContribution {
    multiplier: number;
    thresholdOffset: number;
    tags: string[];
}

function environmentalCompatibilityForSubject(
    subject: CapabilitySubject,
    profile: ActorEnvironmentProfile
): EnvContribution {
    // Reuse the location layer's affinity arithmetic by presenting the subject
    // as a minimal location-shaped object. Affinity is carried on the subject's
    // hazards and tags when the subject is not itself a location.
    const affinities = (subject as unknown as { affinities?: LocationRecord['affinities'] }).affinities;
    if (!affinities || affinities.length === 0) return { multiplier: 1, thresholdOffset: 0, tags: [] };
    const compat = environmentalCompatibility(
        { affinities } as unknown as LocationRecord,
        profile
    );
    return {
        multiplier: compat.multiplier,
        thresholdOffset: compat.thresholdOffset,
        tags: compat.matched.map(m => m.tag)
    };
}

function modifierApplies(mod: CapabilityModifier, subject: CapabilitySubject): boolean {
    if (mod.subjectIds.length > 0 && !mod.subjectIds.includes(subject.id)) return false;
    if (mod.subjectTags.length > 0 && !mod.subjectTags.some(t => subject.tags.includes(t))) return false;
    if (mod.hazards.length > 0 && !mod.hazards.some(h => subject.hazards.includes(h))) return false;
    return true;
}

function judge(
    actor: CapabilityActor,
    subject: CapabilitySubject,
    predicate: CapabilityPredicate,
    modifiers: readonly CapabilityModifier[],
    env: EnvContribution,
    attemptBlockers: readonly string[]
): PredicateVerdict {
    const base = subject.requirements[predicate];
    let requirement = base;
    const applied: AppliedCapabilityModifier[] = [];

    for (const mod of modifiers) {
        const offset = mod.offsets[predicate];
        if (offset === undefined || offset === 0) continue;
        requirement = clampOrdinal(requirement - offset);
        applied.push({
            modifierId: mod.id,
            label: mod.label,
            predicate,
            offset,
            via: mod.hazards.length > 0 ? mod.hazards.find(h => subject.hazards.includes(h)) ?? null : null
        });
    }

    // Environmental compatibility moves survive and succeed only. A place being
    // friendly to your path does not open a sealed door and does not teach you
    // to read.
    if (env.thresholdOffset !== 0 && (predicate === 'survive' || predicate === 'succeed')) {
        requirement = clampOrdinal(requirement - env.thresholdOffset);
        applied.push({
            modifierId: `env:${env.tags.join('+') || 'affinity'}`,
            label: env.thresholdOffset > 0 ? 'environmental affinity' : 'environmental suppression',
            predicate,
            offset: env.thresholdOffset,
            via: env.tags[0] ?? null
        });
    }

    // Realm capability class. A realm is what it makes POSSIBLE; the grants
    // the actor actually holds are what is in force. Two Deity Transformation
    // cultivators standing at the same door can get different answers here,
    // which is the entire reason the predicates come apart.
    const held = heldGrants(actor);
    const neutralised = neutralisedHazards(actor, subject.hazards);
    if (predicate === 'survive' || predicate === 'succeed') {
        for (const n of neutralised) {
            requirement = clampOrdinal(requirement - NEUTRALISED_HAZARD_RELIEF);
            applied.push({
                modifierId: `grant:${n.grant}`,
                label: `realm capability: ${n.grant.replace(/_/g, ' ')}`,
                predicate,
                offset: NEUTRALISED_HAZARD_RELIEF,
                via: n.hazard
            });
        }
    }
    // Grand Ascension is not immune to a list of hazards. It is simply no
    // longer gated by places, which is a different and larger statement.
    if (held.includes('gates_places') && subject.kind === 'location' && predicate !== 'understand') {
        if (requirement > 0) {
            applied.push({
                modifierId: 'grant:gates_places',
                label: 'realm capability: no longer gated by places',
                predicate,
                offset: requirement,
                via: null
            });
            requirement = 0;
        }
    }
    if (held.includes('reads_formations') && predicate === 'understand' && subject.hazards.includes('formation')) {
        const relief = Math.min(requirement, 8);
        if (relief > 0) {
            applied.push({
                modifierId: 'grant:reads_formations',
                label: 'realm capability: reads formation structure whole',
                predicate,
                offset: relief,
                via: 'formation'
            });
            requirement -= relief;
        }
    }

    // Comprehension keys are absolute. Somebody who has the notes reads the
    // door, whatever their realm - which is the whole argument for knowledge
    // being a resource.
    let keyed = false;
    if (predicate === 'understand' && subject.comprehensionKeys.length > 0) {
        const held = subject.comprehensionKeys.find(k => (actor.knowledgeIds ?? []).includes(k));
        if (held) {
            keyed = true;
            applied.push({
                modifierId: `knowledge:${held}`,
                label: `knowledge of ${held}`,
                predicate,
                offset: requirement,
                via: held
            });
            requirement = 0;
        }
    }

    const standing = standingFor(actor, predicate);
    const margin = standing - requirement;
    const blockers = predicate === 'attempt' ? attemptBlockers.slice() : [];

    // An attempt is refused only by a physical blocker. Being outclassed is not
    // a refusal; it is an answer to a different question.
    const holds =
        predicate === 'attempt'
            ? blockers.length === 0 && margin >= 0
            : margin >= 0;

    const handled = new Set([
        ...neutralised.map(n => n.hazard),
        ...applied.filter(a => a.via).map(a => a.via as string)
    ]);
    const unhandledHazards = subject.hazards.filter(h => !handled.has(h));

    return {
        predicate,
        holds,
        likelihood: likelihoodFor(margin, blockers.length > 0),
        unhandledHazards,
        neutralised,
        baseRequirement: base,
        requirement,
        standing,
        margin,
        applied,
        blockers,
        reason: reasonFor(subject, predicate, holds, requirement, standing, blockers, keyed, unhandledHazards)
    };
}

/**
 * Bucket the margin.
 */
function likelihoodFor(margin: number, blocked: boolean): Likelihood {
    if (blocked) return 'impossible';
    if (margin >= 6) return 'certain';
    if (margin >= 2) return 'likely';
    if (margin >= -1) return 'even';
    if (margin >= -6) return 'unlikely';
    return 'impossible';
}

/**
 * What the actor brings to each question.
 */
function standingFor(actor: CapabilityActor, predicate: CapabilityPredicate): number {
    const ordinal = clampOrdinal(actor.realmOrdinal);
    const attrs = actor.attributes ?? {};
    switch (predicate) {
        case 'understand':
            return Math.min(MAX_ORDINAL, ordinal + (attrs.insight ?? 0) * 2);
        case 'force':
            return Math.min(MAX_ORDINAL, ordinal + (attrs.might ?? 0));
        default:
            return ordinal;
    }
}

function reasonFor(
    subject: CapabilitySubject,
    predicate: CapabilityPredicate,
    holds: boolean,
    requirement: number,
    standing: number,
    blockers: readonly string[],
    keyed: boolean,
    unhandled: readonly string[]
): string {
    if (blockers.length > 0) return blockers.join(' ');
    const need = rankName(requirement);
    const have = rankName(standing);
    // Name the specific thing that is not handled. The narrator needs the
    // reason to write the scene, and having the reason is what stops it
    // inventing one.
    const because = unhandled.length > 0
        ? ` No method of dealing with the ${unhandled.join(', ')} here.`
        : '';
    switch (predicate) {
        case 'attempt':
            return holds
                ? `The attempt can be made.`
                : `${subject.name} does not open for ${have}; it takes ${need} to get in at all.`;
        case 'survive':
            return holds
                ? `${have} can survive ${subject.name}.`
                : `${subject.name} kills ${have}; surviving it takes ${need}.${because}`;
        case 'succeed':
            return holds
                ? `The attempt can work.`
                : `The attempt cannot work at ${have}; it takes ${need}.`;
        case 'understand':
            if (keyed) return `The actor already has what they need to read this.`;
            return holds
                ? `What is found here will be legible.`
                : `Whatever is found will not be understood; comprehension takes ${need}.`;
        case 'force':
            return holds
                ? `The outcome can be imposed over resistance.`
                : `The outcome cannot be imposed over resistance at ${have}; that takes ${need}.`;
    }
}

/**
 * One line for the narrator, phrased as what happens rather than as permission.
 *
 * It never says "you cannot". It says what the attempt costs.
 */
function summarise(
    subject: CapabilitySubject,
    v: Record<CapabilityPredicate, PredicateVerdict>
): string {
    if (!v.attempt.holds) {
        return v.attempt.blockers.length > 0
            ? v.attempt.blockers.join(' ')
            : `${subject.name} will not admit them at all.`;
    }
    const parts: string[] = [`They can attempt ${subject.name}.`];
    parts.push(
        v.survive.holds
            ? `Survival: ${v.survive.likelihood}.`
            : `Survival: ${v.survive.likelihood}.${v.survive.unhandledHazards.length > 0
                ? ` No method of resisting the ${v.survive.unhandledHazards.join(', ')} here.`
                : ''}`
    );
    if (!v.succeed.holds) parts.push('It would not work.');
    if (!v.understand.holds) parts.push('They would not understand what they found.');
    if (!v.force.holds) parts.push('They could not impose the outcome against resistance.');
    if (v.survive.holds && v.succeed.holds && v.understand.holds && v.force.holds) {
        parts.push('Nothing here is beyond them.');
    }
    return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────
// REQUIREMENT BUILDERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Requirements for going into a place.
 */
export function requirementsFromLocation(location: LocationRecord): CapabilityRequirements {
    const comprehension = Number(location.data.comprehensionOrdinal);
    return makeRequirements({
        attempt: location.thresholds.entry,
        survive: location.thresholds.survival,
        succeed: location.thresholds.operational,
        understand: Number.isFinite(comprehension) ? comprehension : location.thresholds.operational,
        force: location.thresholds.mastery
    });
}

/**
 * The world as much of it as this function needs to know whether the road in is
 * shut today.
 */
export interface GroundAroundALocation {
    statuses: readonly AreaStatus[];
    locations: readonly LocationRecord[];
}

/**
 * A location as a capability subject, including its seal and its cycle.
 */
export function subjectFromLocation(
    location: LocationRecord,
    onDay: number | null = null,
    ground: GroundAroundALocation | null = null
): CapabilitySubject {
    const shut = onDay === null
        ? false
        : ground === null
            ? !isOpenOn(location, onDay)
            : passageStoppedInArea(ground.statuses, ground.locations, location, onDay).stopped;
    const subject = makeSubject({
        kind: 'location',
        id: location.id,
        name: location.name,
        requirements: requirementsFromLocation(location),
        hazards: location.hazards.slice(),
        tags: location.tags.slice(),
        sealed: location.sealed,
        keyId: location.data.keyId == null ? null : String(location.data.keyId),
        windowClosed: shut,
        comprehensionKeys:
            location.data.comprehensionKey == null ? [] : [String(location.data.comprehensionKey)]
    });
    // Carry the affinities through so environmental compatibility applies.
    (subject as unknown as { affinities: LocationRecord['affinities'] }).affinities =
        location.affinities;
    return subject;
}

export interface OppositionInput {
    id: string;
    name: string;
    /** The other party's realm. */
    realmOrdinal: number;
    /**
     * How much attention they are paying, 0..1. A distracted elder is a
     * different problem from an alert one, and this is where luck expresses
     * itself: fortune arranges that the attention is elsewhere, it does not add
     * a percentage to winning.
     */
    alertness?: number;
    /** Ordinals of advantage the actor has arranged in advance. */
    preparation?: number;
    tags?: string[];
}

/**
 * Requirements for acting against somebody.
 */
export function requirementsFromOpposition(input: OppositionInput): CapabilityRequirements {
    const opponent = clampOrdinal(input.realmOrdinal);
    const alertness = Math.max(0, Math.min(1, input.alertness ?? 1));
    const prep = Math.max(0, input.preparation ?? 0);

    return makeRequirements({
        // Always initiable. This is the line the whole module exists to hold.
        attempt: 0,
        // Getting away with having tried scales with how hard they are looking.
        survive: Math.max(0, Math.round(opponent - 8 - prep + alertness * 6)),
        // Actually pulling it off against an alert opponent is near-parity work;
        // against a distracted one, preparation carries a great deal of it.
        succeed: Math.max(0, Math.round(opponent - 2 - prep + alertness * 4)),
        understand: Math.max(0, opponent - 6),
        // Imposing the outcome on somebody who resists is the one place raw
        // weight is close to the whole answer.
        force: opponent
    });
}

export function subjectFromOpposition(input: OppositionInput): CapabilitySubject {
    return makeSubject({
        kind: 'opponent',
        id: input.id,
        name: input.name,
        requirements: requirementsFromOpposition(input),
        tags: input.tags ?? []
    });
}

/**
 * Requirements for reading something.
 */
export function requirementsFromInscription(comprehensionOrdinal: number): CapabilityRequirements {
    return makeRequirements({ attempt: 0, survive: 0, succeed: 0, understand: comprehensionOrdinal, force: 0 });
}

/** Convenience for the single question a caller most often has. */
export function can(
    assessment: CapabilityAssessment,
    predicate: CapabilityPredicate
): boolean {
    return assessment[predicate].holds;
}
