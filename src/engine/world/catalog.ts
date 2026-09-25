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
import type { LinkKind } from './locations.js';

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
export type GovernanceModel = 'federated' | 'administered' | 'unbacked' | 'bloodline';

/**
 * How much goes past ONE place a house collects at. Mirrors `LevyTrafficSchema`
 * in the governance catalog; declared here for the same reason
 * `GovernanceModel` is, so the world layer does not import content.
 */
export type LevyTraffic = 'a trickle' | 'a road' | 'a city gate' | 'a province';

const LEVY_TRAFFIC: readonly LevyTraffic[] = ['a trickle', 'a road', 'a city gate', 'a province'];

/**
 * How much rock, as against whether there is any. Mirrors `VeinWorthSchema`.
 *
 * Declared here for the same reason `LevyTraffic` is: the world layer states
 * the shapes it consumes and never imports content.
 */
export type VeinWorth = 'a thin seam' | 'a working vein' | 'an arterial' | 'a vein system';

const VEIN_WORTH: readonly VeinWorth[] = ['a thin seam', 'a working vein', 'an arterial', 'a vein system'];

/** The dearest thing a house can finish. Mirrors `TradeGradeSchema`. */
export type TradeGrade = 'mortal' | 'earth' | 'heaven';

/** How much of the house the trade is. Mirrors `TradeDevotionSchema`. */
export type TradeDevotion = 'a sideline' | 'a hall' | 'the house';

const TRADE_GRADE: readonly TradeGrade[] = ['mortal', 'earth', 'heaven'];
const TRADE_DEVOTION: readonly TradeDevotion[] = ['a sideline', 'a hall', 'the house'];

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
    /**
     * Unbacked, and holding its ground on what people believe would happen to
     * whoever went and took it. The only hold in the world that can go in a
     * season without anybody crossing a line, which is why it is a field
     * rather than a sentence: `the-world-changing-on-its-own.ts` tests it.
     */
    holdsByReputation: boolean;
    /** Who it answers to, when anyone. */
    parentFactionId: string | null;
    /**
     * Whether any of what it holds is a spirit vein. Stated on the parentage
     * record, never read off the prose beside it.
     *
     * This was `Boolean(parent.holds)` over a required sentence, so it was true
     * for 38 of 38 while the sentences said "chosen for having no vein under
     * it", "no ground at all", "Nothing whatsoever". Everything downstream of
     * it was already written to branch - `seedSectGround`'s formation hazard,
     * `resources.veins`, the vein a house is given control of, the compound's
     * vein chamber - and none of those branches had ever been taken.
     */
    holdsVein: boolean;
    /**
     * HOW MUCH rock, or null where none. Derives `holdsVein` above.
     *
     * The boolean was the next bug after `Boolean(parent.holds)`: yes or no
     * gave every holder one identical vein, so the house on "the least valuable
     * grant in the province" drew exactly what the house on "the richest vein
     * anyone has ever surveyed" drew, and out-earned the court above it.
     */
    veinWorth: VeinWorth | null;
    /**
     * What it charges and where, or null where it charges nobody.
     *
     * Not exclusive with `holdsVein`: several houses hold ground and a gate.
     * `on` is carried across for a reader and is never switched on.
     */
    levy: { on: string; posts: number; traffic: LevyTraffic } | null;
    /**
     * What it MAKES, and how much of the house that is.
     *
     * The third fact the content stated and the world could not read, after
     * `holdsVein` and the levy. `makes` is carried for a reader and is never
     * parsed; `seeding.ts` prices the two words and nothing else.
     */
    trade: { makes: string; grade: TradeGrade; devotion: TradeDevotion } | null;
    tributeStonesPerYear: number;
    /** Years between grant renewals. Zero when nothing is renewed. */
    renewalYears: number;
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
    /**
     * The same curriculum with each road's CEILING beside it.
     *
     * A house is a shelf rather than a single art: a primary road that carries
     * high and secondary roads that stop lower. `teachesElements` flattens that
     * away, and the ceiling is exactly what decides how far somebody whose root
     * can only walk the secondary road gets to rise - so a wood-rooted member of
     * a water house is neither excluded nor equal, they have a real career with
     * a real ceiling and it is their root that put it there.
     *
     * Read by `what-root-a-seeded-house-member-has.ts`. Kept beside
     * `teachesElements` rather than replacing it so nothing already reading the
     * flat list has to change.
     */
    teachesRoads: { element: string | null; cap: number }[];
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
    /**
     * Places inside the same province this one is next to, in walking days.
     *
     * The same shape as `CatalogConnection` one level up and deliberately in
     * the same unit, so nothing here is a second opinion about how far apart
     * two places are. Declared on one end only - `seeding.ts` hands each row
     * to `linkLocations`, which writes both directions - and sparse, so an
     * absent entry means "no stated road", never "unreachable".
     *
     * OPTIONAL, and it has to be. A `WorldCatalog` is not always built by
     * `mapRegion` - tests and probes assemble one by hand, and several dozen
     * of them do - so a required array here made every hand-built place a
     * crash in the seeder rather than a place with no neighbours. Sparse is
     * the whole design of this field, and undefined is the sparsest it gets.
     */
    connections?: PlaceConnection[];
    /**
     * The house that administers this settlement, or null where nobody does.
     *
     * Joined here rather than authored here, the same way `mapFaction` joins
     * parentage onto a sect: the prefecture register answers it for the two
     * provinces that have prefectures, the place's own row answers it for the
     * four that do not, and `seedRegions` stamps whichever answered onto
     * `LocationRecord.controllingFactionId`.
     *
     * Null is an answer and undefined is not. Null means the catalog says
     * nobody holds this - a basin the register carries with no name against it,
     * a province that states nobody in it holds ground. Undefined means nothing
     * has been written, which `whoHoldsTheGround` reports as `unrecorded` and
     * nothing may read as a vacuum.
     */
    heldByFactionId?: string | null;
}

