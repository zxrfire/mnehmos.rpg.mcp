/**
 * Architecture - the inside of a compound.
 *
 * The gap this closes, measured before it was written: a seeded world held 65
 * locations, nesting bottomed out at depth 1 (a province, and places in it),
 * and the Azure Cloud Pavilion - the house with a newly ascended immortal and
 * an entire storyline attached - was one node called "grounds" with two roads
 * out of it. No scripture pavilion, no ancestral hall, no vault. There was
 * nowhere to stand.
 *
 * Nothing here is new machinery. `locations.ts` already had `parentId`,
 * `LocationThresholds`, `AccessAssessment`, `OpeningCycle`, `qiDensity`,
 * `hazards`, `affinities`, `sealed` and an append-only `changes` list. What it
 * did not have was any interior member on `LocationKind` and anything that
 * produced one. So this module is a GRAMMAR and a GENERATOR over machinery
 * that already existed, plus exactly one piece of engine work - `reachThrough`,
 * below, because access was answered one location at a time and an interior is
 * a chain.
 *
 * ── THE THREE RULES IT IS BUILT UNDER ───────────────────────────────────
 *
 * 1. NOTHING IS BESPOKE. Every compound comes out of the same function reading
 *    the same columns. There is no per-faction table anywhere in this file and
 *    none may be added. A house is distinctive because its numbers are, in the
 *    same fields every other house's numbers are in.
 *
 * 2. STORE WHAT SOMETHING READS; DERIVE THE REST. A room stores its purpose,
 *    its parent, its thresholds, its qi, its capacity and its style id. It
 *    does not store its smell, its light, its floor material or its furniture,
 *    because nothing in the engine reads any of those - they are DERIVED at
 *    description time from purpose x style x condition through the ordinary
 *    seeded RNG, which gives unlimited texture at no storage cost and, unlike a
 *    stored adjective, is reproducible from the seed.
 *
 * 3. STATUS IS PHYSICALLY MANIFEST, AND THE LADDER IS THE HOUSE'S OWN.
 *    Precincts are generated one per rank in `CatalogFaction.ranks`, which
 *    already varies per faction and already reads ['Outer Disciple', 'Inner
 *    Disciple', 'Core Disciple', 'Elder', 'Grand Elder', 'Patriarch']. A house
 *    with four ranks gets four precincts. Nobody chose four tiers.
 *
 * ── HOUSE STYLE, AND WHY IT IS DATA ─────────────────────────────────────
 *
 * An institution has a design language: one vocabulary of materials, one idiom,
 * applied across the whole compound. Precincts differ in quality and privacy,
 * not in style - that is what makes a compound read as one place built by one
 * body over centuries. An individual expresses themselves; an institution
 * expresses itself. So a disciple's residence inside a sect looks like every
 * other residence in that sect regardless of the disciple's spirit root.
 *
 * The exception, and it is derivable rather than declared: a house is
 * elemental exactly as far as the house itself is elementally narrow.
 * `preferredRoots` on the sect entry already says who it will take, and the
 * distribution across the catalog is real - most houses take every root, a
 * handful are partially coloured, two admit exactly one mutated root and
 * nothing else. A house that takes everybody cannot have elemental buildings,
 * because an earth disciple's courtyard there is a standard courtyard. A house
 * that takes nothing but ice is ice all the way down. `elementalIntensity`
 * below is that, plus the element spread of the manuals it actually teaches,
 * because a house whose whole curriculum is elementless is the most
 * element-neutral architecture in the world FOR A STATED REASON rather than by
 * default.
 *
 * The same representation is read from both ends. Generation uses it to build;
 * identification uses it to recognise. A house style is an archaeological
 * fingerprint, so a ruin's architecture is evidence of who built it, an expert
 * can read it and a non-expert cannot - and the difficulty is asymmetric for
 * free: a single-root compound is trivially identifiable centuries later, and
 * telling WHICH ordinary house built an ordinary ruin is the hard skill. The
 * tags are written to `data.styleTags` on every location this module produces,
 * so `provenance.ts` can match against them without importing anything here.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────
 *
 * No hour-of-day room state. This engine's clock runs in days and years - the
 * normal player move is "I enter seclusion for two years" - so a room that
 * differs at 8am and midnight is state nothing will ever read. What DOES vary
 * is the day, and `OpeningCycle` already expresses it.
 *
 * No NPC schedules. The world already simulates people at scale. Rooms read
 * where NPCs are; a second scheduler here would drift from the real one, which
 * is the "second combat system in the prose layer" mistake under another name.
 *
 * No dimensions, with one exception. Nothing reads a room's length. Something
 * does read `capacity`: a practice yard cut for six hundred that holds ninety
 * is one of the strongest facts in the sect catalog, and it is capacity against
 * occupancy. So capacity is stored and every other measurement is not.
 */

