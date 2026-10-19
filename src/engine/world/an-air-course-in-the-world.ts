import { recordNpcActualArrival, type ActualArrivalBody } from './a-body-that-actually-arrived.js';
import type { NpcRecord } from './npc-state.js';
import { setLocation, isTheWorldsToMove, PLAYER_ROW_TAG } from './npc-state.js';
import { whoItIsWith, itWantsAPilot, A_SPIRIT_BOAT_ANSWERS_TO } from './a-vehicle.js';
import { isRuined,transferPossession } from './possessions.js';
import { journeyTimeHasReached } from './places-on-the-way.js';
import { LI_PER_WALKING_DAY } from './the-metric-ground-under-a-journey.js';
/**
 * An actual airborne site refers to one accepted leg and, after interruption,
 * its caused stop fact. Objects, bodies and deeds can point at this ordinary
 * location ID; the site stores no copied coordinate, road link or endpoint.
 */
import type { WorldState } from './world-state.js';
import { getNpc, getObject, getLocation } from './world-state.js';
import { makeLocation, makeEnvironment, type LocationRecord } from './locations.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import { acceptedAirCourse, positionOnAcceptedAirCourse } from './position-on-an-accepted-air-course.js';
import { quoteAnAirJourney, conveyanceOfPersonalFlight } from './what-an-air-journey-takes.js';
import { requireConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';

export function airPositionAt(world: WorldState, place: LocationRecord, onDay: number) {
    if (!place.tags.includes('air-course') || typeof place.data.airCourseId !== 'string'
        || typeof place.data.bodyId !== 'string') return null;
    const index = witnessIndexFor(world), fact = index.byId.get(place.data.airCourseId);
    const course = fact && acceptedAirCourse(fact, place.data.bodyId);
    if (!course) return null;
    const stopId = place.data.airStoppedFactId;
    const stopped = typeof stopId === 'string' ? index.byId.get(stopId) : null;
    if (typeof stopId === 'string' && !stopped) return null;
    return positionOnAcceptedAirCourse(world.locations, course, onDay, stopped, { facts: index.byId, onDay });
}

/** Readiness and launch debit belong to the caller before this actual acceptance. */
export function readAnAirCourseAdmission(world: WorldState, input: {
    bodyId: string; bodyName: string; fromId: string; toId: string; conveyanceId: string;
    power: number | null; vesselId: string | null; artId: string | null;
    onDay: number; runId?: string; runElapsedDays?: number; heads: number;
    owned?: { ownerId: string; pilotId: string }; priorReceiptId?:string; changedCourse?:boolean;
    houseDutyFunding?: { houseId: string; returnStones: number };
    houseDutyReturnOf?: string;
    actualLoad?: readonly {id:string;name:string}[];
    actualPlayerContact?: ActualArrivalBody;
    houseDutyDispatchId?: string;
    dutyCauses?: readonly string[];
    houseDutyPhase?: 'delivery'|'collecting'|'homebound'|'reloading';
}) {
    const worldBody = input.runId === undefined && input.runElapsedDays === undefined;
    if (worldBody && !world.npcs.some(npc => npc.id === input.bodyId && npc.status === 'alive')) return null;
    if (!worldBody && (typeof input.runId !== 'string' || typeof input.runElapsedDays !== 'number'
        || !Number.isFinite(input.runElapsedDays))) return null;
    const from = world.locations.find(place => place.id === input.fromId);
    const to = world.locations.find(place => place.id === input.toId);
    const conveyance = input.vesselId === null ? conveyanceOfPersonalFlight(input.artId)
        : requireConveyance(input.conveyanceId);
    if (!conveyance) return null;
    const quote = quoteAnAirJourney(world.locations, input.fromId, input.toId,
        conveyance, input.power, input.heads, { facts: witnessIndexFor(world).byId, onDay: input.onDay },
        input.owned ? 1 : 0);
    if (!from || !to || !quote || !(quote.daysForEverybody > 0) || quote.trips !== 1) return null;
    if(input.actualLoad&&(input.actualLoad.length!==input.heads||new Set(input.actualLoad.map(person=>person.id)).size!==input.heads
        ||!input.actualLoad.some(person=>person.id===input.bodyId)
        ||input.actualLoad.some(person=>!world.npcs.some(npc=>npc.id===person.id&&npc.status==='alive'
            &&(npc.locationId===from.id || npc.tags.includes(PLAYER_ROW_TAG)
                &&input.actualPlayerContact?.id===npc.id &&input.actualPlayerContact.alive
                &&input.actualPlayerContact.locationId===from.id)))))return null;
    const prior=input.priorReceiptId?witnessIndexFor(world).byId.get(input.priorReceiptId):null;
    if(input.priorReceiptId&&(!prior||prior.data.ownedPassage!==true
        ||prior.data.ownerId!==input.owned?.ownerId||prior.data.vesselId!==input.vesselId
        ||prior.data.pilotId!==input.owned?.pilotId))return null;
    return {from,to,conveyance,quote,prior,worldBody};
}

/** The same pure admission read is used before and at actual acceptance. */
export function beginAnAirCourse(world: WorldState, input: Parameters<typeof readAnAirCourseAdmission>[1]) {
    const read=readAnAirCourseAdmission(world,input);
    if(!read)return null;
    const {from,to,conveyance,quote,prior,worldBody}=read;
    const fact = appendWorldFact(world, makeFact({ causes:[...(prior?[prior.id]:[]),...(input.houseDutyDispatchId?[input.houseDutyDispatchId]:[]),...(input.dutyCauses??[])], day: input.onDay, kind: 'gathering',
        locationId: from.id, visibility: 'secret', summary: 'An actual direct air course began.',
        actors: input.actualLoad?.map(person=>({id:person.id,name:person.name,role:'traveller'}))
            ?? [{ id: input.bodyId, name: input.bodyName, role: 'traveller' }],
        data: { airCourse: true, bodyId: input.bodyId, fromLocationId: from.id, toLocationId: to.id,
            conveyanceId: conveyance.id, conveyancePower: input.power, vesselId: input.vesselId,
            artId: input.artId, departureDay: input.onDay, arrivalDay: input.onDay + quote.daysOneWay,
            runId: input.runId ?? null, boardingRunElapsedDays: input.runElapsedDays ?? null,
            ...(worldBody ? { worldClockAirCourse: true } : {}),
            ...(input.houseDutyFunding ? { houseDutyHouseId: input.houseDutyFunding.houseId,
                houseDutyReturnStones: input.houseDutyFunding.returnStones } : {}),
            ...(input.houseDutyDispatchId?{houseDutyDispatchId:input.houseDutyDispatchId,houseDutyPhase:input.houseDutyPhase}:{}),
            ...(input.houseDutyReturnOf ? { houseDutyReturnOf: input.houseDutyReturnOf } : {}),
            ...(input.changedCourse ? { changedOwnedCourse:true } : {}),
            ...(input.owned ? { ownedPassage: true, ownerId: input.owned.ownerId, pilotId: input.owned.pilotId,
                walkingDays: quote.distanceLi / LI_PER_WALKING_DAY, heads: input.heads } : {}) }
    }), { recur: false, bystanders: false });
    const location = makeLocation({ id: 'loc-air-course-' + fact.id, name: 'In the air', kind: 'wilds',
        layer: from.layer, discovered: false, originFactId: fact.id, tags: ['air-course'], qiDensity: 0,
        environment: makeEnvironment({ spiritualDensity: 0 }), links: [],
        data: { airCourseId: fact.id, bodyId: input.bodyId, airStoppedFactId: null } });
    world.locations.push(location);
    return { fact, location, quote };
}

/** A native interruption/death has a real position; neither endpoint is invented. */
export function stopAnAirCourse(world: WorldState, place: LocationRecord, onDay: number, reason: string) {
    const position = airPositionAt(world, place, onDay);
    if (!position || (position.kind === 'place' && position.fraction === 1)
        || typeof place.data.airStoppedFactId === 'string') return null;
    const courseId = String(place.data.airCourseId);
    const fact = appendWorldFact(world, makeFact({ day: onDay, kind: 'gathering', locationId: place.id,
        visibility: 'secret', summary: 'An actual air course stopped at its current physical point.',
        causes: [courseId], data: { airCourseStopped: courseId,
            bodyId: place.data.bodyId, reason }
    }), { recur: false, bystanders: false });
    place.data.airStoppedFactId = fact.id;
    return fact;
}

/** Record only a native debit already made by its actual payer. No new purse or rate. */
export function recordPaidAirCourseFuel(world: WorldState, receiptId: string, payerId: string,
    throughDay: number, stonesDebited: number, paidOnDay = throughDay) {
    const course = witnessIndexFor(world).byId.get(receiptId);
    const data = course?.data;
    if (!course || data?.airCourse !== true || data.ownedPassage !== true
        || typeof data.departureDay !== 'number' || typeof data.arrivalDay !== 'number'
        || !Number.isFinite(throughDay) || !Number.isFinite(paidOnDay)
        || paidOnDay < data.departureDay || paidOnDay > throughDay
        || !Number.isFinite(stonesDebited) || stonesDebited < 0
        || throughDay < data.departureDay || throughDay > data.arrivalDay) return null;
    return appendWorldFact(world, makeFact({ day: paidOnDay, kind: 'gathering',
        locationId: course.locationId, visibility: 'secret', causes: [receiptId],
        summary: 'The actual payer supplied the native fuel for part of an accepted air course.',
        data: { airFuelPaidFor: receiptId, payerId, throughDay, stonesDebited }
    }), { recur: false, bystanders: false });
}

/** Existing causal-index rows expose paid movement without reading another person's purse. */
export function paidAirCourseThrough(world: WorldState, receiptId: string): number | null {
    const index = witnessIndexFor(world), data = index.byId.get(receiptId)?.data;
    if (data?.airCourse !== true || data.ownedPassage !== true
        || typeof data.departureDay !== 'number' || typeof data.arrivalDay !== 'number') return null;
    let through = data.departureDay;
    for (const fact of index.references.get(receiptId) ?? []) {
        const payment = fact.data;
        if (payment.airFuelPaidFor !== receiptId || !fact.causes.includes(receiptId)
            || typeof payment.payerId !== 'string' || typeof payment.throughDay !== 'number'
            || typeof payment.stonesDebited !== 'number' || payment.stonesDebited < 0
            || payment.throughDay < data.departureDay || payment.throughDay > data.arrivalDay) continue;
        through = Math.max(through, payment.throughDay);
    }
    return through;
}

/** A living actual operator can steer a real hull independently of its owner's life. */
export function actualNpcPilotOfAirCourse(world: WorldState, receiptId: string) {
    const data = witnessIndexFor(world).byId.get(receiptId)?.data;
    if (!data || data.airCourse !== true || typeof data.pilotId !== 'string'
        || typeof data.vesselId !== 'string' || typeof data.conveyanceId !== 'string') return null;
    const pilot = getNpc(world, data.pilotId);
    const craft = getObject(world, data.vesselId);
    const conveyance = requireConveyance(data.conveyanceId);
    const held = craft && whoItIsWith(craft);
    const site = pilot?.activity?.airCourseLocationId ? getLocation(world, pilot.activity.airCourseLocationId) : null;
    return pilot?.status === 'alive' && craft && !isRuined(craft)
        && (held === pilot.id || held === data.ownerId)
        && (!itWantsAPilot(conveyance) || pilot.cultivation.realmOrdinal >= A_SPIRIT_BOAT_ANSWERS_TO)
        && pilot.activity?.vesselId === craft.id
        && site?.id === pilot.locationId && site.data.airCourseId === receiptId
        && typeof site.data.airStoppedFactId !== 'string' ? pilot : null;
}

/** World-owned operators can lose their course after the SQL passenger has died. */
export function settleNpcPilotedAirCourses(world: WorldState, onDay: number): void {
    for (const site of world.locations) {
        if (!site.tags.includes('air-course') || typeof site.data.airStoppedFactId === 'string'
            || typeof site.data.airCourseId !== 'string') continue;
        const fact = witnessIndexFor(world).byId.get(site.data.airCourseId), data = fact?.data;
        if (!data || data.ownedPassage !== true || typeof data.pilotId !== 'string'
            || typeof data.arrivalDay !== 'number') continue;
        const pilot = getNpc(world, data.pilotId);
        if (data.pilotId === data.bodyId && (!pilot || !isTheWorldsToMove(pilot))
            && !world.npcs.some(npc => npc.id === data.bodyId && isTheWorldsToMove(npc))) continue;
        // SQL operators are checked by their actual held-body caller, not fabricated here.
        const paidThrough = paidAirCourseThrough(world, site.data.airCourseId);
        if (actualNpcPilotOfAirCourse(world, site.data.airCourseId)
            && paidThrough !== null && journeyTimeHasReached(paidThrough, onDay)) continue;
        if (paidThrough !== null && !journeyTimeHasReached(paidThrough, onDay) && !journeyTimeHasReached(paidThrough, data.arrivalDay)) {
            stopAnAirCourse(world, site, paidThrough, 'The accepted course has no committed fuel beyond its paid point.');
            continue;
        }
        if (onDay >= data.arrivalDay && !(pilot?.diedOnDay != null && pilot.diedOnDay < data.arrivalDay)) continue;
        const lostOnDay = pilot?.diedOnDay != null && typeof data.departureDay === 'number'
            && pilot.diedOnDay >= data.departureDay && pilot.diedOnDay <= onDay ? pilot.diedOnDay : onDay;
        stopAnAirCourse(world, site, lostOnDay, 'The actual hull operator or custody no longer carries this course.');
    }
}

/** A world person's own flight ends where its actual life ended, before estate projection.
 * A hull's motion is decided separately by its actual surviving operator and paid fuel. */
export function stopPersonalNpcAirCourseAtDeath(world: WorldState, deceased: NpcRecord, onDay: number): void {
    if (!deceased.locationId) return;
    const site=world.locations.find(place=>place.id===deceased.locationId && place.tags.includes('air-course'));
    const fact=site && typeof site.data.airCourseId==='string'
        ? witnessIndexFor(world).byId.get(site.data.airCourseId) : undefined;
    if (!site || fact?.data.bodyId!==deceased.id || fact.data.ownedPassage===true) return;
    stopAnAirCourse(world,site,onDay,'The actual flying body died at this point.');
}

/** Only a living traveller with the same unsuperseded course may write an arrival.
 * Dead personal bodies keep their caused point. Stopped sites never become endpoints. */
export function settleWorldAirTravellers(world: WorldState, onDay: number, personIds?: ReadonlySet<string>): void {
    const sites=personIds?null:new Map(world.locations.filter(place=>place.tags.includes('air-course')).map(place=>[place.id,place]));
    const selected=personIds?[...personIds].map(id=>world.npcs.findIndex(person=>person.id===id)).filter(at=>at>=0)
        :world.npcs.keys();
    for(const at of selected) {
        const npc=world.npcs[at], site=npc.locationId ? personIds
            ? world.locations.find(place=>place.id===npc.locationId&&place.tags.includes('air-course'))
            : sites!.get(npc.locationId) : undefined;
        if(!site || typeof site.data.airCourseId!=='string' || typeof site.data.airStoppedFactId==='string') continue;
        const fact=witnessIndexFor(world).byId.get(site.data.airCourseId), data=fact?.data;
        if(!fact || !data || typeof data.arrivalDay!=='number' || typeof data.toLocationId!=='string') continue;
        if(data.ownedPassage!==true && data.bodyId===npc.id) {
            if(npc.status!=='alive') {
                stopPersonalNpcAirCourseAtDeath(world,npc,npc.diedOnDay??onDay);
                continue;
            }
            if(npc.activity?.airCourseLocationId!==site.id) {
                stopAnAirCourse(world,site,onDay,'The actual flying body no longer maintains this accepted course.');
                continue;
            }
        }
        if(npc.status!=='alive' || npc.activity?.airCourseLocationId!==site.id
            || !journeyTimeHasReached(onDay,data.arrivalDay)) continue;
        if (typeof data.vesselId === 'string') {
            const objectAt=world.objects.findIndex(row=>row.id===data.vesselId && row.locationId===site.id);
            const row=world.objects[objectAt];
            if(row) {
                const returned=typeof data.houseDutyReturnOf==='string' && row.ownerId===data.ownerId
                    && row.possessorId===data.pilotId ? transferPossession(row,{onDay,toHolderId:null,
                        toHolderName:row.ownerName??'the house store',how:'unknown',factId:fact.id,
                        source:'Returned from the actual house duty',note:'The original loan reached home.'}) : row;
                world.objects[objectAt]={...returned,locationId:data.toLocationId,
                    data:{...returned.data,...(returned!==row?{withId:data.ownerId,mooredAt:data.toLocationId}:{})}};
            }
        }
        const arrived=setLocation(npc,data.toLocationId,onDay);
        world.npcs[at]={...arrived, activity:{...npc.activity,airCourseLocationId:undefined}};
        recordNpcActualArrival(world, world.npcs[at]!, npc.activity!, onDay);
    }
}
