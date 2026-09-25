/**
 * Getting somewhere: on foot, on something, by folding, or on somebody's span.
 */

import { A_SPIRIT_BOAT_ANSWERS_TO, isWithThem, itWantsAPilot, takeItAlong } from '../engine/world/a-vehicle.js';
import { rankName } from '../engine/cultivation/realms.js';
import { resolveSect } from './entities.js';
import { readTheWall } from './what-is-posted-on-the-wall-here.js';
import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import { cashToStones } from '../data/cultivation/mortal-world.js';
import {
    REGIONS,
    localPrice,
    placeRoadDays,
    provinceRoadDays,
    regionIdOfPlace,
    requireRegion
} from '../data/cultivation/regions.js';
import { TECHNIQUES } from '../data/cultivation/techniques.js';
import {
    CONVEYANCES,
    countedConveyancesHeld,
    countedHoldingKey,
    kindOfCraft,
    requireConveyance
} from '../data/cultivation/what-a-house-moves-its-people-on.js';
import { simulateTimeSkip } from '../engine/cultivation/time-skip.js';
import { brokenStatusesOn } from '../engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { stageRank } from '../engine/social/discovery.js';
import {
    boardAt,
    quotePassageAtACounter
} from '../engine/world/buying-passage-at-a-measured-span-counter.js';
import { grantsHeldWith } from '../engine/world/capability.js';
import { residenceOf } from '../engine/world/somewhere-that-is-theirs.js';
import {
    FOLD_FLOOR_ORDINAL,
    FOLD_GRANT,
    type FoldFix,
    priceFold
} from '../engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';
import {
    type Conveyance,
    bestForThisRoad,
    couldFlyOnTheirOwnBlade,
    priceJourney
} from '../engine/world/what-a-conveyance-does-to-a-journey.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import { whatThatLooksLike } from '../engine/world/what-somebody-is-at-when-you-walk-up.js';
import {
    namesOf,
    takeThemWithYou,
    theSlowestOfThem,
    theyComeWithYou,
    whatThePartyIs,
    whoIsOnTheRoadWith,
    whoTheyAreOutWith,
    whyAFoldLeavesThemStanding
} from '../engine/world/who-is-on-the-road-with-you.js';
import {
    SPAN_CASH_PER_WALKED_DAY,
    SPAN_ROUTES,
    THE_SPAN_HOUSE_ID,
    counterPlaceNameAt,
    routeTo
} from '../engine/world/where-the-measured-span-still-answers.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import { primaryRoadOf } from '../schema/cultivation.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import {
    clearFlag,
    listCarriedArtifacts,
    daoHeartConditions,
    readJsonFlag,
    tollConditionsFor,
    writeFlag
} from '../server/consolidated/cultivation-support.js';
import type { ActionName } from './actions.js';
import { applyTimeSkip } from './apply.js';
import {
    PLAYER_ROLL_IDENTITY,
    cutTo,
    daysActuallySpent,
    encountersFor,
    recordEncounters,
    sayingWhatEndedTheSpan,
    whatCutTheSpanShort,
    withEncounterDeltas
} from './encounters.js';
import { resolvePlace, worldLocationFor } from './entities.js';
import { regionCatalogIdOf } from '../engine/world/how-a-cultivator-comes-by-a-road.js';
import { loosePlaceKey } from './knowledge.js';
import {
    howStandingHerePutIt,
    whoBeingHereIntroducesYouTo
} from '../engine/world/being-on-their-ground.js';
import type { Perception } from './shown-this-turn.js';
import {
    whatBeingAMemberTellsYou,
    whatStandingAmongYourOwnShows
} from './meeting-your-own-house.js';
import { getMembersOf } from '../data/cultivation/members.js';
import { getSect } from '../data/cultivation/sects.js';
import {
    howBigTheTownBelowIs,
    howManyLiveBelow,
    whatTheTownIsBelow,
    whatTradesBelow,
    whoWaitsBelow
} from '../engine/world/the-town-at-the-foot-of-a-house.js';
import {
    theHouseThisNameReaches,
    theHouseWhoseGateThisIs,
    whatTheGateOfThisHouseSays,
    whoWouldWalkYouIn,
    type AHouseYouCouldWalkTo
} from './walking-up-to-a-house.js';
import { aWalkInsideTheWalls } from './walking-inside-the-walls.js';
import { aWalkAcrossThePlace, standThemIn, theAreaTheyAreIn, theGateLetsThemIn, theWatchAtTheGate } from './walking-across-a-place.js';
import { whatTheDoorHereSays } from './walking-up-to-a-door-that-closes.js';
import { theQuartersThisCultivatorHas } from './leaving-a-thing-in-your-own-room.js';
import { abodeLocationId } from '../engine/world/immortal-world.js';
import { getLocation, getNpc, type WorldState } from '../engine/world/world-state.js';
import { populationWeightOf, type LocationRecord } from '../engine/world/locations.js';
import { pathTo } from '../engine/world/architecture.js';
import { layerOf, type LayerKey } from '../engine/world/layers.js';
import { factsForMove, factsForRefusal, factsForTimeSkip, factsForToolResult, humanDays, placeName, sayThisFirstWhateverTheNarratorDoes, shownWithNoModelAfter } from './facts.js';
import { refused, skipCalls, tollCalls, worldCalls } from './tool-result-prose.js';
import { SHORT_ACTION_DAYS, TRAVEL_FOCUS } from './turn-constants.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';
import { foldTheFightIn, theyCameAtYou } from './when-somebody-comes-at-you.js';
import { accountsComingDue } from './who-comes-to-settle-an-account.js';
import { chargeTheNightsInTheOpen, sayWhatTheNightsCost } from './where-the-nights-were-spent.js';
import {
    whatTheHullFed,
    whatTheRoadAte,
    whatWasEatenOnBoard,
    whetherThePackCoversTheRoad
} from './what-a-journey-eats.js';
import { daysPerRation } from '../engine/cultivation/survival.js';
import {
    aSeatOnAShipOrACarriage,
    theLineTo,
    theServiceNamed,
    whatRunsFromHere,
    type AService
} from './a-seat-on-a-ship-or-a-carriage.js';
import { whatTheEscortMet } from '../engine/encounters/an-escort-on-the-road.js';
import {
    aShipSailsOn,
    endTheVoyage,
    stillAtSea,
    theVoyageAfter,
    theVoyageUnderWay,
    theWaterUnder,
    whereTheShipIs,
    writeTheVoyage,
    type AVoyage
} from './a-ship-at-sea.js';
import { goingByShipInstead, theWayThereIsByShip } from './the-way-there-is-by-ship.js';
import { theRestOfTheFight } from './when-somebody-comes-at-you.js';
import { everythingInThePouch } from '../server/consolidated/cultivation-support.js';
import { SATIETY_MAX } from '../schema/cultivation.js';

/**
 * Somebody putting a party together, which the world sim writes and nothing
 * played had ever reached.
 */
const MUSTERING = 'mustering';

/**
 * A journey stopped short: where it was going, from where, and how much of it
 * was walked. It waits for as long as the player stands where it stopped -
 * dealing with whatever stopped the road does not undo the days walked.
 */
const FLAG_ROAD_STOPPED = 'road_stopped';

/** A box on wheels or a hull is a roof for the nights of a journey; a saddle, a blade and the road are not. */
const A_ROOF_ON_THE_ROAD: ReadonlySet<string> = new Set([
    'conv-carriage-mortal', 'conv-carriage-earth', 'conv-carriage-heaven', 'conv-spirit-boat'
]);

/** What a "carriage" or a "boat" means when it is their own, which `ride` takes before any counter. */
const OF_THEIR_OWN: Readonly<Record<AService, ReadonlySet<string>>> = {
    carriage: new Set(['conv-carriage-mortal', 'conv-carriage-earth', 'conv-carriage-heaven']),
    ship: new Set(['conv-spirit-boat'])
};
interface StoppedRoad {
    readonly to: string;
    readonly from: string;
    readonly road: number;
    readonly walked: number;
}

/** Names for a set of ids, so a line can say who rather than how many. */
function theNamesOf(npcs: readonly NpcRecord[], ids: readonly string[]): string[] {
    const wanted = new Set(ids);
    return npcs.filter(row => wanted.has(row.id)).map(row => row.name);
}

/**
 * The house whose ground somebody has just walked onto, written down.
 */
function noteWhoseGroundThisIs(
    game: GameService,
    cultivator: Cultivator,
    run: Run,
    arrivedAt: string
): void {
    if (!game.atHand) return;
    const row = worldLocationFor(game.atHand, arrivedAt);
    if (!row) return;
    const introduced = whoBeingHereIntroducesYouTo(game.atHand.locations, row.id);
    if (!introduced || !introduced.factionName) return;
    // `learnIfNew` rather than `noteEncounter`, and the stage is the reason.
    // `noteEncounter` lets the source decide, and `witnessed` carries a ceiling
    // of `known` - measured, arrival granted `encountered`, which is somebody
    // you have dealt with rather than a name you can say. Standing on their
    // ground is worth `named` and no more, which is the same grant the `look`
    // caller makes and the reason both are deliberately below their own ceiling.
    game.knowledge.learnIfNew({
        holderId: cultivator.id,
        kind: 'sect',
        id: introduced.factionId,
        name: introduced.factionName,
        onDay: Math.floor(run.elapsedDays),
        sourceKind: 'witnessed',
        sourceNote: 'They hold the ground this cultivator walked onto.',
        stage: 'named',
        statement: howStandingHerePutIt(introduced)
    });
}

/**
 * Who of your own house is standing where you have just arrived.
 */
function meetingYourOwnHouse(game: GameService, cultivator: Cultivator) {
    const membership = game.repos.sects.getMembership(cultivator.id);
    if (!membership) return null;
    return whatStandingAmongYourOwnShows(cultivator, membership.sectId, {
        houseName: getSect(membership.sectId)?.name ?? 'the house',
        here: game.present(cultivator).map(row => ({
            id: row.id,
            name: row.name,
            realmOrdinal: row.realmOrdinal,
            factionId: row.sectId,
            known: game.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id)
        }))
    });
}

/**
 * And the structure being enrolled told them, which needs nobody present.
 */
function theStructureYouWereTold(game: GameService, cultivator: Cultivator) {
    const membership = game.repos.sects.getMembership(cultivator.id);
    if (!membership) return null;
    const house = getSect(membership.sectId);
    if (!house) return null;
    return whatBeingAMemberTellsYou(membership.sectId, {
        houseName: house.name,
        // The house's own roll. Guests are in `GUEST_ELDERS` and are not in
        // this table at all, so the exclusion costs nothing to enforce.
        ladder: getMembersOf(membership.sectId).map(member => ({
            id: member.id,
            name: member.name,
            rankIndex: member.rankIndex,
            realmOrdinal: member.realmOrdinal
        })),
        ranks: house.ranks
    });
}

/**
 * The people an arrival introduces, whichever way the ground was covered.
 *
 * Three facts land on arriving: the place stops being a rumour, the house that
 * holds the ground is written, and the people of your OWN house standing on it
 * become nameable. `move` did all three and `ride`, `fold` and `passage` did
 * the first two - so a Frostmirror disciple who walked to the terraces was
 * introduced to their own people and the same disciple who bought passage to
 * the same ground was introduced to nobody. That is the "Sword Elder who could
 * not name one person in his own house" defect, live on three of the four ways
 * of arriving.
 *
 * One reader, called from the shared arrival and from `move`, rather than the
 * third fact living in one handler.
 */
function whatArrivingIntroduces(
    game: GameService,
    cultivator: Cultivator
): { perceived: Perception[]; structure: string[]; lines: string[] } {
    const perceived: Perception[] = [];
    const structure: string[] = [];
    const lines: string[] = [];

    // AND THE FOURTH: A GATE THAT IS HERE SAYS SO. Arriving below a house is
    // arriving at a door, and a door nobody mentions is a wall.
    const gate = whatIsAtTheGateHere(game, cultivator, cultivator.location ?? '');
    if (gate) {
        lines.push(...gate.lines);
        structure.push(gate.structure);
    }

    // AND A DOOR THAT SHUTS SAYS SO. Ground on a sixty-year cycle is a door as
    // much as a gatehouse is, and until this nothing reached
    // `beingAtADoorOnTheDayItOpens` at all: a player could stand on a ruin whose
    // window is a week and never be told there was a window.
    const door = whatTheDoorHereSays(
        game,
        cultivator,
        cultivator.location ?? '',
        // They are on it. The road is behind them and none of the window went
        // on getting here.
        0
    );
    if (door) {
        lines.push(...door.lines);
        structure.push(...door.structure);
    }

    const told = theStructureYouWereTold(game, cultivator);
    if (told) perceived.push(told);

    const met = meetingYourOwnHouse(game, cultivator);
    if (met) {
        perceived.push(met.perception);
        structure.push(
            `on the roll and in the room: ${met.perception.names.length} newly nameable, `
            + `${met.hiddenByHeight} withheld for height.`
        );
    }
    return { perceived, structure, lines };
}

/**
 * What standing at a house's gate is like, and which of the three roads is open.
 *
 * Fires on arriving anywhere that is a house's seat, whichever way the player
 * named it - so `<house>` and `<house> grounds` get the same answer, which is
 * the rule about a read running both ways.
 *
 * NOT HAVING THE STANDING TO GO IN IS NOT THE SAME AS SEEING NOTHING. The
 * market outside the wall is said in full to everybody: what trades there, and
 * who is permanently standing about on nobody's roll. The gate then says which
 * road is open to this person and what would open the others.
 */
