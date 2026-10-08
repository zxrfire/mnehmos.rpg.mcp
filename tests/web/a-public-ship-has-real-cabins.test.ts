/** Oct7 owner requires actual ordinary ships, rooms and individual passenger
 * speech. No flying spirit boat or invented captain substitutes for a mortal
 * shipmaster. Setup purchases an independent NPC berth through the runtime
 * planner, then the player's real buy handler boards the same hull. The named
 * fellow traveller produces the existing physical contact interruption, not an
 * artificial shorter voyage or a forced resolver result. The actual factory
 * hull carries catalog cabin doors and remains under its real operator.
 * These native controls preserve advertised full quote/fare/current
 * course, actual water, local .25 crossing and .125 speech. Cabin grants are
 * explicit operator fixture acts through the existing grant leaf, not party
 * permissions. The independent passenger begins at the actual landing;
 * room-to-landing movement is covered by npc-departure-approaches.test.ts.
 */
import {expect,it} from 'vitest';
import {makeGame,ScriptedProvider} from './harness.js';
import {ProviderNarrator} from '../../src/web/narrator.js';
import {createWorld,resetCultivationWorlds,prepareWorldClockForPreciseSpan} from '../../src/server/state/cultivation-world.js';
import {createNpc} from '../../src/engine/world/npc-state.js';
import {bookNpcPassageForRoute,isWater,journeyTimeHasReached} from '../../src/engine/world/places-on-the-way.js';
import {commitNpcPublicPassage} from '../../src/engine/world/ship-crew.js';
import {publicShipLinesFrom} from '../../src/engine/world/public-shipping.js';
import {actualVesselRooms,grantVesselRoom,vesselRoomAreaId} from '../../src/engine/world/rooms-in-a-vessel.js';
import {aSeatOnAShipOrACarriage} from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import {worldLocationFor} from '../../src/web/entities.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {recordedVoyage} from '../../src/web/a-ship-at-sea.js';
import {shipPassengerAt} from '../../src/engine/world/passenger-on-a-vessel.js';
import {theAreasOf} from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import {thePlayerIsSureItIsThem} from '../../src/web/the-narrator-plays-the-world.js';
import {FALSE_IMMORTAL_ORDINAL} from '../../src/engine/cultivation/realms.js';

