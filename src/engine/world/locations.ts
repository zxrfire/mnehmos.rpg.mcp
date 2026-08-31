/**
 * Locations: mutable places that carry their own history as queryable state.
 *
 * A location is a stored record, not a simulation. It holds what the database
 * must be authoritative about - where a place is, who controls it, what is
 * dangerous about it, whether it is open, and everything that has been done to
 * it - and nothing interpretive. The LLM describes the valley; this module says
 * whether you can walk into it, whether it will kill you, and what it used to
 * be.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ORIGIN → CHANGES → CURRENT STATE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The map is not sacred. A place can be destroyed, abandoned, conquered,
 * rebuilt, forbidden, corrupted, enriched, sunk, raised, split, merged, sealed,
 * turned into a secret realm, or have its spiritual conditions and ecosystem
 * transformed. So a location is stored as three separately queryable layers:
 *
 *   `origin`   what it was before anything happened to it
 *   `changes`  an append-only, dated list of what has been done to it
 *   the record itself - the materialised current state
 *
 *     Blackwater Valley
 *       origin           an ordinary river valley
 *       3000 years ago   a sect established here
 *       1800 years ago   the sect destroyed
 *       500 years ago    a battle moved the river
 *       100 years ago    a merchant city built on the ruin
 *       now              a half-ruined city beside a corrupted river
 *
 * `stateAsOfDay` replays origin plus changes to reconstruct the place as it
 * stood at any past date, which is how a returning player's memory of a
 * mountain can be checked against a world that no longer has one.
 *
 * ── Catastrophes modify; they never spawn a new map ───────────────────────
 *
 * {@link applyLocationChange} is the only write path for a physical event, and
 * it patches the existing record. There is no create-a-new-region-on-disaster
 * path anywhere in this module, deliberately: the map does not grow, it scars.
 * A destroyed place becomes ruins, a forbidden zone, a treasure site, an
 * excavation or a secret-realm entrance - a transition, not a deletion.
 *
 * ── "Nobody knows why" is a stored state ──────────────────────────────────
 *
 * A change carries `causeFactId` and `causeKnown` separately from
 * `attributedCauses`, which is the list of competing explanations the current
 * inhabitants hold. The record can therefore say, truthfully, that a forest is
 * forbidden, that three villages disagree about why, and that the actual reason
 * is not written anywhere - right up until {@link explainLocationChange} is
 * called because somebody found out.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ENVIRONMENTAL GATING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Four thresholds, because they fail differently:
 *
 *   entry        can get through the door at all
 *   survival     will not simply be killed by the ambient conditions
 *   operational  can act here - fight, cultivate, work, search
 *   mastery      can exploit or hold the place
 *
 * Below `entry` you are turned away and nothing happens. Below `survival` you
 * get in and die. Between `survival` and `operational` you are alive and
 * useless, standing in the vault unable to open anything.
 *
 * Thresholds are lowered by what a character actually has - a technique built
 * for this hazard, an artifact, a physique, a formation, or knowing what the
 * door says - and by ENVIRONMENTAL AFFINITY, which is the place itself
 * favouring or suppressing a kind of cultivator. A poison specialist is
 * stronger in a corrupted region; a soul cultivator is weaker in a
 * soul-suppressing domain. So a specialist four realms below a rival can walk
 * into a domain that kills the rival outright. Where you are changes what you
 * are worth, and that inversion is designed rather than accidental.
 *
 * Every assessment shows its work: `AccessAssessment.applied` itemises which
 * modifier moved which threshold by how much, so a character who dies at a door
 * can read exactly what would have got them through it.
 *
 * ── Secret realms, sealed domains and portals ─────────────────────────────
 *
 * All of it is on the same planet. A portal links two places on this world and
 * nowhere else. A secret realm is a sealed pocket with a durable opening CYCLE
 * stored as a period and a phase, so "is it open in year 900" is arithmetic
 * rather than three centuries of ticking.
 */

import type { AmbientQi } from '../../schema/cultivation.js';
import { MAX_ORDINAL, clampOrdinal, rankName } from '../cultivation/realms.js';
import { yearOfDay, type PriorAges, type Ruin, type Scar } from './history.js';

// ─────────────────────────────────────────────────────────────────────────
// THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────

export type ThresholdTier = 'entry' | 'survival' | 'operational' | 'mastery';

export const THRESHOLD_TIERS: readonly ThresholdTier[] = [
    'entry', 'survival', 'operational', 'mastery'
] as const;

export interface LocationThresholds {
    entry: number;
    survival: number;
    operational: number;
    mastery: number;
}

export function makeThresholds(
    entry = 0,
    survival = entry,
    operational = survival,
    mastery = operational
): LocationThresholds {
    return {
        entry: clampOrdinal(entry),
        survival: clampOrdinal(survival),
        operational: clampOrdinal(operational),
        mastery: clampOrdinal(mastery)
    };
}

export type ThresholdModifierSource =
    | 'technique'
    | 'artifact'
    | 'physique'
    | 'spirit_root'
    | 'knowledge'
    | 'formation'
    | 'pill'
    | 'ally'
    | 'faction'
    | 'environment';

/**
 * Something a character has that makes a place easier.
 *
 * `offsets` are stated in ordinals and are SUBTRACTED from the requirement, so
 * a positive number is a benefit. A modifier gated on a hazard applies only
 * where that hazard is present, which is the mechanism by which a specialist
 * outperforms someone stronger.
 */
export interface ThresholdModifier {
    id: string;
    source: ThresholdModifierSource;
    /** Id of the technique, artifact, physique or fact that supplies it. */
    sourceId: string;
    label: string;
    offsets: Partial<Record<ThresholdTier, number>>;
    /** Applies only where one of these hazards is present. Empty = anywhere. */
    hazards: string[];
    /** Applies only at these locations. Empty = anywhere. */
    locationIds: string[];
    note: string;
}

export function makeModifier(
    init: Partial<ThresholdModifier> & Pick<ThresholdModifier, 'id' | 'source' | 'sourceId' | 'offsets'>
): ThresholdModifier {
    return {
        label: init.label ?? init.sourceId,
        hazards: init.hazards ?? [],
        locationIds: init.locationIds ?? [],
        note: init.note ?? '',
        ...init
    };
}

// ─────────────────────────────────────────────────────────────────────────
// ENVIRONMENT × CULTIVATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * The place favouring or suppressing a kind of cultivator.
 *
 * `tag` is free-form content ('poison', 'fire', 'soul', 'sword', 'ice',
 * 'corrupt', 'formation'), matched by string against what a character
 * specialises in. `multiplier` scales their effectiveness while they are here;
 * `thresholdOffset` moves the survival and operational bars for them
 * specifically. A negative multiplier band and a negative offset together are a
 * suppression domain: a soul cultivator inside one is weaker AND finds it
 * harder to stay upright.
 */
