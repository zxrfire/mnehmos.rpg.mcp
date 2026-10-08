/** Oct7 duty/air audit: the existing actual pilot read equated activity since/until
 * with leg departure/arrival. A stationed service term and a later return leg
 * cannot satisfy that equality. These native component controls preserve actual
 * duty clocks while a single receipt/site/vessel binds two real bodies, then
 * reject supersession and insufficient physical capacity. They do not claim
 * board acceptance or relief is already proved by the component path. An additive
 * native applyPostings control exercises dispatch and receipt-based arrival; a
 * separate operator-arranged service term exercises the already-paid return.
 * All seven new controls are unrun until root-owned compiler/native validation.
 * The yard control distinguishes an available exact hull from borrowed-away
 * house property; ownership alone cannot put a craft at the sending seat. */
import {expect,it} from 'vitest';
import {createWorld,makeFaction} from '../../../src/engine/world/world-state.js';
import {createNpc,setRealm} from '../../../src/engine/world/npc-state.js';
import {makeLocation} from '../../../src/engine/world/locations.js';
import {aVehicleOf} from '../../../src/engine/world/a-vehicle.js';
import {transferPossession} from '../../../src/engine/world/possessions.js';
import {requireConveyance} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {beginAnAirCourse,actualNpcPilotOfAirCourse,recordPaidAirCourseFuel,settleNpcPilotedAirCourses,settleWorldAirTravellers,airPositionAt} from '../../../src/engine/world/an-air-course-in-the-world.js';
import {quoteAnAirJourney} from '../../../src/engine/world/what-an-air-journey-takes.js';
import {whatThisHouseCouldTakeOut} from '../../../src/engine/world/what-a-house-can-take-out.js';
import {bestForThisRoad} from '../../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import {theHouseLendsAnActualDutyCraft,admitPaidHouseAirReturn,quoteHouseAirDuty,admitPaidHouseAirDuty} from '../../../src/engine/world/a-house-party-takes-an-actual-air-leg.js';
import {applyPostings} from '../../../src/engine/world/the-world-changing-on-its-own.js';
import {witnessIndexFor} from '../../../src/engine/world/witness-reaction-index.js';
import {advanceWorldForPlay} from '../../../src/engine/world/driver.js';
import {theyAreRelieved} from '../../../src/engine/world/a-house-posts-the-one-being-played.js';
function arranged(){
 const world=createWorld({seed:'actual-house-duty-air',regionCount:0,skipPriorAges:true});
 world.currentHour=0;
 const day=world.currentDay;
 const from=makeLocation({id:'duty-origin',name:'Departure ground',kind:'settlement',data:{metricXLi:0,metricYLi:0,metricExtentLi:3}});
 const to=makeLocation({id:'duty-destination',name:'Posting ground',kind:'settlement',data:{metricXLi:48,metricYLi:64,metricExtentLi:3}});
 world.locations.push(from,to);
 const house=makeFaction({id:'actual-sending-house',name:'Actual sending house',seatLocationId:from.id,resources:{spirit_stones:1000}});world.factions.push(house);
 const pilot=setRealm(createNpc(world.seed,{id:'duty-pilot',name:'Actual pilot',locationId:from.id,onDay:day,bornOnDay:day-100*365}),29,day);
 const peer=createNpc(world.seed,{id:'duty-peer',name:'Actual disciple',locationId:from.id,onDay:day,bornOnDay:day-20*365});
 pilot.factionId=house.id;peer.factionId=house.id;
 for(const person of [pilot,peer])person.activity={kind:'out_with_a_party',note:'At the departure ground.',withIds:[],sinceDay:day,untilDay:day+1};
 world.npcs.push(pilot,peer);
 const craft=aVehicleOf({id:'actual-duty-hull',conveyanceId:'conv-spirit-boat',ownerId:house.id,ownerName:house.name,at:from.id});world.objects.push(craft);
 return {world,day,from,to,house,pilot,peer,craft};
}
function admitted(){
 const h=arranged();
 const back=quoteAnAirJourney(h.world.locations,h.to.id,h.from.id,requireConveyance('conv-spirit-boat'),h.craft.power,2);
 if(!back)throw Error('Native return component has no metric quote');
 const hullAt=h.world.objects.findIndex(row=>row.id===h.craft.id);
 if(hullAt<0)throw Error('Actual component hull disappeared');
 h.world.objects[hullAt]=transferPossession(h.craft,{onDay:h.day,toHolderId:h.pilot.id,toHolderName:h.pilot.name,how:'lent',source:'Operator-arranged actual component loan'});
 const accepted=beginAnAirCourse(h.world,{bodyId:h.pilot.id,bodyName:h.pilot.name,fromId:h.from.id,toId:h.to.id,conveyanceId:'conv-spirit-boat',power:h.craft.power,vesselId:h.craft.id,artId:null,onDay:h.day,heads:2,owned:{ownerId:h.house.id,pilotId:h.pilot.id},houseDutyFunding:{houseId:h.house.id,returnStones:back.stonesBurned}});
 if(!accepted)throw Error('Real component arrangement did not admit two bodies');
 // This operator fixture records a real house debit, not a pilot's invented debt.
 h.house.resources.spirit_stones=Number(h.house.resources.spirit_stones??0)-accepted.quote.stonesBurned-back.stonesBurned;
 recordPaidAirCourseFuel(h.world,accepted.fact.id,h.house.id,h.day+accepted.quote.daysOneWay,accepted.quote.stonesBurned);
 h.pilot=h.world.npcs.find(person=>person.id===h.pilot.id)!;
 h.peer=h.world.npcs.find(person=>person.id===h.peer.id)!;
 for(const person of [h.pilot,h.peer]){person.locationId=accepted.location.id;person.activity={kind:'stationed',note:'Actual service term',withIds:[person.id===h.pilot.id?h.peer.id:h.pilot.id],sinceDay:h.day-10,untilDay:h.day+60,returnTo:h.from.id,fromLocationId:h.from.id,vesselId:h.craft.id,airCourseLocationId:accepted.location.id,airDutyReceiptId:accepted.fact.id};}
 return {...h,accepted};
}
it('two actual posted bodies arrive by the leg receipt without resetting their duty clocks',()=>{
 const h=admitted(),at=h.day+h.accepted.quote.daysOneWay/2;
 expect(actualNpcPilotOfAirCourse(h.world,h.accepted.fact.id)?.id).toBe(h.pilot.id);
 settleNpcPilotedAirCourses(h.world,at);
 expect(airPositionAt(h.world,h.accepted.location,at)?.kind).toBe('air');
 settleWorldAirTravellers(h.world,h.day+h.accepted.quote.daysOneWay);
 for(const person of h.world.npcs){expect(person.locationId).toBe(h.to.id);expect(person.activity?.sinceDay).toBe(h.day-10);expect(person.activity?.untilDay).toBe(h.day+60);expect(person.activity?.airCourseLocationId).toBeUndefined();}
 expect(h.craft.ownerId).toBe(h.house.id);
});
it('superseding the actual pilot pointer stops the shared leg rather than landing the remaining peer',()=>{
 const h=admitted(),at=h.day+h.accepted.quote.daysOneWay/2;
 if(!h.pilot.activity)throw Error('Native admitted pilot has no activity');
 h.pilot.activity={...h.pilot.activity,airCourseLocationId:undefined};
 expect(actualNpcPilotOfAirCourse(h.world,h.accepted.fact.id)).toBeNull();
 settleNpcPilotedAirCourses(h.world,at);const stopped=airPositionAt(h.world,h.accepted.location,at);
 settleWorldAirTravellers(h.world,h.day+100);
 expect(h.world.npcs.find(person=>person.id===h.peer.id)?.locationId).toBe(h.accepted.location.id);
 expect(airPositionAt(h.world,h.accepted.location,h.day+100)?.point).toEqual(stopped?.point);
});
it('capacity requiring more than one actual trip cannot mint a simultaneous single-hull course',()=>{
 const h=arranged(),conveyance=requireConveyance('conv-spirit-boat'),heads=conveyance.heads+1;
 const quoted=quoteAnAirJourney(h.world.locations,h.from.id,h.to.id,conveyance,h.craft.power,heads);
 expect(quoted?.trips).toBeGreaterThan(1);
 const before=h.world.locations.length;
 expect(beginAnAirCourse(h.world,{bodyId:h.pilot.id,bodyName:h.pilot.name,fromId:h.from.id,toId:h.to.id,conveyanceId:conveyance.id,power:h.craft.power,vesselId:h.craft.id,artId:null,onDay:h.day,heads,owned:{ownerId:h.house.id,pilotId:h.pilot.id}})).toBeNull();
 expect(h.world.locations).toHaveLength(before);expect(h.house.resources.spirit_stones).toBe(1000);
});
it('the canonical yard selector retains the actual available row and excludes a hull already taken elsewhere',()=>{
 const h=arranged(),yard=whatThisHouseCouldTakeOut(h.world,h.house);
 expect(bestForThisRoad(yard,12,2,true,1000)?.rowId).toBe(h.craft.id);
 const at=h.world.objects.findIndex(row=>row.id===h.craft.id);
 h.world.objects[at]={...h.craft,possessorId:h.peer.id,data:{...h.craft.data,withId:h.peer.id}};
 expect(whatThisHouseCouldTakeOut(h.world,h.house).some(row=>row.rowId===h.craft.id)).toBe(false);
 expect(h.world.objects[at]?.ownerId).toBe(h.house.id);
});

