import { passageRunMoment, passageCheckFrame } from '../engine/world/passage-moment.js';
import { projectActualPassengers } from './passengers-at-the-actual-clock.js';
import { walkingRouteFrom } from '../engine/world/locations.js';
import { roadVertexMoments } from '../engine/world/road-course.js';
import { accountsComingDue } from './who-comes-to-settle-an-account.js';
/** Accepted public transport executes body/world/encounter effects in actual date order. */
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import type { AVoyage } from './a-ship-at-sea.js';
import { spendWithPhysicalCarrier, type PhysicalCarrier } from './a-physical-span.js';
import { whatTheHullFed, whatWasEatenOnBoard } from './what-a-journey-eats.js';
import { recordedVoyage, endTheVoyage, theVoyageUnderWay, whereTheShipIs } from './a-ship-at-sea.js';
import { leaveThePaidCarriage, thePaidCarriageClaim } from './a-paid-carriage-on-the-road.js';
import { publicCarriagePassage, stopPublicCarriage } from '../engine/world/public-carriages.js';
import { shipPassengerAt, turnBackPublicPassage } from '../engine/world/passenger-on-a-vessel.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { locationOnNpcJourney, firstTravellerOnTheWay, firstTravellerOnTheWater, journeyTimeHasReached, isWater } from '../engine/world/places-on-the-way.js';
import { peopleInThisPlace } from './hearsay.js';
import { PLAYER_ROLL_IDENTITY, encounterInputFor, recordEncounters, withEncounterDeltas } from './encounters.js';
import { encountersAtChecks } from '../engine/encounters/window.js';
import { whatTheEscortMet } from '../engine/encounters/an-escort-on-the-road.js';
import { comesAtYou, theRestOfTheFight, theyCameAtYou, foldTheFightIn } from './when-somebody-comes-at-you.js';
import { theCrewWhoFell } from './the-crew-of-a-ship.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused, skipCalls, worldCalls } from './tool-result-prose.js';
import { TRAVEL_FOCUS } from './turn-constants.js';
import { prepareWorldClockForPreciseSpan } from '../server/state/cultivation-world.js';

export interface ActualPaidTrip {
    service: 'ship' | 'carriage' | 'air'; to: string; days: number; walkingDays: number;
    stones: number; escort: number; bought: string; sea?: AVoyage; roadReceiptId?: string; focus?: number;
    /** Supplied only by the successful new boarding caller; no durable duplicate marker. */
    departureOccasion?: boolean;
}

/** Read-only entitlement: continuing never creates crew or recalls a carrier. */
export function paidCarrierSource(game: Pick<GameService, 'atHand'>, playerId: string, roadReceiptId?: string,
    sea?: AVoyage, onDay = routineTime(game.atHand!)): PhysicalCarrier | null {
    const state = game.atHand;
    if (!state) return null;
    if (roadReceiptId) {
        const actual = publicCarriagePassage(state, roadReceiptId, playerId, onDay);
        return actual ? { locationId: actual.locationId, endsOnDay: actual.leg.arrivalDay, boardedOnDay: actual.leg.departureDay,
            vertexDates: actual.driver.activity?.admittedRoad
                ? roadVertexMoments(actual.driver.activity.admittedRoad.route,actual.leg.departureDay,
                    actual.leg.arrivalDay-actual.leg.departureDay,actual.driver.activity.admittedRoad.initialTravelDays)
                : roadVertexMoments(walkingRouteFrom(state.locations,actual.leg.fromId,actual.leg.toId)??[],
                    actual.leg.departureDay,actual.leg.arrivalDay-actual.leg.departureDay),
            boardingMoment: passageRunMoment(state, roadReceiptId), providedFoodUntilDay: actual.leg.arrivalDay, unavailable: null } : null;
    }
    if (sea?.receiptId) {
        const actual = shipPassengerAt(state, sea.receiptId, onDay);
        return actual ? { locationId: actual.locationId, endsOnDay: actual.arrivalDay, boardedOnDay: actual.boardedOnDay,
            boardingMoment: passageRunMoment(state, sea.receiptId),
            providedFoodUntilDay: Math.min(actual.arrivalDay, actual.boardedOnDay + sea.hullRationDays), unavailable: actual.unavailable } : null;
    }
    return null;
}

