/** Person14 measured two actual NPCs knowing ordinary endpoint roads in the
 * common land seed while canonical canPoint was false. Road04 separately found
 * the conversation name cut at and; fixing that lexical issue does not compose
 * these two knowledge sources. This slice moves the existing pure Who profile
 * once and composes common public land with original canonical history.
 * Real seeded people and geography supply all samples. No guide is created,
 * rank/profession/place/knowledge is changed, or player geography is seeded.
 * Common named facts remain names; private ground and player mirrors get no
 * added route; existing actual standing/history and non-place readers retain
 * authority. Root source-only inverse/native acceptance remains pending. */
import { beforeAll, afterAll, expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from '../../src/engine/world/what-one-of-the-worlds-own-people-knows.js';
import { whatSomebodyKnowsOfTheLand } from '../../src/engine/world/what-somebody-knows-of-the-land.js';
import { whoTheyAreOf } from '../../src/engine/world/who-knows-the-land.js';
import { isTheWorldsToMove, PLAYER_ROW_TAG, type NpcRecord } from '../../src/engine/world/npc-state.js';
import { isAtLeast, stageCeilingFor } from '../../src/engine/social/discovery.js';
import type { LocationRecord } from '../../src/engine/world/locations.js';
let h:Awaited<ReturnType<typeof makeGameInWorld>>;
let placed:{person:NpcRecord;target:LocationRecord},named:typeof placed;
beforeAll(async()=>{
 h=await makeGameInWorld({seed:'canonical-common-land',worldSeed:'lived-rooms-20261003'});
 await h.game.newRun('A land reader');await h.game.act('I look around');
 const world=h.game.atHand!;
 for(const person of world.npcs.filter(person=>person.status==='alive'&&person.factionId===null&&isTheWorldsToMove(person))){
  const from=world.locations.find(place=>place.id===person.locationId)?.name??null;
  const land=whatSomebodyKnowsOfTheLand(world,whoTheyAreOf(world,{id:person.id,location:from,realmOrdinal:person.cultivation.realmOrdinal,sectId:person.factionId}));
  for(const row of land.places){
   const target=world.locations.find(place=>place.name===row.name&&place.kind==='settlement');
   if(!target||target.id===person.locationId||world.history.facts.some(fact=>fact.locationId===target.id))continue;
   if(!placed&&row.stage==='placed')placed={person,target};
   if(!named&&row.stage==='named')named={person,target};
  }if(placed&&named)break;
 }
 expect(placed,'actual seeded common placed geography control').toBeDefined();
 expect(named,'actual seeded named-only geography control').toBeDefined();
},120000);
afterAll(()=>{h?.db.close();resetCultivationWorlds();});
it('an actual ordinary NPC can point at its existing common public geography',()=>{
 expect(isAtLeast(whatOneOfTheWorldsOwnPeopleKnows(h.game.atHand!)(placed.person.id,'place',placed.target.id),'placed')).toBe(true);
});
it('actual common name-only geography is known by name without a route',()=>{
 const stage=whatOneOfTheWorldsOwnPeopleKnows(h.game.atHand!)(named.person.id,'place',named.target.id);
 expect(stage).toBe('named');expect(isAtLeast(stage,'placed')).toBe(false);
});
it('the actual player mirror never receives the ordinary NPC common geography grant',()=>{
 const world=h.game.atHand!,body=h.game.currentRun().cultivator;
 const mirror=world.npcs.find(person=>person.id===body.id&&person.tags.includes(PLAYER_ROW_TAG));
 expect(mirror,'native played look must retain the real player mirror').toBeDefined();
 const reads=whatOneOfTheWorldsOwnPeopleKnows(world);
 const target=world.locations.find(place=>place.kind==='settlement'&&place.id!==mirror!.locationId
  && !world.history.facts.some(fact=>fact.locationId===place.id)
  && !isAtLeast(reads(mirror!.id,'place',place.id),'placed'));
 expect(target,'actual player has unvisited public ground').toBeDefined();
 expect(isAtLeast(reads(mirror!.id,'place',target!.id),'placed')).toBe(false);
});
it('a private room absent from common land gains no route or access from this reading',()=>{
 const world=h.game.atHand!,reads=whatOneOfTheWorldsOwnPeopleKnows(world);
 const target=world.locations.find(place=>place.kind==='hall'&&place.id!==placed.person.locationId
  && !world.history.facts.some(fact=>fact.locationId===place.id)
  && !isAtLeast(reads(placed.person.id,'place',place.id),'placed'));
 expect(target,'actual unvisited private ground').toBeDefined();
 const barriers=JSON.stringify({sealed:target!.sealed,thresholds:target!.thresholds});
 expect(isAtLeast(reads(placed.person.id,'place',target!.id),'placed')).toBe(false);
 expect(JSON.stringify({sealed:target!.sealed,thresholds:target!.thresholds})).toBe(barriers);
});
it('actual standing remains the higher authority and all these reads write nothing',()=>{
 const world=h.game.atHand!,before=JSON.stringify(world),reads=whatOneOfTheWorldsOwnPeopleKnows(world);
 expect(reads(placed.person.id,'place',placed.person.locationId!)).toBe(stageCeilingFor('witnessed'));
 reads(placed.person.id,'place',placed.target.id);reads(named.person.id,'place',named.target.id);
 expect(JSON.stringify(world)).toBe(before);
});
