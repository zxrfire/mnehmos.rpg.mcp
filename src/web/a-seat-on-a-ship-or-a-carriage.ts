/**
 * Ships from a landing and carriages from a station: what runs from here, what a seat or a whole carriage costs, and buying one.
 *
 * WHAT RUNS IS THE MAP'S. A ship runs the sea lanes (`SEA_LANES`), from each
 * named landfall to the other, in the months the lane is worked. A carriage runs
 * every `road` a place states (a `path` is ground nobody drives), and from the
 * town a province's roads come into, to the town of every province a land road
 * joins it to. Not the Measured Span, which is a house's folding service and is
 * `passage` at its own counters.
 *
 * WHAT IT COSTS IS THE BOARD'S. A ship seat is the board's sea passage a day
 * (deck passage where the lane has nowhere to stop) for the lane's expected days.
 * A carriage seat is the board's caravan passage, quoted per hundred li, at
 * {@link LI_WALKED_IN_A_DAY} li a walked day. Both at the local rate. A hired
 * carriage comes in the grades a station lets ({@link A_HIRED_CARRIAGE_BY_GRADE})
 * and costs every seat it holds, times the grade's figure. The fare includes
 * board, so the pack is not opened on the way.
 *
 * HOW FAST IS THE CATALOG'S. A carriage goes at its conveyance row's speed; a
 * ship takes the lane's own expected days.
 *
 * A SEAT CARRIES THE PASSENGER AND WHAT THEY CARRY ON THEIR PERSON. More than a
 * body can carry (a carcass, a heavy load) is refused a seat, and the answer is a
 * hired carriage, whose hold is `whatAVehicleHolds`.
 */

import { SEA_LANES } from '../data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { cashToStones, getPrice } from '../data/cultivation/mortal-world.js';
import {
    REGIONS,
    localPrice,
    placesNextTo,
    provinceRoadDays,
    regionIdOfPlace,
    requireRegion
} from '../data/cultivation/regions.js';
import { requireConveyance } from '../data/cultivation/what-a-house-moves-its-people-on.js';
import { whatAVehicleHolds } from '../engine/world/a-vehicle.js';
import {
    whatABodyCanCarry,
    whatAllOfThatTakes,
    whatStopsThemCarryingIt
} from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import { daysByConveyance } from '../engine/world/what-a-conveyance-does-to-a-journey.js';
import { laneIsOpenInMonth, type SeaLane } from '../engine/world/what-a-sea-crossing-costs.js';
import { together, whatTheirThingsTake } from '../engine/world/what-somebody-is-carrying-takes.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { everythingInThePouch } from '../server/consolidated/cultivation-support.js';
import { standingOf } from '../server/consolidated/where-a-cultivator-is-standing.js';
import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import { factsForRefusal, factsForToolResult, placeName } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { theKeeperAsTheyAreKnown, whoKeepsTheCounter, type ACounter } from './who-keeps-a-counter-here.js';
import { theCountersHere, theInnAsSeenHere } from './a-room-at-an-inn.js';

export type AService = 'ship' | 'carriage';

/** Li walked in a day, which turns the caravan's per-hundred-li fare into a fare a walked day. */
const LI_WALKED_IN_A_DAY = 60;

/** The conveyance a carriage seat rides in, whose speed is the catalog's. */
const THE_DRAWN_CARRIAGE = 'conv-carriage-mortal';

/**
 * The grades a station hires out, and what the whole carriage costs: every seat
 * it holds at the seat fare, times this. A named carriage is a house's and is
 * not let.
 */
const A_HIRED_CARRIAGE_BY_GRADE: readonly { conveyanceId: string; fareTimesItsSeats: number }[] = [
    { conveyanceId: 'conv-carriage-mortal', fareTimesItsSeats: 1 },
    { conveyanceId: 'conv-carriage-earth', fareTimesItsSeats: 2 }
];

