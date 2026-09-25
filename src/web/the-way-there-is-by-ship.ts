/**
 * Whether the way somewhere is by ship, and from which landing.
 *
 * Played: at Sweet Spring Island, "I'm going to Silver Island" was walked, four days and four
 * nights in the open, after the person asked had just said four days' sail. A journey with an
 * end on open water (`openWater` in the catalog) is sailed, island to island included: the
 * Pearl Ocean's place connections are `road` only because that is the engine's `LinkKind`, and
 * every sea crossing in the catalog has an end on open water, so an end there is the whole test.
 *
 * Every place on open water has its own dock (`where-a-ship-puts-in.ts`), so a ship sails to it
 * directly and nothing there is walked to. The landing is where the player boards: the dock they
 * stand at, or from somewhere inland the port on land the walk and the sailing together make
 * nearest. `move` walks to it, or at it says what the seat costs and who sells it; no ship leaves
 * without a seat bought.
 */

import { isOpenWater, regionIdOfPlace } from '../data/cultivation/regions.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { standingOf } from '../server/consolidated/where-a-cultivator-is-standing.js';
import { theCountersHere } from './a-room-at-an-inn.js';
import { sayTheLine, theBoothsHere, theShipsFrom, type ALine } from './a-seat-on-a-ship-or-a-carriage.js';
import { factsForRefusal, factsForToolResult, placeName, shownWithNoModelAfter } from './facts.js';
import { loosePlaceKey } from './knowledge.js';
import { refused } from './tool-result-prose.js';
import { SHORT_ACTION_DAYS } from './turn-constants.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { theKeeperAsTheyAreKnown, whoKeepsTheCounter } from './who-keeps-a-counter-here.js';
import { theDockOf, thePortsShipsPutInAt, theProvinceOf } from './where-a-ship-puts-in.js';

export interface TheWayByShip {
    bound: string;
    /** Where the ship is boarded; null where no ship reaches it from anywhere they could walk to. */
    landing: string | null;
    /** The first ship from the landing. */
    line: ALine | null;
}

/** The way to somewhere by ship, or null where it is walked. */
export function theWayThereIsByShip(
    game: GameService,
    cultivator: Cultivator,
    destination: string,
    today: number
): TheWayByShip | null {
    const world = game.atHand;
    const here = placeName(cultivator);
    if (loosePlaceKey(here) === loosePlaceKey(destination)) return null;
    const fromProvince = theProvinceOf(world, here) ?? standingOf(cultivator).regionId;
    const toProvince = theProvinceOf(world, destination);
    if (!isOpenWater(fromProvince) && !isOpenWater(toProvince)) return null;

    const ports = thePortsShipsPutInAt(world);
    const dockThere = theDockOf(world, destination);
    const dockHere = theDockOf(world, here);
    // Inside the same walls on open water is a walk across a compound, not a passage.
    if (dockThere && dockHere && loosePlaceKey(dockThere) === loosePlaceKey(dockHere)) return null;
    const targets = dockThere ? [dockThere]
        : isOpenWater(toProvince) ? []
        : ports.filter(port => regionIdOfPlace(port) === toProvince);
    const starts = dockHere ? [{ port: dockHere, walk: 0 }]
        : isOpenWater(fromProvince) ? []
        : ports.filter(port => !isOpenWater(theProvinceOf(world, port)))
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
        // A dock only the world names is a place to put in, not a stop on the way: its passages
        // are the unpriced flat day, and chaining them would undercut every priced one.
        if (from.first !== null && !regionIdOfPlace(at)) continue;
        for (const line of theShipsFrom(game, at, today)) {
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

/**
 * A journey whose way is by ship: no ship reaches it, or at the landing the seat is offered, or
 * the move walks to the landing and says the way on.
 */
export async function goingByShipInstead(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    way: TheWayByShip,
    walkToTheLanding: (landing: string) => Promise<Execution>
): Promise<Execution> {
    if (way.landing === null) return noShipGoesThere(way, placeName(cultivator));
    if (way.line && loosePlaceKey(way.landing) === loosePlaceKey(placeName(cultivator))) {
        return aSeatIsBoughtHere(game, run, cultivator, way);
    }
    return theWayOnIsByShip(game, cultivator, await walkToTheLanding(way.landing), way);
}
