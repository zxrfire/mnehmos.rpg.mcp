/** Oct7 owner requires actual rooms aboard large spirit boats. Capacity alone
 * formerly produced decks, never interiors. Authoring slots in the existing
 * conveyance catalog gives the real object doors; the same body/activity area
 * is their sole changing occupant location. A party grants no cabin entry.
 * Existing Deck04/05 native deck proofs remain. Room07 native measured6PASS/1FAIL.
 * Room10 diagnostic3451 proved the assignment fixture used a stale factory hull:
 * indexOf(originalBoat)=-1 while the real current hull was at4522. Its canonical
 * row had no interiorRooms grant, so native entry correctly opened the player
 * owner's default door. The fixture now grants/closes the actual row byID; all
 * denied-time, damage, holder, title, ocean and receipt assertions are retained.
 * This TEST-only correction is not a production access-rule change. Its cabin assignment setup re-reads the actual current NPC
 * after native departure, since accepted boarding replaces old factory rows.
 * A stale saved hull slot is reset only at actual fresh boarding; matched
 * course continuation retains its changing slot. The next all7 native check
 * remains pending; this header records observations, not an acceptance claim.
 * They require ocean, real hull custody, finite course, native body
 * clock, fresh access, physical force and no room/title/goods teleport.
 */
import {expect,it} from 'vitest';
import {makeGame,ScriptedProvider} from './harness.js';
import {ProviderNarrator} from '../../src/web/narrator.js';
import {createWorld,resetCultivationWorlds,prepareWorldClockForPreciseSpan} from '../../src/server/state/cultivation-world.js';
import {publicShipLinesFrom} from '../../src/engine/world/public-shipping.js';
import {createNpc,setRealm} from '../../src/engine/world/npc-state.js';
import {aVehicleOf,takeItAlong,whoItIsWith} from '../../src/engine/world/a-vehicle.js';
import {walkingDaysFrom,walkingRouteFrom} from '../../src/engine/world/locations.js';
import {priceJourney} from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import {requireConveyance} from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {isWater,journeyTimeHasReached} from '../../src/engine/world/places-on-the-way.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {worldLocationFor} from '../../src/web/entities.js';
import {acceptOwnedPassage,ownedPassageClaim} from '../../src/web/an-owned-passage.js';
import {passHours} from '../../src/web/routine-invitations.js';
import {peopleInThisPlace} from '../../src/web/hearsay.js';
import {actualVesselRooms,grantVesselRoom,setVesselRoomDoor,vesselRoomAreaId} from '../../src/engine/world/rooms-in-a-vessel.js';
async function largeBoat() {
    const plans:string[]=[];
    const {game,db}=makeGame({seed:'precise-owned-ocean',worldEnabled:true,
        narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
    resetCultivationWorlds();await createWorld({seed:'precise-owned-ocean-world',presentYear:0});
    await game.newRun('Passage traveller');
    let now=game.currentRun();
    game.repos.cultivators.update(now.cultivator.id,{location:'Emerald Water City',standingIn:null,
        realmOrdinal:29,spiritStones:5000,hp:1000,maxHp:1000,satiety:100});
    now=game.currentRun();game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
    const world=game.atHand,day=routineTime(world),from=worldLocationFor(world,now.cultivator.location)!;
    const line=publicShipLinesFrom(world,from.name,day).find(one=>one.runsFromDay===null)!;
    const to=worldLocationFor(world,line.to)!;
    const boat=aVehicleOf({id:'actual-large-owned-hull',conveyanceId:'conv-spirit-boat',
        ownerId:now.cultivator.id,ownerName:now.cultivator.name,at:from.id});
    world.objects.push(boat);takeItAlong(world.objects,boat,now.cultivator.id);
    const companions=Array.from({length:8},(_,i)=>{
        const person=setRealm(createNpc(world.seed,{id:'actual-large-boat-companion-'+i,locationId:from.id,
            onDay:day,bornOnDay:day-40*365,takenNames:new Set(world.npcs.map(one=>one.name))}),29,day);
        world.npcs.push(person);return person;
    });
    const walkingDays=walkingDaysFrom(world.locations,from.id).get(to.id)!;
    const conveyance=requireConveyance('conv-spirit-boat');
    const quote=priceJourney({walkingDays,conveyance,power:boat.power,heads:1+companions.length});
    expect(conveyance.heads).toBeGreaterThanOrEqual(1+companions.length);expect(quote.trips).toBe(1);
    // A persisted old slot is not a new boarding admission. No second position is created.
    game.repos.cultivators.standIn(now.cultivator.id,vesselRoomAreaId(from.id,boat.id,'inner-cabin'));
    companions[0]!.activity={kind:'the_work_of_their_rank',note:'Ordinary work.',withIds:[],sinceDay:day,untilDay:null,
        standingIn:vesselRoomAreaId(from.id,boat.id,'inner-cabin')};
    const receiptId=acceptOwnedPassage(game,now.run,now.cultivator,{vesselId:boat.id,pilotId:companions[0]!.id,
        fromId:from.id,toId:to.id,walkingDays,days:quote.daysOneWay,conveyanceId:conveyance.id,power:boat.power,
        companions:companions.map(one=>one.id)});
    expect(game.currentRun().cultivator.standingIn).toBeNull();
    expect(world.npcs.find(npc=>npc.id===companions[0]!.id)!.activity!.standingIn).toBeNull();
    const route=walkingRouteFrom(world.locations,from.id,to.id)!;
    const waterIndex=route.findIndex((stop,i)=>i>0&&isWater(world.locations.find(place=>place.id===stop.locationId)!));
    expect(waterIndex).toBeGreaterThan(0);
    const edgeStart=route[waterIndex-1]!.days/walkingDays*quote.daysOneWay;
    const edgeEnd=route[waterIndex]!.days/walkingDays*quote.daysOneWay;
    expect(edgeEnd-edgeStart).toBeGreaterThan(.75);
    const reachedWaterAfter=(edgeStart+edgeEnd-.75)/2;
    const approach=await passHours(game,game.currentRun().run,game.currentRun().cultivator,reachedWaterAfter*24);
    expect(approach.finished,JSON.stringify(approach.spent?.calls)).toBe(true);
    expect(isWater(worldLocationFor(world,game.currentRun().cultivator.location)!)).toBe(true);
    return {game,db,plans,world,day,from,to,boat,companions,walkingDays,conveyance,quote,receiptId};
}


it('enters an authored cabin through its actual holder door and remains there during a reply span',async()=>{
 const {game,db,plans,world,boat,companions,receiptId}=await largeBoat();
 try {
  const before=game.currentRun(),moment=routineTime(world);
  const rooms=actualVesselRooms(boat),inner=rooms.find(room=>room.slot.id==='inner-cabin')!;
  expect(inner.closed).toBe(true);expect(inner.holderId).toBe(before.cultivator.id);
  plans.push(JSON.stringify({action:'move',target:inner.slot.name}));
  const entry=await game.act('I enter '+inner.slot.name+'.');
  expect(entry.toolCalls.some(call=>call.name==='world.walkAcrossThePlace'&&call.ok),JSON.stringify(entry.toolCalls)).toBe(true);
  const now=game.currentRun(),ground=worldLocationFor(world,now.cultivator.location)!;
  expect(now.cultivator.standingIn).toBe(vesselRoomAreaId(ground.id,boat.id,inner.slot.id));
  expect(actualVesselRooms(world.objects.find(one=>one.id===boat.id)!).find(room=>room.slot.id===inner.slot.id)!.closed).toBe(false);
  expect(game.present(now.cultivator)).toHaveLength(0); // party is not an invitation through a cabin door
  expect(journeyTimeHasReached(routineTime(world)-moment,.25)&&journeyTimeHasReached(.25,routineTime(world)-moment)).toBe(true);
  const held=now.cultivator.standingIn;
  const reply=await passHours(game,now.run,now.cultivator,3);
  expect(reply.finished,JSON.stringify(reply.spent?.calls)).toBe(true);
  expect(game.currentRun().cultivator.standingIn?.endsWith(held!.slice(held!.indexOf('#room#')))).toBe(true);
  expect(ownedPassageClaim(db,now.cultivator.id)?.receiptId).toBe(receiptId);
  expect(whoItIsWith(world.objects.find(one=>one.id===boat.id)!)).toBe(now.cultivator.id);
  expect(companions.every(npc=>!game.present(game.currentRun().cultivator).some(one=>one.id===npc.id))).toBe(true);
 } finally {db.close();resetCultivationWorlds();}
});
it('holds actual cabin assignment and damage on the hull without a party entry grant',async()=>{
 const {game,db,plans,world,boat,companions,receiptId}=await largeBoat();
 try {
  const before=game.currentRun(),holder=world.npcs.find(npc=>npc.id===companions[1]!.id)!,slot='inner-cabin';
  const boatIndex=world.objects.findIndex(one=>one.id===boat.id);
  expect(boatIndex).toBeGreaterThanOrEqual(0);
  const actualBoat=world.objects[boatIndex]!;
  const granted=grantVesselRoom(actualBoat,slot,before.cultivator.id,holder.id)!;
  const closed=setVesselRoomDoor(granted,slot,holder.id,[],true)!;
  world.objects[boatIndex]=closed;
  holder.activity={...holder.activity!,standingIn:vesselRoomAreaId(worldLocationFor(world,before.cultivator.location)!.id,boat.id,slot)};
  const read=peopleInThisPlace(game.repos,before.cultivator,world,worldLocationFor(world,before.cultivator.location)!);
  expect(read.whereIs.get(holder.id)).toBe(holder.activity.standingIn);
  expect(game.present(before.cultivator).some(one=>one.id===holder.id)).toBe(false);
  plans.push(JSON.stringify({action:'move',target:'the inner cabin'}));
  const denied=await game.act('I enter the inner cabin.');
  expect(denied.toolCalls.some(call=>call.action==='move'&&!call.ok),JSON.stringify(denied.toolCalls)).toBe(true);
  expect(game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
  plans.push(JSON.stringify({action:'destroy',target:'the door of the inner cabin'}));
  const broke=await game.act('I break the door of the inner cabin.');
  expect(broke.toolCalls.some(call=>call.name==='engine.readState'&&call.ok),JSON.stringify(broke.toolCalls)).toBe(true);
  const damaged=world.objects.find(one=>one.id===boat.id)!;
  expect(actualVesselRooms(damaged).find(room=>room.slot.id===slot)!.brokenOnDay).not.toBeNull();
  expect(damaged.ownerId).toBe(before.cultivator.id);
  expect(actualVesselRooms(damaged).find(room=>room.slot.id===slot)!.holderId).toBe(holder.id);
  expect(game.currentRun().cultivator.standingIn).toBe(before.cultivator.standingIn);
  expect(ownedPassageClaim(db,before.cultivator.id)?.receiptId).toBe(receiptId);
  plans.push(JSON.stringify({action:'move',target:'the inner cabin'}));
  const entered=await game.act('I enter the inner cabin.');
  expect(entered.toolCalls.some(call=>call.name==='world.walkAcrossThePlace'&&call.ok),JSON.stringify(entered.toolCalls)).toBe(true);
  expect(game.present(game.currentRun().cultivator).some(one=>one.id===holder.id)).toBe(true);
 } finally {db.close();resetCultivationWorlds();}
});
