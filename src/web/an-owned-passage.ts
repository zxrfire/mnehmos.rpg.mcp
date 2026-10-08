import { arrivalCourseOfFact, recordActualBodyArrival } from '../engine/world/a-body-that-actually-arrived.js';
import { beginAnAirCourse, airPositionAt, stopAnAirCourse, actualNpcPilotOfAirCourse, recordPaidAirCourseFuel, paidAirCourseThrough } from '../engine/world/an-air-course-in-the-world.js';

import { companyDuringPassage, companyAfterPassage } from '../engine/world/company-during-a-passage.js';
import { actualCarrierScene, selectedAreaOnActualCarrier } from './the-actual-carrier-scene.js';
import { setLocation } from '../engine/world/npc-state.js';
import { loosePlaceKey } from './knowledge.js';
import { worldLocationFor } from './entities.js';
import { factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
/** A held private craft's active claim refers to one accepted historical leg. */
import type Database from 'better-sqlite3';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { GameService } from './turn-engine.js';
import { readJsonFlag, writeFlag, clearFlag } from '../server/consolidated/cultivation-support.js';
import { CultivatorRepository } from '../storage/repos/cultivator.repo.js';
import { witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { passageRunMoment } from '../engine/world/passage-moment.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { locationOnRoute, locationOnNpcJourney, journeyTimeHasReached } from '../engine/world/places-on-the-way.js';
import { leaveItHere, takeItAlong, whoItIsWith, itWantsAPilot, A_SPIRIT_BOAT_ANSWERS_TO } from '../engine/world/a-vehicle.js';
import { isRuined } from '../engine/world/possessions.js';
import { requireConveyance } from '../data/cultivation/what-a-house-moves-its-people-on.js';
import { priceJourney } from '../engine/world/what-a-conveyance-does-to-a-journey.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { executeActualPaidPassage } from './an-actual-paid-passage.js';
import type { PhysicalCarrier } from './a-physical-span.js';

const ACTIVE = 'owned_passage';
export function ownedPassageClaim(db: Database.Database, playerId: string): { receiptId: string } | null {
    return readJsonFlag<{ receiptId: string }>(db, playerId, ACTIVE);
}

/** Membership names an agreement; only an available body can board a new craft.
 * An already travelling body remains on its own accepted course. Continuations
 * and turn-backs use their existing course authority before this new-booking path. */
export function peopleUnavailableForOwnedBoarding(world: WorldState, ids: readonly string[],
    fromId: string, onDay: number): string[] {
    return [...new Set(ids)].filter(id => {
        const person = world.npcs.find(npc => npc.id === id);
        return !person || person.status !== 'alive' || person.activity?.kind === 'travelling'
            || locationOnNpcJourney(world.locations, person, onDay) !== fromId;
    });
}

/** This is the same custody read used by the ongoing carrier, before and after booking. */
function heldPrivateCraft(world: WorldState, ownerId: string, vesselId: string) {
    const craft = world.objects.find(object => object.id === vesselId);
    return craft && !isRuined(craft) && craft.possessorId === null
        && craft.ownerId === ownerId && whoItIsWith(craft) === ownerId ? craft : null;
}

export function ownedCarrierAt(world: WorldState, receiptId: string, body: Cultivator, onDay: number): PhysicalCarrier | null {
    const fact = witnessIndexFor(world).byId.get(receiptId), data = fact?.data;
    if (!data || data.ownedPassage !== true || data.ownerId !== body.id || typeof data.vesselId !== 'string'
        || typeof data.fromLocationId !== 'string' || typeof data.toLocationId !== 'string'
        || typeof data.departureDay !== 'number' || typeof data.arrivalDay !== 'number'
        || typeof data.conveyanceId !== 'string' || typeof data.pilotId !== 'string') return null;
    const craft = heldPrivateCraft(world, body.id, data.vesselId);
    const kind = requireConveyance(data.conveyanceId);
    const pilot = data.pilotId === body.id ? null : world.npcs.find(npc => npc.id === data.pilotId);
    const airSite = data.airCourse === true
        ? world.locations.find(place => place.tags.includes('air-course') && place.originFactId === receiptId) : null;
    const air = airSite && airPositionAt(world, airSite, onDay);
    const location = airSite && air ? air.kind === 'place' && air.fraction === 1 ? air.locationId : airSite.id : locationOnRoute(world.locations, data.fromLocationId, data.toLocationId,
        Math.max(0, onDay - data.departureDay), data.arrivalDay - data.departureDay,
        kind.crossesGroundThatCannotBeWalked);
    const pilotArrived = pilot?.status === 'alive' && journeyTimeHasReached(onDay, data.arrivalDay)
        && locationOnNpcJourney(world.locations, pilot, onDay) === data.toLocationId
        && pilot.updatedOnDay >= data.arrivalDay;
    const pilotOnThisLeg = pilot?.activity?.vesselId === data.vesselId
        && pilot.activity.sinceDay === data.departureDay && pilot.activity.untilDay === data.arrivalDay;
    const unavailable = !body.alive ? 'The actual pilot/passenger died.'
        : !craft ? 'The actual privately held craft is no longer carrying this leg.'
        : airSite && typeof airSite.data.airStoppedFactId === 'string' ? 'The actual air course stopped at its reached point.'
        : data.pilotId !== body.id && (pilot?.status !== 'alive' || (!pilotOnThisLeg && !pilotArrived))
            ? 'The actual companion pilot no longer carries this leg.'
        : itWantsAPilot(kind) && (pilot?.cultivation.realmOrdinal ?? body.realmOrdinal) < A_SPIRIT_BOAT_ANSWERS_TO
            ? 'The actual pilot cannot guide the craft.' : null;
    return { locationId: pilot && (pilotOnThisLeg || pilotArrived)
            ? locationOnNpcJourney(world.locations, pilot, onDay) : location,
        endsOnDay: data.arrivalDay, boardedOnDay: data.departureDay, boardingMoment: passageRunMoment(world, receiptId), unavailable };
}

export function projectOwnedPassenger(db: Database.Database, world: WorldState, playerId: string, onDay: number): void {
    const claim = ownedPassageClaim(db, playerId);
    if (!claim) return;
    const repos = new CultivatorRepository(db), body = repos.getById(playerId);
    if (!body) return;
    const airSite = world.locations.find(place => place.tags.includes('air-course') && place.originFactId === claim.receiptId);
    if (!body.alive) {
        const data = witnessIndexFor(world).byId.get(claim.receiptId)?.data;
        const craft = world.objects.find(object => object.id === data?.vesselId);
        const ground = worldLocationFor(world, body.location)?.id;
        // A generic transfer/loot/ring write already owns current custody. Never undo it.
        if (craft && ground && craft.ownerId === playerId && craft.possessorId === null
            && whoItIsWith(craft) === playerId) {
            const pilot = world.npcs.find(person => person.id === data?.pilotId);
            const kind = typeof data?.conveyanceId === 'string' ? requireConveyance(data.conveyanceId) : null;
            const surviving = pilot?.status === 'alive' && pilot.activity?.vesselId === craft.id
                && pilot.activity.sinceDay === data?.departureDay && pilot.activity.untilDay === data?.arrivalDay
                && locationOnNpcJourney(world.locations, pilot, onDay) === ground
                && kind && (!itWantsAPilot(kind) || pilot.cultivation.realmOrdinal >= A_SPIRIT_BOAT_ANSWERS_TO);
            if (surviving && !isRuined(craft)) takeItAlong(world.objects, craft, pilot.id);
            else leaveItHere(world.objects, craft, ground);
        }
        if (airSite) {
            const pilot = actualNpcPilotOfAirCourse(world, claim.receiptId);
            const paidThrough = paidAirCourseThrough(world, claim.receiptId);
            const arrival = data?.arrivalDay;
            if (!pilot || paidThrough === null || typeof arrival !== 'number' || !journeyTimeHasReached(paidThrough, arrival))
                stopAnAirCourse(world, airSite, Math.min(onDay, paidThrough ?? onDay),
                    pilot ? 'The surviving operator has no committed fuel beyond this paid point.'
                        : 'The actual flying hull has no surviving operator and custody.');
        }
        clearFlag(db, playerId, ACTIVE);
        return;
    }
    const carrier = ownedCarrierAt(world, claim.receiptId, body, onDay);
    const place = carrier?.locationId && world.locations.find(row => row.id === carrier.locationId);
    if (!carrier || !place) return;
    const fact = witnessIndexFor(world).byId.get(claim.receiptId)!;
    const pilot = world.npcs.find(npc => npc.id === fact.data.pilotId);
    const area = pilot && !carrier.unavailable ? theAreasOf(world, place).whereIs.get(pilot.id) : undefined;
    const carried = repos.update(playerId, { location:place.tags.includes('air-course') ? place.id : place.name,
        standingIn:body.standingIn })!;
    const scene = actualCarrierScene({db}, carried, world, onDay);
    repos.standIn(playerId, scene ? selectedAreaOnActualCarrier(world, scene, carried) : area ?? null);
    if (carrier.unavailable === null && journeyTimeHasReached(onDay, carrier.endsOnDay))
        recordActualBodyArrival(world, { id: carried.id, name: carried.name, alive: carried.alive, locationId: place.id },
            arrivalCourseOfFact(fact), onDay, fact);
    if (carrier.unavailable || journeyTimeHasReached(onDay, carrier.endsOnDay)) clearFlag(db, playerId, ACTIVE);
}

export function acceptOwnedPassage(game: GameService, run: Run, body: Cultivator, input: {
    vesselId: string; pilotId: string; fromId: string; toId: string;
    walkingDays: number; days: number; conveyanceId: string; power: number | null; companions: string[]; air?: boolean;
}): string {
    const world = game.atHand!, departure = routineTime(world);
    // Fail before any receipt, passenger activity, claim or custody mutation.
    if (!body.alive || worldLocationFor(world, body.location)?.id !== input.fromId
        || !heldPrivateCraft(world, body.id, input.vesselId))
        throw new Error('The actual owner and held craft are not available to board here.');
    const unavailable = peopleUnavailableForOwnedBoarding(world, input.companions, input.fromId, departure);
    if (unavailable.length > 0 || input.pilotId !== body.id && !input.companions.includes(input.pilotId))
        throw new Error('The actual selected passengers or pilot are not available to board here.');
    const capacityQuote = priceJourney({ walkingDays: input.walkingDays,
        conveyance: requireConveyance(input.conveyanceId), power: input.power, heads: 1 + input.companions.length });
    if (capacityQuote.trips > 1) throw new Error('The actual selected people exceed this leg capacity: '
        + requireConveyance(input.conveyanceId).heads + ' places including driver, '
        + (1 + input.companions.length) + ' requested. Select the people aboard this leg.');
    const acceptedAir = input.air ? beginAnAirCourse(world, { bodyId: body.id, bodyName: body.name,
        fromId: input.fromId, toId: input.toId, conveyanceId: input.conveyanceId, power: input.power,
        vesselId: input.vesselId, artId: null, onDay: departure, runId: run.id, runElapsedDays: run.elapsedDays,
        heads: 1 + input.companions.length, owned: { ownerId: body.id, pilotId: input.pilotId } }) : null;
    if (input.air && !acceptedAir) throw new Error('Actual owned air endpoints lost their accepted quote');
    const receipt = acceptedAir?.fact ?? appendWorldFact(world, makeFact({ day: departure, kind: 'gathering',

        locationId: input.fromId, visibility: 'secret', summary: 'A private craft began its actual passage.',
        actors: [{ id: body.id, name: body.name, role: 'pilot_or_passenger' }],
        data: { ownedPassage: true, ownerId: body.id, vesselId: input.vesselId, pilotId: input.pilotId,
            fromLocationId: input.fromId, toLocationId: input.toId, departureDay: departure,
            arrivalDay: departure + input.days, conveyanceId: input.conveyanceId, conveyancePower: input.power,
            walkingDays: input.walkingDays, heads: 1 + input.companions.length, runId: run.id, boardingRunElapsedDays: run.elapsedDays }
    }), { recur: false, bystanders: false });
    if (acceptedAir) game.repos.cultivators.update(body.id, { location: acceptedAir.location.id, standingIn: null });
    for (const id of input.companions) {
        const at = world.npcs.findIndex(person => person.id === id && person.status === 'alive');
        if (at < 0) continue;
        const person = world.npcs[at]!;
        world.npcs[at] = { ...person, ...(acceptedAir ? { locationId: acceptedAir.location.id } : {}), activity: companyDuringPassage(person.activity, { ...person.activity, kind: 'travelling',
            note: person.activity?.note ?? 'On the privately held craft.',
            withIds: [body.id, ...input.companions.filter(other => other !== id)],
            fromLocationId: input.fromId, returnTo: input.toId, sinceDay: departure, untilDay: departure + input.days,
            conveyanceId: input.conveyanceId, conveyancePower: input.power, vesselId: input.vesselId,
            ...(acceptedAir ? { airCourseLocationId: acceptedAir.location.id } : {}) }, departure) };
    }
    writeFlag(game.db, body.id, ACTIVE, JSON.stringify({ receiptId: receipt.id }));
    game.theWorldMoved();
    return receipt.id;
}

export async function spendOnOwnedPassage(game: GameService, run: Run, body: Cultivator, days: number,
    focus?: number, resolvesOnTurn = run.turn + 1, departureOccasion = false, finishTurn = true) {
    const claim = ownedPassageClaim(game.db, body.id), world = game.atHand;
    if (!claim || !world) return null;
    const receipt = witnessIndexFor(world).byId.get(claim.receiptId);
    if (!receipt || typeof receipt.data.toLocationId !== 'string') return null;
    const data = receipt.data;
    const destination = world.locations.find(place => place.id === data.toLocationId);
    if (!destination || typeof data.walkingDays !== 'number' || typeof data.departureDay !== 'number'
        || typeof data.arrivalDay !== 'number' || typeof data.conveyanceId !== 'string' || typeof data.heads !== 'number') return null;
    const conveyance = requireConveyance(data.conveyanceId);
    const departure = data.departureDay, duration = data.arrivalDay - departure;
    const fuelThrough = (day: number) => day <= departure ? 0 : priceJourney({ walkingDays: data.walkingDays as number
        * Math.min(duration, Math.max(0, day - departure)) / duration, conveyance,
        power: typeof data.conveyancePower === 'number' ? data.conveyancePower : null,
        heads: data.heads as number, preciseDays: data.airCourse === true }).stonesBurned;
    let burned = fuelThrough(routineTime(world)), lost: string | null = null;
    const paidBefore = burned;
    const needed = fuelThrough(data.arrivalDay) - burned;
    const actualBody = game.repos.cultivators.getById(body.id) ?? body;
    if (needed > actualBody.spiritStones) return refused('engine.priceJourney', 'ride', factsForRefusal(
        'Not enough fuel to continue.', needed + ' spirit stones are needed; ' + actualBody.spiritStones + ' are held.',
        'The accepted craft was not replaced and no time was spent.'));
    const source = (onDay = routineTime(game.atHand!)) => ownedCarrierAt(game.atHand!, claim.receiptId,
        game.repos.cultivators.getById(body.id) ?? body, onDay);
    const execution = await executeActualPaidPassage(game, run, body, { service: data.airCourse === true ? 'air' : conveyance.crossesGroundThatCannotBeWalked ? 'ship' : 'carriage', to: destination.name,
        days: Number.isFinite(days) ? days : Math.max(0, data.arrivalDay - routineTime(world)), 
        walkingDays: data.walkingDays, stones: 0, escort: 0,
        bought: 'Aboard the privately held ' + conveyance.name + '.', focus, departureOccasion }, undefined, {
            source, overWater: data.airCourse !== true && conveyance.crossesGroundThatCannotBeWalked,
            airborne: data.airCourse === true, vesselId: String(data.vesselId),
            crew: () => game.atHand!.npcs.filter(person => person.status === 'alive'
                && person.activity?.vesselId === data.vesselId && person.activity.sinceDay === departure),
            beforeWorld: day => {
                const owed = fuelThrough(day) - burned;
                const fresh = game.repos.cultivators.getById(body.id)!;
                if (owed > fresh.spiritStones) { lost = 'The actual craft no longer has its required fuel.'; return; }
                if (owed > 0) game.repos.cultivators.applyDeltas(body.id, { spiritStones: -owed });
                burned += owed;
                if (data.airCourse === true) recordPaidAirCourseFuel(game.atHand!, receipt.id,
                    body.id, Math.min(day, data.arrivalDay as number), owed);
            },
            stop: () => lost ?? (fuelThrough(data.arrivalDay as number) - fuelThrough(routineTime(game.atHand!))
                > (game.repos.cultivators.getById(body.id)?.spiritStones ?? 0)
                    ? 'The actual fuel no longer covers the remaining passage.' : null)
        }, resolvesOnTurn, finishTurn);
    // Final world consequences may have killed the SQL body after the callback's projection.
    projectOwnedPassenger(game.db, game.atHand!, body.id, routineTime(game.atHand!));
    if (data.airCourse === true && (execution.cutShort || execution.timeSkip?.interrupted
        || !game.currentRun().cultivator.alive)) {
        const site = game.atHand!.locations.find(place => place.tags.includes('air-course') && place.originFactId === receipt.id);
        const paidThrough = paidAirCourseThrough(game.atHand!, receipt.id);
        if (site && (!actualNpcPilotOfAirCourse(game.atHand!, receipt.id)
            || paidThrough === null || !journeyTimeHasReached(paidThrough, data.arrivalDay)))
            stopAnAirCourse(game.atHand!, site, Math.min(routineTime(game.atHand!), paidThrough ?? routineTime(game.atHand!)),
                execution.cutShort?.what ?? execution.timeSkip?.interruptReason ?? 'The actual craft stopped at its paid point.');
    }
    const fuelLine = (burned - paidBefore) + ' spirit stones burned in the actual craft during this span.';
    execution.facts.lines.push(fuelLine);
    execution.calls.push({ name: 'engine.priceJourney', action: 'ride', ok: true, summary: fuelLine });
    return execution;
}

/** An explicit changed destination ends this active course on its actual ground. */
export async function continueOwnedPassage(game: GameService, run: Run, body: Cultivator,
    target: string | undefined) {
    const claim = ownedPassageClaim(game.db, body.id);
    if (!claim || !game.atHand) return null;
    const fact = witnessIndexFor(game.atHand).byId.get(claim.receiptId);
    const to = game.atHand.locations.find(place => place.id === fact?.data.toLocationId);
    const said = (target ?? '').trim();
    if (!said || /^(?:on|onward|onwards|ahead|forward)$/i.test(said)
        || loosePlaceKey(said) === loosePlaceKey(to?.name ?? ''))
        return spendOnOwnedPassage(game, run, body, Number.POSITIVE_INFINITY);
    const actual = ownedCarrierAt(game.atHand, claim.receiptId, body, routineTime(game.atHand));
    const craft = game.atHand.objects.find(object => object.id === fact?.data.vesselId);
    if (craft && actual?.locationId) {
        const airSite = game.atHand.locations.find(place => place.tags.includes('air-course') && place.originFactId === claim.receiptId);
        if (airSite) stopAnAirCourse(game.atHand, airSite, routineTime(game.atHand), 'The actual operator ended this course to change destination.');
        leaveItHere(game.atHand.objects, craft, actual.locationId);
        for (let i = 0; i < game.atHand.npcs.length; i++) {
            const person = game.atHand.npcs[i]!;
            const doing = person.activity;
            if (person.status !== 'alive' || doing?.kind !== 'travelling'
                || doing.vesselId !== craft.id || doing.sinceDay !== fact?.data.departureDay
                || doing.untilDay !== fact?.data.arrivalDay) continue;
            const activity = { ...doing, kind: 'the_work_of_their_rank' as const, withIds: [] };
            delete activity.fromLocationId; delete activity.returnTo; delete activity.untilDay;
            delete activity.vesselId; delete activity.seaLaneId; delete activity.passageCompany;
            delete activity.conveyanceId; delete activity.conveyancePower; delete activity.airCourseLocationId;
            game.atHand.npcs[i] = { ...setLocation(person, actual.locationId, routineTime(game.atHand)), activity: companyAfterPassage(person, routineTime(game.atHand)) ?? activity };
        }
    }
    clearFlag(game.db, body.id, ACTIVE);
    game.theWorldMoved();
    return null;
}