export interface EnvironmentAffinity {
    tag: string;
    /** Multiplier on effectiveness for a matching specialist. >1 boon, <1 bane. */
    multiplier: number;
    /** Ordinals removed from survival/operational for a matching specialist. */
    thresholdOffset: number;
    note: string;
}

export function makeAffinity(
    tag: string,
    multiplier: number,
    thresholdOffset = 0,
    note = ''
): EnvironmentAffinity {
    return { tag, multiplier, thresholdOffset, note };
}

/** What a character specialises in, and what they are vulnerable to. */
export interface ActorEnvironmentProfile {
    /** Tags this character is built around: their root, path, techniques. */
    specialties: readonly string[];
    /** Tags that specifically suppress them, if the world has recorded any. */
    vulnerabilities?: readonly string[];
}

export interface CompatibilityResult {
    /** Product of every matching affinity multiplier. 1 means indifferent. */
    multiplier: number;
    /** Net ordinals removed from survival and operational. May be negative. */
    thresholdOffset: number;
    matched: { tag: string; multiplier: number; thresholdOffset: number; via: 'specialty' | 'vulnerability' }[];
}

/**
 * How well this character and this place get on.
 *
 * Pure lookup over stored data. Specialty matches apply the affinity as
 * written; vulnerability matches invert a boon into a bane, which is how a
 * soul-suppressing domain is stored once and read correctly by both the soul
 * cultivator it punishes and the body cultivator it ignores.
 */
export function environmentalCompatibility(
    location: LocationRecord,
    profile: ActorEnvironmentProfile
): CompatibilityResult {
    const specialties = new Set(profile.specialties);
    const vulnerabilities = new Set(profile.vulnerabilities ?? []);
    let multiplier = 1;
    let thresholdOffset = 0;
    const matched: CompatibilityResult['matched'] = [];

    for (const aff of location.affinities) {
        if (specialties.has(aff.tag)) {
            multiplier *= aff.multiplier;
            thresholdOffset += aff.thresholdOffset;
            matched.push({ tag: aff.tag, multiplier: aff.multiplier, thresholdOffset: aff.thresholdOffset, via: 'specialty' });
        } else if (vulnerabilities.has(aff.tag)) {
            // The place does to them the opposite of what it does to a native.
            const inverted = aff.multiplier === 0 ? 0 : 1 / aff.multiplier;
            multiplier *= inverted;
            thresholdOffset -= Math.abs(aff.thresholdOffset);
            matched.push({ tag: aff.tag, multiplier: inverted, thresholdOffset: -Math.abs(aff.thresholdOffset), via: 'vulnerability' });
        }
    }

    return { multiplier: Number(multiplier.toFixed(6)), thresholdOffset, matched };
}

// ─────────────────────────────────────────────────────────────────────────
// LOCATIONS
// ─────────────────────────────────────────────────────────────────────────

export type LocationKind =
    | 'region'
    | 'settlement'
    | 'sect_seat'
    | 'wilds'
    | 'vein'
    | 'cave'
    | 'ruin'
    | 'grave'
    | 'scar'
    | 'forbidden_zone'
    | 'secret_realm'
    | 'sealed_domain'
    | 'portal';

export type LinkKind = 'road' | 'path' | 'tunnel' | 'gate' | 'portal' | 'seam';

export interface LocationLink {
    toLocationId: string;
    kind: LinkKind;
    /** Travel time in days. A portal is fast; it is not instantaneous by fiat. */
    travelDays: number;
    requiresKeyId: string | null;
    open: boolean;
    note: string;
}

/**
 * A durable opening schedule. `phaseDay` is the absolute day the first opening
 * began; the rest is arithmetic.
 */
export interface OpeningCycle {
    periodDays: number;
    openDays: number;
    phaseDay: number;
}

/**
 * A location is an environmental modifier, not just a name.
 *
 * "Cultivate for ten years" must resolve differently in a city, in wilderness,
 * on a spirit mountain, on a poisoned battlefield, inside a ruin, in sect
 * territory, and in a forbidden zone. These eight fields are what make that
 * true, and they are kept deliberately lightweight: enough for the capability
 * predicates and a rate multiplier to read, not an ecology model.
 */
export interface LocationEnvironment {
    /**
     * Usable qi here, 0..1, as distinct from `ashDensity`, which is how much
     * unbreathed fall the ground holds. A sealed ruin has high ash and, until
     * the seal is broken, no usable density at all.
     */
    spiritualDensity: number;
    /** 0..1. How likely the place is to hurt somebody who belongs here. */
    danger: number;
    /** What can be gathered: 'herbs', 'ore', 'beasts', 'ash', 'water'. */
    resources: string[];
    /** 'temperate', 'frozen', 'arid', 'sunless', 'stormbound'. Free text. */
    climate: string;
    /** Who actually runs it, in words. The faction id is on the record itself. */
    politicalControl: string;
    /**
     * Local laws of the place: 'no flight', 'qi does not circulate', 'the dead
     * do not stay down'. Free-form, read by the narrator, matched by string
     * where a technique claims to counter one.
     */
    specialRules: string[];
    /** Secrets somebody has already found here. Ids or short statements. */
    knownSecrets: string[];
    /** Marks left by history: 'crater', 'dead river', 'shattered formation'. */
    historicalScars: string[];
}

export function makeEnvironment(init: Partial<LocationEnvironment> = {}): LocationEnvironment {
    return {
        spiritualDensity: clamp01(init.spiritualDensity ?? 0.35),
        danger: clamp01(init.danger ?? 0.2),
        resources: init.resources ?? [],
        climate: init.climate ?? 'temperate',
        politicalControl: init.politicalControl ?? 'nobody in particular',
        specialRules: init.specialRules ?? [],
        knownSecrets: init.knownSecrets ?? [],
        historicalScars: init.historicalScars ?? []
    };
}

/** What a place was before anything was done to it. */
export interface LocationOrigin {
    kind: LocationKind;
    name: string;
    description: string;
    ambient: AmbientQi;
    ashDensity: number;
    thresholds: LocationThresholds;
    hazards: string[];
    affinities: EnvironmentAffinity[];
    environment: LocationEnvironment;
    /** Absolute day the place is considered to have existed from. */
    fromDay: number | null;
}

