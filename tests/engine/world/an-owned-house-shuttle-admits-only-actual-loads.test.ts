/** The owned shuttle must load real bodies, including its pilot, rather than
 * treating an aggregate multi-trip quote as a voyage. These controls retain
 * actual empty returns, per-body service, native reopening and per-leg fuel.
 * The calendar fixture adds the missing timed berth assembly through ordinary
 * appointments, with a real connected road, funded chest and spare members.
 * An earlier one-date diagnostic omitted those facts and pinned a probabilistic
 * selection. No control writes a future course or copied passenger roster. */
import {expect,it} from 'vitest';
import {theExteriorGroundsOfAnNpcAirDeparture} from '../../../src/engine/world/an-actual-npc-air-course.js';
import Database from 'better-sqlite3';
import {mkdtempSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWorld,makeFaction,type WorldState} from '../../../src/engine/world/world-state.js';
import {createNpc,setRealm,markDead} from '../../../src/engine/world/npc-state.js';
import {makeLocation} from '../../../src/engine/world/locations.js';
import {aVehicleOf} from '../../../src/engine/world/a-vehicle.js';
import {requireConveyance} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {getSendingReason} from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import {postingFor} from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import {quoteHouseAirDuty,theHouseLendsAnActualDutyCraft} from '../../../src/engine/world/a-house-party-takes-an-actual-air-leg.js';
import {beginAnActualHouseAirShuttle,aShuttleMemberActuallyServed,actualShuttleReturnDay,actualShuttleService} from '../../../src/engine/world/a-house-party-takes-an-actual-air-shuttle.js';
import {advanceWorldForPlay} from '../../../src/engine/world/driver.js';
import {journeyTimeHasReached} from '../../../src/engine/world/places-on-the-way.js';
import {witnessIndexFor} from '../../../src/engine/world/witness-reaction-index.js';
import {stopAnAirCourse} from '../../../src/engine/world/an-air-course-in-the-world.js';
import {priceJourney,whatTheChestBurns} from '../../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import {WorldStateRepository} from '../../../src/storage/repos/world-state.repo.js';
import {migrateWorld} from '../../../src/storage/migrations.world.js';
/** Component bodies are already gathered outside. The separate calendar
 * control makes its members walk from their actual routine positions. */
function arranged(){
 const world=createWorld({seed:'actual-owned-two-load-sending',regionCount:0,skipPriorAges:true});world.currentHour=0;world.populationTarget=0;
 const day=world.currentDay,from=makeLocation({id:'shuttle-origin',name:'Departure ground',kind:'settlement',data:{metricXLi:0,metricYLi:0,metricExtentLi:3}}),
 to=makeLocation({id:'shuttle-target',name:'Service ground',kind:'settlement',data:{metricXLi:48,metricYLi:64,metricExtentLi:3}});world.locations.push(from,to);
 const house=makeFaction({id:'shuttle-house',name:'Sending house',ranks:['Disciple','Elder','Head'],seatLocationId:from.id,resources:{spirit_stones:1000}});world.factions.push(house);
 const craft=requireConveyance('conv-spirit-boat'),hull=aVehicleOf({id:'shuttle-actual-hull',conveyanceId:craft.id,ownerId:house.id,ownerName:house.name,at:from.id});world.objects.push(hull);
 const people=Array.from({length:craft.heads+1},(_,index)=>{let n=createNpc(world.seed,{id:'shuttle-member-'+index,name:'Actual member '+index,
  locationId:from.id,onDay:day,bornOnDay:day-40*365});if(index===0)n=setRealm(n,29,day);n.factionId=house.id;n.factionRankIndex=0;return n;});world.npcs.push(...people);
 for(const person of people)person.activity={kind:'idle',note:'Gathered together at the departure ground',
  withIds:people.filter(other=>other.id!==person.id).map(other=>other.id),sinceDay:day,untilDay:day+1};
 for(const person of people){const ground=theExteriorGroundsOfAnNpcAirDeparture(world,person,to.id,day);
  expect(ground?.from.id).toBe(from.id);expect(ground?.to.id).toBe(to.id);}
 const pilot=people[0]!,roll=people.map(n=>({id:n.id,rankIndex:n.factionRankIndex}));
 const heads=Array.from({length:8},(_,index)=>{const n=createNpc(world.seed,{id:'shuttle-head-'+index,name:'Actual head',locationId:from.id,onDay:day,bornOnDay:day-60*365});n.factionId=house.id;n.factionRankIndex=2;return n;});
 const head=heads.find(n=>theHouseLendsAnActualDutyCraft(world,house,pilot,hull,[],[...roll,{id:n.id,rankIndex:2}],day)?.said.allowed);
 if(!head)throw Error('Bounded native shuttle fixture has no actual agreeing head');world.npcs.push(head);roll.push({id:head.id,rankIndex:2});
 const reason=getSendingReason('sending-to-look-in-on-a-posting');if(!reason||reason.termBasis!=='on_site')throw Error('Actual catalog has no on-site posting check');
 const posting=postingFor({reason,house,pitchOrdinal:0,locationId:to.id,hands:people.length});
 const row={posting,party:people.map(n=>({id:n.id,name:n.name,ordinal:n.cultivation.realmOrdinal})),departsOnDay:day,locationId:to.id,counterparties:[]};
 const activities=new Map(people.map(n=>[n.id,{kind:'out_with_a_party' as const,note:'Actual catalog posting check',withIds:people.filter(p=>p.id!==n.id).map(p=>p.id),
  sinceDay:day,untilDay:day+posting.days,fromLocationId:from.id,returnTo:from.id}]));
 const quote=quoteHouseAirDuty(world,house,people,pilot,hull,to.id,day,false);if(!quote)throw Error('Actual selected native group lacks shuttle quote');
 return {world,day,from,to,house,people,pilot,hull,row,activities,roll,quote};
}
function start(h:ReturnType<typeof arranged>){const result=beginAnActualHouseAirShuttle(h.world,h.house,h.people,h.pilot,h.hull,h.row,h.day,h.activities,[],h.roll);
 if(!result)throw Error('Ordinary approved actual shuttle failed initial native admission');h.world.pendingSendings=[result.row];return result;}
