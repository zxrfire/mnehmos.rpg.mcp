import { positionOnRoad, roadContinuationTo, positionOnAdmittedRoad, type RoadContinuation, type RoadPosition } from './road-course.js';
import {walkingRouteFrom} from './locations.js';
import { groundWhereACarriageStopped } from './where-a-carriage-stopped.js';
import { admittedRoadWalkingPace } from './the-pace-an-admitted-road-keeps.js';
import { companyDuringPassage, companyAfterPassage } from './company-during-a-passage.js';
/** Advertised road passage on one ordinary carriage and its actual driver. */
import { createNpc, setLocation, PLAYER_ROW_TAG, isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { aVehicleOf, isWithThem, leaveItHere, whoItIsWith, whereItStands } from './a-vehicle.js';
import { getConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import { daysByConveyance } from './what-a-conveyance-does-to-a-journey.js';
import { walkingDaysFrom } from './locations.js';
import { locationOnNpcJourney, roadPositionOfNpc, journeyNeedsWater, journeyTimeHasReached } from './places-on-the-way.js';
import { isTerminal } from '../cultivation/existence.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue, witnessIndexFor } from './witness-reaction-index.js';
import { isRuined, type ObjectRecord } from './possessions.js';
import type { PassageRunMoment } from './passage-moment.js';
import type { WorldState } from './world-state.js';
import { routineTime } from './npc-routines.js';

const PUBLIC_ROAD = 'public-road-service';

/** A historical accepted course, not another current position. */
export interface PublicRoadLeg {
    vesselId: string;
    driverId: string;
    fromId: string;
    toId: string;
    departureDay: number;
    arrivalDay: number;
    conveyanceId: string;
}

export interface PublicRoadQuote extends PublicRoadLeg {
    /** Immutable purchase inputs; the station has already quoted this price. */
    fareStones: number;
    passengerIds: readonly string[];
    hired: boolean;
    /** The ordinary road distance, read from the existing graph. */
    walkingDays: number;
    /** Transient SQL-backed played presence at this synchronous acceptance. Never persisted. */
    playedPassenger?: { id: string; locationId: string; alive: boolean };
}

/** Both directions of an advertised line use the same source carriage. */
export function carriageIdForRoad(fromId: string, toId: string, conveyanceId: string): string {
    return `public-carriage:${JSON.stringify([...[fromId, toId].sort(), conveyanceId])}`;
}

function vehicleFor(world: WorldState, id: string): ObjectRecord | undefined {
    return world.objects.find(object => object.id === id && object.tags.includes(PUBLIC_ROAD));
}

/** This object's holder is the only live source of its ground. */
export function publicCarriageGround(world: WorldState, vehicle: ObjectRecord, day: number): string | null {
    const withId = vehicle.possessorId ?? whoItIsWith(vehicle);
    const holder = withId ? world.npcs.find(npc => npc.id === withId) : undefined;
    return holder ? locationOnNpcJourney(world.locations, holder, day) : whereItStands(vehicle);
}

function legOf(fact: HistoricalFact): PublicRoadLeg | null {
    const data = fact.data;
    if (data.publicPassage !== true || data.service !== 'carriage'
        || typeof data.vesselId !== 'string' || typeof data.driverId !== 'string'
        || typeof data.fromLocationId !== 'string' || typeof data.toLocationId !== 'string'
        || typeof data.departureDay !== 'number' || typeof data.arrivalDay !== 'number'
        || typeof data.conveyanceId !== 'string') return null;
    return { vesselId: data.vesselId, driverId: data.driverId, fromId: data.fromLocationId,
        toId: data.toLocationId, departureDay: data.departureDay, arrivalDay: data.arrivalDay,
        conveyanceId: data.conveyanceId };
}

export function publicCarriageReceipt(world: WorldState, receiptId: string, passengerId: string): {
    receipt: HistoricalFact; leg: PublicRoadLeg
} | null {
    const receipt = witnessIndexFor(world).byId.get(receiptId);
    const leg = receipt && legOf(receipt);
    return receipt && leg && receipt.actors.some(actor => actor.id === passengerId && actor.role === 'passenger')
        ? { receipt, leg } : null;
}

/** A forgotten dead holder does not erase the ordinary vehicle's parked ground. */
export function groundOfTheAcceptedCarriage(world: WorldState, receiptId: string, passengerId: string, day: number): string | null {
    const receipt = witnessIndexFor(world).byId.get(receiptId);
    if (!receipt || receipt.data.service !== 'carriage'
        || !receipt.actors.some(actor => actor.id === passengerId && actor.role === 'passenger')
        || typeof receipt.data.vesselId !== 'string') return null;
    const leg=legOf(receipt);if(leg&&oldCarriageLandfall(world,receipt,leg,day))return leg.toId;
    const vehicle = vehicleFor(world, receipt.data.vesselId);
    return vehicle && vehicle.possessorId === null
        ? publicCarriageGround(world, vehicle, day) : null;
}

function activeReceipts(world: WorldState, vehicleId: string, day: number): HistoricalFact[] {
    return factsWithDataValue(world, 'vesselId', vehicleId).filter(fact => {
        const leg = legOf(fact);
        return leg !== null && journeyTimeHasReached(day,leg.departureDay) && !journeyTimeHasReached(day,leg.arrivalDay)
            && !factsWithDataValue(world,'vesselId',vehicleId).some(next=>next.data.changedCarriageCourse===true&&next.day<=day&&next.causes.includes(fact.id));
    });
}

/** Pure preflight: no actor, object, receipt, purse or timetable is changed. */
export interface PublicRoadQuoteInput {
    fromId: string; toId: string; day: number; conveyanceId: string;
    passengerIds: readonly string[]; fareStones: number; hired: boolean;
    playedPassenger?: { id: string; locationId: string; alive: boolean };
    /** A real existing service hull, never permission to mint one at another road. */
    actualVesselId?: string;
}
export type PublicRoadAssessment = { quote: PublicRoadQuote; refusal: null } | {
    quote: null;
    refusal: { kind: 'capacity'; requestedPassengers: number; remainingPassengers: number }
        | { kind: 'unavailable' };
};

/** Legacy quote callers read the same pure assessment, without a second seat calculation. */
export function quotePublicCarriage(world: WorldState, input: PublicRoadQuoteInput): PublicRoadQuote | null {
    return assessPublicCarriage(world, input).quote;
}

/** An actual operator may offer an admitted onward road on their existing hull.
 * The same native assessment owns route/water, body, capacity, custody and dates.
 * This pure query cannot realise a second carriage or driver. */
export function quotePublicCarriageOnActualHull(world:WorldState,vesselId:string,input:PublicRoadQuoteInput):PublicRoadQuote|null {
    return assessPublicCarriage(world,{...input,actualVesselId:vesselId}).quote;
}

/** Native availability and refusal counts come from this one reservation/source resolver. */
export function assessPublicCarriage(world: WorldState, input: PublicRoadQuoteInput): PublicRoadAssessment {
    const conveyance = getConveyance(input.conveyanceId);
    const passengers = [...new Set(input.passengerIds)];
    if (!conveyance || conveyance.crossesGroundThatCannotBeWalked || passengers.length === 0) return { quote: null, refusal: { kind: 'unavailable' } };
    if (passengers.length + 1 > conveyance.heads) return { quote: null, refusal: { kind: 'capacity',
        requestedPassengers: passengers.length, remainingPassengers: Math.max(0, conveyance.heads - 1) } };
    if (!Number.isFinite(input.fareStones) || input.fareStones < 0
        || journeyNeedsWater(world.locations, input.fromId, input.toId)) return { quote: null, refusal: { kind: 'unavailable' } };
    for (const id of passengers) {
        const person = world.npcs.find(npc => npc.id === id);
        if (person?.tags.includes(PLAYER_ROW_TAG)) {
            const played = input.playedPassenger;
            if (!played || played.id !== id || !played.alive || played.locationId !== input.fromId) return { quote: null, refusal: { kind: 'unavailable' } };
        } else if (person && (person.status !== 'alive'
            || locationOnNpcJourney(world.locations, person, input.day) !== input.fromId)) return { quote: null, refusal: { kind: 'unavailable' } };
    }
    const walking = walkingDaysFrom(world.locations, input.fromId).get(input.toId);
    if (walking === undefined || walking <= 0) return { quote: null, refusal: { kind: 'unavailable' } };
    const vesselId = input.actualVesselId ?? carriageIdForRoad(input.fromId, input.toId, conveyance.id);
    const carriage = vehicleFor(world, vesselId);
    if(input.actualVesselId && (!carriage || carriage.data.conveyanceId!==conveyance.id))
        return {quote:null,refusal:{kind:'unavailable'}};
    let driverId = `${vesselId}:driver:${world.history.nextFactSeq}`;
    let departureDay = input.day;
    let arrivalDay = input.day + daysByConveyance(walking, conveyance);
    if (carriage) {
        if (carriage.possessorId !== null || isRuined(carriage)
            || publicCarriageGround(world, carriage, input.day) !== input.fromId) return { quote: null, refusal: { kind: 'unavailable' } };
        const driver = world.npcs.find(npc => npc.id === whoItIsWith(carriage));
        if (driver && !isTerminal(driver.status)) {
            if (driver.status !== 'alive' || driver.id !== carriage.ownerId
                || !isWithThem(carriage, driver.id, input.fromId)) return { quote: null, refusal: { kind: 'unavailable' } };
            driverId = driver.id;
            const doing = driver.activity;
            if (doing?.kind === 'travelling' && doing.untilDay != null && !journeyTimeHasReached(input.day,doing.untilDay)) {
                if (doing.vesselId !== vesselId || doing.fromLocationId !== input.fromId
                    || doing.returnTo !== input.toId || !journeyTimeHasReached(input.day, doing.sinceDay)
                    || !journeyTimeHasReached(doing.sinceDay, input.day)) return { quote: null, refusal: { kind: 'unavailable' } };
                departureDay = doing.sinceDay;
                arrivalDay = doing.untilDay;
            }
        } else if (whoItIsWith(carriage) !== null) return { quote: null, refusal: { kind: 'unavailable' } };
    }
    const reservations = activeReceipts(world, vesselId, input.day);
    if (reservations.some(receipt => receipt.data.hired === true || input.hired)) return { quote: null, refusal: { kind: 'unavailable' } };
    const already = new Set(reservations.flatMap(receipt => receipt.actors
        .filter(actor => actor.role === 'passenger').map(actor => actor.id)));
    if (passengers.some(id => already.has(id))) return { quote: null, refusal: { kind: 'unavailable' } };
    if (already.size + passengers.length + 1 > conveyance.heads) return { quote: null, refusal: { kind: 'capacity',
        requestedPassengers: passengers.length, remainingPassengers: Math.max(0, conveyance.heads - already.size - 1) } };
    return { quote: { vesselId, driverId, fromId: input.fromId, toId: input.toId,
        departureDay, arrivalDay, conveyanceId: conveyance.id,
        fareStones: input.fareStones, passengerIds: passengers, hired: input.hired, walkingDays: walking,
        ...(input.playedPassenger ? { playedPassenger: input.playedPassenger } : {}) }, refusal: null };
}

/** Commit synchronously, after rechecking source and seats, before the caller pays. */
export function commitPublicCarriage(world: WorldState, quote: PublicRoadQuote, boardingMoment?: PassageRunMoment,
    onward?:{receiptId:string;agreementId:string}): HistoricalFact | null {
    const now = routineTime(world);
    if (!journeyTimeHasReached(now, quote.departureDay) || !journeyTimeHasReached(quote.departureDay, now)) return null;
    const fresh = quotePublicCarriage(world, { fromId: quote.fromId, toId: quote.toId,
        day: quote.departureDay, conveyanceId: quote.conveyanceId, passengerIds: quote.passengerIds,
        fareStones: quote.fareStones, hired: quote.hired, playedPassenger: quote.playedPassenger,
        ...(quote.vesselId!==carriageIdForRoad(quote.fromId,quote.toId,quote.conveyanceId)?{actualVesselId:quote.vesselId}:{}) });
    if (!fresh || fresh.vesselId !== quote.vesselId || fresh.driverId !== quote.driverId
        || fresh.arrivalDay !== quote.arrivalDay) return null;
    const prior=onward?publicCarriagePassage(world,onward.receiptId,quote.passengerIds[0]!,now):null;
    if(onward && (!prior?.arrived||prior.leg.vesselId!==quote.vesselId||prior.leg.toId!==quote.fromId))return null;
    const predecessors=prior?factsWithDataValue(world,'vesselId',quote.vesselId).filter(fact=>{
        const leg=legOf(fact);return leg && leg.driverId===prior.leg.driverId
            && leg.departureDay===prior.leg.departureDay && leg.arrivalDay===prior.leg.arrivalDay
            && leg.fromId===prior.leg.fromId && leg.toId===quote.fromId;
    }).map(fact=>fact.id):[];
    let carriage = vehicleFor(world, quote.vesselId);
    let driver = world.npcs.find(npc => npc.id === quote.driverId);
    if (!driver) {
        driver = createNpc(world.seed, { id: quote.driverId, locationId: quote.fromId,
            onDay: quote.departureDay, bornOnDay: quote.departureDay - 30 * 365,
            occupation: 'carter', takenNames: new Set(world.npcs.map(npc => npc.name)),
            tags: [`crew-of:${quote.vesselId}`] });
        world.npcs.push(driver);
    }
    if (!carriage) {
        carriage = aVehicleOf({ id: quote.vesselId, conveyanceId: quote.conveyanceId,
            ownerId: driver.id, ownerName: driver.name, at: quote.fromId });
        carriage = { ...carriage, locationId: null, data: { ...carriage.data, mooredAt: '' } };
        carriage.tags.push(PUBLIC_ROAD);
        world.objects.push(carriage);
    } else if (whoItIsWith(carriage) === null) {
        const at = world.objects.indexOf(carriage);
        carriage = { ...carriage, ownerId: driver.id, ownerName: driver.name, locationId: null,
            data: { ...carriage.data, withId: driver.id, mooredAt: '' } };
        world.objects[at] = carriage;
    }
    const index = world.npcs.findIndex(npc => npc.id === driver!.id);
    world.npcs[index] = { ...setLocation(driver, quote.fromId, quote.departureDay), activity: companyDuringPassage(driver.activity, { ...driver.activity,
        kind: 'travelling', note: 'Driving the carriage on its paid road passage.',
        withIds: [...new Set([...(driver.activity?.withIds ?? []), ...quote.passengerIds])], fromLocationId: quote.fromId,
        returnTo: quote.toId, sinceDay: quote.departureDay, untilDay: quote.arrivalDay,
        conveyanceId: quote.conveyanceId, conveyancePower: carriage.power, vesselId: quote.vesselId,
        admittedRoad:{position:{kind:'place',locationId:quote.fromId,originLocationId:quote.fromId},
            route:walkingRouteFrom(world.locations,quote.fromId,quote.toId)!,initialTravelDays:0} }, quote.departureDay),
        updatedOnDay: quote.departureDay };
    for (const id of quote.passengerIds) {
        const at = world.npcs.findIndex(npc => npc.id === id && !npc.tags.includes(PLAYER_ROW_TAG));
        const person = world.npcs[at];
        if (!person) continue;
        world.npcs[at] = { ...setLocation(person, quote.fromId, quote.departureDay), activity: companyDuringPassage(person.activity, { ...person.activity,
            kind: 'travelling', note: person.activity?.kind === 'travelling'
                ? person.activity.note : 'Travelling on the paid carriage to its destination.',
            withIds: [...new Set([...(person.activity?.withIds ?? []), driver.id])],
            fromLocationId: quote.fromId, returnTo: quote.toId,
            sinceDay: quote.departureDay, untilDay: quote.arrivalDay,
            conveyanceId: quote.conveyanceId, conveyancePower: carriage.power,
            vesselId: quote.vesselId,carrierOperatorId:driver.id }, quote.departureDay), updatedOnDay: quote.departureDay };
    }
    return appendWorldFact(world, makeFact({ day: quote.departureDay, kind: 'gathering',
        locationId: quote.fromId, visibility: 'secret', summary: 'An accepted public carriage passage.',
        causes:predecessors,
        actors: quote.passengerIds.map(id => ({ id,
            name: world.npcs.find(npc => npc.id === id)?.name ?? id, role: 'passenger' })),
        data: { publicPassage: true, service: 'carriage', vesselId: quote.vesselId,
            driverId: driver.id, fromLocationId: quote.fromId, toLocationId: quote.toId,
            departureDay: quote.departureDay, arrivalDay: quote.arrivalDay,
            conveyanceId: quote.conveyanceId, fareStones: quote.fareStones, hired: quote.hired, walkingDays:quote.walkingDays,
            ...(onward ? {onwardAgreementId:onward.agreementId} : {}),
            ...(boardingMoment ? { runId: boardingMoment.runId,
                boardingRunElapsedDays: boardingMoment.elapsedDays } : {}) }
    }), { recur: false, bystanders: false });
}

/** A later actual admitted course at B proves completion, never a reservation. */
function oldCarriageLandfall(world:WorldState,receipt:HistoricalFact,leg:PublicRoadLeg,day:number):boolean {
    return journeyTimeHasReached(day,leg.arrivalDay) && factsWithDataValue(world,'vesselId',leg.vesselId).some(fact=>{
        const next=legOf(fact);return next && typeof fact.data.onwardAgreementId==='string'
            && next.fromId===leg.toId && journeyTimeHasReached(next.departureDay,leg.arrivalDay)
            && journeyTimeHasReached(day,next.departureDay) && fact.causes.includes(receipt.id);
    });
}

/** Read the same immutable booking and the holder's current physical body. */
export function publicCarriagePassage(world: WorldState, receiptId: string, passengerId: string, day: number): {
    leg: PublicRoadLeg; receipt: HistoricalFact; vehicle: ObjectRecord; driver: NpcRecord;
    locationId: string; remainingDays: number; arrived: boolean;
} | null {
    const accepted = publicCarriageReceipt(world, receiptId, passengerId);
    if (!accepted) return null;
    const {receipt,leg}=effectiveCarriageCourse(world,accepted.receipt,accepted.leg,passengerId,day);
    const completed=oldCarriageLandfall(world,receipt,leg,day);
    const vehicle = vehicleFor(world, leg.vesselId);
    const driver = world.npcs.find(npc => npc.id === leg.driverId);
    if(completed && vehicle && driver)return {leg,receipt,vehicle,driver,locationId:leg.toId,remainingDays:0,arrived:true};
    if (!vehicle || !driver || isRuined(vehicle) || vehicle.possessorId !== null || vehicle.ownerId !== driver.id
        || whoItIsWith(vehicle) !== driver.id || driver.status !== 'alive') return null;
    const locationId = locationOnNpcJourney(world.locations, driver, day);
    if (!locationId) return null;
    const doing = driver.activity;
    const arrived = journeyTimeHasReached(day, leg.arrivalDay) && locationId === leg.toId;
    if (!arrived && (doing?.kind !== 'travelling' || doing.vesselId !== leg.vesselId
        || doing.fromLocationId !== leg.fromId || doing.returnTo !== leg.toId
        || doing.sinceDay !== leg.departureDay || doing.untilDay !== leg.arrivalDay)) return null;
    return { leg, receipt, vehicle, driver, locationId,
        remainingDays: arrived ? 0 : Math.max(0, leg.arrivalDay - day), arrived };
}

/** Before mortal pruning, a lost holder leaves the ordinary object on corpse ground. */
export function settlePublicCarriages(world: WorldState, day: number): void {
    for (const vehicle of world.objects.filter(object => object.tags.includes(PUBLIC_ROAD))) {
        const id = whoItIsWith(vehicle);
        const driver = id && world.npcs.find(npc => npc.id === id);
        if (!driver || !isTerminal(driver.status)) continue;
        const doing = driver.activity;
        if (doing?.kind === 'travelling' && doing.fromLocationId && doing.returnTo && doing.untilDay != null) {
            stopPublicCarriage(world, { vesselId: vehicle.id, driverId: driver.id,
                fromId: doing.fromLocationId, toId: doing.returnTo,
                departureDay: doing.sinceDay, arrivalDay: doing.untilDay,
                conveyanceId: String(vehicle.data.conveyanceId) }, driver.diedOnDay ?? day);
        } else leaveItHere(world.objects, vehicle, locationOnNpcJourney(world.locations, driver, day));
    }
}

/** A real loss ends the actual leg on the ground reached, before any passenger resumes. */
export function stopPublicCarriage(world: WorldState, leg: PublicRoadLeg, day: number): void {
    const vehicle = vehicleFor(world, leg.vesselId);
    const index = world.npcs.findIndex(npc => npc.id === leg.driverId);
    const driver = world.npcs[index];
    if (!vehicle || !driver) return;
    // Read the admitted course at the actual loss instant even after markDead;
    // this changes no status or body and does not resurrect its operator.
    const physical:NpcRecord=isTerminal(driver.status)?{...driver,status:'alive'}:driver;
    const coarse = locationOnNpcJourney(world.locations, physical, day);
    const point = roadPositionOfNpc(world.locations, physical, day);
    const ground = point && coarse ? groundWhereACarriageStopped(world,leg.vesselId,leg.departureDay,day,point,coarse) : coarse;
    leaveItHere(world.objects, vehicle, ground);
    if(ground&&point&&point.kind==='edge'&&!factsWithDataValue(world,'vesselId',leg.vesselId).some(fact=>fact.data.publicCarriageStopped===true&&fact.locationId===ground)){
        const causes=factsWithDataValue(world,'vesselId',leg.vesselId).filter(fact=>fact.data.publicPassage===true&&fact.data.service==='carriage'&&fact.data.departureDay===leg.departureDay).map(fact=>fact.id);
        appendWorldFact(world,makeFact({day,kind:'gathering',locationId:ground,visibility:'secret',summary:'An accepted carriage stopped on its reached road.',causes,
            data:{publicCarriageStopped:true,vesselId:leg.vesselId,departureDay:leg.departureDay,arrivalDay:leg.arrivalDay,toLocationId:leg.toId}}),{recur:false,bystanders:false});
    }
    world.npcs[index] = { ...setLocation(driver, ground, day), activity:isTerminal(driver.status)?driver.activity:companyAfterPassage(driver, day) };
    for (let at = 0; at < world.npcs.length; at++) {
        const person = world.npcs[at]!;
        const doing = person.activity;
        if (person.id === driver.id || person.tags.includes(PLAYER_ROW_TAG) || isTerminal(person.status)
            || doing?.kind !== 'travelling' || doing.vesselId !== leg.vesselId
            || doing.sinceDay !== leg.departureDay || doing.untilDay !== leg.arrivalDay) continue;
        world.npcs[at] = { ...setLocation(person, ground, day), activity: companyAfterPassage(person, day) };
    }
}

/** Caused actual course changes supersede an old course, not its paid claim. */
function effectiveCarriageCourse(world:WorldState,root:HistoricalFact,original:PublicRoadLeg,
 passengerId:string,day:number):{receipt:HistoricalFact;leg:PublicRoadLeg} {
 let receipt=root,leg=original;const linked=new Set([root.id]);
 for(const fact of factsWithDataValue(world,'vesselId',original.vesselId)){
  if(fact.day>day||fact.data.changedCarriageCourse!==true||!fact.causes.some(id=>linked.has(id))
   ||!fact.actors.some(actor=>actor.id===passengerId&&actor.role==='passenger'))continue;
  const next=legOf(fact);if(!next||next.driverId!==original.driverId)continue;
  linked.add(fact.id);receipt=fact;leg=next;
 }
 return {receipt,leg};
}
export interface ActualCarriageReturn {position:RoadPosition;course:RoadContinuation;
 walkingPace:number;days:number;initialDays:number;sourceReceiptId:string;targetId:string}

/** Existing admitted edge pace, shared by an actual return and a held continuation. */
function admittedCarriagePace(root:{receipt:HistoricalFact;leg:PublicRoadLeg},actual:{leg:PublicRoadLeg;driver:NpcRecord},day:number):number|null {
 const walking=typeof root.receipt.data.walkingDays==='number'?root.receipt.data.walkingDays:null;
 return walking===null?null:admittedRoadWalkingPace({...root.leg,walkingDays:walking},
  {...actual.leg,admittedRoad:actual.driver.activity?.admittedRoad},day);
}
/** A real reversal admits the directed reverse of the current edge. A detour
 * through the forward endpoint is not a reversal. The original paid span owns
 * the actual admitted pace; rounding a new whole quote per fraction does not. */
export function quoteActualCarriageReturn(world:WorldState,receiptId:string,passengerId:string,
 targetId:string,day:number):ActualCarriageReturn|null {
 const root=publicCarriageReceipt(world,receiptId,passengerId),actual=publicCarriagePassage(world,receiptId,passengerId,day);
 if(!root||!actual||actual.arrived||targetId!==root.leg.fromId)return null;
 const held=actual.driver.activity?.admittedRoad;
 const route=walkingRouteFrom(world.locations,actual.leg.fromId,actual.leg.toId);
 if(!held&&!route)return null;
 const position=held?positionOnAdmittedRoad(held,day-actual.leg.departureDay,actual.leg.arrivalDay-actual.leg.departureDay,actual.leg.departureDay)
  :positionOnRoad(route!,Math.max(0,day-actual.leg.departureDay)/(actual.leg.arrivalDay-actual.leg.departureDay)*route!.at(-1)!.days,root.leg.fromId);
 if(position.kind!=='edge')return null;
 const course=roadContinuationTo(world.locations,position,targetId);
 if(!course||course.position.kind!=='edge'||course.position.fromId!==position.toId
  ||course.position.toId!==position.fromId||course.endpointId!==position.fromId)return null;
 // Older receipts do not record this actual price input. Do not reconstruct
 // a historic pace from a graph whose admission may since have changed.
 const walkingPace=admittedCarriagePace(root,actual,day);
 if(walkingPace===null)return null;
 const craft=getConveyance(actual.leg.conveyanceId);
 if(!craft||craft.crossesGroundThatCannotBeWalked||journeyNeedsWater(world.locations,course.endpointId,targetId))return null;
 const remaining=daysByConveyance(course.route.at(-1)?.days??0,craft);
 return {position,course,walkingPace,days:course.partialDays*walkingPace+remaining,
  initialDays:course.partialDays*walkingPace,sourceReceiptId:actual.receipt.id,targetId};
}
/** Consent has already landed. Actual bodies and the same hull are re-read;
 * a caused course receipt does not debit another seat or manufacture a driver. */
export function returnActualCarriageAfterAgreement(world:WorldState,receiptId:string,
 passengerId:string,targetId:string,day:number):PublicRoadLeg|null {
 const quote=quoteActualCarriageReturn(world,receiptId,passengerId,targetId,day);
 const actual=publicCarriagePassage(world,receiptId,passengerId,day);
 if(!quote||!actual||!(quote.days>0))return null;
 const leg:PublicRoadLeg={...actual.leg,fromId:actual.locationId,toId:targetId,departureDay:day,arrivalDay:day+quote.days};
 const roots=factsWithDataValue(world,'vesselId',leg.vesselId).filter(fact=>{
  const old=legOf(fact);return old&&old.driverId===leg.driverId&&old.departureDay===actual.leg.departureDay
   &&old.arrivalDay===actual.leg.arrivalDay&&old.fromId===actual.leg.fromId&&old.toId===actual.leg.toId;
 });
 const ids=new Set(roots.flatMap(fact=>fact.actors.filter(actor=>actor.role==='passenger').map(actor=>actor.id)));
 const matched=world.npcs.filter(n=>n.status==='alive'&&ids.has(n.id)&&n.activity?.kind==='travelling'
  &&n.activity.vesselId===leg.vesselId&&n.activity.sinceDay===actual.leg.departureDay
  &&n.activity.untilDay===actual.leg.arrivalDay&&n.activity.returnTo===actual.leg.toId);
 const driverIndex=world.npcs.findIndex(n=>n.id===leg.driverId);if(driverIndex<0)return null;
 const doing=actual.driver.activity!;
 const admittedRoad={position:quote.course.position,route:quote.course.route,initialTravelDays:quote.initialDays};
 world.npcs[driverIndex]={...setLocation(actual.driver,actual.locationId,day),activity:{...doing,
  fromLocationId:leg.fromId,returnTo:leg.toId,sinceDay:day,untilDay:leg.arrivalDay,admittedRoad}};
 for(const person of matched){const at=world.npcs.findIndex(n=>n.id===person.id);if(at<0||person.id===leg.driverId)continue;
  const course={...person.activity!,fromLocationId:leg.fromId,returnTo:leg.toId,sinceDay:day,untilDay:leg.arrivalDay,
   carrierOperatorId:leg.driverId};delete course.admittedRoad;
  world.npcs[at]={...setLocation(person,actual.locationId,day),activity:course};
 }
 appendWorldFact(world,makeFact({day,kind:'gathering',locationId:actual.locationId,
  summary:'The actual carriage driver changed the admitted road course after agreement.',visibility:'public',
  causes:roots.map(fact=>fact.id),actors:roots.flatMap(fact=>fact.actors).filter((actor,index,actors)=>actors.findIndex(one=>one.id===actor.id)===index),
  data:{publicPassage:true,service:'carriage',changedCarriageCourse:true,vesselId:leg.vesselId,driverId:leg.driverId,
   fromLocationId:leg.fromId,toLocationId:leg.toId,departureDay:leg.departureDay,arrivalDay:leg.arrivalDay,
   conveyanceId:leg.conveyanceId}}),{recur:false,bystanders:false});
 return leg;
}

/** Same driver, hull, admitted road point and passengers; no fare is issued during a hold. */
export function holdPublicCarriage(world:WorldState,receiptId:string,passengerId:string,day:number,
 recheckOnDay:number,statusId:string|null):PublicRoadLeg|null {
 const root=publicCarriageReceipt(world,receiptId,passengerId),actual=publicCarriagePassage(world,receiptId,passengerId,day);
 if(!root||!actual||actual.arrived||recheckOnDay<day)return null;
 const point=roadPositionOfNpc(world.locations,actual.driver,day);
 const pace=admittedCarriagePace(root,actual,day),craft=getConveyance(actual.leg.conveyanceId);
 const continuation=point&&roadContinuationTo(world.locations,point,actual.leg.toId);
 if(!point||pace===null||!craft||!continuation)return null;
 const initial=continuation.partialDays*pace;
 const duration=initial+daysByConveyance(continuation.route.at(-1)?.days??0,craft);
 if(!(duration>0))return null;
 const leg={...actual.leg,fromId:actual.locationId,departureDay:recheckOnDay,arrivalDay:recheckOnDay+duration};
 const roots=factsWithDataValue(world,'vesselId',leg.vesselId).filter(fact=>{
  const old=legOf(fact);return old&&old.driverId===leg.driverId&&old.departureDay===actual.leg.departureDay
   &&old.arrivalDay===actual.leg.arrivalDay&&old.fromId===actual.leg.fromId&&old.toId===actual.leg.toId;
 });
 const ids=new Set(roots.flatMap(fact=>fact.actors.filter(actor=>actor.role==='passenger').map(actor=>actor.id)));
 const aboard=world.npcs.filter(person=>person.id===leg.driverId||isTheWorldsToMove(person)&&person.status==='alive'&&ids.has(person.id)
  &&person.activity?.vesselId===leg.vesselId&&person.activity.sinceDay===actual.leg.departureDay
  &&person.activity.untilDay===actual.leg.arrivalDay);
 for(const person of aboard){
  const doing={...person.activity!,fromLocationId:leg.fromId,returnTo:leg.toId,sinceDay:leg.departureDay,untilDay:leg.arrivalDay};
  if(person.id===leg.driverId)doing.admittedRoad={position:continuation.position,route:continuation.route,initialTravelDays:initial};
  else {delete doing.admittedRoad;doing.carrierOperatorId=leg.driverId;}
  world.npcs[world.npcs.indexOf(person)]={...setLocation(person,actual.locationId,day),activity:doing};
 }
 appendWorldFact(world,makeFact({day,kind:'gathering',locationId:actual.locationId,visibility:'public',
  summary:'The actual carriage driver held the admitted road course.',causes:roots.map(fact=>fact.id),
  actors:roots.flatMap(fact=>fact.actors).filter((actor,index,all)=>all.findIndex(one=>one.id===actor.id)===index),
  data:{publicPassage:true,service:'carriage',changedCarriageCourse:true,vesselId:leg.vesselId,driverId:leg.driverId,
   fromLocationId:leg.fromId,toLocationId:leg.toId,departureDay:leg.departureDay,arrivalDay:leg.arrivalDay,
   conveyanceId:leg.conveyanceId,...(statusId?{heldForStatusId:statusId}:{})}}),{recur:false,bystanders:false});
 return leg;
}