function whatIsAtTheGateHere(
    game: GameService,
    cultivator: Cultivator,
    arrivedAt: string
): { lines: string[]; structure: string } | null {
    const world = game.atHand;
    if (!world) return null;
    const house = theHouseWhoseGateThisIs(world, arrivedAt);
    if (!house) return null;

    const lines: string[] = [];
    const structure: string[] = [];
    const reading = whatTheTownIsBelow(house.factionId);
    if (reading) {
        const trades = whatTradesBelow(reading);
        lines.push(`Outside the wall there is a ${howBigTheTownBelowIs(reading)}, and it is here `
            + `because the house is: ${trades.map(t => t.name).join(', ')}.`);
        lines.push(...whoWaitsBelow(reading));
        structure.push(`whatTradesBelow(${house.factionId}): `
            + `${trades.map(t => `${t.id} - ${t.what}`).join(' ')} `
            + `(${howManyLiveBelow(reading)} heads derived). Read only, nothing spent.`);
    }

    lines.push(...whatYouAlreadyHoldAboutThem(game, cultivator, house));

    // THE ONE ON WATCH, who is at every gate a house has anybody behind. See `theWatchAtTheGate`.
    const watch = theWatchAtTheGate(game, cultivator, house.seat, house.factionName);
    lines.push(watch.line);
    structure.push(watch.structure);

    const gate = whatTheGateOfThisHouseSays(game, cultivator, house);
    // Stopped is an obstacle like being turned away is, and the same road past
    // it is open: somebody who owes you walks you in.
    const host = gate.way === 'turned away' || gate.way === 'stopped and asked'
        ? whoWouldWalkYouIn(game, cultivator, gate.couldHost)
        : null;
    const said = host ? whatTheGateOfThisHouseSays(game, cultivator, house, host) : gate;
    lines.push(...said.facts);
    if (host) {
        lines.push(`${host.name} owes you, and it is that and not your standing that is `
            + 'walking you through.');
    }
    // WHERE THAT LEAVES THEM STANDING: inside, in the forecourt, only where the gate let them in;
    // anybody it stopped or turned away is outside it with the one on watch.
    standThemIn(game, cultivator, theGateLetsThemIn(said.way) ? 'forecourt' : 'gate');
    return { lines, structure: [...structure, said.structure].join(' ') };
}

/**
 * How many of the things you hold about a house get said back at its gate.
 *
 * Two, because a house you have been following turns up on several walls and
 * the third notice is the same sentence with a different date on it.
 */
const MOST_HELD_SAID_BACK = 2;

/**
 * What this cultivator was already told about this house, said at its door.
 *
 * THE REASON THIS FUNCTION EXISTS IS THAT THE PLAYER CAME HERE FOR A REASON.
 * A bill on a wall says the house is holding an intake at a ford in sixty-nine
 * days; the player reads it, says the house's name, and arrives - and the scene
 * used to describe the gate as though the name had come out of nowhere. The
 * words are already stored, in the wording they were got in, by whatever wrote
 * the row: `KnowledgeGate.provenanceOf` hands them back.
 *
 * Nothing is derived and nothing is checked against the world. This is what the
 * cultivator holds, which is not the same as what is so - a bill may have been
 * a lie when it was posted and the intake may have closed since - and the
 * stance and the day are on the row for anything that wants to say so.
 */
function whatYouAlreadyHoldAboutThem(
    game: GameService,
    cultivator: Cultivator,
    house: AHouseYouCouldWalkTo
): string[] {
    const held = game.knowledge.provenanceOf(cultivator.id, 'sect', house.factionId)
        .filter(row => row.statement.trim().length > 0)
        .sort((a, b) => b.acquiredOnDay - a.acquiredOnDay);
    if (held.length === 0) return [];

    const said = new Set<string>();
    const lines: string[] = [];
    for (const row of held) {
        const statement = row.statement.trim();
        if (said.has(statement)) continue;
        said.add(statement);
        lines.push(lines.length === 0
            ? `This is the house you were told about, and what you were told is: ${statement}`
            : `You were also told: ${statement}`);
        if (lines.length >= MOST_HELD_SAID_BACK) break;
    }
    return lines;
}

/** How many named places a refusal offers. A road question wants a few, not a gazetteer. */
const MOST_ROADS_NAMED = 6;

/**
 * The places this cultivator could name and actually be carried to.
 *
 * `somewhereReal` read the other way round, which is the rule in AGENTS.md
 * about every read running both ways: it answers *is this name a place I may
 * go to*, and nothing answered *which names are*. So a refusal could say the
 * name was not one and could not say what would have been.
 *
 * It leaks nothing. A name is on this list only where the gate would already
 * have let the sentence through - heard of and pointable at, or a square
 * somebody is standing in - so the player is being handed back what they have
 * already been told.
 */
function theRoadsThisCultivatorKnows(engine: GameService, cultivator: Cultivator): string[] {
    const here = loosePlaceKey(cultivator.location ?? '');
    const named = new Map<string, string>();
    const add = (name: string | null | undefined) => {
        if (!name) return;
        const key = loosePlaceKey(name);
        if (key.length === 0 || key === here || named.has(key)) return;
        named.set(key, name);
    };

    for (const row of engine.knowledge.awareness(cultivator.id, 'place')) {
        if (engine.knowledge.canPointAt(cultivator.id, 'place', row.id)) add(row.name);
    }
    for (const row of engine.repos.cultivators.roster()) add(row.location);
    return [...named.values()].slice(0, MOST_ROADS_NAMED);
}

/**
 * The sentence a refusal ends with, naming the roads rather than only the gap.
 *
 * Measured across four situations: `move` was chosen 20 times and refused 20
 * times, and every one of those refusals said what the name was not - *"nobody
 * sets you right, because nobody is sure what you meant"* - while the
 * destinations read, free and one sentence away, was printing the answer to
 * anybody who asked for it in different words. A refusal that names no route is
 * the one shape this engine is not allowed to produce.
 */
function andTheRoadsThatDoGoSomewhere(engine: GameService, cultivator: Cultivator): string {
    const roads = theRoadsThisCultivatorKnows(engine, cultivator);
    return roads.length === 0
        ? ' Nowhere has been named to you yet that you could set out for, which is what asking '
          + 'somebody here is for.'
        : ` Somewhere you could say instead: ${roads.join(', ')}.`;
}

/**
 * Words that say a player is going, not where they are going.
 *
 * `resolvePlace` accepts any string, because places in this engine are free
 * text, so the trailing word of "I run away" arrived as a destination and the
 * refusal reported having gone looking for a town called `away`:
 *
 *     You ask after away and get the look people give a name that is not a
 *     place.
 *
 * Nobody named a place. Measured in the refusal probe: `move` refused 22 of 28,
 * and the four sentences behind it are all this one thought - *I leave*, *I
 * wander off*, *I run away*, *I get out of here*. Three carry no target at all
 * and land correctly on the no-destination refusal; only the one with a word
 * after the verb went wrong, which is what made it look like a different defect
 * from its own siblings.
 *
 * Treating these as no destination said routes all four to one answer, and that
 * answer names the roads. It widens nothing: a sentence that named no place
 * still refuses, and still refuses to pick one on the player's behalf.
 *
 * Deliberately not here: `home`, `back` and `on`. Each could be resolved
 * against somewhere the player has actually been, which is an answer rather
 * than a refusal, and belongs with whoever builds that.
 */
const A_DIRECTION_RATHER_THAN_A_DESTINATION =
    /^(?:away|off|out|onwards?|onward|elsewhere|somewhere|anywhere|nowhere|there|here)$/i;

/** The destination the sentence named, with the direction words taken out. */
function destinationNamed(target: string | undefined): string | undefined {
    const said = (target ?? '').trim();
    return A_DIRECTION_RATHER_THAN_A_DESTINATION.test(said) ? undefined : target;
}

/**
 * The words that mean the place you live rather than a place on the map.
 *
 * `home` was the one of the three `A_DIRECTION_RATHER_THAN_A_DESTINATION`
 * deliberately left out, with a note saying it could be resolved against
 * somewhere the player has actually been and belonged with whoever built that.
 * This is that.
 */
const HOME_RATHER_THAN_A_PLACE_NAME =
    /^(?:back\s+)?(?:home|my\s+(?:own\s+)?(?:room|rooms|quarters|place)|our\s+quarters)$/i;

/**
 * Where home is, in the order somebody would answer it.
 *
 * THREE ANSWERS AND THE THIRD IS NOT A FAILURE. An abode above the Lid, the
 * quarters a house gives you, or nothing - and being homeless is the ordinary
 * condition of a rogue in this setting, so it is stated as a fact rather than
 * dressed as a misread sentence.
 *
 * WHAT IT RETURNS IS A PLACE NAME, not a route. `move` already knows how to
 * send somebody of the house to their house's seat and everybody else to the
 * town below it, so home resolves to a NAME and goes back through the same
 * door every other destination goes through. Bypassing that would be a second
 * opinion about where a road ends.
 */
export type WhereHomeIs =
    | { kind: 'abode'; name: string; layer: LayerKey }
    | { kind: 'quarters'; name: string; houseName: string; roomName: string }
    | { kind: 'nowhere' };

export function whereHomeIs(
    game: GameService,
    world: WorldState | null,
    cultivator: Cultivator
): WhereHomeIs {
    if (world) {
        const abode = getLocation(world, abodeLocationId(cultivator.id));
        if (abode) return { kind: 'abode', name: abode.name, layer: layerOf(abode) };
        // AND GROUND OF THEIR OWN BELOW THE LID - a cave they took and made theirs. The owner
        // counts it with the inn and the sect as a room of their own.
        const residence = residenceOf(world, cultivator.id);
        if (residence) return { kind: 'abode', name: residence.name, layer: layerOf(residence) };

        const mine = theQuartersThisCultivatorHas(game, world, cultivator);
        if (mine) {
            return {
                kind: 'quarters',
                // The HOUSE's name, because that is the string `move` resolves
                // to a seat, and a member of the house rides home to the seat.
                name: mine.houseName,
                houseName: mine.houseName,
                roomName: mine.quarters.name
            };
        }
    }
    return { kind: 'nowhere' };
}

/**
 * The most populous place inside a province that somebody could be standing in,
 * or null where it holds none. See `whereTheRoadEndsIn` for why.
 */
export function theMostPeopledPlaceIn(
    world: Pick<WorldState, 'locations'>,
    provinceId: string
): LocationRecord | null {
    let best: LocationRecord | null = null;
    for (const place of world.locations) {
        if (place.kind !== 'settlement' || place.sealed) continue;
        if (place.thresholds.entry > 0 || place.thresholds.survival > 0) continue;
        if (populationWeightOf(place) <= 0) continue;
        if (!pathTo(world.locations, place.id).some(step => step.id === provinceId)) continue;
        if (best === null || populationWeightOf(place) > populationWeightOf(best)) best = place;
    }
    return best;
}

