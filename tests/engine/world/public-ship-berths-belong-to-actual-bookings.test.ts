/** Oct7 public hull audit found no finite berth admission and an identical-leg
 * receipt deduplicated away later NPCs; SQL player IDs were omitted entirely.
 * A berth is held by an actual boarding fact/body or a current living paid
 * mission participant, never a second mutable passenger roster. Native crew
 * occupy authored capacity too. Only requesting identities credit their own
 * reservation; ended/dead mission participants release future reserved seats.
 * A legacy actual SQL boarding which omitted its actor cannot imply spare seats.
 * UNRUN source controls; no mocked quote/resolver or fabricated free fare.
 */
import {expect,it} from 'vitest';
import {loadCultivationCatalog} from '../../../src/engine/world/catalog.js';
import {seedWorld} from '../../../src/engine/world/seeding.js';
import {createNpc,markDead,type NpcRecord} from '../../../src/engine/world/npc-state.js';
import {publicShipLinesFrom,quotePublicPassage,recordPublicPassage} from '../../../src/engine/world/public-shipping.js';
import {bookNpcPassageForRoute} from '../../../src/engine/world/places-on-the-way.js';
import {commitNpcPublicPassage} from '../../../src/engine/world/ship-crew.js';
import {shipHandsForHull} from '../../../src/engine/world/a-public-ship-hull.js';
import {requireConveyance} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {appendWorldFact} from '../../../src/engine/world/who-was-there-when-it-happened.js';
import {makeFact} from '../../../src/engine/world/history.js';
const catalog=await loadCultivationCatalog();
function fixture(){
 const world=seedWorld({seed:'ordinary-public-berths',catalog,presentYear:0}).state;
 const from=world.locations.find(place=>place.name==='Emerald Water City')!;
 const line=publicShipLinesFrom(world,from.name,world.currentDay).find(one=>one.runsFromDay===null)!;
 const to=world.locations.find(place=>place.name===line.to)!;
 const quote=quotePublicPassage(world,from.id,to.id,world.currentDay)!;
 expect(quote).not.toBeNull();
 const capacity=requireConveyance('conv-water-ship').heads;
 const available=capacity-1-shipHandsForHull(world.seed,quote.vesselId);
 const add=(suffix:string):NpcRecord=>{const npc={...createNpc(world.seed,{id:'berth-'+suffix,
  locationId:from.id,onDay:world.currentDay,bornOnDay:world.currentDay-25*365,
  takenNames:new Set(world.npcs.map(one=>one.name))}),spiritStones:5000};world.npcs.push(npc);return npc;};
 return {world,from,to,quote,available,add};
}
it('charges independently accepted passengers once and refuses another body at real capacity',()=>{
 const {world,to,from,quote,available,add}=fixture();
 const accepted: NpcRecord[]=[];
 for(let i=0;i<available;i++){
  const original=add('paid-'+i),opening=original.spiritStones;
  const personal=bookNpcPassageForRoute(world,original,to.id,quote.departureDay,'Taking wares to the actual dock.');
  expect(personal).not.toBeNull();world.npcs[world.npcs.findIndex(one=>one.id===original.id)]=personal!;
  expect(commitNpcPublicPassage(world,personal!)).toBe(true);
  expect(personal!.spiritStones).toBe(opening-quote.fareStones);accepted.push(personal!);
 }
 expect(quotePublicPassage(world,from.id,to.id,quote.departureDay,1)).toBeNull();
 const late=add('not-admitted'),purse=late.spiritStones;
 expect(bookNpcPassageForRoute(world,late,to.id,quote.departureDay,'Seeking a seat.')).toBeNull();
 expect(late.spiritStones).toBe(purse);expect(late.activity).toBeNull();
 const facts=world.history.facts.filter(fact=>fact.data.actualBoarding===true&&fact.data.vesselId===quote.vesselId);
 const actualActors=new Set(facts.flatMap(fact=>fact.actors.map(actor=>actor.id)));
 expect(accepted.every(npc=>actualActors.has(npc.id))).toBe(true);
 expect(world.objects.filter(one=>one.id===quote.vesselId)).toHaveLength(1);
});
it('holds prepaid future seats through living mission pointers and credits only their own participants',()=>{
 const {world,to,from,quote,available,add}=fixture();
 const reserved=Array.from({length:available},(_,i)=>add('reserved-'+i));
 const mission=appendWorldFact(world,makeFact({day:world.currentDay,kind:'gathering',visibility:'faction',
  summary:'A house paid the quoted passage for its actual delegates.',actors:reserved.map(n=>({id:n.id,name:n.name,role:'delegate'})),
  data:{publicMission:true,publicFareStones:quote.fareStones*available,
   publicReservations:JSON.stringify([{...quote}])}}),{recur:false});
 for(const npc of reserved)npc.activity={kind:'out_with_a_party',note:'Waiting for the paid departure.',withIds:[],
  sinceDay:world.currentDay,untilDay:quote.departureDay,capitalMissionId:mission.id,capitalMissionLeg:0,capitalMissionWaiting:true};
 expect(quotePublicPassage(world,from.id,to.id,quote.departureDay,1)).toBeNull();
 expect(quotePublicPassage(world,from.id,to.id,quote.departureDay,available,[],undefined,reserved.map(n=>n.id))).not.toBeNull();
 reserved[0]!.activity=null; // existing cancellation clears its mission pointer
 expect(quotePublicPassage(world,from.id,to.id,quote.departureDay,1)).not.toBeNull();
 reserved[0]!.activity={kind:'out_with_a_party',note:'Waiting.',withIds:[],sinceDay:world.currentDay,untilDay:quote.departureDay,capitalMissionId:mission.id};
 world.npcs[world.npcs.findIndex(one=>one.id===reserved[0]!.id)]=markDead(reserved[0]!,world.currentDay,'Native death before boarding.');
 expect(quotePublicPassage(world,from.id,to.id,quote.departureDay,1)).not.toBeNull();
});
it('does not invent free seats from an older accepted SQL boarding with no recorded actor',()=>{
 const {world,from,to,quote}=fixture();
 recordPublicPassage(world,quote,quote.departureDay,from.id,[],undefined,
  {runId:'actual-legacy-run',elapsedDays:0});
 const beforeFacts=world.history.facts.length,beforeObjects=world.objects.length;
 expect(quotePublicPassage(world,from.id,to.id,quote.departureDay,1)).toBeNull();
 expect(world.history.facts).toHaveLength(beforeFacts);expect(world.objects).toHaveLength(beforeObjects);
});
