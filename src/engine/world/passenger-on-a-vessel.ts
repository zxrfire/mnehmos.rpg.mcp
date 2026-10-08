/** A passenger follows an accepted hull's actual crew, never a copied sailed counter. */
import {isRuined} from './possessions.js';
import {setLocation} from './npc-state.js';
import {companyAfterPassage} from './company-during-a-passage.js';
import {whoItIsWith} from './a-vehicle.js';
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import type { HistoricalFact } from './history.js';
import { canTurnBack } from './what-a-sea-crossing-costs.js';
import { bindShipCrewToPassage } from './ship-crew.js';
import { witnessIndexFor, factsWithDataValue } from './witness-reaction-index.js';
import { publicShipLinesFrom, recordPublicPassage, type PublicPassageLeg } from './public-shipping.js';
import { journeyTimeHasReached, locationOnNpcJourney } from './places-on-the-way.js';

export interface ShipPassengerPosition {
    receipt: HistoricalFact;
    vesselId: string;
    seaLaneId: string;
    fromId: string;
    toId: string;
    departureDay: number;
    boardedOnDay: number;
    arrivalDay: number;
    sailed: number;
    remainingDays: number;
    crew: NpcRecord[];
    locationId: string | null;
    arrived: boolean;
    unavailable: string | null;
}

/** No quote, recruitment, course write, hull respawn or body movement occurs in this read. */
export function shipPassengerAt(world: WorldState, receiptId: string, onDay: number): ShipPassengerPosition | null {
    const booked = witnessIndexFor(world).byId.get(receiptId);
    const origin = booked?.data;
    if (!booked || origin?.publicPassage !== true || typeof origin.vesselId !== 'string'
        || typeof origin.seaLaneId !== 'string' || typeof origin.departureDay !== 'number') return null;
    const courses = factsWithDataValue(world, 'vesselId', origin.vesselId)
        .filter(fact => fact.data.publicPassage === true && fact.data.seaLaneId === origin.seaLaneId && fact.day <= onDay
            && (fact.id===booked.id || typeof fact.data.onwardAgreementId!=='string'))
        .sort((a, b) => a.day - b.day || (witnessIndexFor(world).order.get(a.id) ?? 0)
            - (witnessIndexFor(world).order.get(b.id) ?? 0));
    let receipt = booked;
    const linked = new Set([booked.id]);
    for (const course of courses) if (course.id === booked.id || course.causes.some(id => linked.has(id))) {
        linked.add(course.id); receipt = course;
    }
    const data = receipt.data;
    if (typeof data.fromLocationId !== 'string' || typeof data.toLocationId !== 'string'
        || typeof data.departureDay !== 'number' || typeof data.arrivalDay !== 'number' || data.arrivalDay < data.departureDay) return null;
    const arrivalDay = data.arrivalDay, departureDay = data.departureDay;
    const arrived = journeyTimeHasReached(onDay, arrivalDay);
    const crew = world.npcs.filter(npc => npc.status === 'alive'
        && npc.tags.includes(`crew-of:${origin.vesselId}`)
        && ((arrived && npc.locationId === data.toLocationId && journeyTimeHasReached(npc.updatedOnDay, arrivalDay)
            && npc.activity?.kind !== 'travelling')
        || npc.activity?.kind === 'travelling' && npc.activity.vesselId === origin.vesselId
        && npc.activity.seaLaneId === origin.seaLaneId
        && npc.activity.sinceDay === departureDay
        && npc.activity.fromLocationId === data.fromLocationId
        && npc.activity.returnTo === data.toLocationId
        && npc.activity.untilDay === data.arrivalDay));
    const hull=world.objects.find(object=>object.id===origin.vesselId);
    const lostOnDay=hull && isRuined(hull) ? hull.provenance.filter(entry=>entry.how==='lost'&&entry.onDay<=onDay).at(-1)?.onDay : undefined;
    const lost = data.publicPassageLost===true || !!hull && isRuined(hull)
        && (lostOnDay!==undefined && journeyTimeHasReached(lostOnDay,departureDay) && journeyTimeHasReached(arrivalDay,lostOnDay)
            || hull.provenance.length===0);
    // A later wreck cannot retroactively stop somebody already disembarked.
    const actualEnd = lostOnDay===undefined ? onDay : Math.min(onDay,lostOnDay);
    const elapsed = Math.max(0, actualEnd - departureDay);
    // A surviving matched source, not the passenger's stored water name, supplies ground.
    const source = crew.find(npc => npc.identity.occupation === 'shipmaster') ?? crew[0];
    const last = world.npcs.filter(npc => npc.tags.includes('crew-of:' + origin.vesselId)
        && npc.activity?.vesselId === origin.vesselId && npc.activity.sinceDay === departureDay
        && npc.diedOnDay != null && npc.diedOnDay <= onDay)
        .sort((a, b) => (b.diedOnDay ?? 0) - (a.diedOnDay ?? 0))[0];
    // A later actual boarding from this landfall proves the old finite leg
    // reached it even after its crew left. Planned reservations prove nothing.
    const leftThisLandfall=arrived && factsWithDataValue(world,'vesselId',origin.vesselId).some(fact=>
        fact.data.publicPassage===true && fact.data.actualBoarding===true
        && fact.data.fromLocationId===data.toLocationId
        && typeof fact.data.departureDay==='number' && journeyTimeHasReached(fact.data.departureDay,arrivalDay)
        && fact.day<=onDay && fact.causes.includes(receipt.id));
    const locationId = data.publicPassageLost===true ? data.toLocationId
        : lost && lostOnDay===undefined ? null
        : leftThisLandfall ? data.toLocationId : source ? locationOnNpcJourney(world.locations, source, actualEnd)
        : last?.locationId ?? (data.toLocationId !== origin.toLocationId ? data.toLocationId : null);
    const atPort = !lost && arrived && locationId === data.toLocationId && (!!source || leftThisLandfall);
    return { receipt, vesselId: origin.vesselId, seaLaneId: origin.seaLaneId,
        fromId: data.fromLocationId, toId: data.toLocationId,
        departureDay, boardedOnDay: origin.departureDay, arrivalDay: data.arrivalDay,
        sailed: atPort ? data.arrivalDay - departureDay : Math.min(elapsed, data.arrivalDay - departureDay),
        remainingDays: atPort || lost ? 0 : Math.max(0, data.arrivalDay - onDay), crew:lost?[]:crew, locationId,
        arrived: atPort,
        unavailable: lost ? 'The actual accepted hull was ruined; no passage continues.' : source || atPort ? null : 'The accepted hull has no actual crew carrying this leg.' };
}