async function boarded(){
 const plans:string[]=[],{game,db}=makeGame({seed:'ordinary-fellow-ship',worldEnabled:true,
  narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-public-cabin',timeoutMs:0})});
 resetCultivationWorlds();await createWorld({seed:'precise-sea-world',presentYear:0});await game.newRun('Passage traveller');
 let now=game.currentRun();game.repos.cultivators.update(now.cultivator.id,{location:'Emerald Water City',standingIn:null,
  realmOrdinal:FALSE_IMMORTAL_ORDINAL,spiritStones:5000,hp:1000,maxHp:1000,satiety:100});
 now=game.currentRun();game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
 const world=game.atHand,from=worldLocationFor(world,now.cultivator.location)!,day=routineTime(world);
 const line=publicShipLinesFrom(world,from.name,day).find(one=>one.runsFromDay===null&&one.days>2)!;
 const to=worldLocationFor(world,line.to)!;
 const merchant={...createNpc(world.seed,{id:'ordinary-public-cabin-passenger',locationId:from.id,onDay:day,
  bornOnDay:day-25*365,occupation:'merchant',takenNames:new Set(world.npcs.map(one=>one.name))}),spiritStones:5000};
 merchant.activity={kind:'idle',note:'At the landing to board.',withIds:[],sinceDay:day,untilDay:null,
  standingIn:theAreasOf(world,from).areas.find(one=>one.for==='landing')!.id};
 world.npcs.push(merchant);
 const personal=bookNpcPassageForRoute(world,merchant,to.id,day,'Taking wares to '+to.name+'.');
 expect(personal).not.toBeNull();world.npcs[world.npcs.findIndex(one=>one.id===merchant.id)]=personal!;
 expect(commitNpcPublicPassage(world,personal!)).toBe(true);
 const hullId=personal!.activity!.vesselId!;
 const actualHull=world.objects.find(one=>one.id===hullId)!;
 expect(actualHull.data?.conveyanceId).toBe('conv-water-ship');
 const landing=theAreasOf(world,from).areas.find(one=>one.for==='landing');
 expect(landing).not.toBeUndefined();game.repos.cultivators.standIn(now.cultivator.id,landing!.id);
 game.theWorldMoved();now=game.currentRun();
 const fareBefore=now.cultivator.spiritStones;
 const purchase=await aSeatOnAShipOrACarriage(game,now.run,now.cultivator,to.name,'buy','ship');
 expect(purchase.outcome,JSON.stringify(purchase.calls)).toBe('executed');
 const receipt=recordedVoyage(db,now.cultivator.id)?.receiptId;
 expect(receipt,JSON.stringify(purchase.calls)).toBeTruthy();
 const actual=shipPassengerAt(world,receipt!,routineTime(world))!;
 expect(actual.unavailable,JSON.stringify(purchase.calls)).toBeNull();expect(actual.arrived).toBe(false);
 expect(isWater(worldLocationFor(world,game.currentRun().cultivator.location)!)).toBe(true);
 expect(actual.vesselId).toBe(hullId);expect(actual.crew.some(n=>n.id===actualHull.ownerId)).toBe(true);
 expect(game.currentRun().cultivator.spiritStones).toBeLessThan(fareBefore);
 return {game,db,plans,world,from,to,hullId,receipt:receipt!,merchantId:merchant.id,purchase};
}
it('enters the real public cabin and hears its actual fellow passenger while the same hull moves',async()=>{
 const {game,db,plans,world,hullId,receipt,merchantId}=await boarded();
 try {
  const before=game.currentRun(),moment=routineTime(world);
  const hull=world.objects.find(one=>one.id===hullId)!,room=actualVesselRooms(hull).find(one=>one.slot.id==='lower-cabin')!;
  const merchant=world.npcs.find(one=>one.id===merchantId)!;
  merchant.activity={...merchant.activity!,standingIn:vesselRoomAreaId(worldLocationFor(world,before.cultivator.location)!.id,hullId,room.slot.id)};
  game.theWorldMoved();
  plans.push(JSON.stringify({action:'move',target:room.slot.name}));const entered=await game.act('I enter '+room.slot.name+'.');
  expect(entered.toolCalls.some(call=>call.name==='world.walkAcrossThePlace'&&call.ok),JSON.stringify(entered.toolCalls)).toBe(true);
  expect(game.present(game.currentRun().cultivator).map(one=>one.id)).toContain(merchantId);
  const atRoom=game.currentRun(),chosen=atRoom.cultivator.standingIn;
  plans.push(JSON.stringify({action:'interact',target:'the merchant',intent:'talk',topic:'hello'}));
  const greeting=await game.act('I greet the merchant.');
  expect(greeting.toolCalls.some(call=>call.name==='engine.askedAbout'&&call.ok),JSON.stringify(greeting.toolCalls)).toBe(true);
  expect(thePlayerIsSureItIsThem(merchant.name,game.knowledge.provenanceOf(before.cultivator.id,'cultivator',merchantId))).toBe(true);
  expect(game.currentRun().cultivator.standingIn).toBe(chosen);
  expect(recordedVoyage(db,before.cultivator.id)?.receiptId).toBe(receipt);
  const actual=shipPassengerAt(world,receipt,routineTime(world))!;
  expect(actual.vesselId).toBe(hullId);expect(actual.toId).toBe(merchant.activity!.returnTo);
  expect(actual.arrived).toBe(false);expect(actual.unavailable).toBeNull();
  expect(game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.375,12);
  expect(journeyTimeHasReached(routineTime(world)-moment,.375)&&journeyTimeHasReached(.375,routineTime(world)-moment)).toBe(true);
  expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
 }finally{db.close();resetCultivationWorlds();}
});
it('refuses a real private cabin without time or title change and admits an explicit operator grant',async()=>{
 const {game,db,plans,world,hullId,receipt}=await boarded();
 try {
  const before=game.currentRun(),hull=world.objects.find(one=>one.id===hullId)!,room=actualVesselRooms(hull).find(one=>one.slot.id==='inner-cabin')!;
  expect(room.holderId).toBe(hull.ownerId);expect(room.holderId).not.toBe(before.cultivator.id);expect(room.closed).toBe(true);
  plans.push(JSON.stringify({action:'move',target:room.slot.name}));const denied=await game.act('I enter '+room.slot.name+'.');
  expect(denied.toolCalls.some(call=>call.action==='move'&&!call.ok),JSON.stringify(denied.toolCalls)).toBe(true);
  expect(game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
  expect(game.currentRun().cultivator.standingIn).toBe(before.cultivator.standingIn);
  const at=world.objects.findIndex(one=>one.id===hullId),current=world.objects[at]!;
  const granted=grantVesselRoom(current,room.slot.id,current.ownerId!,before.cultivator.id)!;
  expect(granted).not.toBeNull();world.objects[at]=granted;game.theWorldMoved();
  plans.push(JSON.stringify({action:'move',target:room.slot.name}));const entered=await game.act('I enter '+room.slot.name+'.');
  expect(entered.toolCalls.some(call=>call.name==='world.walkAcrossThePlace'&&call.ok),JSON.stringify(entered.toolCalls)).toBe(true);
  const after=game.currentRun(),actual=world.objects.find(one=>one.id===hullId)!;
  expect(actual.ownerId).toBe(hull.ownerId);expect(actual.possessorId).toBe(hull.possessorId);
  expect(actualVesselRooms(actual).find(one=>one.slot.id===room.slot.id)!.holderId).toBe(before.cultivator.id);
  expect(after.run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.25,12);
  expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(recordedVoyage(db,after.cultivator.id)?.receiptId).toBe(receipt);
 }finally{db.close();resetCultivationWorlds();}
});