export async function executeActualPaidPassage(game: GameService, run: Run, body: Cultivator,
    trip: ActualPaidTrip, afterArrival?: (body: Cultivator, run: Run, execution: Execution) => void,
    binding?: { source: (onDay?: number) => PhysicalCarrier | null; overWater: boolean;
        crew: () => import('../engine/world/npc-state.js').NpcRecord[];
        beforeWorld?(onDay: number): void; stop?(): string | null; vesselId?: string; airborne?: boolean },
    resolvesOnTurn = run.turn + 1, finishTurn = true): Promise<Execution> {
    // Promotion resolves real legacy-clock effects before choosing a contact or spending.
    game.atHand = await prepareWorldClockForPreciseSpan(run, body);
    projectActualPassengers(game.db, game.atHand, body.id, routineTime(game.atHand));
    const freshStart = game.currentRun();
    run = freshStart.run; body = freshStart.cultivator;
    const state = game.atHand;
    const start = state ? routineTime(state) : null;
    const source = binding?.source ?? ((onDay?: number) => paidCarrierSource(game, body.id, trip.roadReceiptId, trip.sea, onDay));
    if (!body.alive || !state || start === null || !source() || source()!.unavailable) return refused(
        'engine.actualPaidPassage', 'passage', factsForRefusal('The actual carrier is unavailable.',
            source()?.unavailable ?? 'The accepted passage has no physical source here.',
            'No replacement was created and no time passed.'));
    const from = state.locations.find(place => place.id === source()!.locationId);
    const to = state.locations.find(place => place.name === trip.to);
    if (!from || !to) return refused('engine.actualPaidPassage', 'passage', factsForRefusal(
        'The accepted road does not reach that ground.', 'Nothing spent.', 'No actual route endpoints.'));
    const crewNow = binding?.crew ?? (() => trip.roadReceiptId
        ? [publicCarriagePassage(game.atHand!, trip.roadReceiptId, body.id, routineTime(game.atHand!))?.driver]
            .filter((one): one is NonNullable<typeof one> => !!one)
        : shipPassengerAt(game.atHand!, trip.sea!.receiptId!, routineTime(game.atHand!))?.crew ?? []);
    const exceptIds = new Set([body.id, ...crewNow().map(one => one.id)]);
    const waterId = trip.sea && state.locations.find(place => place.tags.includes('openWater'))?.id;
    const waterGround = trip.sea && source(start + Math.min(trip.days, .125))?.locationId;
    const justBoarded = trip.sea && shipPassengerAt(state, trip.sea.receiptId!, start)?.sailed === 0;
    const meeting = binding?.airborne ? null : trip.sea && !justBoarded ? null : trip.sea && (waterGround || waterId)
        ? firstTravellerOnTheWater({ locations: state.locations, npcs: state.npcs,
            waterId: waterGround ?? waterId!, vesselId: shipPassengerAt(state, trip.sea.receiptId!, start)!.vesselId,
            onDay: start, days: trip.days, exceptIds })
        : firstTravellerOnTheWay({ locations: state.locations, npcs: state.npcs,
            fromId: from.id, toId: to.id, onDay: start, days: trip.days, exceptIds, overWater: binding?.overWater ?? false });
    // Current physical position and the original window share one actual clock.
    // A caused changed-course receipt still reads the original accepted boarding.
    const frame = passageCheckFrame(source()!.boardingMoment ?? null, start, run.elapsedDays, trip.days);
    // Legacy receipts lack a recoverable SQL moment. Their fresh window skips
    // departure; it cannot claim original-grid equivalence. Food/source reads
    // still retain their actual boarding date independently of this fallback.
    const { runStart, elapsedOnThisCrossing, boardedOnDay: boarded } = frame;
    const inputNow = () => encounterInputFor({ repos: game.repos, knowledge: game.knowledge, world: game.atHand }, {
        seed: run.seed, startDay: runStart, days: elapsedOnThisCrossing + trip.days, activity: 'travel',
        cultivator: game.currentRun().cultivator, rollIdentity: PLAYER_ROLL_IDENTITY,
        comingForYou: accountsComingDue(game, game.currentRun().cultivator)
    });
    // This caller supplies no retrospective arrival candidates. Native queued world
    // arrivals retain their existing resolver; the held cadence streams its actual checks.
    const cadence = encountersAtChecks(inputNow(), {
        departureOccasion: trip.departureOccasion === true && !frame.legacyUnknownMoment,
        afterDay: frame.afterDay,
        throughDay: frame.throughDay
    });
    let nextCheck = cadence.next();
    const lines = [trip.bought], structure: string[] = [];
    let stop: string | null = null, contactReached = false;
    let fight: Execution | null = null;
    const dates: number[] = [];
    const refreshDates = () => {
        dates.length = 0;
        if (!nextCheck.done && nextCheck.value.kind === 'check') dates.push(boarded + nextCheck.value.dayOffset);
        if (meeting && !contactReached) dates.push(start + meeting.afterDays);
    };
    const resolveChecksHere = () => {
        const day = routineTime(game.atHand!);
        while (!stop && game.currentRun().cultivator.alive && game.currentRun().run.status === 'active'
            && !nextCheck.done && nextCheck.value.kind === 'check'
            && journeyTimeHasReached(day, boarded + nextCheck.value.dayOffset)) {
            // Passenger projection and world consequences have already committed.
            // Nothing from a departure cast is carried into a later check.
            const resolved = cadence.next(inputNow());
            if (resolved.done || resolved.value.kind !== 'resolved') throw new Error('An encounter check lost its result.');
            for (const occurrence of resolved.value.occurrences) {
                    const actualNow = game.currentRun();
                    if (!actualNow.cultivator.alive || actualNow.run.status !== 'active' || stop) break;
                    const crew = crewNow();
                    const single = { ...resolved.value.roll, occurrences: [occurrence], firstInterruptDay: null };
                    const met = whatTheEscortMet(single, crew.length);
                    if (met.withdrew.length) { lines.push('A band withdrew from the actual carrier.'); continue; }
                    const fresh = game.currentRun();
                    const adjusted = withEncounterDeltas(fresh.cultivator, single);
                    game.repos.cultivators.applyDeltas(body.id, { hp: adjusted.hp - fresh.cultivator.hp,
                        spiritStones: adjusted.spiritStones - fresh.cultivator.spiritStones });
                    const recorded = recordEncounters(game.knowledge, adjusted, fresh.run.elapsedDays,
                        single, game.repos, fresh.run.elapsedDays);
                    lines.push(...recorded.lines); structure.push(...recorded.structure);
                    if (met.attacking) {
                        const engage = met.attacking.confrontation?.engageable === true;
                        const rest = theRestOfTheFight(game, fresh.run, met.attacking, crew.length,
                            game.ambientFor(adjusted, fresh.run), trip.service, engage, crew);
                        theCrewWhoFell(game, rest.fallen, day, 'at the actual passage boundary');
                        lines.push(...rest.lines);
                        if (!rest.escortHeld && trip.roadReceiptId) {
                            const road = publicCarriagePassage(game.atHand!, trip.roadReceiptId, body.id, day);
                            if (road) stopPublicCarriage(game.atHand!, road.leg, day);
                            leaveThePaidCarriage(game.db, body.id);
                        }
                        if (engage) fight = theyCameAtYou(game, fresh.run, adjusted,
                            game.ambientFor(adjusted, fresh.run), { ...single, firstInterruptDay: occurrence.absoluteDay }, true);
                        if (!rest.escortHeld && trip.sea?.receiptId) {
                            const returned = turnBackPublicPassage(game.atHand!, trip.sea.receiptId, day);
                            if (returned) lines.push('The surviving actual crew turned this hull back toward its departure port.');
                        }
                        if (engage || !rest.escortHeld) stop = 'The actual attack stopped the passage.';
                    } else if (comesAtYou(occurrence)) {
                        // A real account is not a band choosing whether to take
                        // on the escort. Its actual named actor uses the ordinary
                        // arrival/fight authority, which owns standing or settlement.
                        const current = game.currentRun();
                        fight = theyCameAtYou(game, current.run, current.cultivator,
                            game.ambientFor(current.cultivator, current.run),
                            { ...single, firstInterruptDay: occurrence.absoluteDay });
                        stop = occurrence.event.summary;
                    } else if (occurrence.interrupts) stop = occurrence.event.summary;
                    if (!game.currentRun().cultivator.alive || game.currentRun().run.status !== 'active') break;

            }
            nextCheck = cadence.next();
            if (stop || !game.currentRun().cultivator.alive || game.currentRun().run.status !== 'active') break;
        }
        refreshDates();
    };
    // The occasion is due NOW, not at the first subsequent world/body boundary.
    resolveChecksHere();
    const startAfterOccasion = game.currentRun();
    run = startAfterOccasion.run; body = startAfterOccasion.cultivator;
    if (stop || !body.alive || run.status !== 'active') {
        // An actual departure event is an executed result, not a simulated span.
        // No zero-day body application or food draw follows it. A living action
        // still completes once through the existing zero-time authority.
        const why = stop ?? 'The actual body can no longer undertake the passage.';
        const facts = factsForToolResult('The passage was interrupted at departure.', lines);
        facts.structure.push(...structure);
        const halted: Execution = { facts, timeSkip: null, events: [], breakthrough: null,
            outcome: 'executed', nights: binding?.airborne && !binding.vesselId ? 'in_the_open' : 'under_a_roof', calls: [{ name: 'engine.encounterWindow',
                action: 'passage', ok: true, summary: 'Interrupted at actual departure; no travel time was spent.' }],
            cutShort: { askedDays: trip.days, livedDays: 0, cause: 'the_world', what: why } };
        if (finishTurn && body.alive && run.status === 'active' && run.turn < resolvesOnTurn) {
            const completed = game.freeAction(run, 'passage', facts);
            halted.calls.push(...completed.calls);
        }
        if (fight) foldTheFightIn(halted, fight);
        game.theWorldMoved();
        return halted;
    }
    const rationsBefore = game.rationsHeld(body);
    const spent = await spendWithPhysicalCarrier(game, run, body, trip.days,
        trip.focus ?? TRAVEL_FOCUS, source, false, {
            dates, resolvesOnTurn, finishTurn, stop: () => binding?.stop?.() ?? stop, beforeWorld: binding?.beforeWorld,
            afterBoundary: () => {
                const current = source();
                if (!current || current.unavailable || !game.currentRun().cultivator.alive) return;
                const day = routineTime(game.atHand!);
                resolveChecksHere();
                if (meeting && !contactReached && journeyTimeHasReached(day, start + meeting.afterDays)) {
                    contactReached = true;
                    const actual = game.atHand!.npcs.find(person => person.id === meeting.npc.id);
                    if (actual?.status === 'alive' && locationOnNpcJourney(game.atHand!.locations, actual, day)
                        === source()?.locationId) {
                        const place = game.atHand!.locations.find(row => row.id === source()!.locationId)!;
                        if (binding?.overWater && binding.vesselId && isWater(place)
                            && actual.activity?.vesselId !== binding.vesselId) {
                            lines.push('Another real travelling vessel crosses this water.');
                            return;
                        }
                        const observer = game.repos.cultivators.getById(body.id);
                        const area = observer?.alive ? peopleInThisPlace(game.repos, observer, game.atHand!, place).whereIs.get(actual.id) : undefined;
                        if (area) game.repos.cultivators.standIn(body.id, area);
                        lines.push(trip.sea ? 'A real fellow passenger is aboard.' : 'A real traveller is here on the road.');
                        stop ??= 'Another traveller is here.';
                    }
                }
            }
        });
    const fresh = game.currentRun(), actual = source();
    const arrived = fresh.cultivator.alive && !spent.skip.died && !spent.skip.interrupted && !stop
        && actual?.locationId === to.id && journeyTimeHasReached(routineTime(game.atHand!), actual.endsOnDay);
    // A paid seat was bought off a board, and the ticket names where it goes: the name is read, not guessed.
    if(!arrived&&!game.canPointAtLocation(fresh.cultivator,to))game.noteEncounter(fresh.cultivator,fresh.run,
        {kind:'place',id:to.id,name:to.name},'read',`The ticket for the ${trip.service} names ${to.name}.`);
    const destinationKnown=arrived||game.canPointAtLocation(fresh.cultivator,to);
    // Stopped on the water, the first thing said is where the ship is and where it is bound.
    const underWay=!arrived&&fresh.cultivator.alive?theVoyageUnderWay(game.db,fresh.cultivator,game.atHand):null;
    if(underWay)lines.unshift(whereTheShipIs(underWay));
    // What the passage fed them: a ship's rations and then the pack, or a paid seat's meals.
    if(fresh.cultivator.alive&&trip.service!=='air'){
        const rationsLeft=game.rationsHeld(fresh.cultivator);
        lines.push(trip.sea
            ? whatTheHullFed(fresh.cultivator,trip.sea.hullRationDays,Math.round(trip.sea.sailed+spent.skip.simulatedDays),
                Math.max(0,rationsBefore-rationsLeft),rationsLeft)
            : whatWasEatenOnBoard(fresh.cultivator,rationsLeft));
    }
    const facts = factsForToolResult(arrived ? trip.to + ', by ' + trip.service + '.' : 'The actual passage stopped.',
        [...lines, ...spent.applied.tollLines, ...spent.world.lines]);
    facts.structure.push(...structure, ...spent.world.structure);
    if(!destinationKnown){
        facts.lines=facts.lines.map(line=>line.split(to.name).join('the ground ahead'));
        facts.structure=facts.structure.map(line=>line.split(to.name).join('the ground ahead'));
        facts.prose=facts.prose.split(to.name).join('the ground ahead');
    }
    const execution: Execution = { facts, timeSkip: spent.skip, events: spent.skip.events, breakthrough: null,
        outcome: 'executed', nights: binding?.airborne && !binding.vesselId ? 'in_the_open' : 'under_a_roof', calls: [...skipCalls('passage', spent.skip, null), ...worldCalls(spent.world)],
        cutShort: spent.skip.interrupted ? { askedDays: trip.days, livedDays: spent.skip.simulatedDays,
            cause: 'the_world', what: spent.skip.interruptReason ?? stop ?? 'The real carrier stopped.' } : null };
    if (arrived) {
        if (trip.sea) endTheVoyage(game.db, body.id); else if (trip.roadReceiptId) leaveThePaidCarriage(game.db, body.id);
        game.noteEncounter(fresh.cultivator, fresh.run, { kind: 'place', id: trip.to, name: trip.to },
            'witnessed', 'Arrived on the actual accepted passage.');
        afterArrival?.(fresh.cultivator, fresh.run, execution);
    }
    if (fight) foldTheFightIn(execution, fight);
    game.theWorldMoved();
    return execution;
}

