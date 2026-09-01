/**
 * World seeding: turning the content catalogs into a world that is already
 * running when the player arrives.
 *
 * Before this existed the roster returned exactly one row - the player - and a
 * forty-year seclusion changed nothing, because there was nothing there to
 * change. Seeding instantiates the starting world: regions with veins and
 * gating, factions with real members, several hundred NPCs, lineages, dated
 * opportunities, and the grant renewals that will fall due while the player is
 * in a cave.
 *
 * Everything derives from the run seed. Two runs of the same seed produce
 * byte-identical worlds.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOBODY IS FLAGGED IMPORTANT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This is the rule the charter cares most about and the easiest place to break
 * it, because seeding is exactly where a lazy implementation writes
 * `leader.realmOrdinal = 24`.
 *
 * What happens instead: every NPC is generated the way the player is - spirit
 * root rolled, attributes rolled, personality-free but goal-bearing - and then
 * their CURRENT REALM IS DERIVED from what those inputs would actually have
 * produced over the years they have been alive, using the real cultivation
 * math: `computeCultivationRate` against `progressRequiredForOrdinal`, walked
 * up the ladder. A muddled root who has been at it for eighty years lands where
 * a muddled root who has been at it for eighty years lands.
 *
 * ONLY THEN are roles assigned, by sorting the faction's members on the realm
 * they turned out to have. The strongest is the leader because they are the
 * strongest, not because the seeder decided who mattered. A faction whose draw
 * came out weak gets a weak patriarch and will struggle, and that is a correct
 * outcome rather than a bug.
 *
 * The region ceiling is the other half of it. `localCeilingOrdinal` says what
 * nobody here has passed in living memory, and it is applied as a real cap on
 * the derived ordinal - so where you are born decides more about your life than
 * anything you will ever do, which is the setting's whole position on the
 * matter.
 */

import { DAYS_PER_YEAR, computeCultivationRate } from '../cultivation/cultivation.js';
import { bestReadable } from '../cultivation/manual-quality.js';
import {
    MAX_ORDINAL,
    clampOrdinal,
    lifespanForOrdinal,
    progressRequiredForOrdinal
} from '../cultivation/realms.js';
import {
    computeBreakthroughOdds,
    FAILURE_PROGRESS_LOSS,
    MAX_PILL_BONUS
} from '../cultivation/breakthrough.js';
import { densityForBand, eraAmbientMultiplier } from '../cultivation/ambient.js';
import {
    AMBIENT_QI_RATE_MULTIPLIER,
    stagnationYearsForOrdinal,
    type AmbientQi
} from '../../schema/cultivation.js';
import { getSpiritRoot } from '../cultivation/spirit-roots.js';
import { MEMBERS } from '../../data/cultivation/members.js';
import {
    BREAKTHROUGH_PILL_STONES,
    STONES_PER_YEAR_OF_SECLUSION,
    affordablePillPotency,
    earningsPerYear,
    getOrigin,
    type OriginTierKey
} from '../cultivation/origin.js';
import { purchasedQiPerYear } from '../cultivation/buying-and-bartering-pills.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import type { InnateAttributes, SpiritRootKey } from '../cultivation/spirit-roots.js';
import { growCompound, type CompoundInput } from './architecture.js';
import type { WorldCatalog, CatalogFaction, CatalogRegion } from './catalog.js';
import {
    linkLocations,
    makeAffinity,
    makeEnvironment,
    makeLocation,
    makeThresholds,
    ordinaryBandFor,
    QI_DENSITY_MAX,
    clampQiDensity,
    qiFraction,
    type LocationRecord
} from './locations.js';
import { addGoal, createNpc, setRealm, upsertRelationship, type NpcRecord } from './npc-state.js';
import { addLineageEdge, createLineageRecord, type LineageRecord } from './lineage.js';
import { makeOpportunity, years, type OpportunityWindow } from './opportunities.js';
import { dayOfYear, makeFact, appendFact } from './history.js';
import { seedSectLibraries, grantBooksToMembers } from './manuals.js';
import { seedArtifacts } from './artifact-placement.js';
import { seedComprehensionMaterials } from './single-use-dao-comprehension-materials.js';
import { seedPillStock } from './where-the-pills-actually-are.js';
import { seedStructuralRepairMedicine } from './who-holds-the-structural-repair-medicine.js';
import {
    createWorld,
    makeFaction,
    type FactionRecord,
    type ScheduledEffect,
    type WorldState
} from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────────────────────

export interface SeedWorldOptions {
    seed: string;
    catalog: WorldCatalog;
    /** Year the present age begins. */
    presentYear?: number;
    /**
     * Target living NPC count. Hundreds, not tens of thousands: a province
     * holds this many people worth having a record for, and the cost of a
     * century of world time is linear in it.
     */
    population?: number;
    /** Qi density of the present age. */
    qiDensity?: number;
    priorAges?: { ages?: number; yearsPerAge?: number; factionsPerAge?: number };
}

export interface SeedStats {
    regions: number;
    locations: number;
    factions: number;
    npcs: number;
    lineages: number;
    opportunities: number;
    scheduledEffects: number;
    priorFacts: number;
    /** Living NPCs by realm tier, lowest first. The shape of the population. */
    realmHistogram: number[];
}

export interface SeededWorld {
    state: WorldState;
    stats: SeedStats;
}

const DEFAULTS = {
    presentYear: 1000,
    population: 400,
    qiDensity: 0.34
};

/** Fraction of the population that belongs to a faction at all. */
const AFFILIATION_RATE = 0.45;
/** Youngest and oldest a seeded adult may be. */
const MIN_AGE = 16;
const MAX_AGE = 120;

/**
 * Ceiling on a named figure's age. They are people the world knows, not
 * ancients under a mountain - the sealed ones are a separate catalog.
 */
const MAX_NAMED_AGE = 700;
/** Rough years a rank costs, for giving a named figure a plausible age. */
const NAMED_YEARS_PER_ORDINAL = 9;

/**
 * Lowest declared power at which a faction gets an instance it did not derive.
 *
 * Below this the ordinary population reaches the claim on its own, and seeding
 * one would put a figure in the world the arithmetic already produced.
 */
const APEX_SEED_FLOOR = 17;

/**
 * What a year of work is worth to somebody at this rank.
 *
 * MOVED, unchanged, to `engine/cultivation/origin.ts`, where the rest of the
 * economy's constants already live and where the pill market can read it
 * without the cultivation layer importing the world layer. Re-exported here
 * because a dozen call sites and two probes name it at this path, and because
 * the income curve is half of every price in the game.
 */
export { earningsPerYear } from '../cultivation/origin.js';

/**
 * What a catalog figure is holding.
 *
 * Named people do not get their purse from the life walk, because their rank
 * and realm are curated rather than derived - so it is composed from the two
 * things that decide earning power in this world: what they are, and where
 * they stand in the institution. Wide, because a senior figure who is poor is
 * a story and the catalog should be allowed to produce one.
 */
function holdingsFor(ordinal: number, rankIndex: number, rng: CultivationRNG): number {
    const perYear = earningsPerYear(clampOrdinal(ordinal));
    const standing = 1 + Math.max(0, rankIndex) * 0.4;
    return Math.round(perYear * rng.int(1, 8) * standing);
}

/** Share of their realm's lifespan an apex figure has already spent. */
const APEX_AGE_FRACTION = 0.25;

// ─────────────────────────────────────────────────────────────────────────
// THE SEED
// ─────────────────────────────────────────────────────────────────────────

/**
 * "the The Low Fall vein".
 *
 * Region names in the catalog carry their own article - The Low Fall, The Wide
 * Field, The Quiet Marches - so prefixing another one doubles it. Visible in
 * `probe-places.ts` output and in the map panel.
 */
function withoutArticle(name: string): string {
    return name.replace(/^[Tt]he\s+/, '');
}

