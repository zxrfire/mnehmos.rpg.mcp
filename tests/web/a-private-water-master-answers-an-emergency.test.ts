/** A private water master already has a real return authority. Medical trouble
 * must reach it without a public fare, another hull, an endpoint teleport or a
 * cure manufactured by diversion. The actual SQL patient remains susceptible
 * through the hunger reader, and the operator decides through ordinary odds.
 */
import { expect,it } from 'vitest';
import { makeGameInWorld,ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { createNpc,setRealm } from '../../src/engine/world/npc-state.js';
import { aVehicleOf,takeItAlong } from '../../src/engine/world/a-vehicle.js';
import { quoteOwnedSeaDeparture } from '../../src/engine/world/an-owned-sea-course.js';
import { publicShipLinesFrom } from '../../src/engine/world/public-shipping.js';
import { acceptOwnedPassage,ownedPassageClaim } from '../../src/web/an-owned-passage.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { actualPersonFor } from '../../src/web/the-actual-person-behind-a-world-row.js';
import { bodilyTroubleAboard } from '../../src/engine/world/a-captain-answers-trouble.js';
import { forStream } from '../../src/engine/cultivation/rng.js';
import { witnessIndexFor } from '../../src/engine/world/witness-reaction-index.js';

it('an actual private water master returns a stricken SQL passenger along the sailed course',async()=>{
 const plans:string[]=[];
 const h=await makeGameInWorld({seed:'private-water-emergency',worldSeed:'precise-sea-world',
  narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
 try{
  await h.game.newRun('Private ship owner');let now=h.game.currentRun();
  h.repos.cultivators.update(now.cultivator.id,{location:'Emerald Water City',standingIn:null,
   realmOrdinal:20,hp:1000,maxHp:1000,spiritStones:100000,satiety:100});
  now=h.game.currentRun();h.game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
  const world=h.game.atHand!,day=routineTime(world),from=worldLocationFor(world,now.cultivator.location)!;
  const line=publicShipLinesFrom(world,from.name,day).find(line=>line.runsFromDay===null&&line.days>1)!;
  const to=worldLocationFor(world,line.to)!,quote=quoteOwnedSeaDeparture(world,from.id,to.id,day,2)!;
  const pilot=setRealm(createNpc(world.seed,{id:'private-water-actual-master',name:'Private shipmaster',
   onDay:day,bornOnDay:day-35*365,locationId:from.id,occupation:'shipmaster'}),20,day);
  pilot.activity={kind:'out_with_a_party',note:'The actual arranged private company.',withIds:[now.cultivator.id],sinceDay:day,untilDay:day+100};
  world.npcs.push(pilot);
  const ship=aVehicleOf({id:'private-water-emergency-hull',conveyanceId:'conv-water-ship',ownerId:now.cultivator.id,
   ownerName:now.cultivator.name,at:from.id});world.objects.push(ship);takeItAlong(world.objects,ship,now.cultivator.id);
  const root=acceptOwnedPassage(h.game,now.run,now.cultivator,{vesselId:ship.id,pilotId:pilot.id,
   fromId:from.id,toId:to.id,walkingDays:quote.walkingDays,days:quote.days,conveyanceId:'conv-water-ship',
   power:ship.power,companions:[pilot.id],seaLane:quote.lane});
  world.factions=[];world.schedule=[];world.npcs=world.npcs.filter(person=>person.id===pilot.id||person.id===now.cultivator.id);
  expect((await passHours(h.game,h.game.currentRun().run,h.game.currentRun().cultivator,3)).finished).toBe(true);
  now=h.game.currentRun();const noticed=routineTime(world);
  const plague={outbreakId:'actual-private-water-plague',contractedOnDay:noticed,endsOnDay:noticed+30,fatalOnDay:null,treatedOnDay:null};
  h.repos.cultivators.update(now.cultivator.id,{plague});
  const actual=actualPersonFor(h.game,now.cultivator.id)!;
  const trouble=bodilyTroubleAboard({...actual,cultivation:{...actual.cultivation,plague}},noticed)!;
  expect(trouble).not.toBeNull();
  for(let sample=0;sample<10000;sample++){
   const seed=`private-water-master-diverts-${sample}`;
   if(forStream(seed,'captain-duty-decision',pilot.id,trouble.key).next()<.01){world.seed=seed;break;}
  }
  const before=h.game.currentRun().cultivator.spiritStones;
  plans.push(JSON.stringify({action:'look'}));const told=await h.game.act('I look around');
  expect(told.narration).toContain('for care');
  const claim=ownedPassageClaim(h.db,now.cultivator.id)!,changed=witnessIndexFor(world).byId.get(claim.receiptId)!;
  expect(claim.receiptId).not.toBe(root);expect(changed.causes).toContain(root);
  expect(changed.data.vesselId).toBe(ship.id);expect(changed.data.pilotId).toBe(pilot.id);
  expect(changed.data.toLocationId).toBe(from.id);
  expect(h.game.currentRun().cultivator.location).not.toBe(from.name);
  expect(h.game.currentRun().cultivator.plague!.treatedOnDay).toBeNull();
  expect(h.game.currentRun().cultivator.spiritStones).toBe(before);
 }finally{h.db.close();}
},120_000);