/** This bounded operator arrangement creates ordinary actual NPC identities, then
 * asks the native store answer which prospective real head agrees. It never
 * changes a trait, RNG stream, price, custody outcome or funding answer. The
 * posting and its sampled term are thereafter produced by applyPostings. */
it('native house posting actually admits its approved hull and reaches the assigned town by its receipt',()=>{
 const h=arranged();h.world.npcs.splice(1);h.pilot.factionRankIndex=0;
 h.house.ranks=['Disciple','Elder','Head'];h.house.resources.power_ordinal=29;
 h.to.kind='settlement';h.to.data.population=100;
 h.from.links.push({toLocationId:h.to.id,kind:'road',travelDays:12,open:true,requiresKeyId:null,note:''});
 h.to.links.push({toLocationId:h.from.id,kind:'road',travelDays:12,open:true,requiresKeyId:null,note:''});
 h.pilot.activity={kind:'their_practice',note:'Ordinary preparation',withIds:[],sinceDay:h.day,untilDay:h.day+1};
 const candidates=Array.from({length:8},(_,index)=>{const person=createNpc(h.world.seed,{id:'actual-posting-head-'+index,name:'Actual house head',locationId:h.from.id,onDay:h.day,bornOnDay:h.day-40*365});person.factionId=h.house.id;person.factionRankIndex=2;return person;});
 const head=candidates.find(person=>theHouseLendsAnActualDutyCraft(h.world,h.house,h.pilot,h.craft,[],[{id:h.pilot.id,rankIndex:0},{id:person.id,rankIndex:2}],h.day)?.said.allowed);
 if(!head)throw Error('Bounded native house fixture has no actual agreeing head');
 h.world.npcs.push(head);
 expect(applyPostings(h.world,Math.floor(h.day/365),h.day)).toBeGreaterThan(0);
 const posted=h.world.npcs.find(person=>person.id===h.pilot.id);
 if(!posted?.activity?.airDutyReceiptId||!posted.activity.airCourseLocationId)throw Error('Native posting did not admit its actual air hull');
 const receipt=witnessIndexFor(h.world).byId.get(posted.activity.airDutyReceiptId);
 if(typeof receipt?.data.arrivalDay!=='number')throw Error('Native posting has no exact arrival receipt');
 const term=posted.activity.untilDay,spent=Number(h.house.resources.spirit_stones);
 expect(h.world.objects.find(row=>row.id===h.craft.id)?.possessorId).toBe(h.pilot.id);
 expect(h.world.objects.find(row=>row.id===h.craft.id)?.ownerId).toBe(h.house.id);
 advanceWorldForPlay(h.world,{days:receipt.data.arrivalDay-h.day,preciseDays:true});
 const arrived=h.world.npcs.find(person=>person.id===h.pilot.id);
 expect(arrived?.locationId).toBe(h.to.id);expect(arrived?.activity?.untilDay).toBe(term);
 expect(Number(h.house.resources.spirit_stones)).toBe(spent);
});

