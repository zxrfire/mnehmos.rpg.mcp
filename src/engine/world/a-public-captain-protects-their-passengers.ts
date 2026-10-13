/** Public operators can change their actual accepted course for noticed bodily trouble. */
import type { WorldState } from './world-state.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { shipPassengerAt, returnPublicPassageAfterAgreement, holdPublicPassage } from './passenger-on-a-vessel.js';
import { publicCarriagePassage, returnActualCarriageAfterAgreement, holdPublicCarriage } from './public-carriages.js';
import { witnessIndexFor, factsWithDataValue } from './witness-reaction-index.js';
import { bodilyTroubleAboard, captainAnswersTrouble, captainHasAnswered, captainCanAct, type TroubleNoticedAboard } from './a-captain-answers-trouble.js';
import type { HistoricalFact } from './history.js';
import { statusesInArea, isStatusRunningOn, STOPS_PASSAGE } from './what-is-true-of-a-place-right-now.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';

export function publicCaptainPassageHazard(world: WorldState, receiptId: string, day: number): HistoricalFact | null {
    const ship = shipPassengerAt(world, receiptId, day);
    const root = witnessIndexFor(world).byId.get(receiptId);
    const passengerId = root?.actors.find(actor => actor.role === 'passenger')?.id;
    const road = !ship && passengerId ? publicCarriagePassage(world,receiptId,passengerId,day) : null;
    const operator = ship?.crew.find(person => person.identity.occupation === 'shipmaster') ?? road?.driver;
    const locationId = ship?.locationId ?? road?.locationId;
    const receipt = ship?.receipt ?? road?.receipt;
    const vesselId = ship?.vesselId ?? road?.leg.vesselId;
    const departureDay = ship?.departureDay ?? road?.leg.departureDay;
    if (!operator || !captainCanAct(operator) || !locationId || !receipt || !vesselId || departureDay == null
        || ship?.arrived || ship?.unavailable || road?.arrived) return null;
    const hold = (until:number,statusId:string|null) => ship ? holdPublicPassage(world,receiptId,day,until,statusId)
        : holdPublicCarriage(world,receiptId,passengerId!,day,until,statusId);
    const heldId = receipt.data.heldForStatusId;
    const held = typeof heldId === 'string' && world.statuses.find(status => status.id === heldId);
    if (held && !isStatusRunningOn(held, day) && departureDay >= day) {
        if (!hold(day,null)) return null;
        return appendWorldFact(world, makeFact({ day, kind: 'gathering', visibility: 'public', locationId,
            causes: [receipt.id], actors: [{id:operator.id,name:operator.name,role:'operator'}],
            summary: `${operator.name} resumed the accepted voyage after the passage danger ended.`,
            data: {captainTrouble:`${operator.id}:resume:${receipt.id}`,vesselId} }), {recur:false,bystanders:false});
    }
    const status = statusesInArea(world.statuses, world.locations, locationId, day)
        .find(status => status.stops.includes(STOPS_PASSAGE));
    if (!status || departureDay > day) return null;
    const recheck = status.reviewOnDay > day ? status.reviewOnDay : (Math.floor(day / DAYS_PER_YEAR) + 1) * DAYS_PER_YEAR;
    const reporter = ship?.crew.find(person => person.id !== operator.id) ?? operator;
    return captainAnswersTrouble(world, operator, { key: `passage:${status.id}:${status.reviewOnDay}${heldId ? ':'+receipt.id : ''}`,
        person: reporter, reason: status.statement }, receiptId, locationId, day,
        `hold the ${ship?'ship':'carriage'} and check the passage again in ${recheck-day} days.`,
        () => hold(recheck,status.id) !== null);
}

