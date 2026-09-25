/**
 * Whether the way somewhere is by ship, and from which landing.
 *
 * Played: at Sweet Spring Island, "I'm going to Silver Island" was walked, four days and four
 * nights in the open, after the person asked had just said four days' sail. A journey with an
 * end on open water (`openWater` in the catalog) is sailed, island to island included: the
 * Pearl Ocean's place connections are `road` only because that is the engine's `LinkKind`, and
 * every sea crossing in the catalog has an end on open water, so an end there is the whole test.
 *
 * The landing is the port from which ships reach the place (or, for somewhere inland, a port of
 * its province), the walk to it and the sailing counted together. `move` walks to it, or at it
 * says what the seat costs and who sells it; no ship leaves without a seat bought.
 *
 * A place on open water with no quay (a house's grounds, a ruin, a rock) is reached from the port
 * that serves it ({@link thePortThatServes}), and the short way between the two is the move it
 * always was. How that last stretch is crossed is not modelled.
 */

import { isOpenWater, placeRoadDays, regionIdOfPlace, requireRegion } from '../data/cultivation/regions.js';
import { regionCatalogIdOf } from '../engine/world/how-a-cultivator-comes-by-a-road.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { standingOf } from '../server/consolidated/where-a-cultivator-is-standing.js';
import { theCountersHere } from './a-room-at-an-inn.js';
import {
    sayTheLine,
    theBoothsHere,
    thePortsShipsPutInAt,
    theShipsFrom,
    type ALine
} from './a-seat-on-a-ship-or-a-carriage.js';
import { worldLocationFor } from './entities.js';
import { factsForRefusal, factsForToolResult, placeName, shownWithNoModelAfter } from './facts.js';
import { loosePlaceKey } from './knowledge.js';
import { refused } from './tool-result-prose.js';
import { SHORT_ACTION_DAYS } from './turn-constants.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { theKeeperAsTheyAreKnown, whoKeepsTheCounter } from './who-keeps-a-counter-here.js';

export interface TheWayByShip {
    bound: string;
    /** Where the ship is boarded; null where no ship reaches it from anywhere they could walk to. */
    landing: string | null;
    /** The first ship from the landing; null where the landing is itself the port that serves the place. */
    line: ALine | null;
}

/** The province a place is in, by the catalog or the world's row. */
function theProvinceOf(game: GameService, place: string): string | null {
    const named = regionIdOfPlace(place);
    if (named) return named;
    const row = game.atHand ? worldLocationFor(game.atHand, place) : null;
    return row && game.atHand ? regionCatalogIdOf(game.atHand, row.id) : null;
}

/**
 * The port a place on open water is reached from: its own name where it is a port, the port its
 * house holds for a house's grounds, the nearest port by the catalog's passages, and otherwise
 * the port the province's roads end at.
 */
function thePortThatServes(game: GameService, place: string, province: string): string | null {
    const ports = thePortsShipsPutInAt().filter(port => regionIdOfPlace(port) === province);
    const named = ports.find(port => loosePlaceKey(port) === loosePlaceKey(place));
    if (named || ports.length === 0) return named ?? null;
    const row = game.atHand ? worldLocationFor(game.atHand, place) : null;
    const house = row?.kind === 'sect_seat' ? (row.data as { factionId?: unknown }).factionId : null;
    const held = typeof house === 'string'
        ? requireRegion(province).places.find(one => one.heldByFactionId === house && ports.includes(one.name))
        : undefined;
    if (held) return held.name;
    const nearest = ports
        .map(port => ({ port, days: placeRoadDays(place, port) }))
        .filter((one): one is { port: string; days: number } => one.days !== null)
        .sort((a, b) => a.days - b.days || a.port.localeCompare(b.port))[0];
    if (nearest) return nearest.port;
    const chief = game.whereTheRoadEndsIn(requireRegion(province).name).name;
    return ports.find(port => loosePlaceKey(port) === loosePlaceKey(chief)) ?? ports[0]!;
}

