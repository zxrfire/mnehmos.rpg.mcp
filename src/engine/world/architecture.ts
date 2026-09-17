/**
 * Architecture - the inside of a compound.
 */

import { FOUNDATION_ORDINAL, REALM_TIERS, clampOrdinal } from '../cultivation/realms.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { getSpiritRoot } from '../cultivation/spirit-roots.js';
import { isAtLeast, type KnowingStage } from '../social/discovery.js';
import type { CatalogFaction } from './catalog.js';
import type { ActivityKind } from './npc-state.js';
import {
    evaluateAccess,
    linkLocations,
    makeAffinity,
    makeEnvironment,
    makeLocation,
    makeThresholds,
    type AccessAssessment,
    type AccessQuery,
    type LocationKind,
    type LocationRecord
} from './locations.js';
import { QI_DENSITY_MAX, clampQiDensity, ordinaryBandFor, qiFraction } from './qi-scale.js';

// ─────────────────────────────────────────────────────────────────────────
// HOUSE STYLE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The shape a house builds in.
 */
export type Idiom =
    | 'terraced'      // cut into a slope, one court above the next
    | 'walled_court'  // the ordinary compound: courts inside courts
    | 'carved'        // cut into rock, going in rather than up
    | 'timber_hall'   // long roofed halls, few walls
    | 'tower'         // vertical, and status is height
    | 'cloister'      // one covered ring around one court
    | 'stilted'       // raised over water or marsh
    | 'buried';       // under the ground line entirely

export const IDIOMS: readonly Idiom[] = [
    'terraced', 'walled_court', 'carved', 'timber_hall', 'tower', 'cloister', 'stilted', 'buried'
] as const;

/** How square the stonework is. Read off what the house can still produce. */
export type Precision = 'rough' | 'fitted' | 'exact';

/** How much of the compound is still lit and running. From formation integrity. */
export type Upkeep = 'lit' | 'patched' | 'dark';

/** What the house puts on a wall that it did not have to. From alignment. */
export type Ornament = 'plain' | 'ceremonial' | 'warded' | 'trophied';

/** Whether the compound fits the people in it. From inheritance and reach. */
export type Scale = 'human' | 'oversized' | 'monumental';

/**
 * Where a senior member is permitted to deviate from the house style.
 */
export type DeviationAxis = 'element' | 'scale';

export interface HouseStyle {
    /** Stable per faction. Written to `data.styleId` on everything it builds. */
    id: string;
    factionId: string;
    idiom: Idiom;
    /** Two entries. The first dominates; the second is trim, sills and roofs. */
    materials: string[];
    precision: Precision;
    upkeep: Upkeep;
    ornament: Ornament;
    scale: Scale;
    /**
     * 0..1. How far the buildings themselves are elemental.
     */
    elementalIntensity: number;
    /** The element the intensity is IN, or null where there is none. */
    element: string | null;
    deviation: DeviationAxis;
    /**
     * The matchable facets, as flat strings.
     */
    tags: string[];
}

/** The five wuxing plus the two mutated ones, in the order roots declare them. */
const ELEMENT_MATERIALS: Record<string, [string, string]> = {
    metal: ['dressed grey stone', 'bronze'],
    wood: ['living timber', 'lacquered board'],
    water: ['dark river slab', 'channelled lead'],
    fire: ['fired brick', 'blackened iron'],
    earth: ['rammed earth', 'raw rock'],
    lightning: ['fused sand', 'iron rod'],
    ice: ['blue-veined stone', 'clear ice']
};

/** The ordinary palette, for the houses that are not elemental at all. */
const PLAIN_MATERIALS: Record<Precision, [string, string]> = {
    rough: ['fieldstone', 'thatch'],
    fitted: ['dressed stone', 'tile'],
    exact: ['jointed granite', 'glazed tile']
};

const ELEMENT_IDIOM: Record<string, Idiom> = {
    metal: 'tower',
    wood: 'timber_hall',
    water: 'stilted',
    fire: 'terraced',
    earth: 'carved',
    lightning: 'tower',
    ice: 'buried'
};

/**
 * The shape of a compound that its element does not decide.
 *
 * THIS WAS KEYED ON THE HOUSE'S GOVERNANCE AND IS NOT ANY MORE. The design
 * owner: a building should not use the same flag as the sect, the sect has
 * that flag as a whole, places ought to use something else. The proof that the
 * coupling was wrong is that renaming a political vocabulary was about to
 * change what a compound looked like - two facts that should never have been
 * able to move together.
 *
 * The old reasoning was always about the building and only the key was about
 * the politics, so the reasoning is kept and the key changed:
 *
 * - `cloister`, a covered ring around one court, went to a house that "builds
 *   around the room it is answered in". The fact underneath is that nobody
 *   arrives to join: there is no admission day, no queue and no outer gate to
 *   hold one, so what the compound is built around is the single room where
 *   whoever does come is received.
 * - `walled_court` went to two of the four models and was already the
 *   fallback. A gate, a yard behind it, a wall round the yard.
 *
 * `terraced` is not reachable from here any more and that is stated rather
 * than hidden. It went to a house holding a grant, on the reasoning that it
 * holds ground and the ground here is a slope - which is a fact about the
 * GROUND, and nothing on this input says what the compound is standing on.
 * It stays reachable through the element table, which is where a house's
 * practice already decides its shape. A terrain fact on the seeded site is
 * where the rest of it belongs, and the engine does not have one yet.
 */
function idiomOf(recruits: boolean): Idiom {
    return recruits ? 'walled_court' : 'cloister';
}

/**
 * How elemental a house's buildings are, 0..1.
 */
export function elementalIntensityOf(
    preferredRoots: readonly string[],
    teachesElements: readonly (string | null)[]
): { intensity: number; element: string | null } {
    // Defensive on both lists. `CatalogFaction` gained these fields after a
    // great many fixtures were written against it, and a test world assembled
    // by hand should produce a house with no elemental character rather than
    // taking world seeding down. Same contract the catalog adapter is under: a
    // missing field is a default, never an exception.
    const intake = new Map<string, number>();
    for (const key of Array.isArray(preferredRoots) ? preferredRoots : []) {
        const root = getSpiritRoot(key as never);
        const elements = root?.elements ?? [];
        if (elements.length === 0) continue;
        const share = 1 / elements.length;
        for (const e of elements) intake.set(e, (intake.get(e) ?? 0) + share);
    }
    // NARROWNESS IS THE COUNT OF ELEMENTS THE HOUSE WILL ADMIT AT ALL, not the
    // dominant share of a weighted distribution. Measured: the weighted version put
    // seven houses in the absolutist band, including the Azure Cloud Pavilion,
    // whose intake is metal-dominant but who also takes dual roots and puts
    // uncultivated mortals on probation to find out what they are - its courtyards
    // are courtyards. A house is only built for one element if there is only one
    // element in the building, and a house that will take a muddled five-element
    // root has every element in the building whatever its curriculum says.
    let intakeElement: string | null = null;
    let dominant = 0;
    for (const [element, weight] of intake) {
        if (weight > dominant) {
            dominant = weight;
            intakeElement = element;
        }
    }
    const narrowness = intake.size > 0 ? 1 / intake.size : 0;

    const taught = new Map<string, number>();
    let taughtTotal = 0;
    for (const e of Array.isArray(teachesElements) ? teachesElements : []) {
        taughtTotal += 1;
        if (e === null) continue;
        taught.set(e, (taught.get(e) ?? 0) + 1);
    }
    let taughtElement: string | null = null;
    let taughtShare = 0;
    for (const [element, count] of taught) {
        if (count > taughtShare) {
            taughtShare = count;
            taughtElement = element;
        }
    }
    taughtShare = taughtTotal > 0 ? taughtShare / taughtTotal : 0;

    // Intake is a CEILING on the curriculum, not a peer of it. A house that
    // takes every root cannot be elemental however single-minded its library
    // is, and a house that takes one root is elemental even where its library
    // is broad, because the people in the building are what the building is
    // for. The curriculum only decides how far up to the ceiling it goes.
    const intensity = Number((narrowness * (0.6 + 0.4 * taughtShare)).toFixed(4));
    const element = intakeElement ?? taughtElement;
    return { intensity: Math.max(0, Math.min(1, intensity)), element: intensity > 0 ? element : null };
}

/**
 * The rung a realm opens at, so no bound on the ladder is restated here.
 */
function realmOpensAt(key: string): number {
    return REALM_TIERS.find(t => t.key === key)?.ordinalStart ?? FOUNDATION_ORDINAL;
}

/**
 * What a house can still produce, as squareness of stonework.
 *
 * Stone is cut by the people the house has, so the reading is the rung it
 * reliably turns out. This took a 0..1 `production` that was 0.5 for every
 * house in the world, which made every compound `'fitted'` and the field a
 * constant. Measured on the catalog with the ordinal in: 8 exact, 26 fitted,
 * 4 rough.
 */
function precisionOf(reliableOrdinal: number): Precision {
    if (reliableOrdinal >= realmOpensAt('deity_transformation')) return 'exact';
    if (reliableOrdinal >= FOUNDATION_ORDINAL) return 'fitted';
    return 'rough';
}

