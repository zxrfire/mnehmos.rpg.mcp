import {aboardAnUnfinishedRoad} from './the-actual-carrier-scene.js';
import { betweenRoadEndpoints } from './a-road-stopped-partway.js';
import { walkToTheDeparture } from './walking-to-a-departure.js';
import { exteriorGroundOfDeparture } from '../engine/world/departure-approach.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { realiseAcceptedPublicShipHull, publicShipHullCanBeBoarded } from '../engine/world/a-public-ship-hull.js';
import { ensureShipCrew, bindShipCrewToPassage } from '../engine/world/ship-crew.js';
import { recordPublicPassage, onSponsoredPublicPassage } from '../engine/world/public-shipping.js';
import { peopleUnavailableForOwnedBoarding } from './an-owned-passage.js';
import { writeTheVoyage } from './a-ship-at-sea.js';
import { prepareWorldClockForPreciseSpan } from '../server/state/cultivation-world.js';
/**
 * Ships from a landing and carriages from a station: what runs from here, what a seat or a whole carriage costs, and buying one.
 *
 * WHAT RUNS IS THE MAP'S. A ship runs the sea lanes (`SEA_LANES`), from each
 * named landfall to the other, in the months the lane is worked, and between the
 * ports of a province that is open water, on the days its passages state. A
 * carriage runs nowhere on open water, and otherwise on every `road` a place
 * states (a `path` is ground nobody drives), and from the town a province's roads
 * come into, to the town of every province a land road joins it to. Not the
 * Measured Span, which is a house's folding service and is `passage` at its own
 * counters.
 *
 * WHAT IT COSTS IS THE BOARD'S. A ship seat is the board's sea passage a day
 * (deck passage where the lane has nowhere to stop) for the lane's expected days.
 * A carriage seat is the board's caravan passage, quoted per hundred li, at
 * {@link LI_WALKED_IN_A_DAY} li a walked day. Both at the local rate. A hired
 * carriage comes in the grades a station lets ({@link A_HIRED_CARRIAGE_BY_GRADE})
 * and costs every seat it holds, times the grade's figure. A carriage fare
 * includes board, so the pack is not opened on the way. A ship's fare buys a
 * share of the hull's rations, loaded at the customary margin
 * (`provisionForLane`); a passage that runs past them opens the pack.
 *
 * HOW FAST IS THE CATALOG'S. A carriage goes at its conveyance row's speed. A
 * ship is quoted the lane's expected days and takes what the weather makes of
 * them (`resolveCrossing`).
 *
 * A SEAT CARRIES THE PASSENGER AND WHAT THEY CARRY ON THEIR PERSON. More than a
 * body can carry (a carcass, a heavy load) is refused a seat, and the answer is a
 * hired carriage, whose hold is `whatAVehicleHolds`.
 */

import { publicShipLinesFrom, quotePublicPassage } from '../engine/world/public-shipping.js';
import { assessPublicCarriage, commitPublicCarriage } from '../engine/world/public-carriages.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { keepThePaidCarriage } from './a-paid-carriage-on-the-road.js';
import { monthOf, stonesFor } from '../engine/world/the-fare-and-calendar-of-a-passage.js';
import { daysOfABookedPassage } from '../engine/world/places-on-the-way.js';
import { worldLocationFor } from './entities.js';
export { stonesFor };
import { requireConveyance } from '../data/cultivation/what-a-house-moves-its-people-on.js';
import { whatAVehicleHolds } from '../engine/world/a-vehicle.js';
import {
    whatABodyCanCarry,
    whatAllOfThatTakes,
    whatStopsThemCarryingIt
} from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import { daysByConveyance } from '../engine/world/what-a-conveyance-does-to-a-journey.js';
import {
    provisionForLane,
    resolveCrossing
} from '../engine/world/what-a-sea-crossing-costs.js';
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
import { theVoyageUnderWay, type AVoyage } from './a-ship-at-sea.js';

export type AService = 'ship' | 'carriage';

/** The conveyance a carriage seat rides in, whose speed is the catalog's. */
const THE_DRAWN_CARRIAGE = 'conv-carriage-mortal';

