/**
 * The narrow view of the content catalogs that seeding needs.
 *
 * `src/data/cultivation/` is large, richly authored, and under continuous edit
 * by whoever owns content. The world engine needs perhaps a fifteenth of what
 * is in there: enough to know that a faction exists, roughly how strong it is,
 * where it sits, who it hates, what it holds and what it answers to.
 *
 * So the dependency is inverted. This module declares the shapes the world
 * layer consumes, and `loadCultivationCatalog()` maps the real catalogs onto
 * them in one auditable place. Three things fall out of that, all of which have
 * already earned their keep:
 *
 *  1. A syntax error mid-edit in one content file does not take down the world
 *     engine's compilation, only the adapter's.
 *  2. `seedWorld` is testable against a fixture, so the soak test measures the
 *     simulation rather than the current state of somebody else's prose.
 *  3. The mapping from authored content to engine state is legible in one
 *     file, instead of scattered through a seeding routine as field accesses.
 *
 * Nothing here interprets. It selects, renames and defaults; every judgement
 * about what a faction is like stays in the content files where an author can
 * see it.
 */

import type { AmbientQi } from '../../schema/cultivation.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';
import { QI_DENSITY_DEFAULT, QI_DENSITY_MAX, clampQiDensity } from './qi-scale.js';

// ─────────────────────────────────────────────────────────────────────────
// SHAPES
// ─────────────────────────────────────────────────────────────────────────

/**
 * How a faction holds what it holds.
 *
 * The four models from the hierarchy catalog, and they produce materially
 * different worlds: a federated sect can lose its vein to a renewal it does not
 * control, an unbacked one can only lose it to somebody who comes and takes it.
 */
export type GovernanceModel = 'federated' | 'administered' | 'deference' | 'unbacked';

export interface CatalogFaction {
    id: string;
    name: string;
    alignment: 'righteous' | 'neutral' | 'demonic';
    /** Rank ladder, lowest first. */
    ranks: string[];
    /** Realm ordinal of its strongest member. Sets who it can bully. */
    powerOrdinal: number;
    /** Minimum ordinal it will look at. */
    admissionOrdinal: number;
    /** False for powers that take no applicants at all. */
    recruits: boolean;
    /** Coarse seat, matched against region ids and place names. */
    territory: string;
    /** Symmetric across the catalog. */
    rivalIds: string[];
    governance: GovernanceModel;
    /** Who it answers to, when anyone. */
    parentFactionId: string | null;
    /** Whether it holds a vein at all, and on what terms. */
    holdsVein: boolean;
    tributeStonesPerYear: number;
    /** Years between grant renewals. Zero when nothing is renewed. */
    renewalYears: number;
    /**
     * How much it can make for itself, 0..1. The production tier from the
     * faction-character catalog, flattened. Decides how fast a treasury
     * recovers from a bad decade and whether losing a vein is fatal.
     */
    production: number;
    /**
     * What it can still MAKE, as against what it happens to contain.
     *
     * `faction-character.ts` has carried this from the start and said in its own
     * header that the gap between `powerOrdinal` and `reliableOrdinal` is the
     * real prestige metric - and the mapper below flattened the whole structure
     * to one 0..1 number and threw the ordinals away, so nothing downstream
     * could read it. Measured across the catalog: every one of the 32 houses
     * has its peak behind it, and the mean gap between its strongest member and
     * what it can still reliably produce is TWELVE RUNGS.
     *
     * That gap is a resource statement, not a teaching one. A house standing at
     * 36 that can only produce 28 has the books and it has the master; what it
     * does not have is the pills and the comprehension materials, which DO
     * exist in the world today and which somebody else can get. Its own 36 had
     * to reach that peak by their own means. So the gap is a motive - it is
     * why a house buys, digs, allies and occasionally goes to war - rather than
     * a decline it simply suffers.
     */
    reliableOrdinal: number;
    /** The highest it has ever produced. Behind `reliableOrdinal` for nobody. */
    peakOrdinal: number;
    /** Years since it last produced anyone at that peak. Decline, dated. */
    yearsSinceLastPeak: number;
    /** Fraction of its inherited compound it can still operate, 0..1. */
    formationIntegrity: number;
    /**
     * The one-off ceiling it holds asleep, or zero.
     *
     * `sects.ts` has recorded this for a long time - `sectThreat().ceiling` is
     * what a house could field once, as against `powerOrdinal`, which is what
     * it fields every day - and the world layer never carried it across. So a
     * seeded world contained no information about which houses have something
     * under the hall, and `cascade.ts` could not offer `unseal` to anybody.
     *
     * It is an ordinary resource number and it is spent like one: waking it
     * sets it to zero, permanently, and there is exactly one per house.
     */
    sealedCeilingOrdinal: number;
    /**
     * Roots the house actively recruits. Empty means every root is welcome.
     *
     * Carried across for `architecture.ts`, which derives how elemental a
     * house's BUILDINGS are from how elementally narrow the house itself is: a
     * house that takes everybody cannot build for one element, and a house that
     * admits nothing but ice is ice all the way down.
     */
    preferredRoots: string[];
    /**
     * The element of each manual the house teaches, `null` for elementless.
     *
     * The second half of the same signal. A house whose curriculum is almost
     * entirely elementless is the most element-neutral architecture in the
     * world for a stated reason rather than by default.
     */
    teachesElements: (string | null)[];
    /** What the house is for: 'attack', 'support', 'alchemy', 'defense'. */
    specialities: string[];
    /** False only where the house genuinely built what it lives in. */
    compoundInherited: boolean;
    /** Array stones on the perimeter, and how many still answer. */
    formationNodesTotal: number;
    formationNodesLit: number;
    description: string;
}