import { clampOrdinal } from '../cultivation/realms.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { getSpiritRoot } from '../cultivation/spirit-roots.js';
import { isAtLeast, type KnowingStage } from '../social/discovery.js';
import type { CatalogFaction } from './catalog.js';
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
 *
 * Derived, never authored. Eight values, because the discriminating power has
 * to come from the whole fingerprint rather than from this one facet - a world
 * where every neutral house is a `walled_court` is fine, provided the material,
 * the precision and the upkeep pull them apart afterwards.
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
 *
 * A broad house has a style to deviate FROM, so an elder's residence is where
 * their own element finally shows. A single-root house has no such axis -
 * everybody is the same element - so seniority has to be signalled by space,
 * privacy and how many of the arrays around you are lit. Either way the
 * deviation is legible, and a player can read rank off architecture before
 * anybody tells them one.
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
     *
     * Zero is a house that takes every root and teaches across the wheel: its
     * buildings are resolutely ordinary and an earth disciple's courtyard is a
     * courtyard. One is a house that admits a single root and teaches nothing
     * else: cave abodes all the way down. See {@link elementalIntensityOf}.
     */
    elementalIntensity: number;
    /** The element the intensity is IN, or null where there is none. */
    element: string | null;
    deviation: DeviationAxis;
    /**
     * The matchable facets, as flat strings.
     *
     * This is the archaeological fingerprint and the ONLY part of the style
     * that other modules should read, because it needs no import from here.
     * Written to `data.styleTags` as a space-joined string.
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

const GOVERNANCE_IDIOM: Record<string, Idiom> = {
    // A house that answers to somebody builds around the room it is answered
    // in, so the whole compound is a ring facing one court.
    deference: 'cloister',
    // A house run from outside is laid out to be inspected: courts in a line.
    administered: 'walled_court',
    // A house holding a grant holds ground, and ground here is a slope.
    federated: 'terraced',
    // A house nobody backs built what it could where it could.
    unbacked: 'walled_court'
};

/**
 * How elemental a house's buildings are, 0..1.
 *
 * Two signals, both already in the content, neither needing a new field:
 *
 *   intake      `preferredRoots`. Every accepted root spreads one unit of
 *               weight across the elements it can hold, so `single_earth`
 *               contributes a whole unit of earth and `muddled_five_element`
 *               contributes a fifth of each. The dominant share of the
 *               resulting distribution is how narrow the intake actually is.
 *               An empty list is every root, and scores zero - correctly,
 *               because a house that takes everybody cannot build for one.
 *
 *   curriculum  the elements of the manuals it teaches. Elementless arts count
 *               in the denominator and not in the numerator, so a house whose
 *               doctrine is that almost everything it teaches is elementless
 *               lands near zero on purpose rather than by omission.
 *
 * Weighted toward intake, because who a house will admit is the harder gate
 * and the one that determines who is standing in the building.
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
    // dominant share of a weighted distribution. Measured: the weighted version
    // put seven houses in the absolutist band, including the Azure Cloud
    // Pavilion, whose intake is metal-dominant but who also takes dual roots
    // and puts uncultivated mortals on probation to find out what they are -
    // its courtyards are courtyards. A house is only built for one element if
    // there is only one element in the building, and a house that will take a
    // muddled five-element root has every element in the building whatever its
    // curriculum says.
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

/** What a house can still produce, as squareness of stonework. */
function precisionOf(production: number): Precision {
    if (production >= 0.75) return 'exact';
    if (production >= 0.4) return 'fitted';
    return 'rough';
}