it('an actual pre-paid return receipt reaches home without a second debit and returns that same hull row',()=>{
 const h=admitted();
 advanceWorldForPlay(h.world,{days:h.accepted.quote.daysOneWay,preciseDays:true});
 // This is a native component service-term span, not a claim that a board
 // assigned this operator-arranged term or that an officer granted relief.
 advanceWorldForPlay(h.world,{days:h.day+60-h.world.currentDay,preciseDays:true});
 const pilot=h.world.npcs.find(person=>person.id===h.pilot.id);
 if(!pilot?.activity||pilot.locationId!==h.to.id)throw Error('Actual component duty body did not remain at its post');
 const before=Number(h.house.resources.spirit_stones),day=h.world.currentDay;
 const accepted=admitPaidHouseAirReturn(h.world,pilot,day,{kind:'travelling',note:'Returning from the completed component term',withIds:[],sinceDay:day,untilDay:null,fromLocationId:h.to.id,returnTo:h.from.id});
 if(!accepted)throw Error('Actual funded component return was unavailable');
 expect(Number(h.house.resources.spirit_stones)).toBe(before);
 expect(admitPaidHouseAirReturn(h.world,pilot,day,{...pilot.activity})).toBeNull();
 advanceWorldForPlay(h.world,{days:accepted.quote.daysOneWay,preciseDays:true});
 expect(h.world.npcs.find(person=>person.id===h.pilot.id)?.locationId).toBe(h.from.id);
 const hull=h.world.objects.find(row=>row.id===h.craft.id);
 expect(hull?.id).toBe(h.craft.id);expect(hull?.ownerId).toBe(h.house.id);expect(hull?.possessorId).toBeNull();
});

