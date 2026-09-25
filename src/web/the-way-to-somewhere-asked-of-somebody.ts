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
import { REGIONS, requireRegion } from '../data/cultivation/regions.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import {
    howMuchOfTheRoadALifeHasSeen,
    theRoadAnUpbringingSaw,
    whatSomebodyKnowsOfTheLand
} from '../engine/world/what-somebody-knows-of-the-land.js';
import { theHouseNamed } from './asking-to-be-let-in-at-a-gate.js';
export { asksTheWay, THE_WAY_TO, theWayAskedFor } from './asking-the-way.js';

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

/** "in this province", or the province and the days of road to it. */
function howFar(fromRegionId: string, toRegionId: string | null): string {
    if (toRegionId === null) return 'somewhere they cannot put a province to';
    if (toRegionId === fromRegionId) return 'in this province';
    const to = REGIONS.find(region => region.id === toRegionId);
    const days = requireRegion(fromRegionId).connections
        .filter(link => link.otherRegionId === toRegionId)
        .map(link => link.travelDays)
        .sort((a, b) => a - b)[0];
    return `in ${to?.name ?? 'another province'}, ${to?.bearing ? `to the ${to.bearing}, ` : ''}`
        + (days !== undefined ? `${days} days on the road` : 'with no road they can put days to');
}

export function theWayTo(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    asked: RosterEntry,
    where: string
): Execution {
    const world = game.atHand;
    const knownAlready = game.knowledge.isAwareOf(cultivator.id, 'cultivator', asked.id);
    const who = knownAlready ? asked.name : 'The one nearest to hand';
    const them = world?.npcs.find(row => row.id === asked.id) ?? null;

    const house = theHouseNamed(game, where);
    const key = loosePlaceKey(where);
    const place = house ? house.seat
        : world?.locations.find(row => loosePlaceKey(row.name) === key) ?? null;
    const name = house?.factionName ?? place?.name ?? where;
    const called = house && !/^the\s/i.test(name) ? `the ${name}` : name;

    const land = world
        ? whatSomebodyKnowsOfTheLand(world, {
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
        })
        : null;
    const stage: 'placed' | 'named' | null =
        house
            ? (asked.sectId === house.factionId ? 'placed'
                : land?.houses.find(row => row.id === house.factionId)?.stage ?? null)
            : place
                ? (them?.locationId === place.id ? 'placed'
                    : land?.places.find(row => loosePlaceKey(row.name) === key)?.stage ?? null)
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
        const here = standingOf(cultivator).regionId;
        lines.push(house
            ? `${who} gives the way to ${called}: its gate is at ${place.name}, `
                + `${howFar(here, provinceOf(game, place.id))}.`
            : `${who} gives the way to ${name}: ${howFar(here, provinceOf(game, place.id))}.`);
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