function advance(world:WorldState,days:number){return advanceWorldForPlay(world,{days,preciseDays:true,pressure:{intensity:0,peopleWalkOutOnTheirOwnAccount:false}});}
function legs(world:WorldState,id:string){return [...(witnessIndexFor(world).references.get(id)??[])].filter(f=>f.data.airCourse===true&&f.data.houseDutyDispatchId===id);}
function body(world:WorldState,id:string){const n=world.npcs.find(n=>n.id===id);if(!n)throw Error('Actual original sending body disappeared');return n;}
function exactClock(actual:number,expected:number){expect(journeyTimeHasReached(actual,expected)&&journeyTimeHasReached(expected,actual)).toBe(true);}
it('explicit piloted fractional quotes sum the same real one-leg fuel while legacy and single-load quotes keep their contract',()=>{
 const craft=requireConveyance('conv-spirit-boat'),input={walkingDays:1,conveyance:craft,heads:craft.heads+1,preciseDays:true};
 const actual=priceJourney({...input,pilotHeads:1});if(!actual?.pilotedLoads)throw Error('Real multi-load quote has no native load projection');
 const sum=actual.pilotedLoads.reduce((total,leg)=>{const single=priceJourney({...input,heads:leg.heads,pilotHeads:1});
  if(!single)throw Error('Canonical actual load has no native quote');return total+single.stonesBurned;},0);
 expect(actual.stonesBurned).toBe(sum);expect(actual.pilotedLoads.map(l=>l.heads)).toEqual([craft.heads,1,2]);
 const legacy=priceJourney(input);expect(legacy.stonesBurned).toBe(whatTheChestBurns({conveyance:craft,daysOneWay:legacy.daysOneWay,heads:input.heads,trips:legacy.trips}));
 const single=priceJourney({...input,heads:2,pilotHeads:1});if(!single)throw Error('Native single load has no quote');
 expect(single.stonesBurned).toBe(whatTheChestBurns({conveyance:craft,daysOneWay:single.daysOneWay,heads:2,trips:1,pilotHeads:1}));
});
it('actual loads, empty return and native reopen keep waiting bodies at origin and per-body site terms honest',()=>{
 const h=arranged(),before=Number(h.house.resources.spirit_stones),started=start(h),dispatch=started.row.dispatchFactId!;
 let world=h.world;const one=started.read.quote.daysOneWay,ids=h.people.map(n=>n.id),last=ids.at(-1)!;
 expect(legs(world,dispatch)).toHaveLength(1);expect(legs(world,dispatch)[0]?.actors).toHaveLength(requireConveyance('conv-spirit-boat').heads);
 expect(body(world,last).locationId).toBe(h.from.id);expect(Number(h.house.resources.spirit_stones)).toBe(before-started.fuel);
 advance(world,one/2);expect(body(world,last).locationId).toBe(h.from.id);
 const file=join(mkdtempSync(join(tmpdir(),'actual-shuttle-native-')),'world.db');let db=new Database(file);
 try{migrateWorld(db);new WorldStateRepository(db).saveWorld(world);db.close();db=new Database(file);migrateWorld(db);
  const restored=new WorldStateRepository(db).loadWorld(world.id);if(!restored)throw Error('Native file reopen lost current sending');world=restored;
  expect(world.pendingSendings?.[0]?.dispatchFactId).toBe(dispatch);expect(body(world,last).locationId).toBe(h.from.id);
 }finally{db.close();}
 advance(world,one/2);expect(legs(world,dispatch)).toHaveLength(2);expect(legs(world,dispatch)[1]?.actors).toHaveLength(1);
 expect(body(world,ids[1]!).locationId).toBe(h.to.id);expect(body(world,last).locationId).toBe(h.from.id);
 advance(world,one);expect(legs(world,dispatch)).toHaveLength(3);expect(legs(world,dispatch)[2]?.actors).toHaveLength(2);
 expect(body(world,last).locationId).not.toBe(h.to.id);advance(world,one);
 const row=world.pendingSendings?.find(row=>row.dispatchFactId===dispatch);if(!row)throw Error('Native sending vanished before actual site service');
 expect(body(world,last).locationId).toBe(h.to.id);expect(aShuttleMemberActuallyServed(world,body(world,h.pilot.id),row)).toBe(false);
 const firstService=actualShuttleService(world,body(world,ids[1]!),row),pilotService=actualShuttleService(world,body(world,h.pilot.id),row);
 if(!firstService||!pilotService)throw Error('Actual deliveries have no bound service reading');
 exactClock(firstService.fromDay,h.day+one);exactClock(pilotService.fromDay,h.day+3*one);
 expect(pilotService.fromDay).toBeGreaterThan(firstService.fromDay);
 advance(world,row.posting.reason.days-one);expect(aShuttleMemberActuallyServed(world,body(world,h.pilot.id),row)).toBe(false);
 advance(world,one);expect(legs(world,dispatch).some(f=>f.data.houseDutyPhase==='homebound')).toBe(true);
 const paidBefore=Number(world.factions.find(f=>f.id===h.house.id)?.resources.spirit_stones);
 advance(world,one);expect(actualShuttleReturnDay(world,body(world,ids[1]!),row)).not.toBeNull();
 advance(world,started.read.back.daysForEverybody-one);
 for(const id of ids){expect(body(world,id).locationId).toBe(h.from.id);const actualReturn=legs(world,dispatch).filter(f=>
  f.data.houseDutyPhase==='homebound'&&f.actors.some(actor=>actor.id===id)).at(-1);
  if(!actualReturn||typeof actualReturn.data.arrivalDay!=='number')throw Error('Actual original body has no reached native return receipt');
  expect(journeyTimeHasReached(world.currentDay,actualReturn.data.arrivalDay)).toBe(true);}
 exactClock(world.currentDay,h.day+started.row.posting.days);
 expect(Number(world.factions.find(f=>f.id===h.house.id)?.resources.spirit_stones)).toBe(paidBefore);
 const returnedHull=world.objects.find(o=>o.id===h.hull.id);
 expect(returnedHull?.ownerId).toBe(h.house.id);expect(returnedHull?.possessorId).toBeNull();
 expect(returnedHull?.locationId).toBe(h.from.id);
 const payments=legs(world,dispatch).flatMap(leg=>[...(witnessIndexFor(world).references.get(leg.id)??[])].filter(f=>f.data.airFuelPaidFor===leg.id));
 expect(payments.reduce((sum,f)=>sum+Number(f.data.stonesDebited),0)).toBe(started.fuel);
});
it('an actual stopped course cannot admit later loads or complete waiting peoples service',()=>{
 const h=arranged(),started=start(h),id=started.row.dispatchFactId!,one=started.read.quote.daysOneWay;advance(h.world,one/2);
 const pilot=body(h.world,h.pilot.id),site=h.world.locations.find(p=>p.id===pilot.locationId);if(!site)throw Error('Actual hull has no native physical site');
 expect(stopAnAirCourse(h.world,site,h.world.currentDay,'Actual operator interruption')).not.toBeNull();
 const before=structuredClone(h.world.objects),purse=Number(h.house.resources.spirit_stones);advance(h.world,one*4);
 expect(legs(h.world,id)).toHaveLength(1);expect(body(h.world,h.people.at(-1)!.id).locationId).toBe(h.from.id);
 expect(aShuttleMemberActuallyServed(h.world,body(h.world,h.people.at(-1)!.id),started.row)).toBe(false);
 expect(h.world.objects).toEqual(before);expect(Number(h.house.resources.spirit_stones)).toBe(purse);
});
it('a dead actual pilot or superseding original member cannot receive a phantom next load',()=>{
 for(const mode of ['pilot-death','changed-work']as const){const h=arranged(),started=start(h),id=started.row.dispatchFactId!,one=started.read.quote.daysOneWay;
  advance(h.world,one/2);const target=mode==='pilot-death'?h.pilot.id:h.people.at(-1)!.id,index=h.world.npcs.findIndex(n=>n.id===target),n=h.world.npcs[index]!;
  h.world.npcs[index]=mode==='pilot-death'?markDead(n,h.world.currentDay,'Actual pilot death'):{...n,activity:{kind:'their_practice',note:'Actual superseding work',withIds:[],sinceDay:h.world.currentDay,untilDay:null}};
  const purse=Number(h.house.resources.spirit_stones);advance(h.world,one*4);
  expect(legs(h.world,id)).toHaveLength(1);expect(Number(h.house.resources.spirit_stones)).toBe(purse);
  expect(body(h.world,h.people.at(-1)!.id).locationId).toBe(h.from.id);
 }
});