export interface PlaceConnection {
    otherPlaceName: string;
    /** A `LinkKind`. Passed to `linkLocations` untranslated. */
    kind: LinkKind;
    travelDays: number;
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
    const capOfId = new Map<string, number>();
    for (const t of (((techniques as {
        TECHNIQUES?: { id: string; element?: string | null; cap?: number }[]
    } | null)?.TECHNIQUES) ?? [])) {
        elementOf.set(t.id, t.element ?? null);
        capOfId.set(t.id, Number(t.cap ?? 0));
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
            teachesElements: (raw.teaches ?? []).map(id => elementOf.get(id) ?? null),
            teachesRoads: (raw.teaches ?? []).map(id => ({
                element: elementOf.get(id) ?? null,
                cap: capOfId.get(id) ?? 0
            }))
        }));
    }

    // The political layer. It is the authority on who administers a settlement
    // wherever it carries one, and it has never been read by `src/` outside
    // `ground-holder.ts` - which is why every town in a seeded world had a null
    // holder while the catalog had been answering the question for two of the
    // six provinces all along.
    const register = ((regions as { PREFECTURES?: readonly RawPrefecture[] }).PREFECTURES ?? []);

    const mapped: CatalogRegion[] = [];
    for (const raw of (regions.REGIONS ?? []) as unknown as RawRegion[]) {
        mapped.push(mapRegion(raw, register));
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
    holdsByReputation?: boolean;
    parentFactionId?: string | null;
    holds?: string | null;
    veinWorth?: string | null;
    levy?: { on?: string; posts?: number; traffic?: string } | null;
    trade?: { makes?: string; grade?: string; devotion?: string } | null;
    terms?: { tributeStonesPerYear?: number; renewal?: string } | null;
}