export interface CatalogPlace {
    name: string;
    kind: 'hamlet' | 'village' | 'market_town' | 'sect_town' | 'city' | 'waystation' | 'site';
    ambient: AmbientQi;
    note: string;
}

export interface CatalogConnection {
    otherRegionId: string;
    kind: string;
    travelDays: number;
}

export interface CatalogRegion {
    id: string;
    name: string;
    /** The one region the player starts in. */
    home: boolean;
    summary: string;
    ambient: AmbientQi;
    /** 1..100, derived from the region's own ambient profile. */
    qiDensity: number;
    /** Nobody here has passed this in living memory. */
    localCeilingOrdinal: number;
    hazards: string[];
    /** Multiplier on progress from ordinary drawing here. */
    ambientRateMultiplier: number;
    politics: 'competing_sects' | 'single_hegemon' | 'no_authority';
    factionIds: string[];
    places: CatalogPlace[];
    connections: CatalogConnection[];
    exports: string[];
    /** Marks the land already carries. */
    scars: string[];
    /** Local laws of the place: what does not work here. */
    specialRules: string[];
    veinStatus: string;
}

export interface WorldCatalog {
    factions: CatalogFaction[];
    regions: CatalogRegion[];
    /** Technique ids that exist at all, for loss and rediscovery. */
    techniqueIds: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// LOADING THE REAL CATALOGS
// ─────────────────────────────────────────────────────────────────────────

/** Heaviest band in an ambient profile. The region's ordinary condition. */
export function dominantAmbient(profile: Partial<Record<AmbientQi, number>>): AmbientQi {
    const order: AmbientQi[] = ['thin', 'normal', 'dense', 'spirit_tide'];
    let best: AmbientQi = 'normal';
    let bestWeight = -1;
    for (const band of order) {
        const w = profile[band] ?? 0;
        if (w > bestWeight) {
            bestWeight = w;
            best = band;
        }
    }
    return best;
}

/**
 * Qi density from an ambient profile, on the 1..100 ground scale.
 *
 * A weighted average over the bands rather than the dominant one alone, so a
 * region that is mostly thin with a rich pocket reads richer than one that is
 * uniformly thin - which is the difference between somewhere worth fighting
 * over and somewhere nobody wants.
 */
export function densityFromProfile(profile: Partial<Record<AmbientQi, number>>): number {
    const weights: Record<AmbientQi, number> = {
        thin: 0.15, normal: 0.45, dense: 0.85, spirit_tide: 1, sealed_vein: 1
    };
    let total = 0;
    let sum = 0;
    // `sealed_vein` is intentionally not summed: it is a sealed pocket, not a
    // share of the open air, and folding it in would make a region look rich
    // because of something nobody has opened yet.
    for (const band of ['thin', 'normal', 'dense', 'spirit_tide'] as AmbientQi[]) {
        const w = profile[band] ?? 0;
        total += w;
        sum += w * weights[band];
    }
    // On the 1..100 ground scale. The band weights above are still the 0..1
    // shares they always were; this is the one place they become the scale.
    return total > 0
        ? clampQiDensity((sum / total) * QI_DENSITY_MAX)
        : QI_DENSITY_DEFAULT;
}

/**
 * Map the authored catalogs onto the engine's view.
 *
 * Everything is defensive: a content file mid-edit that has dropped a field
 * yields a default rather than an exception, because a missing tribute figure
 * is not a reason for the world to fail to exist. What it will not do is
 * invent a faction or a region that the content does not have.
 */
export async function loadCultivationCatalog(): Promise<WorldCatalog> {
    const [sects, regions, character, hierarchy, techniques] = await Promise.all([
        import('../../data/cultivation/sects.js'),
        import('../../data/cultivation/regions.js'),
        import('../../data/cultivation/faction-character.js').catch(() => null),
        import('../../data/cultivation/hierarchy.js').catch(() => null),
        import('../../data/cultivation/techniques.js').catch(() => null)
    ]);

    const parentage = (hierarchy as { FACTION_PARENTAGE?: Record<string, RawParentage> } | null)
        ?.FACTION_PARENTAGE ?? {};
    const characters = (character as { FACTION_CHARACTER?: Record<string, RawCharacter> } | null)
        ?.FACTION_CHARACTER ?? {};

    // The one-off ceiling a house holds asleep. `sectThreat` has computed it
    // for a long time and nothing outside the data layer ever read it, which is
    // why a seeded world had no unsealable houses in it.
    const threatOf = (sects as { sectThreat?: (id: string) => { ceiling?: number } | undefined })
        .sectThreat;

    // Admission terms live beside the sects rather than inside them, and the
    // element of an art lives in the technique catalog. Both are joined here
    // rather than in the world layer, so `architecture.ts` never imports
    // content and the one mapping stays legible in one file.
    const admission = (sects as { SECT_ADMISSION?: Record<string, { preferredRoots?: readonly string[] }> })
        .SECT_ADMISSION ?? {};
    const elementOf = new Map<string, string | null>();
    for (const t of (((techniques as { TECHNIQUES?: { id: string; element?: string | null }[] } | null)
        ?.TECHNIQUES) ?? [])) {
        elementOf.set(t.id, t.element ?? null);
    }

    const factions: CatalogFaction[] = [];
    for (const raw of (sects.SECTS ?? []) as unknown as RawSect[]) {
        let sealed = 0;
        try {
            const ceiling = threatOf?.(raw.id)?.ceiling ?? 0;
            // Only the part that is ABOVE what the house fields day to day is a
            // sealed ceiling. `sectThreat` returns the max of the two, so a
            // house with nothing asleep reports its own power ordinal here and
            // would otherwise look as though it held a sealed ancestor.
            if (ceiling > (raw.powerOrdinal ?? 0)) sealed = clampOrdinal(ceiling);
        } catch { /* a catalog that cannot answer is a house with nothing. */ }
        factions.push(mapFaction(raw, parentage[raw.id], characters[raw.id], sealed, {
            preferredRoots: admission[raw.id]?.preferredRoots ?? [],
            teachesElements: (raw.teaches ?? []).map(id => elementOf.get(id) ?? null)
        }));
    }

    const mapped: CatalogRegion[] = [];
    for (const raw of (regions.REGIONS ?? []) as unknown as RawRegion[]) {
        mapped.push(mapRegion(raw));
    }

    const techniqueIds = (((techniques as { TECHNIQUES?: { id: string }[] } | null)?.TECHNIQUES) ?? [])
        .map(t => t.id);

    return { factions, regions: mapped, techniqueIds };
}

interface RawSect {
    id: string;
    name: string;
    alignment?: string;
    ranks?: string[];
    powerOrdinal?: number;
    admissionOrdinal?: number;
    recruits?: boolean;
    territory?: string;
    rivals?: readonly string[];
    description?: string;
    teaches?: readonly string[];
    specialities?: readonly string[];
    compound?: { inherited?: boolean; formationNodesTotal?: number; formationNodesLit?: number };
}

interface RawParentage {
    governance?: string;
    parentFactionId?: string | null;
    holds?: string | null;
    terms?: { tributeStonesPerYear?: number; renewal?: string } | null;
}

interface RawCharacter {
    production?: {
        selfSufficiency?: number;
        tier?: string;
        /** The real shape, from `faction-character.ts`'s `ProductionTier`. */
        reliableOrdinal?: number;
        peakOrdinal?: number;
        peakCount?: number;
        currentCount?: number;
        yearsSinceLastPeak?: number;
    } | string;
}

interface RawRegion {
    id: string;
    name: string;
    role?: string;
    summary?: string;
    ambientProfile?: Partial<Record<AmbientQi, number>>;
    localCeilingOrdinal?: number;
    hazards?: string[];
    cultivation?: {
        ambientRateMultiplier?: number;
        missingDisciplines?: { discipline: string; reason: string }[];
    };
    politics?: string;
    factionIds?: string[];
    places?: { name: string; kind: string; ambient: AmbientQi; note: string }[];
    connections?: { otherRegionId: string; kind: string; travelDays: number }[];
    exports?: string[];
    veinStatus?: string;
}

function mapFaction(
    raw: RawSect,
    parent?: RawParentage,
    character?: RawCharacter,
    sealedCeilingOrdinal = 0,
    architecture: { preferredRoots: readonly string[]; teachesElements: (string | null)[] } =
        { preferredRoots: [], teachesElements: [] }
): CatalogFaction {
    const total = raw.compound?.formationNodesTotal ?? 0;
    const lit = raw.compound?.formationNodesLit ?? 0;
    return {
        id: raw.id,
        name: raw.name,
        alignment: normaliseAlignment(raw.alignment),
        ranks: raw.ranks && raw.ranks.length > 0
            ? raw.ranks.slice()
            : ['Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder', 'Grand Elder', 'Patriarch'],
        powerOrdinal: clampOrdinal(raw.powerOrdinal ?? 17),
        admissionOrdinal: clampOrdinal(raw.admissionOrdinal ?? 3),
        recruits: raw.recruits ?? true,
        territory: raw.territory ?? '',
        rivalIds: (raw.rivals ?? []).slice(),
        governance: normaliseGovernance(parent?.governance),
        parentFactionId: parent?.parentFactionId ?? null,
        holdsVein: Boolean(parent?.holds),
        tributeStonesPerYear: parent?.terms?.tributeStonesPerYear ?? 0,
        renewalYears: renewalYearsOf(parent?.terms?.renewal),
        production: productionOf(character),
        ...productionOrdinalsOf(character),
        formationIntegrity: total > 0 ? Number((lit / total).toFixed(4)) : 1,
        sealedCeilingOrdinal,
        preferredRoots: architecture.preferredRoots.slice(),
        teachesElements: architecture.teachesElements.slice(),
        specialities: (raw.specialities ?? []).slice(),
        // A house that says nothing about its compound is taken to have built
        // it, which is the honest default: an inheritance is a claim, and an
        // unstated one is not a claim.
        compoundInherited: raw.compound?.inherited ?? false,
        formationNodesTotal: total,
        formationNodesLit: lit,
        description: raw.description ?? ''
    };
}

function mapRegion(raw: RawRegion): CatalogRegion {
    const profile = raw.ambientProfile ?? {};
    return {
        id: raw.id,
        name: raw.name,
        home: raw.role === 'home',
        summary: raw.summary ?? '',
        ambient: dominantAmbient(profile),
        qiDensity: densityFromProfile(profile),
        localCeilingOrdinal: clampOrdinal(raw.localCeilingOrdinal ?? 20),
        hazards: (raw.hazards ?? []).map(normaliseHazard),
        ambientRateMultiplier: raw.cultivation?.ambientRateMultiplier ?? 1,
        politics: normalisePolitics(raw.politics),
        factionIds: (raw.factionIds ?? []).slice(),
        places: (raw.places ?? []).map(p => ({
            name: p.name,
            kind: p.kind as CatalogPlace['kind'],
            ambient: p.ambient,
            note: p.note
        })),
        connections: (raw.connections ?? []).map(c => ({
            otherRegionId: c.otherRegionId,
            kind: c.kind,
            travelDays: c.travelDays
        })),
        exports: (raw.exports ?? []).slice(),
        // The region's own account of its veins is the closest thing the
        // content has to a scar list, and it is usually literally about what an
        // old war did to the ground.
        scars: raw.veinStatus ? [raw.veinStatus] : [],
        specialRules: (raw.cultivation?.missingDisciplines ?? []).map(m => `${m.discipline}: ${m.reason}`),
        veinStatus: raw.veinStatus ?? ''
    };
}

/**
 * Hazard tags, normalised to the vocabulary the capability layer matches on.
 *
 * Content writes hazards as prose fragments; `capability.ts` matches them by
 * string against what a technique claims to counter. Anything unrecognised is
 * passed through lowercased rather than dropped, so a new hazard becomes
 * matchable the moment somebody writes a counter for it.
 */
function normaliseHazard(raw: string): string {
    const s = raw.toLowerCase();
    if (s.includes('thin') || s.includes('poor')) return 'thin_qi';
    if (s.includes('cold') || s.includes('frost') || s.includes('ice')) return 'cold';
    if (s.includes('poison') || s.includes('corrupt') || s.includes('rot')) return 'corrosive';
    if (s.includes('formation') || s.includes('array')) return 'formation';
    if (s.includes('beast')) return 'beasts';
    if (s.includes('storm') || s.includes('lightning')) return 'lightning';
    if (s.includes('flood') || s.includes('water')) return 'flooding';
    return s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unmarked';
}

function normaliseGovernance(raw: string | undefined): GovernanceModel {
    if (raw === 'federated' || raw === 'administered' || raw === 'deference' || raw === 'unbacked') {
        return raw;
    }
    // A faction the hierarchy catalog says nothing about answers to nobody,
    // which is the honest default and the one that produces the fewest
    // invented obligations.
    return 'unbacked';
}

function normalisePolitics(raw: string | undefined): CatalogRegion['politics'] {
    return raw === 'single_hegemon' || raw === 'no_authority' ? raw : 'competing_sects';
}

function normaliseAlignment(raw: string | undefined): CatalogFaction['alignment'] {
    return raw === 'righteous' || raw === 'demonic' ? raw : 'neutral';
}

/** First year figure in a renewal clause, or zero when nothing is renewed. */
function renewalYearsOf(renewal: string | undefined): number {
    if (!renewal) return 0;
    const m = /(\d+)[- ]?year|\b(twelve|ten|twenty|thirty|fifty|hundred)\b/i.exec(renewal);
    if (!m) return 0;
    if (m[1]) return Number(m[1]);
    const words: Record<string, number> = {
        twelve: 12, ten: 10, twenty: 20, thirty: 30, fifty: 50, hundred: 100
    };
    return words[m[2].toLowerCase()] ?? 0;
}

/**
 * The three ordinals `productionOf` throws away.
 *
 * A house may record its production as a bare tier string, in which case it has
 * said nothing about ordinals and zero is the honest answer - a caller reading
 * zero knows it is unstated rather than believing the house can produce nobody.
 */
function productionOrdinalsOf(character: RawCharacter | undefined): {
    reliableOrdinal: number; peakOrdinal: number; yearsSinceLastPeak: number;
} {
    const p = character?.production;
    if (!p || typeof p === 'string') {
        return { reliableOrdinal: 0, peakOrdinal: 0, yearsSinceLastPeak: 0 };
    }
    return {
        reliableOrdinal: clampOrdinal(p.reliableOrdinal ?? 0),
        peakOrdinal: clampOrdinal(p.peakOrdinal ?? 0),
        yearsSinceLastPeak: Math.max(0, Number(p.yearsSinceLastPeak ?? 0))
    };
}

function productionOf(character: RawCharacter | undefined): number {
    const p = character?.production;
    if (typeof p === 'string') return tierToNumber(p);
    if (p && typeof p === 'object') {
        if (typeof p.selfSufficiency === 'number') return clamp01(p.selfSufficiency);
        if (typeof p.tier === 'string') return tierToNumber(p.tier);
    }
    return 0.5;
}

function tierToNumber(tier: string): number {
    const s = tier.toLowerCase();
    if (s.includes('self') || s.includes('surplus') || s.includes('exports')) return 0.9;
    if (s.includes('sufficient') || s.includes('adequate')) return 0.65;
    if (s.includes('depend') || s.includes('import') || s.includes('deficit')) return 0.3;
    if (s.includes('none') || s.includes('nothing')) return 0.1;
    return 0.5;
}

function clampOrdinal(n: number): number {
    // `MAX_ORDINAL`, not a literal 44. The hard-coded bound silently truncated
    // every figure above the last mortal rung on its way into the world: a
    // house recording an ancestor at `TRUE_IMMORTAL_ORDINAL` reached the
    // simulation as 44, and a province declaring an uncapped ceiling reported
    // 44 as though somebody had chosen it. `realms.ts` is the authority on the
    // ladder's bounds and restating them anywhere else goes stale in silence.
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(n)));
}

function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