/** Who rides with the vehicle and would fight for it: a coach's driver and guards, a hired carriage's driver and guard, a ship's crew. */
const THE_ESCORT = { seat_carriage: 3, hired_carriage: 2, ship: 4 } as const;

/** One line off the board. */
export interface ALine {
    service: AService;
    to: string;
    walkingDays: number;
    days: number;
    cashPerSeat: number;
    /** Null where it runs today; otherwise the first run day it does. */
    runsFromDay: number | null;
}

/** What a word in the sentence asks for. "Boat" at a landing is the ship, since no water boat exists. */
export function theServiceNamed(said: string | undefined): AService | null {
    const word = (said ?? '').toLowerCase();
    if (/\b(?:ships?|boats?|ferry|ferries|barges?|hulls?|landing)\b/.test(word)) return 'ship';
    if (/\b(?:carriages?|coach|coaches|carts?|wagons?|waggons?|station)\b/.test(word)) return 'carriage';
    return null;
}

/** The catalog place a lane's landfall names, where it names one. */
function theLandfall(named: string): string | null {
    const wanted = named.trim().toLowerCase();
    let best: string | null = null;
    for (const region of REGIONS) {
        for (const place of region.places) {
            const name = place.name.toLowerCase();
            if (name === wanted) return place.name;
            if (wanted.includes(name) && (best === null || name.length > best.length)) best = place.name;
        }
    }
    return best;
}

/** The run day's month, 1 to 12. */
function monthOf(day: number): number {
    const inTheYear = ((Math.floor(day) % 365) + 365) % 365;
    return Math.min(12, Math.floor(inTheYear / (365 / 12)) + 1);
}

/** The first day from today the lane is worked, or null where it never is. */
function whenTheLaneRuns(lane: SeaLane, today: number): number | null {
    for (let day = today; day < today + 366; day++) {
        if (laneIsOpenInMonth(lane, monthOf(day))) return day;
    }
    return null;
}

/** A seat's fare in cash, for this service and road, at the rate where they stand. */
function theSeatFare(regionId: string, service: AService, walkingDays: number, lane: SeaLane | null): number {
    if (service === 'ship') {
        const row = getPrice(lane && lane.intermediateLandfallDays.length === 0
            ? 'price-deck-passage-open-water'
            : 'price-sea-passage')!;
        return localPrice(regionId, row.cash) * (lane?.expectedDays ?? walkingDays);
    }
    const perHundredLi = localPrice(regionId, getPrice('price-caravan-passage')!.cash);
    return Math.round(perHundredLi * LI_WALKED_IN_A_DAY / 100) * walkingDays;
}

/** The inn, the landing and the carriage station as a look round sees them. */
export function theCountersAsSeenHere(game: GameService, cultivator: Cultivator, today: number): string[] {
    const inn = theInnAsSeenHere(game, cultivator);
    const runs = whatRunsFromHere(game, cultivator, today);
    const ships = runs.some(line => line.service === 'ship');
    const carriages = runs.some(line => line.service === 'carriage');
    return [
        ...(inn ? [inn] : []),
        ...(ships || carriages
            ? [`${ships && carriages ? 'Ships call here and carriages run from here' : ships ? 'Ships call here' : 'Carriages run from here'}; a clerk sells the seats.`]
            : [])
    ];
}

/**
 * Everything that runs from where they stand, ships first, nearest first.
 */