export const travelVerbs = {
    /**
     * Going somewhere, however it was meant.
     */
    async move(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string
    ): Promise<Execution> {
        // ── AND HOME IS A PLACE, ONCE THERE IS SOMEWHERE THAT IS YOURS ────
        //
        // Resolved to a NAME and then dropped back into the ordinary road
        // below, so the abode and the house's seat are reached the same way
        // anywhere else is. The one case that does not become a name is the
        // abode on the other side of the Lid, which is not walked to.
        let said = target;
        // CARRYING ON IS THE ROAD THAT STOPPED. "keep going" names nowhere, and
        // with a road stopped where they stand there is only one way it means.
        if ((said ?? '').trim().length === 0) {
            const stopped = readJsonFlag<StoppedRoad>(this.repos.db, cultivator.id, FLAG_ROAD_STOPPED);
            if (stopped !== null && stopped.from === placeName(cultivator)) said = stopped.to;
        }
        // A ROOM PAID FOR HERE IS UPSTAIRS, NOT HOME: "my room" to a lodger is the inn's.
        if (HOME_RATHER_THAN_A_PLACE_NAME.test((target ?? '').trim())) {
            const upstairs = await aWalkAcrossThePlace(this, run, cultivator, target);
            if (upstairs) return upstairs;
        }
        if (HOME_RATHER_THAN_A_PLACE_NAME.test((target ?? '').trim())) {
            this.atHand = this.atHand ?? await this.loadWorld();
            const home = whereHomeIs(this, this.atHand, cultivator);
            if (home.kind === 'nowhere') {
                return refused('engine.noHome', 'move', factsForRefusal(
                    'You have no home.',
                    'There is nowhere in this world that is yours. No house quarters you and '
                    + 'you have cut no ground of your own, so there is no door to walk back '
                    + 'to and nothing waiting behind one.',
                    'move/home: no abode and no membership, so no quarters. Location '
                    + 'unchanged, no time passed.'
                ));
            }
            if (home.kind === 'abode'
                && this.atHand
                && layerOf(getNpc(this.atHand, cultivator.id)) !== home.layer) {
                return refused('engine.homeIsNotOnThisLayer', 'move', factsForRefusal(
                    `${home.name} is not on this side of the Lid.`,
                    `${home.name} is yours and it is above the Lid. It is not somewhere a road `
                    + 'goes; getting to it is the crossing, and the crossing is its own act.',
                    `move/home: abode on the ${home.layer} layer, body below it. Location `
                    + 'unchanged, no time passed.'
                ));
            }
            said = home.name;
        }
        // ── A ROOM IS WALKED TO FROM INSIDE ITS OWN WALLS ────────────────
        //
        // On a house's ground, a sentence naming one of its rooms, or the gate
        // and the forecourt, is a walk across the compound rather than a road.
        // See `walking-inside-the-walls.ts` for what decides it.
        // An area of the place they stand in first - the inn, the cloth row, in through the gate -
        // which is a walk and not a road. See `walking-across-a-place.ts`.
        const acrossThePlace = await aWalkAcrossThePlace(this, run, cultivator, said);
        if (acrossThePlace) return acrossThePlace;
        // ABOARD A SHIP AT SEA the one way is where it is bound, and going there is sailing on.
        const voyage = theVoyageUnderWay(this.repos.db, cultivator);
        if (voyage) {
            const bound = (said ?? '').trim();
            return bound.length === 0 || loosePlaceKey(bound) === loosePlaceKey(voyage.bound)
                || /^(?:on|onward|onwards|ahead|forward)$/i.test(bound)
                ? aShipSailsOn(this, run, cultivator, voyage, null, 'carrying_on')
                : stillAtSea(voyage, 'move');
        }
        const insideTheWalls = await aWalkInsideTheWalls(this, run, cultivator, said);
        if (insideTheWalls) return insideTheWalls;
        const named = resolvePlace(destinationNamed(said));
        // ── A HOUSE IS SOMEWHERE YOU CAN GO, AND WHERE YOU GO IS ITS TOWN ──
        //
        // Measured on three pinned worlds, day 0, 38 seated houses each: `I
        // travel to <house>` reached 0 of 38. The seat is a world row called
        // `<house> grounds` and `somewhereReal` matches on names, so the only
        // string that reached a compound was one no player would type.
        //
        // Where the road ENDS is the standing question, and it is answered by
        // the roll and nothing else: somebody of the house rides home, and
        // everybody else arrives in the town at the foot of the gate. Who is
        // on the gate and whether anybody would host is read when they get
        // there, because who is standing at a gate is a fact about the gate and
        // not about where the walk started.
        const house = this.atHand && named
            ? theHouseThisNameReaches(this.atHand, named.name)
            : null;
        const place = house ? resolvePlace(house.seat.name) ?? named : named;
        // AND NOT FROM ANYWHERE ELSE. A room's name reached the world's loose
        // match, which takes an id ending in `-lecture-hall` and so would have
        // sent somebody down a road into whichever house the world listed first.
        const aRoomSomewhere = this.atHand && place ? worldLocationFor(this.atHand, place.name) : null;
        if (aRoomSomewhere?.tags.includes('interior')) {
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'That is a room, and you are not inside the walls it is behind.',
                `${place!.name} is somewhere inside a house's walls, and a room is walked to from inside `
                + 'them. You are not on that house\'s ground.',
                `move: "${place!.name}" resolved to interior row ${aRoomSomewhere.id}, not inside the `
                + 'compound this cultivator is standing in. Location unchanged, no time passed.'
            ));
        }
        // WHERE THEY ALREADY STAND IS NOT A ROAD. Played: "head back downstairs" came
        // from the model as move(the town they were in) and spent a day on the road to
        // it. It is a walk out of the area they are in - down from a room to the inn,
        // or out to where a road arrives - or they are already there. Never a day.
        // A house's own seat is the gate's to answer: standing outside it, going to it is going in.
        if (place && !house && loosePlaceKey(place.name) === loosePlaceKey(placeName(cultivator))) {
            const inRoom = theAreaTheyAreIn(this.atHand, cultivator)?.area.for === 'room';
            const out = await aWalkAcrossThePlace(this, run, cultivator, inRoom ? 'downstairs' : 'street');
            if (out) return out;
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                `You are already in ${placeName(cultivator)}.`,
                `You are standing in ${placeName(cultivator)} already.`,
                `move: "${place.name}" is where this cultivator stands. Location unchanged, no time passed.`
            ));
        }
        if (!place) {
            // ── GETTING INSIDE IS NOT A JOURNEY, AND WAS ANSWERED AS ONE ──
            //
            // Measured: "I sneak in" was answered with the roads OUT of the
            // square and six province names. Somebody sneaking in is not
            // choosing a destination, they are trying to get through a wall
            // where they already stand, and a list of roads is a read answering
            // a question it was not asked.
            //
            // The intent is the whole of the difference and it was already in
            // hand. What is behind a wall here is `site` and the compound reads;
            // this says which sentence reaches them rather than guessing which
            // one the player meant.
            if (intent === 'enter') {
                return refused('engine.resolvePlace', 'move', factsForRefusal(
                    'Into what?',
                    `You are standing in the open at ${placeName(cultivator)} and there is no `
                    + 'wall, gate or mouth in front of you to get through. Getting inside needs '
                    + 'something to be inside of: "what is around here" names the grounds within '
                    + 'reach, and a house is walked up to by name before it can be got past.',
                    'move/enter with no place named: nothing to enter from where this cultivator '
                    + 'stands. Location unchanged and no time passed.'
                ));
            }
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'Nowhere in particular.',
                `You get as far as the edge of ${placeName(cultivator)} before it occurs to you ` +
                'that you have not decided where you are going, and there is nothing out there ' +
                'obliging enough to decide it for you.'
                + andTheRoadsThatDoGoSomewhere(this, cultivator),
                'No destination named; location unchanged and no time passed.'
            ));
        }

        // A destination has to be somewhere.
        //
        // `resolvePlace` accepts any string, because a place in this engine
        // is free text and always has been. That is fine for describing one
        // and catastrophic for travelling to one: "I follow the cultivator"
        // parsed the trailing noun as a destination and the engine dutifully
        // moved the player to a location called `cultivator`, spent the
        // travel days, and then described its ambient qi. A name the world
        // has never heard of is not a place; it is a misparse with a
        // location row behind it.
        //
        // Checked against three registers, any of which is enough: the
        // world's own locations, anywhere a person is standing, and
        // anywhere this cultivator has heard of. The third is what keeps
        // this from being a discovery leak in reverse - the player may go
        // where they have been told about, and the refusal below never says
        // where that is.
        // Only where there is a register to check against. With the world
        // driver off, places in this engine are documented free text and
        // there is nothing that could say a name is wrong; refusing then
        // would make travel impossible rather than safe.
        if (this.atHand && !this.somewhereReal(place.name, cultivator)) {
            // ── SOMEBODY STANDING HERE IS NOT A JOURNEY ──────────────
            //
            // Played, on the parting: *"I go back to He Xuxue and kneel before
            // him. Grandfather, I leave with the caravan tomorrow."* The kneel
            // resolved and landed on him. The first clause went to the travel
            // verb, because "go back to <name>" is what the table reads it as
            // and the table cannot see who is in the room - and the turn was
            // spent on *"No road goes there. Unresolved destination 'He
            // Xuxue'"*, about a man standing an arm's length away.
            //
            // Going back to somebody you are already standing with is crossing
            // a room. It is not a road, it costs no day, and it is the sentence
            // people open a parting or an apology with, which is why it is
            // worth a beat rather than a refusal.
            //
            // The pair is the idiom `release` uses: a NAME through
            // `partyPutTo`, a description or a pointer through
            // `somebodyAtHand`, because neither answers both.
            {
                const named = place.name.trim();
                const put = named.length >= 2
                    ? this.partyPutTo(cultivator, named, this.scopeFor(cultivator))
                    : null;
                const here = this.present(cultivator);
                const crossTo = (put ? here.find(row => row.id === put.id) : undefined)
                    ?? (named.length > 0 ? this.somebodyAtHand(named, cultivator) : null);
                if (crossTo) {
                    return this.freeAction(run, 'move', factsForToolResult(
                        `You cross to ${crossTo.name}.`,
                        [`${crossTo.name} is standing here, so there was no road to take.`]
                    ));
                }
            }

            // A HOUSE IS NOT A PLACE, AND SAYING SO BEATS SAYING YOU NEVER
            // HEARD OF IT.
            //
            // FOUND BY PLAYING, and it was the game contradicting itself one
            // turn apart. Turn one told the player, unprompted, that the Azure
            // Dew Sect was holding an intake here in sixty-nine days. Turn two
            // said "I go to the azure dew sect" and got *"matches no world
            // location, no occupied place and NOTHING THIS CULTIVATOR HAS HEARD
            // OF"*.
            //
            // Both halves were doing their job. `readTheWall` had written the
            // house into the knowledge table, and `somewhereReal` looks for a
            // PLACE - so the sect was known and its ground was not, and the
            // refusal reported the second as though it were the first.
            //
            // The design owner: *"if it's something you know it should mention.
            // Like, you've heard the abc sect is recruiting."* So it says what
            // is actually held: you know them, here is what you were told, and
            // what nobody has told you is where they are.
            const known = this.whatTheyKnowOfThisHouse(place.name, cultivator, run);
            if (known !== null) {
                // THE INFORMATION IS THE SAME. THE VOICE IS NOT THE ENGINE'S.
                //
                // The first cut of this said "a name you have been given and
                // not a place you have been given", and the design owner: *"the
                // info is right, but the prose, not right... if that's engine
                // feedback, that's okay."* Exactly the line this repo draws:
                // the mechanical channel may say a house is not a location, and
                // the channel a player reads as a scene may not, because that
                // is the engine explaining its own categories out loud.
                //
                // So the scene says what it is like to know a name and not a
                // road, the paper says the rest in the words it was written in,
                // and the category stays in the record below.
                const asked = this.anybodyElseHere(cultivator)
                    ? `You ask the way to ${known.name} and get it twice over: everybody has `
                      + 'heard the name, nobody has been.'
                    : `You turn the name over and it goes nowhere. ${known.name} is something `
                      + 'you know of, not somewhere you know the road to.';
                return refused('engine.resolvePlace', 'move', factsForRefusal(
                    'You have the name. You do not have the road.',
                    known.told === null
                        ? `${asked} Whoever they are, they have not said where they keep `
                          + 'themselves, and a name is not a direction.'
                        : `${asked} What you have of them is the paper: ${known.told}`,
                    `"${place.name}" is a house this cultivator has heard of and not a location. `
                    + 'Location unchanged, no time passed.'
                ));
            }
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'No road goes there.',
                // AND NO BYSTANDERS IN AN EMPTY SQUARE. This read "you get the
                // look people give a name that is not a place" on ground the
                // same turn had already reported as empty - "Nobody is about" -
                // so the answer put a crowd in a place it had just emptied.
                (this.anybodyElseHere(cultivator)
                    ? `You ask after ${place.name} and get the look people give a name that is `
                      + 'not a place.'
                    : `You turn ${place.name} over and it does not attach to anywhere. No road `
                      + 'you know of runs to it, and there is nobody here to ask.')
                // AND IT SAYS WHERE THE ROADS DO GO.
                //
                // This ended "nobody sets you right, because nobody is sure
                // what you meant", which is a refusal declining to name a
                // route while the destinations read - free, and one sentence
                // away - was printing the answer to anybody who asked in
                // different words. Nothing is opened by saying it: every name
                // here is one the gate above would already have let through.
                + andTheRoadsThatDoGoSomewhere(this, cultivator),
                `Unresolved destination "${place.name}": matches no world location, no ` +
                'occupied place and nothing this cultivator has heard of. Location unchanged, ' +
                'no time passed.'
            ));
        }

        // ── THE NAME WE STORE IS THE WORLD'S, NOT THE PLAYER'S ───────────
        //
        // `extractSubject` consumes an optional leading article after the verb,
        // so "I travel to The Buddha Precipice" arrives here as "Buddha Precipice" -
        // and every province in the world is named "The" something. Matching
        // survives that, because `somewhereReal` compares on `loosePlaceKey`
        // and the comment there says exactly why. STORING did not: the run then
        // sat at a location string matching no world row at all, so the
        // province could not be resolved from it, `where can I go` answered for
        // the wrong province, and a house's gate the player had just been told
        // about was never listed.
        //
        // So canonicalise to the row the world actually holds. The refusals
        // above deliberately keep the player's own words; this is the arrival,
        // and the arrival is a fact about the world.
        // The world's row where there is one; otherwise the catalog's province,
        // because a run without the world layer still travels and still has to
        // store a name the rest of the engine can resolve.
        const worldRow = this.atHand ? worldLocationFor(this.atHand, place.name) : null;
        //
        // PLACES WIN. A town you can walk to is a better answer than the
        // province containing it, so the province branch is consulted only when
        // the typed name is not a place the catalog knows.
        const bareName = (name: string) => name.replace(/^the\s+/i, '').toLowerCase();
        const asProvince = regionIdOfPlace(place.name)
            ? undefined
            : REGIONS.find(region => bareName(region.name) === bareName(place.name));
        // AND A PROVINCE IS NOT SOMEWHERE ANYBODY STANDS. See `whereTheRoadEndsIn`.
        const roadEnds = this.whereTheRoadEndsIn(worldRow?.name ?? asProvince?.name ?? place.name);
        const arrivedAt = roadEnds.name;

        // A JOURNEY WITH AN END ON OPEN WATER IS SAILED, so it goes to the landing, or at the
        // landing says what the seat costs. See `the-way-there-is-by-ship.ts`.
        const byShip = theWayThereIsByShip(this, cultivator, arrivedAt, Math.floor(run.elapsedDays));
        if (byShip) {
            return goingByShipInstead(this, run, cultivator, byShip,
                landing => this.move(run, cultivator, ambient, landing, intent));
        }

        // ── AND THE ROAD IS AS LONG AS THE CATALOG SAYS IT IS ────────────
        //
        // This spent `SHORT_ACTION_DAYS` for every journey to anywhere, while
        // `destinations` printed the catalog's `travelDays` beside each
        // province - so the game told a player Iron Crest was eleven days away and
        // then took them there in one. `FOLD_TRAVEL_ENGINE_GAP` names this line
        // as the reason a fold could not be shown to save anybody anything.
        //
        // Only where the catalog states a figure, at either of the two scales
        // it states one at - a province road, or a road between two named
        // places of one province. Inventing a number where it states none is
        // the fabricated-zero mistake `whereCouldTheyGo` records having made
        // once already, so an unpriced journey still costs the flat day.
        const onTheRoad = this.daysOnTheRoadTo(cultivator, place.name) ?? SHORT_ACTION_DAYS;

        // ── A STOPPED ROAD GOES ON FROM WHERE IT STOPPED ─────────────────
        //
        // From the same place, to the same end. Whatever happened while they
        // stood there - the fight with whoever stopped them - leaves it; setting
        // out anywhere else, or being somewhere else, walks the road from its
        // start.
        const held = readJsonFlag<StoppedRoad>(this.repos.db, cultivator.id, FLAG_ROAD_STOPPED);
        if (held !== null) clearFlag(this.repos.db, cultivator.id, FLAG_ROAD_STOPPED);
        const alreadyWalked = held !== null
            && held.to === arrivedAt
            && held.from === placeName(cultivator)
            && held.road === onTheRoad
            && held.walked > 0 && held.walked < onTheRoad
            ? held.walked
            : 0;
        const leg = onTheRoad - alreadyWalked;

        const startDay = Math.floor(run.elapsedDays);

        // ── THE ROAD HAS THINGS ON IT ────────────────────────────────────
        //
        // Played: eleven days from the grounds to the next province, and
        // nothing on the road - no traveller, no merchant, no trouble. The
        // design owner: *"you can't just travel ... you meet other travellers,
        // merchants, etc. maybe even a sect party ... bandits, whatever"*, and
        // *"your encounters scale on your realm."*
        //
        // Nothing was missing but this call. `'travel'` has always been an
        // encounter activity, with its own profile in the realm-pitched draw
        // that already knows what somebody has outgrown; every other span that
        // spends days rolls this window through `shortSkip`, and the journey
        // alone called the time-skip directly and skipped it. The time-skip's
        // own check runs on a ninety-day grid that suits a decade in a cave
        // and that an eleven-day road almost never reaches.
        const enc = encountersFor(
            { repos: this.repos, knowledge: this.knowledge, world: this.atHand },
            {
                seed: run.seed,
                startDay,
                days: leg,
                activity: 'travel',
                cultivator,
                // The row id is a randomUUID. See PLAYER_ROLL_IDENTITY.
                rollIdentity: PLAYER_ROLL_IDENTITY,
                comingForYou: accountsComingDue(this, cultivator)
            }
        );
        // ── AND A ROAD CAN STOP YOU ──────────────────────────────────────
        //
        // The owner: *"just treat journey as a multi part action ... if you
        // get interrupted in a multi part action, you stop."* Nothing new is
        // built for it. A span cut short never moves anybody - that is already
        // true of every broken sitting - so a journey stopped on day four has
        // spent four days and arrived nowhere, and the rest of the road is
        // still ahead.
        const lived = daysActuallySpent(enc, startDay, leg);
        const setOut = withEncounterDeltas(cultivator, enc);
        // What is in the pack feeds them here too. Only seclusion tops the pack
        // up from the purse; this eats what is already carried.
        const carried = this.drawFromPack(cultivator, lived);
        const packShort = whetherThePackCoversTheRoad(cultivator, carried, leg);
        const skip = simulateTimeSkip(setOut, lived, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: TRAVEL_FOCUS,
                ...this.rateTermsFor(cultivator),
                ground: this.groundFor(cultivator)
            },
            understanding: this.understandingFor(run, cultivator),
            rations: carried,
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            // On its feet, so the sentences written for a cave are not used.
            spanIsASitting: false,
            ...daoHeartConditions(this.repos.db, cultivator, Math.floor(run.elapsedDays)),
            toll: tollConditionsFor(this.repos, cultivator)
        });

        this.putBackWhatWasNotEaten(cultivator, skip);
        const stopped = !skip.died && skip.simulatedDays < leg;
        const applied = applyTimeSkip(this.repos, {
            before: setOut, run, skip, ...(stopped ? {} : { location: arrivedAt })
        });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        // What the road actually put in front of them, cut to the days walked:
        // an occurrence past the day they stopped did not happen.
        const happened = cutTo(enc, startDay, skip.simulatedDays);
        this.handBackWhatNeverHappened(applied.cultivator, enc, happened);
        const onTheWay = recordEncounters(
            this.knowledge, applied.cultivator, applied.run.elapsedDays, happened, this.repos
        );

        // THE ROAD'S NIGHTS AND ITS MEALS. Charged here rather than after the
        // turn, because whoever stopped the road fights the body the nights left.
        const nights = skip.died ? [] : Array.from({ length: skip.simulatedDays }, (_, i) => startDay + i);
        const charged = nights.length > 0 ? chargeTheNightsInTheOpen(this, run, applied.cultivator, nights) : null;
        const walker = this.repos.cultivators.getById(cultivator.id) ?? applied.cultivator;
        const whatWasEaten = skip.died ? null : whatTheRoadAte(walker, carried, skip.endState.rationsRemaining);
        const sayTheRoadsFood = (facts: Execution['facts']): void => {
            if (packShort) facts.lines.unshift(packShort);
            if (whatWasEaten) facts.lines.push(whatWasEaten);
            facts.prose = [packShort, facts.prose, whatWasEaten].filter(Boolean).join('\n\n');
        };

        if (stopped) {
            const walked = alreadyWalked + skip.simulatedDays;
            const remaining = onTheRoad - walked;
            const stoppedRoad: StoppedRoad = {
                to: arrivedAt,
                from: placeName(applied.cultivator),
                road: onTheRoad,
                walked
            };
            writeFlag(this.repos.db, cultivator.id, FLAG_ROAD_STOPPED, JSON.stringify(stoppedRoad));
            const cut = whatCutTheSpanShort({
                asked: leg, lived, skip, arrival: enc, startDay, world: null
            });
            const facts = factsForTimeSkip(cultivator, applied.cultivator, skip, ambient, 'Travel', leg);
            const line = `The road to ${arrivedAt} stopped short. `
                + (cut ? sayingWhatEndedTheSpan(cut, humanDays) : `${humanDays(skip.simulatedDays)} were spent on it.`)
                + ` You are not there. The rest of the road is still ahead of you, ${humanDays(remaining)} of it`
                + ` - say it again and you walk only that.`;
            facts.lines.unshift(line);
            facts.required = [...(facts.required ?? []), line];
            facts.lines.push(...onTheWay.lines, ...world.lines);
            facts.structure.push(...onTheWay.structure, ...world.structure,
                `move: stopped on day ${walked} of ${onTheRoad} for ${arrivedAt}; location unchanged.`);
            const halted: Execution = {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                outcome: 'executed',
                calls: [{
                    name: 'engine.encounterWindow',
                    action: 'move',
                    summary: `The road to ${arrivedAt} was stopped on day ${walked} of `
                        + `${onTheRoad}. Location unchanged; ${remaining} day(s) of road remain.`,
                    ok: true
                }],
                nights: 'charged'
            };
            sayTheRoadsFood(halted.facts);
            if (charged) sayWhatTheNightsCost(halted, charged);
            // AND WHOEVER STOPPED IT MAY HAVE COME AT THEM, which is a fight.
            const cameAt = theyCameAtYou(this, applied.run, walker, ambient, happened);
            return cameAt ? foldTheFightIn(halted, cameAt) : halted;
        }

        // Standing somewhere is how a place stops being a rumour. Recorded with
        // its source so a place walked to and a place read about stay different
        // facts.
        this.noteEncounter(
            applied.cultivator, run, { kind: 'place', id: arrivedAt, name: arrivedAt },
            'witnessed', `Arrived on day ${Math.round(applied.run.elapsedDays)}.`
        );

        // AND WHOSE GROUND IT IS. The place and its holder are one arrival.
        noteWhoseGroundThisIs(this, applied.cultivator, run, arrivedAt);

        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);
        const facts = factsForMove(
            cultivator, applied.cultivator, arrivedAt, intent, skip, ambient, ambientAfter
        );
        // WHAT WAS MET ON THE ROAD, on a road that was walked to its end.
        facts.lines.push(...onTheWay.lines);
        facts.structure.push(...onTheWay.structure);
        sayTheRoadsFood(facts);
        if (alreadyWalked > 0) {
            facts.structure.push(
                `move: resumed a stopped road; ${alreadyWalked} of ${onTheRoad} days were already walked, `
                + `${skip.simulatedDays} walked now.`
            );
        }
        // WHICH PLACE THE ROAD ENDED AT, where the name typed was a province.
        // Said on the required channel: a player who typed a province and is
        // standing in a town has to be told which town.
        if (roadEnds.provinceName !== null) {
            const line = `The road into ${roadEnds.provinceName} ends at ${arrivedAt}, the largest town in it, `
                + 'and that is where you are standing.';
            facts.lines.unshift(line);
            facts.required = [...(facts.required ?? []), line];
            facts.structure.push(
                `move: ${roadEnds.provinceName} is a region row and nobody stands on one; arrived at `
                + `${arrivedAt}, the settlement in it with the greatest populationWeightOf.`
            );
        }

        // ── AND WHO OF YOUR OWN IS STANDING HERE ─────────────────────────
        //
        // `the-people-you-serve-with.ts` holds the rule and why it needs both
        // the roll AND the room. See {@link whatArrivingIntroduces}.
        const introduced = whatArrivingIntroduces(this, applied.cultivator);
        const perceived = introduced.perceived;
        facts.structure.push(...introduced.structure);
        // THE GATE IS ON `lines` AND IS NOT REQUIRED, which is the same ruling
        // the three other arrival sites carry. It used to say a gate was
        // required because a narrator dropping it leaves the player outside
        // with no account of why - and the answer to that is that the narrator
        // is HANDED it and writes from it. `required` is what must be read
        // EXACTLY, and twelve lines of description about a wall are not: a
        // played run had them stapled under the narration, clerk by clerk.
        //
        // This was the fourth site and the sweep that fixed the other three
        // missed it, because it builds the list a different way.
        // And in the prose, which is what a player with no model reads: on
        // `lines` alone the gate and the door were for the narrator only.
        for (const line of introduced.lines) shownWithNoModelAfter(facts, line);

        // AND THE PEOPLE WHO CAME WITH YOU. A road has no capacity: everybody
        // walks, and a party on foot costs what one person costs.
        const came = this.theyArrivedWithYou(applied.cultivator, arrivedAt);
        if (came) {
            facts.lines.push(came.line);
            facts.required = [...(facts.required ?? []), came.line];
            facts.structure.push(came.structure);
        }

        const arrived: Execution = {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'cultivator.update',
                    action: 'move',
                    summary: `Location set to "${arrivedAt}" (intent: ${intent}); ambient qi there is ${ambientAfter}.`,
                    ok: true
                },
                ...skipCalls('move', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ],
            perceived,
            nights: 'charged'
        };
        if (charged) sayWhatTheNightsCost(arrived, charged);
        return arrived;
    },

    // ─────────────────────────────────────────────────────────────────────
    // THE THREE WAYS OF COVERING GROUND THAT ARE NOT WALKING
    //
    // `ride`, `fold` and `passage`, and between them they add no mechanism at
    // all. Every piece was built, argued out and left with no caller in
    // `src/`, and two of the three modules record their own gap in their own
    // file - `FOLD_TRAVEL_ENGINE_GAP` names this handler by name.
    //
    //   the conveyance ladder     `priceJourney`, `bestForThisRoad`,
    //                             `unsuitedFor`, `whatArrivingOnThisSays`,
    //                             `couldFlyOnTheirOwnBlade`
    //   folding space             `priceFold`, `foldRangeInWalkingDays`,
    //                             `whatArrivingByFoldSays`
    //   somebody else's span      `boardAt`, `quotePassageAtACounter`,
    //                             `whatTheBoardDoesNotSay`
    //
    // ── AND THE ROAD IS PAID NOW, WHICH IS WHAT MAKES ANY OF IT MEAN ─────
    //
    // `FOLD_TRAVEL_ENGINE_GAP` is explicit that a saving cannot be shown to a
    // player without printing a number the engine does not charge. It was
    // right: `move` spent a flat day for every journey while `destinations`
    // printed the catalog's `travelDays` beside each province, so the game
    // told a player Iron Crest was eleven days away and then took them there in
    // one. {@link daysOnTheRoadTo} is the single reader of that figure and
    // every verb here goes through it, `move` included - so a fold that saves
    // ten days saves ten days that were being spent.
    //
    // What that does NOT change: a journey the catalog does not price. A
    // fabricated number is the mistake `whereCouldTheyGo` records having made
    // once already, so an unpriced pair still costs the flat day. Since
    // `RegionPlaceConnectionSchema` landed, the catalog can state a road
    // between two named places of ONE province as well, and
    // {@link daysOnTheRoadTo} reads that at the same scale in the same unit -
    // so the set of unpriced journeys is smaller and the rule about them is
    // exactly as it was.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * What the catalog says this road costs on foot, or null where it says nothing.
     */
    daysOnTheRoadTo(this: GameService, cultivator: Cultivator, destination: string): number | null {
        const bare = (name: string) => name.replace(/^the\s+/i, '').trim().toLowerCase();
        const from = requireRegion(standingOf(cultivator).regionId);
        // A place only the world names - a house's grounds, a site - is in a
        // province too, and the world's own row knows which.
        const inTheWorld = (name: string): string | null => {
            const row = this.atHand ? worldLocationFor(this.atHand, name) : null;
            return row && this.atHand ? regionCatalogIdOf(this.atHand, row.id) : null;
        };

        // The finer scale first, because it is the one that can answer at all
        // when both ends are in one province. It reads both directions off a
        // row the catalog states once.
        const nextDoor = placeRoadDays(placeName(cultivator), destination);
        if (nextDoor !== null) return nextDoor;

        const toRegionId = regionIdOfPlace(destination)
            ?? REGIONS.find(region => bare(region.name) === bare(destination))?.id
            ?? inTheWorld(destination);
        if (toRegionId === null || toRegionId === from.id) return null;

        // Over as many borders as it takes. See `provinceRoadDays`.
        return provinceRoadDays(from.id, toRegionId);
    },

    /**
     * What this cultivator could actually put under them for a road, best last.
     */
    whatTheyCouldRide(
        this: GameService,
        cultivator: Cultivator
    ): Array<{ conveyance: Conveyance; power: number | null; rowId?: string }> {
        const available: Array<{ conveyance: Conveyance; power: number | null; rowId?: string }> = [
            { conveyance: requireConveyance('conv-on-foot'), power: null }
        ];

        // WHATEVER THEY HOLD THAT CARRIES THEM, and not one art by id.
        //
        // This read `gale-riding-sword-flight` by name, so the catalog's other
        // fifteen movement arts could not put a road under anybody - and the
        // design note on that row says exactly why that is wrong: the design
        // owner named flight as the ANALOGY for an incidental ability, so the
        // row is the EXAMPLE and not the case. `category: 'movement'` is the
        // catalog's own statement of which arts these are, and the gate asks
        // each one what road it stands on.
        const held = cultivator.knownTechniques
            .map(id => TECHNIQUES.find(t => t.id === id))
            .filter((t): t is NonNullable<typeof t> => t !== undefined)
            // `HeldArt.subject` is a scalar where a row carries several, so
            // this is `primaryRoadOf` - the road the row is written under.
            .map(t => ({ ...t, subject: primaryRoadOf(t) }));

        const carriesThem = held
            .filter(art => art.category === 'movement')
            // Deepest first, so the strongest thing they hold decides it.
            .sort((a, b) => b.requiredOrdinal - a.requiredOrdinal)
            .some(art => couldFlyOnTheirOwnBlade({
                realmOrdinal: cultivator.realmOrdinal,
                known: held.map(t => ({ id: t.id, subject: t.subject })),
                flightArt: {
                    id: art.id,
                    requiredOrdinal: art.requiredOrdinal,
                    subject: art.subject
                }
            }).can);

        if (carriesThem) {
            available.push({ conveyance: requireConveyance('conv-sword-flight'), power: null });
        }

        const here = this.worldPlaceOf(cultivator);
        for (const row of this.atHand?.objects ?? []) {
            // Held OR owned. `mintCraft` moors a craft rather than handing it
            // to somebody - a craft with a possessor is one `bestObjectHeldBy`
            // would arm them with - so reading `possessorId` alone meant that
            // even somebody who built one could not ride it.
            if (row.possessorId !== cultivator.id && row.ownerId !== cultivator.id) continue;
            // AND IT HAS TO BE WHERE THEY ARE: going with them, or left standing here, "unless you
            // fit it in a storage ring", which is taking it out first. See `a-vehicle.ts`.
            if (!isWithThem(row, cultivator.id, here)) continue;
            const kind = kindOfCraft(row);
            if (kind) available.push({ conveyance: kind, power: row.power, rowId: row.id });
        }

        // ── AND WHAT THEY SIMPLY HAVE ────────────────────────────────────
        //
        // The counted tier, which the note above correctly said nothing in
        // this engine counted for a person. Something does now: `buy` writes
        // it through `adjustCountedHolding` onto the player's own world row,
        // which is the same free-form `Record<string, number>` a house keeps
        // its yard in. No new field anywhere, and a person and a house answer
        // the question with the same four functions.
        for (const { conveyance } of countedConveyancesHeld(this.whatIsInTheirYard(cultivator))) {
            available.push({ conveyance, power: null });
        }

        return available;
    },

    /**
     * What this cultivator has of the counted conveyances, in the shape the
     * catalog's four functions read.
     */
    whatIsInTheirYard(this: GameService, cultivator: Cultivator): Record<string, number> {
        const yard: Record<string, number> = {};
        // `listPouch` is the ALCHEMY reader and filters to pills and herbs by
        // design; `listCarriedArtifacts` is the accessor for everything else
        // in the same table. Reading the wrong one is why a bought mule was a
        // row in the database that no sentence a player could type could see -
        // the same defect this file records having found twice before, once
        // for a granted artifact and once for a bought manual.
        for (const entry of listCarriedArtifacts(this.db, cultivator.id)) {
            const kind = CONVEYANCES.find(c => c.id === entry.itemId);
            if (!kind || kind.holding !== 'counted') continue;
            yard[countedHoldingKey(kind.id)] = entry.quantity;
        }
        return yard;
    },

    /**
     * Spend a journey and arrive, which is the half every one of these shares.
     */
    async arriveAfterSpending(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        days: number,
        arrivedAt: string
    ) {
        const spent = Math.max(1, Math.ceil(days));
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, spent, {
            seed: run.seed,
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: TRAVEL_FOCUS,
                ...this.rateTermsFor(cultivator),
                ground: this.groundFor(cultivator)
            },
            understanding: this.understandingFor(run, cultivator),
            rations: this.drawFromPack(cultivator, spent),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            ...daoHeartConditions(this.repos.db, cultivator, Math.floor(run.elapsedDays)),
            toll: tollConditionsFor(this.repos, cultivator)
        });

        this.putBackWhatWasNotEaten(cultivator, skip);
        const applied = applyTimeSkip(this.repos, {
            before: cultivator, run, skip, location: arrivedAt
        });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        // Standing somewhere is how a place stops being a rumour, and it is
        // also the only thing that gives a later fold a `stood` fix.
        this.noteEncounter(
            applied.cultivator, run, { kind: 'place', id: arrivedAt, name: arrivedAt },
            'witnessed', `Arrived on day ${Math.round(applied.run.elapsedDays)}.`
        );

        // AND WHOSE GROUND IT IS. The place and its holder are one arrival.
        noteWhoseGroundThisIs(this, applied.cultivator, run, arrivedAt);

        // AND WHO OF YOUR OWN IS STANDING ON IT. The third fact of an arrival,
        // which used to live only in `move` - so the same ground reached by
        // road introduced a disciple to their own house and the same ground
        // reached by fold, boat or passage introduced them to nobody.
        const introduced = whatArrivingIntroduces(this, applied.cultivator);

        return { skip, applied, world, ...introduced };
    },

    /**
     * Where this journey is going, or the refusal that says why it is nowhere.
     */
    whereThisJourneyGoes(
        this: GameService,
        cultivator: Cultivator,
        target: string | undefined,
        action: ActionName
    ): { name: string } | Execution {
        const named = resolvePlace(destinationNamed(target));
        // A HOUSE IS A DESTINATION ON EVERY ROAD, not only on foot. The same
        // redirect `move` makes: the roll decides whether the journey ends at
        // the seat or in the town below its gate.
        const house = this.atHand && named
            ? theHouseThisNameReaches(this.atHand, named.name)
            : null;
        const place = house ? resolvePlace(house.seat.name) ?? named : named;
        if (!place) {
            return refused('engine.resolvePlace', action, factsForRefusal(
                'Nowhere in particular.',
                `You get as far as the edge of ${placeName(cultivator)} before it occurs to you `
                + 'that you have not decided where you are going, and there is nothing out there '
                + 'obliging enough to decide it for you.'
                + andTheRoadsThatDoGoSomewhere(this, cultivator),
                'No destination named; location unchanged and no time passed.'
            ));
        }
        if (this.atHand && !this.somewhereReal(place.name, cultivator)) {
            return refused('engine.resolvePlace', action, factsForRefusal(
                'No road goes there.',
                `You ask after ${place.name} and get the look people give a name that is not a `
                + 'place.'
                + andTheRoadsThatDoGoSomewhere(this, cultivator),
                `Unresolved destination "${place.name}": matches no world location, no `
                + 'occupied place and nothing this cultivator has heard of. Location unchanged, '
                + 'no time passed.'
            ));
        }
        return { name: place.name };
    },

    // ─────────────────────────────────────────────────────────────────────
    // AND WHO ELSE IS GOING
    //
    // `who-is-on-the-road-with-you.ts` holds the argument for reading the party
    // off the companions' own activities rather than storing one. What belongs
    // here is the half that is about the four verbs, and it is short, because
    // two of the three pricing modules already had the answer:
    //
    //   `move`      everybody walks. A road is not a vehicle and has no
    //               capacity, so a party on foot costs what one person costs.
    //   `ride`      `priceJourney` takes `heads` and turns them into TRIPS
    //               against the conveyance's own capacity. A cart that holds
    //               four and a party of nine is three trips.
    //   `passage`   `quotePassageAtACounter` takes `heads` and charges the fare
    //               per head, and takes `worstPassengerOrdinal` because *a party
    //               arrives together and waits for the person the crossing was
    //               hardest on*. Both sentences are that module's, not this one's.
    //   `fold`      takes nobody. `CapabilityGrant.spatial_folding` says so in
    //               its own terms - one body, a volume budget of about a sword,
    //               *no companion and no passenger at any size*.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * The day a party's term is written and read on, which is the WORLD's.
     *
     * `NpcActivity.sinceDay` and `untilDay` are world-clock fields: the world's
     * own sendings write them off `WorldState.currentDay`, and the two passes
     * that read them - `bringHomeWhoeverIsDue` and `whatInternalAffairsNotices` -
     * are handed a world day. A term written on `Run.elapsedDays` is therefore
     * a term that ended before the run began.
     *
     * MEASURED: a fresh world opens at `currentDay` 365,000 and a run starts at
     * `elapsedDays` 0, so a party raised by the player was 364,600 days overdue
     * the moment it was written. The next world advance - inside the same turn -
     * brought everybody home and cleared the activity, and the player arrived
     * alone. Both played party tests were red on it.
     *
     * So no caller states a day. Every party method below takes the world's,
     * which is the only clock its readers use.
     */
    theDayAPartyIsOn(this: GameService): number | null {
        const world = this.atHand;
        return world ? Math.floor(world.currentDay) : null;
    },

    /**
     * Put named people on the road with this cultivator, for a term in days.
     *
     * The one producer today is the escort duty: a house asks a senior to take
     * juniors out, `Duty.takingOut` names them, and saying yes is what puts
     * them alongside. The activity written is the world sim's own - the same
     * shape `the-world-changing-on-its-own.ts` writes for a party it sends -
     * so `bringHomeWhoeverIsDue` ends the term and sends them back with nothing
     * added here.
     *
     * Returns the names actually put on the road, which is not always everybody
     * named: a duty can name somebody the world has no row for.
     */
    putThemOnTheRoadWithYou(
        this: GameService,
        cultivator: Cultivator,
        party: readonly { id: string; name: string }[],
        input: { note: string; forDays: number }
    ): string[] {
        const world = this.atHand;
        const today = this.theDayAPartyIsOn();
        if (!world || today === null || party.length === 0) return [];
        const changed = takeThemWithYou(world.npcs, {
            party,
            leaderId: cultivator.id,
            note: input.note,
            onDay: today,
            untilDay: today + Math.max(1, Math.trunc(input.forDays))
        });
        if (changed.length === 0) return [];
        for (const row of changed) {
            const at = world.npcs.findIndex(npc => npc.id === row.id);
            if (at >= 0) world.npcs[at] = row;
        }
        this.theWorldMoved();
        return namesOf(changed);
    },

    /** Everybody on the road with this cultivator today. */
    whoIsWithYouOnTheRoad(
        this: GameService,
        cultivator: Cultivator
    ): readonly NpcRecord[] {
        const today = this.theDayAPartyIsOn();
        if (!this.atHand || today === null) return [];
        return whoIsOnTheRoadWith(this.atHand.npcs, cultivator.id, today);
    },

    /**
     * The party, as a thing the engine can state.
     *
     * The same reading the travel verbs carry a party by, said rather than
     * used. `null` when nobody is with them, which is what keeps it off a
     * status read for the overwhelming majority of turns.
     */
    thePartyWithYou(
        this: GameService,
        cultivator: Cultivator
    ): { line: string; structure: string } | null {
        const today = this.theDayAPartyIsOn();
        if (today === null) return null;
        return whatThePartyIs(this.whoIsWithYouOnTheRoad(cultivator), today);
    },

    /**
     * Whether this person is already out with a party, and what else they are at.
     *
     * The one read a request to come along has to make before it can be put.
     * Both halves come off the SAME activity row the party reading uses, so
     * "they are already with somebody" and "they are on the road with you"
     * cannot disagree.
     */
    whereTheyAlreadyAre(
        this: GameService,
        personId: string
    ): {
        outWith: { withIds: readonly string[]; untilDay: number | null; note: string } | null;
        otherwiseAt: string | null;
        bringsAlong: { id: string; name: string }[];
    } {
        const npcs = this.atHand?.npcs ?? [];
        const today = this.theDayAPartyIsOn();
        const npc = today === null ? undefined : npcs.find(row => row.id === personId);
        if (!npc || today === null) return { outWith: null, otherwiseAt: null, bringsAlong: [] };
        const out = whoTheyAreOutWith(npc, today);
        const doing = npc.activity;
        return {
            outWith: out,
            otherwiseAt: out !== null || !doing
                ? null
                : whatThatLooksLike(doing, theNamesOf(npcs, doing.withIds)) || null,
            // ── AND SOMEBODY RAISING A PARTY BRINGS IT ───────────────────
            //
            // `ActivityKind.mustering` says somebody at this is somebody a
            // player can join, and no sentence reached one. Who has already
            // said yes is that activity's own `withIds`, which
            // `whatThatLooksLike` already prints as "and X have said yes".
            //
            // MEASURED, AND EMPTY: 11 to 14 musterers per pinned world and not
            // one of them has anybody on their party, because the draw writes
            // the activity with no `withIds` and the pairing pass skips them.
            // So this read is correct, costs nothing, and returns nothing until
            // the world fills the party in. `ActivityKind.mustering` carries
            // the measurement.
            bringsAlong: out !== null || doing?.kind !== MUSTERING
                ? []
                : npcs
                    .filter(row => doing.withIds.includes(row.id) && row.status === 'alive')
                    .map(row => ({ id: row.id, name: row.name }))
        };
    },

    /**
     * Move whoever is still on the road with them to where they have arrived.
     *
     * AFTER the world advance, not before, and that ordering is the whole of
     * how a term that ran out mid-journey is handled: `bringHomeWhoeverIsDue`
     * has already sent those people back to where they set out from, so they
     * are not on the road any more and do not arrive. Nothing here decides
     * that - the pass that brings every other party in the world home decides
     * it, and this reads the result.
     */
    theyArrivedWithYou(
        this: GameService,
        cultivator: Cultivator,
        arrivedAt: string
    ): { names: string[]; line: string; structure: string } | null {
        const world = this.atHand;
        const today = this.theDayAPartyIsOn();
        if (!world || today === null) return null;
        const place = worldLocationFor(world, arrivedAt);
        if (!place) return null;

        const moved = theyComeWithYou(world.npcs, {
            leaderId: cultivator.id,
            arrivedAt: place.id,
            onDay: today
        });
        if (moved.length === 0) return null;

        for (const row of moved) {
            const at = world.npcs.findIndex(npc => npc.id === row.id);
            if (at >= 0) world.npcs[at] = row;
        }
        this.theWorldMoved();

        const names = namesOf(moved);
        return {
            names,
            line: `${howMany(names.length, 'person')} came with you and `
                + `${names.length === 1 ? 'is' : 'are'} standing here: ${names.join(', ')}.`,
            structure:
                `who-is-on-the-road-with-you: ${names.length} moved to ${place.id} on day `
                + `${today}, read off their own out_with_a_party activity. No party record `
                + 'is stored anywhere.'
        };
    },

    /**
     * Where a journey to this name ends, which is not always the name.
     *
     * A PROVINCE IS A CONTAINER, AND NOBODY STANDS ON ONE. `populationWeightOf`
     * is zero for a region row and `npcsAt` treats one as a place nobody is,
     * so a player stored on it arrived in a province with nobody about in it
     * at all. Measured on `in-front-of-somebody-world`: `I travel to <province>`
     * then `I ask around about <house>` answered *"There is nobody about in The
     * Jade Gorge at all"* once the seeded travellers who had been stranded on
     * the region node were given somewhere to go - they had been the only people
     * who ever stood on it, and `seedSectGround`'s rule that a gate's name is had
     * by asking in the region had been answered by them alone.
     *
     * NOTHING ELSE ALREADY ANSWERS WHERE A PROVINCE'S ROAD COMES IN. No province
     * names a capital or a principal place, the catalog's place-to-place roads
     * never cross a border (0 of 42), and a prefecture's seat is per prefecture.
     * So the road ends at the most populous place in it that anybody could be
     * standing in, by the world's own measure of where people are:
     * `populationWeightOf`, over the settlements the world's own birthplace read
     * would count - not sealed, no bar on entering or surviving there. A house's
     * ground is NOT one of them: arriving in a province does not hand anybody a
     * gate, which is exactly what asking in it is for. Ties go to the order the
     * catalog lists its places in.
     *
     * Where the name is not a province, or no world is loaded, this is
     * `theWorldsNameFor` unchanged.
     */
    whereTheRoadEndsIn(this: GameService, place: string): { name: string; provinceName: string | null } {
        const name = this.theWorldsNameFor(place);
        const world = this.atHand;
        const row = world ? worldLocationFor(world, name) : null;
        if (!world || !row || row.kind !== 'region') return { name, provinceName: null };
        const town = theMostPeopledPlaceIn(world, row.id);
        return town ? { name: town.name, provinceName: row.name } : { name, provinceName: null };
    },

    /** The world's own name for somewhere, which is what gets stored. */
    theWorldsNameFor(this: GameService, place: string): string {
        const bare = (name: string) => name.replace(/^the\s+/i, '').toLowerCase();
        const worldRow = this.atHand ? worldLocationFor(this.atHand, place) : null;
        const asProvince = regionIdOfPlace(place)
            ? undefined
            : REGIONS.find(region => bare(region.name) === bare(place));
        return worldRow?.name ?? asProvince?.name ?? place;
    },

    /**
     * Going somewhere ON something.
     */
    async ride(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        wanted: string | undefined
    ): Promise<Execution> {
        const voyage = theVoyageUnderWay(this.repos.db, cultivator);
        if (voyage) return stillAtSea(voyage, 'ride');
        // A CARRIAGE OR A BOAT THAT IS NOT THEIRS is a seat at the counter here,
        // where one runs. A boat of their own is a spirit boat; a boat they do
        // not own, at a landing, is the ship.
        const service = theServiceNamed(wanted);
        if (service !== null
            && !this.whatTheyCouldRide(cultivator).some(a => OF_THEIR_OWN[service].has(a.conveyance.id))
            && whatRunsFromHere(this, cultivator, Math.floor(run.elapsedDays)).some(line => line.service === service)) {
            return aSeatOnAShipOrACarriage(this, run, cultivator, target, 'buy', service, wanted ?? '');
        }

        const going = this.whereThisJourneyGoes(cultivator, target, 'ride');
        if ('facts' in going) return going;

        const arrivedAt = this.whereTheRoadEndsIn(going.name).name;
        const road = this.daysOnTheRoadTo(cultivator, going.name);
        const walkingDays = road ?? SHORT_ACTION_DAYS;
        const available = this.whatTheyCouldRide(cultivator);

        // What the sentence ASKED for, where it named something, and what
        // actually suits the road. The two are reported separately and the
        // second is what happens: which conveyance is right for a road is an
        // answer the engine already owns, and `bestForThisRoad`'s whole
        // argument is that best is not fastest.
        const asked = wanted
            ? CONVEYANCES.find(c => c.name.toLowerCase().includes(wanted)
                || wanted.includes(c.name.toLowerCase().replace(/^an? /, '')))
            : undefined;
        // EVERYBODY WHO IS GOING, and `priceJourney` turns that into trips
        // against the conveyance's own capacity. Read before the journey,
        // because a party is what decides which conveyance is the right one.
        const withYou = this.whoIsWithYouOnTheRoad(cultivator);
        const heads = 1 + withYou.length;

        // A SPIRIT BOAT ANSWERS ONLY TO ITS DRIVER. The owner: the rank is "specifically the DRIVER",
        // and "you can ride in it at any rank". The player drives it at that rank; otherwise the
        // highest of those going who is at it takes the helm, and everybody else rides. Asked for
        // by name with nobody to drive it, it says so; otherwise it is simply not what goes.
        const driver: { name: string; ordinal: number } | null =
            cultivator.realmOrdinal >= A_SPIRIT_BOAT_ANSWERS_TO
                ? { name: 'You', ordinal: cultivator.realmOrdinal }
                : withYou
                    .filter(person => person.cultivation.realmOrdinal >= A_SPIRIT_BOAT_ANSWERS_TO)
                    .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal)
                    .map(person => ({ name: person.name, ordinal: person.cultivation.realmOrdinal }))[0] ?? null;
        if (driver === null && asked && itWantsAPilot(asked) && available.some(a => a.conveyance.id === asked.id)) {
            return refused('engine.priceJourney', 'ride', factsForRefusal(
                'Nobody here can drive it.',
                `${asked.name} answers only to a driver at ${rankName(A_SPIRIT_BOAT_ANSWERS_TO)} or above. `
                + 'Anybody may ride in it, but you are not at that rank, and nobody going with you is. '
                + 'Nothing is spent, and it does not lift.',
                `ride: ${asked.id} wants a driver at ordinal ${A_SPIRIT_BOAT_ANSWERS_TO}; the player is at `
                + `${cultivator.realmOrdinal} and nobody going reaches it. Location unchanged, no time passed.`));
        }
        const flyable = available.filter(a => driver !== null || !itWantsAPilot(a.conveyance));

        const chosen = (asked && flyable.some(a => a.conveyance.id === asked.id)
            ? flyable.find(a => a.conveyance.id === asked.id)!
            : bestForThisRoad(flyable, walkingDays, heads))
            ?? flyable[0] ?? available[0];
        // NOTHING THAT GOES ON GROUND GOES OVER WATER: a mount or a cart to open water is a ship
        // from the landing, as walking is. See `the-way-there-is-by-ship.ts`.
        if (!chosen.conveyance.crossesGroundThatCannotBeWalked) {
            const byShip = theWayThereIsByShip(this, cultivator, arrivedAt, Math.floor(run.elapsedDays));
            if (byShip) {
                return goingByShipInstead(this, run, cultivator, byShip,
                    landing => this.move(run, cultivator, this.ambientFor(cultivator, run), landing, 'travel'));
            }
        }

        const journey = priceJourney({
            walkingDays,
            conveyance: chosen.conveyance,
            power: chosen.power,
            heads
        });
        // THE CHEST BURNS SPIRIT STONES, and they are the rider's. The owner: "you burn spirit
        // stones as fuel". Priced here all along (`whatTheChestBurns`) and never taken, so a spirit
        // boat flew for nothing.
        if (journey.stonesBurned > cultivator.spiritStones) {
            return refused('engine.priceJourney', 'ride', factsForRefusal(
                'Not enough to fly on.',
                `${chosen.conveyance.name} burns ${journey.stonesBurned} spirit stones on this road, and you `
                + `carry ${cultivator.spiritStones}. Nothing is spent, and it does not lift.`,
                `ride: ${chosen.conveyance.id} burns ${journey.stonesBurned} over ${journey.daysOneWay} day(s), `
                + `heads ${heads}, trips ${journey.trips}; purse ${cultivator.spiritStones}. Location unchanged, no time passed.`));
        }
        // Ridden, it goes with them, whether it was going with them already or left standing here.
        const rowId = available.find(a => a.conveyance.id === chosen.conveyance.id && a.power === chosen.power)?.rowId;
        const ridden = rowId ? this.atHand?.objects.find(o => o.id === rowId) : undefined;
        if (ridden && this.atHand) takeItAlong(this.atHand.objects, ridden, cultivator.id);

        const { skip, applied, world, perceived, structure: introducedBy, lines: atTheGate } =
            await this.arriveAfterSpending(
                run, cultivator, journey.daysOneWay, arrivedAt
            );
        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);
        const nights = A_ROOF_ON_THE_ROAD.has(chosen.conveyance.id) ? 'under_a_roof' as const : 'in_the_open' as const;
        // Taken as a delta once the days are spent, so nothing the road wrote is undone by it.
        const burned = journey.stonesBurned > 0
            ? this.repos.cultivators.applyDeltas(applied.cultivator.id, { spiritStones: -journey.stonesBurned })
            : null;

        const lines: string[] = [
            `${chosen.conveyance.name}, from ${placeName(cultivator)} to ${arrivedAt}.`,
            ...(burned
                ? [`${journey.stonesBurned} spirit stones burned in its chest on the way; ${burned.spiritStones} left in the purse.`]
                : []),
            road === null
                ? 'Nothing in the catalog prices a road inside one province, so this is the '
                    + 'short journey everything else in the game is: a day, and the day is spent.'
                : `${road} days of road, covered in ${journey.daysOneWay}.`
                    + (journey.daysSavedAgainstWalking > 0
                        ? ` ${journey.daysSavedAgainstWalking} saved against walking it.`
                        : ' Nothing saved: this is what walking costs.'),
            journey.arrivalReads
        ];
        if (driver && itWantsAPilot(chosen.conveyance)) {
            lines.push(driver.name === 'You'
                ? 'You drive it yourself.'
                : `${driver.name} drives it; ${withYou.length > 1 ? 'the rest of you ride' : 'you ride'}.`);
        }
        if (journey.wrongToolNote) lines.push(journey.wrongToolNote);
        // WHAT IT HOLDS AGAINST HOW MANY ARE GOING. `priceJourney` also returns
        // `daysForEverybody` for this, and it is NOT spent here: `conv-on-foot`
        // declares `heads: 1` like everything else, so the same arithmetic
        // charges five people walking nine days for a one-day road. The capacity
        // is a true fact about the thing and is said; the extra legs are an open
        // question against that module rather than a number invented here.
        if (journey.trips > 1) {
            lines.push(
                `${chosen.conveyance.name} holds ${howMany(chosen.conveyance.heads, 'person')}. `
                + `There are ${heads} of you, so it goes back for the rest: `
                + `${howMany(journey.trips, 'trip')}.`
            );
        }
        if (asked && !available.some(a => a.conveyance.id === asked.id)) {
            lines.push(
                `There is no ${asked.name.toLowerCase()} to be had here. What the road got `
                + `instead is ${chosen.conveyance.name.toLowerCase()}, and it is what they have.`
            );
        }
        lines.push(...applied.tollLines, ...world.lines);

        const came = this.theyArrivedWithYou(applied.cultivator, arrivedAt);
        if (came) lines.push(came.line);

        lines.push(...atTheGate);
        const facts = factsForToolResult(
            `${arrivedAt}, on ${chosen.conveyance.name.toLowerCase()}.`, lines
        );
        if (came) facts.required = [...(facts.required ?? []), came.line];
        // ── WHAT ARRIVING SOMEWHERE MAKES THE PLAYER READ VERBATIM ───────
        //
        // NOT THE GATE'S DESCRIPTION. Every line the gate produced used to be
        // `required`, so a model that had already narrated the arrival had a
        // dozen clerk lines stapled underneath it - "Outside the wall there is
        // a town", "looks at people from rung 0 up", "The wall is a wall."
        // Reported from a played run, and it is the LLM-mode rule: `required`
        // carries what the player must read EXACTLY, and colour about a house
        // you can see from the road is not that.
        //
        // The lines stay on `facts.lines`, so the narrator has every one of
        // them and writes the gate from them. What a narrator may not drop is
        // a DECISION, and arriving somewhere is not one - `way` is read where
        // somebody walks up and asks.
        facts.structure.push(
            `priceJourney: ${chosen.conveyance.id} at power ${chosen.power ?? 'none'}, `
            + `${walkingDays} walking day(s) -> ${journey.daysOneWay}; `
            + `saved ${journey.daysSavedAgainstWalking}; heads ${heads}, `
            + `trips ${journey.trips}; `
            + `available ${available.map(a => a.conveyance.id).join(', ')}.`,
            ...world.structure,
            ...introducedBy,
            ...(came ? [came.structure] : [])
        );

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'engine.priceJourney',
                    action: 'ride',
                    summary:
                        `${chosen.conveyance.name} over ${walkingDays} walking day(s): `
                        + `${journey.daysOneWay} day(s), ${journey.daysSavedAgainstWalking} saved. `
                        + `Ambient qi at ${arrivedAt} is ${ambientAfter}.`,
                    ok: true
                },
                ...skipCalls('ride', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ],
            // The same three facts an arrival on foot grants. See
            // `whatArrivingIntroduces`.
            perceived,
            nights
        };
    },

    /**
     * Stepping across the distance instead of covering it.
     */
    async fold(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        const going = this.whereThisJourneyGoes(cultivator, target, 'fold');
        if ('facts' in going) return going;

        const arrivedAt = this.whereTheRoadEndsIn(going.name).name;

        // ── A FOLD TAKES NOBODY, AND IT IS THE GRANT THAT SAYS SO ────────
        //
        // Not a rule about parties. `CapabilityGrant.spatial_folding` states
        // its own terms - one body and what that body is carrying, against a
        // volume budget of about a sword, *no companion and no passenger at any
        // size* - and this is the first caller in a position to be told no by
        // it. Refused rather than resolved with the party left behind: which
        // one of those is right is a design question (`OPEN-QUESTIONS.md`),
        // and stepping out of the world in front of the juniors you were told
        // to escort is not a thing to do to somebody by default.
        const withYou = this.whoIsWithYouOnTheRoad(cultivator);
        if (withYou.length > 0) {
            return refused('engine.priceFold', 'fold', factsForRefusal(
                'A fold takes one body.',
                whyAFoldLeavesThemStanding(withYou),
                `${withYou.length} on the road with ${cultivator.id} `
                + `(${withYou.map(npc => npc.id).join(', ')}). spatial_folding carries no `
                + 'passenger. Location unchanged, no time passed.'
            ));
        }

        const road = this.daysOnTheRoadTo(cultivator, going.name);
        // A road inside one province is unpriced rather than free, and a fold
        // across one is a reach of under a day. Charged at the floor, and said
        // out loud rather than quoted as a saving.
        const walkingDays = road ?? 1;
        const held = grantsHeldWith(cultivator.realmOrdinal, brokenStatusesOn(cultivator.injuries));

        // The fix, before the range, because a fold with nowhere to aim is not
        // a distance problem.
        //
        // `FoldFix` HAS A SECOND MEMBER AND IT IS MEANT TO HAVE NO PRODUCER
        // HERE. `seen` was tried, derived from the sight horizon, and measured
        // wrong: the horizon dwarfs the fold range at every rung on the curve -
        // 78.7 days of sight against 6.0 of reach at the floor - so every
        // destination inside a fold's range is inside the horizon, the check is
        // a no-op, and anybody above the floor has a fix on every name they
        // have ever heard. `getting-there-without-walking-it.test.ts` pins it
        // and says so, and the module names it as the third fix it forbids.
        // Anything that wants to produce `seen` has to be a narrower fact than
        // "high enough to see that far".
        const stage = this.knowledge.stageOf(cultivator.id, 'place', arrivedAt);
        const fix: FoldFix | null =
            stageRank(stage) >= stageRank('encountered') ? 'stood' : null;

        if (fix === null && held.includes(FOLD_GRANT)) {
            return refused('engine.priceFold', 'fold', factsForRefusal(
                'They know the name and not the place.',
                `You have the word ${arrivedAt} and nothing else - somebody said it to you, or `
                + 'you read it off a board. A fold is not a survey: what it needs is ground you '
                + 'have stood on, and being told about somewhere is not the same kind of fact. '
                + 'The road is open, as it is to everybody.',
                `No FoldFix for "${arrivedAt}": knowing stage ${stage}, which is below `
                + 'encountered - the rung standing somewhere writes and nothing else does. '
                + 'No time passed.'
            ));
        }

        const cost = priceFold({
            ordinal: cultivator.realmOrdinal,
            heldGrants: held,
            walkingDays,
            fix: fix ?? 'stood'
        });

        if (!cost.canFoldAtAll || !cost.withinRange) {
            return refused('engine.priceFold', 'fold', factsForRefusal(
                cost.canFoldAtAll ? 'Too far, in one step.' : 'Space does not fold for them.',
                `${cost.reason}`,
                `priceFold: range ${cost.rangeDays.toFixed(1)} day(s) at ordinal `
                + `${cultivator.realmOrdinal} (floor ${FOLD_FLOOR_ORDINAL}, `
                + `grant ${held.includes(FOLD_GRANT) ? 'held' : 'not held'}), `
                + `road ${walkingDays} day(s). Location unchanged, no time passed.`
            ));
        }

        const { skip, applied, world, perceived, structure: introducedBy, lines: atTheGate } =
            await this.arriveAfterSpending(
                run, cultivator, cost.daysSpent, arrivedAt
            );
        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);

        const lines: string[] = [
            cost.reason,
            cost.arrivalReads,
            road === null
                ? 'Nothing prices a road inside one province, so nothing was saved that anybody '
                    + 'can put a number to. What it cost is the settling, and that is real.'
                : `${howMany(cost.daysSavedAgainstWalking, 'day')} saved against the ${road} on the road.`,
            ...applied.tollLines,
            ...world.lines
        ];

        lines.push(...atTheGate);
        const facts = factsForToolResult(`${arrivedAt}, in one step.`, lines);
        // ── WHAT ARRIVING SOMEWHERE MAKES THE PLAYER READ VERBATIM ───────
        //
        // NOT THE GATE'S DESCRIPTION. Every line the gate produced used to be
        // `required`, so a model that had already narrated the arrival had a
        // dozen clerk lines stapled underneath it - "Outside the wall there is
        // a town", "looks at people from rung 0 up", "The wall is a wall."
        // Reported from a played run, and it is the LLM-mode rule: `required`
        // carries what the player must read EXACTLY, and colour about a house
        // you can see from the road is not that.
        //
        // The lines stay on `facts.lines`, so the narrator has every one of
        // them and writes the gate from them. What a narrator may not drop is
        // a DECISION, and arriving somewhere is not one - `way` is read where
        // somebody walks up and asks.
        facts.structure.push(
            `priceFold: fix ${fix}, range ${cost.rangeDays.toFixed(1)} day(s), `
            + `road ${walkingDays}, settling ${cost.settlingDays}, short by ${cost.landsShortBy}, `
            + `spent ${cost.daysSpent}, saved ${cost.daysSavedAgainstWalking}.`,
            ...world.structure,
            ...introducedBy
        );

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'engine.priceFold',
                    action: 'fold',
                    summary:
                        `Folded ${walkingDays} walking day(s) on a ${fix} fix, inside a reach of `
                        + `${cost.rangeDays.toFixed(1)}. ${cost.daysSpent} day(s) spent, `
                        + `${cost.daysSavedAgainstWalking} saved. Ambient qi at ${arrivedAt} is `
                        + `${ambientAfter}.`,
                    ok: true
                },
                ...skipCalls('fold', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ],
            // The same three facts an arrival on foot grants. See
            // `whatArrivingIntroduces`.
            perceived
        };
    },

    /**
     * A counter, a board, and a place on somebody else's span.
     */
    async passage(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string,
        /** Which counter, where the sentence named a ship or a carriage. */
        topic?: string
    ): Promise<Execution> {
        // Aboard, a seat to where the ship is bound is the ship sailing on; see `a-ship-at-sea.ts`.
        const voyage = theVoyageUnderWay(this.repos.db, cultivator);
        if (voyage) {
            return (target ?? '').trim().length === 0 || loosePlaceKey(target ?? '') === loosePlaceKey(voyage.bound)
                ? aShipSailsOn(this, run, cultivator, voyage, null, 'carrying_on')
                : stillAtSea(voyage, 'passage');
        }
        const here = standingOf(cultivator);
        const counter = counterPlaceNameAt(placeName(cultivator));
        const today = Math.floor(run.elapsedDays);
        const rate = localPrice(here.regionId, SPAN_CASH_PER_WALKED_DAY);

        // A SHIP OR A CARRIAGE is bought at its own counter: whenever the sentence
        // names one, and where the Span keeps no counter and a line here goes
        // where the sentence asked. Anything else is still the Span's.
        const service = theServiceNamed(topic);
        const runsFromHere = counter === null ? whatRunsFromHere(this, cultivator, today) : [];
        if (service !== null
            || (target !== undefined && theLineTo(runsFromHere, target, null) !== null)) {
            return aSeatOnAShipOrACarriage(this, run, cultivator, target, intent, service, topic ?? '');
        }

        if (counter === null) {
            return refused('engine.boardAt', 'passage', factsForRefusal(
                'The house keeps no counter here.',
                'There is no board to read and nobody at a desk to read it to you. The Measured '
                + 'Span runs from the ground it runs from, and this is not any of it - which is '
                + 'not the house being unhelpful, it is where an inherited survey stops.'
                + (runsFromHere.length > 0
                    ? ` What does run from here: ${runsFromHere.map(line => `${line.to} by ${line.service}`).join(', ')}.`
                    : ''),
                `No Span counter at "${placeName(cultivator)}". The house keeps `
                + `${SPAN_ROUTES.length} route(s), from `
                + `${[...new Set(SPAN_ROUTES.map(r => r.fromPlace))].join(', ')}. `
                + 'No time passed.'
            ));
        }

        const board = boardAt(counter, SPAN_ROUTES, rate, today);

        // ── THE DISCOVERABILITY HALF, AND IT RUNS BEFORE ANYTHING ELSE ───
        //
        // Written whichever step this is, because standing at a board and
        // reading it is what happened either way, and somebody who buys a
        // ticket has certainly read the line they bought.
        const learned: string[] = [];
        for (const line of board.lines) {
            const isNew = this.noteEncounter(
                cultivator, run, { kind: 'place', id: line.toPlace, name: line.toPlace },
                'read',
                `On the board at ${counter} on day ${today}: `
                + `${line.walkedDaysItReplaces} days of road, ${line.fareCash} cash.`
            );
            if (isNew) {
                learned.push(
                    `${line.toPlace} was a word you did not have this morning. It is on a board `
                    + 'with a distance and a price beside it, which is as much as anybody ever '
                    + 'gets about somewhere they have not been.'
                );
            }
        }

        const wanted = (target ?? '').trim();
        const route = wanted.length >= 2 ? routeTo(counter, wanted) : null;

        if (intent !== 'buy' || route === null) {
            const lines: string[] = [
                `The board at ${counter}.`,
                ...board.lines.map(line =>
                    `${line.toPlace} - ${line.walkedDaysItReplaces} days of road, `
                    + `${line.fareCash} cash, `
                    + (line.openToday
                        ? 'running today'
                        : `next departure day ${line.nextDepartureDay ?? 'unstated'}`)
                    + (line.inheritedTerminal
                        ? '. One of the nine, and the house did not build it.'
                        : '. The house folds this one itself.')),
                board.limits
            ];
            if (wanted.length >= 2 && route === null && intent === 'buy') {
                lines.push(
                    `Nothing on this board goes to ${wanted}. That is not a refusal and it is `
                    + 'not a price: it is the end of the survey.'
                );
            }
            lines.push(...learned);

            const facts = factsForToolResult(
                `${counter}: ${board.running} route${board.running === 1 ? '' : 's'}.`, lines
            );
            facts.structure.push(
                `boardAt: ${counter}, ${board.running} route(s), fare rate ${rate} cash per `
                + `walked day replaced, on day ${today}. Every destination noted at 'read', `
                + 'which reaches `placed` and is what makes a province legal to travel to.'
            );
            return this.freeAction(run, 'passage', facts);
        }

        // ── AND BUYING ONE ───────────────────────────────────────────────
        //
        // A FARE EACH, AND THE PARTY WAITS FOR THE WORST OF THEM. Both are
        // `quotePassageAtACounter`'s own answers - the fare is `walked * heads`
        // and the settling is read off `worstPassengerOrdinal` because *a party
        // arrives together and waits for the person the crossing was hardest
        // on*. Nothing here decides either; this only stops asserting that the
        // player is travelling alone.
        const withYou = this.whoIsWithYouOnTheRoad(cultivator);
        const quote = quotePassageAtACounter(route, {
            heads: 1 + withYou.length,
            worstPassengerOrdinal: theSlowestOfThem(cultivator.realmOrdinal, withYou),
            cashPerWalkedDayReplaced: rate,
            onDay: today
        });
        const stones = Math.max(1, Math.ceil(cashToStones(quote.fareCash)));

        if (cultivator.spiritStones < stones) {
            return refused('engine.quotePassageAtACounter', 'passage', factsForRefusal(
                'The fare is the fare.',
                `${route.toPlace} is ${quote.fareCash} cash, which is ${stones} spirit stones, `
                + `and you are carrying ${cultivator.spiritStones}. The clerk does not argue `
                + 'and does not offer a second figure. What the house sells is priced by true '
                + 'distance off a table nobody outside it can check, and it is the same figure '
                + 'for everybody standing at this counter.',
                `quotePassageAtACounter: ${route.id} at ${quote.fareCash} cash (${stones} stones) `
                + `against a purse of ${cultivator.spiritStones}. No time passed.`
            ));
        }

        this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -stones });
        const paid = this.repos.cultivators.getById(cultivator.id)!;
        const arrivedAt = this.whereTheRoadEndsIn(route.toPlace).name;

        const { skip, applied, world, perceived, structure: introducedBy, lines: atTheGate } =
            await this.arriveAfterSpending(
                run, paid, Math.max(1, quote.daysSpent), arrivedAt
            );
        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);

        const lines: string[] = [
            `${counter} to ${route.toPlace}. ${quote.fareCash} cash, ${stones} spirit stones.`,
            quote.openToday
                ? 'It was running today, and the crossing itself is an hour.'
                : `It was not running. You waited for day ${quote.nextDepartureDay ?? today}, `
                    + 'because a span is held open at a cost and is not standing open all year.',
            quote.settlingDays > 0
                ? `${howMany(quote.settlingDays, 'day')} afterwards are not much use to anybody. Being `
                    + 'moved through space you do not understand is rough, and how rough is how '
                    + 'little you understand it.'
                : 'You rode it easily. At this rung the fare is the whole of what it costs.',
            `${howMany(quote.daysSavedAgainstWalking, 'day')} saved against the `
            + `${route.walkedDaysItReplaces} on the road.`,
            quote.notCovered,
            ...(withYou.length > 0
                ? [`${howMany(quote.heads, 'place')} bought, not one. The clerk counts heads and `
                    + `the fare is ${quote.fareCash} cash for the lot of you.`]
                : []),
            ...learned,
            ...applied.tollLines,
            ...world.lines
        ];

        const came = this.theyArrivedWithYou(applied.cultivator, arrivedAt);
        if (came) lines.push(came.line);

        lines.push(...atTheGate);
        const facts = factsForToolResult(`${route.toPlace}, through the span.`, lines);
        if (came) facts.required = [...(facts.required ?? []), came.line];
        // ── WHAT ARRIVING SOMEWHERE MAKES THE PLAYER READ VERBATIM ───────
        //
        // NOT THE GATE'S DESCRIPTION. Every line the gate produced used to be
        // `required`, so a model that had already narrated the arrival had a
        // dozen clerk lines stapled underneath it - "Outside the wall there is
        // a town", "looks at people from rung 0 up", "The wall is a wall."
        // Reported from a played run, and it is the LLM-mode rule: `required`
        // carries what the player must read EXACTLY, and colour about a house
        // you can see from the road is not that.
        //
        // The lines stay on `facts.lines`, so the narrator has every one of
        // them and writes the gate from them. What a narrator may not drop is
        // a DECISION, and arriving somewhere is not one - `way` is read where
        // somebody walks up and asks.
        facts.structure.push(
            `quotePassageAtACounter: ${route.id}, fare ${quote.fareCash} cash at ${rate} per `
            + `walked day for ${quote.heads} head(s), ${quote.settlingDays} settling day(s) at `
            + `ordinal ${theSlowestOfThem(cultivator.realmOrdinal, withYou)} - the worst of the `
            + `party, not the player's ${cultivator.realmOrdinal} - (folding floor `
            + `${FOLD_FLOOR_ORDINAL}), `
            + `${quote.daysSpent} day(s) spent, ${quote.daysSavedAgainstWalking} saved. `
            + `Witnessed by ${THE_SPAN_HOUSE_ID}.`,
            ...world.structure,
            ...introducedBy,
            ...(came ? [came.structure] : [])
        );

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'engine.quotePassageAtACounter',
                    action: 'passage',
                    summary:
                        `${route.id}: ${stones} stones, ${quote.daysSpent} day(s), `
                        + `${quote.daysSavedAgainstWalking} saved. Ambient qi at ${arrivedAt} `
                        + `is ${ambientAfter}.`,
                    ok: true
                },
                ...skipCalls('passage', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ],
            // The same three facts an arrival on foot grants. See
            // `whatArrivingIntroduces`.
            perceived
        };
    },

    /**
     * A paid seat or a hired carriage, ridden to its end or to where a band stopped it.
     *
     * The fare is paid first. The road's encounters roll as they do on foot and
     * the escort reads them (`an-escort-on-the-road.ts`): a band that withdraws is
     * a line, and a band big enough to take the escort on is a fight, played with
     * its leader and the rest said (`theRestOfTheFight`). A carriage fare includes
     * board, so the pack is not opened. The nights are under a roof.
     *
     * A ship sails `sea`, a voyage, for `days` of it: its hull's rations first and
     * then the pack. Short of port, stopped or not, the passenger is at sea on it
     * (`a-ship-at-sea.ts`), and a stop that cost the crew turns it back where that
     * is still the shorter way.
     */
    async takeTheSeat(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        trip: {
            service: AService;
            to: string;
            days: number;
            walkingDays: number;
            stones: number;
            escort: number;
            bought: string;
            /** A ship's voyage, as it stood when these days began. */
            sea?: AVoyage;
            /** How much of the days goes to cultivation; travel by default. */
            focus?: number;
        }
    ): Promise<Execution> {
        const voyage = trip.sea ?? null;
        const paid = trip.stones > 0
            ? this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -trip.stones }) ?? cultivator
            : cultivator;
        const from = voyage?.from ?? placeName(paid);
        const startDay = Math.floor(run.elapsedDays);
        const ambient = this.ambientFor(paid, run);
        const rolled = encountersFor(
            { repos: this.repos, knowledge: this.knowledge, world: this.atHand },
            {
                seed: run.seed,
                startDay,
                days: trip.days,
                activity: 'travel',
                cultivator: paid,
                rollIdentity: PLAYER_ROLL_IDENTITY,
                comingForYou: accountsComingDue(this, paid)
            }
        );
        const met = whatTheEscortMet(rolled, trip.escort);
        const attacking = met.attacking;
        // WHO FIGHTS WHOM. The player fights the leader where the gap lets them,
        // and the rest is fought around the vehicle; where it does not, the whole
        // escort meets the whole band and the vehicle drives on if it held.
        const theyFightYou = attacking !== null && attacking.confrontation?.engageable === true;
        const vehicle = trip.service;
        const theRest = attacking
            ? theRestOfTheFight(this, run, attacking, trip.escort, ambient, vehicle, theyFightYou)
            : null;
        const stoppedBy = attacking && (theyFightYou || !theRest!.escortHeld) ? attacking : null;
        const lived = stoppedBy
            ? Math.max(1, Math.min(trip.days, stoppedBy.absoluteDay - startDay))
            : trip.days;
        const happened = cutTo(met.roll, startDay, lived);
        // THE HULL FEEDS THE DAYS IT WAS LOADED FOR, counted from the quay, and
        // the pack the rest: its share goes into the belly day for day, so a
        // passage sailed a few days at a time is fed no more than one sailed at once.
        const perRation = daysPerRation(paid.realmOrdinal, paid.injuries);
        const hullDays = voyage ? Math.min(lived, Math.max(0, voyage.hullRationDays - voyage.sailed)) : 0;
        const hullFeeds = Number.isFinite(perRation) && perRation > 0 ? Math.ceil(hullDays * SATIETY_MAX / perRation) : 0;
        const withTheBand = withEncounterDeltas(paid, happened);
        const setOut = hullFeeds > 0
            ? { ...withTheBand, satiety: Math.min(SATIETY_MAX, withTheBand.satiety + hullFeeds) }
            : withTheBand;
        const packRations = voyage ? this.drawFromPack(paid, lived) : 0;
        const skip = simulateTimeSkip(setOut, lived, {
            seed: run.seed,
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(paid),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: trip.focus ?? TRAVEL_FOCUS,
                ...this.rateTermsFor(paid),
                ground: this.groundFor(paid)
            },
            understanding: this.understandingFor(run, paid),
            rations: packRations,
            grainAbstinence: !voyage,
            autoBreakthrough: false,
            randomEvents: true,
            spanIsASitting: false,
            ...daoHeartConditions(this.repos.db, paid, startDay),
            toll: tollConditionsFor(this.repos, paid)
        });
        const packLeft = Math.min(packRations, skip.endState.rationsRemaining);
        if (voyage) this.putBackWhatWasNotEaten(paid, { endState: { rationsRemaining: packLeft } });
        const sailed = (voyage?.sailed ?? 0) + skip.simulatedDays;
        const arrived = !skip.died && stoppedBy === null && skip.simulatedDays >= lived
            && (voyage === null || sailed >= voyage.days);
        // SHORT OF PORT IS AT SEA. See `a-ship-at-sea.ts`.
        const crewLost = theRest !== null && !theRest.escortHeld;
        const onward = voyage && !skip.died && !arrived ? theVoyageAfter(voyage, sailed, crewLost) : null;
        const atSea = onward ? theWaterUnder(onward.voyage) : null;
        const applied = applyTimeSkip(this.repos, {
            before: setOut, run, skip, ...(arrived ? { location: trip.to } : atSea ? { location: atSea } : {})
        });
        if (onward && atSea) writeTheVoyage(this.repos.db, cultivator.id, onward.voyage);
        else if (voyage) endTheVoyage(this.repos.db, cultivator.id);
        const fed = skip.died || voyage
            ? applied.cultivator
            : this.repos.cultivators.applyDeltas(applied.cultivator.id, {
                satiety: SATIETY_MAX - applied.cultivator.satiety,
                starvationTurns: -applied.cultivator.starvationTurns
            }) ?? applied.cultivator;
        const world = await this.advanceWorld(skip.simulatedDays, fed, applied.run);
        const onTheWay = recordEncounters(this.knowledge, fed, applied.run.elapsedDays, happened, this.repos);
        const rationsLeft = everythingInThePouch(this.db, fed.id)
            .find(entry => entry.kind === 'ration')?.quantity ?? 0;
        const whatWasEaten = voyage
            ? whatTheHullFed(fed, voyage.hullRationDays, sailed, packRations - packLeft, rationsLeft)
            : whatWasEatenOnBoard(fed, rationsLeft);

        const lines: string[] = [trip.bought];
        for (const band of met.withdrew) {
            if (band.absoluteDay > startDay + skip.simulatedDays) continue;
            lines.push(`A band of ${band.confrontation?.count ?? 1} on the road watched the ${vehicle} and its `
                + `guards go by on day ${Math.max(1, band.absoluteDay - startDay)}, and withdrew.`);
        }
        if (attacking && theRest && !skip.died) {
            lines.push(`A band of ${attacking.confrontation?.count ?? 1} attacked the ${vehicle} on day `
                + `${Math.max(1, Math.min(skip.simulatedDays, attacking.absoluteDay - startDay))}.`
                + (theyFightYou ? ` Its leader came at you.` : ''),
                ...theRest.lines);
        }
        const calls = [{
            name: 'engine.takeTheSeat',
            action: 'passage' as const,
            summary: `${vehicle} from ${from} to ${trip.to}: ${trip.stones} stone(s), ${skip.simulatedDays} of `
                + `${trip.days} day(s), escort ${trip.escort}, ${met.withdrew.length} band(s) withdrew`
                + `${attacking ? `, a band of ${attacking.confrontation?.count ?? 1} attacked` : ''}.`,
            ok: true
        }, ...skipCalls('passage', skip, null), ...tollCalls(applied.tollLines), ...worldCalls(world)];

        if (arrived) {
            this.noteEncounter(
                fed, run, { kind: 'place', id: trip.to, name: trip.to },
                'witnessed', `Arrived on day ${Math.round(applied.run.elapsedDays)}.`
            );
            noteWhoseGroundThisIs(this, fed, run, trip.to);
            const introduced = whatArrivingIntroduces(this, fed);
            lines.push(
                !voyage
                    ? `${howMany(skip.simulatedDays, 'day')} by ${vehicle} from ${from} to ${trip.to}, `
                        + `${howMany(trip.walkingDays, 'day')} on foot.`
                    : from === trip.to
                        ? `${howMany(sailed, 'day')} at sea, and back into ${trip.to}.`
                        : `${howMany(sailed, 'day')} by ship from ${from} to ${trip.to}, `
                            + `against the ${howMany(voyage.quoted, 'day')} quoted.`,
                whatWasEaten,
                ...onTheWay.lines, ...applied.tollLines, ...world.lines
            );
            const came = this.theyArrivedWithYou(fed, trip.to);
            if (came) lines.push(came.line);
            lines.push(...introduced.lines);
            const facts = factsForToolResult(`${trip.to}, by ${vehicle}.`, lines);
            if (came) facts.required = [...(facts.required ?? []), came.line];
            facts.structure.push(
                `takeTheSeat: ${vehicle}, escort ${trip.escort}, ${met.withdrew.length} band(s) withdrew; `
                + (voyage
                    ? `hull rations for ${voyage.hullRationDays} of ${sailed} day(s), `
                        + `${packRations - packLeft} ration(s) from the pack, nights under a roof.`
                    : 'fed on board, nights under a roof.'),
                ...onTheWay.structure, ...world.structure, ...introduced.structure,
                ...(came ? [came.structure] : [])
            );
            return {
                facts, events: skip.events, timeSkip: skip, breakthrough: null, outcome: 'executed',
                calls, perceived: introduced.perceived, nights: 'under_a_roof'
            };
        }

        const facts = factsForTimeSkip(paid, fed, skip, ambient, voyage ? 'Sailing' : 'Travel', trip.days);
        if (onward) lines.push(whatWasEaten);
        facts.lines.unshift(...lines);
        facts.prose = [...lines, facts.prose].join('\n\n');
        facts.lines.push(...onTheWay.lines, ...world.lines);
        facts.structure.push(...onTheWay.structure, ...world.structure);
        const halted: Execution = {
            facts, events: skip.events, timeSkip: skip, breakthrough: null, outcome: 'executed',
            calls, nights: 'under_a_roof'
        };
        if (onward) {
            const where = whereTheShipIs(onward.voyage);
            const crew = !crewLost ? []
                : onward.turnedBack
                    ? [`The crew did not hold the ship. It turns back for ${onward.voyage.bound}, the shorter way.`]
                    : ['The crew did not hold the ship. It is past the middle of the passage and goes on.'];
            for (const said of [...crew, where].reverse()) sayThisFirstWhateverTheNarratorDoes(facts, said);
            if (stoppedBy) {
                sayThisFirstWhateverTheNarratorDoes(facts, `The ship to ${voyage!.bound} stopped on day `
                    + `${sailed} of ${voyage!.days}. You are aboard, at sea.`);
            }
            facts.structure.push(`takeTheSeat: at sea, ${sailed} of ${onward.voyage.days} day(s) sailed, `
                + `bound for ${onward.voyage.bound}, crew ${onward.voyage.crew}.`);
        }
        if (!stoppedBy || skip.died) return halted;

        if (!voyage) {
            // A CARRIAGE STOPPED ON THE ROAD leaves the road to walk.
            const walked = Math.min(trip.walkingDays - 1,
                Math.max(1, Math.round(skip.simulatedDays * trip.walkingDays / trip.days)));
            if (trip.walkingDays > 1) {
                writeFlag(this.repos.db, cultivator.id, FLAG_ROAD_STOPPED, JSON.stringify({
                    to: trip.to, from, road: trip.walkingDays, walked
                } satisfies StoppedRoad));
            }
            sayThisFirstWhateverTheNarratorDoes(facts, `The ${vehicle} to ${trip.to} stopped on day `
                + `${skip.simulatedDays} of ${trip.days}. You are not there`
                + `; the rest of the road is ${humanDays(trip.walkingDays - walked)} on foot.`);
        }
        if (!theyFightYou) return halted;
        const cameAt = theyCameAtYou(this, applied.run, fed, ambient, {
            ...happened, occurrences: [stoppedBy], firstInterruptDay: stoppedBy.absoluteDay
        }, true);
        return cameAt ? foldTheFightIn(halted, cameAt) : halted;
    },

    /**
     * WHAT THIS CULTIVATOR ACTUALLY KNOWS ABOUT A HOUSE THEY NAMED.
     *
     * Null when the name is not a house they have heard of, which is the ordinary
     * case and the one the plain refusal is for.
     *
     * `told` is the thing that makes the refusal worth reading: a bill on the wall
     * here is how most players hear of a house at all, and it is what they are
     * really asking about when they say the name back. Re-read rather than
     * remembered, because the wall is a pure function of the place and the day.
     */
    whatTheyKnowOfThisHouse(
        this: GameService,
        named: string,
        cultivator: Cultivator,
        run: Run
    ): { name: string; told: string | null } | null {
        const scope = {
            gate: this.knowledge, holderId: cultivator.id, here: placeName(cultivator)
        };
        const house = resolveSect(this.repos, named, scope, null);
        if (house === null) return null;

        // What the paper here says about them, where there is paper about them.
        const wall = readTheWall(this.knowledge, cultivator, run);
        const about = wall.lines.find((line: string) => line.includes(house.name)) ?? null;
        return { name: house.name, told: about };
    },

    /**
     * Whether there is anybody here at all to give somebody a look.
     *
     * A refusal that describes bystanders on ground the same turn reported as empty
     * is the engine contradicting itself inside one screen.
     */
    anybodyElseHere(this: GameService, cultivator: Cultivator): boolean {
        return this.present(cultivator).some(row => row.id !== cultivator.id);
    }
};
