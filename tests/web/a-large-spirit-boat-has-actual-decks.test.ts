/**
 * Oct7 actual ship07 showed a true given-name reply followed by hourly deck
 * repacking and unrelated water-region company. Private craft were additionally
 * missing public hull grouping because their legitimate activities have no sea
 * lane ID. Eight real travelling companions expose more than the foreground cap
 * and require another actual deck; capacity does not invent cabins. The later authored interior-layout
 * addition supplies real catalog rooms separately; this proof still validates
 * every public deck and exact-hull co-location without deriving rooms from heads. Local deck
 * movement must retain the same course and spend native .25 time before entry,
 * not call continueOwnedPassage as if foredeck were a new geographical port.
 * A different actually booked public ship on the same water is not this boat's
 * company. These controls retain actual ocean approach, world/body clock, fuel,
 * pilot, custody and receipts. No native event, reply or consent result is forced.
 * Verification: root Deck04 native84364 passed both large-boat controls;
 * root Deck05 native92877 passed the original ship conversation/current-deck
 * control and shore-room refusal. All runtime modules loaded, mirror/hash
 * integrity held. These are native mechanics proofs, not model prose proof.
 */
import { expect, it } from 'vitest';
import { makeGame, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { createWorld, resetCultivationWorlds, prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { publicShipLinesFrom, quotePublicPassage } from '../../src/engine/world/public-shipping.js';
import { commitNpcPublicPassage } from '../../src/engine/world/ship-crew.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { createNpc, setRealm } from '../../src/engine/world/npc-state.js';
import { aVehicleOf, takeItAlong, whoItIsWith } from '../../src/engine/world/a-vehicle.js';
import { walkingDaysFrom, walkingRouteFrom } from '../../src/engine/world/locations.js';
import { priceJourney } from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { isWater, startNpcPassage, journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { acceptOwnedPassage, ownedPassageClaim, ownedCarrierAt } from '../../src/web/an-owned-passage.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { actualCarrierScene } from '../../src/web/the-actual-carrier-scene.js';
import { thePlayerIsSureItIsThem } from '../../src/web/the-narrator-plays-the-world.js';

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
    const receiptId=acceptOwnedPassage(game,now.run,now.cultivator,{vesselId:boat.id,pilotId:companions[0]!.id,
        fromId:from.id,toId:to.id,walkingDays,days:quote.daysOneWay,conveyanceId:conveyance.id,power:boat.power,
        companions:companions.map(one=>one.id)});
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

it('moves to another actual private-boat deck then greets a real person without changing course',async()=>{
    const {game,db,plans,world,boat,companions,walkingDays,conveyance,quote,receiptId,day}=await largeBoat();
    try {
        const before=game.currentRun(),ground=worldLocationFor(world,before.cultivator.location)!;
        const read=peopleInThisPlace(game.repos,before.cultivator,world,ground);
        const ids=new Set(companions.map(one=>one.id));
        expect(read.people.filter(one=>ids.has(one.id)).length).toBe(8);
        expect(read.areas.filter(area=>area.for!=='room').every(area=>area.for==='deck')).toBe(true);
        expect(read.areas.filter(area=>area.for==='room').map(area=>area.name)).toEqual(
            conveyance.interiorLayout!.map(slot=>slot.name));
        expect(game.present(before.cultivator).length).toBeLessThanOrEqual(3);
        const other=read.areas.find(area=>area.id!==before.cultivator.standingIn
            && companions.some(person=>read.whereIs.get(person.id)===area.id))!;
        expect(other).toBeTruthy();
        const moment=routineTime(world),fuelBefore=before.cultivator.spiritStones;
        plans.push(JSON.stringify({action:'move',target:other.name}));
        const moved=await game.act('I move to '+other.name+'.');
        expect(moved.toolCalls.some(call=>call.name==='world.walkAcrossThePlace'&&call.ok),JSON.stringify(moved.toolCalls)).toBe(true);
        expect(ownedPassageClaim(db,before.cultivator.id)?.receiptId).toBe(receiptId);
        expect(game.currentRun().cultivator.standingIn).toBe(other.id);
        expect(journeyTimeHasReached(routineTime(world)-moment,.25)&&journeyTimeHasReached(.25,routineTime(world)-moment)).toBe(true);
        const current=game.currentRun();
        expect(current.run.turn-before.run.turn).toBe(1);
        const descriptions=['the man','the woman','the first man','the last man','the first woman','the last woman'];
        const description=descriptions.find(said=>ids.has(game.somebodyAtHand(said,current.cultivator)?.id??''))!;
        expect(description).toBeTruthy();const actor=game.somebodyAtHand(description,current.cultivator)!;
        expect(thePlayerIsSureItIsThem(actor.name,game.knowledge.provenanceOf(current.cultivator.id,'cultivator',actor.id))).toBe(false);
        plans.push(JSON.stringify({action:'interact',target:description,intent:'talk',topic:'hello'}));
        const greeting=await game.act('I greet '+description+' beside me.');
        expect(greeting.toolCalls.some(call=>call.name==='engine.askedAbout'&&call.ok&&call.summary.startsWith('Asked '+actor.name+' about ')),JSON.stringify(greeting.toolCalls)).toBe(true);
        expect(thePlayerIsSureItIsThem(actor.name,game.knowledge.provenanceOf(current.cultivator.id,'cultivator',actor.id))).toBe(true);
        const after=game.currentRun();
        expect(after.cultivator.standingIn).toBe(other.id);
        expect(game.present(after.cultivator).some(person=>person.id===actor.id)).toBe(true);
        expect(game.present(after.cultivator).every(person=>ids.has(person.id))).toBe(true);
        expect(journeyTimeHasReached(after.run.elapsedDays-before.run.elapsedDays,.375)&&journeyTimeHasReached(.375,after.run.elapsedDays-before.run.elapsedDays)).toBe(true);
        expect(after.run.turn-before.run.turn).toBe(2);
        expect(ownedPassageClaim(db,after.cultivator.id)?.receiptId).toBe(receiptId);
        expect(whoItIsWith(boat)).toBe(after.cultivator.id);
        expect(ownedCarrierAt(world,receiptId,after.cultivator,routineTime(world))?.unavailable).toBeNull();
        const fuelThrough=(at:number)=>priceJourney({walkingDays:walkingDays*Math.min(quote.daysOneWay,at-day)/quote.daysOneWay,
            conveyance,power:boat.power,heads:1+companions.length}).stonesBurned;
        expect(fuelBefore-after.cultivator.spiritStones).toBe(fuelThrough(routineTime(world))-fuelThrough(moment));
    } finally {db.close();resetCultivationWorlds();}
});

it('excludes a separately booked real public hull and regional actors from private-boat company',async()=>{
    const {game,db,world,from,to,companions,receiptId}=await largeBoat();
    try {
        const departure=routineTime(world),quote=quotePublicPassage(world,from.id,to.id,departure,1)!;
        expect(quote).toBeTruthy();
        const person=createNpc(world.seed,{id:'actual-other-public-hull-passenger',locationId:from.id,onDay:departure,
            bornOnDay:departure-30*365,occupation:'merchant',takenNames:new Set(world.npcs.map(one=>one.name))});
        const booked=startNpcPassage(world.locations,{...person,spiritStones:5000},{lane:quote.lane,destinationId:to.id,
            onDay:quote.departureDay,days:quote.days,fareStones:quote.fareStones,purpose:'Taking wares to '+to.name+'.'})!;
        world.npcs.push(booked);expect(commitNpcPublicPassage(world,booked)).toBe(true);
        const publicReceipt=world.history.facts.find(fact=>fact.data.publicPassage===true&&fact.data.vesselId===quote.vesselId
            &&fact.actors.some(actor=>actor.id===booked.id))!;
        expect(publicReceipt).toBeTruthy();
        const waited=await passHours(game,game.currentRun().run,game.currentRun().cultivator,3);
        expect(waited.finished,JSON.stringify(waited.spent?.calls)).toBe(true);
        const now=game.currentRun(),ground=worldLocationFor(world,now.cultivator.location)!;
        const publicPosition=shipPassengerAt(world,publicReceipt.id,routineTime(world))!;
        expect(publicPosition.locationId).toBe(ground.id);
        expect(publicPosition.arrived).toBe(false);
        const owned=actualCarrierScene(game.repos,now.cultivator,world,routineTime(world))!;
        expect(owned.vesselId).not.toBe(publicPosition.vesselId);
        const read=peopleInThisPlace(game.repos,now.cultivator,world,ground),ids=new Set(companions.map(one=>one.id));
        expect(read.whereIs.has(booked.id)).toBe(false);
        expect(publicPosition.crew.every(one=>!read.whereIs.has(one.id))).toBe(true);
        expect(read.people.every(one=>ids.has(one.id))).toBe(true);
        expect(game.present(now.cultivator).length).toBeLessThanOrEqual(3);
        expect(ownedPassageClaim(db,now.cultivator.id)?.receiptId).toBe(receiptId);
    } finally {db.close();resetCultivationWorlds();}
});
