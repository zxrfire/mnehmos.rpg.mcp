/**
 * What one of the world's own people knows, read off the world.
 *
 * ── The defect this closes ───────────────────────────────────────────────
 *
 * `knowledge_records` holds the player and whoever an operator spawned.
 * Nothing anywhere writes a row for a world NPC, and nothing should - measured
 * at 28,488 rows per person per fact on a seeded world of 250 at a thousand
 * years. So every gate question asked ABOUT a world NPC answered `unaware`,
 * and two player-facing consumers acted on that answer:
 *
 *   asking-verbs   whether the person being questioned has anything to say.
 *                  Always false, so `whatStandingInTheWay` read
 *                  `they_do_not_know` and the engine refused on behalf of
 *                  somebody who would in fact know.
 *   combat-verbs   whether the person in front of you recognises the house
 *                  whose blade you are carrying. Always `unaware`, so nobody
 *                  in the world ever recognised anything.
 *
 * ── The shape ────────────────────────────────────────────────────────────
 *
 * NOTHING HERE IS STORED AND NOTHING HERE WRITES. Every answer is a reading
 * over rows the world already keeps for other reasons - where somebody is
 * standing, who is on whose roll, who was named on which fact, what is being
 * said out loud where they are. A stored fact can disagree with the world; a
 * reading cannot.
 *
 * THE GROUND READINGS ARE THE ONES THAT ALREADY EXIST, composed by
 * `whatAnybodyCouldHaveOfTheGround` rather than restated, so the board a player
 * reads and the world's own sendings cannot come to different conclusions about
 * what somebody has. What is added here is the same three questions asked about
 * a HOUSE and about a PERSON, plus the one thing none of the three could ever
 * answer: where this person is standing right now.
 *
 * IT ANSWERS ABOUT THE WORLD'S PEOPLE AND NOBODY ELSE. A holder with no world
 * row - the player, an operator-spawned character, a `cultivators` row that was
 * never seeded - comes back `unaware` from every branch, so this can only ever
 * ADD to what the rows say and can never contradict them. Stages never fall,
 * which is what makes `highestStage(row, reading)` the right composition at the
 * gate.
 *
 * WHAT IT DOES NOT DO is enumerate. There is no "everything this NPC has heard
 * of", because that question over a world of several hundred people and two
 * thousand facts is the combinatorial walk the table would have been. Every
 * reading here is asked about ONE named thing.
 */

