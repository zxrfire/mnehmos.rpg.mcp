/** A Native pilot can divert a real privately held air course, using actual fuel and bodies. */
import type { WorldState } from './world-state.js';
import { isTheWorldsToMove } from './npc-state.js';
import { actualNpcPilotOfAirCourse, beginAnAirCourse, stopAnAirCourse, recordPaidAirCourseFuel } from './an-air-course-in-the-world.js';
import { quoteAnAirJourney } from './what-an-air-journey-takes.js';
import { requireConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from './what-one-of-the-worlds-own-people-knows.js';
import { canPointAt } from '../social/discovery.js';
import { bodilyTroubleAboard, captainAnswersTrouble, captainHasAnswered } from './a-captain-answers-trouble.js';
import { statusesInArea, STOPS_PASSAGE } from './what-is-true-of-a-place-right-now.js';

export function nativePilotAtTheirAppointment(world: WorldState, receiptId: string, day: number) {
    const fact = witnessIndexFor(world).byId.get(receiptId), d = fact?.data;
    const operator = actualNpcPilotOfAirCourse(world,receiptId);
    if (!fact || !d || !operator || !isTheWorldsToMove(operator) || typeof d.arrivalDay !== 'number'
        || day >= d.arrivalDay || typeof d.ownerId !== 'string' || typeof d.conveyanceId !== 'string'
        || typeof d.vesselId !== 'string' || typeof d.departureDay !== 'number') return null;
    // A SQL owner's/party's actual body is handled by its foreground adapter.
    if (!world.npcs.some(person=>person.id===d.ownerId&&isTheWorldsToMove(person))
        && !world.factions.some(house=>house.id===d.ownerId)) return null;
    const site = world.locations.find(place=>place.id===operator.activity?.airCourseLocationId);
    if (!site) return null;
    const people = world.npcs.filter(person=>isTheWorldsToMove(person)&&person.status==='alive'
        &&person.activity?.vesselId===d.vesselId&&person.activity.sinceDay===d.departureDay
        &&person.activity.untilDay===d.arrivalDay&&person.locationId===site.id);
    const medical = people.map(person=>bodilyTroubleAboard(person,day)).find(trouble=>!!trouble&&!captainHasAnswered(world,operator.id,trouble));
    const danger = statusesInArea(world.statuses,world.locations,site.id,day).find(status=>status.stops.includes(STOPS_PASSAGE));
    const trouble = medical ?? (danger ? {key:`air-passage:${danger.id}:${danger.reviewOnDay}`,person:operator,reason:danger.statement}:null);
    if (!trouble) return null;
    const knows = whatOneOfTheWorldsOwnPeopleKnows(world), craft = requireConveyance(d.conveyanceId);
    const power = typeof d.conveyancePower==='number'?d.conveyancePower:null;
    const candidates = world.locations.filter(place=>place.kind==='settlement'&&!place.tags.includes('interior')
        &&(place.id===d.fromLocationId||place.id===d.toLocationId||canPointAt(knows(operator.id,'place',place.id)))).flatMap(place=>{
        const quote=quoteAnAirJourney(world.locations,site.id,place.id,craft,power,people.length,
            {facts:witnessIndexFor(world).byId,onDay:day},1);
        return quote&&quote.trips===1&&(place.id===d.toLocationId||quote.stonesBurned<=operator.spiritStones)?[{place,quote}]:[];
    }).sort((a,b)=>a.quote.daysOneWay-b.quote.daysOneWay);
    const landing = candidates[0];
    if (!landing) return null;
    return captainAnswersTrouble(world,operator,trouble,receiptId,site.id,day,
        `land at ${landing.place.name} ${medical?'for care':'clear of the passage danger'}.`,()=>{
            if (landing.place.id===d.toLocationId) return true;
            const accepted=beginAnAirCourse(world,{bodyId:operator.id,bodyName:operator.name,fromId:site.id,toId:landing.place.id,
                conveyanceId:d.conveyanceId as string,power,vesselId:d.vesselId as string,artId:null,onDay:day,
                heads:people.length,owned:{ownerId:d.ownerId as string,pilotId:operator.id},priorReceiptId:receiptId,changedCourse:true,
                actualLoad:people.map(person=>({id:person.id,name:person.name}))});
            if (!accepted) return false;
            stopAnAirCourse(world,site,day,'The actual pilot diverted after noticing trouble aboard.');
            const payerAt=world.npcs.findIndex(person=>person.id===operator.id);
            world.npcs[payerAt]={...world.npcs[payerAt],spiritStones:world.npcs[payerAt].spiritStones-accepted.quote.stonesBurned};
            recordPaidAirCourseFuel(world,accepted.fact.id,operator.id,day+accepted.quote.daysOneWay,accepted.quote.stonesBurned,day);
            for(const member of people){const at=world.npcs.findIndex(person=>person.id===member.id),fresh=world.npcs[at];
                world.npcs[at]={...fresh,locationId:accepted.location.id,activity:{...fresh.activity!,fromLocationId:site.id,
                    returnTo:landing.place.id,sinceDay:day,untilDay:day+accepted.quote.daysOneWay,airCourseLocationId:accepted.location.id}};
            }
            return true;
        });
}

export function nativePilotsAtTheirAppointments(world: WorldState, day: number): void {
    const courses = world.npcs.filter(person=>isTheWorldsToMove(person)&&person.status==='alive'
        &&person.activity?.airCourseLocationId).map(person=>world.locations.find(place=>place.id===person.activity!.airCourseLocationId)?.data.airCourseId);
    for(const id of new Set(courses)) if(typeof id==='string')nativePilotAtTheirAppointment(world,id,day);
}