it('an integer requested world span still reaches genuine fractional shuttle appointments without changing its external total',()=>{
 const h=arranged(),started=start(h),dispatch=started.row.dispatchFactId!,before=h.world.currentDay;
 const result=advanceWorldForPlay(h.world,{days:7,pressure:{intensity:0,peopleWalkOutOnTheirOwnAccount:false}});
 expect(result).toBeDefined();exactClock(h.world.currentDay,before+7);
 const actual=legs(h.world,dispatch);expect(actual).toHaveLength(started.read.quote.pilotedLoads!.length+started.read.back.pilotedLoads!.length);
 for(const receipt of actual){expect(Number(receipt.data.departureDay)).toBeGreaterThanOrEqual(before);
  expect(Number(receipt.data.arrivalDay)).toBeLessThanOrEqual(h.world.currentDay);}
 for(const person of h.people)expect(body(h.world,person.id).locationId).toBe(h.from.id);
});

/** First admission must fail before any actual funds, custody or linked work. */
it('a physically unavailable initial body refuses before house payment, loan, activity or accepted facts',()=>{
 const h=arranged(),member=h.people.at(-1)!;
 member.locationId=h.to.id;
 const objects=structuredClone(h.world.objects),activities=h.people.map(n=>structuredClone(n.activity)),
  purse=Number(h.house.resources.spirit_stones),facts=h.world.history.facts.length;
 expect(beginAnActualHouseAirShuttle(h.world,h.house,h.people,h.pilot,h.hull,h.row,h.day,h.activities,[],h.roll)).toBeNull();
 expect(Number(h.house.resources.spirit_stones)).toBe(purse);expect(h.world.objects).toEqual(objects);
 expect(h.people.map(n=>n.activity)).toEqual(activities);expect(h.world.history.facts).toHaveLength(facts);
 expect(h.world.pendingSendings??[]).toHaveLength(0);
});
it('the ordinary no-shuttle integer world request retains its native total and does not create dispatches',()=>{
 const world=createWorld({seed:'actual-no-shuttle-integer-control',regionCount:0,skipPriorAges:true});world.populationTarget=0;
 const before=world.currentDay;
 advanceWorldForPlay(world,{days:7,pressure:{intensity:0,peopleWalkOutOnTheirOwnAccount:false}});
 exactClock(world.currentDay,before+7);expect(world.pendingSendings??[]).toHaveLength(0);
 expect(world.history.facts.some(f=>f.data.houseAirShuttle===true)).toBe(false);
});

