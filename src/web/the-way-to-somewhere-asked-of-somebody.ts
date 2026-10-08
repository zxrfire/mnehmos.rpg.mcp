import { quotePublicPassage } from '../engine/world/public-shipping.js';
import { whatRunsFromHere, stonesFor } from './a-seat-on-a-ship-or-a-carriage.js';
import { quotePublicCarriage } from '../engine/world/public-carriages.js';
import { boardAt, quotePassageAtACounter } from '../engine/world/buying-passage-at-a-measured-span-counter.js';
import { SPAN_ROUTES, SPAN_CASH_PER_WALKED_DAY, counterPlaceNameAt } from '../engine/world/where-the-measured-span-still-answers.js';
import { humanDays } from '../engine/encounters/how-a-task-is-worded.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { worldLocationFor } from './entities.js';
import { betweenRoadEndpoints, stoppedRoadFor } from './a-road-stopped-partway.js';
/**
 * "Where would I find X?" put to a person is answered with the way there, from
 * what THEY know: `placed` gives the gate and the road, `named` gives the name
 * and says they do not know the road, and anything else they cannot say.
 *
 * Played: "Duan Shuping, where would I find the Tranquil Oasis Sect?" was
 * answered with the house's alignment and rank titles, and a name dropped with
 * it sent the player to the wrong house. Nothing here drops a name.
 */

import type { Cultivator, Run } from '../schema/cultivation.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { GameService } from './turn-engine.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import { factsForToolResult, placeName } from './facts.js';
import { loosePlaceKey } from './knowledge.js';
import { placeRoadBetween, localPrice, REGIONS, theRoadBetweenProvinces } from '../data/cultivation/regions.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import type { WorldState } from '../engine/world/world-state.js';
import {
    A_HOUSE_HEARD_OF_AT_HOME,
    A_HOUSE_SEEN_GROWING_UP,
    whatSomebodyKnowsOfTheLand,
    whoAmongThemKnowsTheWay,
    whoAmongThemKnowsTheWayToAPlace,
    PROVINCIAL_CAPITALS,
    type WhatTheyKnowOfTheLand
} from '../engine/world/what-somebody-knows-of-the-land.js';
import { theHouseNamed } from './asking-to-be-let-in-at-a-gate.js';
import { whoTheyAreOf } from '../engine/world/who-knows-the-land.js';
export { aCrowdIsAsked, asksTheWay, THE_WAY_TO, theWayAskedFor } from './asking-the-way.js';

/** The province a world row stands in, off its parents, as a catalog region id. */
function provinceOf(game: GameService, locationId: string | null): string | null {
    const locations = game.atHand?.locations ?? [];
    const byId = new Map(locations.map(row => [row.id, row]));
    for (let row = locationId ? byId.get(locationId) : undefined, steps = 0; row && steps < 12; steps++) {
        if (row.kind === 'region') return row.id.replace(/^loc-/, '');
        row = row.parentId ? byId.get(row.parentId) : undefined;
    }
    return null;
}

/**
 * "in this province", or the province, the days of road to it and the provinces it crosses on the
 * way. Said of the province itself, it is only the road.
 */
function howFar(
    fromRegionId: string,
    toRegionId: string | null,
    isTheProvince = false,
    /** The actual walking distance when the canonical route reader can price it. */
    daysInside: number | null = null
): string {
    if (toRegionId === null) return 'somewhere they cannot put a province to';
    if (toRegionId === fromRegionId) return `in this province${daysInside !== null ? `, ${daysInside} ${daysInside === 1 ? 'day' : 'days'} on the road` : ''}`;
    const to = REGIONS.find(region => region.id === toRegionId);
    const road = theRoadBetweenProvinces(fromRegionId, toRegionId);
    const through = (road?.through ?? []).map(id => REGIONS.find(region => region.id === id)?.name)
        .filter((name): name is string => !!name);
    return `${isTheProvince ? '' : `in ${to?.name ?? 'another province'}, `}${to?.bearing ? `to the ${to.bearing}, ` : ''}`
        + (road ? `${daysInside ?? road.days} days on the road${through.length > 0 ? ` through ${through.join(' and ')}` : ''}`
            : 'with no road they can put days to');
}