/** This component control calls the same actual selected-pilot/group read used
 * by native postings, then admits that exact quote and proves native landfall.
 * It is an explicit operator-arranged loan, not proof of a multi-load shuttle. */
it('the actual selected pilot and group use one canonical air quote through native admission and arrival',()=>{
 const h=arranged(),people=[h.pilot,h.peer];
 const read=quoteHouseAirDuty(h.world,h.house,people,h.pilot,h.craft,h.to.id,h.day);
 if(!read)throw Error('Actual two-body group has no piloted duty quote');
 const native=quoteAnAirJourney(h.world.locations,h.from.id,h.to.id,requireConveyance('conv-spirit-boat'),h.craft.power,people.length,
  {facts:witnessIndexFor(h.world).byId,onDay:h.day},1);
 expect(read.quote).toEqual(native);
 const loan=transferPossession(h.craft,{onDay:h.day,toHolderId:h.pilot.id,toHolderName:h.pilot.name,
  how:'lent',source:'Operator-arranged exact component loan'});
 h.world.objects[h.world.objects.findIndex(row=>row.id===loan.id)]=loan;
 const activities=new Map(people.map(person=>[person.id,{kind:'stationed' as const,note:'Actual component watch term',withIds:[],
  sinceDay:h.day,untilDay:h.day+60,returnTo:h.from.id,fromLocationId:h.from.id}]));
 const before=Number(h.house.resources.spirit_stones);
 h.house.resources.spirit_stones=before-read.quote.stonesBurned-read.back.stonesBurned;
 const accepted=admitPaidHouseAirDuty(h.world,h.house,people,h.pilot,loan,h.to.id,h.day,activities);
 if(!accepted)throw Error('Canonical actual pilot/group admission refused its available loan');
 expect(accepted.quote).toEqual(read.quote);
 expect(actualNpcPilotOfAirCourse(h.world,accepted.fact.id)?.id).toBe(h.pilot.id);
 for(const person of people)expect(h.world.npcs.find(row=>row.id===person.id)?.locationId).toBe(accepted.location.id);
 advanceWorldForPlay(h.world,{days:accepted.quote.daysOneWay,preciseDays:true});
 for(const person of people)expect(h.world.npcs.find(row=>row.id===person.id)?.locationId).toBe(h.to.id);
 expect(Number(h.house.resources.spirit_stones)).toBe(before-read.quote.stonesBurned-read.back.stonesBurned);
 expect(h.world.objects.find(row=>row.id===loan.id)?.ownerId).toBe(h.house.id);
});