/**
 * The grades a station hires out, and what the whole carriage costs: every seat
 * it holds at the seat fare, times this. A titled carriage is a house's and is
 * not let.
 */
export const A_HIRED_CARRIAGE_BY_GRADE: readonly { conveyanceId: string; fareTimesItsSeats: number }[] = [
    { conveyanceId: 'conv-carriage-mortal', fareTimesItsSeats: 1 },
    { conveyanceId: 'conv-carriage-earth', fareTimesItsSeats: 2 }
];

/** Who rides with the vehicle and would fight for it: a coach's driver and guards, a hired carriage's driver and guard, a ship's crew. */
const THE_ESCORT = { ship: 4 } as const;

/** One line off the board. */
export type { ALine } from '../engine/world/public-transport-at-a-place.js';
import { publicTransportFrom, publicTransportHubsAt, type ALine } from '../engine/world/public-transport-at-a-place.js';

/** What a word in the sentence asks for. "Boat" at a landing is the ship, since no water boat exists. */
export function theServiceNamed(said: string | undefined): AService | null {
    const word = (said ?? '').toLowerCase();
    if (/\b(?:ships?|boats?|ferry|ferries|barges?|hulls?|landing)\b/.test(word)) return 'ship';
    if (/\b(?:carriages?|coach|coaches|carts?|wagons?|waggons?|station)\b/.test(word)) return 'carriage';
    return null;
}

/** The inn, the landing and the carriage station as a look round sees them. */
export function theCountersAsSeenHere(game: GameService, cultivator: Cultivator, today: number): string[] {
    const inn = theInnAsSeenHere(game, cultivator);
    // Aboard a ship at sea, the water under it has a dock only for ships that put in.
    const runs = theVoyageUnderWay(game.repos.db, cultivator, game.atHand) ? [] : whatRunsFromHere(game, cultivator, today);
    const ships = runs.some(line => line.service === 'ship');
    const carriages = runs.some(line => line.service === 'carriage');
    return [
        ...(inn ? [inn] : []),
        ...(ships || carriages
            ? [`${ships && carriages ? 'Ships call here and carriages run from here' : ships ? 'Ships call here' : 'Carriages run from here'}; a clerk sells the seats.`]
            : [])
    ];
}

/** The public board reads the same real dock services as independent people. */
export function theShipsFrom(game: GameService, here: string, today: number): ALine[] {
    return publicShipLinesFrom(game.atHand, here, today);
}

/**
 * Everything that runs from where they stand, ships first, nearest first.
 */
export function whatRunsFromHere(game: GameService, cultivator: Cultivator, today: number): ALine[] {
    if ((betweenRoadEndpoints(game.db, cultivator) || !!game.atHand && aboardAnUnfinishedRoad(game.repos,cultivator,game.atHand,routineTime(game.atHand)))) return [];
    today = Math.floor(game.atHand?.currentDay ?? today);
    return publicTransportFrom(game.atHand, placeName(cultivator), today, standingOf(cultivator).regionId);
}

/** The counters kept here for ships and carriages, whatever the season. */
export function theBoothsHere(game: GameService, cultivator: Cultivator): ACounter[] {
    if ((betweenRoadEndpoints(game.db, cultivator) || !!game.atHand && aboardAnUnfinishedRoad(game.repos,cultivator,game.atHand,routineTime(game.atHand)))) return [];
    return publicTransportHubsAt(game.atHand, placeName(cultivator), game.atHand?.currentDay ?? 0).map(hub => hub.kind);
}

/** Stones for a fare, never less than one. */


/** A whole carriage of one grade on this line: its fare in cash and its days. */
export function theHireOf(line: ALine, grade: typeof A_HIRED_CARRIAGE_BY_GRADE[number]) {
    const carriage = requireConveyance(grade.conveyanceId);
    return {
        name: carriage.name.toLowerCase(),
        cash: line.cashPerSeat * carriage.heads * grade.fareTimesItsSeats,
        days: daysByConveyance(line.walkingDays, carriage)
    };
}