/** What fraction of its own inheritance is still running, as light. */
function upkeepOf(formationIntegrity: number): Upkeep {
    if (formationIntegrity >= 0.7) return 'lit';
    if (formationIntegrity >= 0.3) return 'patched';
    return 'dark';
}

function ornamentOf(alignment: CatalogFaction['alignment']): Ornament {
    if (alignment === 'demonic') return 'trophied';
    if (alignment === 'righteous') return 'ceremonial';
    // A NEUTRAL HOUSE SHOWS NOTHING, and the arm that has gone was already
    // unreachable. It read `governance === 'deference' ? 'warded' : 'plain'`,
    // and the one house in the catalog that carried `deference` is righteous,
    // so it took the line above this one every time. Nothing in the world
    // changes by removing it; what changes is that a building no longer reads
    // how a sect is backed. `warded` stays in the vocabulary and is not
    // currently produced.
    return 'plain';
}

/**
 * Whether the compound fits the people in it.
 */
function scaleOf(inherited: boolean, powerOrdinal: number, admissionOrdinal: number): Scale {
    if (!inherited) return 'human';
    const reach = powerOrdinal - admissionOrdinal;
    return reach >= 20 ? 'monumental' : 'oversized';
}

export interface StyleInput {
    factionId: string;
    alignment: CatalogFaction['alignment'];
    /** Whether anybody arrives to join, which decides what the place is built around. */
    recruits: boolean;
    /** The rung it reliably turns out, from `ProductionTier`. Cuts its stone. */
    reliableOrdinal: number;
    formationIntegrity: number;
    inherited: boolean;
    powerOrdinal: number;
    admissionOrdinal: number;
    preferredRoots: readonly string[];
    teachesElements: readonly (string | null)[];
}

/**
 * The house's design language, as a pure function of what the catalog holds.
 */
export function houseStyleOf(input: StyleInput): HouseStyle {
    const { intensity, element } = elementalIntensityOf(input.preferredRoots, input.teachesElements);
    const precision = precisionOf(input.reliableOrdinal);
    const upkeep = upkeepOf(input.formationIntegrity);
    const ornament = ornamentOf(input.alignment);
    const scale = scaleOf(input.inherited, input.powerOrdinal, input.admissionOrdinal);

    // The element only reaches the IDIOM at the top of the range. A partially
    // coloured house builds ordinary buildings and shows its element in trim;
    // an absolutist house's element decides the shape of the place.
    const elemental = element !== null && intensity >= ELEMENTAL_IDIOM_FLOOR;
    const idiom = elemental
        ? ELEMENT_IDIOM[element] ?? idiomOf(input.recruits)
        : idiomOf(input.recruits);

    const plain = PLAIN_MATERIALS[precision];
    const materials = elemental
        ? (ELEMENT_MATERIALS[element] ?? plain).slice()
        : element !== null && intensity >= ELEMENTAL_TRIM_FLOOR
            // Coloured, not built of it: the element is the second material,
            // which is trim, sills and roofs and nothing structural.
            ? [plain[0], (ELEMENT_MATERIALS[element] ?? plain)[1]]
            : plain.slice();

    const tags = [
        `idiom:${idiom}`,
        `material:${materials[0].replace(/\s+/g, '_')}`,
        `trim:${materials[1].replace(/\s+/g, '_')}`,
        `precision:${precision}`,
        `upkeep:${upkeep}`,
        `ornament:${ornament}`,
        `scale:${scale}`
    ];
    if (elemental) tags.push(`element:${element}`);

    return {
        id: `style:${input.factionId}`,
        factionId: input.factionId,
        idiom,
        materials,
        precision,
        upkeep,
        ornament,
        scale,
        elementalIntensity: intensity,
        element: intensity > 0 ? element : null,
        // A house with nothing to deviate from signals rank by space instead.
        deviation: elemental ? 'scale' : 'element',
        tags
    };
}

/** At and above this, the element decides the SHAPE of the buildings. */
export const ELEMENTAL_IDIOM_FLOOR = 0.66;
/** At and above this, the element appears in trim and nowhere else. */
export const ELEMENTAL_TRIM_FLOOR = 0.28;

// ─────────────────────────────────────────────────────────────────────────
// READING A STYLE BACK OFF A BUILDING
// ─────────────────────────────────────────────────────────────────────────

/** The style tags a location carries, or an empty list. */
export function styleTagsOf(location: LocationRecord): string[] {
    const raw = location.data.styleTags;
    if (typeof raw !== 'string' || raw.length === 0) return [];
    return raw.split(' ').filter(Boolean);
}

/**
 * Facets in the order they stop being readable.
 */
const FACET_DECAY: readonly (readonly string[])[] = [
    ['ornament:'],                      // lost first: hung, and worth taking
    ['upkeep:'],                        // meaningless once nothing is maintained
    ['trim:', 'precision:'],            // roofs, sills, and the finish on them
    ['idiom:', 'material:', 'scale:', 'element:']  // the ground. Lost with the site.
];

/**
 * What can still be read off a building of this age.
 *
 * `new` loses the ornament, `old` loses the finish as well, `ancient` is down
 * to the plan and the stone. Ages are the ones `provenance.ts` already uses.
 */
export function survivingTags(
    tags: readonly string[],
    age: 'new' | 'old' | 'ancient'
): string[] {
    const lost = age === 'new' ? 1 : age === 'old' ? 2 : 3;
    const gone = FACET_DECAY.slice(0, lost).flat();
    return tags.filter(t => !gone.some(prefix => t.startsWith(prefix)));
}

/**
 * A style read back off a building it was stamped on.
 *
 * The inverse of the `tags` half of `houseStyleOf`, and it exists because
 * everything that wants to DESCRIBE a building has a `LocationRecord` and not a
 * catalog row - `describeRoom` takes a `HouseStyle`, and reconstructing one from
 * the faction would mean the description depended on what the house is like
 * TODAY rather than on what it built. The tags are what was cut into the stone.
 *
 * `elementalIntensity` cannot come back: the tag records that the element
 * reached the idiom, not by how much. It returns at the floor that produced the
 * tag, which is the strongest claim the evidence supports.
 */
export function houseStyleFromTags(location: LocationRecord): HouseStyle | null {
    const tags = styleTagsOf(location);
    if (tags.length === 0) return null;
    const facet = (prefix: string): string | null =>
        tags.find(t => t.startsWith(prefix))?.slice(prefix.length) ?? null;

    const idiom = facet('idiom:') as Idiom | null;
    const material = facet('material:');
    const trim = facet('trim:');
    if (idiom === null || !IDIOMS.includes(idiom) || material === null || trim === null) return null;
    const element = facet('element:');

    return {
        id: String(location.data.styleId ?? ''),
        factionId: String(location.data.factionId ?? ''),
        idiom,
        materials: [material.replace(/_/g, ' '), trim.replace(/_/g, ' ')],
        precision: (facet('precision:') as Precision | null) ?? 'fitted',
        upkeep: (facet('upkeep:') as Upkeep | null) ?? 'patched',
        ornament: (facet('ornament:') as Ornament | null) ?? 'plain',
        scale: (facet('scale:') as Scale | null) ?? 'human',
        elementalIntensity: element === null ? 0 : ELEMENTAL_IDIOM_FLOOR,
        element,
        deviation: element === null ? 'element' : 'scale',
        tags
    };
}

export interface StyleMatch {
    factionId: string;
    /** Shared facets over total facets, 0..1. */
    score: number;
    shared: string[];
}

/**
 * Which houses could have built this, and how many.
 */
export function matchHouseStyle(
    observedTags: readonly string[],
    candidates: readonly HouseStyle[]
): StyleMatch[] {
    const observed = new Set(observedTags);
    if (observed.size === 0) return [];
    const out: StyleMatch[] = [];
    for (const candidate of candidates) {
        const shared = candidate.tags.filter(t => observed.has(t));
        out.push({
            factionId: candidate.factionId,
            // Over what was OBSERVED, not over what the candidate has. A
            // weathered site offers three facets; a house that matches all
            // three is a complete match on the available evidence, and scoring
            // it against the eight facets a standing compound would have shown
            // makes every candidate look equally poor and destroys the ranking.
            score: Number((shared.length / observed.size).toFixed(4)),
            shared
        });
    }
    return out.sort((a, b) => b.score - a.score || a.factionId.localeCompare(b.factionId));
}

/**
 * How hard this building is to attribute, as the number of houses that match it as
 * well as the best one does.
 */
export function attributionField(
    observedTags: readonly string[],
    candidates: readonly HouseStyle[]
): { best: number; field: number } {
    const matches = matchHouseStyle(observedTags, candidates);
    if (matches.length === 0) return { best: 0, field: 0 };
    const best = matches[0].score;
    return { best, field: matches.filter(m => m.score >= best - 1e-9).length };
}

// ─────────────────────────────────────────────────────────────────────────
// PRECINCTS - THE HOUSE'S OWN LADDER, MADE OF WALLS
// ─────────────────────────────────────────────────────────────────────────

export interface Precinct {
    /** 0 is outermost. */
    index: number;
    /** The rank whose people live and work behind this wall. */
    rank: string;
    /** The ordinal the wall is calibrated at. */
    entryOrdinal: number;
    /** 0..1, outermost to innermost. What privacy the space buys. */
    privacy: number;
}

