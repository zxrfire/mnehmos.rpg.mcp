/** Oct7 native passenger06 root65429 already proved actual carriage stranger
 * Bai Xuwu could give his name and answer again on the same paid course. The
 * earlier 'merchant' request reached another man: secret occupation is not a
 * unique public address. This control reads the actual visible descriptor.
 * Latest ruling: incidental passengers share native PRESENCE, never recruitment.
 * An established companion separately keeps their actual original agreement.
 * Actual boarding/fare/capacity, .125 replies, world/body clocks and landfall
 * remain native. The player buys and packs provisions through the existing native
 * 60-day purchase authority before boarding; no inventory count is assigned.
 * ScriptedProvider supplies intentions only, not NPC outcomes.
 * This new integrated-source control is unrun; no quiet-arrival or prose claim
 * is inferred from the older standalone conversation evidence. */
import {expect,it} from 'vitest';
import {makeGame,ScriptedProvider} from './harness.js';
import {ProviderNarrator} from '../../src/web/narrator.js';
import {createWorld,resetCultivationWorlds,prepareWorldClockForPreciseSpan} from '../../src/server/state/cultivation-world.js';
import {createNpc} from '../../src/engine/world/npc-state.js';
import {worldLocationFor} from '../../src/web/entities.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {whatRunsFromHere,stonesFor} from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import {quotePublicCarriage,commitPublicCarriage,publicCarriagePassage} from '../../src/engine/world/public-carriages.js';
import {keepThePaidCarriage,thePaidCarriageClaim} from '../../src/web/a-paid-carriage-on-the-road.js';
import {passHours} from '../../src/web/routine-invitations.js';
import {journeyTimeHasReached} from '../../src/engine/world/places-on-the-way.js';
import {thePlayerIsSureItIsThem} from '../../src/web/the-narrator-plays-the-world.js';
import {peopleInThisPlace} from '../../src/web/hearsay.js';
it('talks to an actual unknown fellow carriage passenger and keeps prior company distinct at arrival',async()=>{
 const plans:string[]=[],{game,db}=makeGame({seed:'ordinary-fellow-carriage',worldEnabled:true,narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
 resetCultivationWorlds();await createWorld({seed:'precise-sea-world',presentYear:0});await game.newRun('Carriage traveller');
 let now=game.currentRun();game.repos.cultivators.update(now.cultivator.id,{location:'Emerald Water City',standingIn:null,realmOrdinal:20,hp:1000,maxHp:1000,spiritStones:5000,satiety:12});now=game.currentRun();
 game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);const world=game.atHand!;
 try{
  const from=worldLocationFor(world,now.cultivator.location)!;
  const line=whatRunsFromHere(game,now.cultivator,routineTime(world)).find(one=>one.service==='carriage'&&one.runsFromDay===null&&one.days>1)!;
  expect(line).toBeTruthy();const to=worldLocationFor(world,line.to)!,fare=stonesFor(line.cashPerSeat);
  const provisions=game.buyProvisions(game.currentRun().cultivator,60);expect(provisions.rations).toBeGreaterThan(0);
  game.putBackWhatWasNotEaten(provisions.cultivator,{endState:{rationsRemaining:provisions.rations}});
  const passenger=createNpc(world.seed,{id:'actual-fellow-carriage-passenger',onDay:routineTime(world),bornOnDay:routineTime(world)-25*365,locationId:from.id,occupation:'merchant',takenNames:new Set(world.npcs.map(one=>one.name)),spiritStones:5000});
  const companion=createNpc(world.seed,{id:'actual-established-carriage-companion',onDay:routineTime(world),bornOnDay:routineTime(world)-25*365,locationId:from.id,takenNames:new Set([...world.npcs.map(one=>one.name),passenger.name]),spiritStones:5000});
  world.npcs.push(passenger,companion);
  game.putThemOnTheRoadWithYou(now.cultivator,[{id:companion.id,name:companion.name}],{note:'An already agreed journey together.',forDays:30});
  expect(game.whoIsWithYouOnTheRoad(now.cultivator).map(one=>one.id)).toContain(companion.id);
  expect(game.whoIsWithYouOnTheRoad(now.cultivator).map(one=>one.id)).not.toContain(passenger.id);
  const receiptIds:string[]=[];
  for(const peer of [passenger,companion]){
   const quote=quotePublicCarriage(world,{fromId:from.id,toId:to.id,day:routineTime(world),conveyanceId:'conv-carriage-mortal',passengerIds:[peer.id],fareStones:fare,hired:false})!;
   expect(quote).toBeTruthy();const receipt=commitPublicCarriage(world,quote)!;expect(receipt).toBeTruthy();receiptIds.push(receipt.id);
   const at=world.npcs.findIndex(one=>one.id===peer.id),actual=world.npcs[at]!;world.npcs[at]={...actual,spiritStones:actual.spiritStones-quote.fareStones};
  }
  const quote=quotePublicCarriage(world,{fromId:from.id,toId:to.id,day:routineTime(world),conveyanceId:'conv-carriage-mortal',passengerIds:[now.cultivator.id],fareStones:fare,hired:false,playedPassenger:{id:now.cultivator.id,locationId:from.id,alive:true}})!;
  expect(quote).toBeTruthy();const receipt=commitPublicCarriage(world,quote)!;expect(receipt).toBeTruthy();
  game.repos.cultivators.applyDeltas(now.cultivator.id,{spiritStones:-quote.fareStones});keepThePaidCarriage(db,now.cultivator.id,receipt.id);game.theWorldMoved();
  const moving=await passHours(game,game.currentRun().run,game.currentRun().cultivator,3);expect(moving.finished,JSON.stringify(moving.spent?.calls)).toBe(true);
  const body=game.currentRun().cultivator,ground=worldLocationFor(world,body.location)!;
  const read=peopleInThisPlace(game.repos,body,world,ground),area=read.whereIs.get(passenger.id)!;expect(area).toBeTruthy();game.repos.cultivators.standIn(body.id,area);
  expect(game.present(game.currentRun().cultivator).map(one=>one.id)).toContain(passenger.id);
  const descriptor=game.reachFrom(game.currentRun().cultivator).find(person=>person.id===passenger.id)?.alsoCalled
   .find(said=>game.somebodyAtHand(said,game.currentRun().cultivator)?.id===passenger.id)!;
  expect(descriptor,JSON.stringify(game.present(game.currentRun().cultivator))).toBeTruthy();expect(thePlayerIsSureItIsThem(passenger.name,game.knowledge.provenanceOf(body.id,'cultivator',passenger.id))).toBe(false);
  const before=game.currentRun(),day=routineTime(world);
  plans.push(JSON.stringify({action:'interact',target:descriptor,intent:'talk',topic:'hello'}));
  const greeting=await game.act('I greet '+descriptor+' beside me.');
  expect(greeting.toolCalls.find(call=>call.name==='narrator.plan')?.source).toBe('model');
  expect(greeting.toolCalls.some(call=>call.name==='engine.askedAbout'&&call.ok&&call.summary.startsWith('Asked '+passenger.name+' about ')),JSON.stringify(greeting.toolCalls)).toBe(true);
  expect(greeting.narration).toContain(passenger.name);expect(thePlayerIsSureItIsThem(passenger.name,game.knowledge.provenanceOf(body.id,'cultivator',passenger.id))).toBe(true);
  plans.push(JSON.stringify({action:'interact',target:passenger.name,intent:'talk',topic:'Where are you bound?'}));const reply=await game.act('I ask '+passenger.name+' where they are bound.');
  expect(reply.toolCalls.some(call=>call.name==='engine.askedAbout'&&call.ok&&call.summary.startsWith('Asked '+passenger.name+' about ')),JSON.stringify(reply.toolCalls)).toBe(true);
  const after=game.currentRun(),current=publicCarriagePassage(world,receipt.id,body.id,routineTime(world))!;
  expect(journeyTimeHasReached(after.run.elapsedDays-before.run.elapsedDays,.25)&&journeyTimeHasReached(.25,after.run.elapsedDays-before.run.elapsedDays)).toBe(true);
  expect(journeyTimeHasReached(routineTime(world)-day,.25)&&journeyTimeHasReached(.25,routineTime(world)-day)).toBe(true);
  expect(after.run.turn-before.run.turn).toBe(2);expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(current.leg.vesselId).toBe(quote.vesselId);expect(current.arrived).toBe(false);expect(thePaidCarriageClaim(db,body.id)?.receiptId).toBe(receipt.id);
  const aboardIds=new Set(world.npcs.filter(one=>one.activity?.vesselId===quote.vesselId&&one.activity.sinceDay===quote.departureDay&&one.activity.untilDay===quote.arrivalDay).map(one=>one.id));
  expect(game.present(after.cultivator).every(one=>aboardIds.has(one.id))).toBe(true);expect(game.present(after.cultivator).length).toBeLessThanOrEqual(3);
  for(const peer of [passenger,companion])expect(world.npcs.find(one=>one.id===peer.id)?.spiritStones).toBe(peer.spiritStones-fare);
  const arrive=await passHours(game,after.run,after.cultivator,current.remainingDays*24);
  expect(arrive.finished,JSON.stringify(arrive.spent?.calls)).toBe(true);expect(game.currentRun().cultivator.location).toBe(to.name);
  expect(thePaidCarriageClaim(db,body.id)).toBeNull();expect(world.npcs.find(one=>one.id===passenger.id)?.activity?.vesselId).toBeUndefined();
  expect(game.whoIsWithYouOnTheRoad(game.currentRun().cultivator).map(one=>one.id)).toContain(companion.id);
  expect(game.whoIsWithYouOnTheRoad(game.currentRun().cultivator).map(one=>one.id)).not.toContain(passenger.id);
 }finally{db.close();resetCultivationWorlds();}
},120_000);