/** What fraction of its own inheritance is still running, as light. */
function upkeepOf(formationIntegrity: number): Upkeep {
    if (formationIntegrity >= 0.7) return 'lit';
    if (formationIntegrity >= 0.3) return 'patched';
    return 'dark';
}

function ornamentOf(alignment: CatalogFaction['alignment'], governance: string): Ornament {
    if (alignment === 'demonic') return 'trophied';
    if (alignment === 'righteous') return 'ceremonial';
    return governance === 'deference' ? 'warded' : 'plain';
}

/**
 * Whether the compound fits the people in it.
 *
 * An inherited compound was cut by somebody stronger, so the walls are for a
 * house that no longer exists. `powerOrdinal` against the compound's own
 * calibration is the size of that gap, and it is the single most legible fact
 * about a late-age institution: a yard cut for six hundred holding ninety.
 */
function scaleOf(inherited: boolean, powerOrdinal: number, admissionOrdinal: number): Scale {
    if (!inherited) return 'human';
    const reach = powerOrdinal - admissionOrdinal;
    return reach >= 20 ? 'monumental' : 'oversized';
}

export interface StyleInput {
    factionId: string;
    alignment: CatalogFaction['alignment'];
    governance: string;
    production: number;
    formationIntegrity: number;
    inherited: boolean;
    powerOrdinal: number;
    admissionOrdinal: number;
    preferredRoots: readonly string[];
    teachesElements: readonly (string | null)[];
}

/**
 * The house's design language, as a pure function of what the catalog holds.
 *
 * No RNG. A style must be the same in every world for the archaeology to be
 * worth anything - a Pavilion ruin has to look like Pavilion work whichever
 * seed produced the world it is standing in.
 */
export function houseStyleOf(input: StyleInput): HouseStyle {
    const { intensity, element } = elementalIntensityOf(input.preferredRoots, input.teachesElements);
    const precision = precisionOf(input.production);
    const upkeep = upkeepOf(input.formationIntegrity);
    const ornament = ornamentOf(input.alignment, input.governance);
    const scale = scaleOf(input.inherited, input.powerOrdinal, input.admissionOrdinal);

    // The element only reaches the IDIOM at the top of the range. A partially
    // coloured house builds ordinary buildings and shows its element in trim;
    // an absolutist house's element decides the shape of the place.
    const elemental = element !== null && intensity >= ELEMENTAL_IDIOM_FLOOR;
    const idiom = elemental
        ? ELEMENT_IDIOM[element] ?? GOVERNANCE_IDIOM[input.governance] ?? 'walled_court'
        : GOVERNANCE_IDIOM[input.governance] ?? 'walled_court';

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
 *
 * A ruin is not a compound with the lights off; it is a compound minus
 * whatever did not last. Ornament is hung on a wall and is the first thing
 * taken. Upkeep is unreadable the moment a site stops being maintained - every
 * ruin is dark, so "dark" says nothing about who built it. Trim goes with the
 * roofs. What survives to the far end is the shape of the plan, the stone it
 * was cut from and how big it was, because those are the ground.
 *
 * This is what makes attribution hard, and it makes it hard UNEVENLY, which is
 * the whole point: `element:` is in the surviving set, so a house that admitted
 * one root is named from its ruin centuries later, and a house that admitted
 * everybody leaves three facets that a dozen of its neighbours also leave.
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

export interface StyleMatch {
    factionId: string;
    /** Shared facets over total facets, 0..1. */
    score: number;
    shared: string[];
}

/**
 * Which houses could have built this, and how many.
 *
 * The asymmetry is the point and it is not asserted anywhere - it falls out of
 * the arithmetic. An absolutist house carries an `element:` facet that almost
 * nothing else in the world carries, so one candidate survives and an expert
 * names the builder outright. A house that takes every root carries seven
 * ordinary facets that a dozen other houses also carry, so the field stays
 * wide and telling WHICH ordinary house built an ordinary ruin is the genuinely
 * hard read. Both come from the same comparison.
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
 * How hard this building is to attribute, as the number of houses that match
 * it as well as the best one does.
 *
 * One means the architecture names its builder. Nine means the reader has
 * narrowed it to nine houses and has to find something else.
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
 *
 * The bars are interpolated from `admissionOrdinal` at the outermost wall to
 * `powerOrdinal` at the innermost, which is exactly the span the sect gate is
 * already calibrated over. A house that takes no applicants starts its outer
 * wall at admission rather than at nothing, because there is no probation
 * ground in a compound with no intake.
 *
 * Nothing here is a tier count. Four ranks make four precincts.
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
 *
 * The vocabulary is bounded because each entry has a spec below that decides
 * behaviour. Adding a purpose that behaves identically to an existing one is
 * decoration and should be a different NAME on the same purpose instead.
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
     *
     * The only room in this list that seals a PERSON rather than a thing, and
     * that is the whole of why it is not `under_hall`: an under hall keeps
     * something asleep and a punishment hall keeps somebody awake. It exists
     * because a portfolio has to be a room somebody is in charge of, and the
     * design owner's own example - *"punishment elder (you control the
     * jails)"* - was the one office in the world with nowhere to be.
     */
    | 'punishment_hall'
    | 'residence'
    | 'formation_node';

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
    /** Heads the room was cut for, per unit of the compound's scale. */
    capacityPer: number;
    hazards: string[];
}