/**
 * The compound's precincts, one per rank in the house's own ladder.
 */
export function precinctsOf(faction: {
    ranks: readonly string[];
    admissionOrdinal: number;
    powerOrdinal: number;
}): Precinct[] {
    const ranks = faction.ranks.length > 0 ? faction.ranks : ['Disciple', 'Elder'];
    const low = clampOrdinal(faction.admissionOrdinal);
    const high = Math.max(low, clampOrdinal(faction.powerOrdinal));
    const span = ranks.length > 1 ? ranks.length - 1 : 1;

    return ranks.map((rank, index) => ({
        index,
        rank,
        entryOrdinal: clampOrdinal(Math.round(low + (high - low) * (index / span))),
        privacy: Number((index / span).toFixed(4))
    }));
}

// ─────────────────────────────────────────────────────────────────────────
// THE ROOM GRAMMAR
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a room is FOR. Content, stored as `data.purpose`, matched by string.
 */
export type RoomPurpose =
    | 'gatehouse'
    | 'forecourt'
    | 'practice_yard'
    | 'refectory'
    | 'dormitory'
    | 'scripture_pavilion'
    | 'archive'
    | 'alchemy_hall'
    | 'furnace_room'
    | 'infirmary'
    | 'workshop'
    | 'audience_hall'
    | 'tribute_room'
    | 'meditation_cell'
    | 'vein_chamber'
    | 'ancestral_hall'
    | 'under_hall'
    | 'treasury'
    /**
     * Where a house holds one of its own.
     */
    | 'punishment_hall'
    /**
     * Where the house's work is posted, taken, and reported as taken.
     *
     * THE ONE OFFICE THAT IS NOT A LOCKED ROOM, and the reason `office` had to
     * stop being `sealed`. The design owner: *"to take a mission YOU HAVE TO
     * REPORT IT TO SOMEONE, THE MISSION HALL WHICH THE MISSION ELDER IS
     * RESPONSIBLE FOR."* Before this the missions elder was a phrase in three
     * refusal strings and a docs page with nowhere in the world to stand, so
     * taking board work had no counterparty at all.
     */
    | 'mission_hall'
    /**
     * Where somebody gives a talk to whoever of the house is inside to hear it.
     *
     * The design owner: dao lectures are a common part of the genre, given by
     * whoever is the most advanced available, and anyone inside may attend. A
     * lecture here is the ordinary `teaching` activity with everybody in the
     * room in its `withIds` - see `a-teacher-giving-you-their-attention.ts` - so
     * the room adds no rule of its own about who may listen. Who can reach it is
     * the access chain's answer, the same as for every other room.
     */
    | 'lecture_hall'
    | 'residence'
    | 'formation_node'
    /**
     * Where a house keeps a life lamp burning for each of its own.
     *
     * The design owner's ruling: life lamps, burning in the Life Lamp Hall.
     * Its own room rather than the ancestral hall, which is the
     * house's dead - tablets, and what sleeps under them - where this is the
     * house's living: a lamp that goes out is somebody who just died. The
     * Internal Affairs Elder keeps it. See
     * `a-house-knows-its-own-by-a-lamp-and-a-token.ts`.
     */
    | 'life_lamp_hall'
    /**
     * Where a house forges and refines artifacts, over its earth fire.
     *
     * The design owner: *"same as the pill houses, every house makes artifacts,
     * some are focused on artifacts."* So every compound has one, the way every
     * compound now has an alchemy hall, and a house focused on the craft has a
     * larger one - a difference of degree and not of kind. See
     * {@link whatAHouseIsFocusedOn}.
     */
    | 'artifact_refining_hall';

interface PurposeSpec {
    kind: LocationKind;
    /** Where up the precinct ladder it sits, 0..1. */
    depth: number;
    /**
     * How obvious it is to somebody standing inside the compound, 0..1.
     *
     * Not a global "is it discovered" flag - see {@link roomStageFor}. It is
     * one half of the pair that decides what a given person knows about it.
     */
    obviousness: number;
    /**
     * Ordinals of qi concentration above the compound's own ground, on the
     * 1..100 scale. Non-zero only on `chamber`.
     */
    qiLift: number;
    sealed: boolean;
    /**
     * Whether somebody is IN CHARGE of this room.
     *
     * Split off `sealed`, which was doing this job as a third thing on top of
     * "locked door" and the qi pocket it had already been split from. AGENTS.md
     * names that conflation by measurement, and it had one concrete cost: a
     * room cannot be an office unless it locks, so the missions elder - a role
     * the docs and three refusal strings already name - had nowhere to stand,
     * because a hall disciples walk into to take work is not a locked room.
     *
     * Equal to `sealed` on every purpose that existed before the split, so
     * `whoIsInChargeOfWhat` deals exactly what it dealt.
     */
    office: boolean;
    /** Heads the room was cut for, per unit of the compound's scale. */
    capacityPer: number;
    hazards: string[];
}

/**
 * The ground a house puts somebody it is holding on.
 *
 * `lift` is the marker rather than a magnitude: the discipline hall carries the
 * only negative lift in the table, so "at or below this" names that room and
 * nothing else, and a second room built to be bad ground would join it by
 * saying so in its own spec rather than by anybody editing this.
 *
 * `density` is the absolute figure, hardcoded on the owner's instruction and
 * low enough that `typicalAmbientFor` reads it as the thinnest band there is.
 */
const WHERE_A_HOUSE_PUTS_SOMEBODY_IT_IS_HOLDING = Object.freeze({
    lift: -10,
    density: 2
});