/**
 * The world row a name asks after, loosely: "white stairs" is the White Stair. A plural said of a
 * singular name is the commonest slip in asking the way.
 */
function thePlaceNamed(world: Pick<WorldState, 'locations'> | null, where: string) {
    const key = loosePlaceKey(where);
    const rows = world?.locations ?? [];
    return rows.find(row => loosePlaceKey(row.name) === key)
        ?? rows.find(row => loosePlaceKey(row.name) === key.replace(/s$/, ''))
        ?? null;
}

/**
 * What somebody here knows of the land, and for whoever raised the player, every house the player
 * grew up hearing of too: it was at home they heard it. Played blind: the opening had the player
 * raised on tales of the Azure Dew Sect, and the man who raised them, asked where it was, had
 * never heard of it.
 */
export function whatThisPersonKnowsOfTheLand(
    game: GameService,
    playerId: string,
    world: Pick<WorldState, 'locations' | 'factions' | 'npcs'>,
    asked: RosterEntry
): WhatTheyKnowOfTheLand {
    const land = whatSomebodyKnowsOfTheLand(world, whoTheyAreOf(world, asked));
    const raisedThem = game.knowledge.awareness(playerId, 'cultivator')
        .some(row => row.id === asked.id && /raised you/.test(row.statement));
    if (!raisedThem) return land;
    const known = new Set(land.houses.map(house => house.id));
    const heardAtHome = game.knowledge.awareness(playerId, 'sect')
        .filter(row => row.sourceKind === 'told' && !known.has(row.id)
            // The birth's own rows are day 0; the upbringing's are marked.
            && (row.acquiredOnDay === 0 || row.sourceNote === A_HOUSE_SEEN_GROWING_UP
                || row.sourceNote === A_HOUSE_HEARD_OF_AT_HOME))
        .map(row => ({ id: row.id, name: row.name, stage: 'named' as const }));
    return { ...land, houses: [...land.houses, ...heardAtHome] };
}


/**
 * The way somewhere, put to everybody standing here: whoever of them knows it answers, and past
 * that the size of the place decides whether somebody here has been. The owner: "AT LEAST 1
 * PERSON OUGHT TO KNOW THE WAY", and "going further to the provincial capital will basically
 * guarantee it". Null when nobody is here to ask.
 */
export function theWayAskedOfTheCrowd(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    where: string
): Execution | null {
    const world = game.atHand;
    const present = game.present(cultivator);
    if (!world || present.length === 0) return null;
    const people = present.map(asked => whoTheyAreOf(world, asked));
    const here = standingOf(cultivator).placeName ?? cultivator.location;
    const roadQuestion = /^(?:this|the) road(?: ahead)?$/i.test(where);
    const cursor = roadQuestion ? stoppedRoadFor(game.db, cultivator, world) : null;
    const house = roadQuestion ? null : theHouseNamed(game, where);
    const place = cursor ? thePlaceNamed(world, cursor.to) : house ? null : thePlaceNamed(world, where);
    const found = house
        ? whoAmongThemKnowsTheWay(world, here, people, house.factionId)
        : place ? whoAmongThemKnowsTheWayToAPlace(world, here, people, place.name) : -1;
    const asked = present[found] ?? present[present.length - 1]!;
    const answered = theWayTo(game, run, cultivator, asked, where, found >= 0);
    // AND WHERE SOMEBODY WOULD KNOW, where nobody here does. Played blind: a fish-market town did
    // not know the road to a house a province away, which is the rule, and the player was left
    // with nowhere to take the question. "going further to the provincial capital will basically
    // guarantee it", so the capital is named where it would.
    if (found < 0) {
        const capital = PROVINCIAL_CAPITALS[standingOf(cultivator).regionId];
        const somebodyThere = [{ id: 'somebody-in-the-capital', from: capital ?? null, ordinal: 0 }];
        const knownThere = capital && capital !== here && (house
            ? whoAmongThemKnowsTheWay(world, capital, somebodyThere, house.factionId) >= 0
            : place ? whoAmongThemKnowsTheWayToAPlace(world, capital, somebodyThere, place.name) >= 0 : false);
        if (knownThere) {
            const line = `Nobody here knows the road to it. In ${capital}, somebody would.`;
            answered.facts.lines.push(line);
            answered.facts.prose = `${answered.facts.prose}\n\n${line}`;
        }
    }
    return answered;
}

