/**
 * How a cultivator comes by a road besides their own.
 */

import type { InsightDomain } from '../../schema/cultivation.js';
import {
    PLACES_THAT_TEACH_A_DAO,
    type PlaceThatTeachesADao
} from '../../data/cultivation/places-that-teach-a-dao.js';
import { daoRequirementFor } from '../cultivation/breakthrough.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { makeEnvironment, makeThresholds, makeLocation, type LocationRecord } from './locations.js';
import type { ObjectRecord } from './possessions.js';
import { isUnspent, spend } from './single-use-dao-comprehension-materials.js';
import { ageOf } from './an-npc-striking-at-the-next-wall.js';
import {
    roadsWalkedBy,
    type RoadWithinReach
} from '../cultivation/what-a-road-in-reach-costs-to-walk.js';
import {
    FOUND_BY_PROSPECTING_TAG,
    prospectingEffortIn
} from './how-the-world-keeps-finding-more-ruins.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// SEEDING THE GROUND
// ─────────────────────────────────────────────────────────────────────────

/** Tag every dao ground carries, so a location can be found without a join. */
export const DAO_GROUND_TAG = 'dao-ground';

/** The location id a catalog row becomes. Stable, so replays agree. */
export function daoGroundLocationId(place: PlaceThatTeachesADao): string {
    return `loc-${place.id}`;
}

/**
 * Turn the catalog into ordinary locations.
 */
export function seedPlacesThatTeachADao(state: WorldState): LocationRecord[] {
    const out: LocationRecord[] = [];
    for (const place of PLACES_THAT_TEACH_A_DAO) {
        const region = regionLocationFor(state, place.regionId);
        // A GROUND IS IN A PROVINCE. No province, no ground - and this guard is not
        // defensive tidiness, it is the difference between a world and a fixture.
        // `tests/engine/world/fixtures.ts` seeds a small catalog with none of the
        // real regions in it, and without this every one of these was planted there
        // anyway as a parentless orphan, adding twenty locations to a tiny world
        // and moving events that had nothing to do with comprehension.
        // `driver.test.ts` caught it: a vein that changed hands in one seeded
        // century stopped changing hands.
        if (!region) continue;
        const holder = place.heldBy
            ? state.factions.find(f => f.id === place.heldBy) ?? null
            : null;
        out.push(makeLocation({
            id: daoGroundLocationId(place),
            name: place.name,
            // Three ordinary kinds, chosen for what already reads them rather than
            // for what they sound like:
            kind: place.access === 'buried' ? 'secret_realm'
                : place.access === 'held' ? 'cave' : 'wilds',
            parentId: region.id,
            description: `${place.description} ${place.what}`,
            ambient: region.ambient,
            qiDensity: region.qiDensity,
            // What it takes to stand there and not be hurt by it. The floor is
            // the same number the road's floor is, because the reason a low
            // cultivator takes nothing from the Struck Terrace and the reason it
            // kills them are one reason.
            thresholds: makeThresholds(place.fromOrdinal, place.fromOrdinal, place.fromOrdinal, 0),
            hazards: place.access === 'buried' ? ['pressure', 'sealed_qi'] : [],
            environment: makeEnvironment({
                spiritualDensity: region.environment.spiritualDensity,
                danger: place.access === 'buried' ? 0.7
                    : place.access === 'held' ? 0.1
                    : 0.3,
                politicalControl: holder?.name ?? 'nobody',
                knownSecrets: []
            }),
            // A buried ground is not on anybody's map yet. That is the whole
            // difference between it and the one standing open in the same
            // province, and it is one boolean rather than a second mechanism.
            discovered: place.access !== 'buried',
            discoveredOnDay: place.access !== 'buried' ? state.currentDay : null,
            controllingFactionId: holder?.id ?? null,
            tags: [DAO_GROUND_TAG, place.access, `road:${place.domain}`],
            data: {
                daoGroundId: place.id,
                daoDomain: place.domain,
                daoSubject: place.subject,
                daoFromOrdinal: place.fromOrdinal,
                daoAccess: place.access,
                daoStandingRequired: place.standingRequired,
                catalogRegionId: place.regionId,
                // Zero, so `drawBirthplace` never puts a child on a terrace
                // where a tribulation came down. A dao ground is somewhere you
                // go, never somewhere you are from.
                populationWeight: 0
            }
        }));
    }
    // Held ground is the holder's, and the roster of what a house controls has
    // to say so or `locationsControlledBy` disagrees with the location itself.
    for (const location of out) {
        if (!location.controllingFactionId) continue;
        const at = state.factions.findIndex(f => f.id === location.controllingFactionId);
        if (at < 0) continue;
        const faction = state.factions[at];
        if (faction.controlledLocationIds.includes(location.id)) continue;
        state.factions[at] = {
            ...faction,
            controlledLocationIds: [...faction.controlledLocationIds, location.id]
        };
    }
    return out;
}