interface RawCharacter {
    /** `faction-character.ts`'s `ProductionTier`, and nothing else is authored. */
    production?: {
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
    places?: {
        name: string;
        kind: string;
        ambient: AmbientQi;
        note: string;
        heldByFactionId?: string | null;
        connections?: { otherPlaceName: string; kind: string; travelDays: number }[];
    }[];
    connections?: { otherRegionId: string; kind: string; travelDays: number }[];
    exports?: string[];
    veinStatus?: string;
}

function mapFaction(
    raw: RawSect,
    parent?: RawParentage,
    character?: RawCharacter,
    sealedCeilingOrdinal = 0,
    architecture: {
        preferredRoots: readonly string[];
        teachesElements: (string | null)[];
        teachesRoads?: { element: string | null; cap: number }[];
    } = { preferredRoots: [], teachesElements: [], teachesRoads: [] }
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
        holdsByReputation: parent?.holdsByReputation === true,
        parentFactionId: parent?.parentFactionId ?? null,
        holdsVein: veinWorthOf(parent) !== null,
        veinWorth: veinWorthOf(parent),
        levy: levyOf(parent),
        trade: tradeOf(parent),
        tributeStonesPerYear: parent?.terms?.tributeStonesPerYear ?? 0,
        renewalYears: renewalYearsOf(parent?.terms?.renewal),
        ...productionOrdinalsOf(character),
        formationIntegrity: total > 0 ? Number((lit / total).toFixed(4)) : 1,
        sealedCeilingOrdinal,
        preferredRoots: architecture.preferredRoots.slice(),
        teachesElements: architecture.teachesElements.slice(),
        teachesRoads: (architecture.teachesRoads ?? []).slice(),
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

/**
 * A prefecture row, as much of one as this join needs.
 *
 * Structural rather than imported, so `catalog.ts` keeps its one rule: the
 * engine reads the content catalogs and never depends on their types.
 */
interface RawPrefecture {
    kind: string;
    seat: string;
    places: readonly string[];
    heldByFactionId: string | null;
}

/**
 * Who administers a settlement, from whichever layer actually says.
 *
 * BASINS ONLY, AND ON `places` RATHER THAN `seat`. Both narrowings are the
 * register's own distinctions rather than this function's.
 *
 * A basin is ground and a face district is WORK - "there is nothing in the air,
 * so a holding is not ground, it is work. Every one of these is held by an
 * office or by nobody", which is the banner over the Buddha Precipice rows. So
 * holding a face district says who cuts the stone, not who governs the village
 * beside it: the Bountiful Sheaf Sect holds a salvage contract over a worked-out
 * face and the Clearwater Ward administers two faces "on the Myriad Course
 * Hall's behalf", and `DIRECT_RULE` states in one word - `noSkim` - that nothing
 * is taken by an intermediate tier. Reading either as a town's holder would put
 * an income in a bureau's hands that the catalog says it does not have.
 *
 * And `places` are the settlements INSIDE a district while `seat` is the one it
 * is RUN OUT OF, which the schema states and which are different facts: Iron
 * Crest is the seat of two face districts and is inside neither.
 *
 * Where a basin carries the place, its answer stands - `null` included, which is
 * ground the register prints with nobody's name against it and is the catalog's
 * own considered answer rather than a gap. Then the place's own row, for the
 * four provinces that have no prefectures and for the province whose districts
 * are work. Then undefined, which is nothing having been written.
 */
function whoAdministers(
    place: { name: string; heldByFactionId?: string | null },
    register: readonly RawPrefecture[]
): string | null | undefined {
    const wanted = place.name.trim().toLowerCase();
    for (const prefecture of register) {
        if (prefecture.kind !== 'basin') continue;
        if (prefecture.places.some(p => p.trim().toLowerCase() === wanted)) {
            return prefecture.heldByFactionId;
        }
    }
    return place.heldByFactionId;
}

function mapRegion(raw: RawRegion, register: readonly RawPrefecture[]): CatalogRegion {
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
            note: p.note,
            heldByFactionId: whoAdministers(p, register),
            connections: (p.connections ?? []).map(c => ({
                otherPlaceName: c.otherPlaceName,
                kind: c.kind as LinkKind,
                travelDays: c.travelDays
            }))
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
    // `unassailable` is deliberately not here: it is the hierarchy catalog's
    // word for a body nothing can be sent against, and from the world's side
    // that body holds from nobody like any other unbacked one.
    if (raw === 'federated' || raw === 'administered' || raw === 'unbacked' || raw === 'bloodline') {
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

/**
 * A record charges nobody unless it says so, and says it in a readable shape.
 *
 * A half-stated levy is dropped rather than defaulted: a post count of zero or
 * a traffic word this layer does not know is an authoring mistake, and giving
 * it a fallback would hide the mistake behind an income.
 */
function levyOf(parent: RawParentage | undefined): CatalogFaction['levy'] {
    const raw = parent?.levy;
    if (!raw) return null;
    const posts = Math.floor(Number(raw.posts ?? 0));
    const traffic = LEVY_TRAFFIC.find(t => t === raw.traffic);
    if (!Number.isFinite(posts) || posts < 1 || !traffic) return null;
    return { on: String(raw.on ?? ''), posts, traffic };
}

/**
 * How much rock, or null where none is stated.
 *
 * A word this layer does not know is read as no vein rather than defaulted to
 * one, for the same reason a half-stated levy is dropped: a fallback would hide
 * an authoring mistake behind an income.
 */
function veinWorthOf(parent: RawParentage | undefined): VeinWorth | null {
    return VEIN_WORTH.find(w => w === parent?.veinWorth) ?? null;
}

/**
 * What a house makes, or null where the catalog says nothing.
 *
 * Both words have to land. A trade with a grade this layer does not know is a
 * trade nobody can price, and pricing it at the floor would say a house makes
 * trinkets when what the row actually contains is a typo.
 */
function tradeOf(parent: RawParentage | undefined): CatalogFaction['trade'] {
    const raw = parent?.trade;
    if (!raw) return null;
    const grade = TRADE_GRADE.find(g => g === raw.grade);
    const devotion = TRADE_DEVOTION.find(d => d === raw.devotion);
    if (!grade || !devotion) return null;
    return { makes: String(raw.makes ?? ''), grade, devotion };
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
 * WHAT WENT WITH `productionOf`, AND WHY ITS CALLERS NOW READ ORDINALS.
 *
 * There was a `production: number`, 0..1, beside these. It looked for
 * `character.production.selfSufficiency` or `character.production.tier`;
 * neither is authored anywhere, so it returned its 0.5 fallback for all 38
 * houses. Measured on the callers: no compound in the world had a workshop,
 * every compound had a treasury, every compound was `'fitted'`, and the income
 * factor `(0.5 + production)` was exactly 1.0 for every house every year.
 *
 * It was not one fact short of working. It was ONE WORD OVER TWO FACTS - what
 * a house turns out in material, and what rung of cultivator it turns out -
 * and only the second is authored. So the number is gone and each caller reads
 * the fact it actually wanted: what a house can put on the ground reads
 * `reliableOrdinal`, and what a house has raw material to work reads
 * `holdsVein`. Nothing in `src/data/cultivation/` states a house's material
 * output, and inventing a scalar for it would have restored the collision.
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