export function theWayTo(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    asked: RosterEntry,
    where: string,
    /** Asked of a crowd, and somebody in it has been: see `theWayAskedOfTheCrowd`. */
    somebodyHereHasBeen = false,
    registerTurn = true
): Execution {
    const world = game.atHand;
    const knownAlready = game.knowledge.isAwareOf(cultivator.id, 'cultivator', asked.id);
    const who = knownAlready ? asked.name : somebodyHereHasBeen ? 'Somebody here' : 'The one nearest to hand';
    const them = world?.npcs.find(row => row.id === asked.id) ?? null;

    const roadQuestion = /^(?:this|the) road(?: ahead)?$/i.test(where);
    const cursor = roadQuestion ? stoppedRoadFor(game.db, cultivator, world) : null;
    const house = roadQuestion ? null : theHouseNamed(game, where);
    const place = cursor ? thePlaceNamed(world ?? null, cursor.to)
        : house ? house.seat : roadQuestion ? null : thePlaceNamed(world ?? null, where);
    let name = roadQuestion ? 'the road ahead' : house?.factionName ?? place?.name ?? where;

    const land = world ? whatThisPersonKnowsOfTheLand(game, cultivator.id, world, asked) : null;
    const stage: 'placed' | 'named' | null =
        somebodyHereHasBeen && (house || place) ? 'placed'
        : house
            ? (asked.sectId === house.factionId ? 'placed'
                : land?.houses.find(row => row.id === house.factionId)?.stage ?? null)
            : place
                ? (them?.locationId === place.id ? 'placed'
                    : land?.places.find(row => row.name === place.name)?.stage ?? null)
                : null;
    if (roadQuestion && stage !== null && place) name = place.name;
    const called = house && !/^the\s/i.test(name) ? `the ${name}` : name;

    // A local public venue is common knowledge even to somebody who never rode.
    // Asking its way does not silently disclose every advertised destination.
    const hereName = standingOf(cultivator).placeName ?? cultivator.location;
    const bareHub = (word: string) => word.trim().toLowerCase().replace(/^the\s+/, '');
    const localHub = !place && land?.publicHubs?.find(hub => hub.place === hereName
        && bareHub(hub.name) === bareHub(where));
    if (localHub) {
        const facts = factsForToolResult('The local public counter.', [
            `${who} gives the way to ${localHub.name}, here at ${hereName}.`
        ]);
        const answer = game.freeAction(run, 'interact', facts, registerTurn);
        answer.calls = [{ name: 'engine.theWayTo', action: 'talk', ok: true,
            summary: `Asked ${asked.name} for ${localHub.name}: public local venue, no travel-experience requirement.` }];
        return answer;
    }

    const calls: ToolCallRecord[] = [{
        name: 'engine.theWayTo',
        action: 'talk',
        summary: `Asked ${asked.name} the way to "${where}": ${stage ?? 'unknown to them'}. `
            + 'Read off what they know of the land.',
        ok: true
    }];
    const lines: string[] = [];
    const localOffering = !betweenRoadEndpoints(game.db, cultivator) && !!place
        && land?.publicHubs?.some(hub => hub.place === hereName && hub.destinations.includes(place.name)) === true;
    if ((stage === 'placed' || localOffering) && place) {
        const standing = standingOf(cultivator);
        const here = standing.regionId;
        const inside = game.daysOnTheRoadTo(cultivator, place.name);
        const direct = placeRoadBetween(standing.placeName ?? cultivator.location, place.name);
        lines.push(house
            ? `${who} gives the way to ${called}: its gate is at ${place.name}, `
                + `${howFar(here, provinceOf(game, place.id), false, inside)}.`
            : `${who} gives the way to ${name}: ${howFar(here, provinceOf(game, place.id), place.kind === 'region', inside)}.`);
        if (inside !== null) lines.push(`On foot from here: ${humanDays(inside)}.`);
        if (localOffering && world && hereName) {
            const from = worldLocationFor(world, hereName);
            const line = whatRunsFromHere(game, cultivator, world.currentDay)
                .find(row => row.service === 'carriage' && row.to === place.name);
            const roadQuote = from && line ? quotePublicCarriage(world, {
                fromId: from.id, toId: place.id, day: routineTime(world),
                conveyanceId: 'conv-carriage-mortal', passengerIds: [cultivator.id],
                fareStones: stonesFor(line.cashPerSeat), hired: false,
                playedPassenger: { id: cultivator.id, locationId: from.id, alive: cultivator.alive }
            }) : null;
            if (line && roadQuote) lines.push(`The carriage station offers ${place.name}: ${humanDays(line.days)}, ${roadQuote.fareStones} spirit stones a seat.`);
            else if (line) lines.push(`The advertised carriage to ${place.name} cannot take a booking now.`);
            const ship = whatRunsFromHere(game, cultivator, world.currentDay)
                .find(row => row.service === 'ship' && row.to === place.name);
            const shipQuote = from && ship ? quotePublicPassage(world, from.id, place.id,
                world.currentDay, 1, [], `${run.seed}:${Math.floor(run.elapsedDays)}`) : null;
            if (ship && shipQuote) lines.push(`The landing offers ${place.name}: about ${humanDays(ship.days)} at sea, ${shipQuote.fareStones} spirit stones a seat. Weather determines the actual crossing.`);
            else if (ship) lines.push(ship.runsFromDay !== null
                ? `The advertised ship to ${place.name} is next worked on day ${ship.runsFromDay}.`
                : `The advertised ship to ${place.name} cannot take a booking here now.`);
            const counter = counterPlaceNameAt(hereName);
            const rate = localPrice(standing.regionId, SPAN_CASH_PER_WALKED_DAY);
            const today = game.theDayAPartyIsOn() ?? Math.floor(run.elapsedDays);
            const listed = counter ? boardAt(counter, SPAN_ROUTES, rate, today).lines.find(row => row.toPlace === place.name) : null;
            const route = listed ? SPAN_ROUTES.find(row => row.id === listed.routeId) : null;
            if (counter && route) {
                const quote = quotePassageAtACounter(route, { heads: 1,
                    worstPassengerOrdinal: cultivator.realmOrdinal, cashPerWalkedDayReplaced: rate, onDay: today });
                lines.push(`The folding counter at ${counter} offers ${place.name}: ${quote.fareCash} cash for one passenger; the crossing itself is an hour.`);
                lines.push(quote.openToday ? 'The published span runs today.' : `The next published departure is day ${quote.nextDepartureDay}.`);
                lines.push(`Settling afterwards at your rung: ${humanDays(quote.settlingDays)}.`);
                lines.push(quote.notCovered);
            }
        }
        if (direct) lines.push(`${who} describes the way: ${direct.description}`);
        if (house && game.noteEncounter(cultivator, run,
            { kind: 'sect', id: house.factionId, name: house.factionName }, 'told',
            `${asked.name} gave the way to it at ${placeName(cultivator)}.`)) {
            calls.push({ name: 'knowledge.learn', action: 'house_told',
                summary: `${house.factionName} recorded as told, from ${asked.name}.`, ok: true });
        }
        if (game.noteEncounter(cultivator, run, { kind: 'place', id: place.id, name: place.name }, 'told',
            `${asked.name} gave the way to it at ${placeName(cultivator)}.`)) {
            calls.push({ name: 'knowledge.learn', action: 'gate_placed',
                summary: `${place.name} recorded as told, from ${asked.name}: they gave the way.`, ok: true });
        }
    } else if (stage === 'named') {
        lines.push(`${who} knows ${called} by name and says they do not know the road there.`);
        if (roadQuestion && place) game.knowledge.learnIfNew({holderId: cultivator.id,
            onDay: Math.floor(run.elapsedDays), kind: 'place', id: place.id, name: place.name,
            stage: 'named', sourceKind: 'told', fromHolderId: asked.id,
            sourceNote: asked.name + ' named the place but could not give its route.'});
    } else {
        lines.push(`${who} does not know where ${called} is.`);
    }

    const facts = factsForToolResult(roadQuestion ? 'Somebody here, asked where this road leads.'
        : `${knownAlready ? asked.name : 'Somebody'}, asked the way to ${name}.`, lines);
    const execution = game.freeAction(run, 'interact', facts, registerTurn);
    execution.calls = calls;
    return execution;
}