function regionLocationFor(state: WorldState, catalogRegionId: string): LocationRecord | null {
    return state.locations.find(
        l => l.kind === 'region' && l.data.catalogRegionId === catalogRegionId
    ) ?? null;
}

/** Which province a location is in, walking up the parent chain. */
export function regionCatalogIdOf(state: WorldState, locationId: string | null): string | null {
    let current = locationId ? state.locations.find(l => l.id === locationId) ?? null : null;
    for (let hops = 0; current && hops < 8; hops++) {
        const id = current.data.catalogRegionId;
        if (typeof id === 'string') return id;
        current = current.parentId
            ? state.locations.find(l => l.id === current!.parentId) ?? null
            : null;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS IN REACH
// ─────────────────────────────────────────────────────────────────────────

/**
 * A road, and the thing that put it in reach.
 */
export type RoadInReach = RoadWithinReach;

/**
 * The first thing somebody is short of at a ground that will not teach them.
 */
export type ShortOfAGround =
    /** Buried, and the world has not dug it out. Nobody alive can point at it. */
    | 'nobody_has_found_it'
    /** It is in another province and they are not in it. */
    | 'somewhere_else'
    /** A house holds it and they are not of that house. */
    | 'not_of_the_house'
    /** Of the house, and not far enough up its own ladder to be let near it. */
    | 'standing'
    /** They can stand on it. It is not legible to them at this rung. */
    | 'below_the_floor';

/**
 * One ground, as this rule needs to read it.
 */
export interface GroundAsTheRuleReadsIt {
    domain: InsightDomain;
    subject: string;
    /** `held` | `open` | `buried` | `carving`. Widened so a caller may pass a `data` value. */
    access: string;
    fromOrdinal: number;
    standingRequired: number;
    heldByFactionId: string | null;
    regionCatalogId: string | null;
    /**
     * Whether anybody knows it is there.
     */
    found: boolean;
}

/**
 * Somebody standing somewhere, as this rule needs to read them.
 */
export interface SomebodyStanding {
    ordinal: number;
    /** Province they are standing in, as a catalog region id. */
    regionCatalogId: string | null;
    factionId: string | null;
    /** Index into their own house's ladder. Negative for anybody in no house. */
    factionRankIndex: number;
}

export interface HowSomebodyStandsToAGround {
    /**
     * They know where it is, off their own life, and could set out for it.
     */
    knowsWhereItIs: boolean;
    /** Standing there long enough would teach them the road. */
    inReach: boolean;
    /** The first thing they are short by. Null when it is in reach. */
    shortBy: ShortOfAGround | null;
}

/**
 * How one person stands to one ground.
 */
export function howSomebodyStandsToAGround(
    ground: GroundAsTheRuleReadsIt,
    who: SomebodyStanding
): HowSomebodyStandsToAGround {
    const away = { knowsWhereItIs: false, inReach: false } as const;

    // Nobody has dug it out. This one hides the place itself rather than
    // hiding the reader from it, so it comes first.
    if (!ground.found) return { ...away, shortBy: 'nobody_has_found_it' };

    if (ground.access === 'held') {
        if (!who.factionId || who.factionId !== ground.heldByFactionId) {
            return { ...away, shortBy: 'not_of_the_house' };
        }
        // Of the house. They know the terrace is up there; they are not let on
        // it. This is what membership is worth and what standing costs.
        if (who.factionRankIndex < ground.standingRequired) {
            return { knowsWhereItIs: true, inReach: false, shortBy: 'standing' };
        }
    } else if (!who.regionCatalogId || who.regionCatalogId !== ground.regionCatalogId) {
        return { ...away, shortBy: 'somewhere_else' };
    }

    if (who.ordinal < ground.fromOrdinal) {
        return { knowsWhereItIs: true, inReach: false, shortBy: 'below_the_floor' };
    }
    return { knowsWhereItIs: true, inReach: true, shortBy: null };
}

/** The `how` a reachable ground supplies, which is what it costs in years. */
export function howARoadCameFrom(access: string): RoadInReach['how'] {
    return access === 'held' ? 'ground_held'
        : access === 'carving' ? 'carving'
        : access === 'buried' ? 'ground_buried'
        : 'ground_open';
}

/** One dao ground as the world holds it, read back into the rule's shape. */
export function groundAtLocation(location: LocationRecord): GroundAsTheRuleReadsIt | null {
    const domain = location.data.daoDomain;
    if (typeof domain !== 'string') return null;
    const access = String(location.data.daoAccess ?? '');
    return {
        domain: domain as InsightDomain,
        subject: String(location.data.daoSubject ?? location.name),
        access,
        fromOrdinal: Number(location.data.daoFromOrdinal ?? 0),
        standingRequired: Number(location.data.daoStandingRequired ?? 0),
        heldByFactionId: location.controllingFactionId,
        regionCatalogId: typeof location.data.catalogRegionId === 'string'
            ? location.data.catalogRegionId
            : null,
        // Only a buried ground can be unfound. Everything else is standing in
        // the open and has been for as long as the province has had a name.
        found: access !== 'buried' || location.discovered
    };
}

/**
 * The same read where there is no `WorldState` - the catalog's own row.
 */
export function groundFromCatalogRow(row: PlaceThatTeachesADao): GroundAsTheRuleReadsIt {
    return {
        domain: row.domain,
        subject: row.subject,
        access: row.access,
        fromOrdinal: row.fromOrdinal,
        standingRequired: row.standingRequired,
        heldByFactionId: row.heldBy,
        regionCatalogId: row.regionId,
        found: row.access !== 'buried'
    };
}

/** Every dao ground the world holds, with how this person stands to each. */
export function daoGroundsAround(
    state: WorldState,
    who: SomebodyStanding
): (RoadInReach & { ground: GroundAsTheRuleReadsIt; standing: HowSomebodyStandsToAGround })[] {
    const out: (RoadInReach & {
        ground: GroundAsTheRuleReadsIt;
        standing: HowSomebodyStandsToAGround;
    })[] = [];
    for (const location of state.locations) {
        if (!location.tags.includes(DAO_GROUND_TAG)) continue;
        const ground = groundAtLocation(location);
        if (!ground) continue;
        out.push({
            domain: ground.domain,
            subject: ground.subject,
            sourceId: location.id,
            sourceName: location.name,
            how: howARoadCameFrom(ground.access),
            ground,
            standing: howSomebodyStandsToAGround(ground, who)
        });
    }
    return out;
}

/** How an NPC stands, off the row the world keeps for them. */
export function standingOfNpc(state: WorldState, npc: NpcRecord): SomebodyStanding {
    return {
        ordinal: npc.cultivation.realmOrdinal,
        regionCatalogId: regionCatalogIdOf(state, npc.locationId),
        factionId: npc.factionId,
        factionRankIndex: npc.factionRankIndex
    };
}

/**
 * Every dao ground this person can actually get at.
 */
export function daoGroundsInReachOf(state: WorldState, npc: NpcRecord): RoadInReach[] {
    return daoGroundsAround(state, standingOfNpc(state, npc))
        .filter(row => row.standing.inReach)
        .map(({ domain, subject, sourceId, sourceName, how }) =>
            ({ domain, subject, sourceId, sourceName, how }));
}

/**
 * Roads bought with an object that no longer exists.
 */
export function roadsBoughtWithMaterialsBy(state: WorldState, npcId: string): RoadInReach[] {
    const out: RoadInReach[] = [];
    for (const object of state.objects) {
        if (object.kind !== 'material' || object.data?.spentBy !== npcId) continue;
        const domain = object.data?.domain;
        if (typeof domain !== 'string') continue;
        out.push({
            domain: domain as InsightDomain,
            subject: object.name,
            sourceId: object.id,
            sourceName: object.name,
            how: 'material_spent'
        });
    }
    return out;
}

// AN OBJECT FIT FOR YOUR PATH

/**
 * How far under an object's own rung it stops being legible as a road.
 */
export const ARTIFACT_LEGIBLE_WITHIN = 12;

/**
 * The standing a house asks before it lets anybody near the thing its whole
 * position rests on.
 */
export const STANDING_TO_STUDY_A_HOUSE_OBJECT = 3;

/** Somebody who might be holding something. The player is not an `NpcRecord`. */
export interface SomebodyHolding extends SomebodyStanding {
    /** Their own id, because an object is possessed by a person or by a house. */
    id: string;
}

/** Somebody standing, off the row the world keeps for them, with their id. */
export function holdingOfNpc(state: WorldState, npc: NpcRecord): SomebodyHolding {
    return { ...standingOfNpc(state, npc), id: npc.id };
}

/**
 * How one person stands to one object that carries a road.
 */
export function howSomebodyStandsToAnObject(
    object: Pick<ObjectRecord, 'possessorId' | 'power'>,
    who: SomebodyHolding
): HowSomebodyStandsToAGround {
    const inHand = object.possessorId === who.id;
    const ofTheHouse = who.factionId !== null && object.possessorId === who.factionId;
    if (!inHand && !ofTheHouse) {
        return { knowsWhereItIs: false, inReach: false, shortBy: 'not_of_the_house' };
    }
    // A house's own people can study what the house holds, rationed by exactly
    // the instrument every other house asset is rationed by. An outer disciple
    // does not get shown the vault, and is not shown the ancestor either.
    if (!inHand && who.factionRankIndex < STANDING_TO_STUDY_A_HOUSE_OBJECT) {
        return { knowsWhereItIs: true, inReach: false, shortBy: 'standing' };
    }
    if (who.ordinal < Number(object.power ?? 0) - ARTIFACT_LEGIBLE_WITHIN) {
        return { knowsWhereItIs: true, inReach: false, shortBy: 'below_the_floor' };
    }
    return { knowsWhereItIs: true, inReach: true, shortBy: null };
}

/** Every object in the world that carries a road, with how this person stands. */
export function objectsThatCarryARoad(
    state: WorldState,
    who: SomebodyHolding
): (RoadInReach & { power: number; standing: HowSomebodyStandsToAGround })[] {
    const out: (RoadInReach & { power: number; standing: HowSomebodyStandsToAGround })[] = [];
    for (const object of state.objects) {
        const domain = object.data?.daoDomain;
        if (typeof domain !== 'string') continue;
        out.push({
            domain: domain as InsightDomain,
            subject: object.name,
            sourceId: object.id,
            sourceName: object.name,
            how: 'artifact',
            power: Number(object.power ?? 0),
            standing: howSomebodyStandsToAnObject(object, who)
        });
    }
    return out;
}

/**
 * Roads legible off an object this cultivator can actually get at.
 */
export function roadsCarriedByObjectsInReachOf(
    state: WorldState,
    npc: NpcRecord
): RoadInReach[] {
    return objectsThatCarryARoad(state, holdingOfNpc(state, npc))
        .filter(row => row.standing.inReach)
        .map(({ domain, subject, sourceId, sourceName, how }) =>
            ({ domain, subject, sourceId, sourceName, how }));
}

/**
 * Every road WITHIN REACH of this cultivator: the arts in their hands, the ground
 * they can get at, and the objects that were spent on them.
 */
export function roadsInReachOf(state: WorldState, npc: NpcRecord): RoadInReach[] {
    const out: RoadInReach[] = [];
    const seen = new Set<InsightDomain>();

    for (const road of [
        ...roadsBoughtWithMaterialsBy(state, npc.id),
        ...roadsCarriedByObjectsInReachOf(state, npc),
        ...daoGroundsInReachOf(state, npc)
    ]) {
        if (seen.has(road.domain)) continue;
        seen.add(road.domain);
        out.push(road);
    }
    return out;
}

// THE WORLD FINDING THINGS

/**
 * Chance per year that one still-buried ground is dug open, per party looking in
 * the province it is in.
 */
export const BURIED_GROUND_FOUND_PER_PARTY_YEAR = 0.0005;

/**
 * What the flat figure was, kept because the calibration argument above is
 * stated against it and a number nobody can trace is worth less than a number
 * with its history attached.
 */
export const BURIED_GROUND_FOUND_PER_YEAR = 0.0015;

/**
 * The characters of ruin that can turn out to be ground that teaches a road, and
 * the road each one teaches.
 */
const ROAD_TAUGHT_BY_CHARACTER: Readonly<Record<string, InsightDomain>> = {
    archive: 'karma',
    teaching_hall: 'body',
    array_anchor: 'formation',
    compound: 'weapon',
    scar: 'life_death',
    ossuary: 'life_death',
    workshop: 'alchemy',
    vault: 'time'
};

/** Share of qualifying deep finds that turn out to teach a road. */
export const FOUND_GROUND_TEACHES_A_ROAD = 1 / 6;

/** How deep ground has to be before it could be one. Shallow ground is shallow. */
export const ROAD_TEACHING_GROUND_STARTS_AT_BAND = 2;

/**
 * And the chance a material lying unrecovered in a ruin is brought out.
 */
export const UNRECOVERED_MATERIAL_FOUND_PER_YEAR = 0.02;

/** Who a recovered material ends up with: a house working near its band. */
function plausibleRecoverer(
    state: WorldState,
    forOrdinal: number,
    rng: CultivationRNG
): { id: string; name: string; seatLocationId: string | null } | null {
    const houses = state.factions.filter(
        f => f.dissolvedOnDay === null
            && Number(f.resources.reliable_ordinal ?? f.resources.power_ordinal ?? 0) >= forOrdinal - 8
    );
    if (houses.length === 0) return null;
    return houses[rng.int(0, houses.length - 1)];
}

export interface RoadsPassResult {
    /** Buried grounds dug open this pass. */
    groundsFound: number;
    /**
     * Ruins found this year that turned out to be ground teaching a road.
     */
    groundsNewlyFound: number;
    /** Materials brought out of ruins. */
    materialsRecovered: number;
    /** Materials understood, and therefore gone. */
    materialsSpent: number;
}

/**
 * A year of the world coming by roads: what was found, and what was spent.
 */
export function applyRoadsComprehended(
    state: WorldState,
    year: number,
    day: number
): RoadsPassResult {
    const result: RoadsPassResult = {
        groundsFound: 0,
        groundsNewlyFound: 0,
        materialsRecovered: 0,
        materialsSpent: 0
    };
    const rng = forStream(state.seed, 'roads-comprehended', year);

    // Parties out looking, by province. Computed once because
    // `prospectingEffortIn` walks the roster and the loops below would
    // otherwise call it per ground per year.
    const partiesByRegion = new Map<string, number>();
    const partiesIn = (regionId: string | null): number => {
        if (!regionId) return 0;
        const cached = partiesByRegion.get(regionId);
        if (cached !== undefined) return cached;
        const parties = prospectingEffortIn(state, regionId).parties;
        partiesByRegion.set(regionId, parties);
        return parties;
    };

    // Somebody digs a ground open, and it is the same somebody.
    for (let i = 0; i < state.locations.length; i++) {
        const location = state.locations[i];
        if (!location.tags.includes(DAO_GROUND_TAG)) continue;
        if (location.discovered || location.data.daoAccess !== 'buried') continue;
        const parties = partiesIn(location.parentId);
        if (parties <= 0) continue;
        if (!rng.chance(Math.min(1, parties * BURIED_GROUND_FOUND_PER_PARTY_YEAR))) continue;
        state.locations[i] = { ...location, discovered: true, discoveredOnDay: day };
        result.groundsFound++;
    }

    // And some of what was found this year turns out to teach one.
    for (let i = 0; i < state.locations.length; i++) {
        const location = state.locations[i];
        if (!location.tags.includes(FOUND_BY_PROSPECTING_TAG)) continue;
        if (location.tags.includes(DAO_GROUND_TAG)) continue;
        if (Number(location.data.foundInYear ?? -1) !== year) continue;
        if (Number(location.data.depthBand ?? 0) < ROAD_TEACHING_GROUND_STARTS_AT_BAND) continue;
        const domain = ROAD_TAUGHT_BY_CHARACTER[String(location.data.ruinCharacter ?? '')];
        if (!domain) continue;
        if (!rng.chance(FOUND_GROUND_TEACHES_A_ROAD)) continue;

        const region = location.parentId
            ? state.locations.find(l => l.id === location.parentId) ?? null
            : null;
        if (!region) continue;

        state.locations[i] = {
            ...location,
            // Deduplicated rather than appended. This reads a field it writes,
            // which is the shape that produced a location carrying fourteen layers
            // of its own name elsewhere in this pass - see the fixpoint note in
            // `how-the-world-keeps-finding-more-ruins.ts`. The two guards above
            // already stop it running twice on one location, so this is not a live
            // bug; it is the latent pattern removed, because one instance of
            // self-composition usually means it was copied.
            tags: [...new Set([...location.tags, DAO_GROUND_TAG, 'buried', `road:${domain}`])],
            data: {
                ...location.data,
                catalogRegionId: region.data.catalogRegionId ?? null,
                daoDomain: domain,
                daoAccess: 'buried',
                daoFromOrdinal: Number(location.data.floorOrdinal ?? 0),
                // Safe to take the name directly: `applyRuinProspecting` runs
                // earlier in the same year (day+40 against day+110) and repairs
                // any compounded name before this pass can copy one.
                daoSubject: location.name,
                daoStandingRequired: 0
            }
        };
        result.groundsNewlyFound++;
    }

    // ── Somebody brings a material out of a hole. ──
    for (let i = 0; i < state.objects.length; i++) {
        const object = state.objects[i];
        if (!object.tags.includes('unrecovered') || !isUnspent(object)) continue;
        if (!rng.chance(UNRECOVERED_MATERIAL_FOUND_PER_YEAR)) continue;
        const house = plausibleRecoverer(state, Number(object.data?.forOrdinal ?? 0), rng);
        if (!house) continue;
        state.objects[i] = {
            ...object,
            possessorId: house.id,
            ownerId: house.id,
            ownerName: house.name,
            locationId: house.seatLocationId,
            tags: object.tags.filter(t => t !== 'unrecovered')
        };
        result.materialsRecovered++;
    }

    // ── And a house spends one. ──
    result.materialsSpent = spendMaterialsOnTheBlocked(state, day);
    return result;
}

/**
 * A house spends an irreplaceable object on the disciple standing at the wall.
 */
export function spendMaterialsOnTheBlocked(state: WorldState, day: number): number {
    const spentThisYear = new Set<string>();
    let spent = 0;

    // Blocked members, deepest rung first, so a house's one spend goes to the
    // person nearest the top of the ladder.
    const candidates = state.npcs
        .map((npc, index) => ({ npc, index }))
        .filter(({ npc }) => npc.status === 'alive' && npc.factionId !== null)
        .sort((a, b) => b.npc.cultivation.realmOrdinal - a.npc.cultivation.realmOrdinal);

    for (const { npc } of candidates) {
        const houseId = npc.factionId;
        if (!houseId || spentThisYear.has(houseId)) continue;

        const ordinal = npc.cultivation.realmOrdinal;
        // What the wall will ask when they get to it, from the one function
        // that decides it. No second copy of the curve lives in this layer.
        const required = daoRequirementFor(ordinal);
        if (required <= 0) continue;

        // Counted exactly the way the wall counts it, by the same function the wall
        // asks - so a house cannot spend a material on somebody the gate would have
        // let through anyway, and cannot decline to spend one on somebody it would
        // refuse. Reading the REACH list here instead was the bug this rule exists
        // to stop: it credited roads nobody had yet paid the years for, so a house
        // judged a member unblocked years before the wall would have agreed.
        const held = new Set<InsightDomain>(
            roadsWalkedBy({
                knownTechniques: npc.cultivation.techniqueIds,
                roadsWithinReach: roadsInReachOf(state, npc),
                age: ageOf(npc, day)
            }).map(i => i.domain).filter(d => d !== 'element')
        );
        if (held.size >= required) continue;

        const at = state.objects.findIndex(object =>
            object.kind === 'material'
            && object.ownerId === houseId
            && isUnspent(object)
            && typeof object.data?.domain === 'string'
            && !held.has(object.data.domain as InsightDomain)
            && Math.abs(Number(object.data?.forOrdinal ?? 0) - ordinal) <= 4
        );
        if (at < 0) continue;

        state.objects[at] = spend(state.objects[at], npc.id, day);
        spentThisYear.add(houseId);
        spent++;
    }
    return spent;
}

/**
 * What a house is still sitting on. For probes and the standing register;
 * nothing in the simulation reads it.
 */
export function unspentMaterialsHeldBy(state: WorldState, factionId: string): ObjectRecord[] {
    return state.objects.filter(o => o.ownerId === factionId && isUnspent(o));
}
