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
import {
    MAX_ORDINAL,
    clampOrdinal,
    lifespanForOrdinal,
    progressRequiredForOrdinal
} from '../cultivation/realms.js';
import { computeBreakthroughOdds, FAILURE_PROGRESS_LOSS } from '../cultivation/breakthrough.js';
import { eraAmbientMultiplier } from '../cultivation/ambient.js';
import { stagnationYearsForOrdinal, type AmbientQi } from '../../schema/cultivation.js';
import { getSpiritRoot } from '../cultivation/spirit-roots.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import type { InnateAttributes, SpiritRootKey } from '../cultivation/spirit-roots.js';
import type { WorldCatalog, CatalogFaction, CatalogRegion } from './catalog.js';
import {
    linkLocations,
    makeAffinity,
    makeEnvironment,
    makeLocation,
    makeThresholds,
    type LocationRecord
} from './locations.js';
import { addGoal, createNpc, setRealm, upsertRelationship, type NpcRecord } from './npc-state.js';
import { addLineageEdge, createLineageRecord, type LineageRecord } from './lineage.js';
import { makeOpportunity, years, type OpportunityWindow } from './opportunities.js';
import { dayOfYear, makeFact, appendFact } from './history.js';
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

// ─────────────────────────────────────────────────────────────────────────
// THE SEED
// ─────────────────────────────────────────────────────────────────────────

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
                spiritualDensity: region.qiDensity,
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
                    spiritualDensity: region.qiDensity,
                    danger: place.kind === 'site' ? 0.5 : 0.1,
                    resources: region.exports.slice(0, 2),
                    politicalControl: politicalControlOf(region),
                    historicalScars: []
                }),
                tags: ['place', place.kind],
                data: { catalogRegionId: region.id }
            }));
        }

        // The vein. It is the reason the region has politics at all, and it is
        // the thing factions take from each other.
        if (region.veinStatus) {
            state.locations.push(makeLocation({
                id: `${regionLocationId(region.id)}-vein`,
                name: `the ${region.name} vein`,
                kind: 'vein',
                parentId: location.id,
                description: region.veinStatus,
                ambient: region.qiDensity > 0.6 ? 'dense' : region.ambient,
                qiDensity: Math.min(1, region.qiDensity + 0.3),
                thresholds: makeThresholds(0, 0, Math.max(0, ceiling - 6), ceiling),
                hazards: ['formation'],
                environment: makeEnvironment({
                    spiritualDensity: Math.min(1, region.qiDensity + 0.3),
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
function seedFactions(
    state: WorldState,
    catalog: WorldCatalog,
    regions: Map<string, LocationRecord>,
    presentDay: number
): FactionRecord[] {
    const out: FactionRecord[] = [];
    const regionForFaction = new Map<string, string>();
    for (const region of catalog.regions) {
        for (const id of region.factionIds) regionForFaction.set(id, region.id);
    }

    for (const cf of catalog.factions) {
        const rng = forStream(state.seed, 'seed-faction', cf.id);
        const regionId = regionForFaction.get(cf.id) ?? catalog.regions[0]?.id ?? null;
        const seat = regionId ? regions.get(regionId) ?? null : null;

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
                admission_ordinal: cf.admissionOrdinal
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
        if (cf.holdsVein && seat) {
            const vein = state.locations.find(l => l.id === `${seat.id}-vein`);
            if (vein && !vein.controllingFactionId) {
                vein.controllingFactionId = cf.id;
                faction.controlledLocationIds.push(vein.id);
            }
        }

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
export function deriveOrdinal(
    root: SpiritRootKey,
    attributes: InnateAttributes,
    ageYears: number,
    regionRateMultiplier: number,
    ceiling: number,
    rng: CultivationRNG,
    opts: DeriveOrdinalOptions = {}
): number {
    const lifetime = Math.max(0, ageYears - MIN_AGE);
    if (lifetime <= 0) return 0;

    // Most people are not sitting in a cave. A wide, right-skewed draw that
    // stands for everything this layer does not model about a life.
    const effort = rng.float(0.08, 0.75) * (1 + attributes.insight * 0.08);
    const ambient: AmbientQi = opts.ambient ?? 'normal';
    const era = opts.eraQiDensity === undefined ? 1 : eraAmbientMultiplier(opts.eraQiDensity);
    const maxAttempts = Math.max(1, opts.maxAttemptsPerRank ?? 12);

    const rate = computeCultivationRate({ spiritRoot: root, injuries: [] }, ambient, {
        focusMultiplier: Math.min(1, effort),
        locationBonus: Math.max(0.1, regionRateMultiplier) * era,
        techniqueBonus: 1 + attributes.insight * 0.06
    }).perDay;
    if (rate <= 0) return 0;

    const perYear = rate * DAYS_PER_YEAR;
    const cap = Math.min(clampOrdinal(ceiling), MAX_ORDINAL);

    let ordinal = 0;
    let age = MIN_AGE;
    let spent = 0;

    while (ordinal < cap) {
        const cost = progressRequiredForOrdinal(ordinal);
        const allowance = stagnationYearsForOrdinal(ordinal);
        const lifespan = lifespanForOrdinal(ordinal);
        let yearsAtRank = 0;
        let crossed = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const yearsNeeded = cost / perYear;
            // Settling: a plateau longer than the realm permits ends the life
            // where it stands, exactly as it does for the player.
            if (yearsAtRank + yearsNeeded >= allowance) break;
            // Lifespan: the realm grants a span, and it runs out.
            if (age + yearsNeeded >= lifespan) break;
            if (spent + yearsNeeded >= lifetime) break;

            yearsAtRank += yearsNeeded;
            age += yearsNeeded;
            spent += yearsNeeded;

            const odds = computeBreakthroughOdds(
                { realmOrdinal: ordinal, spiritRoot: root, attributes, injuries: [] },
                { ambient }
            );
            if (rng.next() < odds.finalChance) {
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
            const recovery = (cost * burned) / perYear;
            yearsAtRank += recovery;
            age += recovery;
            spent += recovery;
        }

        if (!crossed) break;
        ordinal++;
    }

    return ordinal;
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

    // Spread the population over regions by how much qi they can support. A
    // thin province carries fewer cultivators, which is the setting's own
    // arithmetic and not a balance knob.
    const weights = regions.map(r => 0.25 + r.qiDensity);
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
                tags: [`region:${region.id}`]
            });

            // Derived, not assigned. Same inputs the player gets.
            const ordinal = deriveOrdinal(
                npc.cultivation.spiritRoot,
                npc.cultivation.attributes,
                age,
                region.ambientRateMultiplier,
                region.localCeilingOrdinal,
                rng
            );
            npc = setRealm(npc, ordinal, presentDay - years(rng.int(0, 8)));
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

    assignFactionRoles(state, catalogById, presentDay);
    return created;
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
            if (at >= 0) state.npcs[at] = { ...state.npcs[at], factionRankIndex: rank };
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
            name: `the ${region.name} ripening`,
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