const PURPOSE: Record<RoomPurpose, PurposeSpec> = {
    // ── The outer face. Anyone can stand here; that is the point of it. ──
    gatehouse: { kind: 'hall', depth: 0, obviousness: 1, qiLift: 0, sealed: false, office: false, capacityPer: 0.05, hazards: [] },
    forecourt: { kind: 'hall', depth: 0, obviousness: 1, qiLift: 0, sealed: false, office: false, capacityPer: 0.6, hazards: [] },
    practice_yard: { kind: 'hall', depth: 0.15, obviousness: 0.9, qiLift: 0, sealed: false, office: false, capacityPer: 1, hazards: [] },
    refectory: { kind: 'hall', depth: 0.1, obviousness: 0.85, qiLift: 0, sealed: false, office: false, capacityPer: 0.8, hazards: [] },
    dormitory: { kind: 'hall', depth: 0.1, obviousness: 0.8, qiLift: 0, sealed: false, office: false, capacityPer: 1, hazards: [] },

    // ── The working middle. What the house actually does all day. ────────
    scripture_pavilion: { kind: 'hall', depth: 0.45, obviousness: 0.6, qiLift: 0, sealed: false, office: false, capacityPer: 0.15, hazards: [] },
    archive: { kind: 'vault', depth: 0.75, obviousness: 0.2, qiLift: 0, sealed: true, office: true, capacityPer: 0.04, hazards: ['formation'] },
    alchemy_hall: { kind: 'hall', depth: 0.4, obviousness: 0.6, qiLift: 0, sealed: false, office: false, capacityPer: 0.2, hazards: [] },
    furnace_room: { kind: 'chamber', depth: 0.5, obviousness: 0.35, qiLift: 12, sealed: false, office: false, capacityPer: 0.06, hazards: ['heat'] },
    infirmary: { kind: 'hall', depth: 0.3, obviousness: 0.7, qiLift: 0, sealed: false, office: false, capacityPer: 0.25, hazards: [] },
    workshop: { kind: 'hall', depth: 0.35, obviousness: 0.55, qiLift: 0, sealed: false, office: false, capacityPer: 0.2, hazards: [] },
    // AN OFFICE THAT DOES NOT LOCK, and the one the whole `office`/`sealed`
    // split was for. Disciples walk in to take work and to say they have taken
    // it, so a door on it would be the room failing at its only job.
    //
    // DEPTH 0.3 IS LOAD-BEARING AND IT IS WHY THIS ONE LANDS WHERE THE
    // ANCESTRAL HALL DID NOT. `whoIsInChargeOfWhat` sorts offices DEEPEST-FIRST
    // and deals them round-robin, so a room's index - and therefore every
    // room's index after it - depends on where it sorts. The reverted attempt
    // put the ancestral hall at 0.85, above four of the five offices, and
    // shifted all of them; the note on that room still says no rung could get
    // discipline back afterwards. The shallowest office today is the tribute
    // room at 0.6, so anything under that APPENDS and moves nothing. Deepening
    // this room past 0.6 would reintroduce that defect exactly.
    mission_hall: { kind: 'hall', depth: 0.3, obviousness: 0.9, qiLift: 0, sealed: false, office: true, capacityPer: 0.25, hazards: [] },
    // NOT AN OFFICE, so `whoIsInChargeOfWhat` deals exactly what it dealt: see
    // the note on `mission_hall` above for what adding an office costs. Depth 0
    // puts it in the outermost precinct beside the forecourt, because a talk is
    // given to the house and the house includes its newest disciple. It was
    // 0.15, which `precinctAt` rounds into the SECOND precinct of any house with
    // more than three rungs: behind a wall the bottom rung cannot pass, and past
    // what a newcomer can find, so the people a talk is for could not walk to it.
    lecture_hall: { kind: 'hall', depth: 0, obviousness: 0.85, qiLift: 0, sealed: false, office: false, capacityPer: 0.5, hazards: [] },
    // NOT AN OFFICE, for the reason the ancestral hall is not one - see its
    // note below. Deep, beside the ancestral hall: what it holds is the house's
    // own record of who is alive, and nobody from outside is walked past it.
    life_lamp_hall: { kind: 'hall', depth: 0.85, obviousness: 0.5, qiLift: 0, sealed: false, office: false, capacityPer: 0.05, hazards: [] },
    // NOT AN OFFICE, so the deal is untouched. Beside the alchemy hall in depth,
    // because the two are the house's two crafts, and the same heat hazard the
    // furnace floor carries, because what it burns is fire.
    artifact_refining_hall: { kind: 'hall', depth: 0.4, obviousness: 0.6, qiLift: 0, sealed: false, office: false, capacityPer: 0.2, hazards: ['heat'] },
    audience_hall: { kind: 'hall', depth: 0.55, obviousness: 0.75, qiLift: 0, sealed: false, office: false, capacityPer: 0.3, hazards: [] },
    tribute_room: { kind: 'vault', depth: 0.6, obviousness: 0.3, qiLift: 0, sealed: true, office: true, capacityPer: 0.05, hazards: [] },
    meditation_cell: { kind: 'chamber', depth: 0.5, obviousness: 0.4, qiLift: 8, sealed: false, office: false, capacityPer: 0.12, hazards: [] },
    vein_chamber: { kind: 'chamber', depth: 0.7, obviousness: 0.25, qiLift: 30, sealed: false, office: false, capacityPer: 0.05, hazards: ['formation', 'pressure'] },

    // ── The inner end. Where the house keeps what it will not spend. ─────
    // NOT SEALED, AND THE INTERNAL AFFAIRS ELDER IS THEREFORE STILL ONLY A NAME.
    // MEASURED.
    //
    // The design owner asked for the Internal Affairs Elder to be a role rather
    // than a constant, and in this engine an office IS a sealed room dealt by
    // `whoIsInChargeOfWhat`. So sealing this hall is the whole of the change,
    // and it works: every house then names a real person to it.
    //
    // It was tried and REVERTED, because of what the deal does. Offices are
    // handed out `sealed.map((r, i) => deciders[i % deciders.length])` over the
    // sealed rooms sorted DEEPEST FIRST - so adding a room does not add a seat,
    // it shifts every existing holder by one. The punishment hall is the
    // shallowest sealed room in the table, which means it is dealt last, and
    // adding the ancestral hall above it moved discipline permanently out of
    // reach of the rung that used to hold it. Two played tests failed on a
    // hard-coded name two subsystems away, and no rung in the sect could get it
    // back.
    //
    // That is a fact about the DEAL and not about this room: an office ladder
    // where the number of rooms silently reassigns who runs discipline is going
    // to keep doing this. The office wants that fixed first - portfolios keyed
    // to a room rather than to a position in a list - and then this line is one
    // word.
    ancestral_hall: { kind: 'hall', depth: 0.85, obviousness: 0.5, qiLift: 0, sealed: false, office: false, capacityPer: 0.1, hazards: [] },
    under_hall: { kind: 'vault', depth: 1, obviousness: 0.05, qiLift: 20, sealed: true, office: true, capacityPer: 0.01, hazards: ['sealed_qi', 'formation'] },
    // THE ONE ROOM CUT TO BE BAD GROUND, and the negative lift is the whole
    // mechanism rather than decoration. Every other room in this table either
    // leaves the ground alone or improves it; this one is built to take the vein
    // away from whoever is in it, so time spent here is time off the ladder. That
    // is what makes holding somebody a punishment instead of an inconvenience, and
    // it is read by anything that prices a stay rather than being asserted
    // anywhere. Obvious enough that everybody in the house knows where it is - a
    // discipline hall nobody can find deters nobody - and sealed, because what it
    // holds can walk.
    punishment_hall: { kind: 'vault', depth: 0.65, obviousness: 0.5, qiLift: -10, sealed: true, office: true, capacityPer: 0.04, hazards: ['formation'] },
    treasury: { kind: 'vault', depth: 0.9, obviousness: 0.25, qiLift: 0, sealed: true, office: true, capacityPer: 0.03, hazards: ['formation'] },
    // No qi lift. What seniority buys here is space and privacy, not a better
    // vein - a residence is a room and the ground under it is the ground under
    // everything else. The one place the house style bends is this room, and it
    // bends along `HouseStyle.deviation`.
    residence: { kind: 'hall', depth: 0.95, obviousness: 0.45, qiLift: 0, sealed: false, office: false, capacityPer: 0.05, hazards: [] },

    // ── Outside the walls, and the reason the gate is not the only way. ──
    formation_node: { kind: 'chamber', depth: 0, obviousness: 0.15, qiLift: 0, sealed: false, office: false, capacityPer: 0.01, hazards: ['formation'] }
};

export const ROOM_PURPOSES = Object.keys(PURPOSE) as RoomPurpose[];

/**
 * Whether a room is one somebody is in charge of, and how far in it sits.
 */
export function roomAuthorityOf(
    purpose: RoomPurpose
): { sealed: boolean; office: boolean; depth: number } {
    const spec = PURPOSE[purpose];
    return { sealed: spec.sealed, office: spec.office, depth: spec.depth };
}

/** The purpose a location was built for, or null when it was not built by us. */
export function purposeOf(location: LocationRecord): RoomPurpose | null {
    const raw = String(location.data.purpose ?? '');
    return (ROOM_PURPOSES as readonly string[]).includes(raw) ? raw as RoomPurpose : null;
}

/**
 * The house's own word for a room.
 */
function roomName(purpose: RoomPurpose, style: HouseStyle, precinct: Precinct): string {
    const inward = style.idiom === 'carved' || style.idiom === 'buried';
    const up = style.idiom === 'tower' || style.idiom === 'terraced';
    const position = inward ? 'inner' : up ? 'upper' : 'far';
    switch (purpose) {
        case 'gatehouse': return inward ? 'the mouth' : 'the gatehouse';
        case 'forecourt': return inward ? 'the entry cut' : 'the forecourt';
        case 'practice_yard': return up ? 'the upper yard' : 'the practice yard';
        case 'refectory': return 'the refectory';
        case 'dormitory': return `the ${precinct.rank.toLowerCase()}s' quarters`;
        case 'scripture_pavilion': return inward ? 'the reading cut' : 'the scripture pavilion';
        case 'archive': return `the ${position} archive`;
        case 'alchemy_hall': return 'the alchemy hall';
        case 'furnace_room': return 'the furnace floor';
        case 'infirmary': return 'the infirmary';
        case 'workshop': return 'the workshop';
        case 'mission_hall': return inward ? 'the posting cut' : 'the mission hall';
        case 'lecture_hall': return inward ? 'the speaking cut' : 'the lecture hall';
        case 'life_lamp_hall': return 'the Life Lamp Hall';
        case 'artifact_refining_hall': return inward ? 'the forge cut' : 'the Artifact Refining Hall';
        case 'audience_hall': return 'the audience hall';
        case 'tribute_room': return 'the tribute room';
        case 'meditation_cell': return inward ? 'the sitting cuts' : 'the meditation cells';
        case 'vein_chamber': return 'the vein chamber';
        case 'ancestral_hall': return 'the ancestral hall';
        case 'under_hall': return 'the chamber under the ancestral hall';
        case 'punishment_hall': return inward ? 'the held cuts' : 'the discipline hall';
        case 'treasury': return 'the treasury';
        case 'residence': return `the ${precinct.rank.toLowerCase()}'s residence`;
        case 'formation_node': return 'a formation node';
    }
}

// ─────────────────────────────────────────────────────────────────────────
// GROWING A COMPOUND
// ─────────────────────────────────────────────────────────────────────────

/**
 * Everything the generator needs, and it is all already in the catalogs.
 */
export interface CompoundInput {
    factionId: string;
    factionName: string;
    ranks: readonly string[];
    admissionOrdinal: number;
    powerOrdinal: number;
    recruits: boolean;
    alignment: CatalogFaction['alignment'];
    /** The rung it reliably turns out, from `ProductionTier`. */
    reliableOrdinal: number;
    formationIntegrity: number;
    formationNodesTotal: number;
    formationNodesLit: number;
    inherited: boolean;
    holdsVein: boolean;
    tributeStonesPerYear: number;
    sealedCeilingOrdinal: number;
    preferredRoots: readonly string[];
    teachesElements: readonly (string | null)[];
    /** What the house is for, as tags: 'medicine', 'forge', 'alchemy', 'sword'. */
    specialities: readonly string[];
}

export interface CompoundResult {
    style: HouseStyle;
    precincts: Precinct[];
    /** Every location built, precincts first, ready to push onto world state. */
    locations: LocationRecord[];
    /** Node sites whose array is dead, and the way in they leave open. */
    darkNodeIds: string[];
}

/**
 * How many heads the compound was cut for, per unit of `capacityPer`.
 */
export function compoundCapacityUnit(input: CompoundInput): number {
    const built = input.inherited ? Math.max(input.powerOrdinal, 12) : input.admissionOrdinal + 8;
    return Math.max(20, Math.round(built * 14));
}