export type LocationChangeKind =
    | 'founded'
    | 'settled'
    | 'destroyed'
    | 'abandoned'
    | 'conquered'
    | 'rebuilt'
    | 'forbidden'
    | 'corrupted'
    | 'cleansed'
    | 'enriched'
    | 'depleted'
    | 'sunk'
    | 'raised'
    | 'split'
    | 'merged'
    | 'sealed'
    | 'unsealed'
    | 'became_secret_realm'
    | 'river_moved'
    | 'mountain_broken'
    | 'buried'
    | 'exposed'
    | 'ecosystem_changed'
    | 'spiritual_conditions_changed'
    | 'portal_opened'
    | 'portal_closed'
    | 'renamed'
    | 'other';

/**
 * A patch applied to the current state of a location.
 *
 * Deliberately additive/subtractive on the list fields rather than
 * whole-list replacement, because a catastrophe usually adds a hazard without
 * knowing what was already there.
 */
export interface LocationPatch {
    name?: string;
    kind?: LocationKind;
    description?: string;
    ambient?: AmbientQi;
    ashDensity?: number;
    thresholds?: Partial<LocationThresholds>;
    addHazards?: string[];
    removeHazards?: string[];
    addAffinities?: EnvironmentAffinity[];
    removeAffinityTags?: string[];
    /** Partial update to the environmental block. Lists replace wholesale. */
    environment?: Partial<LocationEnvironment>;
    sealed?: boolean;
    cycle?: OpeningCycle | null;
    discovered?: boolean;
    controllingFactionId?: string | null;
    addTags?: string[];
    removeTags?: string[];
    data?: Record<string, string | number | boolean | null>;
    /** Links added by this change (a portal opening, a tunnel exposed). */
    addLinks?: LocationLink[];
    removeLinkIds?: string[];
}

export interface LocationChange {
    id: string;
    onDay: number;
    kind: LocationChangeKind;
    /** Factual statement of what was done to the place. */
    summary: string;
    /** The historical fact that caused it, when the cause is on record. */
    causeFactId: string | null;
    /**
     * Whether the true cause is recorded anywhere. False is a legitimate and
     * desirable state of the world: the region is like this because of
     * something three thousand years ago that nobody alive can explain.
     */
    causeKnown: boolean;
    /**
     * Competing explanations current inhabitants hold. NOT truth - belief lives
     * in the social layer's knowledge model; these are the stories attached to
     * this place, stored here because they are properties of the place.
     */
    attributedCauses: string[];
    /** How much of the record of this change survives. */
    fidelity: 'full' | 'partial' | 'rumour' | 'lost';
    /** Was anybody there. */
    witnessed: boolean;
    patch: LocationPatch;
}

export interface LocationRecord {
    id: string;
    name: string;
    kind: LocationKind;
    parentId: string | null;
    description: string;

    ambient: AmbientQi;
    /** Fraction of unbreathed fall, 0..1. Sealed pockets run high. */
    ashDensity: number;

    thresholds: LocationThresholds;
    /**
     * What is dangerous here: 'lightning', 'cold', 'thin_ash', 'formation',
     * 'pressure', 'illusion', 'sealed_qi', 'corrosive', 'beasts', 'guardian'.
     * Free-form tags, because a specialist's counter is matched by string and
     * the world's hazards are content rather than an enum the engine owns.
     */
    hazards: string[];
    /** How the place treats particular kinds of cultivator. */
    affinities: EnvironmentAffinity[];
    /** What being here does to anyone, whatever they specialise in. */
    environment: LocationEnvironment;

    links: LocationLink[];
    cycle: OpeningCycle | null;
    sealed: boolean;
    sealedOnDay: number | null;

    discovered: boolean;
    discoveredOnDay: number | null;

    controllingFactionId: string | null;
    originFactId: string | null;

    /** What it was. Never patched - only `changes` and the record move. */
    origin: LocationOrigin;
    /** Append-only, ordered by day. The middle layer of the three. */
    changes: LocationChange[];
    nextChangeSeq: number;

    tags: string[];
    data: Record<string, string | number | boolean | null>;
}

