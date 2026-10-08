/** Oct7 source audit: applySendings charged its craft before actual party/elder
 * gates and wrote a nominal airborne destination for retained live errands.
 * These operator-arranged current-party controls enter the new admission seam
 * used by that stillOut branch. A real catalog hull, ordinary whole-house loan
 * decision and actual two-leg quote must precede debit; refusal leaves every
 * object/body/purse/history row unchanged. Native elapsed arrival proves the
 * accepted selected bodies actually reach their site while their original term
 * survives. This is not proof of annual reason selection, mission settlement,
 * multi-load shuttle motion or continuous service attendance. No heavy run has
 * yet verified these new controls.
 * Oct7 successor: stillOut previously tried only its first air hull before
 * falling back to foot. Native spirit-boat factories produce significant
 * tracked hulls; identical grade/pilot loan questions have the same answer.
 * The retry control preserves actual factory grades and proves each actual
 * candidate reaches the canonical quote/loan path, with all-refused whole
 * state conservation. It does not fabricate a differently approved spare. */
import {expect,it} from 'vitest';
import {createWorld,makeFaction} from '../../../src/engine/world/world-state.js';
import {createNpc,setRealm} from '../../../src/engine/world/npc-state.js';
import {makeLocation} from '../../../src/engine/world/locations.js';
import {aVehicleOf} from '../../../src/engine/world/a-vehicle.js';
import {sendAnActualSelectedHouseParty,theHouseLendsAnActualDutyCraft,quoteHouseAirDuty,sendASelectedHousePartyOnAnAvailableAirHull} from '../../../src/engine/world/a-house-party-takes-an-actual-air-leg.js';
import {advanceWorldForPlay} from '../../../src/engine/world/driver.js';
import {requireConveyance} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
function arranged(){
 const world=createWorld({seed:'selected-current-house-sending',regionCount:0,skipPriorAges:true});world.currentHour=0;
 const day=world.currentDay;
 const from=makeLocation({id:'sending-origin',name:'Departure ground',kind:'settlement',data:{metricXLi:0,metricYLi:0,metricExtentLi:3}});
 const to=makeLocation({id:'sending-ground',name:'Service ground',kind:'settlement',data:{metricXLi:48,metricYLi:64,metricExtentLi:3}});world.locations.push(from,to);
 const house=makeFaction({id:'sending-house',name:'Sending house',ranks:['Disciple','Elder','Head'],seatLocationId:from.id,resources:{spirit_stones:1000}});world.factions.push(house);
 const pilot=setRealm(createNpc(world.seed,{id:'selected-pilot',name:'Selected pilot',locationId:from.id,onDay:day,bornOnDay:day-100*365}),29,day);
 const peer=createNpc(world.seed,{id:'selected-peer',name:'Selected disciple',locationId:from.id,onDay:day,bornOnDay:day-30*365});
 for(const person of [pilot,peer]){person.factionId=house.id;person.factionRankIndex=0;}world.npcs.push(pilot,peer);
 const craft=aVehicleOf({id:'selected-real-hull',conveyanceId:'conv-spirit-boat',ownerId:house.id,ownerName:house.name,at:from.id});world.objects.push(craft);
 const people=[pilot,peer],roll=people.map(person=>({id:person.id,rankIndex:person.factionRankIndex}));
 const activities=new Map(people.map(person=>[person.id,{kind:'out_with_a_party' as const,note:'Actual selected live sending',withIds:people.filter(p=>p.id!==person.id).map(p=>p.id),sinceDay:day,untilDay:day+720,fromLocationId:from.id,returnTo:from.id}]));
 return {world,day,from,to,house,pilot,peer,craft,people,roll,activities};
}
function withAgreeingHead(){
 const h=arranged();
 const heads=Array.from({length:8},(_,index)=>{const person=createNpc(h.world.seed,{id:'sending-head-'+index,name:'Actual head',locationId:h.from.id,onDay:h.day,bornOnDay:h.day-60*365});person.factionId=h.house.id;person.factionRankIndex=2;return person;});
 const head=heads.find(person=>theHouseLendsAnActualDutyCraft(h.world,h.house,h.pilot,h.craft,[],[...h.roll,{id:person.id,rankIndex:2}],h.day)?.said.allowed);
 if(!head)throw Error('Bounded current sending fixture has no actual agreeing head');h.world.npcs.push(head);h.roll.push({id:head.id,rankIndex:2});return h;
}
function send(h:ReturnType<typeof arranged>){return sendAnActualSelectedHouseParty(h.world,h.house,h.people,h.pilot,h.craft,h.to.id,h.day,h.activities,[],h.roll);}
it('an approved actual selected party pays its real two-leg quotes once and arrives without rewriting its term',()=>{
 const h=withAgreeingHead(),read=quoteHouseAirDuty(h.world,h.house,h.people,h.pilot,h.craft,h.to.id,h.day);
 if(!read)throw Error('Actual selected current group has no canonical direct quote');
 const before=Number(h.house.resources.spirit_stones),accepted=send(h);
 if(!accepted)throw Error('Approved current sending did not admit its real hull');
 expect(accepted.accepted.quote).toEqual(read.quote);expect(accepted.fuel).toBe(read.quote.stonesBurned+read.back.stonesBurned);
 expect(Number(h.house.resources.spirit_stones)).toBe(before-accepted.fuel);
 const hull=h.world.objects.find(row=>row.id===h.craft.id);expect(hull?.possessorId).toBe(h.pilot.id);expect(hull?.ownerId).toBe(h.house.id);
 for(const person of h.people)expect(h.world.npcs.find(row=>row.id===person.id)?.locationId).toBe(accepted.accepted.location.id);
 expect(send(h)).toBeNull();expect(Number(h.house.resources.spirit_stones)).toBe(before-accepted.fuel);
 advanceWorldForPlay(h.world,{days:accepted.accepted.quote.daysOneWay,preciseDays:true});
 for(const person of h.people){const actual=h.world.npcs.find(row=>row.id===person.id);expect(actual?.locationId).toBe(h.to.id);expect(actual?.activity?.sinceDay).toBe(h.day);expect(actual?.activity?.untilDay).toBe(h.day+720);}
});
it('missing whole-house approval refuses before custody, fuel, body or history change',()=>{
 const h=arranged();expect(theHouseLendsAnActualDutyCraft(h.world,h.house,h.pilot,h.craft,[],[],h.day)?.said.allowed).toBe(false);h.roll=[];
 const before=structuredClone({objects:h.world.objects,npcs:h.world.npcs,factions:h.world.factions,history:h.world.history,locations:h.world.locations});
 expect(send(h)).toBeNull();expect({objects:h.world.objects,npcs:h.world.npcs,factions:h.world.factions,history:h.world.history,locations:h.world.locations}).toEqual(before);
});
it('unfunded or multi-load selected parties cannot commit an aggregate airborne itinerary',()=>{
 for(const mode of ['unfunded','multi-load']as const){const h=withAgreeingHead();
  if(mode==='unfunded')h.house.resources.spirit_stones=0;
  else{const capacity=requireConveyance('conv-spirit-boat').heads;
   for(let index=h.people.length;index<=capacity;index++){const person=createNpc(h.world.seed,{id:'extra-selected-'+index,name:'Selected disciple',locationId:h.from.id,onDay:h.day,bornOnDay:h.day-30*365});person.factionId=h.house.id;h.world.npcs.push(person);h.people.push(person);h.activities.set(person.id,{...h.activities.get(h.peer.id)!,withIds:[]});}}
  const before=structuredClone({objects:h.world.objects,npcs:h.world.npcs,factions:h.world.factions,history:h.world.history,locations:h.world.locations});
  expect(send(h)).toBeNull();expect({objects:h.world.objects,npcs:h.world.npcs,factions:h.world.factions,history:h.world.history,locations:h.world.locations}).toEqual(before);
 }
});

it('exhausting actual refused hulls leaves payment, possession, people and history unchanged',()=>{
 const h=arranged();h.roll=[];h.world.objects.push(aVehicleOf({id:'refused-spare',conveyanceId:'conv-spirit-boat',
  ownerId:h.house.id,ownerName:h.house.name,at:h.from.id}));
 const before=structuredClone({objects:h.world.objects,npcs:h.world.npcs,factions:h.world.factions,
  history:h.world.history,locations:h.world.locations});
 const considered:string[]=[];
 expect(sendASelectedHousePartyOnAnAvailableAirHull(h.world,h.house,h.people,h.to.id,h.day,1,false,500,
  (_read,taking)=>{if(taking.rowId)considered.push(taking.rowId);return h.activities;},[],h.roll)).toBeNull();
 expect(new Set(considered)).toEqual(new Set(h.world.objects.map(row=>row.id)));
 expect({objects:h.world.objects,npcs:h.world.npcs,factions:h.world.factions,
  history:h.world.history,locations:h.world.locations}).toEqual(before);
});