export function publicCaptainMedicalResponse(world: WorldState, receiptId: string, day: number,
    playedPerson?: NpcRecord): HistoricalFact | null {
    const ship = shipPassengerAt(world, receiptId, day);
    const receipt = witnessIndexFor(world).byId.get(receiptId), data = receipt?.data;
    if (ship && !ship.arrived && !ship.unavailable && ship.locationId) {
        const operator = ship.crew.find(person => person.identity.occupation === 'shipmaster');
        if (!operator || !data || typeof data.fromLocationId !== 'string' || typeof data.toLocationId !== 'string') return null;
        const people = world.npcs.filter(person => isTheWorldsToMove(person) && person.status === 'alive'
            && person.activity?.vesselId === ship.vesselId && person.activity.sinceDay === ship.departureDay
            && person.activity.untilDay === ship.arrivalDay);
        const trouble = [playedPerson, ...people].filter((person): person is NpcRecord => !!person)
            .map(person => bodilyTroubleAboard(person, day)).find((trouble): trouble is TroubleNoticedAboard => !!trouble && !captainHasAnswered(world, operator.id, trouble));
        if (!trouble) return null;
        const originalDays = Number(data.arrivalDay) - Number(data.departureDay);
        const onwardDays = Math.max(0, ship.arrivalDay - Math.max(day, ship.departureDay));
        const backwardDays = Math.max(0, originalDays - onwardDays);
        const portId = backwardDays < onwardDays && ship.toId === data.toLocationId ? data.fromLocationId : ship.toId;
        const port = world.locations.find(place => place.id === portId);
        if (!port) return null;
        return captainAnswersTrouble(world, operator, trouble, receiptId, ship.locationId, day,
            `put in at ${port.name} for care.`, () => portId === ship.toId
                || returnPublicPassageAfterAgreement(world, receiptId, day)?.toId === portId);
    }
    const passengerId = playedPerson?.id ?? receipt?.actors.find(actor => actor.role === 'passenger')?.id;
    const road = passengerId && publicCarriagePassage(world, receiptId, passengerId, day);
    if (!road || road.arrived || !data || typeof data.fromLocationId !== 'string') return null;
    const people = world.npcs.filter(person => isTheWorldsToMove(person) && person.status === 'alive'
        && person.activity?.vesselId === road.leg.vesselId && person.activity.sinceDay === road.leg.departureDay
        && person.activity.untilDay === road.leg.arrivalDay);
    const trouble = [playedPerson, ...people].filter((person): person is NpcRecord => !!person)
        .map(person => bodilyTroubleAboard(person, day)).find((trouble): trouble is TroubleNoticedAboard => !!trouble && !captainHasAnswered(world, road.driver.id, trouble));
    if (!trouble) return null;
    // Existing directed reverse admission decides whether returning is possible.
    const onward = road.remainingDays;
    const backward = Math.max(0,Number(data.arrivalDay)-Number(data.departureDay)-onward);
    const target = backward < onward ? data.fromLocationId : road.leg.toId;
    const name = world.locations.find(place => place.id === target)?.name;
    if (!name) return null;
    return captainAnswersTrouble(world, road.driver, trouble, receiptId, road.locationId, day,
        `put in at ${name} for care.`, () => target === road.leg.toId
            || returnActualCarriageAfterAgreement(world, receiptId, passengerId!, target, day) !== null);
}

/** Only actual underway public operators are checked at existing world appointments. */
export function publicCaptainsAtTheirAppointments(world: WorldState, day: number): void {
    const vessels = new Set(world.npcs.filter(person => isTheWorldsToMove(person) && person.status === 'alive'
        && person.activity?.kind === 'travelling' && person.activity.vesselId)
        .map(person => person.activity!.vesselId!));
    for (const vessel of vessels) {
        const receipt = factsWithDataValue(world, 'vesselId', vessel).filter(fact => fact.data.publicPassage === true
            && (fact.data.actualBoarding === true || fact.data.service === 'carriage' && fact.data.changedCarriageCourse !== true)
            && fact.day <= day).at(-1);
        if (receipt) {
            publicCaptainPassageHazard(world, receipt.id, day);
            publicCaptainMedicalResponse(world, receipt.id, day);
        }
    }
}

/** An agreed hold has a dated recheck, not a forecast that the danger will end. */
export function publicCaptainHoldAppointments(world:WorldState,afterDay:number,throughDay:number){
    const appointments:{key:string;day:number;run:()=>void}[]=[];
    const vessels=new Map(world.npcs.filter(person=>isTheWorldsToMove(person)&&person.status==='alive'
        &&person.activity?.kind==='travelling'&&person.activity.vesselId)
        .map(person=>[person.activity!.vesselId!,person]));
    for(const [vessel,person] of vessels){
        const root=factsWithDataValue(world,'vesselId',vessel).filter(fact=>fact.data.publicPassage===true
            &&(fact.data.actualBoarding===true||fact.data.service==='carriage'&&fact.data.changedCarriageCourse!==true)).at(-1);
        if(!root)continue;
        const readOn=Math.max(afterDay,person.activity!.sinceDay),ship=shipPassengerAt(world,root.id,readOn);
        const id=root.actors.find(actor=>actor.role==='passenger')?.id;
        const road=!ship&&id?publicCarriagePassage(world,root.id,id,readOn):null;
        const receipt=ship?.receipt??road?.receipt,day=ship?.departureDay??road?.leg.departureDay;
        if(!receipt||typeof receipt.data.heldForStatusId!=='string'||day==null||day<=afterDay||day>throughDay)continue;
        appointments.push({key:`captain-hold:${receipt.id}:${day}`,day,run:()=>{publicCaptainPassageHazard(world,root.id,day);}});
    }
    return appointments;
}