/**
 * Build the inside of a compound.
 */
export function growCompound(
    seat: LocationRecord,
    input: CompoundInput,
    opts: { seed: string; presentDay: number }
): CompoundResult {
    const rng = forStream(opts.seed, 'compound', input.factionId);
    const style = houseStyleOf(input);
    const precincts = precinctsOf(input);
    const unit = compoundCapacityUnit(input);
    const locations: LocationRecord[] = [];
    const darkNodeIds: string[] = [];

    const styleData = {
        styleId: style.id,
        styleTags: style.tags.join(' '),
        factionId: input.factionId
    };

    // ── The precincts ────────────────────────────────────────────────────
    const precinctRecords: LocationRecord[] = [];
    for (const precinct of precincts) {
        const outermost = precinct.index === 0;
        // A house with no intake has no probation ground: its outer wall is
        // already the admission bar. A house that recruits lets anybody as far
        // as the first court, which is what makes the gate mean something.
        const entry = outermost && input.recruits ? 0 : precinct.entryOrdinal;
        const record = makeLocation({
            id: precinctId(input.factionId, precinct.index),
            name: `${input.factionName}: the ${precinct.rank.toLowerCase()} precinct`,
            kind: 'precinct',
            layer: seat.layer,
            parentId: seat.id,
            description: precinctDescription(style, precinct, input),
            ambient: seat.ambient,
            qiDensity: seat.qiDensity,
            // entry is the wall. survival is nothing - a courtyard does not
            // kill anybody. operational is the rank's own bar, which is what
            // makes standing in a precinct you have no rank in useless rather
            // than fatal. mastery is the house's reach.
            thresholds: makeThresholds(entry, 0, precinct.entryOrdinal, input.powerOrdinal),
            hazards: seat.hazards.slice(),
            affinities: [],
            environment: makeEnvironment({
                spiritualDensity: qiFraction(seat.qiDensity),
                danger: input.alignment === 'demonic' ? 0.3 : 0.1,
                resources: ['qi'],
                politicalControl: input.factionName,
                specialRules: []
            }),
            controllingFactionId: input.factionId,
            discovered: false,
            tags: ['interior', 'precinct', `rank:${slug(precinct.rank)}`],
            data: {
                ...styleData,
                purpose: 'precinct',
                precinctIndex: precinct.index,
                rank: precinct.rank,
                privacy: precinct.privacy,
                obviousness: 1 - precinct.privacy * 0.6,
                capacity: Math.round(unit * (1 - precinct.privacy * 0.8))
            }
        });
        record.origin.fromDay = seat.origin.fromDay;
        precinctRecords.push(record);
        locations.push(record);
        // Inward from the gate. One day between walls is generous for a
        // compound and is what makes a deep vault expensive to reach.
        const from = precinct.index === 0 ? seat : precinctRecords[precinct.index - 1];
        linkLocations(from, record, 'gate', precinct.index === 0 ? 0 : 1);
    }

    // ── The rooms ────────────────────────────────────────────────────────
    for (const purpose of roomsFor(input)) {
        // A HOUSE FOCUSED ON THE CRAFT CUTS THE ROOM LARGER, and that is the
        // whole of the difference. See `whatAHouseIsFocusedOn`.
        const spec = aRoomOfItsFocus(purpose, input)
            ? {
                ...PURPOSE[purpose],
                capacityPer: PURPOSE[purpose].capacityPer * A_HOUSE_FOCUSED_ON_A_CRAFT_CUTS_ITS_ROOM_THIS_MUCH_LARGER
            }
            : PURPOSE[purpose];
        const at = precinctAt(precincts, spec.depth);
        const host = precinctRecords[at.index];
        if (!host) continue;
        const room = buildRoom(purpose, spec, at, host, input, style, unit, styleData, rng);
        locations.push(room);
        linkLocations(host, room, 'gate', 0);

        // The one place the compound goes deeper than a room: what a house
        // holds asleep is under the hall it venerates, and it is a place with
        // a bar on it rather than a number on a faction sheet.
        if (purpose === 'ancestral_hall' && input.sealedCeilingOrdinal > 0) {
            const under = buildRoom(
                'under_hall', PURPOSE.under_hall, at, room, input, style, unit, styleData, rng
            );
            under.thresholds = makeThresholds(
                clampOrdinal(input.sealedCeilingOrdinal),
                clampOrdinal(input.sealedCeilingOrdinal),
                clampOrdinal(input.sealedCeilingOrdinal),
                clampOrdinal(input.sealedCeilingOrdinal)
            );
            under.data.sealedCeilingOrdinal = input.sealedCeilingOrdinal;
            under.data.keyId = `key:${input.factionId}:under-hall`;
            locations.push(under);
            linkLocations(room, under, 'tunnel', 1);
        }
    }

    // ── The formation nodes ──────────────────────────────────────────────
    locations.push(...growNodes(seat, precinctRecords, input, styleData, darkNodeIds, rng));

    // ── AND THE GROUND ITSELF, WHICH IS THE THING ANYBODY LOOKS AT ───────
    //
    // Here rather than inside `growNodes`, where it used to sit. That function
    // returns early when a house has no nodes, so in a pinned world FOUR of 36
    // seats - Six Li Patrol, Silver Island Market, Hollow Bell Wanderers, Sand
    // Well Caravan - stood on ground carrying no style at all while every
    // precinct inside them carried the full set. `styleTagsOf` on the seat
    // returned nothing, so nothing could attribute the compound by its
    // stonework and the read of what is built there had no material to name.
    //
    // How much of itself the house can still see, recorded where somebody
    // standing outside could count it.
    seat.data.formationNodesTotal = Math.max(0, Math.round(input.formationNodesTotal));
    seat.data.formationNodesLit = input.formationNodesLit;
    seat.data.styleId = style.id;
    seat.data.styleTags = style.tags.join(' ');

    return { style, precincts, locations, darkNodeIds };
}

/**
 * How much more of a room a house focused on its craft cuts, over a house that
 * is not. Twice: the room is where the craft is done, and a house whose trade
 * is the craft has twice the people at it. A difference of degree, as ruled.
 */
export const A_HOUSE_FOCUSED_ON_A_CRAFT_CUTS_ITS_ROOM_THIS_MUCH_LARGER = 2;

/**
 * Which of the two crafts a house is focused on, read off what its catalog row
 * carries for code.
 *
 * A FOCUS IS RARE AND EXCLUSIVE. The design owner: *"Same idea as pills. Almost
 * everyone can do it, few focus exclusively on it."* Every house has both rooms;
 * a focus is a house whose catalog makes the craft its main business.
 *
 * MEDICINE: a house whose `specialities` name `alchemy`. It read `alchemy`,
 * `support` or `cultivation`, which gave 23 of 38 houses the focus - healing
 * arts and qi-gathering manuals are not a trade in medicine. The design owner
 * chose the house: the Cinnabar Crucible Sect, whose trade is the cauldron.
 *
 * FORGING: a house whose `specialities` name `forging`. The design owner chose
 * the Ashen Forge Clan. Both words are a `HouseCraft` in the sect catalog.
 *
 * NOT OUT OF A NAME. Reading the forge focus off "Forge" in a house's name was
 * tried and taken out, because a fact read from a name is a defect this repo has
 * already named; the catalog carries the word now.
 */
export function whatAHouseIsFocusedOn(
    input: Pick<CompoundInput, 'specialities'>
): { pills: boolean; artifacts: boolean } {
    const specialities = new Set(input.specialities.map(s => s.toLowerCase()));
    return {
        pills: specialities.has('alchemy'),
        artifacts: specialities.has('forging')
    };
}

/** Whether this room is the room of a craft this house is focused on. */
function aRoomOfItsFocus(purpose: RoomPurpose, input: CompoundInput): boolean {
    const focus = whatAHouseIsFocusedOn(input);
    return (focus.pills && purpose === 'alchemy_hall') || (focus.artifacts && purpose === 'artifact_refining_hall');
}

/**
 * Which rooms this house has.
 */
