/** A living rogue lost on private work kept its due activity for 114 years.
 * Later continuations resolved that same work again. Actual loss ends the
 * work, without killing or recalling the person or erasing the dated account.
 * Fixed small expeditions exercise the ordinary risk writer without a soak.
 */
import {expect,it} from 'vitest';
import {createWorld,makeFaction} from '../../../src/engine/world/world-state.js';
import {makeLocation,linkLocations} from '../../../src/engine/world/locations.js';
import {createNpc} from '../../../src/engine/world/npc-state.js';
import {undertakePrivateVenture} from '../../../src/engine/world/private-ventures.js';
import {advancePublicCapitalMission} from '../../../src/engine/world/capital-missions-and-calendar.js';
import {whenTheWorldLostSightOf} from '../../../src/engine/world/who-a-house-has-lost-track-of.js';

it('ends lost participants work once, keeping their living bodies on the actual ground',()=>{
 let losses=0;
 for(let seed=0;seed<64;seed++){
  const world=createWorld({seed:'private-loss-'+seed,regionCount:0,skipPriorAges:true});
  const home=makeLocation({id:'home',name:'Home',kind:'sect_seat'});
  const ruin=makeLocation({id:'ruin',name:'The ruin',kind:'ruin',thresholds:{entry:0,survival:0,operational:24,mastery:24}});
  linkLocations(home,ruin,'road',4);world.locations.push(home,ruin);
  world.factions.push(makeFaction({id:'house',name:'The house',seatLocationId:home.id,ranks:['Disciple','Elder','Head']}));
  const leader=createNpc(world.seed,{id:'leader',onDay:0,bornOnDay:-30*365,locationId:home.id,spiritStones:10000,cultivation:{realmOrdinal:20}});
  const novice=createNpc(world.seed,{id:'novice',onDay:0,bornOnDay:-20*365,locationId:home.id,spiritStones:100,cultivation:{realmOrdinal:0}});
  world.npcs.push(leader,novice);
  const trip=undertakePrivateVenture(world,leader.id,ruin,[novice],0);
  expect(trip).not.toBeNull();
  const day=Number(trip!.data.publicServiceEnd);
  advancePublicCapitalMission(world,leader.id,day);
  for(const person of world.npcs.filter(p=>whenTheWorldLostSightOf(p)===Math.floor(day))){
   losses++;
   expect(person.status).toBe('alive');expect(person.locationId).toBe(ruin.id);
   expect(person.activity).toBeNull();
   const receipts=()=>world.history.facts.filter(f=>f.data.missionWork===trip!.id);
   expect(receipts()).toHaveLength(1);
   expect(receipts()[0]!.actors.some(a=>a.id===person.id&&a.role==='did not return from the work')).toBe(true);
   expect(advancePublicCapitalMission(world,person.id,day+365)).toBe(false);
   expect(receipts()).toHaveLength(1);
  }
 }
 expect(losses,'the fixed pool must include actual native losses').toBeGreaterThan(0);
});