/** Loss writes the actual final ground before the last mortal source can be forgotten. */
export function settleLostPublicPassages(world: WorldState, day: number): void {
    settleRuinedPublicHulls(world,day);
    const ended = new Set<string>();
    for (const npc of world.npcs) {
        const activity = npc.activity;
        if (npc.status === 'alive' || npc.diedOnDay == null || npc.diedOnDay > day
            || activity?.kind !== 'travelling' || !activity.seaLaneId || !activity.vesselId
            || !npc.tags.includes('crew-of:' + activity.vesselId) || !activity.fromLocationId
            || !activity.returnTo || activity.untilDay == null || npc.diedOnDay >= activity.untilDay) continue;
        const key = activity.vesselId + ':' + activity.sinceDay;
        if (ended.has(key)) continue;
        ended.add(key);
        const crew = world.npcs.filter(one => one.tags.includes('crew-of:' + activity.vesselId)
            && one.activity?.vesselId === activity.vesselId && one.activity?.sinceDay === activity.sinceDay);
        if (crew.some(one => one.status === 'alive')) continue;
        const last = [...crew].sort((a, b) => (b.diedOnDay ?? 0) - (a.diedOnDay ?? 0))[0];
        const from = world.locations.find(place => place.id === activity.fromLocationId);
        const bound = world.locations.find(place => place.id === activity.returnTo);
        const lane = from && bound && publicShipLinesFrom(world, from.name, activity.sinceDay)
            .find(line => line.lane.id === activity.seaLaneId && line.to === bound.name)?.lane;
        if (!lane || !last?.locationId || last.diedOnDay == null) continue;
        recordPublicPassage(world, { lane, vesselId: activity.vesselId, fromId: from!.id,
            toId: last.locationId, departureDay: activity.sinceDay, arrivalDay: last.diedOnDay },
            last.diedOnDay, last.locationId, crew.map(one => one.id));
    }
}

/** A dated ordinary ruin stops only bodies still on that actual finite leg.
 * Title and custody remain under ruin/estate authority; this neither repairs a
 * hull nor touches corpses or unrelated replacement activities. */