export function whatRunsFromHere(game: GameService, cultivator: Cultivator, today: number): ALine[] {
    const here = placeName(cultivator);
    const regionId = standingOf(cultivator).regionId;
    const lines: ALine[] = [];

    for (const lane of SEA_LANES) {
        const from = theLandfall(lane.fromPlace);
        const to = theLandfall(lane.toPlace);
        if (!from || !to) continue;
        const other = from === here ? to : to === here ? from : null;
        if (!other) continue;
        const runs = whenTheLaneRuns(lane, today);
        lines.push({
            service: 'ship',
            to: other,
            walkingDays: lane.expectedDays,
            days: lane.expectedDays,
            cashPerSeat: theSeatFare(regionId, 'ship', lane.expectedDays, lane),
            runsFromDay: runs === today ? null : runs
        });
    }

    const carriage = requireConveyance(THE_DRAWN_CARRIAGE);
    const byRoad = new Map<string, number>();
    for (const next of placesNextTo(here)) {
        if (next.kind === 'road') byRoad.set(next.name, next.travelDays);
    }
    // THE PROVINCE ROADS COME INTO ONE TOWN, and that town's station runs them.
    const province = requireRegion(regionId);
    if (game.whereTheRoadEndsIn(province.name).name === here) {
        for (const link of province.connections) {
            if (link.kind === 'sea_crossing') continue;
            const days = provinceRoadDays(province.id, link.otherRegionId);
            const other = REGIONS.find(region => region.id === link.otherRegionId);
            if (days === null || !other) continue;
            const town = game.whereTheRoadEndsIn(other.name).name;
            if (!regionIdOfPlace(town)) continue;
            byRoad.set(town, Math.min(days, byRoad.get(town) ?? Infinity));
        }
    }
    for (const [to, walkingDays] of [...byRoad].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))) {
        lines.push({
            service: 'carriage',
            to,
            walkingDays,
            days: daysByConveyance(walkingDays, carriage),
            cashPerSeat: theSeatFare(regionId, 'carriage', walkingDays, null),
            runsFromDay: null
        });
    }
    return lines;
}

/** The counters kept here for ships and carriages, whatever the season. */
export function theBoothsHere(game: GameService, cultivator: Cultivator): ACounter[] {
    const lines = whatRunsFromHere(game, cultivator, 0);
    return [
        ...(lines.some(line => line.service === 'ship') ? ['landing' as const] : []),
        ...(lines.some(line => line.service === 'carriage') ? ['carriage_station' as const] : [])
    ];
}

/** Stones for a fare, never less than one. */
function stonesFor(cash: number): number {
    return Math.max(1, Math.ceil(cashToStones(cash)));
}

/** A whole carriage of one grade on this line: its fare in cash and its days. */
function theHireOf(line: ALine, grade: typeof A_HIRED_CARRIAGE_BY_GRADE[number]) {
    const carriage = requireConveyance(grade.conveyanceId);
    return {
        name: carriage.name.toLowerCase(),
        cash: line.cashPerSeat * carriage.heads * grade.fareTimesItsSeats,
        days: daysByConveyance(line.walkingDays, carriage)
    };
}

/** Which grade a sentence asks to hire: a shod carriage when it names one, else a drawn one. */
function theGradeAskedFor(said: string) {
    return /\b(?:shod|earth)\b/i.test(said) ? A_HIRED_CARRIAGE_BY_GRADE[1]! : A_HIRED_CARRIAGE_BY_GRADE[0]!;
}

/** One line as the board says it. */
function sayTheLine(line: ALine): string {
    const when = line.runsFromDay === null ? 'runs today' : `the lane is next worked on day ${line.runsFromDay}`;
    const hire = line.service === 'carriage'
        ? '; hired whole, ' + A_HIRED_CARRIAGE_BY_GRADE.map(grade => {
            const hired = theHireOf(line, grade);
            return `${hired.name} ${stonesFor(hired.cash)} stones in ${howMany(hired.days, 'day')}`;
        }).join(', ')
        : '';
    const onFoot = line.service === 'carriage' ? ` (${line.walkingDays} on foot)` : '';
    return `${line.to} by ${line.service}: ${howMany(line.days, 'day')}${onFoot}, `
        + `${line.cashPerSeat} cash a seat (${stonesFor(line.cashPerSeat)} stones)${hire}; ${when}. Meals included.`;
}