export function roomsFor(input: CompoundInput): RoomPurpose[] {
    const out: RoomPurpose[] = ['gatehouse', 'forecourt', 'practice_yard', 'ancestral_hall'];
    const specialities = new Set(input.specialities.map(s => s.toLowerCase()));

    if (input.recruits) out.push('dormitory', 'refectory');
    // A house that takes people in has work for them and somewhere they go to
    // say they have taken it. The same column the dormitory reads: a house
    // that recruits nobody has nobody to post to, and its sendings are settled
    // between the people who decide them.
    if (input.recruits) out.push('mission_hall');
    // A house that can read what it inherited keeps it on shelves. A house
    // that cannot keeps it in a locked room, and that is the same fact wearing
    // a different door: `formationIntegrity` is how much of the inheritance
    // still works, so it decides which of the two the books are behind.
    out.push(input.formationIntegrity >= 0.35 ? 'scripture_pavilion' : 'archive');
    // A deep-foundation house has both: what it teaches, and what nobody has
    // cultivated in centuries.
    if (input.powerOrdinal >= 30 && input.formationIntegrity >= 0.35) out.push('archive');

    // A HOUSE FOCUSED ON MEDICINE has its alchemy hall here and the furnace
    // floor besides. Every other house has an alchemy hall too, appended at the
    // end: see {@link whatAHouseIsFocusedOn}.
    if (whatAHouseIsFocusedOn(input).pills) {
        out.push('alchemy_hall', 'furnace_room');
    }
    if (specialities.has('support') || specialities.has('defense')) out.push('infirmary');
    // A WORKSHOP IS WHERE ORE IS WORKED, which is what it yields two hundred
    // lines down, so what puts one in a compound is having ground to take ore
    // off. It read `production >= 0.6` against a number that was 0.5 for every
    // house in the catalog, so no compound in the world had one.
    //
    // Making things is not this room's: every house forges in its Artifact
    // Refining Hall, appended at the end. This is where ore off the house's
    // own ground is worked.
    if (input.holdsVein) out.push('workshop');
    // A ROOM FOR PEOPLE WHO ARE NOT OF THE HOUSE, and it is now here because
    // of who arrives rather than because of how the house is funded. It read
    // `governance === 'deference' || governance === 'administered'`, which
    // gave three houses a hall on the strength of a political word. What
    // actually puts a receiving room in a compound: a house nobody joins deals
    // with every visitor as an outsider, and a house that owes stones has
    // somebody arrive each year to be shown the place and be paid.
    if (!input.recruits || input.tributeStonesPerYear > 0) out.push('audience_hall');
    if (input.tributeStonesPerYear > 0) out.push('tribute_room');
    if (input.holdsVein) out.push('vein_chamber');
    // Somewhere to hold one of your own, and it takes both columns. A house
    // that takes nobody in has nobody to discipline - what an apex does about
    // an offence is not done in a cell - and a house whose arrays have gone
    // dark cannot hold a cultivator anyway, which is the same
    // `formationIntegrity` bar the shelf line above already reads rather than
    // a second opinion about when a house's formations still work.
    if (input.recruits && input.formationIntegrity >= 0.35) out.push('punishment_hall');
    out.push('meditation_cell');
    // What the house will not spend, so it needs something coming in worth not
    // spending: ground of its own, a tribute arrangement it is a party to, or
    // enough standing that things accumulate. The first arm read
    // `production >= 0.4`, which was true of all 38 houses, so the other two
    // decided nothing and every compound in the world had a vault.
    if (input.holdsVein || input.tributeStonesPerYear > 0 || input.powerOrdinal >= 25) {
        out.push('treasury');
    }
    out.push('residence');
    // A house that takes people in has people to talk to, the same column the
    // dormitory and the mission hall read. APPENDED LAST so every room that
    // existed before keeps its place in the list.
    if (input.recruits) out.push('lecture_hall');
    // Every house keeps the lamps of its own, whether or not anybody in it can
    // light one today. APPENDED LAST for the same reason as the lecture hall.
    out.push('life_lamp_hall');
    // AND BOTH CRAFTS, IN EVERY HOUSE. The design owner: every house makes pills
    // and every house makes artifacts, and a focus is a difference of degree.
    // APPENDED LAST, after every room that existed before, so the draws a
    // compound makes for the rooms ahead of these are the draws it made.
    if (!out.includes('alchemy_hall')) out.push('alchemy_hall');
    out.push('artifact_refining_hall');
    return out;
}

function buildRoom(
    purpose: RoomPurpose,
    spec: PurposeSpec,
    precinct: Precinct,
    host: LocationRecord,
    input: CompoundInput,
    style: HouseStyle,
    unit: number,
    styleData: Record<string, string>,
    rng: CultivationRNG
): LocationRecord {
    // ── A DISCIPLINE HALL IS POOR GROUND, FULL STOP ──────────────────────
    //
    // The design owner: *"prisoners are just sealed and thrown into a qi poor
    // area"*, *"hardcode the qi levels there to low."*
    //
    // Every other room in a compound is the host's ground plus or minus a lift,
    // which is right: a furnace room is the mountain with a furnace on it. A
    // discipline hall is not that. It is a room a house PUT somewhere poor, and
    // a -10 against a rich mountain still leaves rich ground - the seat at 80
    // gives a cell at 70, which is better than most of the world. A house on a
    // strong vein would have the best prison in the province.
    //
    // So the floor is absolute rather than relative, and it is a wall rather
    // than a formula, because a formula invites an argument about the formula.
    // The seal on the PERSON is the other half and does the rest of the work -
    // see `a-qi-seal-is-put-on-a-person.ts`. Neither is doing the other's job.
    const qi = spec.qiLift <= WHERE_A_HOUSE_PUTS_SOMEBODY_IT_IS_HOLDING.lift
        ? WHERE_A_HOUSE_PUTS_SOMEBODY_IT_IS_HOLDING.density
        : clampQiDensity(Math.min(QI_DENSITY_MAX, host.qiDensity + spec.qiLift));
    const capacity = Math.max(1, Math.round(unit * spec.capacityPer));

    // The bar on the room is the bar on the wall it is behind, raised where
    // the room is a vault. Nothing else moves it, so a room is never harder
    // than the precinct it is in for a reason nobody can point at.
    const operational = spec.kind === 'vault'
        ? clampOrdinal(Math.max(precinct.entryOrdinal, input.powerOrdinal - 4))
        : precinct.entryOrdinal;

    const hazards = spec.hazards.slice();
    // A house whose arrays are dead has no live formations to be hurt by. The
    // hazard is the array WORKING; a dark compound is safer and worth less.
    if (input.formationIntegrity < 0.3) {
        const at = hazards.indexOf('formation');
        if (at >= 0) hazards.splice(at, 1);
    }

    const affinities = spec.qiLift > 0 && style.element !== null && style.elementalIntensity >= ELEMENTAL_TRIM_FLOOR
        ? [makeAffinity(
            style.element,
            1 + style.elementalIntensity * 0.4,
            1,
            `The house cut this room for ${style.element} and nothing else fits it well.`
        )]
        : [];

    const room = makeLocation({
        id: roomId(input.factionId, precinct.index, purpose),
        name: `${input.factionName}: ${roomName(purpose, style, precinct)}`,
        kind: spec.kind,
        layer: host.layer,
        parentId: host.id,
        description: roomDescription(purpose, style, precinct, input),
        ambient: ordinaryBandFor(qi),
        qiDensity: qi,
        // A door INSIDE a compound is a door. The wall was the bar, and
        // repeating it on the room was measured to make `reachThrough`
        // redundant and a dead formation node worthless - somebody who came in
        // through a hole in the ward was barred again by the archive's own
        // copy of the wall's number. So a room's entry is nothing unless it is
        // a vault with its own lock, and what a room gates is WORKING there.
        thresholds: makeThresholds(
            spec.kind === 'vault' ? operational : 0,
            0,
            operational,
            input.powerOrdinal
        ),
        hazards,
        affinities,
        environment: makeEnvironment({
            spiritualDensity: qiFraction(qi),
            danger: hazards.length > 0 ? 0.25 : 0.08,
            resources: resourcesFor(purpose),
            politicalControl: input.factionName,
            specialRules: []
        }),
        controllingFactionId: input.factionId,
        sealed: spec.sealed,
        sealedOnDay: spec.sealed ? host.origin.fromDay : null,
        discovered: false,
        tags: ['interior', `purpose:${purpose}`, `rank:${slug(precinct.rank)}`],
        data: {
            ...styleData,
            purpose,
            precinctIndex: precinct.index,
            rank: precinct.rank,
            privacy: precinct.privacy,
            obviousness: spec.obviousness,
            capacity,
            // Cut for one house and occupied by another. Read against the
            // roll, this is the late-age fact in one subtraction.
            builtFor: input.inherited ? capacity : 0
        }
    });
    room.origin.fromDay = host.origin.fromDay;
    if (spec.sealed) room.data.keyId = `key:${input.factionId}:${purpose}`;

    // A house that hears petitions on a schedule is an OpeningCycle, not a
    // note. Righteous houses make a ceremony of the gate; demonic ones do not
    // open it on a calendar at all, and that difference is one field.
    if (purpose === 'audience_hall' || (purpose === 'gatehouse' && input.alignment === 'righteous')) {
        room.cycle = {
            periodDays: 30,
            openDays: purpose === 'audience_hall' ? 3 : 10,
            phaseDay: rng.int(0, 29)
        };
    }
    return room;
}

/**
 * The nodes, and the way in that the gate is not.
 */