/** A lesser action aboard uses the same physical leg rather than only ageing a fraction. */
export async function spendAboardTheShip(game: GameService, run: Run, body: Cultivator, days: number, resolvesOnTurn = run.turn + 1, finishTurn = true) {
    const claim = recordedVoyage(game.db, body.id);
    if (!claim?.receiptId || !game.atHand) return null;
    const source = paidCarrierSource(game, body.id, undefined, claim);
    if (!source || source.unavailable) return refused('engine.actualShipPassage', 'wait', factsForRefusal(
        'The actual ship cannot carry on.', source?.unavailable ?? 'Its source is gone.', 'Nothing spent.'));
    return executeActualPaidPassage(game, run, body, { service: 'ship', to: claim.bound,
        days: Number.isFinite(days) ? days : Math.max(0, source.endsOnDay - routineTime(game.atHand)), 
        walkingDays: 0, stones: 0, escort: 0, bought: 'Time aboard the accepted ship.', sea: claim }, undefined, undefined, resolvesOnTurn, finishTurn);
}

/** Lesser actions and long sits ask the accepted road carrier the same actual-span question. */
export async function spendAboardTheCarriage(game: GameService, run: Run, body: Cultivator,
    days: number, focus?: number, resolvesOnTurn = run.turn + 1, finishTurn = true) {
    const claim = thePaidCarriageClaim(game.db, body.id);
    if (!claim || !game.atHand) return null;
    const held = publicCarriagePassage(game.atHand, claim.receiptId, body.id, routineTime(game.atHand));
    if (!held) return refused('engine.actualCarriagePassage', 'wait', factsForRefusal(
        'The accepted carriage cannot carry on.', 'Its actual carrier is unavailable.', 'Nothing spent.'));
    const to = game.atHand.locations.find(place => place.id === held.leg.toId);
    if (!to) return null;
    return executeActualPaidPassage(game, run, body, { service: 'carriage', to: to.name,
        days: Number.isFinite(days) ? days : held.remainingDays, walkingDays: 0,
        stones: 0, escort: 0, bought: 'Time aboard the same accepted carriage.',
        roadReceiptId: claim.receiptId, focus }, undefined, undefined, resolvesOnTurn, finishTurn);
}