const PURPOSE: Record<RoomPurpose, PurposeSpec> = {
    // ── The outer face. Anyone can stand here; that is the point of it. ──
    gatehouse: { kind: 'hall', depth: 0, obviousness: 1, qiLift: 0, sealed: false, capacityPer: 0.05, hazards: [] },
    forecourt: { kind: 'hall', depth: 0, obviousness: 1, qiLift: 0, sealed: false, capacityPer: 0.6, hazards: [] },
    practice_yard: { kind: 'hall', depth: 0.15, obviousness: 0.9, qiLift: 0, sealed: false, capacityPer: 1, hazards: [] },
    refectory: { kind: 'hall', depth: 0.1, obviousness: 0.85, qiLift: 0, sealed: false, capacityPer: 0.8, hazards: [] },
    dormitory: { kind: 'hall', depth: 0.1, obviousness: 0.8, qiLift: 0, sealed: false, capacityPer: 1, hazards: [] },

    // ── The working middle. What the house actually does all day. ────────
    scripture_pavilion: { kind: 'hall', depth: 0.45, obviousness: 0.6, qiLift: 0, sealed: false, capacityPer: 0.15, hazards: [] },
    archive: { kind: 'vault', depth: 0.75, obviousness: 0.2, qiLift: 0, sealed: true, capacityPer: 0.04, hazards: ['formation'] },
    alchemy_hall: { kind: 'hall', depth: 0.4, obviousness: 0.6, qiLift: 0, sealed: false, capacityPer: 0.2, hazards: [] },
    furnace_room: { kind: 'chamber', depth: 0.5, obviousness: 0.35, qiLift: 12, sealed: false, capacityPer: 0.06, hazards: ['heat'] },
    infirmary: { kind: 'hall', depth: 0.3, obviousness: 0.7, qiLift: 0, sealed: false, capacityPer: 0.25, hazards: [] },
    workshop: { kind: 'hall', depth: 0.35, obviousness: 0.55, qiLift: 0, sealed: false, capacityPer: 0.2, hazards: [] },
    audience_hall: { kind: 'hall', depth: 0.55, obviousness: 0.75, qiLift: 0, sealed: false, capacityPer: 0.3, hazards: [] },
    tribute_room: { kind: 'vault', depth: 0.6, obviousness: 0.3, qiLift: 0, sealed: true, capacityPer: 0.05, hazards: [] },
    meditation_cell: { kind: 'chamber', depth: 0.5, obviousness: 0.4, qiLift: 8, sealed: false, capacityPer: 0.12, hazards: [] },
    vein_chamber: { kind: 'chamber', depth: 0.7, obviousness: 0.25, qiLift: 30, sealed: false, capacityPer: 0.05, hazards: ['formation', 'pressure'] },

    // ── The inner end. Where the house keeps what it will not spend. ─────
    ancestral_hall: { kind: 'hall', depth: 0.85, obviousness: 0.5, qiLift: 0, sealed: false, capacityPer: 0.1, hazards: [] },
    under_hall: { kind: 'vault', depth: 1, obviousness: 0.05, qiLift: 20, sealed: true, capacityPer: 0.01, hazards: ['sealed_qi', 'formation'] },
    // THE ONE ROOM CUT TO BE BAD GROUND, and the negative lift is the whole
    // mechanism rather than decoration. Every other room in this table either
    // leaves the ground alone or improves it; this one is built to take the
    // vein away from whoever is in it, so time spent here is time off the
    // ladder. That is what makes holding somebody a punishment instead of an
    // inconvenience, and it is read by anything that prices a stay rather than
    // being asserted anywhere. Obvious enough that everybody in the house knows
    // where it is - a discipline hall nobody can find deters nobody - and
    // sealed, because what it holds can walk.
    punishment_hall: { kind: 'vault', depth: 0.65, obviousness: 0.5, qiLift: -10, sealed: true, capacityPer: 0.04, hazards: ['formation'] },
    treasury: { kind: 'vault', depth: 0.9, obviousness: 0.25, qiLift: 0, sealed: true, capacityPer: 0.03, hazards: ['formation'] },
    // No qi lift. What seniority buys here is space and privacy, not a better
    // vein - a residence is a room and the ground under it is the ground under
    // everything else. The one place the house style bends is this room, and it
    // bends along `HouseStyle.deviation`.
    residence: { kind: 'hall', depth: 0.95, obviousness: 0.45, qiLift: 0, sealed: false, capacityPer: 0.05, hazards: [] },

    // ── Outside the walls, and the reason the gate is not the only way. ──
    formation_node: { kind: 'chamber', depth: 0, obviousness: 0.15, qiLift: 0, sealed: false, capacityPer: 0.01, hazards: ['formation'] }
};

