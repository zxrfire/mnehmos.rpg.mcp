/**
 * How a cultivator comes by a road besides their own.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS EXISTS TO FIX
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `DAO_GATE_ENFORCED` in `breakthrough.ts` shipped false for one reason, stated
 * in that file and measured twice: A PLAYER GAINS COMPREHENSION FROM THINGS
 * THAT HAPPEN - a ruin opened, a phenomenon survived, a teacher, nearly not
 * being - AND THE WORLD RAN ALL FOUR AND WROTE NONE OF THEM DOWN. Switching the
 * gate on bound the player and not the world, which is the repo's commonest
 * defect running in the other direction, and at 1,500 years it stopped every
 * NPC alive below ordinal 29:
 *
 *     band            people   mean roads   needed   would pass
 *     Core 17-20          28      1.18          1      28 / 28
 *     Nascent 21-24       20      1.30          2       5 / 20
 *     Deity 25-28          7      1.86          3       0 / 7
 *     Void 29-32           2      2.50          4       0 / 2
 *     Grand 37-40          1      3.00          6       0 / 1
 *
 * This module is the supply side. It answers one question - what roads is this
 * person in reach of - and it answers it from world state that already exists,
 * with no field added to `NpcRecord` and no migration.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FOUR CHANNELS, AND WHY DERIVING BEATS STORING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   PRACTICE   The arts in their hands, which this module no longer gathers at
 *              all: `roadsTaughtByPractice` is read off `knownTechniques` by
 *              the rule itself, for a player and for an NPC alike, because both
 *              records already carry the same field against the same catalog.
 *   GROUND     A named place that teaches a road, held by a house, standing
 *              open in a province, or buried until somebody digs it out. See
 *              `data/cultivation/places-that-teach-a-dao.ts`.
 *   A MATERIAL Spent. Once, on one person, and then there is one fewer in the
 *              world forever. See `single-use-dao-comprehension-materials.ts`.
 *   A RUIN     The buried grounds, which teach nobody until the world finds
 *              them, and which are the only channel that can put a road into a
 *              province that had none.
 *   A CARVING  Three worked faces somebody left behind on their way through.
 *              The one-time source, and cheap in years because it is a text -
 *              what is scarce about it is that there are three.
 *   AN OBJECT  Legible AS a road, by somebody carrying it or standing high
 *              enough in the house that holds it. See AN OBJECT FIT FOR YOUR
 *              PATH below.
 *
 * ACCESS PUTS A ROAD IN REACH, AND YEARS ARE WHAT WALK IT. That second half is
 * newer than this file and it corrects it: the doctrine used to be stated here
 * as ACCESS, NOT EFFORT - "the requirement names WHAT MUST BE IN REACH, never
 * what must be done" - and under it an NPC held every road their access could
 * ever supply from the day they were born, for nothing, while a player holding
 * the same arts and standing on the same cliff held none, because a player's
 * insights only formed by surviving something. Access is still what this file
 * answers, and it is no longer sufficient on its own: what a cultivator has
 * actually WALKED is decided by `cultivation/what-a-road-in-reach-costs-to-walk.ts`,
 * which charges each kind of access a price in years of practice and is asked
 * by the gate for a player and for an NPC alike.
 *
 * What survives of the old doctrine, and should: there is still no deed and no
 * quest. Being handed an inheritance counts, being taught counts, reading
 * counts, and a cultivator sealed in the right library is doing the qualifying
 * thing by being in the room. What they cannot do is be there for an afternoon.
 *
 * It also means the answer changes when the WORLD changes, which storing could
 * not express. A disciple promoted to Inner gains a road the day the promotion
 * lands. A house that loses its ground loses the road for everybody in it,
 * living, at once - and the people who had already crossed on it keep their
 * rungs, because a rung is banked and a road is not.
 *
 * THE THIRD CHANNEL IS THE EXCEPTION AND HAS TO BE. A material is consumed, so
 * "in reach" is the wrong test for it: the road has to survive the object. It
 * does, because `spend` leaves the row in the world with `spentBy` on it rather
 * than deleting it - which `docs/world/items.md` asks for on its own account -
 * and this module reads the road back off the spent row. The record of who used
 * one IS the comprehension.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS NOT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Not a second odds system. `roadsWalked` counts domains and does not read
 * degree, so everything here is at degree 1 and contributes nothing to
 * `understandingEffects` beyond what a first glimpse is worth. Claiming depth
 * the world has not modelled would hand every NPC a breakthrough bonus no event
 * in their life paid for.
 *
 * Not a faction rule. There is no branch anywhere on which house is which. A
 * house that holds a ground is a house with a row in a catalog and a
 * `controllingFactionId` on an ordinary location; take the ground away and it
 * prices out as an ordinary house.
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
 *
 * Ordinary is the whole point. Same table as a ford town, same `kind` from the
 * same union, same `thresholds`, same `controllingFactionId` - so every system
 * that walks locations already handles these, and nothing had to learn about
 * them. The only thing that distinguishes one is a tag and four `data` keys.
 *
 * A buried ground is seeded UNDISCOVERED, which is what makes it a ruin rather
 * than a landmark: it is on the map the engine keeps and on nobody's map, it
 * teaches nothing to anyone, and `discoverBuriedGrounds` below is the only way
 * that changes.
 */