export function seedWorld(opts: SeedWorldOptions): SeededWorld {
    const presentYear = opts.presentYear ?? DEFAULTS.presentYear;
    const population = Math.max(0, opts.population ?? DEFAULTS.population);
    const qiDensity = opts.qiDensity ?? DEFAULTS.qiDensity;
    const presentDay = dayOfYear(presentYear);

    // Several prior ages first, so ruins and scars exist before anything is
    // placed on top of them and every remnant points at a dated event.
    const state = createWorld({
        seed: opts.seed,
        presentYear,
        qiDensity,
        regionCount: 0,
        priorAges: opts.priorAges
    });
    const priorFacts = state.history.facts.length;

    const regionLocations = seedRegions(state, opts.catalog, presentDay);
    const factions = seedFactions(state, opts.catalog, regionLocations, presentDay);
    const npcs = seedPopulation(state, opts.catalog, factions, population, presentDay);
    state.populationTarget = npcs.length;
    const lineages = seedLineages(state, npcs, presentDay);
    const opportunities = seedOpportunities(state, opts.catalog, regionLocations, presentDay);
    const effects = seedGrantSchedule(state, opts.catalog, presentDay);

    // Books last, because who holds what depends on everything above it: the
    // factions have to be seated before their libraries have anywhere to sit,
    // and the people have to be placed and ranked before the shelf can be
    // gated by rank.
    //
    // Until this ran, a seeded world contained no objects at all and every NPC
    // held `techniqueIds: []` - so `applyAdvancement` had no manual to read,
    // fell back on `deriveOrdinal`, and nobody in the world gained a rung in
    // two hundred years. See `manuals.ts`.
    state.objects.push(...seedSectLibraries(state));
    // And the things that are not books. `artifacts.ts` has been a complete
    // table of ObjectRecords since it was written and the seeder never put one
    // of them into the world, so the immortal weapon a house's whole standing
    // rests on existed only in a catalog nothing read. See `goods.ts`.
    state.objects.push(...seedArtifacts(state));
    state.objects.push(...seedComprehensionMaterials(state));
    // And the medicine, which the same catalog-nothing-read defect applied to:
    // a world with no pills in it is a world where the crossing pill is a price
    // in a document. Two shapes, one threshold - see
    // `where-the-pills-actually-are.ts`.
    state.objects.push(...seedPillStock(state));
    // And the medicine that mends a cracked cultivator, which is placed rather
    // than scattered: exactly the authored holdings, on exactly those bodies,
    // and nowhere else. See `who-holds-the-structural-repair-medicine.ts`.
    state.objects.push(...seedStructuralRepairMedicine(state));
    const npcAt = new Map(state.npcs.map((n, i) => [n.id, i]));
    for (const grant of grantBooksToMembers(state)) {
        const at = npcAt.get(grant.npcId);
        if (at === undefined) continue;
        const npc = state.npcs[at];
        state.npcs[at] = {
            ...npc,
            cultivation: {
                ...npc.cultivation,
                techniqueIds: [...grant.techniqueIds, ...grant.artIds]
            },
            tags: grant.chosen && !npc.tags.includes('chosen') ? [...npc.tags, 'chosen'] : npc.tags
        };
    }

    return {
        state,
        stats: {
            regions: opts.catalog.regions.length,
            locations: state.locations.length,
            factions: factions.length,
            npcs: npcs.length,
            lineages: lineages.length,
            opportunities: opportunities.length,
            scheduledEffects: effects.length,
            priorFacts,
            realmHistogram: histogram(state)
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────
// REGIONS AND PLACES
// ─────────────────────────────────────────────────────────────────────────

function regionLocationId(regionId: string): string {
    return `loc-${regionId}`;
}

function placeLocationId(regionId: string, placeName: string): string {
    const slug = placeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `loc-${regionId}-${slug || 'place'}`;
}

/**
 * One location per region, one per named place inside it, and one vein per
 * region that has one.
 *
 * The region carries the gating: `localCeilingOrdinal` becomes the mastery
 * threshold, because holding a province means being above what the province has
 * ever produced. Places inherit their parent's hazards and override the ambient
 * band, which is how a rich pocket inside a thin province is representable
 * without a second mechanism.
 */
function seedRegions(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number
): Map<string, LocationRecord> {
    const byRegion = new Map<string, LocationRecord>();

    for (const region of catalog.regions) {
        const ceiling = region.localCeilingOrdinal;
        const location = makeLocation({
            id: regionLocationId(region.id),
            name: region.name,
            kind: 'region',
            description: region.summary,
            ambient: region.ambient,
            qiDensity: region.qiDensity,
            // A region is walked into freely and survived by anyone from here;
            // what it gates is operating in it and holding it.
            thresholds: makeThresholds(0, 0, Math.max(0, Math.floor(ceiling / 3)), ceiling),
            hazards: region.hazards.slice(),
            environment: makeEnvironment({
                spiritualDensity: qiFraction(region.qiDensity),
                danger: Math.min(1, region.hazards.length * 0.15),
                resources: region.exports.slice(),
                climate: 'temperate',
                politicalControl: politicalControlOf(region),
                specialRules: region.specialRules.slice(),
                knownSecrets: [],
                historicalScars: region.scars.slice()
            }),
            discovered: true,
            tags: region.home ? ['home', 'region'] : ['region'],
            data: {
                catalogRegionId: region.id,
                localCeilingOrdinal: ceiling,
                ambientRateMultiplier: region.ambientRateMultiplier,
                politics: region.politics
            }
        });
        location.origin.fromDay = presentDay - years(2000);
        state.locations.push(location);
        byRegion.set(region.id, location);

        for (const place of region.places) {
            state.locations.push(makeLocation({
                id: placeLocationId(region.id, place.name),
                name: place.name,
                kind: placeKindFor(place.kind),
                parentId: location.id,
                description: place.note,
                ambient: place.ambient,
                qiDensity: region.qiDensity,
                thresholds: makeThresholds(0, 0, 0, Math.max(0, ceiling - 4)),
                hazards: region.hazards.slice(),
                environment: makeEnvironment({
                    // THE PLACE'S OWN GROUND, not its province's average.
                    //
                    // This read `qiFraction(region.qiDensity)`, so every
                    // settlement in a province got an identical density and the
                    // `ambient` band two lines up was written to the record and
                    // never used for anything. Measured: Nine Peaks - "the
                    // deepest vein anyone has kept, and the Ascetic Order
                    // sitting on it" - and Scarwater, a thin ford town, both
                    // came out at 0.35, and `Game.ambientFor` prefers this
                    // record over the catalog, so the played game described
                    // both as air that neither helps nor gets in the way.
                    //
                    // Found by playing: two looks at the same square, one
                    // calling the air thick enough to notice on the first
                    // breath and the next calling it unremarkable.
                    spiritualDensity: densityForBand(place.ambient),
                    danger: place.kind === 'site' ? 0.5 : 0.1,
                    resources: region.exports.slice(0, 2),
                    politicalControl: politicalControlOf(region),
                    historicalScars: []
                }),
                tags: ['place', place.kind],
                data: {
                    catalogRegionId: region.id,
                    // Read by the demography when it draws a birthplace.
                    populationWeight: PLACE_POPULATION_WEIGHT[place.kind] ?? 1
                }
            }));
        }

        // The vein. It is the reason the region has politics at all, and it is
        // the thing factions take from each other.
        if (region.veinStatus) {
            state.locations.push(makeLocation({
                id: `${regionLocationId(region.id)}-vein`,
                name: `the ${withoutArticle(region.name)} vein`,
                kind: 'vein',
                parentId: location.id,
                description: region.veinStatus,
                ambient: region.qiDensity > 60 ? 'dense' : region.ambient,
                qiDensity: clampQiDensity(region.qiDensity + 30),
                thresholds: makeThresholds(0, 0, Math.max(0, ceiling - 6), ceiling),
                hazards: ['formation'],
                environment: makeEnvironment({
                    spiritualDensity: qiFraction(region.qiDensity + 30),
                    danger: 0.4,
                    resources: ['qi'],
                    politicalControl: politicalControlOf(region)
                }),
                affinities: [makeAffinity('formation', 1.3, 2, 'Somebody has worked this ground.')],
                tags: ['vein', 'contested'],
                data: { catalogRegionId: region.id }
            }));
        }
    }

    // Roads between regions, in whatever the content says the travel cost is.
    for (const region of catalog.regions) {
        const from = byRegion.get(region.id);
        if (!from) continue;
        for (const conn of region.connections) {
            const to = byRegion.get(conn.otherRegionId);
            if (!to) continue;
            linkLocations(from, to, 'road', Math.max(1, conn.travelDays));
        }
    }

    return byRegion;
}

/**
 * Relative headcount by settlement kind, for weighting births.
 *
 * Anchored on the gazetteer's own `typicalPopulation` bands in
 * `mortal-world.ts` - 20-80 for a hamlet up to 80,000-plus for a city -
 * flattened to a ratio, because the demography only ever needs the shape.
 * Compressed hard against the real spread: a city genuinely holds a thousand
 * hamlets' worth of people, and a world where every birth lands in one is not
 * the world this setting describes.
 *
 * A `site` is not a settlement and holds nobody. It is 0, and `birthplacesIn`
 * reads that as uninhabitable rather than as unset.
 */
const PLACE_POPULATION_WEIGHT: Readonly<Record<string, number>> = {
    hamlet: 3,
    village: 10,
    market_town: 28,
    sect_town: 22,
    city: 60,
    waystation: 1,
    site: 0
};

/**
 * A house's ground holds its household, not a town.
 *
 * Deliberately near the bottom of the scale. There are far more houses in the
 * catalog than there are towns, and drawing births uniformly over habitable
 * ground put 61% of the living world inside a compound within a hundred and
 * fifty years - which is not a setting where a sect is a thing you can join.
 */
const SECT_GROUND_POPULATION_WEIGHT = 1;

function placeKindFor(kind: string): LocationRecord['kind'] {
    switch (kind) {
        case 'city':
        case 'market_town':
        case 'sect_town':
        case 'village':
        case 'hamlet':
        case 'waystation':
            return 'settlement';
        case 'site':
        default:
            return 'wilds';
    }
}

function politicalControlOf(region: CatalogRegion): string {
    switch (region.politics) {
        case 'single_hegemon': return 'one power, and it is not shy about it';
        case 'no_authority': return 'nobody, which everybody has noticed';
        default: return 'several sects, none of them decisively';
    }
}

// ─────────────────────────────────────────────────────────────────────────
// FACTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Factions as entities with a seat, a treasury, rivalries and a vein.
 *
 * Treasury is derived from what the faction can make for itself and what it
 * owes upward - a federated sect paying forty thousand a year in tribute runs
 * closer to the line than an unbacked one that pays nobody, which is exactly
 * the pressure the governance models exist to create.
 */
/** Stable id for a faction's ground, so a caller can go from one to the other. */
export function sectGroundId(factionId: string): string {
    return `loc-${factionId}-ground`;
}

/**
 * How steeply held ground improves with the standing that holds it.
 *
 * Above 1, so the top of the ladder holds disproportionately better ground -
 * which is the same shape as everything else in this engine, where a realm is
 * four times over and the gaps widen going up.
 */
const SECT_GROUND_CURVE = 1.6;

/**
 * What ground a sect of this standing holds, 1..100.
 *
 * Measured against the strongest faction IN THE CATALOG rather than against a
 * named house, which is the whole of why this is not bespoke: the top of the
 * scale belongs to whoever is actually at the top, and today that is the Hollow
 * Court at ordinal 44. Rename it, unseat it, or write something stronger, and
 * the 100 moves with the arithmetic instead of being left behind pointing at a
 * house that no longer deserves it.
 *
 * Floored at the region's own ground: a weak sect sitting in a thin province
 * offers a disciple nothing the province did not already offer, and a stipend
 * is then honestly the whole of what joining bought them.
 */
export function sectGroundDensity(
    powerOrdinal: number,
    apexPowerOrdinal: number,
    regionDensity: number
): number {
    const apex = Math.max(1, apexPowerOrdinal);
    const reach = Math.max(0, Math.min(1, powerOrdinal / apex));
    const held = QI_DENSITY_MAX * Math.pow(reach, SECT_GROUND_CURVE);
    return clampQiDensity(Math.max(regionDensity, held));
}

/**
 * The ground a sect actually holds.
 *
 * Why a sect must be a place, in one paragraph: a sect's whole value to a
 * disciple is what standing on its mountain does to a cultivation rate. The
 * home region runs thin - Sweptground sits at 0.35, which is "half rate and a
 * penalty to breakthrough odds" - and fifty years of that stops climbing the
 * ladder somewhere around ordinal 16. A sect that is only a row in
 * `sect_members` gives a disciple nothing that a rogue does not already have.
 *
 * Everything about this location is derived from columns the faction already
 * carries, so there is no sect-specific rule anywhere:
 *
 *   qiDensity      the region's ground, plus what the sect's own standing has
 *                  bought it. A sect took the best ground it could hold, and
 *                  `powerOrdinal` is exactly how much it could hold.
 *   thresholds     entry is 0 - anyone may walk up to a gate. `operational` is
 *                  the admission bar, which is what makes the gate mean
 *                  something: a rogue can stand in the forecourt and cannot
 *                  work there. `mastery` is the sect's own power.
 *   discovered     false. A sect's ground is a name you have to be given, and
 *                  the knowledge gate does the rest.
 */
function seedSectGround(
    state: WorldState,
    cf: CatalogFaction,
    region: LocationRecord,
    apexPowerOrdinal: number,
    presentDay: number
): LocationRecord {
    const density = sectGroundDensity(cf.powerOrdinal, apexPowerOrdinal, region.qiDensity);

    const ground = makeLocation({
        id: sectGroundId(cf.id),
        name: `${cf.name} grounds`,
        kind: 'sect_seat',
        parentId: region.id,
        description:
            `The ground the ${cf.name} holds: gate, forecourt, halls, and whatever vein `
            + 'the compound was built on top of.',
        ambient: ordinaryBandFor(density) === 'thin' ? region.ambient : ordinaryBandFor(density),
        qiDensity: density,
        // Anyone may walk to a gate and anyone may survive standing at it. What
        // the gate gates is working there, and that bar is the admission bar.
        thresholds: makeThresholds(0, 0, cf.admissionOrdinal, cf.powerOrdinal),
        hazards: cf.holdsVein ? ['formation'] : [],
        // A compound that still runs its own formations answers to somebody who
        // can read them. Read off `formationIntegrity`, which is already the
        // column for how much of the inherited compound still works.
        affinities: cf.formationIntegrity >= 0.5
            ? [makeAffinity(
                'formation',
                1 + cf.formationIntegrity * 0.3,
                2,
                'The compound\'s own arrays are still running and answer to somebody who can read them.'
            )]
            : [],
        environment: makeEnvironment({
            spiritualDensity: qiFraction(density),
            danger: 0.15,
            resources: ['qi', 'teaching', 'medicine'],
            politicalControl: cf.name,
            specialRules: cf.recruits
                ? [`admits at ${cf.admissionOrdinal}`]
                : ['takes no applicants'],
            historicalScars: []
        }),
        controllingFactionId: cf.id,
        // A name you have to be given. Joining gives it; being told gives it;
        // asking in the region gives it. Nothing else does, which is the gate
        // working rather than the gate being missing.
        discovered: false,
        tags: ['sect_ground', cf.recruits ? 'recruits' : 'closed'],
        data: {
            factionId: cf.id,
            admissionOrdinal: cf.admissionOrdinal,
            populationWeight: SECT_GROUND_POPULATION_WEIGHT,
            catalogRegionId: region.data.catalogRegionId as string ?? ''
        }
    });
    ground.origin.fromDay = presentDay - years(300);
    state.locations.push(ground);
    // The road from the province to the gate. Ordinary link, ordinary travel.
    linkLocations(region, ground, 'road', 2);

    // And the inside of it. A sect seat with no interior is a name with two
    // roads out of it: measured before this existed, the Azure Cloud Pavilion -
    // the house with a newly ascended immortal attached - was exactly that, and
    // nesting in a whole seeded world bottomed out at depth 1. `growCompound`
    // is pure and deterministic off the world seed, so calling it here and
    // calling it the first time somebody walks through the gate produce the
    // same compound; it is called here because seeding 32 of them costs less
    // than the branch that would decide not to.
    const compound = growCompound(ground, compoundInputFor(cf), {
        seed: state.seed,
        presentDay
    });
    for (const room of compound.locations) state.locations.push(room);

    return ground;
}

/**
 * The generator's flat input, read straight off the catalog row.
 *
 * Every field the architecture layer added to `CatalogFaction` is defaulted
 * here rather than assumed. A great many fixtures across the suite build a
 * catalog faction by hand and predate those fields; a hand-built house should
 * come out as an ordinary compound with no elemental character, not take world
 * seeding down with it.
 */
function compoundInputFor(cf: CatalogFaction): CompoundInput {
    return {
        factionId: cf.id,
        factionName: cf.name,
        ranks: cf.ranks,
        admissionOrdinal: cf.admissionOrdinal,
        powerOrdinal: cf.powerOrdinal,
        recruits: cf.recruits,
        alignment: cf.alignment,
        governance: cf.governance,
        production: cf.production,
        formationIntegrity: cf.formationIntegrity,
        formationNodesTotal: cf.formationNodesTotal ?? 0,
        formationNodesLit: cf.formationNodesLit ?? 0,
        inherited: cf.compoundInherited ?? false,
        holdsVein: cf.holdsVein,
        tributeStonesPerYear: cf.tributeStonesPerYear,
        sealedCeilingOrdinal: cf.sealedCeilingOrdinal,
        preferredRoots: cf.preferredRoots ?? [],
        teachesElements: cf.teachesElements ?? [],
        specialities: cf.specialities ?? []
    };
}

function seedFactions(
    state: WorldState,
    catalog: WorldCatalog,
    regions: Map<string, LocationRecord>,
    presentDay: number
): FactionRecord[] {
    const out: FactionRecord[] = [];
    // The top of the ground scale belongs to whoever is actually strongest.
    const apexPowerOrdinal = catalog.factions.reduce((max, f) => Math.max(max, f.powerOrdinal), 1);
    const regionForFaction = new Map<string, string>();
    for (const region of catalog.regions) {
        for (const id of region.factionIds) regionForFaction.set(id, region.id);
    }

    for (const cf of catalog.factions) {
        const rng = forStream(state.seed, 'seed-faction', cf.id);
        const regionId = regionForFaction.get(cf.id) ?? catalog.regions[0]?.id ?? null;
        const region = regionId ? regions.get(regionId) ?? null : null;
        // A sect is a PLACE. Its seat used to be the region location, which
        // meant a disciple could be on the roll and had nowhere to walk to -
        // the engine said "being on their roll and being on their ground are
        // two different things" and then modelled only the roll. `sect_seat`
        // was already in `LocationKind`; nothing here is a new category.
        const seat = region ? seedSectGround(state, cf, region, apexPowerOrdinal, presentDay) : null;

        // A year of upkeep, scaled by what it can produce and what it owes.
        const baseTreasury = Math.round(
            (2_000 + cf.powerOrdinal * 900) * (0.5 + cf.production) -
            cf.tributeStonesPerYear * 0.08
        );

        const faction = makeFaction({
            id: cf.id,
            name: cf.name,
            kind: cf.governance === 'deference' ? 'court' : 'sect',
            alignment: cf.alignment,
            seatLocationId: seat?.id ?? null,
            controlledLocationIds: seat ? [seat.id] : [],
            ranks: cf.ranks.slice(),
            standing: {},
            resources: {
                spirit_stones: Math.max(200, baseTreasury + rng.int(-400, 1200)),
                veins: cf.holdsVein ? 1 : 0,
                tribute_owed_per_year: cf.tributeStonesPerYear,
                // Read back by the yearly economy and by admissions. Kept on
                // the record rather than looked up, so the world stays
                // self-contained once the catalog is out of the picture.
                production: cf.production,
                admission_ordinal: cf.admissionOrdinal,
                // What it fields every day, which `cascade.ts` compares against
                // whoever came for it.
                power_ordinal: cf.powerOrdinal,
                // And what it holds asleep, once. Spent to zero on waking.
                sealed_ceiling_ordinal: cf.sealedCeilingOrdinal
            },
            description: cf.description,
            foundedOnDay: presentDay - years(rng.int(60, 900)),
            tags: [cf.governance, cf.recruits ? 'recruits' : 'closed']
        });

        // Rivalries are symmetric in the catalog, so recording one side is
        // enough; the other faction's own pass records the mirror.
        for (const rivalId of cf.rivalIds) faction.standing[rivalId] = -0.6;
        if (cf.parentFactionId) faction.standing[cf.parentFactionId] = 0.4;

        // A federated sect holds its vein from somebody. An unbacked one holds
        // it because nobody has taken it yet. Both are recorded as control.
        if (cf.holdsVein && region) {
            const vein = state.locations.find(l => l.id === `${region.id}-vein`);
            if (vein && !vein.controllingFactionId) {
                vein.controllingFactionId = cf.id;
                faction.controlledLocationIds.push(vein.id);
                // Held ground is linked to the ground that holds it, so the
                // ordinary travel path reaches it from the gate.
                if (seat) linkLocations(seat, vein, 'path', 1);
            }
        }
        if (seat) seat.controllingFactionId = cf.id;

        state.factions.push(faction);
        out.push(faction);

        appendFact(state.history, makeFact({
            day: faction.foundedOnDay ?? presentDay,
            kind: 'faction_founded',
            scale: 'regional',
            summary:
                `The ${cf.name} took its seat` + (seat ? ` at ${seat.name}` : '') + '. ' +
                (cf.governance === 'unbacked'
                    ? 'It answers to nobody and pays for that itself.'
                    : `It holds what it holds on ${cf.governance} terms.`),
            locationId: seat?.id ?? null,
            factionIds: [cf.id],
            visibility: 'public',
            fidelity: 'partial',
            magnitude: 0.5,
            data: { governance: cf.governance }
        }));
    }

    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// POPULATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a cultivator with these inputs would actually be, after this long.
 *
 * The whole anti-flag mechanism. Runs the real cultivation rate against the
 * real ladder cost and walks up as far as the arithmetic reaches. Talent
 * dominates, time matters, and the region's ceiling is a hard cap - so the
 * distribution that comes out is the one the game's own numbers imply rather
 * than one a seeder chose.
 *
 * The `effort` draw is the only stochastic term and it is deliberately wide:
 * it stands for everything this layer does not model about a life - diligence,
 * a decade lost to an injury, a patron, a war. It is drawn once per NPC from
 * their own stream and never re-rolled.
 */
export interface DeriveOrdinalOptions {
    /**
     * Ambient band the climb happened in. Defaults to `normal`, which is the
     * Late Age's open-world baseline.
     */
    ambient?: AmbientQi;
    /**
     * Qi density of the ERA this cultivator climbed in, 0..1, from
     * `world_eras`. This is how an ancient is derived honestly: a Grand
     * Ascension survivor is not an exemption in the maths, they are somebody
     * who walked the same cost curve when the open air was richer. Omitted
     * means the present day.
     */
    eraQiDensity?: number;
    /** Retry ceiling per rank. A safety net; settling normally binds first. */
    maxAttemptsPerRank?: number;
    /**
     * Where this person was born.
     *
     * NPCs get an origin the same way the player does, and it is spent here the
     * same way: it moves the ground under them, whether a house stands behind
     * them, what the family can pay for in pills, and whether the province's own
     * ceiling is theirs. It moves NOTHING else, and in particular it never adds
     * a rank - a Dao house child who draws a muddled root lands where a
     * muddled root lands, only better fed.
     *
     * Omitted reads as 'thin_county', which is nine births in ten.
     */
    origin?: OriginTierKey;
    /**
     * Told what every crossing attempt cost and what it was carrying.
     *
     * Measurement only, and it must stay that way: the walk never reads back
     * anything it hands out here, so a probe can watch the pill economy without
     * a second copy of this loop existing somewhere to drift away from it.
     * `scripts/probe-pill-affordability.ts` is the caller, and the reason it
     * exists is that the affordability question - whether anybody at the bottom
     * of the ladder can actually buy one - is not answerable from the ordinal
     * this function returns.
     */
    onAttempt?: (attempt: CrossingAttemptObservation) => void;
    /**
     * Turn the commodity pill market off, so a probe can measure what it is
     * worth rather than argue about it.
     *
     * Defaults to on, which is the world. It exists because "did the pill
     * economy cause this" is a question that gets asked of every balance
     * finding from here on, and answering it by reverting the branch and
     * re-running is how a comparison ends up being between two different trees.
     */
    buysProgress?: boolean;
}

/** One crossing attempt, as it actually happened. See `onAttempt`. */
export interface CrossingAttemptObservation {
    ordinal: number;
    /** Age at the attempt. */
    age: number;
    /** Stones in hand at the counter, before the pill was paid for. */
    stonesBeforePill: number;
    /** What a pill at full potency costs at this rung. */
    pillPrice: number;
    /** Share of a pill the holding covered, 0..1. */
    potency: number;
    /** The odds the attempt actually ran at. */
    finalChance: number;
    crossed: boolean;
}

/** The denser of two bands. A house can improve the ground; it cannot find a vein. */
function betterAmbient(a: AmbientQi, b: AmbientQi): AmbientQi {
    return AMBIENT_QI_RATE_MULTIPLIER[b] > AMBIENT_QI_RATE_MULTIPLIER[a] ? b : a;
}

/**
 * How far this life actually got.
 *
 * ── Why this is not a budget subtraction ─────────────────────────────────
 *
 * It used to be: accumulate `rate x years`, spend it down the cost curve, stop
 * when it runs out. That made NPCs systematically luckier than the player,
 * because the player pays for every rank with a breakthrough roll, a settling
 * clock and a lifespan, and the NPC paid with none of them. It is the
 * no-bias rule broken in the player's disfavour, which is the direction that
 * is easiest to miss.
 *
 * So this now walks the SAME gates the player walks, rank by rank:
 *
 *   - accumulate at `computeCultivationRate`, the player's own function;
 *   - refuse the rank if it would take longer than settling permits at that
 *     ordinal (`stagnationYearsForOrdinal`, which scales with the realm);
 *   - refuse it if the cultivator would die of old age first;
 *   - roll it against `computeBreakthroughOdds`, the player's own odds, and
 *     make failures cost real time by re-accumulating what they burned.
 *
 * The upper stratum thins sharply as a result, and that is the correct
 * outcome: in the Late Age almost nobody climbs past Core Formation on ambient
 * qi. The world's ancients are explained by `eraQiDensity` - they climbed when
 * the air was richer - rather than by anybody being exempt from the arithmetic.
 */
export interface DerivedLife {
    ordinal: number;
    /** Stones left after a lifetime of upkeep, stipend and pills. */
    spiritStones: number;
}

export function deriveLife(
    root: SpiritRootKey,
    attributes: InnateAttributes,
    ageYears: number,
    regionRateMultiplier: number,
    ceiling: number,
    rng: CultivationRNG,
    opts: DeriveOrdinalOptions = {}
): DerivedLife {
    const lifetime = Math.max(0, ageYears - MIN_AGE);
    if (lifetime <= 0) return { ordinal: 0, spiritStones: 0 };

    // Most people are not sitting in a cave. A wide, right-skewed draw that
    // stands for everything this layer does not model about a life.
    const effort = rng.float(0.08, 0.75) * (1 + attributes.insight * 0.08);
    const origin = getOrigin(opts.origin ?? 'thin_county');
    // The family can improve the ground under a child. It cannot find them a
    // sealed vein, which is why MAX_ORIGIN_AMBIENT stops at dense.
    const ambient: AmbientQi = betterAmbient(opts.ambient ?? 'normal', origin.ground);
    const era = opts.eraQiDensity === undefined ? 1 : eraAmbientMultiplier(opts.eraQiDensity);
    const maxAttempts = Math.max(1, opts.maxAttemptsPerRank ?? 12);

    const focus = Math.min(1, effort);

    // Priced at the rung the walker is standing on, not at the bottom.
    //
    // This was computed ONCE, before the climb, and `realmOrdinal` was never
    // passed - which `computeCultivationRate` documents as reading "as ordinal
    // 0... a multiplier of 1". So an entire life ran at Qi Condensation intake
    // while `progressRequiredForOrdinal` climbed underneath it, and the walk
    // stalled the moment the cost curve outran a rate that could never move.
    //
    // Measured before this fix: the best spirit root in the catalog reached
    // ordinal 16 at age 120 and never moved again - not at 300, not at 3000 -
    // and no NPC anywhere in the world gained a single rung in two hundred
    // simulated years. It is the same defect that was found and fixed on the
    // player's side; the derivation kept its own copy of it.
    // What this person was actually handed, and can actually work. A shelf is
    // not a book: an origin reaches a level of shelf, and the reader takes the
    // best thing on it they can read. See `bestReadable`.
    const road = bestReadable(origin.roadQuality, { spiritRoot: root, attributes });

    const perYearAt = (at: number): number => computeCultivationRate(
        // `attributes` is passed now, and it is not decoration: the manual
        // quality below is priced against what this reader can take out of the
        // book, so a walk that withheld the attribute block would price every
        // life in the world at the pivot and lose the whole talent axis.
        { spiritRoot: root, injuries: [], realmOrdinal: at, attributes },
        ambient,
        {
            focusMultiplier: focus,
            locationBonus: Math.max(0.1, regionRateMultiplier) * era,
            // AN ACTUAL BOOK, rather than the insight proxy that stood here.
            //
            // `1 + insight * 0.06` was a placeholder for a manual nobody was
            // holding, and it did two things wrong at once: it counted insight
            // a second time (insight is already in the odds and is now in what
            // a reader can take off a page), and it made every life in the
            // world practise the same imaginary average book. What somebody was
            // handed is a fact about their origin, so the origin says it.
            techniqueQuality: road,
            // Placement: arrays, elder guidance, and a stipend that means this
            // person is not foraging. 1 for the nine births in ten that have none.
            sectBonus: origin.placement.sectBonus
        }
    ).perDay * DAYS_PER_YEAR;

    if (perYearAt(0) <= 0) {
        return { ordinal: 0, spiritStones: Math.max(0, Math.round(origin.spiritStones)) };
    }
    // The province's ceiling is absolute, and placement does NOT lift it.
    //
    // That is deliberate and it is the harder of the two readings. A fostered
    // child is somewhere else, and this derivation is for the people who are
    // here: `localCeilingOrdinal` means nobody in this province has passed it
    // in living memory, and an origin that could quietly exceed it would make
    // the statement false for the exact people the province is least likely to
    // have produced. What being placed is worth here is the support and the
    // stipend, which are already in the rate above.
    const cap = Math.min(clampOrdinal(ceiling), MAX_ORDINAL);

    let ordinal = 0;
    let age = MIN_AGE;
    let spent = 0;
    // Stones are finite and they are spent. A patriarch's fortune buys a great
    // many pills and then it is gone, which is why this term flattens out
    // rather than compounding.
    let stones = origin.spiritStones;

    while (ordinal < cap) {
        const cost = progressRequiredForOrdinal(ordinal);
        // Above the Lid nothing is priced in qi, so the walk stops here.
        if (cost === null) break;
        const perYear = perYearAt(ordinal);
        const allowance = stagnationYearsForOrdinal(ordinal);
        const lifespan = lifespanForOrdinal(ordinal);

        // ── MONEY IS THE SECOND ROAD UP, AND IT WAS NEVER CONNECTED ──────
        //
        // What actually empties the middle of the ladder is not the crossing
        // roll. `scripts/probe-pill-affordability.ts` watches this loop over
        // four thousand lives: inside Qi Condensation the mean odds are 0.899
        // and a pill is already being bought at mean potency 0.39. Nobody is
        // failing crossings and nobody is failing to afford a pill.
        //
        // What runs out is YEARS. Ordinal 12 needs 10,661 qi-units at 86 a
        // year for an ordinary cultivator, which is 123.6 years against a Qi
        // Condensation lifespan of 100 - the last rung of the realm costs more
        // time than the realm grants, so the histogram piles up at 12 and
        // Foundation reads zero. See `probe-what-a-crossing-costs-in-years.ts`.
        //
        // The lever the catalog already had and nothing read is
        // `advance_progress`. A cultivator's spare income converts to qi at
        // whatever the open market charges, and the market is the commodity
        // tier and only the commodity tier - see
        // `engine/cultivation/buying-and-bartering-pills.ts`. Nothing above
        // earth grade is for sale for money, so no fortune buys the last
        // realms, and `pillBandDecay` inside `stonesPerQiUnitAt` makes a cheap
        // pill quietly stop being a bargain to somebody strong.
        //
        // The shape this produces is not tuned; it falls out of two curves that
        // already existed. At ordinal 0 a cultivator clears 2.7 stones a year
        // and buys 2 qi against 86 accrued, which is nothing - the bottom of
        // the ladder is untouched. At ordinal 12 they clear 127 and buy 109
        // against 86, which is the rung that was impossible becoming merely
        // very hard. Above Core Formation the income cap and the band decay
        // between them make it irrelevant again.
        const netPerYear =
            origin.placement.stipendPerYear
            + (1 - focus) * earningsPerYear(ordinal)
            - focus * STONES_PER_YEAR_OF_SECLUSION;
        // The crossing pill comes first. Somebody who spends the pill money on
        // reaching the door faster arrives at the door with nothing, which is
        // not a trade anybody makes twice - so one pill's worth of the income
        // over this rank is reserved and only the remainder becomes qi.
        const naturalYears = cost / perYear;
        const reservePerYear = naturalYears > 0
            ? Math.min(Math.max(0, netPerYear), BREAKTHROUGH_PILL_STONES / naturalYears)
            : Math.max(0, netPerYear);
        const spendPerYear = opts.buysProgress === false
            ? 0
            : Math.max(0, netPerYear - reservePerYear);
        const perYearHere = perYear + purchasedQiPerYear(spendPerYear, ordinal);

        let yearsAtRank = 0;
        let crossed = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const yearsNeeded = cost / perYearHere;
            // Settling: a plateau longer than the realm permits ends the life
            // where it stands, exactly as it does for the player.
            if (yearsAtRank + yearsNeeded >= allowance) break;
            // Lifespan: the realm grants a span, and it runs out.
            if (age + yearsNeeded >= lifespan) break;
            if (spent + yearsNeeded >= lifetime) break;

            yearsAtRank += yearsNeeded;
            age += yearsNeeded;
            spent += yearsNeeded;
            // Upkeep, stipend, and the work. A year at a rank costs stones
            // whether or not anything comes of it - but a life is not spent
            // entirely in a cave, and the part that is not IS the earning.
            //
            // `effort` already says what fraction of the time this person
            // actually cultivates, so the remainder is the fraction they spend
            // gathering, escorting, refining, or being useful to somebody who
            // pays. Without this term the walk modelled pure burn and every
            // NPC in the world finished holding nothing, which left the
            // economy with no participants at all.
            const secludedYears = yearsNeeded * focus;
            const workingYears = yearsNeeded - secludedYears;
            stones = Math.max(
                0,
                stones
                    + yearsNeeded * origin.placement.stipendPerYear
                    - secludedYears * STONES_PER_YEAR_OF_SECLUSION
                    + workingYears * earningsPerYear(ordinal)
            );
            // And what went over the counter on the way. Progress bought is
            // progress paid for: without this line the crossing pill would be
            // bought with money that had already been spent on qi, and the
            // holding every NPC in the world ends up with would be a fiction.
            stones = Math.max(0, stones - yearsNeeded * spendPerYear);

            // One pill, bought if the holding covers it, and actually paid for.
            const stonesBeforePill = stones;
            const potency = affordablePillPotency(stones, BREAKTHROUGH_PILL_STONES);
            const pill = potency > 0
                ? { name: 'a breakthrough pill', potency: potency * MAX_PILL_BONUS }
                : null;
            stones = Math.max(0, stones - potency * BREAKTHROUGH_PILL_STONES);

            const odds = computeBreakthroughOdds(
                { realmOrdinal: ordinal, spiritRoot: root, attributes, injuries: [] },
                // The same book that built this realm is standing at the
                // crossing with them. Preparation, not instruction - see
                // `manualQuality` on `BreakthroughContext`. Without this the
                // walk priced the manual on the road and forgot it at the one
                // moment the road was for.
                { ambient, pill, manualQuality: road }
            );
            const struck = rng.next() < odds.finalChance;
            opts.onAttempt?.({
                ordinal,
                age,
                stonesBeforePill,
                pillPrice: BREAKTHROUGH_PILL_STONES,
                potency,
                finalChance: odds.finalChance,
                crossed: struck
            });
            if (struck) {
                crossed = true;
                break;
            }
            // A failure burns part of what was accumulated, and the time to
            // put it back is real. Averaged over the failure table rather than
            // rolled, because this is a derivation and not a playthrough.
            const burned =
                (FAILURE_PROGRESS_LOSS.failure_stable +
                    FAILURE_PROGRESS_LOSS.failure_injured +
                    FAILURE_PROGRESS_LOSS.failure_deviation) / 3;
            const recovery = (cost * burned) / perYearHere;
            yearsAtRank += recovery;
            age += recovery;
            spent += recovery;
        }

        if (!crossed) break;
        ordinal++;
    }

    return { ordinal, spiritStones: Math.max(0, Math.round(stones)) };
}

/**
 * What the life walk left them holding, alongside where it left them.
 *
 * The stones were always computed - upkeep, stipend and pills are what decide
 * how many attempts a life gets - and were thrown away at the end, which is
 * why every NPC in the world held nothing. Returning them costs nothing and
 * gives the economy its participants.
 */
export function deriveOrdinal(
    root: SpiritRootKey,
    attributes: InnateAttributes,
    ageYears: number,
    regionRateMultiplier: number,
    ceiling: number,
    rng: CultivationRNG,
    opts: DeriveOrdinalOptions = {}
): number {
    return deriveLife(root, attributes, ageYears, regionRateMultiplier, ceiling, rng, opts).ordinal;
}

/**
 * Generate the population, derive what each one became, and only then decide
 * who runs anything.
 */
function seedPopulation(
    state: WorldState,
    catalog: WorldCatalog,
    factions: readonly FactionRecord[],
    population: number,
    presentDay: number
): NpcRecord[] {
    const regions = catalog.regions;
    if (regions.length === 0 || population === 0) return [];

    const factionById = new Map(factions.map(f => [f.id, f]));
    const catalogById = new Map(catalog.factions.map(f => [f.id, f]));
    const created: NpcRecord[] = [];

    // ── Names have to be unique, and nothing else in the engine enforces it ──
    //
    // Knowledge is keyed by id; everything the player ever READS is keyed by
    // name. Two people called Shen Wuyou in one province therefore does not
    // read as a coincidence, it silently breaks the guarantee the knowledge
    // system rests on - a name you were told is a name you have - because the
    // wrong one standing in the room satisfies it.
    //
    // The name space is 20 x 20 x 20, so at a few hundred people the birthday
    // paradox produces collisions every single seed. Carried as ONE mutable
    // set for the whole pass rather than rebuilt per NPC, which would be
    // quadratic over a few hundred creations for no gain, and pre-charged with
    // the catalog's names: those figures are created later and are ASSIGNED
    // their names, so a procedural roll that lands on one would never be seen
    // to collide until a player met both.
    const taken = new Set<string>(state.npcs.map(n => n.name));
    for (const member of MEMBERS) taken.add(member.name);

    // Spread the population over regions by how much qi they can support. A
    // thin province carries fewer cultivators, which is the setting's own
    // arithmetic and not a balance knob.
    const weights = regions.map(r => 0.25 + qiFraction(r.qiDensity));
    const total = weights.reduce((a, b) => a + b, 0);

    let seq = 0;
    for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        const share = Math.round(population * (weights[i] / total));
        const regionLoc = regionLocationId(region.id);
        const placeIds = [regionLoc, ...region.places.map(p => placeLocationId(region.id, p.name))];
        const regionFactions = region.factionIds
            .map(id => factionById.get(id))
            .filter((f): f is FactionRecord => f != null);

        for (let n = 0; n < share; n++) {
            const id = `npc-${seq++}`;
            const rng = forStream(state.seed, 'seed-life', id);
            const age = rng.int(MIN_AGE, MAX_AGE);

            let npc = createNpc(state.seed, {
                id,
                bornOnDay: presentDay - years(age),
                onDay: presentDay,
                locationId: placeIds[rng.int(0, placeIds.length - 1)],
                occupation: 'unknown',
                takenNames: taken,
                tags: [`region:${region.id}`]
            });
            taken.add(npc.name);

            // Derived, not assigned. Same inputs the player gets, and that now
            // includes where they were born - which is the honest explanation
            // for why a Dao house has the members it does. Nobody is placed
            // in one; the origin roll puts them there and the derivation spends
            // what it supplied.
            const life = deriveLife(
                npc.cultivation.spiritRoot,
                npc.cultivation.attributes,
                age,
                region.ambientRateMultiplier,
                region.localCeilingOrdinal,
                rng,
                { origin: npc.identity.origin }
            );
            const ordinal = life.ordinal;
            npc = setRealm(npc, ordinal, presentDay - years(rng.int(0, 8)));
            npc = { ...npc, spiritStones: life.spiritStones };
            npc = {
                ...npc,
                cultivation: {
                    ...npc.cultivation,
                    foundation: ordinal >= 13 ? 'stable' : 'incomplete',
                    specialties: getSpiritRoot(npc.cultivation.spiritRoot).elements.slice()
                }
            };
            npc = addGoal(npc, goalFor(npc, region, rng), presentDay - years(rng.int(1, 20)));

            // Affiliation is offered to those a faction here would look at.
            if (regionFactions.length > 0 && rng.chance(AFFILIATION_RATE)) {
                const candidate = regionFactions[rng.int(0, regionFactions.length - 1)];
                const cf = catalogById.get(candidate.id);
                if (cf && cf.recruits && ordinal >= cf.admissionOrdinal) {
                    npc = { ...npc, factionId: candidate.id, factionRankIndex: 0 };
                }
            }

            state.npcs.push(npc);
            created.push(npc);
        }
    }
    state.nextNpcSeq = seq;

    // The catalogs already contain the people the derivation cannot produce.
    // Instantiate them before roles are handed out, so a faction's curated
    // seniors are in the room when the pyramid is built.
    created.push(...seedNamedFigures(state, catalog, presentDay));
    created.push(...seedFactionApex(state, catalog, presentDay, taken));

    assignFactionRoles(state, catalogById, presentDay);
    return created;
}

/**
 * Instantiate the named people the content catalogs already describe.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * `deriveOrdinal` walks the real cost curve against the real clocks, which is
 * correct and which means a present-day cultivator with a hundred and twenty
 * years cannot get past Foundation Establishment in the Late Age. Left to it,
 * a seeded world's strongest inhabitant was ordinal 16 - so the catalogs could
 * describe Dao houses, apex institutions and sealed ancestors while the world
 * contained no instance of any of them, and nothing in the discovery ladder
 * could fire because there was nobody from a higher stratum to walk past.
 *
 * The answer is not to loosen the derivation. It is that the upper stratum was
 * never a procedural product in the first place: those people are CONTENT, with
 * names, factions, ranks and reasons, and `members.ts` holds a hundred and
 * fifteen of them. Seeding them is instantiating what the world already says
 * is true, rather than generating a second, luckier population beside the one
 * the arithmetic produced.
 *
 * They are placed at their faction's seat, not scattered through market towns:
 * the stratum has to EXIST so it can act, be referred to and be encountered
 * rarely, without becoming something a beginner trips over.
 */
function seedNamedFigures(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number
): NpcRecord[] {
    const catalogById = new Map(catalog.factions.map(f => [f.id, f]));
    const created: NpcRecord[] = [];

    for (const member of MEMBERS) {
        const faction = catalogById.get(member.factionId);
        if (!faction) continue;

        const id = `npc-${member.id}`;
        if (state.npcs.some(n => n.id === id)) continue;

        const rng = forStream(state.seed, 'seed-named', id);
        // Old enough to have got where the catalog says they are, without
        // being implausibly ancient for it.
        const age = Math.min(
            MAX_NAMED_AGE,
            MIN_AGE + Math.round(member.realmOrdinal * NAMED_YEARS_PER_ORDINAL) + rng.int(0, 40)
        );

        let npc = createNpc(state.seed, {
            id,
            bornOnDay: presentDay - years(age),
            onDay: presentDay,
            locationId: seatLocationId(catalog, faction),
            occupation: 'unknown',
            tags: ['catalog:member', `faction:${faction.id}`]
        });

        npc = setRealm(npc, clampOrdinal(member.realmOrdinal), presentDay - years(rng.int(0, 12)));
        npc = {
            ...npc,
            name: member.name,
            factionId: faction.id,
            factionRankIndex: Math.min(member.rankIndex, Math.max(0, faction.ranks.length - 1)),
            spiritStones: holdingsFor(member.realmOrdinal, member.rankIndex, rng),
            cultivation: {
                ...npc.cultivation,
                foundation: member.realmOrdinal >= 13 ? 'stable' : 'incomplete',
                specialties: getSpiritRoot(npc.cultivation.spiritRoot).elements.slice()
            }
        };

        state.npcs.push(npc);
        created.push(npc);
    }

    return created;
}

/**
 * Give every faction somebody who is actually as strong as it claims to be.
 *
 * A faction's `powerOrdinal` is a statement about the world - it is what lets
 * the thing bully, hold a vein, and be feared - and until now nothing stood
 * behind it. A house that says its strongest member is Grand Ascension while
 * its strongest instance is a Foundation Establishment disciple is a claim the
 * simulation cannot back, and the whole apex tier was in that state.
 *
 * One figure per faction, at the seat, and only where the derived and named
 * membership fell short of what the catalog declares. They are not placed
 * anywhere a beginner goes and they are not marked important: they are simply
 * the person the faction has always said it had.
 */
/**
 * Nobody was born before the world had a history to be born into.
 *
 * A lifespan at the top of the ladder is tens of thousands of years, so an age
 * drawn as a fraction of one - which is the right way to draw it, because the
 * point is that this person climbed when the climbing was possible - runs
 * straight past the world's own first era. A seeded world produced an ordinal 44
 * born in year -24,008 while the earliest era in its ledger opened in year
 * -1,700: somebody twenty-two thousand years older than anything that could be
 * said to have happened, whose whole life is off the end of the record.
 *
 * So the age is bounded by the span the ledger covers, less one generation, and
 * the excess is simply not drawn. What that means in the world is not a
 * compromise: the oldest people alive are as old as history, which is the claim
 * the apex tier was making all along.
 *
 * Returns the age unchanged where the ledger has no era, which is the honest
 * reading of a world with no recorded past to be older than.
 */
export function ageInsideRecordedHistory(
    state: WorldState,
    presentDay: number,
    wantedYears: number
): number {
    if (state.history.eras.length === 0) return wantedYears;
    const firstEraStart = state.history.eras.reduce(
        (earliest, era) => Math.min(earliest, era.startDay), Infinity);
    if (!Number.isFinite(firstEraStart)) return wantedYears;
    const spanYears = Math.floor((presentDay - firstEraStart) / DAYS_PER_YEAR) - MIN_AGE;
    if (spanYears <= MIN_AGE) return wantedYears;
    return Math.min(wantedYears, spanYears);
}

function seedFactionApex(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number,
    /** Names already spoken for in this world. See the note in `seedPopulation`. */
    taken: Set<string>
): NpcRecord[] {
    const created: NpcRecord[] = [];

    for (const faction of catalog.factions) {
        const declared = clampOrdinal(faction.powerOrdinal);
        if (declared < APEX_SEED_FLOOR) continue;

        const strongest = state.npcs
            .filter(n => n.factionId === faction.id && n.status === 'alive')
            .reduce((best, n) => Math.max(best, n.cultivation.realmOrdinal), -1);
        if (strongest >= declared) continue;

        const id = `npc-apex-${faction.id}`;
        if (state.npcs.some(n => n.id === id)) continue;

        const rng = forStream(state.seed, 'seed-apex', id);
        // Somebody at this ordinal climbed when the climbing was possible, so
        // they are old on the scale their realm actually grants.
        const wanted = Math.min(
            Math.max(MIN_AGE + 1, Math.floor(lifespanForOrdinal(declared) * APEX_AGE_FRACTION)),
            Math.floor(lifespanForOrdinal(declared) * 0.9)
        ) + rng.int(0, 200);
        const age = ageInsideRecordedHistory(state, presentDay, wanted);

        let npc = createNpc(state.seed, {
            id,
            bornOnDay: presentDay - years(age),
            onDay: presentDay,
            locationId: seatLocationId(catalog, faction),
            occupation: 'unknown',
            takenNames: taken,
            tags: ['catalog:apex', `faction:${faction.id}`]
        });
        taken.add(npc.name);

        npc = setRealm(npc, declared, presentDay - years(rng.int(20, 400)));
        npc = {
            ...npc,
            factionId: faction.id,
            factionRankIndex: Math.max(0, faction.ranks.length - 1),
            spiritStones: holdingsFor(declared, Math.max(0, faction.ranks.length - 1), rng),
            cultivation: {
                ...npc.cultivation,
                foundation: 'stable',
                specialties: getSpiritRoot(npc.cultivation.spiritRoot).elements.slice()
            }
        };

        state.npcs.push(npc);
        created.push(npc);
    }

    return created;
}

/**
 * Where a faction sits. Matched against region ids and place names, falling
 * back to the first region so a catalog entry with an unrecognised territory
 * still lands somewhere real rather than nowhere.
 */
function seatLocationId(catalog: WorldCatalog, faction: CatalogFaction): string {
    const wanted = faction.territory.toLowerCase();
    for (const region of catalog.regions) {
        if (region.id.toLowerCase().includes(wanted) || wanted.includes(region.id.toLowerCase())) {
            return regionLocationId(region.id);
        }
        for (const place of region.places) {
            if (place.name.toLowerCase() === wanted) {
                return placeLocationId(region.id, place.name);
            }
        }
    }
    const home = catalog.regions.find(r => r.factionIds.includes(faction.id)) ?? catalog.regions[0];
    return home ? regionLocationId(home.id) : 'the open road';
}

/**
 * Rank every faction's members on the realm they turned out to have, and hand
 * out the titles in that order.
 *
 * This is where "no important NPC flag" is actually enforced: the leader is
 * whoever came out strongest, and if a faction's draw was poor its patriarch is
 * a Foundation Establishment cultivator holding a seat that used to want Core
 * Formation. That faction is now in trouble, nobody decided it should be, and
 * the pressure layer will make it somebody's opportunity.
 */
function assignFactionRoles(
    state: WorldState,
    catalogById: Map<string, CatalogFaction>,
    presentDay: number
): void {
    const membersByFaction = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (!npc.factionId) continue;
        const list = membersByFaction.get(npc.factionId);
        if (list) list.push(npc);
        else membersByFaction.set(npc.factionId, [npc]);
    }

    for (const faction of state.factions) {
        const members = membersByFaction.get(faction.id);
        if (!members || members.length === 0) continue;
        const cf = catalogById.get(faction.id);
        const ladder = faction.ranks.length;

        members.sort((a, b) =>
            b.cultivation.realmOrdinal - a.cultivation.realmOrdinal ||
            a.identity.bornOnDay - b.identity.bornOnDay ||
            (a.id < b.id ? -1 : 1)
        );

        // A pyramid: one at the top, a few elders, the rest below.
        const elderFloor = Math.max(0, ladder - 3);
        for (let i = 0; i < members.length; i++) {
            const rank =
                i === 0 ? ladder - 1
                    : i <= Math.max(1, Math.floor(members.length * 0.08)) ? Math.max(elderFloor, ladder - 2)
                        : i <= Math.max(2, Math.floor(members.length * 0.25)) ? Math.min(elderFloor, 2)
                            : i <= Math.max(3, Math.floor(members.length * 0.5)) ? 1 : 0;
            const at = state.npcs.findIndex(n => n.id === members[i].id);
            if (at < 0) continue;

            // A catalog figure's rank is curated content and the seeder should
            // not argue with the writing - but it does not get to claim the
            // seat either. The top of a ladder goes to whoever actually came
            // out strongest, which is the one thing this pass exists to
            // enforce, so a curated rank is honoured as a FLOOR everywhere
            // except the top rung.
            const curated = state.npcs[at].tags.some(t => t.startsWith('catalog:'));
            const assigned = curated
                ? (i === 0 ? ladder - 1 : Math.min(Math.max(state.npcs[at].factionRankIndex, rank), Math.max(0, ladder - 2)))
                : rank;
            state.npcs[at] = { ...state.npcs[at], factionRankIndex: assigned };
        }

        // The faction's real power is its strongest member, whatever the
        // catalog hoped for.
        const strongest = members[0].cultivation.realmOrdinal;
        faction.resources.power_ordinal = strongest;
        if (cf && strongest < cf.powerOrdinal - 3) {
            faction.tags = faction.tags.concat('underpowered');
            appendFact(state.history, makeFact({
                day: presentDay,
                kind: 'succession',
                scale: 'local',
                summary:
                    `The ${faction.name} is held by ${members[0].name}, who is weaker than the seat ` +
                    `has historically wanted. Nobody says so where it can be heard.`,
                factionIds: [faction.id],
                visibility: 'faction',
                magnitude: 0.35,
                data: { strongest }
            }));
        }

        // The people at the top know each other, and the ones passed over know
        // who passed them.
        const leader = members[0];
        for (let i = 1; i < Math.min(members.length, 5); i++) {
            const at = state.npcs.findIndex(n => n.id === members[i].id);
            if (at < 0) continue;
            state.npcs[at] = upsertRelationship(state.npcs[at], {
                targetId: leader.id,
                targetName: leader.name,
                kind: i === 1 ? 'rival' : 'ally',
                standing: i === 1 ? -0.25 : 0.3,
                note: i === 1 ? 'Was the other candidate.' : 'Serves under.'
            }, presentDay);
        }
    }
}

/** What this person is actually trying to do. Five fields, from their situation. */
function goalFor(
    npc: NpcRecord,
    region: CatalogRegion,
    rng: CultivationRNG
): Parameters<typeof addGoal>[1] {
    const ordinal = npc.cultivation.realmOrdinal;
    const stuck = ordinal >= region.localCeilingOrdinal - 1;
    const options: Parameters<typeof addGoal>[1][] = [
        {
            kind: 'cultivation',
            text: stuck
                ? `Get out of ${region.name} to somewhere the qi will carry them further.`
                : 'Advance a rank.',
            priority: stuck ? 0.8 : 0.55,
            progress: stuck ? 'Has worked out that the province is the problem.' : '',
            obstacles: stuck ? ['No money, no invitation, and nowhere to go.'] : ['Time.']
        },
        {
            kind: 'wealth',
            text: 'Put together enough spirit stones to stop worrying about food.',
            priority: 0.45,
            obstacles: ['Everything here is already owned.']
        },
        {
            kind: 'status',
            text: 'Be taken seriously by somebody who matters locally.',
            priority: 0.5,
            obstacles: ['Nobody has heard of them.']
        },
        {
            kind: 'survival',
            text: 'Live long enough to see a grandchild.',
            priority: 0.6,
            obstacles: ['A realm that does not extend a lifespan much.']
        },
        {
            kind: 'discovery',
            text: 'Find out what is actually inside the sealed ground nearby.',
            priority: 0.4,
            obstacles: ['It was sealed by people much stronger.']
        }
    ];
    return options[rng.int(0, options.length - 1)];
}

// ─────────────────────────────────────────────────────────────────────────
// LINEAGES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Families, so that a death has somewhere to send what it leaves.
 *
 * Pairs are formed by surname and age gap: two people who share a name and are
 * a generation apart are recorded as parent and child. That is cheap, it is
 * deterministic, and it produces exactly what long time-skips need to land on -
 * without simulating anybody's marriage.
 */
function seedLineages(state: WorldState, npcs: readonly NpcRecord[], presentDay: number): LineageRecord[] {
    const bySurname = new Map<string, NpcRecord[]>();
    for (const npc of npcs) {
        const surname = npc.name.split(' ')[0];
        const list = bySurname.get(surname);
        if (list) list.push(npc);
        else bySurname.set(surname, [npc]);
    }

    const out: LineageRecord[] = [];
    for (const surname of Array.from(bySurname.keys()).sort()) {
        const family = bySurname.get(surname)!
            .slice()
            .sort((a, b) => a.identity.bornOnDay - b.identity.bornOnDay || (a.id < b.id ? -1 : 1));
        if (family.length < 2) continue;

        const founder = family[0];
        let lineage = createLineageRecord({
            id: `lin-${surname.toLowerCase()}`,
            surname,
            founderId: founder.id,
            foundedOnDay: founder.identity.bornOnDay
        });

        // Walk the family oldest first; anyone at least eighteen years younger
        // than a living earlier member becomes their child.
        for (let i = 1; i < family.length; i++) {
            const child = family[i];
            let parent: NpcRecord | null = null;
            for (let j = i - 1; j >= 0; j--) {
                if (child.identity.bornOnDay - family[j].identity.bornOnDay >= years(18)) {
                    parent = family[j];
                    break;
                }
            }
            if (!parent) continue;
            lineage = addLineageEdge(lineage, {
                parentId: parent.id,
                childId: child.id,
                relation: 'descendant',
                onDay: child.identity.bornOnDay
            });
        }

        if (lineage.edges.length === 0) continue;
        lineage.holdings = { spirit_stones: 0 };
        state.lineages.push(lineage);
        out.push(lineage);
    }

    void presentDay;
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// OPPORTUNITIES AND THE SCHEDULE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Windows that were already going to open and close whether or not the player
 * turned up.
 *
 * Recruitment on an annual cycle, veins that surface for a season, and a sealed
 * pocket per region that opens rarely enough that missing it costs a lifetime.
 * Nobody is told about any of them: `knownToIds` is empty, which is the state
 * that lets a window come and go with the world entirely unaware.
 */
function seedOpportunities(
    state: WorldState,
    catalog: WorldCatalog,
    regions: Map<string, LocationRecord>,
    presentDay: number
): OpportunityWindow[] {
    const out: OpportunityWindow[] = [];

    for (const cf of catalog.factions) {
        if (!cf.recruits) continue;
        const rng = forStream(state.seed, 'seed-recruit', cf.id);
        const opp = makeOpportunity({
            id: `opp-recruit-${cf.id}`,
            kind: 'recruitment',
            name: `admission to the ${cf.name}`,
            summary: `The ${cf.name} looks at applicants once a year.`,
            factionIds: [cf.id],
            opensOnDay: presentDay + rng.int(0, 364),
            durationDays: rng.int(7, 30),
            recurrenceDays: years(1),
            requirements: {
                attempt: 0,
                survive: 0,
                succeed: cf.admissionOrdinal,
                understand: 0,
                force: cf.powerOrdinal
            },
            tags: ['recruitment']
        });
        state.opportunities.push(opp);
        out.push(opp);
    }

    for (const region of catalog.regions) {
        const loc = regions.get(region.id);
        if (!loc) continue;
        const rng = forStream(state.seed, 'seed-opp', region.id);

        const seam = makeOpportunity({
            id: `opp-seam-${region.id}`,
            kind: 'realm_opening',
            name: `the sealed ground under ${region.name}`,
            summary: 'A pocket nothing has drawn on. It is not always reachable.',
            locationId: loc.id,
            opensOnDay: presentDay + rng.int(0, years(60)),
            durationDays: rng.int(10, 40),
            recurrenceDays: years(rng.int(40, 120)),
            requirements: {
                attempt: Math.max(0, region.localCeilingOrdinal - 8),
                survive: Math.max(0, region.localCeilingOrdinal - 4),
                succeed: region.localCeilingOrdinal,
                understand: region.localCeilingOrdinal,
                force: MAX_ORDINAL
            },
            tags: ['sealed', 'rare']
        });
        state.opportunities.push(seam);
        out.push(seam);

        const harvest = makeOpportunity({
            id: `opp-harvest-${region.id}`,
            kind: 'resource',
            name: `the ${withoutArticle(region.name)} ripening`,
            summary: `What ${region.name} exports is worth gathering for a few weeks a year.`,
            locationId: loc.id,
            opensOnDay: presentDay + rng.int(0, 364),
            durationDays: rng.int(10, 25),
            recurrenceDays: years(1),
            requirements: { attempt: 0, survive: 0, succeed: 0, understand: 0, force: 0 },
            tags: ['harvest']
        });
        state.opportunities.push(harvest);
        out.push(harvest);
    }

    return out;
}

/**
 * Grant renewals.
 *
 * A federated faction's hold on its vein expires on a date somebody else
 * controls. Putting those on the books at seeding is what makes a renewal
 * capable of failing while the player is in a cave - and the pressure layer
 * decides, when the day comes, whether it did.
 */
function seedGrantSchedule(
    state: WorldState,
    catalog: WorldCatalog,
    presentDay: number
): ScheduledEffect[] {
    const out: ScheduledEffect[] = [];
    let seq = state.nextEffectSeq;

    for (const cf of catalog.factions) {
        if (cf.governance !== 'federated' || cf.renewalYears <= 0) continue;
        const rng = forStream(state.seed, 'seed-grant', cf.id);
        const first = presentDay + rng.int(0, years(cf.renewalYears));
        const effect: ScheduledEffect = {
            id: `e${seq++}`,
            kind: 'assessment',
            dueOnDay: first,
            summary: `The ${cf.name}'s grant on its vein comes up for renewal.`,
            actorIds: [],
            locationId: null,
            factionId: cf.id,
            repeatDays: years(cf.renewalYears),
            interrupts: false,
            // Renewal is close to automatic, and the rare failure is the whole
            // point of holding a vein on somebody else's terms.
            chance: 1,
            fired: false,
            firedOnDay: null,
            data: { kind: 'grant_renewal', factionId: cf.id, magnitude: 0.4 }
        };
        state.schedule.push(effect);
        out.push(effect);
    }

    state.nextEffectSeq = seq;
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// REPORTING
// ─────────────────────────────────────────────────────────────────────────

/** Living NPCs per realm tier, lowest first. Nine buckets, one per realm. */
export function histogram(state: WorldState): number[] {
    const tiers = [0, 13, 17, 21, 25, 29, 33, 37, 41, 45];
    const out = new Array(tiers.length - 1).fill(0);
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        const o = npc.cultivation.realmOrdinal;
        for (let i = 0; i < out.length; i++) {
            if (o >= tiers[i] && o < tiers[i + 1]) {
                out[i]++;
                break;
            }
        }
    }
    return out;
}

/** Convenience for callers that want a live world without touching the adapter. */
export function livingPopulation(state: WorldState): number {
    let n = 0;
    for (const npc of state.npcs) if (npc.status === 'alive') n++;
    return n;
}

void lifespanForOrdinal;