export const ROOM_PURPOSES = Object.keys(PURPOSE) as RoomPurpose[];

/**
 * Whether a room is one somebody is in charge of, and how far in it sits.
 *
 * Two fields off the private table rather than the table itself, because the
 * only question anybody outside this file has about a purpose is whether it has
 * a bar on it. **Sealed is the whole of the criterion**: nobody is Elder of the
 * Forecourt, and a room people walk through is not an office. Measured across
 * the catalog when this was written, the sealed rooms per house came out at
 * almost exactly the deciders per house, which is why no threshold is applied
 * here - the model was already in the table.
 *
 * `depth` comes with it so a caller handing several rooms to several people can
 * put the deepest one in the most senior hands without a second opinion about
 * which room that is.
 */
export function roomAuthorityOf(purpose: RoomPurpose): { sealed: boolean; depth: number } {
    const spec = PURPOSE[purpose];
    return { sealed: spec.sealed, depth: spec.depth };
}

/** The purpose a location was built for, or null when it was not built by us. */
export function purposeOf(location: LocationRecord): RoomPurpose | null {
    const raw = String(location.data.purpose ?? '');
    return (ROOM_PURPOSES as readonly string[]).includes(raw) ? raw as RoomPurpose : null;
}

/**
 * The house's own word for a room.
 *
 * Named off the style rather than off a per-faction table: a carved compound
 * has a "deep hall" where a terraced one has an "upper hall", and neither is a
 * rule that applies to one faction. The names are content, and the engine
 * matches on `data.purpose`, never on the name.
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
 *
 * Deliberately a flat input rather than `CatalogFaction`, so the generator is
 * testable against a fixture and so a house that is not a sect - a Dao house,
 * a court - can be grown from the same function without either side knowing
 * about the other's shape.
 */