/** The way to somewhere by ship, or null where it is walked. */
export function theWayThereIsByShip(
    game: GameService,
    cultivator: Cultivator,
    destination: string,
    today: number
): TheWayByShip | null {
    const here = placeName(cultivator);
    if (loosePlaceKey(here) === loosePlaceKey(destination)) return null;
    const fromProvince = theProvinceOf(game, here) ?? standingOf(cultivator).regionId;
    const toProvince = theProvinceOf(game, destination);
    if (!isOpenWater(fromProvince) && !isOpenWater(toProvince)) return null;

    const ports = thePortsShipsPutInAt();
    const isPort = (place: string) => ports.find(port => loosePlaceKey(port) === loosePlaceKey(place)) ?? null;
    const servesThere = isOpenWater(toProvince) ? thePortThatServes(game, destination, toProvince!) : null;
    const servesHere = isOpenWater(fromProvince) ? thePortThatServes(game, here, fromProvince) : null;
    // BETWEEN A PLACE WITH NO QUAY AND ITS PORT is the short way it always was.
    if (servesThere && loosePlaceKey(servesThere) === loosePlaceKey(here)) return null;
    if (servesHere && loosePlaceKey(servesHere) === loosePlaceKey(destination)) return null;
    const targets = servesThere ? [servesThere]
        : isOpenWater(toProvince) ? []
        : ports.filter(port => regionIdOfPlace(port) === toProvince);
    const starts = servesHere ? [{ port: servesHere, walk: isPort(here) ? 0 : SHORT_ACTION_DAYS }]
        : isOpenWater(fromProvince) ? []
        : ports.filter(port => !isOpenWater(regionIdOfPlace(port)))
            .map(port => ({ port, walk: game.daysOnTheRoadTo(cultivator, port) ?? SHORT_ACTION_DAYS }));

    // Every start at once, each port reached remembering the landing it was reached from.
    const best = new Map<string, { cost: number; landing: string; first: ALine | null }>();
    for (const start of starts) best.set(start.port, { cost: start.walk, landing: start.port, first: null });
    const settled = new Set<string>();
    for (;;) {
        let at: string | null = null;
        for (const [port, reached] of best) {
            if (!settled.has(port) && (at === null || reached.cost < best.get(at)!.cost)) at = port;
        }
        if (at === null) break;
        settled.add(at);
        const from = best.get(at)!;
        for (const line of theShipsFrom(at, today)) {
            const cost = from.cost + line.days;
            if (cost < (best.get(line.to)?.cost ?? Infinity)) {
                best.set(line.to, { cost, landing: from.landing, first: from.first ?? line });
            }
        }
    }
    const reached = targets
        .map(port => best.get(port))
        .filter((one): one is NonNullable<typeof one> => one !== undefined)
        .sort((a, b) => a.cost - b.cost)[0];
    return reached
        ? { bound: destination, landing: reached.landing, line: reached.first }
        : { bound: destination, landing: null, line: null };
}

function capitalised(said: string): string {
    return said.length > 0 ? `${said[0]!.toUpperCase()}${said.slice(1)}` : said;
}

/** Who sells the seats at the landing they stand at, as they would say it. */
function whoSellsTheSeats(game: GameService, cultivator: Cultivator): string {
    const keeper = whoKeepsTheCounter(game, cultivator, 'landing',
        [...theCountersHere(cultivator), ...theBoothsHere(game, cultivator)]);
    return keeper ? theKeeperAsTheyAreKnown(game, cultivator, keeper, 'landing') : 'the landing clerk';
}

/** What a move says at the landing: the seat, what it costs, and who sells it. No time passes. */
export function aSeatIsBoughtHere(game: GameService, run: Run, cultivator: Cultivator, way: TheWayByShip): Execution {
    const line = way.line!;
    const lines = [
        `The way to ${way.bound} is by ship, not on foot.`,
        sayTheLine(line),
        `${capitalised(whoSellsTheSeats(game, cultivator))} sells the seats at the landing here.`,
        ...(loosePlaceKey(line.to) === loosePlaceKey(way.bound) ? [] : [`From ${line.to} the way goes on to ${way.bound}.`])
    ];
    const facts = factsForToolResult(`${way.bound} is by ship.`, lines);
    facts.required = [...(facts.required ?? []), lines[0]!];
    facts.structure.push(`the-way-there-is-by-ship: ${way.bound} has an end on open water; `
        + `first ship ${placeName(cultivator)} to ${line.to}, ${line.days} day(s). No time passed.`);
    return game.freeAction(run, 'move', facts);
}

/** Said where no ship reaches a place from anywhere they could walk to. */
export function noShipGoesThere(way: TheWayByShip, from: string): Execution {
    return refused('engine.theWayThereIsByShip', 'move', factsForRefusal(
        `No ship goes to ${way.bound}.`,
        `${way.bound} is across open water, and no ship runs there from anywhere you could walk to from ${from}.`,
        `the-way-there-is-by-ship: no port reaches ${way.bound}. Location unchanged, no time passed.`
    ));
}

/** Said on reaching the landing a journey over water was walked to. */
export function theWayOnIsByShip(game: GameService, cultivator: Cultivator, walked: Execution, way: TheWayByShip): Execution {
    const at = game.repos.cultivators.getById(cultivator.id) ?? cultivator;
    const there = loosePlaceKey(placeName(at)) === loosePlaceKey(way.landing ?? '');
    const said = there
        ? `The way on to ${way.bound} is by ship from here; ${whoSellsTheSeats(game, at)} sells the seats at the landing.`
        : `The way to ${way.bound} is by ship from ${way.landing}, where the landing clerk sells the seats.`;
    shownWithNoModelAfter(walked.facts, said);
    walked.facts.required = [...(walked.facts.required ?? []), said];
    return walked;
}
