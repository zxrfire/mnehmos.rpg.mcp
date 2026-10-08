/** Road15 ordinary-suite readiness: Road13 native19849 proved topic-red
 * 3FAIL6PASS, chain-red1FAIL8PASS and green9PASS; Retained14 native23478
 * then passed all140 existing generic composition/fallback controls.
 * Road12's missing diagnostic environment had failed before chain assertions;
 * that invalid evidence is preserved. JSONL is now optional: without its
 * environment every original full-name/two-steps/half-day assertion still runs.
 * Production source and both narrow inverses are byte-identical to Road12. */
/** Road11 native72790 exact chain diagnostic preserved both failed arms:
 * literal47 characters, initial topic76 including and then I wait for0.5days.
 * The unclaimed whole-sentence request/weigh remained first; topic containment
 * suppressed the wait. The second interaction retained the full literal only
 * with topic restoration. Road12 first reads the actual first clause through
 * the existing splitter in both deterministic entry points; model composition
 * stays unchanged. Original full-name/two-steps/half-day assertions remain.
 * Independent topic and first-clause inverses must each fail their own behavior. */
/** Boot02 native78564 proved cold narrator red1FAIL/green1PASS after
 * moving the exact season reader out of the eager prompt dependency. Road11
 * includes that same accepted source repair in BOTH chain diagnostic arms.
 * Original full-value observations, topic inverse and assertions are unchanged. */
/** Road09 native module initialization failed before any test: ACTION_NAMES
 * is not iterable. Road10 removes only the parser-to-ride-runtime back-edge
 * by moving its exact pure phrase reader into a leaf. Import order, original
 * chain assertions and full-value red/green diagnostic remain unchanged. */
/** Road05 native49615 red3FAIL6PASS, green8PASS1FAIL. Actual played
 * informed directions and standalone exact topic now pass. The chain observer
 * alone expected the implementation prefix "the way to", while its native
 * topic carried the full literal name without that prefix in BOTH arms.
 * turn-engine7142 already normalizes such topics when the actual clause asks
 * the way. Road06 reads the existing semantic topic form or the exact raw
 * name, retaining full name and independent wait(.5) assertions. No runtime,
 * route, catalog or knowledge source changes; the two causal reds remain.
 */
/** Road04 native85415 preserved the conversation failure: the actual common
 * reader knew Between Cloud Gate and Three Walls, but the native call asked
 * only for Between Cloud Gate. Grounded literal name spans already protected
 * clause boundaries; cleanPlace/theNounPhrase still trimmed the topic at and,
 * and the existing name restoration handled only addressed action targets.
 * Road05 extends that same lexical restoration to topics without teaching a
 * route or granting access. Exact real names stay whole; a following genuine
 * and-then decision remains its own act. Red removes only topic restoration,
 * while the common-road candidate remains in both arms. No live prose claim. */
/** Person14 native28727 measured actual accepted escort to Between Emerald
 * Water City/Nine Peaks: both actual present reporter and charge knew the two
 * public endpoints in the shared ordinary land seed, but no road subdivision;
 * historical nativeCanPoint was false for that exact generated wilds row.
 * addPlacesOnTheWay already splits a real road into two real priced links.
 * This slice retains only that existing public road's common directions when
 * BOTH endpoint ways are placed, using exact authored IDs/tag/links, not names.
 * Unknown/name-only endpoints, private/nonroad/arbitrary ground do not qualify.
 * Actual spoken directions must teach the player before self-navigation; an
 * unknown real name never grants its route. Historical full NPC knowledge
 * canonical composition remains a separate gap, not asserted repaired here.
 * Tests use existing world people/roads. Only the operator player's scene is
 * arranged for conversation; nobody/route/knowledge/door rights is fabricated.
 * Compiler/native unrun; engine fallback is not live-model prose acceptance. */