function growNodes(
    seat: LocationRecord,
    precinctRecords: readonly LocationRecord[],
    input: CompoundInput,
    styleData: Record<string, string>,
    darkNodeIds: string[],
    rng: CultivationRNG
): LocationRecord[] {
    const total = Math.max(0, Math.round(input.formationNodesTotal));
    if (total === 0 || precinctRecords.length === 0) return [];
    const sites = Math.min(6, total);
    const litSites = Math.round(sites * Math.max(0, Math.min(1, input.formationIntegrity)));
    const compass = ['north', 'east', 'south', 'west', 'north-east', 'south-west'];
    const spec = PURPOSE.formation_node;
    const out: LocationRecord[] = [];

    // WHICH nodes are dark, not merely how many. Taking the first n as lit put
    // every house's holes on the same walls, so integrity decided how porous a
    // compound was and never decided WHERE - and a hole in the inner ward and a
    // hole in the forecourt are not the same fact. Drawn from the compound
    // stream, so it is stable per house per world and varies between houses.
    const litAt = new Set<number>();
    const pool = Array.from({ length: sites }, (_, i) => i);
    for (let n = 0; n < litSites && pool.length > 0; n++) {
        litAt.add(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    }

    for (let i = 0; i < sites; i++) {
        const lit = litAt.has(i);
        const node = makeLocation({
            id: `${seat.id}-node-${i + 1}`,
            name: `${input.factionName}: the ${compass[i]} node`,
            kind: 'chamber',
            layer: seat.layer,
            parentId: seat.id,
            description: lit
                ? `An array stone set into the ${compass[i]} perimeter, still lit, still answering.`
                : `An array stone set into the ${compass[i]} perimeter. It has been dark long enough `
                    + 'that the ground around it has grown back over the channel.',
            ambient: seat.ambient,
            qiDensity: seat.qiDensity,
            thresholds: makeThresholds(0, 0, lit ? input.powerOrdinal - 6 : 0, input.powerOrdinal),
            hazards: lit ? spec.hazards.slice() : [],
            affinities: [],
            environment: makeEnvironment({
                spiritualDensity: qiFraction(seat.qiDensity),
                danger: lit ? 0.3 : 0.05,
                resources: [],
                politicalControl: input.factionName,
                specialRules: lit ? [] : ['the ward does not close here']
            }),
            controllingFactionId: input.factionId,
            discovered: false,
            tags: ['interior', 'formation_node', lit ? 'lit' : 'dark'],
            data: {
                ...styleData,
                purpose: 'formation_node',
                precinctIndex: 0,
                lit,
                nodesRepresented: Math.round(total / sites),
                obviousness: lit ? 0.4 : 0.15,
                capacity: 1
            }
        });
        node.origin.fromDay = seat.origin.fromDay;
        out.push(node);
        linkLocations(seat, node, 'path', 0);

        if (!lit) {
            darkNodeIds.push(node.id);
            // The hole, and it opens onto the wall this node's array was covering.
            // Nodes ring the whole compound, so node i covers precinct i - which
            // means a house whose dark nodes happen to be the inner ones has a hole
            // in its inner ward, and one whose dark nodes are on the perimeter
            // merely has a leaky forecourt. Nobody chose which; `formationNodesLit`
            // did, and it has been in the sect catalog for a long time being read
            // only as a ratio.
            const into = precinctRecords[i % precinctRecords.length];
            linkLocations(node, into, 'seam', 1);
            node.data.opensOnto = into.id;
        }
    }
    return out;
}

/**
 * The rooms a thing somebody is at is done in, most fitting first.
 *
 * Kept beside `resourcesFor` because it is the same question asked the other
 * way round: that table says what a room gives, this one says what brings a
 * person into it. A house that has none of the rooms listed has its people
 * doing the thing where they already are.
 *
 * NOT HERE, ON PURPOSE:
 *
 *   the work of their rank   read off the office a person holds, which is a
 *                            fact about them rather than the activity; see
 *                            `where-inside-a-house-somebody-is-standing.ts`
 *   talking, squeezing,      done wherever people meet, which in a compound is
 *   idle and the rest        the forecourt the gate opens onto, and that is the
 *                            seat itself
 */
export const ROOMS_A_THING_IS_DONE_IN: Readonly<Partial<Record<ActivityKind, readonly RoomPurpose[]>>> = {
    teaching: ['lecture_hall', 'practice_yard'],
    at_the_shelves: ['scripture_pavilion', 'archive'],
    mending: ['infirmary', 'meditation_cell'],
    comprehending: ['meditation_cell'],
    their_practice: ['practice_yard'],
    at_a_table: ['refectory'],
    mustering: ['mission_hall']
};

/** The kinds of made thing a room is cut for. */
export type WhatIsBeingMade = 'medicine' | 'an_artifact';

/**
 * The rooms making a thing is done in, by what is being made, most fitting first.
 *
 * Beside {@link ROOMS_A_THING_IS_DONE_IN} and read the same way: somebody at the
 * work of their rank whose activity names the thing being made is in the room
 * that thing is made in, where the house has one. Medicine is made at a
 * cauldron, which the alchemy hall and the furnace floor are for. A made thing
 * that is not medicine is worked where ore is worked. A communication talisman
 * is neither: it is cut wherever the cutter is sitting, and is not in the table.
 */
export const ROOMS_A_THING_IS_MADE_IN: Readonly<Record<WhatIsBeingMade, readonly RoomPurpose[]>> = {
    medicine: ['alchemy_hall', 'furnace_room'],
    an_artifact: ['artifact_refining_hall', 'workshop']
};

function resourcesFor(purpose: RoomPurpose): string[] {
    switch (purpose) {
        case 'alchemy_hall':
        case 'furnace_room': return ['medicine', 'qi'];
        case 'infirmary': return ['medicine'];
        case 'workshop': return ['ore'];
        case 'vein_chamber': return ['qi'];
        case 'scripture_pavilion':
        case 'lecture_hall':
        case 'archive': return ['teaching'];
        case 'refectory': return ['food'];
        default: return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────
// THE ACCESS CHAIN - THE ONE PIECE OF ENGINE WORK AN INTERIOR NEEDS
// ─────────────────────────────────────────────────────────────────────────

/**
 * `evaluateAccess` answers one location. An interior is a chain of them.
 */
export interface ReachResult {
    /** The room asked about. */
    locationId: string;
    /** The strictest verdict on the path, which is the verdict. */
    level: AccessAssessment['level'];
    /** Where they were stopped, or null when they got all the way in. */
    stoppedAt: string | null;
    /** Every assessment on the path, outermost first. */
    steps: AccessAssessment[];
    reason: string;
}

const LEVEL_ORDER: Record<AccessAssessment['level'], number> = {
    barred: 0, lethal: 1, surviving: 2, operational: 3, mastered: 4
};

/**
 * Walk a path and return the worst thing on it.
 */
export interface ReachOptions {
    /**
     * The location they arrived INSIDE of, having gone around the walls.
     */
    enteredAt?: string;
}

export function reachThrough(
    path: readonly LocationRecord[],
    query: AccessQuery,
    opts: ReachOptions = {}
): ReachResult {
    if (path.length === 0) {
        throw new Error('reachThrough: an empty path is not a place');
    }
    const bypassTo = opts.enteredAt === undefined
        ? -1
        : path.findIndex(l => l.id === opts.enteredAt);
    const steps = path.map((l, i) => evaluateAccess(
        i <= bypassTo ? { ...l, thresholds: { ...l.thresholds, entry: 0 } } : l,
        query
    ));

    // The FIRST thing that stops them, not the worst thing on the path. They
    // are walking: an outer wall they cannot pass is where the walk ends, and
    // reporting the sealed vault three courts further in as the obstacle tells
    // them about a door they were never going to reach. Measured - the first
    // version reported the vault and hid the gate.
    const blockedAt = steps.findIndex(s => s.level === 'barred' || s.closed);
    // With nothing blocking, the verdict is still the weakest thing they can
    // do anywhere on the way, because standing in a corridor you cannot act in
    // is not access to the room at the end of it.
    let worstAt = 0;
    for (let i = 1; i < steps.length; i++) {
        if (LEVEL_ORDER[steps[i].level] < LEVEL_ORDER[steps[worstAt].level]) worstAt = i;
    }
    const at = blockedAt >= 0 ? blockedAt : worstAt;
    const verdict = steps[at];
    const target = path[path.length - 1];

    return {
        locationId: target.id,
        level: verdict.level,
        stoppedAt: blockedAt >= 0 ? path[blockedAt].id : null,
        steps,
        reason: blockedAt >= 0 && path[blockedAt].id !== target.id
            ? `${target.name} is not the obstacle. ${verdict.reason}`
            : verdict.reason
    };
}

/** The chain from the outermost ancestor down to this room, outermost first. */
export function pathTo(
    locations: readonly LocationRecord[],
    locationId: string
): LocationRecord[] {
    const byId = new Map(locations.map(l => [l.id, l]));
    const chain: LocationRecord[] = [];
    const seen = new Set<string>();
    let cursor: string | null = locationId;
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const at: LocationRecord | undefined = byId.get(cursor);
        if (!at) break;
        chain.push(at);
        cursor = at.parentId;
    }
    return chain.reverse();
}

// ─────────────────────────────────────────────────────────────────────────
// WHO KNOWS THE BACK STAIR
// ─────────────────────────────────────────────────────────────────────────

/**
 * What one person knows about one room.
 */
export interface ViewerStanding {
    /** Index into the house's own rank ladder, or -1 for an outsider. */
    rankIndex: number;
    /** How many ranks the house has. */
    rankCount: number;
    /** Years spent inside this compound. An outsider has zero. */
    yearsInHouse: number;
    /** False for anybody the house does not consider its own. */
    member: boolean;
}

export function roomStageFor(room: LocationRecord, viewer: ViewerStanding): KnowingStage {
    const obviousness = numberOf(room.data.obviousness, 0.5);
    const precinctIndex = numberOf(room.data.precinctIndex, 0);
    const ladder = Math.max(1, viewer.rankCount);

    // An outsider sees the outer face and hears the rest as names, at best.
    if (!viewer.member) {
        if (precinctIndex === 0 && obviousness >= 0.8) return 'encountered';
        if (obviousness >= 0.6) return 'named';
        return obviousness >= 0.3 ? 'whisper' : 'unaware';
    }

    // Rank reaches as far as rank goes: the precincts at or below yours.
    const reached = viewer.rankIndex >= precinctIndex;
    // Years are what buy the parts of the building nobody is shown. The scale
    // is the compound's own ladder rather than a constant, so a small house is
    // learned faster than a large one for the same reason it is smaller.
    const familiarity = Math.min(1, viewer.yearsInHouse / (3 * ladder));

    // An obvious room is what rank is exercised in, so rank places it at once.
    if (obviousness >= 0.75) {
        return reached ? 'known' : familiarity >= 0.3 ? 'placed' : 'named';
    }
    // An unobvious room is learned by being in the building, and RANK DOES NOT
    // SUBSTITUTE. The right to be somewhere and the knowledge that it is there are
    // different facts: a twenty-year outer disciple knows the back stair, and the
    // house's own elder of two years has the right to use it and does not know it
    // is there. Measured - the first version gated `known` on reach, so no
    // long-serving junior could ever get there and the ruling this implements was
    // unexpressible.
    if (familiarity >= 0.6) return 'known';
    if (reached && familiarity >= 0.25) return 'known';
    if (reached || familiarity >= 0.3) return 'placed';
    if (familiarity >= 0.15 || obviousness >= 0.4) return 'named';
    return 'unaware';
}

/** The rooms this viewer could set out for. `placed` and above, per the ladder. */
export function roomsVisibleTo(
    rooms: readonly LocationRecord[],
    viewer: ViewerStanding
): LocationRecord[] {
    return rooms.filter(r => isAtLeast(roomStageFor(r, viewer), 'placed'));
}

// ─────────────────────────────────────────────────────────────────────────
// DESCRIPTION - DERIVED, NEVER STORED
// ─────────────────────────────────────────────────────────────────────────

export interface RoomDescription {
    /** At most four lines. What a person gets for walking in. */
    onEntry: string[];
    /** What a person gets for looking properly. Only produced on request. */
    onInspect: string[];
}

/**
 * What this room looks like, worked out rather than remembered.
 */
export function describeRoom(
    room: LocationRecord,
    style: HouseStyle,
    opts: { seed: string } = { seed: 'describe' }
): RoomDescription {
    const purpose = purposeOf(room);
    const rng = forStream(opts.seed, 'describe-room', room.id);
    const capacity = numberOf(room.data.capacity, 0);
    const builtFor = numberOf(room.data.builtFor, 0);

    const onEntry: string[] = [];
    onEntry.push(`${materialLine(style, rng)}.`);
    if (purpose) onEntry.push(`${purposeLine(purpose, capacity)}.`);
    if (builtFor > 0 && capacity > 0) {
        onEntry.push(`It was cut for ${builtFor}. Nobody currently in the house cut it.`);
    }
    onEntry.push(`${upkeepLine(style, room)}.`);

    const onInspect: string[] = [];
    onInspect.push(ornamentLine(style));
    if (style.element && style.elementalIntensity >= ELEMENTAL_TRIM_FLOOR) {
        onInspect.push(style.elementalIntensity >= ELEMENTAL_IDIOM_FLOOR
            ? `Everything here is ${style.element}. Not as decoration - the house does not `
                + 'admit anybody who would want it otherwise.'
            : `The ${style.element} shows in the trim and stops there. The house builds `
                + 'ordinary buildings and takes ordinary people.');
    } else {
        onInspect.push('There is nothing elemental about any of it. The house takes every '
            + 'root there is, so a room here can be built for nobody in particular.');
    }
    if (room.sealed) onInspect.push('It is shut, and power is not what is holding it.');
    if (room.cycle) {
        onInspect.push(`It is open ${room.cycle.openDays} days in ${room.cycle.periodDays}, `
            + 'and not otherwise.');
    }
    return { onEntry: onEntry.slice(0, 4), onInspect };
}

function materialLine(style: HouseStyle, rng: CultivationRNG): string {
    const shape: Record<Idiom, string> = {
        terraced: 'Cut into the slope, one court standing above the next',
        walled_court: 'A court inside a court inside a court',
        carved: 'Cut into the rock and going inward rather than up',
        timber_hall: 'One long roof on posts, and very little wall',
        tower: 'Vertical, and the stair is the whole of the plan',
        cloister: 'A covered ring around one open court',
        stilted: 'Raised on posts over standing water',
        buried: 'Below the ground line entirely, and lit from shafts'
    };
    const finish = rng.pick([
        'the joints tight', 'the joints opened by frost', 'the surface worn smooth',
        'the edges still sharp', 'the facing patched in a different stone'
    ]);
    return `${shape[style.idiom]}, in ${style.materials[0]} with ${style.materials[1]}, ${finish}`;
}

function purposeLine(purpose: RoomPurpose, capacity: number): string {
    const held = capacity > 0 ? ` It holds ${capacity}.` : '';
    switch (purpose) {
        case 'gatehouse': return `The gate, and whoever is on it.${held}`;
        case 'forecourt': return `The court anybody may stand in.${held}`;
        case 'practice_yard': return `Flagstones, and the wear on them.${held}`;
        case 'refectory': return `Where the house eats.${held}`;
        case 'dormitory': return `Where the house sleeps.${held}`;
        case 'scripture_pavilion': return `Shelves, and somebody who decides what comes off them.${held}`;
        case 'archive': return 'Shelves nobody has taken anything off in a long time.';
        case 'alchemy_hall': return `Benches, scales, and the smell of it.${held}`;
        case 'furnace_room': return 'A furnace, and the qi bends toward it.';
        case 'infirmary': return `Beds, and a ledger of who owes for one.${held}`;
        case 'workshop': return `Where the house makes what it can still make.${held}`;
        case 'audience_hall': return `Where the house is answered, and answers.${held}`;
        case 'lecture_hall': return `Mats in rows facing one seat, and whoever is in the seat is talking.${held}`;
        case 'life_lamp_hall': return 'Lamps in rows, one for each of the house\'s own. Every one still burning is somebody alive.';
        case 'artifact_refining_hall': return `A forge over earth fire, and the work laid out on the stones around it.${held}`;
        case 'tribute_room': return 'Where what is owed is counted before it leaves.';
        case 'meditation_cell': return `Cells. The qi is thicker in here than in the yard.${held}`;
        case 'vein_chamber': return 'Directly over the vein. There is not room in here for everybody who wants it.';
        case 'ancestral_hall': return 'Tablets, in rows, most of them to people nobody can name.';
        case 'under_hall': return 'Under the hall. Something is down here and it is not awake.';
        case 'treasury': return 'What the house will not spend.';
        case 'residence': return 'Somebody lives here, and only them.';
        case 'formation_node': return 'An array stone set into the perimeter.';
        default: return 'A room.';
    }
}

function upkeepLine(style: HouseStyle, room: LocationRecord): string {
    if (room.hazards.includes('formation')) {
        return 'The array over it is lit and it notices you';
    }
    switch (style.upkeep) {
        case 'lit': return 'Everything in it is running';
        case 'patched': return 'About half of what was built into it is still doing anything';
        case 'dark': return 'Whatever was built into it stopped working long enough ago that '
            + 'the house has furnished around the fact';
    }
}

function ornamentLine(style: HouseStyle): string {
    switch (style.ornament) {
        case 'ceremonial': return 'There is more ceremony in the doorway than the doorway needs.';
        case 'trophied': return 'The house has hung up things it took, and labelled them.';
        case 'warded': return 'Every lintel carries the mark of whoever the house answers to.';
        case 'plain': return 'Nothing has been put on any surface that did not have to be there.';
    }
}

// ─────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────

export function precinctId(factionId: string, index: number): string {
    return `${factionId}-precinct-${index}`;
}

export function roomId(factionId: string, precinctIndex: number, purpose: RoomPurpose): string {
    return `${factionId}-p${precinctIndex}-${purpose.replace(/_/g, '-')}`;
}

function precinctAt(precincts: readonly Precinct[], depth: number): Precinct {
    const at = Math.min(precincts.length - 1, Math.round(depth * (precincts.length - 1)));
    return precincts[Math.max(0, at)];
}

function precinctDescription(style: HouseStyle, precinct: Precinct, input: CompoundInput): string {
    const privacy = precinct.privacy >= 0.75
        ? 'Almost nobody in the house has been past this wall'
        : precinct.privacy >= 0.4
            ? 'Past this wall the house is working rather than being looked at'
            : 'The part of the compound the province sees';
    return `${privacy}. ${input.factionName} keeps its ${precinct.rank.toLowerCase()}s here, `
        + `in ${style.materials[0]}.`;
}

function roomDescription(
    purpose: RoomPurpose,
    style: HouseStyle,
    precinct: Precinct,
    input: CompoundInput
): string {
    return `${roomName(purpose, style, precinct)}, in the ${precinct.rank.toLowerCase()} `
        + `precinct of ${input.factionName}.`;
}

function slug(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function numberOf(raw: unknown, fallback: number): number {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}