/** Which grade a sentence asks to hire: an iron-rimmed carriage when it names one, else a drawn one. */
function theGradeAskedFor(said: string) {
    return /\b(?:shod|iron-rimmed|rimmed|earth)\b/i.test(said) ? A_HIRED_CARRIAGE_BY_GRADE[1]! : A_HIRED_CARRIAGE_BY_GRADE[0]!;
}

/**
 * How many lines a board shows. Every dock on open water sells passage to every other, so a port's
 * board would run to fifteen lines; it shows the nearest, and the rest are still sold by name.
 */
const ON_THE_BOARD = 6;

/** The nearest lines, as many as a board shows, and how many more there are. */
function theNearestOf(lines: readonly ALine[]): { shown: ALine[]; more: number } {
    const nearest = [...lines].sort((a, b) => a.days - b.days || a.to.localeCompare(b.to));
    return { shown: nearest.slice(0, ON_THE_BOARD), more: Math.max(0, nearest.length - ON_THE_BOARD) };
}

/** One line as the board says it. */
export function sayTheLine(line: ALine): string {
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
        && (bare(line.to) === said || bare(line.to).includes(said) || said.includes(bare(line.to))))
        .filter(line => service === null || line.service === service);
    // The place named, before a longer name that has it inside: Silver Island, not Silver Island Hall grounds.
    return matches.find(line => bare(line.to) === said) ?? matches[0] ?? null;
}

/**
 * A ship or a carriage from here: the board, a seat, or the whole carriage.
 *
 * `intent` is `board`, `buy` (a seat) or `hire` (the whole carriage); `service`
 * narrows to ships or carriages where the sentence named one.
 */
function carriageCapacityRefusal(assessment: ReturnType<typeof assessPublicCarriage>) {
    if (assessment.refusal?.kind !== 'capacity') return null;
    const { remainingPassengers, requestedPassengers } = assessment.refusal;
    return refused('engine.publicCarriage', 'passage', factsForRefusal(
        'Not enough passenger places on this carriage.',
        `${howMany(remainingPassengers, 'passenger place')} remain; your company needs ${howMany(requestedPassengers, 'place')}. Nothing spent.`,
        `${howMany(remainingPassengers, 'passenger place')} remaining against ${howMany(requestedPassengers, 'passenger')}.`));
}