export interface CompoundInput {
    factionId: string;
    factionName: string;
    ranks: readonly string[];
    admissionOrdinal: number;
    powerOrdinal: number;
    recruits: boolean;
    alignment: CatalogFaction['alignment'];
    governance: string;
    production: number;
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
 *
 * An inherited compound was cut by whoever was here before, so it is sized off
 * what THEY reached, which is the compound's mastery bar - and the house
 * currently in it is sized off its own admission bar. That gap is the whole of
 * "a yard cut for six hundred holding ninety", and it comes out of two columns
 * that already exist rather than out of a number anyone typed.
 */
export function compoundCapacityUnit(input: CompoundInput): number {
    const built = input.inherited ? Math.max(input.powerOrdinal, 12) : input.admissionOrdinal + 8;
    return Math.max(20, Math.round(built * 14));
}

/**
 * Build the inside of a compound.
 *
 * Pure and deterministic: same seed and same input yield the same rooms, so
 * this can be called eagerly at seeding or lazily the first time somebody walks
 * through the gate, and the two produce the same compound.
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
        const spec = PURPOSE[purpose];
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
    locations.push(...growNodes(seat, precinctRecords, input, style, styleData, darkNodeIds, rng));

    return { style, precincts, locations, darkNodeIds };
}

/**
 * Which rooms this house has.
 *
 * Every line reads a column. Nothing here is a per-faction table, and the
 * variety comes from the fact that the columns genuinely differ: a house that
 * takes no applicants has no dormitory, a house that answers to somebody has an
 * audience hall and a tribute room, a house that can make things has a
 * workshop, a house sitting on a vein has a chamber over it, and a house with
 * something asleep has somewhere to keep it.
 */
export function roomsFor(input: CompoundInput): RoomPurpose[] {
    const out: RoomPurpose[] = ['gatehouse', 'forecourt', 'practice_yard', 'ancestral_hall'];
    const specialities = new Set(input.specialities.map(s => s.toLowerCase()));

    if (input.recruits) out.push('dormitory', 'refectory');
    // A house that can read what it inherited keeps it on shelves. A house
    // that cannot keeps it in a locked room, and that is the same fact wearing
    // a different door: `formationIntegrity` is how much of the inheritance
    // still works, so it decides which of the two the books are behind.
    out.push(input.formationIntegrity >= 0.35 ? 'scripture_pavilion' : 'archive');
    // A deep-foundation house has both: what it teaches, and what nobody has
    // cultivated in centuries.
    if (input.powerOrdinal >= 30 && input.formationIntegrity >= 0.35) out.push('archive');

    if (specialities.has('alchemy') || specialities.has('support') || specialities.has('cultivation')) {
        out.push('alchemy_hall', 'furnace_room');
    }
    if (specialities.has('support') || specialities.has('defense')) out.push('infirmary');
    if (input.production >= 0.6) out.push('workshop');
    if (input.governance === 'deference' || input.governance === 'administered') out.push('audience_hall');
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
    if (input.production >= 0.4 || input.powerOrdinal >= 25) out.push('treasury');
    out.push('residence');
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
    const qi = clampQiDensity(Math.min(QI_DENSITY_MAX, host.qiDensity + spec.qiLift));
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
 *
 * `formationNodesTotal` over `formationNodesLit` has been in the sect catalog
 * for a long time and was read only as a ratio. A node is a physical object at
 * a physical point: a lit one carries the `formation` hazard and nothing else
 * is unusual about it, and a DARK one is a hole in the ward, so it carries a
 * `seam` link that lands inside a precinct without passing the gate. That is
 * what makes a compound's condition tactical rather than descriptive - the
 * nine-of-forty-one house is not merely poorer, it is porous.
 *
 * A bounded number of sites is built, each standing for its share of the
 * total, because forty-one locations for one compound is storage nothing reads.
 * The share is recorded on the site so the count stays traceable.
 */
function growNodes(
    seat: LocationRecord,
    precinctRecords: readonly LocationRecord[],
    input: CompoundInput,
    style: HouseStyle,
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
            // The hole, and it opens onto the wall this node's array was
            // covering. Nodes ring the whole compound, so node i covers
            // precinct i - which means a house whose dark nodes happen to be
            // the inner ones has a hole in its inner ward, and one whose dark
            // nodes are on the perimeter merely has a leaky forecourt. Nobody
            // chose which; `formationNodesLit` did, and it has been in the
            // sect catalog for a long time being read only as a ratio.
            const into = precinctRecords[i % precinctRecords.length];
            linkLocations(node, into, 'seam', 1);
            node.data.opensOnto = into.id;
        }
    }
    // How much of itself the house can still see, recorded where somebody
    // standing outside could count it.
    seat.data.formationNodesTotal = total;
    seat.data.formationNodesLit = input.formationNodesLit;
    seat.data.styleId = style.id;
    seat.data.styleTags = style.tags.join(' ');
    return out;
}