it('past and future first admissions conserve actual clock, treasury, custody, bodies and occurrence history',()=>{
 for(const offset of [-1,1]){const h=arranged(),before=structuredClone({day:h.world.currentDay,hour:h.world.currentHour,
  resources:h.house.resources,objects:h.world.objects,npcs:h.world.npcs,history:h.world.history,pending:h.world.pendingSendings});
 expect(beginAnActualHouseAirShuttle(h.world,h.house,h.people,h.pilot,h.hull,h.row,h.day+offset,h.activities,[],h.roll)).toBeNull();
 expect({day:h.world.currentDay,hour:h.world.currentHour,resources:h.house.resources,objects:h.world.objects,
  npcs:h.world.npcs,history:h.world.history,pending:h.world.pendingSendings}).toEqual(before);}
});
/** The original one-date diagnostic demanded a dispatch at a probabilistic
 * appointment and omitted the road and the hand kept at the gate. This one
 * living world advances through actual appointments without forcing a draw. */
it('actual calendar sendings assemble before accepting their current-clock loads',()=>{
 const h=arranged(),enemy=makeFaction({id:'shuttle-actual-rival',name:'Rival house',ranks:['Disciple','Elder','Head'],seatLocationId:h.to.id});
 h.house.standing[enemy.id]=-100;enemy.standing[h.house.id]=-100;h.world.factions.push(enemy);
 h.house.resources.spirit_stones=100000;
 h.from.links.push({toLocationId:h.to.id,kind:'road',travelDays:12,open:true,requiresKeyId:null,note:''});
 h.to.links.push({toLocationId:h.from.id,kind:'road',travelDays:12,open:true,requiresKeyId:null,note:''});
 for(let index=0;index<3;index++){
  const n=createNpc(h.world.seed,{id:'calendar-spare-'+index,name:'Actual spare',locationId:h.from.id,
   onDay:h.day,bornOnDay:h.day-20*365});n.factionId=h.house.id;h.world.npcs.push(n);
 }
 let at=Math.floor(h.day/365)*365+175;if(!(at>h.day))throw Error('Pinned calendar fixture is not before its actual sending appointment');
 const observed:number[]=[];
 for(let appointment=0;appointment<16;appointment++,at+=365){
 advanceWorldForPlay(h.world,{days:at-h.world.currentDay,pressure:{intensity:0,peopleWalkOutOnTheirOwnAccount:true},
  atWorldBoundary:(world,onDay)=>{exactClock(world.currentDay,onDay);observed.push(onDay);}});
 exactClock(h.world.currentDay,at);expect(observed.some(day=>journeyTimeHasReached(day,at)&&journeyTimeHasReached(at,day))).toBe(true);
 expect(h.world.pressureCursor?.completed).toContain('sendings');
 advanceWorldForPlay(h.world,{days:.25,preciseDays:true,pressure:{intensity:0,peopleWalkOutOnTheirOwnAccount:true}});
 if(h.world.history.facts.some(f=>f.data.houseAirShuttle===true))break;
 }
 const dispatches=h.world.history.facts.filter(f=>f.data.houseAirShuttle===true);
 const sink=process.env.RPG_SHUTTLE_CALENDAR_DIAGNOSTIC_PATH;
 if(sink)appendFileSync(sink,JSON.stringify({worldSeed:h.world.seed,initialDay:h.day,actualDay:h.world.currentDay,appointment:at,observed,
  completed:h.world.pressureCursor?.completed,dispatches:dispatches.map(f=>({id:f.id,day:f.day,actors:f.actors.map(a=>a.id)})),
  pending:(h.world.pendingSendings??[]).map(r=>({dispatch:r.dispatchFactId,reason:r.posting.reason.id,departs:r.departsOnDay,people:r.party.map(n=>n.id)}))})+'\n');
 if(dispatches.length===0)throw Error('Actual calendars admitted no shuttle: '+JSON.stringify({pending:h.world.pendingSendings,npcs:h.world.npcs.map(n=>({id:n.id,at:n.locationId,doing:n.activity})),facts:h.world.history.facts.map(f=>({day:f.day,data:f.data}))}));
 expect(h.world.history.facts.some(f=>f.data.houseAssembly===true)).toBe(true);
 for(const fact of dispatches){exactClock(fact.day,at+.25);
  const accepted=legs(h.world,fact.id);expect(accepted.length).toBeGreaterThan(0);
  for(const course of accepted)exactClock(Number(course.data.departureDay),at+.25);}
});
