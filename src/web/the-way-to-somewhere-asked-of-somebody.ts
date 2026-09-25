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
import { placeRoadDays, REGIONS, theRoadBetweenProvinces } from '../data/cultivation/regions.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import type { WorldState } from '../engine/world/world-state.js';
import {
    A_HOUSE_HEARD_OF_AT_HOME,
    A_HOUSE_SEEN_GROWING_UP,
    howMuchOfTheRoadALifeHasSeen,
    theRoadAnUpbringingSaw,
    whatSomebodyKnowsOfTheLand,
    whoAmongThemKnowsTheWay,
    whoAmongThemKnowsTheWayToAPlace,
    type WhatTheyKnowOfTheLand,
    type WhoTheyAre
} from '../engine/world/what-somebody-knows-of-the-land.js';
import { theHouseNamed } from './asking-to-be-let-in-at-a-gate.js';
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
    /** The walk inside one province, off the catalog's own roads, where it has one. */
    daysInside: number | null = null
): string {
    if (toRegionId === null) return 'somewhere they cannot put a province to';
    if (toRegionId === fromRegionId) return `in this province${daysInside !== null ? `, ${daysInside} ${daysInside === 1 ? 'day' : 'days'} on the road` : ''}`;
    const to = REGIONS.find(region => region.id === toRegionId);
    const road = theRoadBetweenProvinces(fromRegionId, toRegionId);
    const through = (road?.through ?? []).map(id => REGIONS.find(region => region.id === id)?.name)
        .filter((name): name is string => !!name);
    return `${isTheProvince ? '' : `in ${to?.name ?? 'another province'}, `}${to?.bearing ? `to the ${to.bearing}, ` : ''}`
        + (road ? `${road.days} days on the road${through.length > 0 ? ` through ${through.join(' and ')}` : ''}`
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

/** Who somebody standing here is, as far as what they know of the land goes. */
function whoTheyAreOf(world: Pick<WorldState, 'locations' | 'npcs'>, asked: RosterEntry): WhoTheyAre {
    const them = world.npcs.find(row => row.id === asked.id) ?? null;
    return {
        id: asked.id,
        from: world.locations.find(row => row.id === (them?.locationId ?? null))?.name ?? asked.location,
        ordinal: asked.realmOrdinal,
        house: asked.sectId ? { id: asked.sectId, rankIndex: them?.factionRankIndex ?? 0 } : null,
        ...(them
            ? {
                travelled: Math.max(
                    theRoadAnUpbringingSaw(them.identity.origin),
                    howMuchOfTheRoadALifeHasSeen(them.identity.occupation)
                )
            }
            : {})
    };
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
    const house = theHouseNamed(game, where);
    const place = house ? null : thePlaceNamed(world, where);
    const found = house
        ? whoAmongThemKnowsTheWay(world, here, people, house.factionId)
        : place ? whoAmongThemKnowsTheWayToAPlace(world, here, people, place.name) : -1;
    const asked = present[found] ?? present[present.length - 1]!;
    return theWayTo(game, run, cultivator, asked, where, found >= 0);
}

export function theWayTo(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    asked: RosterEntry,
    where: string,
    /** Asked of a crowd, and somebody in it has been: see `theWayAskedOfTheCrowd`. */
    somebodyHereHasBeen = false
): Execution {
    const world = game.atHand;
    const knownAlready = game.knowledge.isAwareOf(cultivator.id, 'cultivator', asked.id);
    const who = knownAlready ? asked.name : somebodyHereHasBeen ? 'Somebody here' : 'The one nearest to hand';
    const them = world?.npcs.find(row => row.id === asked.id) ?? null;

    const house = theHouseNamed(game, where);
    const place = house ? house.seat : thePlaceNamed(world ?? null, where);
    const name = house?.factionName ?? place?.name ?? where;
    const called = house && !/^the\s/i.test(name) ? `the ${name}` : name;

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

    const calls: ToolCallRecord[] = [{
        name: 'engine.theWayTo',
        action: 'talk',
        summary: `Asked ${asked.name} the way to "${where}": ${stage ?? 'unknown to them'}. `
            + 'Read off what they know of the land.',
        ok: true
    }];
    const lines: string[] = [];
    if (stage === 'placed' && place) {
        const standing = standingOf(cultivator);
        const here = standing.regionId;
        const inside = placeRoadDays(standing.placeName ?? cultivator.location, place.name);
        lines.push(house
            ? `${who} gives the way to ${called}: its gate is at ${place.name}, `
                + `${howFar(here, provinceOf(game, place.id), false, inside)}.`
            : `${who} gives the way to ${name}: ${howFar(here, provinceOf(game, place.id), place.kind === 'region', inside)}.`);
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
    } else {
        lines.push(`${who} does not know where ${called} is.`);
    }

    const facts = factsForToolResult(`${knownAlready ? asked.name : 'Somebody'}, asked the way to ${name}.`, lines);
    const execution = game.freeAction(run, 'interact', facts);
    execution.calls = calls;
    return execution;
}