export function makeLocation(
    init: Partial<LocationRecord> & Pick<LocationRecord, 'id' | 'name' | 'kind'>
): LocationRecord {
    const base: Omit<LocationRecord, 'origin'> = {
        parentId: null,
        description: '',
        ambient: 'normal',
        ashDensity: 0.35,
        thresholds: makeThresholds(),
        hazards: [],
        affinities: [],
        environment: makeEnvironment(),
        links: [],
        cycle: null,
        sealed: false,
        sealedOnDay: null,
        discovered: true,
        discoveredOnDay: null,
        controllingFactionId: null,
        originFactId: null,
        changes: [],
        nextChangeSeq: 1,
        tags: [],
        data: {},
        ...init
    };
    return {
        ...base,
        origin: init.origin ?? {
            kind: base.kind,
            name: base.name,
            description: base.description,
            ambient: base.ambient,
            ashDensity: base.ashDensity,
            thresholds: { ...base.thresholds },
            hazards: base.hazards.slice(),
            affinities: base.affinities.map(a => ({ ...a })),
            environment: { ...base.environment, resources: base.environment.resources.slice() },
            fromDay: null
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────
// MUTATION - THE ONLY WRITE PATH FOR A PHYSICAL EVENT
// ─────────────────────────────────────────────────────────────────────────

export interface ChangeInput {
    onDay: number;
    kind: LocationChangeKind;
    summary: string;
    patch?: LocationPatch;
    causeFactId?: string | null;
    causeKnown?: boolean;
    attributedCauses?: string[];
    fidelity?: LocationChange['fidelity'];
    witnessed?: boolean;
}

export interface ChangeResult {
    location: LocationRecord;
    change: LocationChange;
}

/**
 * Apply a change to a place.
 *
 * Appends the change to the location's history AND materialises its patch onto
 * the current state, in one operation, so the two can never disagree. This is
 * the whole of "a witnessed catastrophe writes real state": if a mountain is
 * destroyed the record says the mountain is destroyed, and the history gains
 * the entry that says when and, if anybody knows, why.
 *
 * Pure - a new record comes back and the input is untouched.
 */
export function applyLocationChange(location: LocationRecord, input: ChangeInput): ChangeResult {
    const change: LocationChange = {
        id: `${location.id}-c${location.nextChangeSeq}`,
        onDay: input.onDay,
        kind: input.kind,
        summary: input.summary,
        causeFactId: input.causeFactId ?? null,
        causeKnown: input.causeKnown ?? input.causeFactId != null,
        attributedCauses: input.attributedCauses ?? [],
        fidelity: input.fidelity ?? 'full',
        witnessed: input.witnessed ?? false,
        patch: input.patch ?? {}
    };

    const next = applyPatch(location, change.patch, change.onDay);
    next.changes = location.changes.concat(change);
    next.nextChangeSeq = location.nextChangeSeq + 1;
    // Changes are stored in day order so replay is a prefix scan.
    next.changes.sort((a, b) => a.onDay - b.onDay || changeSeq(a.id) - changeSeq(b.id));
    return { location: next, change };
}

function changeSeq(id: string): number {
    const at = id.lastIndexOf('-c');
    const n = at >= 0 ? Number(id.slice(at + 2)) : NaN;
    return Number.isFinite(n) ? n : 0;
}

function applyPatch(location: LocationRecord, patch: LocationPatch, onDay: number): LocationRecord {
    const next: LocationRecord = {
        ...location,
        thresholds: { ...location.thresholds },
        hazards: location.hazards.slice(),
        affinities: location.affinities.map(a => ({ ...a })),
        environment: {
            ...location.environment,
            resources: location.environment.resources.slice(),
            specialRules: location.environment.specialRules.slice(),
            knownSecrets: location.environment.knownSecrets.slice(),
            historicalScars: location.environment.historicalScars.slice()
        },
        links: location.links.map(l => ({ ...l })),
        tags: location.tags.slice(),
        data: { ...location.data },
        changes: location.changes.slice(),
        origin: location.origin
    };

    if (patch.name !== undefined) next.name = patch.name;
    if (patch.kind !== undefined) next.kind = patch.kind;
    if (patch.description !== undefined) next.description = patch.description;
    if (patch.ambient !== undefined) next.ambient = patch.ambient;
    if (patch.ashDensity !== undefined) next.ashDensity = clamp01(patch.ashDensity);
    if (patch.thresholds) {
        for (const tier of THRESHOLD_TIERS) {
            const v = patch.thresholds[tier];
            if (v !== undefined) next.thresholds[tier] = clampOrdinal(v);
        }
    }
    if (patch.addHazards) {
        for (const h of patch.addHazards) if (!next.hazards.includes(h)) next.hazards.push(h);
    }
    if (patch.removeHazards) {
        next.hazards = next.hazards.filter(h => !patch.removeHazards!.includes(h));
    }
    if (patch.removeAffinityTags) {
        next.affinities = next.affinities.filter(a => !patch.removeAffinityTags!.includes(a.tag));
    }
    if (patch.addAffinities) {
        for (const aff of patch.addAffinities) {
            const at = next.affinities.findIndex(a => a.tag === aff.tag);
            if (at >= 0) next.affinities[at] = { ...aff };
            else next.affinities.push({ ...aff });
        }
    }
    if (patch.environment) {
        next.environment = {
            ...next.environment,
            ...patch.environment,
            spiritualDensity: clamp01(
                patch.environment.spiritualDensity ?? next.environment.spiritualDensity
            ),
            danger: clamp01(patch.environment.danger ?? next.environment.danger)
        };
    }
    if (patch.sealed !== undefined) {
        next.sealed = patch.sealed;
        next.sealedOnDay = patch.sealed ? onDay : null;
    }
    if (patch.cycle !== undefined) next.cycle = patch.cycle;
    if (patch.discovered !== undefined) {
        next.discovered = patch.discovered;
        if (patch.discovered && next.discoveredOnDay === null) next.discoveredOnDay = onDay;
    }
    if (patch.controllingFactionId !== undefined) next.controllingFactionId = patch.controllingFactionId;
    if (patch.addTags) {
        for (const t of patch.addTags) if (!next.tags.includes(t)) next.tags.push(t);
    }
    if (patch.removeTags) next.tags = next.tags.filter(t => !patch.removeTags!.includes(t));
    if (patch.data) next.data = { ...next.data, ...patch.data };
    if (patch.removeLinkIds) {
        next.links = next.links.filter(l => !patch.removeLinkIds!.includes(l.toLocationId));
    }
    if (patch.addLinks) {
        for (const link of patch.addLinks) {
            const at = next.links.findIndex(l => l.toLocationId === link.toLocationId && l.kind === link.kind);
            if (at >= 0) next.links[at] = { ...link };
            else next.links.push({ ...link });
        }
    }

    return next;
}

/**
 * Somebody found out why.
 *
 * Attaches the recovered cause to a change that did not have one. The mirror of
 * `explainFact` in the ledger, and the reason "nobody knows why" is a state
 * rather than a dead end.
 */
export function explainLocationChange(
    location: LocationRecord,
    changeId: string,
    causeFactId: string,
    fidelity: LocationChange['fidelity'] = 'partial'
): LocationRecord {
    return {
        ...location,
        changes: location.changes.map(c =>
            c.id === changeId
                ? {
                    ...c,
                    causeFactId,
                    causeKnown: true,
                    fidelity: betterFidelity(c.fidelity, fidelity)
                }
                : c
        )
    };
}

/** Record an explanation the locals hold. Belief, not truth; stored as such. */
export function attributeCause(
    location: LocationRecord,
    changeId: string,
    explanation: string
): LocationRecord {
    return {
        ...location,
        changes: location.changes.map(c =>
            c.id === changeId && !c.attributedCauses.includes(explanation)
                ? { ...c, attributedCauses: c.attributedCauses.concat(explanation) }
                : c
        )
    };
}

const FIDELITY_ORDER = { lost: 0, rumour: 1, partial: 2, full: 3 } as const;
function betterFidelity(
    a: LocationChange['fidelity'],
    b: LocationChange['fidelity']
): LocationChange['fidelity'] {
    return FIDELITY_ORDER[b] > FIDELITY_ORDER[a] ? b : a;
}

// ─────────────────────────────────────────────────────────────────────────
// THE THREE LAYERS, QUERIED
// ─────────────────────────────────────────────────────────────────────────

export interface LocationHistoryEntry {
    changeId: string | null;
    onDay: number;
    year: number;
    label: string;
    summary: string;
    causeFactId: string | null;
    causeKnown: boolean;
    attributedCauses: string[];
    fidelity: LocationChange['fidelity'];
}

/**
 * The place's own history, origin first.
 *
 * This is the `origin → changes → current state` view, rendered as rows. The
 * first row is always the origin; everything after it is something that was
 * done to the place, in order.
 */
export function locationHistory(location: LocationRecord): LocationHistoryEntry[] {
    const rows: LocationHistoryEntry[] = [
        {
            changeId: null,
            onDay: location.origin.fromDay ?? Number.NEGATIVE_INFINITY,
            year: location.origin.fromDay != null ? yearOfDay(location.origin.fromDay) : Number.NEGATIVE_INFINITY,
            label: 'origin',
            summary: location.origin.description || `${location.origin.name}, ${location.origin.kind}`,
            causeFactId: null,
            causeKnown: true,
            attributedCauses: [],
            fidelity: 'full'
        }
    ];
    for (const c of location.changes) {
        rows.push({
            changeId: c.id,
            onDay: c.onDay,
            year: yearOfDay(c.onDay),
            label: c.kind,
            summary: c.summary,
            causeFactId: c.causeFactId,
            causeKnown: c.causeKnown,
            attributedCauses: c.attributedCauses.slice(),
            fidelity: c.fidelity
        });
    }
    return rows;
}

export function changesBetween(
    location: LocationRecord,
    fromDay: number,
    toDay: number
): LocationChange[] {
    return location.changes.filter(c => c.onDay >= fromDay && c.onDay < toDay);
}

/** Changes to this place whose true cause is not on record. */
export function unexplainedChanges(location: LocationRecord): LocationChange[] {
    return location.changes.filter(c => !c.causeKnown || c.fidelity === 'lost');
}

/**
 * The place as it stood on a past day.
 *
 * Replays the origin plus every change up to `day`. This is how the world
 * answers "was there a mountain here" for a player who remembers one - and how
 * it can answer "yes, until year 8,412" without the current record having to
 * carry a note about it.
 */
export function stateAsOfDay(location: LocationRecord, day: number): LocationRecord {
    const origin = location.origin;
    let rebuilt = makeLocation({
        id: location.id,
        name: origin.name,
        kind: origin.kind,
        parentId: location.parentId,
        description: origin.description,
        ambient: origin.ambient,
        ashDensity: origin.ashDensity,
        thresholds: { ...origin.thresholds },
        hazards: origin.hazards.slice(),
        affinities: origin.affinities.map(a => ({ ...a })),
        environment: {
            ...origin.environment,
            resources: origin.environment.resources.slice(),
            specialRules: origin.environment.specialRules.slice(),
            knownSecrets: origin.environment.knownSecrets.slice(),
            historicalScars: origin.environment.historicalScars.slice()
        },
        originFactId: location.originFactId,
        origin
    });
    for (const change of location.changes) {
        if (change.onDay > day) break;
        rebuilt = applyPatch(rebuilt, change.patch, change.onDay);
    }
    rebuilt.changes = location.changes.filter(c => c.onDay <= day);
    rebuilt.nextChangeSeq = rebuilt.changes.length + 1;
    return rebuilt;
}

// ─────────────────────────────────────────────────────────────────────────
// ACCESS
// ─────────────────────────────────────────────────────────────────────────

export type AccessLevel =
    /** Cannot get in at all. */
    | 'barred'
    /** Can get in, and being in will kill them. */
    | 'lethal'
    /** Alive here, but cannot act - the vault they cannot open. */
    | 'surviving'
    /** Can act here. */
    | 'operational'
    /** Can hold or exploit the place. */
    | 'mastered';

export interface AppliedModifier {
    modifierId: string;
    label: string;
    tier: ThresholdTier;
    /** Ordinals removed from the requirement. Negative means it got harder. */
    offset: number;
    /** Hazard or affinity tag that admitted it. */
    via: string | null;
}

export interface AccessAssessment {
    locationId: string;
    level: AccessLevel;
    base: LocationThresholds;
    /** Requirements after modifiers and affinity. What the check actually used. */
    effective: LocationThresholds;
    /** Itemised. A character who dies at a door can read what would have helped. */
    applied: AppliedModifier[];
    /** Ordinals short of each tier not met. Absent tiers were met. */
    shortfall: Partial<Record<ThresholdTier, number>>;
    /** Effectiveness multiplier from environmental compatibility while here. */
    environmentMultiplier: number;
    /** True when the place is shut for reasons unrelated to power. */
    closed: boolean;
    reason: string;
}

function gateFor(
    location: LocationRecord,
    mod: ThresholdModifier
): { ok: boolean; hazard: string | null } {
    if (mod.locationIds.length > 0 && !mod.locationIds.includes(location.id)) {
        return { ok: false, hazard: null };
    }
    if (mod.hazards.length === 0) return { ok: true, hazard: null };
    for (const hazard of location.hazards) {
        if (mod.hazards.includes(hazard)) return { ok: true, hazard };
    }
    return { ok: false, hazard: null };
}

/**
 * Thresholds after everything the character is carrying and everything the
 * place thinks of them.
 *
 * Modifiers stack additively and the result is clamped to the legal ordinal
 * range, so no stack of trinkets can take a requirement below zero and quietly
 * turn a lethal domain into a road.
 */
export function effectiveThresholds(
    location: LocationRecord,
    modifiers: readonly ThresholdModifier[] = [],
    profile?: ActorEnvironmentProfile
): { effective: LocationThresholds; applied: AppliedModifier[]; environmentMultiplier: number } {
    const effective: LocationThresholds = { ...location.thresholds };
    const applied: AppliedModifier[] = [];

    for (const mod of modifiers) {
        const gate = gateFor(location, mod);
        if (!gate.ok) continue;
        for (const tier of THRESHOLD_TIERS) {
            const offset = mod.offsets[tier];
            if (offset === undefined || offset === 0) continue;
            effective[tier] = clampOrdinal(effective[tier] - offset);
            applied.push({ modifierId: mod.id, label: mod.label, tier, offset, via: gate.hazard });
        }
    }

    let environmentMultiplier = 1;
    if (profile) {
        const compat = environmentalCompatibility(location, profile);
        environmentMultiplier = compat.multiplier;
        if (compat.thresholdOffset !== 0) {
            // Affinity moves survival and operational only. A place being
            // friendly to your path does not open a door that is barred, and
            // it does not hand you mastery of somewhere you cannot hold.
            for (const tier of ['survival', 'operational'] as const) {
                effective[tier] = clampOrdinal(effective[tier] - compat.thresholdOffset);
            }
            for (const m of compat.matched) {
                if (m.thresholdOffset === 0) continue;
                applied.push({
                    modifierId: `env:${m.tag}`,
                    label: `environmental ${m.via === 'specialty' ? 'affinity' : 'suppression'} (${m.tag})`,
                    tier: 'survival',
                    offset: m.thresholdOffset,
                    via: m.tag
                });
                applied.push({
                    modifierId: `env:${m.tag}`,
                    label: `environmental ${m.via === 'specialty' ? 'affinity' : 'suppression'} (${m.tag})`,
                    tier: 'operational',
                    offset: m.thresholdOffset,
                    via: m.tag
                });
            }
        }
    }

    return { effective, applied, environmentMultiplier };
}

export interface AccessQuery {
    realmOrdinal: number;
    modifiers?: readonly ThresholdModifier[];
    /** Specialties and vulnerabilities, for environmental compatibility. */
    profile?: ActorEnvironmentProfile;
    /** Absolute day, for cycle-gated places. Omit to ignore the cycle. */
    onDay?: number;
    /** Key ids held, for sealed doors and gated links. */
    keyIds?: readonly string[];
}

/**
 * Can this character be here, and what can they do while they are.
 *
 * Purely a comparison of stored numbers. Nothing here knows whether the
 * character is the player, and nothing scales to how a run is going.
 */
export function evaluateAccess(location: LocationRecord, query: AccessQuery): AccessAssessment {
    const { effective, applied, environmentMultiplier } = effectiveThresholds(
        location,
        query.modifiers ?? [],
        query.profile
    );
    const ordinal = clampOrdinal(query.realmOrdinal);
    const shortfall: Partial<Record<ThresholdTier, number>> = {};
    for (const tier of THRESHOLD_TIERS) {
        if (ordinal < effective[tier]) shortfall[tier] = effective[tier] - ordinal;
    }

    const keyed =
        location.data.keyId == null || (query.keyIds ?? []).includes(String(location.data.keyId));
    const cycleOpen = query.onDay === undefined ? true : isOpenOn(location, query.onDay);
    const closed = (location.sealed && !keyed) || !cycleOpen;

    let level: AccessLevel;
    if (ordinal < effective.entry) level = 'barred';
    else if (ordinal < effective.survival) level = 'lethal';
    else if (ordinal < effective.operational) level = 'surviving';
    else if (ordinal < effective.mastery) level = 'operational';
    else level = 'mastered';

    return {
        locationId: location.id,
        level,
        base: { ...location.thresholds },
        effective,
        applied,
        shortfall,
        environmentMultiplier,
        closed,
        reason: describeAccess(location, level, ordinal, effective, closed)
    };
}

function describeAccess(
    location: LocationRecord,
    level: AccessLevel,
    ordinal: number,
    effective: LocationThresholds,
    closed: boolean
): string {
    const who = rankName(ordinal);
    if (closed) {
        return location.sealed
            ? `${location.name} is sealed. Power is not the obstacle; the seal is.`
            : `${location.name} is shut. It is not open on this day.`;
    }
    switch (level) {
        case 'barred':
            return `${who} cannot enter ${location.name}; entry requires ${rankName(effective.entry)}.`;
        case 'lethal':
            return `${who} can enter ${location.name} and will not survive it; surviving requires ${rankName(effective.survival)}.`;
        case 'surviving':
            return `${who} can stand in ${location.name} but cannot act there; acting requires ${rankName(effective.operational)}.`;
        case 'operational':
            return `${who} can operate in ${location.name}. Holding or exploiting it requires ${rankName(effective.mastery)}.`;
        case 'mastered':
            return `${who} is above every threshold at ${location.name}.`;
    }
}

export function canSurvive(location: LocationRecord, query: AccessQuery): boolean {
    const level = evaluateAccess(location, query).level;
    return level === 'surviving' || level === 'operational' || level === 'mastered';
}

export function canOperate(location: LocationRecord, query: AccessQuery): boolean {
    const level = evaluateAccess(location, query).level;
    return level === 'operational' || level === 'mastered';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT BEING HERE DOES
// ─────────────────────────────────────────────────────────────────────────

export interface CultivationContext {
    locationId: string;
    /**
     * Multiplier on cultivation rate for time spent here. This is the number
     * that makes "cultivate for ten years" resolve differently in a city, on a
     * spirit mountain, and on a poisoned battlefield.
     */
    rateMultiplier: number;
    /** 0..1 chance-weight the caller may use for how hostile the place is. */
    danger: number;
    /** Itemised, so a player can be told why their decade was slow. */
    factors: { source: string; multiplier: number; note: string }[];
    /** Local laws in force here, verbatim. The narrator reads these out. */
    specialRules: string[];
}

const AMBIENT_RATE: Record<AmbientQi, number> = {
    thin: 0.5,
    normal: 1,
    dense: 2,
    spirit_tide: 3
};

/**
 * What ten years here is worth.
 *
 * A pure read over stored environment plus the actor's own specialties. It
 * returns a multiplier and its breakdown; it does not apply anything, because
 * applying it is the cultivation engine's job and the durable-process rate is
 * where it lands.
 *
 * Sealed places are the interesting case: a ruin can hold enormous unbreathed
 * ash and still return a low multiplier, because until the seal is broken the
 * density is not available to anybody standing outside it.
 */
export function cultivationContext(
    location: LocationRecord,
    profile?: ActorEnvironmentProfile
): CultivationContext {
    const factors: { source: string; multiplier: number; note: string }[] = [];

    factors.push({
        source: 'ambient_qi',
        multiplier: AMBIENT_RATE[location.ambient],
        note: `Ambient ash: ${location.ambient}.`
    });
    factors.push({
        source: 'spiritual_density',
        multiplier: 0.5 + location.environment.spiritualDensity,
        note: `Usable density ${location.environment.spiritualDensity.toFixed(2)}.`
    });
    if (location.sealed) {
        factors.push({
            source: 'sealed',
            multiplier: 0.25,
            note: 'The place is sealed. Whatever is inside is not reaching anyone.'
        });
    }
    if (location.environment.danger > 0.5) {
        factors.push({
            source: 'danger',
            multiplier: 1 - (location.environment.danger - 0.5) * 0.6,
            note: 'Too much of the day goes on staying alive.'
        });
    }
    if (profile) {
        const compat = environmentalCompatibility(location, profile);
        if (compat.multiplier !== 1) {
            factors.push({
                source: 'affinity',
                multiplier: compat.multiplier,
                note: compat.matched.map(m => `${m.via} match on ${m.tag}`).join('; ')
            });
        }
    }

    const rateMultiplier = factors.reduce((r, f) => r * Math.max(0, f.multiplier), 1);
    return {
        locationId: location.id,
        rateMultiplier: Number(rateMultiplier.toFixed(6)),
        danger: location.environment.danger,
        factors,
        specialRules: location.environment.specialRules.slice()
    };
}

// ─────────────────────────────────────────────────────────────────────────
// CYCLES
// Closed-form. Asking about a day three centuries out costs the same as asking
// about tomorrow, which is what makes a decades-long seclusion cheap.
// ─────────────────────────────────────────────────────────────────────────

export function isOpenOn(location: LocationRecord, absoluteDay: number): boolean {
    if (location.sealed) return false;
    const cycle = location.cycle;
    if (!cycle) return true;
    if (cycle.periodDays <= 0 || cycle.openDays <= 0) return false;
    if (absoluteDay < cycle.phaseDay) return false;
    return (absoluteDay - cycle.phaseDay) % cycle.periodDays < cycle.openDays;
}

/** First day at or after `fromDay` on which the place stands open. */
export function nextOpeningDay(location: LocationRecord, fromDay: number): number | null {
    const cycle = location.cycle;
    if (location.sealed) return null;
    if (!cycle) return fromDay;
    if (cycle.periodDays <= 0 || cycle.openDays <= 0) return null;
    if (fromDay <= cycle.phaseDay) return cycle.phaseDay;
    const offset = (fromDay - cycle.phaseDay) % cycle.periodDays;
    return offset < cycle.openDays ? fromDay : fromDay + (cycle.periodDays - offset);
}

/** Day the current or next opening ends. Null when it never closes. */
export function nextClosingDay(location: LocationRecord, fromDay: number): number | null {
    const cycle = location.cycle;
    if (!cycle || cycle.periodDays <= 0 || cycle.openDays <= 0) return null;
    const open = nextOpeningDay(location, fromDay);
    if (open === null) return null;
    const cycleStart = open - ((open - cycle.phaseDay) % cycle.periodDays);
    return cycleStart + cycle.openDays;
}

export interface OpeningWindow {
    opensOnDay: number;
    closesOnDay: number;
}

/**
 * Every opening window between two days, capped.
 *
 * The cap is not a shortcut: a caller asking about ten thousand days of a
 * thirty-day cycle wants the next few windows, not three hundred of them, and
 * an uncapped list is how a cheap time advance stops being cheap.
 */
export function openingsBetween(
    location: LocationRecord,
    fromDay: number,
    toDay: number,
    limit = 16
): OpeningWindow[] {
    const out: OpeningWindow[] = [];
    const cycle = location.cycle;
    if (!cycle || location.sealed || cycle.periodDays <= 0 || cycle.openDays <= 0) return out;
    let cursor = fromDay;
    while (out.length < limit) {
        const opens = nextOpeningDay(location, cursor);
        if (opens === null || opens > toDay) break;
        const closes = nextClosingDay(location, opens);
        out.push({ opensOnDay: opens, closesOnDay: closes ?? opens + cycle.openDays });
        cursor = opens + cycle.periodDays;
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// TRAVEL
// ─────────────────────────────────────────────────────────────────────────

export interface TravelOption {
    link: LocationLink;
    usable: boolean;
    reason: string;
}

/**
 * Links out of a place, with a stored reason for each one the character cannot
 * use. Portals are ordinary links with a short `travelDays`; they lead to
 * another place on this planet, and there is nowhere else for them to lead.
 */
export function travelOptions(
    location: LocationRecord,
    keyIds: readonly string[] = []
): TravelOption[] {
    return location.links.map(link => {
        if (!link.open) return { link, usable: false, reason: 'The way is closed.' };
        if (link.requiresKeyId && !keyIds.includes(link.requiresKeyId)) {
            return { link, usable: false, reason: `Requires ${link.requiresKeyId}.` };
        }
        return { link, usable: true, reason: '' };
    });
}

/** Symmetric link. A road that only exists in one direction is a bug. */
export function linkLocations(
    a: LocationRecord,
    b: LocationRecord,
    kind: LinkKind,
    travelDays: number,
    requiresKeyId: string | null = null
): void {
    upsertLink(a, { toLocationId: b.id, kind, travelDays, requiresKeyId, open: true, note: '' });
    upsertLink(b, { toLocationId: a.id, kind, travelDays, requiresKeyId, open: true, note: '' });
}

function upsertLink(location: LocationRecord, link: LocationLink): void {
    const at = location.links.findIndex(l => l.toLocationId === link.toLocationId && l.kind === link.kind);
    if (at >= 0) location.links[at] = link;
    else location.links.push(link);
}

// ─────────────────────────────────────────────────────────────────────────
// CATASTROPHE HELPERS
// Convenience patches for the shapes that come up constantly. Each is just a
// `LocationChange` with a filled-in patch - there is no separate code path for
// a disaster, because a disaster is a change like any other.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A normal place becomes forbidden because something happened there.
 *
 * Forbidden zones are made, not placed. The thresholds jump, hazards appear,
 * the ecosystem tag goes on, and the cause may or may not be recorded - which
 * is how a fertile forest ends up a forbidden forest that three villages
 * explain three different ways.
 */
export function forbidZone(
    location: LocationRecord,
    input: {
        onDay: number;
        summary: string;
        survivalOrdinal: number;
        operationalOrdinal?: number;
        hazards: string[];
        affinities?: EnvironmentAffinity[];
        causeFactId?: string | null;
        causeKnown?: boolean;
        attributedCauses?: string[];
        witnessed?: boolean;
    }
): ChangeResult {
    return applyLocationChange(location, {
        onDay: input.onDay,
        kind: 'forbidden',
        summary: input.summary,
        causeFactId: input.causeFactId ?? null,
        causeKnown: input.causeKnown ?? input.causeFactId != null,
        attributedCauses: input.attributedCauses ?? [],
        witnessed: input.witnessed ?? false,
        patch: {
            kind: 'forbidden_zone',
            thresholds: {
                survival: input.survivalOrdinal,
                operational: input.operationalOrdinal ?? input.survivalOrdinal + 3
            },
            addHazards: input.hazards,
            addAffinities: input.affinities ?? [],
            addTags: ['forbidden']
        }
    });
}

/**
 * Something large broke.
 *
 * Scale of destruction tracks the power involved, so the caller states the
 * scale and this only records it: the engine does not decide how big a fight
 * was, it stores how big the LLM said it was and what that did to the ground.
 */
export function recordCatastrophe(
    location: LocationRecord,
    input: {
        onDay: number;
        kind: LocationChangeKind;
        summary: string;
        patch: LocationPatch;
        causeFactId?: string | null;
        causeKnown?: boolean;
        witnessed?: boolean;
        fidelity?: LocationChange['fidelity'];
    }
): ChangeResult {
    return applyLocationChange(location, input);
}

/** A place is not deleted when it ends. It becomes the next thing. */
export function transformOnDestruction(
    location: LocationRecord,
    input: {
        onDay: number;
        becomes: LocationKind;
        summary: string;
        patch?: LocationPatch;
        causeFactId?: string | null;
        witnessed?: boolean;
    }
): ChangeResult {
    return applyLocationChange(location, {
        onDay: input.onDay,
        kind: 'destroyed',
        summary: input.summary,
        causeFactId: input.causeFactId ?? null,
        witnessed: input.witnessed ?? false,
        patch: { kind: input.becomes, addTags: ['ruined'], ...(input.patch ?? {}) }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// BUILDING PLACES OUT OF HISTORY
// ─────────────────────────────────────────────────────────────────────────

/**
 * Turn the remnants of the seeded past into locations.
 *
 * This is what makes ruins ordinary rather than special: every sealed compound
 * and every dead patch of ground on the map is the leftover of a dated fact
 * with names attached, and `originFactId` points straight back at it. Each
 * place is created in its ORIGINAL condition and then changed into what it is
 * now, so the layered history is populated rather than asserted.
 */
export function locationsFromPriorAges(prior: PriorAges): LocationRecord[] {
    const out: LocationRecord[] = [];
    for (const ruin of prior.ruins) out.push(locationFromRuin(ruin));
    for (const scar of prior.scars) out.push(locationFromScar(scar));
    return out;
}

export function locationFromRuin(ruin: Ruin): LocationRecord {
    const sealedDay = ruin.sealedYear * 365;
    const danger = clampOrdinal(ruin.dangerOrdinal);

    // It began as somebody's compound: ordinary, open, and not dangerous.
    const base = makeLocation({
        id: `loc-${ruin.id}`,
        name: ruin.location,
        kind: 'sect_seat',
        description: `The seat of a power that no longer exists.`,
        ambient: 'normal',
        ashDensity: 0.4,
        thresholds: makeThresholds(0, 0, 0, danger),
        originFactId: ruin.originFactId
    });
    base.origin.fromDay = sealedDay - 365 * 200;

    // Then it was sealed from the inside, and stopped being any of that.
    const { location } = applyLocationChange(base, {
        onDay: sealedDay,
        kind: 'sealed',
        summary:
            `${ruin.name} was sealed. The formations are still drawing on a vein ` +
            `nobody is tapping, and the trials inside were calibrated for ` +
            `${rankName(danger)} disciples of a sect that no longer exists.`,
        causeFactId: ruin.originFactId,
        // The seal is obvious; the reason for it went with the people who set it.
        causeKnown: false,
        fidelity: 'partial',
        patch: {
            kind: 'ruin',
            name: ruin.name,
            ambient: ruin.ashDensity >= 0.8 ? 'dense' : 'normal',
            ashDensity: ruin.ashDensity,
            thresholds: {
                entry: Math.max(0, danger - 10),
                survival: Math.max(0, danger - 6),
                operational: Math.max(0, danger - 2),
                mastery: danger
            },
            addHazards: ['formation', 'sealed_qi', 'guardian'],
            addAffinities: [
                makeAffinity('formation', 1.35, 3, 'The array still answers to someone who can read it.')
            ],
            environment: {
                // Ash it holds, versus ash anyone can reach. Until the seal is
                // broken those are different numbers, and that gap is the whole
                // economy of exploration.
                spiritualDensity: ruin.opened ? ruin.ashDensity : 0.05,
                danger: 0.8,
                resources: ['ash', 'manuals', 'formation_nodes'],
                climate: 'sunless',
                politicalControl: 'whoever gets in',
                specialRules: ['guardian formations still run'],
                knownSecrets: [],
                historicalScars: ['sealed from the inside']
            },
            sealed: !ruin.opened,
            discovered: ruin.opened,
            addTags: ['ruin', 'late_age'],
            data: {
                sealedYear: ruin.sealedYear,
                formerFactionId: ruin.formerFactionId,
                techniqueCount: ruin.techniqueIds.length,
                treasureCount: ruin.treasureIds.length
            }
        }
    });
    return location;
}

export function locationFromScar(scar: Scar): LocationRecord {
    const day = scar.year * 365;
    const base = makeLocation({
        id: `loc-${scar.id}`,
        name: scar.location,
        kind: 'wilds',
        description: 'Ordinary ground.',
        ambient: 'normal',
        ashDensity: 0.4,
        originFactId: scar.originFactId
    });
    base.origin.fromDay = day - 365 * 500;

    // Ground where a tribulation was failed. Ash will never settle here again:
    // permanently thin, useless to everyone, forever. Mastery is set to the top
    // of the ladder because there is nothing here to master.
    const { location } = applyLocationChange(base, {
        onDay: day,
        kind: 'spiritual_conditions_changed',
        summary:
            `${scar.radiusLi} li of ground stopped holding ash` +
            `${scar.failedName ? `, when ${scar.failedName} failed tribulation here` : ''}.`,
        causeFactId: scar.originFactId,
        causeKnown: scar.failedName != null,
        fidelity: 'partial',
        witnessed: false,
        patch: {
            kind: 'scar',
            name: `the scar at ${scar.location}`,
            description: `Permanently thin. Every scar was somebody's entire ambition.`,
            ambient: 'thin',
            ashDensity: 0,
            thresholds: { entry: 0, survival: 0, operational: 0, mastery: MAX_ORDINAL },
            addHazards: ['thin_ash'],
            addAffinities: [
                makeAffinity('ash', 0.25, -4, 'There is nothing here to breathe.')
            ],
            environment: {
                spiritualDensity: 0,
                danger: 0.1,
                resources: [],
                climate: 'still',
                politicalControl: 'nobody wants it',
                specialRules: ['ash does not settle here'],
                knownSecrets: [],
                historicalScars: ['tribulation scar']
            },
            addTags: ['scar', 'permanent'],
            data: { year: scar.year, radiusLi: scar.radiusLi, failedName: scar.failedName }
        }
    });
    return location;
}

/**
 * A secret realm: a sealed pocket on this planet that opens on a cycle.
 *
 * There is no space travel in this setting and no other worlds. A secret realm
 * is a place you walk into through a seam that is not always there.
 */
export function makeSecretRealm(
    init: Pick<LocationRecord, 'id' | 'name'> & {
        parentId?: string | null;
        thresholds: LocationThresholds;
        hazards?: string[];
        affinities?: EnvironmentAffinity[];
        cycle: OpeningCycle;
        ashDensity?: number;
        description?: string;
        originFactId?: string | null;
    }
): LocationRecord {
    return makeLocation({
        id: init.id,
        name: init.name,
        kind: 'secret_realm',
        parentId: init.parentId ?? null,
        description: init.description ?? '',
        ambient: 'dense',
        ashDensity: init.ashDensity ?? 0.8,
        thresholds: init.thresholds,
        hazards: init.hazards ?? ['sealed_qi'],
        affinities: init.affinities ?? [],
        cycle: init.cycle,
        discovered: false,
        originFactId: init.originFactId ?? null,
        tags: ['secret_realm']
    });
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