/** Source audit found the unique shared outbound funding receipt admitted only
 * its pilot's return, leaving a ready peer without transport. These controls
 * arrange real replacement bodies and ask the existing native handover answer.
 * They exercise due-clock admission and shared arrival, or leave an unrelieved
 * peer on duty. No replacement, relief, return or elapsed outcome is stubbed.
 * The service term below is operator-arranged; portal board play is separate. */
function actualReplacements(h:ReturnType<typeof admitted>){
 const replacements=[h.pilot,h.peer].map((person,index)=>{
  const next=createNpc(h.world.seed,{id:'actual-return-relief-'+index,name:'Actual replacement',locationId:h.to.id,
   onDay:h.world.currentDay,bornOnDay:h.world.currentDay-20*365});
  next.factionId=h.house.id;next.activity={kind:'stationed',note:'Actual replacement on the posting ground',withIds:[],
   sinceDay:h.world.currentDay,untilDay:h.world.currentDay+60,returnTo:h.from.id};
  return {outgoingId:person.id,next};
 });
 h.world.npcs.push(...replacements.map(row=>row.next));return replacements;
}
it('native relieved peers return on the same real paid hull without a second purse debit',()=>{
 const h=admitted();advanceWorldForPlay(h.world,{days:h.accepted.quote.daysOneWay,preciseDays:true});
 const replacements=actualReplacements(h),before=Number(h.house.resources.spirit_stones);
 for(const row of replacements)expect(theyAreRelieved(h.world,{relievedId:row.outgoingId,townId:h.to.id,
  today:h.world.currentDay,replacementId:row.next.id})).toBe(true);
 advanceWorldForPlay(h.world,{days:1,preciseDays:true});
 const returnFact=[...witnessIndexFor(h.world).byId.values()].find(fact=>fact.data.houseDutyReturnOf===h.accepted.fact.id);
 if(!returnFact||typeof returnFact.data.arrivalDay!=='number')throw Error('Native due handover admitted no funded return');
 expect(returnFact.data.heads).toBe(2);
 const pilot=h.world.npcs.find(row=>row.id===h.pilot.id),peer=h.world.npcs.find(row=>row.id===h.peer.id);
 expect(pilot?.locationId).toBe(peer?.locationId);expect(pilot?.activity?.airCourseLocationId).toBeTruthy();
 advanceWorldForPlay(h.world,{days:returnFact.data.arrivalDay-h.world.currentDay,preciseDays:true});
 for(const person of [h.pilot,h.peer])expect(h.world.npcs.find(row=>row.id===person.id)?.locationId).toBe(h.from.id);
 expect(Number(h.house.resources.spirit_stones)).toBe(before);
 expect(h.world.objects.find(row=>row.id===h.craft.id)?.possessorId).toBeNull();
 expect(h.world.objects.find(row=>row.id===h.craft.id)?.ownerId).toBe(h.house.id);
});
it('the same native return refuses to carry an unrelieved peer away from their actual post',()=>{
 const h=admitted();advanceWorldForPlay(h.world,{days:h.accepted.quote.daysOneWay,preciseDays:true});
 const replacements=actualReplacements(h),row=replacements[0];if(!row)throw Error('No actual pilot replacement');
 expect(theyAreRelieved(h.world,{relievedId:row.outgoingId,townId:h.to.id,today:h.world.currentDay,
  replacementId:row.next.id})).toBe(true);
 const before=Number(h.house.resources.spirit_stones),peerBefore=h.world.npcs.find(person=>person.id===h.peer.id)?.activity?.untilDay;
 advanceWorldForPlay(h.world,{days:1,preciseDays:true});
 const returnFact=[...witnessIndexFor(h.world).byId.values()].find(fact=>fact.data.houseDutyReturnOf===h.accepted.fact.id);
 if(!returnFact||typeof returnFact.data.arrivalDay!=='number')throw Error('Native pilot has no actual funded return');
 expect(returnFact.data.heads).toBe(1);
 expect(h.world.npcs.find(person=>person.id===h.peer.id)?.locationId).toBe(h.to.id);
 expect(h.world.npcs.find(person=>person.id===h.peer.id)?.activity?.untilDay).toBe(peerBefore);
 expect(Number(h.house.resources.spirit_stones)).toBe(before);
});