function settleRuinedPublicHulls(world:WorldState,day:number):void {
 const activeHulls=new Set(world.npcs.flatMap(n=>n.status==='alive'&&n.activity?.kind==='travelling'
  &&n.activity.seaLaneId&&n.activity.vesselId&&n.tags.includes('crew-of:'+n.activity.vesselId)?[n.activity.vesselId]:[]));
 if(!activeHulls.size)return;
 const rows=new Map(world.objects.filter(o=>activeHulls.has(o.id)).map(o=>[o.id,o]));
 for(const id of activeHulls){
  const hull=rows.get(id);if(!hull||!isRuined(hull))continue;
  const loss=hull.provenance.filter(entry=>entry.how==='lost'&&entry.onDay<=day).at(-1);
  if(!loss)continue; // no invented historic loss timestamp
  const doingCrew=world.npcs.find(n=>n.status==='alive'&&n.tags.includes('crew-of:'+hull.id)
   &&n.activity?.kind==='travelling'&&n.activity.vesselId===hull.id&&n.activity.seaLaneId
   &&n.activity.untilDay!=null&&n.activity.sinceDay<=loss.onDay&&loss.onDay<n.activity.untilDay);
  const doing=doingCrew?.activity;if(!doingCrew||!doing?.fromLocationId||!doing.returnTo||!doing.seaLaneId)continue;
  const facts=factsWithDataValue(world,'vesselId',hull.id).filter(f=>f.data.publicPassage===true&&f.data.seaLaneId===doing.seaLaneId);
  const parent=[...facts].reverse().find(f=>f.data.departureDay===doing.sinceDay&&f.data.fromLocationId===doing.fromLocationId&&f.data.toLocationId===doing.returnTo);
  const lane=facts.flatMap(f=>{
   const from=world.locations.find(p=>p.id===f.data.fromLocationId);
   return from?publicShipLinesFrom(world,from.name,typeof f.data.departureDay==='number'?f.data.departureDay:doing.sinceDay):[];
  }).find(line=>line.lane.id===doing.seaLaneId)?.lane;
  const ground=locationOnNpcJourney(world.locations,doingCrew,loss.onDay);
  if(!parent||!lane||!ground)continue;
  const matched=world.npcs.filter(n=>n.status==='alive'&&n.activity?.kind==='travelling'
   &&n.activity.vesselId===hull.id&&n.activity.seaLaneId===doing.seaLaneId
   &&n.activity.sinceDay===doing.sinceDay&&n.activity.fromLocationId===doing.fromLocationId
   &&n.activity.returnTo===doing.returnTo&&n.activity.untilDay===doing.untilDay);
  recordPublicPassage(world,{lane,vesselId:hull.id,fromId:doing.fromLocationId,toId:ground,
   departureDay:doing.sinceDay,arrivalDay:loss.onDay},loss.onDay,ground,matched.map(n=>n.id),parent.id,undefined,undefined,undefined,true);
  for(const n of matched){const at=world.npcs.findIndex(one=>one.id===n.id);if(at<0)continue;
   const actual=world.npcs[at]!;
   world.npcs[at]={...setLocation(actual,ground,loss.onDay),
    activity:companyAfterPassage(actual,loss.onDay)};
  }
 }
}

/** Only living actual crew can begin a real shorter-way return; the old receipt remains history. */
export function turnBackPublicPassage(world: WorldState, receiptId: string, day: number): PublicPassageLeg | null {
    return returnAnActualPublicPassage(world,receiptId,day,true);
}

/** An agreed return may be longer than continuing; commitDayOf is not a barrier. */
export function returnPublicPassageAfterAgreement(world:WorldState,receiptId:string,day:number):PublicPassageLeg|null {
    return returnAnActualPublicPassage(world,receiptId,day,false);
}
function returnAnActualPublicPassage(world:WorldState,receiptId:string,day:number,shorterOnly:boolean):PublicPassageLeg|null {
    const actual = shipPassengerAt(world, receiptId, day);
    const original = witnessIndexFor(world).byId.get(receiptId)?.data;
    if (!actual || actual.unavailable || actual.arrived || !actual.locationId || !actual.crew.length
        || !original || typeof original.fromLocationId !== 'string'
        || actual.toId === original.fromLocationId || actual.sailed <= 0) return null;
    const from = world.locations.find(place => place.id === original.fromLocationId);
    const to = world.locations.find(place => place.id === original.toLocationId);
    const lane = from && to && publicShipLinesFrom(world, from.name, actual.boardedOnDay)
        .find(line => line.lane.id === actual.seaLaneId && line.to === to.name)?.lane;
    const hull=world.objects.find(object=>object.id===actual.vesselId);
    const operator=actual.crew.find(npc=>npc.identity.occupation==='shipmaster');
    if (!lane || shorterOnly && !canTurnBack(lane, day - actual.boardedOnDay)
        || !shorterOnly && (!operator || !hull)
        || hull && (isRuined(hull) || !operator
            || !(hull.possessorId===operator.id || hull.possessorId===null && whoItIsWith(hull)===operator.id))) return null;
    const leg: PublicPassageLeg = { lane, vesselId: actual.vesselId, fromId: actual.locationId,
        toId: original.fromLocationId, departureDay: day, arrivalDay: day + actual.sailed };
    bindShipCrewToPassage(world, leg, day, actual.departureDay);
    recordPublicPassage(world, leg, day, leg.fromId, actual.crew.map(one => one.id), actual.receipt.id);
    return leg;
}