/** Whether their load goes on a seat, or into a hired carriage of this grade. */
function whatStopsTheLoad(game: GameService, cultivator: Cultivator, hired: string | null) {
    const load = together(
        whatAllOfThatTakes(everythingInThePouch(game.db, cultivator.id)),
        whatTheirThingsTake(game.atHand?.objects ?? [], cultivator.id)
    );
    const body = whatABodyCanCarry(cultivator.realmOrdinal);
    const hold = hired ? whatAVehicleHolds({ data: { conveyanceId: hired } }) : { volume: 0, weight: 0 };
    return {
        load,
        stops: whatStopsThemCarryingIt(load, { volume: body.volume + hold.volume, weight: body.weight + hold.weight })
    };
}

/** The line to where they asked, by the service they named where they named one. */
export function theLineTo(lines: readonly ALine[], wanted: string, service: AService | null): ALine | null {
    const bare = (name: string) => name.toLowerCase().replace(/^the\s+/, '').trim();
    const said = bare(wanted);
    const matches = lines.filter(line => said.length >= 2
        && (bare(line.to) === said || bare(line.to).includes(said) || said.includes(bare(line.to))));
    return matches.find(line => service === null || line.service === service) ?? null;
}

/**
 * A ship or a carriage from here: the board, a seat, or the whole carriage.
 *
 * `intent` is `board`, `buy` (a seat) or `hire` (the whole carriage); `service`
 * narrows to ships or carriages where the sentence named one.
 */