export function seedPlacesThatTeachADao(state: WorldState): LocationRecord[] {
    const out: LocationRecord[] = [];
    for (const place of PLACES_THAT_TEACH_A_DAO) {
        const region = regionLocationFor(state, place.regionId);
        // A GROUND IS IN A PROVINCE. No province, no ground - and this guard is
        // not defensive tidiness, it is the difference between a world and a
        // fixture. `tests/engine/world/fixtures.ts` seeds a small catalog with
        // none of the real regions in it, and without this every one of these
        // was planted there anyway as a parentless orphan, adding twenty
        // locations to a tiny world and moving events that had nothing to do
        // with comprehension. `driver.test.ts` caught it: a vein that changed
        // hands in one seeded century stopped changing hands.
        if (!region) continue;
        const holder = place.heldBy
            ? state.factions.find(f => f.id === place.heldBy) ?? null
            : null;
        out.push(makeLocation({
            id: daoGroundLocationId(place),
            name: place.name,
            // Three ordinary kinds, chosen for what already reads them rather
            // than for what they sound like:
            //
            //   cave          held ground. A chamber, a terrace, a stair - the
            //                 kind a house keeps and works in. NOT `sect_seat`:
            //                 that kind carries an invariant the whole world
            //                 depends on, that a seat is THE seat of exactly
            //                 one faction, and `hostile-ground.test.ts` rightly
            //                 refuses a second one.
            //   wilds         open ground. It can also be forbidden by an
            //                 ordinary pressure event, which is correct - a
            //                 road can be lost.
            //   secret_realm  buried. `gatherings.ts` already sends expeditions
            //                 to these once they are discovered, which is
            //                 exactly the verb a buried ground needs. NOT
            //                 `ruin`: a ruin must carry an `originFactId` into
            //                 a seeded prior age, and a dao ground has no such
            //                 event behind it.
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
 *
 * An alias for the shared shape rather than a second declaration of it: the
 * price of each `how` is a fact about the rule, not about the world layer, and
 * a private copy of this interface is how the world's answer and the player's
 * drifted apart in the first place. See
 * `cultivation/what-a-road-in-reach-costs-to-walk.ts`.
 */
export type RoadInReach = RoadWithinReach;

/**
 * The first thing somebody is short of at a ground that will not teach them.
 *
 * ORDERED THE WAY A PERSON MEETS THEM, which is what makes it a refusal a
 * player can act on rather than a boolean: you have to be able to find it, then
 * be let in, then be able to read it. Reporting the last of those to somebody
 * who is four provinces away would be true and useless.
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
 *
 * Deliberately not a `LocationRecord` and not a catalog row. Both of those
 * exist - the world seeds the catalog into locations - and a rule that took
 * either would be reachable from one of them and not the other. That is the
 * split this whole file exists to close, one level down: the world reads
 * locations, the played game reads the catalog, and they must not be able to
 * answer differently.
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
     *
     * True for everything standing open. False for a buried ground the world
     * has not dug out yet, which is the one state that hides a place from
     * everybody alive at once.
     */
    found: boolean;
}

/**
 * Somebody standing somewhere, as this rule needs to read them.
 *
 * Four scalars, and none of them is an `NpcRecord`, because THE PLAYER IS NOT
 * ONE. A rule that took an `NpcRecord` binds the simulation and not the played
 * game, which is the defect this repository finds most often - and it is the
 * defect that was live here: the world reached these places through
 * `daoGroundsInReachOf` and the player's half of the same rule was written out
 * a second time, in `server/consolidated/cultivation-support.ts`, against the
 * catalog instead of the world.
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
     *
     * NOT a knowledge record and not the player's discovery gate - this says
     * what somebody in this position would know about their own province and
     * their own house, which is what makes them able to TELL somebody else. A
     * player's own awareness is a separate row in a separate table and is
     * checked separately; nothing here licenses naming a place to them.
     */
    knowsWhereItIs: boolean;
    /** Standing there long enough would teach them the road. */
    inReach: boolean;
    /** The first thing they are short by. Null when it is in reach. */
    shortBy: ShortOfAGround | null;
}

/**
 * How one person stands to one ground.
 *
 * THE ONE RULE, and everything about dao ground now asks it: the world's own
 * reach list, the player's exposure context, and the refusal a player reads
 * when a place will not teach them. Three different sentences about being
 * unable to get in, and each is a real constraint somewhere else in the engine
 * rather than a number invented here:
 *
 *   HELD    membership AND standing. `factionRankIndex` is the same instrument
 *           `manuals.ts` rations a shelf with, and it is what forty years of
 *           sweeping buys. An outer disciple at a house whose ground asks for
 *           an elder is genuinely stuck, and can leave.
 *   OPEN    the province they are standing in. You are born where you are born
 *           and most people in this world die in the province they were born
 *           in, so an open ground is a hand dealt at birth - which is why every
 *           province has at least one and no province has all eight.
 *   CARVING reached exactly the way open ground is - a face on a rock in a
 *           province with nobody standing on the door. What is different is the
 *           PRICE, which is years and lives in
 *           `cultivation/what-a-road-in-reach-costs-to-walk.ts`, and the floor,
 *           which is the highest in the catalog.
 *   BURIED  somebody found it. `discovered` is world state moved on the
 *           world's clock and not on merit.
 *
 * And in every case the rung: below `fromOrdinal` a visitor takes nothing,
 * which is the same floor that makes standing there survivable.
 *
 * KNOWING WHERE A THING IS AND BEING ABLE TO READ IT ARE DIFFERENT FACTS, and
 * separating them is the point of this shape. The cart drivers of the Quiet
 * Marches have crossed the Grinding Ford for six hundred years and nobody there
 * thinks of it as cultivation; the catalog says so in the row itself. They can
 * all tell you where it is. Almost none of them will ever take anything from
 * it. Collapsing the two would have made a landmark a secret.
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
 *
 * `discoveryContextFor` runs on the MCP surface with no world in hand, and the
 * exposure a player gets from a province has to be the same either way. A
 * buried ground reads as unfound here, which is the honest answer for a caller
 * that cannot see whether the world has dug it out.
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
 *
 * A filter over `daoGroundsAround` rather than a rule of its own, so that what
 * the world lets an NPC walk and what a played cultivator is told they are
 * short by cannot disagree.
 */
export function daoGroundsInReachOf(state: WorldState, npc: NpcRecord): RoadInReach[] {
    return daoGroundsAround(state, standingOfNpc(state, npc))
        .filter(row => row.standing.inReach)
        .map(({ domain, subject, sourceId, sourceName, how }) =>
            ({ domain, subject, sourceId, sourceName, how }));
}

/**
 * Roads bought with an object that no longer exists.
 *
 * Read off the SPENT row, which is why `spend` marks rather than deletes. There
 * is no second bookkeeping here and there must not be: if the object rows are
 * ever compacted, this channel disappears with them, correctly, because the
 * world would then have no record that the material was ever used on anybody.
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

// ─────────────────────────────────────────────────────────────────────────
// AN OBJECT FIT FOR YOUR PATH
//
// The design owner's third source, in their words: "seeing an immortal artifact
// fit for your path". FIT is the load-bearing half - an object should teach the
// person whose road it suits and be inert to everybody else, which is what
// makes it information rather than a prize.
//
// Two conditions, and neither is a new mechanism:
//
//   IT SAYS WHAT IT IS   `data.daoDomain`, on seven of the twenty-four rows in
//                        `artifacts.ts`. The other seventeen teach nothing, and
//                        two of them say so in their own descriptions: the Cold
//                        Arterial Key and the Storm Tally are curricula rather
//                        than daos. Take the field away and every one of them
//                        is an ordinary object with an ordinary `power`.
//   YOU CAN READ IT      A rung floor, derived from `power` rather than stored,
//                        so it follows the ladder. Somebody twelve rungs under
//                        an object is holding a heavy thing.
//
// AND A BODY AT A GREAT HEIGHT IS THIS, NOT A SECOND SYSTEM.
//
// Ruled by the design owner: remains impart a dao at a high enough rung, and
// are objects of respect for that reason. That is a DAO GROUND YOU CAN CARRY -
// exposure rather than accumulation, the same sentence
// `places-that-teach-a-dao.ts` opens with - and the only difference from a
// cliff is that this locus has a name and once had opinions. So it belongs
// HERE, as an ordinary object with a `power` and a `daoDomain`, read by the
// function below, and NOT beside it:
//
//   ONLY HIGH ENOUGH IMPARTS ANYTHING   `power`. An ordinary death leaves an
//                        ordinary body and no `daoDomain`, which is what stops
//                        the world flooding with teachers.
//   ONLY CLOSE ENOUGH RECEIVES IT       `ARTIFACT_LEGIBLE_WITHIN`, the same
//                        window a cliff uses. A nobody sitting with a 44 takes
//                        less than an elder does, for the same reason four
//                        hundred spans of somebody's argument is a wall with
//                        scratches on it.
//
// Both gates already existed. Nothing had to be added for the container, and
// nothing should be: the moment remains get their own reach rule there are two
// exposure systems and they will disagree.
//
// What this makes legible, and the reason it is worth stating in the engine
// rather than in prose: A HOUSE KEEPING ITS ANCESTORS IS NOT BEING PIOUS - ITS
// ANCESTORS ARE HOW IT TEACHES. `STANDING_TO_STUDY_A_HOUSE_OBJECT` is why they
// sit in a hall a junior is brought to rather than in a vault. And it is why
// working one into a weapon is not grave-robbing but burning down a school:
// the object is `power` OR `daoDomain` to whoever gets it, never both, because
// there is one row and refining it is a different row.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far under an object's own rung it stops being legible as a road.
 *
 * Three realms, which is the same gap `places-that-teach-a-dao.ts` reasons
 * about between what a ground IS and who can read it: four hundred spans below
 * you, the cliff is a cliff with scratches on it. Derived against `power`
 * rather than authored per row, because a second number beside `power` is a
 * second opinion about how strong a thing is and it goes stale the first time
 * anybody retunes the ladder.
 */
export const ARTIFACT_LEGIBLE_WITHIN = 12;

/**
 * The standing a house asks before it lets anybody near the thing its whole
 * position rests on.
 *
 * Objects in this catalog are possessed by a FACTION far more often than by a
 * person - the Nail, the Standing Edge, the Datum Lamp and the Weight are all
 * held by the house rather than carried - so reading only
 * `possessorId === npc.id` would have made this channel supply almost nobody.
 * A house's own people can study what the house holds, rationed by exactly the
 * instrument every other house asset is rationed by: `factionRankIndex`, the
 * same field `manuals.ts` gates a shelf with and `daoStandingRequired` gates a
 * cliff with. An outer disciple does not get shown the vault.
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
 *
 * The same three-part answer `howSomebodyStandsToAGround` gives, and for the
 * same reason: the refusal has to say which of the two things is missing.
 * `knowsWhereItIs` is whether it is in front of them at all - carried, or in
 * their own house - and the rung is a separate question asked afterwards.
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
 *
 * Carried by them, or held by their house with standing enough to be let near
 * it, and in either case only if they are close enough to the object's own rung
 * to read anything in it at all.
 *
 * A filter over `objectsThatCarryARoad`, for the same reason
 * `daoGroundsInReachOf` is a filter: the reach the world grants and the refusal
 * a player reads have to come off one rule.
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
 * Every road WITHIN REACH of this cultivator: the arts in their hands, the
 * ground they can get at, and the objects that were spent on them.
 *
 * IN REACH IS NOT WALKED, and this function used to conflate the two. It
 * returned finished `Insight` objects at degree 1, dated to the day the person
 * was BORN, so an NPC held every road their access could ever supply from the
 * moment they existed, for nothing - while a player holding the same arts and
 * standing on the same cliff held none of them, because a player's insights
 * only form by surviving something. That is the split AGENTS.md names first.
 *
 * What is actually walked is decided by one rule, in
 * `cultivation/what-a-road-in-reach-costs-to-walk.ts`, which charges each of
 * these a price in years of practice and is asked by the gate for a player and
 * for an NPC alike. This function no longer decides anything: it gathers, out
 * of `WorldState`, and gathering is the whole of what a storage adapter may do.
 *
 * WHAT THE WORLD PUTS IN REACH, and not the arts in their hands. Practice used
 * to be the first thing in this list and it is deliberately gone: the rule
 * reads `knownTechniques` off the subject itself, for a player and an NPC
 * alike, so listing it here as well would be a second copy of the one channel
 * that needs no adapter. `roadsWithinReachFromPractice` still exists for the
 * probes, which report the three channels apart.
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

// ─────────────────────────────────────────────────────────────────────────
// THE WORLD FINDING THINGS
//
// Two passes on the world's own clock, and both are deliberately slow. The
// gate is meant to be expensive; what it must not be is unpayable, and the
// difference between those two is entirely a question of RATE. A channel that
// opens every road in a century has replaced a wall nobody can pass with a
// wall nobody notices, and the second is worse because it looks fine in every
// measurement.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chance per year that one still-buried ground is dug open, per party looking
 * in the province it is in.
 *
 * Four of them in the world. It was a FLAT per-year figure of 0.0015 with no
 * reference to anybody, which made buried ground the one thing in the world
 * that got dug up by nobody: a province with four houses working out of it and
 * a province with nothing in it found their buried grounds at exactly the same
 * rate, and a world whose population collapsed went on finding them.
 *
 * Now it is the same effort that finds everything else, from
 * `how-the-world-keeps-finding-more-ruins.ts`, so the rate rises and falls with
 * how many parties are actually out there. The per-party figure is set so that
 * a province at ordinary strength - three parties or so - lands near where the
 * flat figure was, which is deliberate: this is a change of cause, not a change
 * of rate, and the calibration behind the old number was sound.
 *
 * At this rate about a third are open after three centuries and about nine in
 * ten after fifteen, which is the point of the figure: A LONG HORIZON HAS MORE
 * ROADS IN IT THAN A SHORT ONE, without anybody having been given anything, so
 * the map a world holds at year 300 is genuinely poorer than the one it holds
 * at year 1500.
 */
export const BURIED_GROUND_FOUND_PER_PARTY_YEAR = 0.0005;

/**
 * What the flat figure was, kept because the calibration argument above is
 * stated against it and a number nobody can trace is worth less than a number
 * with its history attached.
 */
export const BURIED_GROUND_FOUND_PER_YEAR = 0.0015;

/**
 * The characters of ruin that can turn out to be ground that teaches a road,
 * and the road each one teaches.
 *
 * THIS IS THE SUPPLY LINE INTO THE DAO GATE, and it is the reason the reserve
 * model matters beyond ruins. Four of the twenty authored grounds in
 * `places-that-teach-a-dao.ts` are buried and teach nobody until the world digs
 * them out, so a world that stops finding ruins is a world that slowly stops
 * producing roads. Twenty grounds is also a FIXED endowment of its own, and the
 * same argument applies to it.
 *
 * Nothing here is a second catalog. A ground that teaches a road is an ordinary
 * location with a tag and four `data` keys - `seedPlacesThatTeachADao` says so
 * in its own comment - so a found archive being one is the generic mechanism
 * doing what it was built for rather than a parallel table beside it.
 *
 * Only the characters where somebody's whole way of seeing is legible off the
 * place. A border post teaches nobody anything and is not in the list.
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
 *
 * Higher, because somebody is looking: roughly a third of the world's materials
 * are seeded into holes, they are the specific thing expeditions are mounted
 * for, and a hole with a known thing in it is a different proposition from a
 * hole. Still slow enough that "go and dig one up" is a century's project for
 * an institution rather than a resource anybody plans around.
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
     *
     * The new supply, and it is counted separately from `groundsFound` because
     * the two are different events: one is the world digging out something the
     * catalog already held, and the other is the world finding something the
     * catalog never listed. Reported apart so a measurement can tell whether
     * the dao gate is being fed by the fixed twenty or by the reserve.
     */
    groundsNewlyFound: number;
    /** Materials brought out of ruins. */
    materialsRecovered: number;
    /** Materials understood, and therefore gone. */
    materialsSpent: number;
}

/**
 * A year of the world coming by roads: what was found, and what was spent.
 *
 * Called from `applyPressure` before advancement, so a road opened this year is
 * a road this year's crossing can stand on - the same ordering `applyManualCopying`
 * takes for the same reason.
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

    // ── Somebody digs a ground open, and it is the same somebody. ──
    //
    // The parties that find ruins are the parties that find buried ground.
    // This read a flat per-year constant with nobody behind it, which meant a
    // province with nobody in it dug things up at the same rate as a province
    // with four houses working out of it. See
    // `BURIED_GROUND_FOUND_PER_PARTY_YEAR`.
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

    // ── And some of what was found this year turns out to teach one. ──
    //
    // The reserve feeding the dao gate. A ruin found deep, of a character where
    // somebody's whole way of seeing is legible off the place, becomes ordinary
    // dao ground: same tag, same four `data` keys, read by the same
    // `daoGroundsInReachOf` that reads the authored twenty. Without this the
    // gate's ground channel is a fixed endowment of twenty and has exactly the
    // failure the ruin supply had.
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
            // which is the shape that produced a location carrying fourteen
            // layers of its own name elsewhere in this pass - see the fixpoint
            // note in `how-the-world-keeps-finding-more-ruins.ts`. The two
            // guards above already stop it running twice on one location, so
            // this is not a live bug; it is the latent pattern removed, because
            // one instance of self-composition usually means it was copied.
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
 *
 * THIS IS WHAT THE OBJECT IS FOR, and it is the only thing that can be done
 * with it. The house is not being generous: a material calibrated to a height
 * is dead capital until somebody in the building is at that height and stopped,
 * and the moment one is, holding it any longer is a decision to waste it.
 *
 * Three conditions, and each is the house's own reasoning rather than a rule
 * about houses:
 *
 *   1. THE PERSON IS ACTUALLY STOPPED. Not "would benefit" - blocked, at a rung
 *      whose crossing asks for more roads than they hold. A house does not burn
 *      one of these on somebody who was going to cross anyway.
 *   2. THE ROAD IS ONE THEY DO NOT HAVE. Spending a lamp on somebody who has
 *      already walked karma buys the house nothing, and every house in the
 *      world can work that out.
 *   3. THE MATERIAL IS PITCHED NEAR THEM. Four rungs of slack either side of
 *      its band. Below that the reader takes nothing out of it; far above it
 *      the house has somebody better to spend it on.
 *
 * The most senior blocked member first, which is not favouritism: the house is
 * spending a finite thing and the person closest to the top of the ladder is
 * the one whose crossing changes what the house is.
 *
 * ONE PER HOUSE PER YEAR, at most. Not a budget - a fact about the object.
 * Understanding one takes the disciple out of everything else they were doing,
 * and a house that put two people through in the same year would be a house
 * that had two to spare, which nobody in the world does.
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

        // Counted exactly the way the wall counts it, by the same function the
        // wall asks - so a house cannot spend a material on somebody the gate
        // would have let through anyway, and cannot decline to spend one on
        // somebody it would refuse. Reading the REACH list here instead was the
        // bug this rule exists to stop: it credited roads nobody had yet paid
        // the years for, so a house judged a member unblocked years before the
        // wall would have agreed.
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