function resourcesFor(purpose: RoomPurpose): string[] {
    switch (purpose) {
        case 'alchemy_hall':
        case 'furnace_room': return ['medicine', 'qi'];
        case 'infirmary': return ['medicine'];
        case 'workshop': return ['ore'];
        case 'vein_chamber': return ['qi'];
        case 'scripture_pavilion':
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
 *
 * A vault three walls in is guarded by all three walls, and asking only about
 * the vault is how somebody standing in the province gets told they can operate
 * in the treasury. So the verdict on a room is the STRICTEST verdict on the way
 * to it, and the location that produced it is named - because "you were stopped
 * at the inner gate" and "you were stopped at the vault door" are different
 * pieces of information and a player needs the first one.
 *
 * This is also what makes a dark formation node worth anything. Coming in
 * through the seam means the chain you walked is shorter, so the bars on the
 * walls you went around never applied. The way in that is not the gate is not a
 * special rule; it is a different path through the same function.
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
 *
 * `path` is outermost-first and is the caller's - which is the whole point,
 * because the caller decides whether they came through the gate or through a
 * dead node, and the function does not care which.
 */
export interface ReachOptions {
    /**
     * The location they arrived INSIDE of, having gone around the walls.
     *
     * Coming through a dead formation node puts somebody past the ward, so the
     * ENTRY bars from the outside up to and including that point never applied
     * to them. Survival and operational still do - being in the inner court
     * without the rank to work there is exactly the state this models, and a
     * hole in a wall does not confer standing. Measured: without this, the seam
     * a dark node opens was worth nothing, because the landing precinct
     * charged its own gate bar to somebody who had just come through the wall.
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
 *
 * Knowledge of a room is NOT a flag on the room. The ruling this implements is
 * that knowledge follows engagement rather than altitude - a house engages with
 * its own compound and an outsider does not, however senior. So a disciple of
 * twenty years knows the back stair and a visiting elder four realms above them
 * does not, and that has to be expressible or the whole information model stops
 * at the door.
 *
 * Two inputs, and they do different work:
 *
 *   rank    buys the FRONT of the house. A high rank places every obvious room
 *           immediately, because those are the rooms rank is exercised in.
 *   years   buy the BACK of the house. An unobvious room is learned by being
 *           in the building, and nothing else substitutes for it.
 *
 * Which is why a visitor with courtesy rank and no years gets the audience hall
 * and never the archive. Reuses `KnowingStage` from the social layer; there is
 * no second discovery ladder here and none may be added.
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
    // SUBSTITUTE. The right to be somewhere and the knowledge that it is there
    // are different facts: a twenty-year outer disciple knows the back stair,
    // and the house's own elder of two years has the right to use it and does
    // not know it is there. Measured - the first version gated `known` on
    // reach, so no long-serving junior could ever get there and the ruling this
    // implements was unexpressible.
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
 *
 * Four lines on entry, more on inspection, and every one of them is a function
 * of purpose x style x condition x seed. Nothing here is stored on the record
 * and nothing here is authored per faction: two compounds read differently
 * because their columns differ, which is the only mechanism this file has.
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