import { beforeAll, afterAll, expect, it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { DeterministicNarrator } from '../../src/web/narrator.js';
import { theWayAskedFor } from '../../src/web/asking-the-way.js';
import { explicitNameSpansIn, stepsOfThePlan } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { makeGameInWorld } from './harness.js';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { ROUTE_STOP } from '../../src/engine/world/places-on-the-way.js';
import { whatSomebodyKnowsOfTheLand, whoAmongThemKnowsTheWayToAPlace, howMuchOfTheRoadALifeHasSeen, theRoadAnUpbringingSaw, type WhoTheyAre } from '../../src/engine/world/what-somebody-knows-of-the-land.js';
import { whatThisPersonKnowsOfTheLand } from '../../src/web/the-way-to-somewhere-asked-of-somebody.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import type { LocationRecord } from '../../src/engine/world/locations.js';
let h:Awaited<ReturnType<typeof makeGameInWorld>>,world:WorldState;
type Sample={who:WhoTheyAre;ground:LocationRecord;land:ReturnType<typeof whatSomebodyKnowsOfTheLand>};
let known:Sample,unknown:Sample,named:Sample;
beforeAll(async()=>{
 h=await makeGameInWorld({seed:'known-subdivision',worldSeed:'lived-rooms-20261003'});await h.game.newRun('A road asker');world=(await h.game.loadWorld())!;h.game.atHand=world;
 const byId=new Map(world.locations.map(place=>[place.id,place]));
 const points=world.locations.filter(place=>place.kind==='wilds'&&place.tags.includes(ROUTE_STOP));
 for(const person of world.npcs.filter(person=>person.status==='alive')){
  const who:WhoTheyAre={id:person.id,from:byId.get(person.locationId??'')?.name??null,ordinal:person.cultivation.realmOrdinal,house:person.factionId?{id:person.factionId,rankIndex:person.factionRankIndex}:null,travelled:Math.max(howMuchOfTheRoadALifeHasSeen(person.identity.occupation),theRoadAnUpbringingSaw(person.identity.origin))};
  const land=whatSomebodyKnowsOfTheLand(world,who),placed=new Map(land.places.map(place=>[place.name,place.stage]));
  for(const ground of points){const from=byId.get(String(ground.data.fromLocationId)),to=byId.get(String(ground.data.toLocationId));if(!from||!to)continue;const stages=[placed.get(from.name),placed.get(to.name)];
   if(!known&&stages.every(stage=>stage==='placed'))known={who,ground,land};
   if(!unknown&&stages.some(stage=>stage===undefined))unknown={who,ground,land};
   if(!named&&stages.includes('named'))named={who,ground,land};
  }if(known&&unknown&&named)break;
 }
 expect(known,'actual world must contain an already-known public road subdivision').toBeDefined();expect(unknown,'actual unknown endpoint control').toBeDefined();expect(named,'actual named-only endpoint control').toBeDefined();
},120000);
afterAll(()=>{h?.db.close();resetCultivationWorlds();});
it('the real subdivision of an already-known public road remains findable',()=>{
 expect(known.land.places.find(place=>place.name===known.ground.name)?.stage).toBe('placed');
});
it('an unknown endpoint does not make the generated ground findable',()=>{
 expect(unknown.land.places.find(place=>place.name===unknown.ground.name)?.stage).not.toBe('placed');
});
it('a name-only endpoint cannot supply a route through its intermediate ground',()=>{
 expect(named.land.places.find(place=>place.name===named.ground.name)?.stage).not.toBe('placed');
});
it('private and arbitrary nonroad ground does not inherit endpoint directions or access',()=>{
 for(const replacement of [{...known.ground,kind:'hall' as const},{...known.ground,tags:known.ground.tags.filter(tag=>tag!==ROUTE_STOP)},{...known.ground,links:known.ground.links.map(link=>({...link,kind:'portal' as const}))}]){
  const input={...world,locations:world.locations.map(place=>place.id===known.ground.id?replacement:place)};
  expect(whatSomebodyKnowsOfTheLand(input,known.who).places.find(place=>place.name===replacement.name)?.stage).not.toBe('placed');
  expect(replacement.sealed).toBe(known.ground.sealed);expect(replacement.thresholds).toBe(known.ground.thresholds);
 }
});
async function anActualConversation(mode:'known'|'unknown'){
 const actual=h.game.atHand!,body=h.game.currentRun().cultivator;
 for(const venue of actual.locations.filter(place=>place.kind==='settlement'))for(const area of theAreasOf(actual,venue).areas.filter(area=>area.for!=='room')){
  h.repos.cultivators.update(body.id,{location:venue.name,standingIn:area.id});
  const current=h.game.currentRun().cultivator,present=h.game.present(current);if(!present.length)continue;
  for(const person of present){const land=whatThisPersonKnowsOfTheLand(h.game,body.id,actual,person);const map=new Map(land.places.map(place=>[place.name,place.stage]));
   const ground=actual.locations.find(place=>place.tags.includes(ROUTE_STOP)&&place.kind==='wilds'
    && !h.game.canPointAtLocation(current,place)
    && (mode==='known'?map.get(actual.locations.find(endpoint=>endpoint.id===place.data.fromLocationId)?.name??'')==='placed'&&map.get(actual.locations.find(endpoint=>endpoint.id===place.data.toLocationId)?.name??'')==='placed':!present.some(speaker=>whatThisPersonKnowsOfTheLand(h.game,body.id,actual,speaker).places.some(row=>row.name===place.name&&row.stage==='placed'))
     && whoAmongThemKnowsTheWayToAPlace(actual,venue.name,present.map(speaker=>({id:speaker.id,from:speaker.location,ordinal:speaker.realmOrdinal,house:speaker.sectId?{id:speaker.sectId,rankIndex:actual.npcs.find(npc=>npc.id===speaker.id)?.factionRankIndex??0}:null})),place.name)<0));
   if(ground)return {ground,current};
  }
 }throw Error('Actual existing scene lacks '+mode+' subdivision directions control');
}
it('the player learns the real subdivided road from an actual informed conversation',async()=>{
 const {ground,current}=await anActualConversation('known');expect(h.game.canPointAtLocation(current,ground)).toBe(false);
 const result=await h.game.act('I ask somebody how do I get to '+ground.name+'.');
 expect(result.toolCalls.some(call=>call.name==='engine.theWayTo'&&call.ok)).toBe(true);
 expect(h.game.canPointAtLocation(h.game.currentRun().cultivator,ground),'spoken native directions must supply actual route knowledge').toBe(true);
},120000);
it('asking an unknown real ground name never supplies a route from an uninformed crowd',async()=>{
 const {ground,current}=await anActualConversation('unknown');expect(h.game.canPointAtLocation(current,ground)).toBe(false);
 const result=await h.game.act('I ask somebody how do I get to '+ground.name+'.');
 expect(result.toolCalls.some(call=>call.name==='engine.theWayTo'&&call.ok)).toBe(true);
 expect(h.game.canPointAtLocation(h.game.currentRun().cultivator,ground)).toBe(false);
 expect(result.narration).toMatch(/does not know|nobody.*knows|cannot.*say|never heard|not.*know/i);
},120000);

it('an exact authored name stays complete in the native question topic',async()=>{
 const raw='I ask somebody how do I get to '+known.ground.name+'.';
 const plan=await new DeterministicNarrator().plan(raw,'',null,explicitNameSpansIn(raw,[known.ground.name]));
 expect(plan.action.topic).toBe('the way to '+known.ground.name);
 expect(stepsOfThePlan(plan)).toHaveLength(1);
});
it('a real and-then decision after an authored name remains a separate native wait',async()=>{
 const raw='I ask somebody how do I get to '+known.ground.name+' and then I wait for 0.5 days';
 const plan=await new DeterministicNarrator().plan(raw,'',null,explicitNameSpansIn(raw,[known.ground.name]));
 const steps=stepsOfThePlan(plan);
 const sink=process.env.ROAD_CHAIN_OBSERVATIONS;
 if(sink)appendFileSync(sink,JSON.stringify({raw,expectedLiteral:known.ground.name,expectedLength:known.ground.name.length,nameSpans:explicitNameSpansIn(raw,[known.ground.name]),plan,steps,semanticTopic:theWayAskedFor(steps[0]?.action.topic??'')??steps[0]?.action.topic,actualTopicLength:steps[0]?.action.topic?.length})+'\n');
 expect(steps).toHaveLength(2);
 expect(theWayAskedFor(steps[0]!.action.topic??'')??steps[0]!.action.topic).toBe(known.ground.name);
 expect(steps[1]!.action).toMatchObject({action:'wait',days:0.5});
});
it('an ungrounded conjunction is never expanded into an actual name',async()=>{
 const raw='I ask somebody how do I get to '+known.ground.name+'.';
 const plan=await new DeterministicNarrator().plan(raw,'',null,[]);
 expect(plan.action.topic).not.toBe('the way to '+known.ground.name);
});