export async function aSeatOnAShipOrACarriage(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    target: string | undefined,
    intent: string,
    service: AService | null,
    /** What the sentence said it was riding, where it said: "a shod carriage". */
    askedIn = ''
): Promise<Execution> {
    const here = placeName(cultivator);
    const today = Math.floor(run.elapsedDays);
    const all = whatRunsFromHere(game, cultivator, today);
    const lines = service ? all.filter(line => line.service === service) : all;
    const counters: ACounter[] = [
        ...theCountersHere(cultivator),
        ...(all.some(line => line.service === 'ship') ? ['landing' as const] : []),
        ...(all.some(line => line.service === 'carriage') ? ['carriage_station' as const] : [])
    ];
    const landing = counters.includes('landing') && service !== 'carriage'
        ? whoKeepsTheCounter(game, cultivator, 'landing', counters) : null;
    const station = counters.includes('carriage_station') && service !== 'ship'
        ? whoKeepsTheCounter(game, cultivator, 'carriage_station', counters) : null;

    if (lines.length === 0) {
        const what = service === 'ship' ? 'No ship calls at' : service === 'carriage' ? 'No carriage runs from' : 'Nothing runs from';
        return refused('engine.whatRunsFromHere', 'passage', factsForRefusal(
            `${what} ${here}.`,
            `${what} ${here}. `
            + (all.length > 0
                ? `What does run: ${all.map(line => `${line.to} by ${line.service}`).join(', ')}.`
                : 'There is no landing on a sea lane here and no road a carriage runs; the way out is on foot.'),
            `a-seat-on-a-ship-or-a-carriage: ${all.length} line(s) from ${here}, ${lines.length} of `
            + `${service ?? 'either'} service. No time passed.`
        ));
    }

    const wanted = (target ?? '').trim();
    const line = wanted.length >= 2 ? theLineTo(lines, wanted, service) : null;
    const reading = intent !== 'buy' && intent !== 'hire';
    if (reading || line === null) {
        const board = [
            ...(landing ? [`${landing.name} keeps the landing.`] : []),
            ...(station ? [`${station.name} keeps the carriage station.`] : []),
            ...lines.map(sayTheLine)
        ];
        if (!reading && wanted.length >= 2) {
            const other = theLineTo(all, wanted, null);
            board.unshift(other
                ? `Nothing to ${wanted} by ${service}; it goes by ${other.service}.`
                : `Nothing from ${here} goes to ${wanted}.`);
        }
        for (const one of lines) {
            game.noteEncounter(cultivator, run, { kind: 'place', id: one.to, name: one.to }, 'read',
                `On the board at ${here} on day ${today}: ${one.days} days by ${one.service}.`);
        }
        const facts = factsForToolResult(`What runs from ${here}.`, board);
        facts.structure.push(`a-seat-on-a-ship-or-a-carriage: ${lines.length} line(s) from ${here} on day ${today}.`);
        return game.freeAction(run, 'passage', facts);
    }

    if (line.runsFromDay !== null) {
        return refused('engine.laneIsOpenInMonth', 'passage', factsForRefusal(
            `No ship sails for ${line.to} yet.`,
            `The lane to ${line.to} is not worked this month. The first ship sails on day ${line.runsFromDay}; `
            + `today is day ${today}.`,
            `a-seat-on-a-ship-or-a-carriage: lane closed until run day ${line.runsFromDay}. Nothing spent.`
        ));
    }

    const hiring = intent === 'hire';
    if (hiring && line.service === 'ship') {
        return refused('engine.theHireOf', 'passage', factsForRefusal(
            'Nobody hires out a ship.',
            `A seat on the ship to ${line.to} is ${line.cashPerSeat} cash; nobody at the landing lets a whole hull.`,
            'a-seat-on-a-ship-or-a-carriage: hire is carriages only. Nothing spent.'
        ));
    }
    const grade = hiring ? theGradeAskedFor(`${wanted} ${askedIn}`) : null;
    const hired = grade ? theHireOf(line, grade) : null;
    const carrying = whatStopsTheLoad(game, cultivator, grade?.conveyanceId ?? null);
    if (carrying.stops !== null) {
        const why = carrying.stops === 'too_heavy' ? 'more weight' : 'more bulk';
        const cheapest = line.service === 'carriage' ? theHireOf(line, A_HIRED_CARRIAGE_BY_GRADE[0]!) : null;
        return refused('engine.whatStopsThemCarryingIt', 'passage', factsForRefusal(
            hired ? `More than ${hired.name} holds.` : 'More than a passenger brings aboard.',
            hired
                ? `Hired whole, ${hired.name} holds what you carry and its hold besides; you have ${why} than that.`
                : `A seat carries you and what you can carry on your own person, and you have ${why} than `
                  + 'that. ' + (cheapest
                    ? `Hired whole, ${cheapest.name} carries the rest: ${stonesFor(cheapest.cash)} stones to ${line.to}.`
                    : 'Nobody at the landing hires out a hull.'),
            `a-seat-on-a-ship-or-a-carriage: load ${carrying.load.volume}L/${carrying.load.weight} is `
            + `${carrying.stops}. Nothing spent.`
        ));
    }

    const cash = hired ? hired.cash : line.cashPerSeat;
    const stones = stonesFor(cash);
    const what = hired ? `${hired.name[0]!.toUpperCase()}${hired.name.slice(1)}, hired whole,` : `A seat on the ${line.service}`;
    if (cultivator.spiritStones < stones) {
        return refused('engine.theSeatFare', 'passage', factsForRefusal(
            'The fare is the fare.',
            `${what} to ${line.to} is ${cash} cash, which is `
            + `${howMany(stones, 'spirit stone')}; you are carrying ${cultivator.spiritStones}.`,
            `a-seat-on-a-ship-or-a-carriage: ${cash} cash against ${cultivator.spiritStones} stones. Nothing spent.`
        ));
    }

    const keeper = line.service === 'ship' ? landing : station;
    return game.takeTheSeat(run, cultivator, {
        service: line.service,
        to: line.to,
        days: hired ? hired.days : line.days,
        walkingDays: line.walkingDays,
        stones,
        escort: line.service === 'ship' ? THE_ESCORT.ship : hired ? THE_ESCORT.hired_carriage : THE_ESCORT.seat_carriage,
        bought: `${what} from ${here} to ${line.to}: ${howMany(stones, 'spirit stone')}`
            + `${keeper ? `, paid to ${theKeeperAsTheyAreKnown(game, cultivator, keeper, line.service === 'ship' ? 'landing' : 'carriage_station')}` : ''}.`
    });
}