import type { KnownEntityKind } from '../social/knowledge.js';
import {
    highestStage,
    stageCeilingFor,
    type KnowingStage
} from '../social/discovery.js';
import type { HistoricalFact } from './history.js';
import { getFaction, getLocation, type WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { isInTheAirFor, regionOf, whereThisPersonIsStanding } from './what-people-are-saying.js';
import {
    whatAHousesOwnErrandsBringBack,
    whatAnybodyCouldHaveOfTheGround,
    whatStandingOnItGives,
    whatTheAirCarriesOfTheGround
} from './who-goes-out-for-a-house-and-what-comes-back.js';
import { worldIdForCatalogPerson } from './a-catalog-person-and-their-world-row.js';
import {
    whoWouldHaveHeardOfIt
} from '../cultivation/who-has-heard-of-a-thing-past-the-counter.js';
import { theHeightAHouseWorksAt } from './where-the-pills-actually-are.js';

/**
 * What a named holder stands at on one named thing.
 *
 * The signature `KnowledgeGate` takes as its optional second reader. It is a
 * plain function rather than an interface so the gate cannot acquire a
 * `WorldState` of its own by accident.
 */
export type WhatSomebodyKnowsOfIt =
    (holderId: string, kind: KnownEntityKind, id: string) => KnowingStage;

/**
 * Being somewhere is `witnessed`, and being told is `told`. Named off the
 * ladder rather than written as literals, so the rungs move when it does.
 */
const BEING_THERE = stageCeilingFor('witnessed');
const BEING_TOLD = stageCeilingFor('told');

/**
 * Standing in a room with somebody is exactly `encountered`, and the ladder
 * says so in those words. It is below `known` deliberately: sharing a square
 * with a stranger is not having dealt with them.
 */
const IN_A_ROOM_WITH: KnowingStage = 'encountered';

/**
 * A house seated in the province you live in is a name you have, and no more
 * than a name. This is the same rung the player's own starting awareness gives
 * their local house, read for a world person instead of written as a row.
 */
const THE_HOUSE_DOWN_THE_PROVINCE: KnowingStage = 'named';

/**
 * Every reading, bound to one world.
 *
 * Built once per `WorldState` and held by the caller: the walks over the ledger
 * are per fact, and a long-lived world's ledger is long. Nothing here reads
 * `currentDay` at build time - circulation is asked at query time, so one built
 * reader stays correct as the world's clock moves.
 */
export function whatOneOfTheWorldsOwnPeopleKnows(state: WorldState): WhatSomebodyKnowsOfIt {
    const ledger = state.history.facts;

    // `getNpc` is a linear walk of several hundred rows and this asks per fact
    // per query. One map, built with everything else.
    const byId = new Map(state.npcs.map(npc => [npc.id, npc]));
    const rowFor = (id: string): NpcRecord | null =>
        byId.get(id) ?? byId.get(worldIdForCatalogPerson(id)) ?? null;

    // The three ground readings, verbatim. `whatAnybodyCouldHaveOfTheGround`
    // exists so a caller cannot quietly ask a narrower question than the world
    // does, and this is a caller.
    const stoodOnIt = whatStandingOnItGives(ledger);
    const errands = whatAHousesOwnErrandsBringBack(ledger);
    const inTheAir = whatTheAirCarriesOfTheGround({
        facts: ledger,
        inTheAirFor: (fact, holderId) => {
            const npc = rowFor(holderId);
            if (!npc) return false;
            return isInTheAirFor(
                state, fact, whereThisPersonIsStanding(state, npc), state.currentDay
            );
        }
    });
    const ofTheGround = whatAnybodyCouldHaveOfTheGround(stoodOnIt, inTheAir);

    const byHouse = factsByHouse(ledger);
    const byPerson = factsNaming(ledger);
    const presentAt = whoWasPresent(ledger);

    const saidWhereTheyStand = (holder: NpcRecord, facts: readonly HistoricalFact[]): boolean => {
        if (facts.length === 0) return false;
        const teller = whereThisPersonIsStanding(state, holder);
        return facts.some(fact => isInTheAirFor(state, fact, teller, state.currentDay));
    };

    return (holderId, kind, id) => {
        const holder = rowFor(holderId);
        if (!holder) return 'unaware';

        switch (kind) {
            case 'place':
                return ofThePlace(state, holder, id, ofTheGround, errands);
            case 'sect':
                return ofTheHouse(state, holder, id, byHouse, presentAt, saidWhereTheyStand);
            case 'cultivator':
                return ofAPerson(holder, id, rowFor, byPerson, presentAt, saidWhereTheyStand);
            case 'event':
                return ofAnEvent(holder, id, ledger, presentAt, saidWhereTheyStand);
            case 'thing':
                return ofAThing(state, holder, id);
            default:
                return 'unaware';
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────
// ONE KIND AT A TIME
// ─────────────────────────────────────────────────────────────────────────

/**
 * A place.
 *
 * The three composed readings, plus the two things about a place that are true
 * of the person rather than of the ledger: they are standing in it, and it is
 * one of the containers of where they are standing. Somebody in a village can
 * point at the county the village is in - that is what a province IS - and no
 * fact has to have happened there for it to be so.
 */
function ofThePlace(
    state: WorldState,
    holder: NpcRecord,
    locationId: string,
    ofTheGround: (holderId: string, locationId: string) => KnowingStage,
    errands: (factionId: string, locationId: string) => KnowingStage
): KnowingStage {
    // Standing in it is the top rung, so nothing below can add to it.
    if (holder.locationId === locationId) return BEING_THERE;

    let stage = ofTheGround(holder.id, locationId);
    if (holder.factionId) stage = highestStage(stage, errands(holder.factionId, locationId));
    if (containersOf(state, holder.locationId).has(locationId)) {
        stage = highestStage(stage, BEING_TOLD);
    }

    // Their own house's seat and the ground it holds. Somebody on the roll can
    // say where their own house sits whether or not they have ever been.
    const house = holder.factionId ? getFaction(state, holder.factionId) : null;
    if (house && (house.seatLocationId === locationId
        || house.controlledLocationIds.includes(locationId))) {
        stage = highestStage(stage, BEING_TOLD);
    }
    return stage;
}

/**
 * A house.
 *
 * Being on its roll is the top of the ladder and nothing else needs asking: a
 * disciple has dealt with their own house and it has dealt with them. Below
 * that the same three questions the ground readings ask, asked about the house
 * instead of about a piece of ground - were you there when it did something,
 * is the province talking about something it did, and is its gate the one at
 * the end of your street.
 */
function ofTheHouse(
    state: WorldState,
    holder: NpcRecord,
    factionId: string,
    byHouse: Map<string, HistoricalFact[]>,
    presentAt: Map<string, Set<string>>,
    saidWhereTheyStand: (holder: NpcRecord, facts: readonly HistoricalFact[]) => boolean
): KnowingStage {
    if (holder.factionId === factionId) return BEING_THERE;

    const theirs = byHouse.get(factionId) ?? [];
    const wasThere = presentAt.get(holder.id);
    if (wasThere && theirs.some(fact => wasThere.has(fact.id))) return BEING_THERE;

    let stage: KnowingStage = 'unaware';
    if (saidWhereTheyStand(holder, theirs)) stage = highestStage(stage, BEING_TOLD);

    const house = getFaction(state, factionId);
    if (house) {
        const standingOn = holder.locationId;
        if (standingOn !== null
            && (house.seatLocationId === standingOn
                || house.controlledLocationIds.includes(standingOn))) {
            stage = highestStage(stage, BEING_TOLD);
        } else if (house.seatLocationId !== null
            && sameProvince(state, house.seatLocationId, holder.locationId)) {
            stage = highestStage(stage, THE_HOUSE_DOWN_THE_PROVINCE);
        }
    }
    return stage;
}

/**
 * Another person.
 *
 * A tie the world has written down is the top rung - a relationship row is
 * precisely "they have dealt with each other". Standing in the same square, or
 * being named in the same activity, is `encountered` and not more: the genre is
 * full of people who have been in a room with somebody they could not name.
 */
function ofAPerson(
    holder: NpcRecord,
    personId: string,
    rowFor: (id: string) => NpcRecord | null,
    byPerson: Map<string, HistoricalFact[]>,
    presentAt: Map<string, Set<string>>,
    saidWhereTheyStand: (holder: NpcRecord, facts: readonly HistoricalFact[]) => boolean
): KnowingStage {
    const them = rowFor(personId);
    // Both spellings, because the caller may hold either and the ledger holds
    // the world one. `theOneIdAPersonIsKnownBy` canonicalises the other way,
    // which is the wrong direction for a world walk.
    const theirIds = new Set<string>([personId]);
    if (them) theirIds.add(them.id);

    if (theirIds.has(holder.id)) return BEING_THERE;
    if (holder.relationships.some(tie => theirIds.has(tie.targetId))) return BEING_THERE;

    const wasThere = presentAt.get(holder.id);
    if (wasThere) {
        for (const spelling of theirIds) {
            const named = byPerson.get(spelling);
            if (named && named.some(fact => wasThere.has(fact.id))) return BEING_THERE;
        }
    }

    let stage: KnowingStage = 'unaware';
    if (them) {
        if (holder.locationId !== null && holder.locationId === them.locationId) {
            stage = highestStage(stage, IN_A_ROOM_WITH);
        }
        if (holder.activity?.withIds.includes(them.id) === true) {
            stage = highestStage(stage, IN_A_ROOM_WITH);
        }
    }
    for (const spelling of theirIds) {
        if (saidWhereTheyStand(holder, byPerson.get(spelling) ?? [])) {
            stage = highestStage(stage, BEING_TOLD);
        }
    }
    return stage;
}

/**
 * A thing out of a catalog.
 *
 * Two numbers, both already stored: the rung this person stands at, and the
 * height the house on whose roll they stand works at. `whoWouldHaveHeardOfIt`
 * holds the rule; nothing here decides anything, and no list anywhere says who
 * knows about what.
 *
 * This is why an NPC's answer can be their own awareness. `askedAbout` reads
 * `isAwareOf(who.id, ...)` and the gate composes this under `highestStage` with
 * whatever rows that person holds - so being told something writes a row that
 * wins, and having heard nothing is the absence of one.
 */
function ofAThing(state: WorldState, holder: NpcRecord, thingId: string): KnowingStage {
    const house = holder.factionId ? getFaction(state, holder.factionId) : null;
    return whoWouldHaveHeardOfIt({
        thingId,
        ordinal: holder.cultivation.realmOrdinal,
        house: house === null
            ? null
            : {
                reach: theHeightAHouseWorksAt(house),
                rankIndex: holder.factionRankIndex,
                rankCount: house.ranks.length
            }
    });
}

/** One fact. Either you were there for it, or it reached you, or it did not. */
function ofAnEvent(
    holder: NpcRecord,
    factId: string,
    ledger: readonly HistoricalFact[],
    presentAt: Map<string, Set<string>>,
    saidWhereTheyStand: (holder: NpcRecord, facts: readonly HistoricalFact[]) => boolean
): KnowingStage {
    if (presentAt.get(holder.id)?.has(factId) === true) return BEING_THERE;
    const fact = ledger.find(row => row.id === factId);
    if (!fact) return 'unaware';
    return saidWhereTheyStand(holder, [fact]) ? BEING_TOLD : 'unaware';
}

// ─────────────────────────────────────────────────────────────────────────
// INDEXES OVER THE LEDGER
// ─────────────────────────────────────────────────────────────────────────

function factsByHouse(ledger: readonly HistoricalFact[]): Map<string, HistoricalFact[]> {
    const byHouse = new Map<string, HistoricalFact[]>();
    for (const fact of ledger) {
        for (const houseId of fact.factionIds) push(byHouse, houseId, fact);
    }
    return byHouse;
}

function factsNaming(ledger: readonly HistoricalFact[]): Map<string, HistoricalFact[]> {
    const byPerson = new Map<string, HistoricalFact[]>();
    for (const fact of ledger) {
        for (const actor of fact.actors) push(byPerson, actor.id, fact);
    }
    return byPerson;
}

/**
 * Who was physically there, per person.
 *
 * The same two columns `whatStandingOnItGives` reads, keyed by person instead
 * of by place, because the question here is "were you there for THIS" rather
 * than "were you ever there".
 */
function whoWasPresent(ledger: readonly HistoricalFact[]): Map<string, Set<string>> {
    const present = new Map<string, Set<string>>();
    const mark = (personId: string, factId: string): void => {
        let theirs = present.get(personId);
        if (!theirs) {
            theirs = new Set<string>();
            present.set(personId, theirs);
        }
        theirs.add(factId);
    };
    for (const fact of ledger) {
        for (const actor of fact.actors) mark(actor.id, fact.id);
        for (const id of fact.witnessIds) mark(id, fact.id);
    }
    return present;
}

function push(index: Map<string, HistoricalFact[]>, key: string, fact: HistoricalFact): void {
    const held = index.get(key);
    if (held) held.push(fact); else index.set(key, [fact]);
}

// ─────────────────────────────────────────────────────────────────────────
// PLACES AND PEOPLE, RESOLVED
// ─────────────────────────────────────────────────────────────────────────

/** Every place that contains this one, walking up. Excludes the place itself. */
function containersOf(state: WorldState, locationId: string | null): Set<string> {
    const above = new Set<string>();
    if (!locationId) return above;
    let at = getLocation(state, locationId);
    while (at?.parentId) {
        if (above.has(at.parentId)) break;
        above.add(at.parentId);
        at = getLocation(state, at.parentId);
    }
    return above;
}

/**
 * Whether two places sit under the same province.
 *
 * `regionOf` is circulation's own walk and is asked here rather than restated:
 * how far news gets and whether a house is local have to agree about what a
 * province is, or a house two valleys away is a neighbour to one reading and a
 * stranger to the other.
 */
function sameProvince(state: WorldState, a: string, b: string | null): boolean {
    if (b === null) return false;
    const province = regionOf(state, a);
    return province !== null && province === regionOf(state, b);
}