export async function aSeatOnAShipOrACarriage(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    target: string | undefined,
    intent: string,
    service: AService | null,
    /** What the sentence said it was riding, where it said: "an iron-rimmed carriage". */
    askedIn = ''
): Promise<Execution> {
    if (game.worldEnabled && (intent === 'buy' || intent === 'hire')) {
        game.atHand = await prepareWorldClockForPreciseSpan(run, cultivator);
        cultivator = game.repos.cultivators.getById(cultivator.id) ?? cultivator;
        run = game.repos.runs.getById(run.id) ?? run;
    }
    if ((betweenRoadEndpoints(game.db, cultivator) || !!game.atHand && aboardAnUnfinishedRoad(game.repos,cultivator,game.atHand,routineTime(game.atHand)))) return refused('engine.passageCounterReach', 'passage', factsForRefusal(
        'The landing or station has not been reached.',
        'You are between road endpoints. Reach an actual landing or carriage station before reading its board or buying its passage. Nothing spent.',
        'passage-counter: sole current SQL road cursor is an unfinished edge; its displayed endpoint supplies no counter or keeper.'));
    if(game.atHand&&target&&intent!=='board'){
        const place=worldLocationFor(game.atHand,cultivator.location);
        const ground=place&&exteriorGroundOfDeparture(game.atHand,place.id);
        const station=ground&&theAreasOf(game.atHand,ground).areas.find(area=>
            area.for===(service==='ship'?'landing':'carriage_station'));
        const companions=game.whoIsWithYouOnTheRoad(cultivator).map(person=>person.id);
        if(ground&&peopleUnavailableForOwnedBoarding(game.atHand,companions,ground.id,routineTime(game.atHand),true).length)
            return refused('engine.actualPartyBoarding','passage',factsForRefusal('Your agreed company cannot board here together.',
                'An agreed traveller is absent, no longer alive, or already on another actual passage. Nothing spent.',
                'Party membership does not recall a body or replace its accepted course.'));
        const offered=ground&&theLineTo(whatRunsFromHere(game,{...cultivator,location:ground.name},Math.floor(game.atHand.currentDay)),target,service);
        if(ground&&offered?.service==='carriage'){
            const to=worldLocationFor(game.atHand,offered.to),grade=intent==='hire'?theGradeAskedFor(`${target} ${askedIn}`):null;
            const hired=grade?theHireOf(offered,grade):null;
            const ids=[cultivator.id,...companions],fare=hired?stonesFor(hired.cash):stonesFor(offered.cashPerSeat)*ids.length;
            const assessment=to&&assessPublicCarriage(game.atHand,{fromId:ground.id,toId:to.id,day:routineTime(game.atHand),
                conveyanceId:grade?.conveyanceId??THE_DRAWN_CARRIAGE,passengerIds:ids,fareStones:fare,hired:intent==='hire',
                playedPassenger:{id:cultivator.id,locationId:ground.id,alive:cultivator.alive}});
            const capacity=assessment&&carriageCapacityRefusal(assessment);if(capacity)return capacity;
        }
        if(ground&&station){const approach=await walkToTheDeparture(game,run,cultivator,ground.id,station.id,undefined,companions);
            if(approach)return approach;({run,cultivator}=game.currentRun());}
    }
    const here = placeName(cultivator);
    const today = Math.floor(game.atHand?.currentDay ?? run.elapsedDays);
    const weatherDay = Math.floor(run.elapsedDays);
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
                ? `What does run: ${theNearestOf(all).shown.map(line => `${line.to} by ${line.service}`).join(', ')}`
                  + `${theNearestOf(all).more > 0 ? `, and ${theNearestOf(all).more} more` : ''}.`
                : 'There is no landing on a sea lane here and no road a carriage runs; the way out is on foot.'),
            `a-seat-on-a-ship-or-a-carriage: ${all.length} line(s) from ${here}, ${lines.length} of `
            + `${service ?? 'either'} service. No time passed.`
        ));
    }

    const wanted = (target ?? '').trim();
    const line = wanted.length >= 2 ? theLineTo(lines, wanted, service) : null;
    const reading = intent !== 'buy' && intent !== 'hire';
    if (reading || line === null) {
        const displayed = theNearestOf(lines);
        const board = [
            ...(landing ? [`${landing.name} keeps the landing.`] : []),
            ...(station ? [`${station.name} keeps the carriage station.`] : []),
            ...displayed.shown.map(sayTheLine),
            ...(displayed.more > 0 ? [`And ${displayed.more} more, further off, sold by name.`] : [])
        ];
        if (!reading && wanted.length >= 2) {
            const other = theLineTo(all, wanted, null);
            board.unshift(other
                ? `Nothing to ${wanted} by ${service}; it goes by ${other.service}.`
                : `Nothing from ${here} goes to ${wanted}.`);
        }
        for (const one of displayed.shown) {
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

    const fromDock = game.atHand && worldLocationFor(game.atHand, here);
    const toDock = game.atHand && worldLocationFor(game.atHand, line.to);
    const companionIds = game.whoIsWithYouOnTheRoad(cultivator).map(person => person.id);
    const passengerIds = [...new Set([cultivator.id, ...companionIds])];
    const unavailable = game.atHand && fromDock
        ? peopleUnavailableForOwnedBoarding(game.atHand, companionIds, fromDock.id, routineTime(game.atHand))
        : companionIds;
    if (unavailable.length > 0) return refused('engine.actualPartyBoarding', 'passage', factsForRefusal(
        'Your agreed company cannot board here together.',
        'An agreed traveller is absent, no longer alive, or already on another actual passage. Nothing spent.',
        'Party membership does not recall a body or replace its accepted course.'));
    const cash = hired ? hired.cash : line.cashPerSeat * passengerIds.length;
    const stones = hired ? stonesFor(cash) : stonesFor(line.cashPerSeat) * passengerIds.length;
    const what = hired ? `${hired.name[0]!.toUpperCase()}${hired.name.slice(1)}, hired whole,`
        : passengerIds.length === 1 ? `A seat on the ${line.service}`
        : `${howMany(passengerIds.length, 'seat')} on the ${line.service}`;
    if (cultivator.spiritStones < stones) {
        return refused('engine.theSeatFare', 'passage', factsForRefusal(
            'The fare is the fare.',
            `${what} to ${line.to} is ${cash} cash, which is `
            + `${howMany(stones, 'spirit stone')}; you are carrying ${cultivator.spiritStones}.`,
            `a-seat-on-a-ship-or-a-carriage: ${cash} cash against ${cultivator.spiritStones} stones. Nothing spent.`
        ));
    }

    const keeper = line.service === 'ship' ? landing : station;
    const roadAssessment = line.service === 'carriage' && game.atHand && fromDock && toDock
        ? assessPublicCarriage(game.atHand, { fromId: fromDock.id, toId: toDock.id,
            day: routineTime(game.atHand), conveyanceId: grade?.conveyanceId ?? THE_DRAWN_CARRIAGE,
            passengerIds, fareStones: stones, hired: hiring,
            playedPassenger: { id: cultivator.id, locationId: fromDock.id, alive: cultivator.alive } }) : null;
    const roadQuote = roadAssessment?.quote ?? null;
    if (line.service === 'carriage' && roadAssessment?.refusal?.kind === 'capacity') {
        return carriageCapacityRefusal(roadAssessment)!;
    }
    if (line.service === 'carriage' && !roadQuote) return refused('engine.publicCarriage', 'passage', factsForRefusal(
        'No actual carriage can board this passage here.',
        'Its source carriage, driver or remaining berths are unavailable. Nothing spent.',
        'The advertised road service does not recall its actual vehicle from elsewhere.'));
    const publicQuote = line.lane && game.atHand && fromDock && toDock
        ? quotePublicPassage(game.atHand, fromDock.id, toDock.id, game.atHand.currentDay,
            passengerIds.length, [], `${run.seed}:${weatherDay}`, passengerIds) : null;
    if (line.lane && game.atHand && !publicQuote) {
        return refused('engine.takeTheSeat', 'passage', factsForRefusal(
            'The ship cannot board here for this departure.',
            `The public hull for ${line.to} has no available passage from ${here} today. Nothing spent.`,
            'public-passage: actual hull position or another finite booking prevents boarding.'
        ));
    }
    const hold = publicQuote?.provision ?? (line.lane ? provisionForLane(line.lane, passengerIds.length) : null);
    const sailed = publicQuote?.crossing ?? (line.lane && hold
        ? resolveCrossing(`${run.seed}:${weatherDay}`, line.lane, hold, monthOf(today))
        : null);
    const voyage: AVoyage | null = line.lane && hold && sailed
        ? {
            from: here,
            bound: line.to,
            lane: line.lane,
            sailed: 0,
            days: publicQuote?.days ?? (game.atHand
                ? daysOfABookedPassage(game.atHand.npcs, line.lane,
                    game.atHand.locations.find(place => place.name === here)?.id ?? '',
                    game.atHand.locations.find(place => place.name === line.to)?.id ?? '',
                    game.atHand.currentDay) ?? sailed.daysTaken
                : sailed.daysTaken),
            quoted: line.days,
            hullRationDays: hold.rationDaysAboard,
            crew: THE_ESCORT.ship
        }
        : null;
    if (publicQuote && voyage && game.atHand) {
        const receipt = game.db.transaction(() => {
            const current = game.repos.cultivators.getById(cultivator.id);
            if (!current?.alive || current.spiritStones < stones
                || placeName(current) !== here) return null;
            const rechecked = quotePublicPassage(game.atHand!, publicQuote.fromId, publicQuote.toId,
                publicQuote.departureDay, passengerIds.length, [], run.seed + ':' + weatherDay, passengerIds);
            if (!rechecked || rechecked.vesselId !== publicQuote.vesselId
                || rechecked.arrivalDay !== publicQuote.arrivalDay) return null;
            if (!publicShipHullCanBeBoarded(game.atHand!,publicQuote)) return null;
            if (peopleUnavailableForOwnedBoarding(game.atHand!, companionIds, publicQuote.fromId, publicQuote.departureDay).length > 0) return null;
            const companions = companionIds.map(id => game.atHand!.npcs.find(person => person.id === id)!);
            const boarded = companions.map(person => onSponsoredPublicPassage(game.atHand!, person, publicQuote,
                'Travelling on the paid ship to its destination.', [cultivator.id]));
            if (boarded.some(person => person === null)) return null;
            const crew = ensureShipCrew(game.atHand!, publicQuote.lane, publicQuote.fromId, publicQuote.departureDay);
            for (const person of boarded) {
                const index = game.atHand!.npcs.findIndex(row => row.id === person!.id);
                game.atHand!.npcs[index] = person!;
            }
            bindShipCrewToPassage(game.atHand!, publicQuote);
            const operator=game.atHand!.npcs.find(person=>person.status==='alive'
                && person.tags.includes('crew-of:'+publicQuote.vesselId) && person.identity.occupation==='shipmaster');
            if (!operator || !realiseAcceptedPublicShipHull(game.atHand!,publicQuote,operator)) return null;
            const accepted = recordPublicPassage(game.atHand!, publicQuote, publicQuote.departureDay,
                publicQuote.fromId, [...passengerIds, ...crew.map(person => person.id)], undefined,
                { runId: game.currentRun().run.id, elapsedDays: game.currentRun().run.elapsedDays },
                [{id:current.id,name:current.name},...companions.map(person=>({id:person.id,name:person.name}))]);
            game.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -stones });
            voyage.receiptId = accepted.id; voyage.crew = crew.length;
            writeTheVoyage(game.db, cultivator.id, voyage);
            return accepted;
        })();
        if (!receipt) return refused('engine.actualShipBoarding', 'passage', factsForRefusal(
            'The actual ship cannot accept this passage.', 'The source or purse changed. Nothing spent.',
            'No speculative sailing was committed.'));
        game.theWorldMoved();
    }
    let roadReceiptId: string | undefined;
    if (roadQuote && game.atHand) {
        const receipt = game.db.transaction(() => {
            const current = game.repos.cultivators.getById(cultivator.id);
            if (!current?.alive || current.spiritStones < stones || placeName(current) !== here
                || peopleUnavailableForOwnedBoarding(game.atHand!, companionIds, roadQuote.fromId, roadQuote.departureDay).length > 0) return null;
            const accepted = commitPublicCarriage(game.atHand!, roadQuote, { runId: game.currentRun().run.id, elapsedDays: game.currentRun().run.elapsedDays });
            if (!accepted) return null;
            game.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -stones });
            keepThePaidCarriage(game.db, cultivator.id, accepted.id);
            return accepted;
        })();
        if (!receipt) return refused('engine.publicCarriage', 'passage', factsForRefusal(
            'The carriage cannot accept this booking.', 'The actual source or purse changed. Nothing spent.',
            'Accepted road booking failed its synchronous recheck.'));
        roadReceiptId = receipt.id;
        game.theWorldMoved();
    }
    return game.takeTheSeat(run, game.repos.cultivators.getById(cultivator.id) ?? cultivator, {
        service: line.service,
        departureOccasion: !!(roadReceiptId || voyage?.receiptId),
        to: line.to,
        days: roadQuote ? roadQuote.arrivalDay - roadQuote.departureDay : voyage ? voyage.days : hired ? hired.days : line.days,
        ...(voyage ? { sea: voyage } : {}),
        walkingDays: line.walkingDays,
        stones: roadReceiptId || voyage?.receiptId ? 0 : stones,
        escort: line.service === 'ship' ? THE_ESCORT.ship : 0,
        ...(roadReceiptId ? { roadReceiptId } : {}),
        bought: `${what} from ${here} to ${line.to}: ${howMany(stones, 'spirit stone')}`
            + `${keeper ? `, paid to ${theKeeperAsTheyAreKnown(game, cultivator, keeper, line.service === 'ship' ? 'landing' : 'carriage_station')}` : ''}.`
    });
}
