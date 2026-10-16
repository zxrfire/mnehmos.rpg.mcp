import { setLocation } from '../../src/engine/world/npc-state.js';
import { whoTheyAreOf } from '../../src/engine/world/who-knows-the-land.js';
import { whatSomebodyKnowsOfTheLand } from '../../src/engine/world/what-somebody-knows-of-the-land.js';
/** A board watch belongs to its actual owned terminal. The played case takes
 * the post, asks an informed present person for directions, boards real finite
 * ship legs and serves the full accepted span before payment. Its lanes begin
 * without other houses' paid reservations; berth conflicts have separate native
 * controls. Earlier controls required a private observation sink and checked
 * obsolete tool names instead of actual course receipts. Observations are now
 * optional, and every receipt, living landfall, exact terminal and payment check
 * remains. Travel used to shorten service; arrival now starts the full term. */
import { appendFileSync } from 'node:fs';
import { readPendingSummons } from '../../src/web/pending-summons.js';
import { publicTransportFrom, publicTransportHubsAt } from '../../src/engine/world/public-transport-at-a-place.js';
import { shipIdForLane } from '../../src/engine/world/the-ship-on-a-lane.js';
import { recordedVoyage } from '../../src/web/a-ship-at-sea.js';
import { arrivalCourseOfFact, sameActualArrivalCourse } from '../../src/engine/world/a-body-that-actually-arrived.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { whereTheyAreLodged } from '../../src/web/a-room-at-an-inn.js';
import { publicCountersAt } from '../../src/engine/world/public-transport-at-a-place.js';
import { whoKeepsTheCounter } from '../../src/web/who-keeps-a-counter-here.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
/** Boundary controls added after the watch audit: deadline completion previously preceded
 * the actual arrived-holder departure check. These arrangements place the native accepted
 * oath/body at known before/after deadline states; they do not claim a lived journey or
 * continuous attendance. Away holders use the existing house release/judgment and its
 * pay terms, never completed-site facts. Native full journey coverage remains above. */
/**
 * Owner ruling 2026-10-07: Shrinking Earth Pavilion's inherited crossings must
 * have real watch missions, not venue labels without work. Previously every
 * house mission targeted its seat or arbitrary held ground. These cases read
 * the real board and accept its stable site ID, then hold the existing native
 * oath until its paid term. Same-province ground cannot substitute for a crossing.
 *
 * Operator arrangements: actual house membership/body and board area. The first
 * settlement control additionally arranges terminal position; the second
 * independently learns directions and plays the actual journey to the terminal.
 * Neither proves admission. Public passage has separate actual quote/pay/arrival
 * controls. Native waiting advances body/world; no clock jump or invented pay.
 * All names, IDs, deadlines and amounts are read from the current engine.
 */
import { describe, expect, it } from 'vitest';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { theFirstRungOf } from '../../src/engine/encounters/what-a-house-has-on-its-board.js';
import { sectBoardFor } from '../../src/web/encounters.js';
import { theWallWhereTheyStand } from '../../src/web/the-mission-board-inside-a-house.js';
import { settleTheMissionPostTheyHold, theMissionPostTheyHold } from '../../src/web/holding-a-mission-post.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { publicWatchTargetsOf, publicWatchTargetForPost } from '../../src/engine/world/where-a-house-keeps-its-public-watch.js';
import { THE_SPAN_HOUSE_ID } from '../../src/engine/world/where-the-measured-span-still-answers.js';
import { makeLocation, linkLocations } from '../../src/engine/world/locations.js';

async function atTheBoard(seed:string,provider?:ScriptedProvider) {
    const h=await makeGameInWorld({seed,worldSeed:'road-world',...(provider?{provider}:{})});
    const {cultivator}=await h.game.newRun('Watch Reader');
    const world=await h.game.loadWorld();
    if(!world)throw new Error('No actual world');
    h.game.atHand=world;
    // This service fixture leaves the lane free of other houses' paid missions.
    for(const other of world.factions)if(other.id!==THE_SPAN_HOUSE_ID)other.resources.spirit_stones=0;
    const house=world.factions.find(f=>f.id===THE_SPAN_HOUSE_ID);
    const sql=h.repos.sects.getById(THE_SPAN_HOUSE_ID);
    const seat=world.locations.find(l=>l.id===house?.seatLocationId);
    if(!house||!sql||!seat)throw new Error('Actual span house has no board');
    const rank=theFirstRungOf('inner',sql.ranks.length);
    if(rank===null)throw new Error('Actual span house has no inner rung');
    h.repos.sects.addMember(house.id,cultivator.id,rank);
    h.db.prepare('UPDATE cultivators SET realm_ordinal = 8 WHERE id = ?').run(cultivator.id);
    h.repos.cultivators.update(cultivator.id,{location:seat.name,spiritStones:5000});
    const area=theAreasOf(world,seat).areas.find(a=>a.for==='board');
    if(!area)throw new Error('Actual house has no mission room');
    h.repos.cultivators.standIn(cultivator.id,area.id);
    await h.game.act('I look around');
    const body=h.repos.cultivators.getById(cultivator.id)!;
    const board=theWallWhereTheyStand(h.game,body,sectBoardFor({repos:h.repos,knowledge:h.game.knowledge,world:h.game.atHand},body));
    const offer=board.offers.find(o=>publicWatchTargetForPost(world,house.id,o.entry.id)!==null);
    if(!offer)throw new Error('Actual member board offers no crossing watch');
    const site=publicWatchTargetForPost(world,house.id,offer.entry.id)!;
    return {...h,id:cultivator.id,house,site,offer,board};
}

async function observedAct(h:Awaited<ReturnType<typeof atTheBoard>>,raw:string){
 const sink=process.env.WATCH_ACCEPTANCE_OBSERVATIONS;
 const snapshot=()=>{const now=h.game.currentRun(),body=now.cultivator;return {run:{id:now.run.id,elapsedDays:now.run.elapsedDays,turn:now.run.turn},body:{id:body.id,alive:body.alive,location:body.location,standingIn:body.standingIn,hp:body.hp,spiritStones:body.spiritStones},worldMoment:h.game.atHand?routineTime(h.game.atHand):null,oath:theMissionPostTheyHold(h.game,h.id)};};
 if(sink)appendFileSync(sink,JSON.stringify({when:'before',raw,offer:h.offer,site:{id:h.site.id,name:h.site.name},body:snapshot()})+'\n');
 try{const result=await h.game.act(raw);if(sink)appendFileSync(sink,JSON.stringify({when:'after',raw,toolCalls:result.toolCalls,narration:result.narration,body:snapshot()})+'\n');return result;}
 catch(error){if(sink)appendFileSync(sink,JSON.stringify({when:'error',raw,error:String(error),body:snapshot()})+'\n');throw error;}
}

describe('actual crossing watch',()=>{
    it('posts only inherited owned terminals, accepts a named site, and pays its native oath after service',async()=>{
        const h=await atTheBoard('crossing-watch-served');
        await buyActualTermFood(h);
        const sites=publicWatchTargetsOf(h.game.atHand!,h.house.id);
        expect(sites.length).toBeGreaterThan(0);
        for(const offer of h.board.offers.filter(o=>o.entry.id.startsWith('mission-crossing-watch~')))
            expect(publicWatchTargetForPost(h.game.atHand!,h.house.id,offer.entry.id)).not.toBeNull();
        const read=await observedAct(h, 'what missions are there');
        expect(read.narration).toContain(h.site.name);
        const before=h.game.state().run.elapsedDays;
        const accepted=await observedAct(h, 'I take the post '+h.offer.entry.name);
        expect(accepted.toolCalls.some(c=>c.name==='encounters.acceptDuty'&&c.ok)).toBe(true);
        const oath=theMissionPostTheyHold(h.game,h.id);
        expect(oath).not.toBeNull();
        expect(oath!.tags).toContain('post-at:'+h.site.id);
        expect(oath!.tags).not.toContain('post-arrived');
        expect(h.game.state().run.elapsedDays-before).toBeCloseTo(1/8);
        h.repos.cultivators.update(h.id,{location:h.site.name});
        h.repos.cultivators.standIn(h.id,null);
        await observedAct(h, 'I look around');
        expect(theMissionPostTheyHold(h.game,h.id)!.tags).toContain('post-arrived');
        const due=theMissionPostTheyHold(h.game,h.id)!.dueOnDay;
        if(due===null)throw new Error('Native watch has no deadline');
        const [merit,pay]=oath!.tags.find(t=>t.startsWith('post-pays:'))!.slice('post-pays:'.length).split(':').map(Number);
        const contribution=h.repos.sects.getMembership(h.id)!.contribution;
        await buyActualPostRoof(h,due);
        const waited=await serveUntilActualDeadline(h,due);
        expect(h.game.state().run.elapsedDays).toBeGreaterThanOrEqual(due);
        expect(h.repos.cultivators.getById(h.id)!.alive).toBe(true);
        expect(waited.narration).toContain('Your post is served');
        expect(h.repos.sects.getMembership(h.id)!.contribution-contribution).toBe(merit);
        expect(waited.narration).toContain('pays '+pay+' spirit stones');
        expect(theMissionPostTheyHold(h.game,h.id)).toBeNull();
    },240000);
    it('takes a board mission, learns its real route from an informed person, travels and serves at its exact terminal',async()=>{
        const h=await atTheBoard('crossing-watch-journey');
        const world=h.game.atHand!,seat=world.locations.find(place=>place.id===h.house.seatLocationId)!;
        const boardArea=theAreasOf(world,seat).areas.find(area=>area.for==='board')!;
        const guide=world.npcs.find(person=>person.status==='alive'&&person.factionId===h.house.id
            &&whatSomebodyKnowsOfTheLand(world,whoTheyAreOf(world,{id:person.id,location:null,
                realmOrdinal:person.cultivation.realmOrdinal,sectId:person.factionId})).places
                .some(place=>place.name===h.site.name&&place.stage==='placed'));
        expect(guide,'the fixture requires a real member who already knows this route').toBeDefined();
        const day=routineTime(world),at=world.npcs.findIndex(person=>person.id===guide!.id);
        world.npcs[at]={...setLocation(guide!,seat.id,day),activity:{kind:'talking',
            note:'Giving a new watch holder directions at the board.',withIds:[h.id],sinceDay:day,untilDay:day+1,
            standingIn:boardArea.id}};
        h.game.theWorldMoved();
        await buyActualTermFood(h);
        await observedAct(h, 'I take the post '+h.offer.entry.name);
        expect(theMissionPostTheyHold(h.game,h.id)?.tags).toContain('post-at:'+h.site.id);
        // Initial membership, board and the already-informed guide are arranged.
        // The question, route learning, all travel and every service day are played.
        expect(h.game.present(h.game.currentRun().cultivator).some(person=>person.id===guide!.id)).toBe(true);
        const answer=await observedAct(h,'I ask somebody how do I get to '+h.site.name+'.');
        expect(answer.toolCalls.some(call=>call.name==='engine.theWayTo')).toBe(true);
        expect(h.game.canPointAtLocation(h.game.currentRun().cultivator,h.site)).toBe(true);
        const departure=h.game.currentRun(),departedOn=routineTime(h.game.atHand!);
        const beforeJourneyFacts=new Set(h.game.atHand!.history.facts.map(fact=>fact.id));
        await followTheActualOfferedRoute(h);
        const arrival=h.game.atHand!.history.facts.find(fact=>!beforeJourneyFacts.has(fact.id)
            && fact.data.actualBodyArrival===true&&fact.data.bodyId===h.id
            && fact.locationId===h.site.id&&fact.day>=departedOn);
        expect(arrival,'the played living body must have a new actual finite-course landfall at the watch terminal').toBeDefined();
        const arrivedCourse=arrivalCourseOfFact(arrival!);
        expect(arrivedCourse).not.toBeNull();
        expect(arrival!.causes.some(id=>{
            const receipt=h.game.atHand!.history.facts.find(fact=>fact.id===id);
            const course=receipt?arrivalCourseOfFact(receipt):null;
            return receipt?.data.publicPassage===true&&course!==null
                &&sameActualArrivalCourse(arrivedCourse!,course);
        }),'actual body landfall must retain its accepted public hull course, not a membership or elapsed deadline').toBe(true);
        expect(h.game.currentRun().cultivator.alive).toBe(true);
        expect(h.game.worldPlaceOf(h.game.currentRun().cultivator)).toBe(h.site.id);
        expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(departure.run.elapsedDays);
        const oath=theMissionPostTheyHold(h.game,h.id);
        expect(oath?.tags).toContain('post-arrived');
        if(!oath||oath.dueOnDay===null)throw new Error('Actual journey lost its unserved watch oath');
        const termLeft=oath.dueOnDay-h.game.currentRun().run.elapsedDays;
        const term=Number(oath.tags.find(tag=>tag.startsWith('post-term-days:'))!.slice('post-term-days:'.length));
        expect(termLeft,'travel cannot count as days held at the real terminal').toBeCloseTo(term,7);
        if(termLeft<=0)throw new Error('Actual journey used the whole accepted watch term');
        const contribution=h.repos.sects.getMembership(h.id)!.contribution;
        await buyActualPostRoof(h,oath.dueOnDay);
        const paid=await serveUntilActualDeadline(h,oath.dueOnDay);
        expect(paid.narration).toContain('Your post is served');
        expect(h.game.worldPlaceOf(h.game.currentRun().cultivator)).toBe(h.site.id);
        expect(h.game.currentRun().run.elapsedDays).toBeGreaterThanOrEqual(oath.dueOnDay);
        expect(h.repos.sects.getMembership(h.id)!.contribution).toBeGreaterThan(contribution);
        expect(theMissionPostTheyHold(h.game,h.id)).toBeNull();
    },900000);
    it('does not start watch merely elsewhere in the same province and does not accept an unspecified site',async()=>{
        const h=await atTheBoard('crossing-watch-exact');
        const before=h.game.state().run.elapsedDays;
        const vague=await observedAct(h, 'I take the crossing watch');
        if(publicWatchTargetsOf(h.game.atHand!,h.house.id).length<2)throw new Error('Native board lacks two site-bearing controls');
        {
            for(const posted of h.board.offers.filter(o=>publicWatchTargetForPost(h.game.atHand!,h.house.id,o.entry.id)!==null))expect(vague.narration).toContain(posted.entry.name);
            expect(theMissionPostTheyHold(h.game,h.id)).toBeNull();
            expect(h.game.state().run.elapsedDays).toBe(before);
        }
        await observedAct(h, 'I take the post '+h.offer.entry.name);
        const other=h.game.atHand!.locations.find(l=>l.id!==h.site.id&&l.parentId===h.site.parentId&&l.kind==='settlement');
        if(!other)throw new Error('No actual same-province control ground');
        h.repos.cultivators.update(h.id,{location:other.name});
        h.repos.cultivators.standIn(h.id,null);
        await observedAct(h, 'I look around');
        expect(theMissionPostTheyHold(h.game,h.id)!.tags).not.toContain('post-arrived');
        expect(publicWatchTargetForPost(h.game.atHand!,h.house.id,'mission-crossing-watch~not-a-site@'+h.house.id)).toBeNull();
    },240000);
});


describe('actual body at post settlement boundaries',()=>{
    it.each(['away-at-due','early-departure','no-show','dead-at-due'] as const)('%s never receives a completed site-watch claim',async state=>{
        const h=await atTheBoard('crossing-watch-boundary-'+state);
        const accepted=await observedAct(h, 'I take the post '+h.offer.entry.name);
        expect(accepted.toolCalls.some(c=>c.name==='encounters.acceptDuty'&&c.ok)).toBe(true);
        const oath=theMissionPostTheyHold(h.game,h.id);
        if(!oath||oath.dueOnDay===null)throw new Error('No actual accepted term');
        if(state!=='no-show'){
            h.repos.cultivators.update(h.id,{location:h.site.name});
            h.repos.cultivators.standIn(h.id,null);
            const arrival=settleTheMissionPostTheyHold(h.game,h.repos.cultivators.getById(h.id)!);
            expect(arrival).not.toBeNull();
            expect(theMissionPostTheyHold(h.game,h.id)?.tags).toContain('post-arrived');
        }
        if(state==='away-at-due'||state==='early-departure'){
            const home=h.game.atHand!.locations.find(place=>place.id===h.house.seatLocationId);
            if(!home||home.id===h.site.id)throw new Error('No real distinct departure ground');
            h.repos.cultivators.update(h.id,{location:home.name});
            h.repos.cultivators.standIn(h.id,null);
        }
        const now=h.game.currentRun().run;
        h.repos.runs.advanceDays(now.id,state==='early-departure'?1:oath.dueOnDay-now.elapsedDays);
        if(state==='dead-at-due')h.repos.cultivators.update(h.id,{alive:false});
        const body=h.repos.cultivators.getById(h.id)!;
        const merit=h.repos.sects.getMembership(h.id)!.contribution;
        const outcome=settleTheMissionPostTheyHold(h.game,body);
        const final=ledgerAbout(h.db,h.id).find(row=>row.id===oath.id);
        expect(final).toBeDefined();
        expect(final?.settlement?.resolution).not.toBe('oath_fulfilled');
        expect(outcome?.lines.join(' ')??'').not.toContain('Your post is served');
        if(state==='dead-at-due'){
            expect(outcome).toBeNull();
            expect(final?.status).toBe('open');
            expect(h.repos.cultivators.getById(h.id)!.spiritStones).toBe(body.spiritStones);
            expect(h.repos.sects.getMembership(h.id)!.contribution).toBe(merit);
        }else{
            expect(outcome).not.toBeNull();
            expect(final?.status).not.toBe('open');
            if(state==='no-show'){
                expect(h.repos.cultivators.getById(h.id)!.spiritStones).toBe(body.spiritStones);
                expect(h.repos.sects.getMembership(h.id)!.contribution).toBe(merit);
            }
        }
    },120000);
});

it('the displayed site title reaches actual native acceptance before any journey or service',async()=>{
 const h=await atTheBoard('crossing-watch-displayed-title');try{
  const published=await observedAct(h,'what missions are there');expect(published.narration).toContain(h.offer.entry.name);
  const before=h.game.currentRun(),accepted=await observedAct(h,'I take the post '+h.offer.entry.name);
  expect(accepted.toolCalls.some(c=>c.name==='encounters.acceptDuty'&&c.ok)).toBe(true);
  const oath=theMissionPostTheyHold(h.game,h.id);expect(oath).not.toBeNull();
  expect(oath!.tags).toContain('post-at:'+h.site.id);expect(oath!.tags).not.toContain('post-arrived');
  expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.125,9);
  expect(h.game.currentRun().cultivator.location).toBe(before.cultivator.location);
 }finally{h.db.close();}
},120000);

async function buyActualTermFood(h:Awaited<ReturnType<typeof atTheBoard>>) {
 const before=h.game.currentRun(),stock=h.game.rationsHeld(before.cultivator);
 const purchase=await observedAct(h,'I buy '+h.offer.terms.days+' days of rations.');
 expect(purchase.toolCalls.some(c=>c.name==='cultivator.applyDeltas'&&c.ok),'actual house refectory must sell the purchased watch provisions').toBe(true);
 expect(h.game.rationsHeld(h.game.currentRun().cultivator)).toBeGreaterThan(stock);
 expect(h.game.currentRun().cultivator.spiritStones).toBeLessThan(before.cultivator.spiritStones);
}
/** A known short road isolates clause settlement from the full maritime journey.
 * Returning before the sentence ends must not erase having left a held post. */
it('settles leaving the actual terminal before a later clause returns there',async()=>{
 const plans:string[]=[],h=await atTheBoard('watch-leaves-and-returns',new ScriptedProvider({plans,narrations:[]}));
 try {
  await observedAct(h,'I take the post '+h.offer.entry.name);
  h.repos.cultivators.update(h.id,{location:h.site.name,hp:10000,maxHp:10000,satiety:100});
  h.repos.cultivators.standIn(h.id,null);
  await observedAct(h,'I look around');
  const oath=theMissionPostTheyHold(h.game,h.id)!;
  expect(oath.tags).toContain('post-arrived');
  const world=h.game.atHand!,site=world.locations.find(place=>place.id===h.site.id)!;
  const village=makeLocation({id:'watch-road-village',name:'Reed Lantern Ford',kind:'settlement',parentId:site.parentId});
  world.locations.push(village);linkLocations(site,village,'road',.125);h.game.theWorldMoved();
  const before=h.game.currentRun();
  for(const place of [site,village])h.game.noteEncounter(before.cultivator,before.run,
   {kind:'place',id:place.name,name:place.name},'told','An actual known road.');
  const first='I walk to '+village.name,second='I return to '+site.name;
  plans.push(JSON.stringify({steps:[{action:'move',target:village.name,said:first},{action:'move',target:site.name,said:second}]}));
  const result=await observedAct(h,first+'; then '+second+'.');
  expect(result.toolCalls.find(call=>call.name==='narrator.plan')?.source).toBe('model');
  expect(result.narration).toContain(village.name);
  expect(h.game.worldPlaceOf(h.game.currentRun().cultivator)).toBe(site.id);
  expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(before.run.elapsedDays);
  expect(theMissionPostTheyHold(h.game,h.id)).toBeNull();
  const settled=ledgerAbout(h.db,h.id).find(record=>record.id===oath.id)!;
  expect(settled.status).not.toBe('open');
  expect(settled.settlement?.resolution).not.toBe('oath_fulfilled');
  expect(result.narration).not.toContain('Your post is served');
 }finally{h.db.close();}
},120000);
it('a scripted main-frontdoor reading can resolve a vague taking to an actual displayed terminal',async()=>{
 const plans:string[]=[],h=await atTheBoard('crossing-watch-model-site',new ScriptedProvider({plans,narrations:[]}));try{
  const printed=await observedAct(h,'what missions are there');expect(printed.narration).toContain(h.offer.entry.name);
  const before=h.game.currentRun();plans.push(JSON.stringify({action:'sect',intent:'duty',target:h.offer.entry.name}));
  const result=await observedAct(h,'I take the crossing watch');
  expect(result.toolCalls.some(c=>c.name==='narrator.plan'&&c.source==='model')).toBe(true);
  expect(result.toolCalls.some(c=>c.name==='encounters.acceptDuty'&&c.ok)).toBe(true);
  expect(theMissionPostTheyHold(h.game,h.id)?.tags).toContain('post-at:'+h.site.id);
  expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.125,9);
 }finally{h.db.close();}
},120000);
it('the ordinary work reading reaches the same site binder without selecting the first unresolved watch',async()=>{
 const plans:string[]=[],h=await atTheBoard('crossing-watch-work-site',new ScriptedProvider({plans,narrations:[]}));try{
  const before=h.game.currentRun(),beforeWorld=routineTime(h.game.atHand!);plans.push(JSON.stringify({action:'work',target:'crossing watch',days:h.offer.terms.days}));
  const result=await observedAct(h,'I work as a crossing watch');
  expect(result.toolCalls.some(c=>c.name==='narrator.plan'&&c.source==='model')).toBe(true);
  for(const posted of h.board.offers.filter(o=>publicWatchTargetForPost(h.game.atHand!,h.house.id,o.entry.id)!==null))expect(result.narration).toContain(posted.entry.name);
  expect(result.toolCalls.some(c=>c.name==='encounters.sectBoardFor'&&!c.ok)).toBe(true);
  expect(routineTime(h.game.atHand!)).toBe(beforeWorld);
  expect(theMissionPostTheyHold(h.game,h.id)).toBeNull();
  expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
 }finally{h.db.close();}
},120000);

async function answerActualSummons(h:Awaited<ReturnType<typeof atTheBoard>>) {
 const pending=readPendingSummons(h.repos,h.id);if(!pending)return null;
 const result=await observedAct(h,'I decline the summons');
 expect(ledgerAbout(h.db,h.id).some(row=>row.tags.includes(pending.entryId)&&row.tags.includes('refused')),'the explicit refusal must answer the actual old decision in its native account').toBe(true);
 const next=readPendingSummons(h.repos,h.id);
 expect(next?.entryId,'a new real request may follow, but the answered old entry must not remain pending').not.toBe(pending.entryId);
 expect(h.game.currentRun().cultivator.alive).toBe(true);
 return result;
}
async function buyActualPostRoof(h:Awaited<ReturnType<typeof atTheBoard>>,due:number) {
 const before=h.game.currentRun();
 expect(h.game.worldPlaceOf(before.cultivator)).toBe(h.site.id);
 // Night count buys actual roof coverage; the service span itself is never rounded.
 const nights=Math.ceil(due-before.run.elapsedDays)+1;
 await observedAct(h,'I walk to the inn');
 let keeper=null as ReturnType<typeof whoKeepsTheCounter>;
 for(let decision=0;decision<96;decision++){
  const current=h.game.currentRun().cultivator,world=h.game.atHand!;
  const place=world.locations.find(place=>place.id===h.game.worldPlaceOf(current))!;
  keeper=whoKeepsTheCounter(h.game,current,'inn',publicCountersAt(world,place.name,world.currentDay));
  if(keeper)break;
  await answerActualSummons(h);
  const beforeWait=h.game.currentRun().run.elapsedDays,worldBeforeWait=routineTime(h.game.atHand!),requested=1/96;
  const waiting=await observedAct(h,'I wait for '+requested+' days');
  const spent=h.game.currentRun().run.elapsedDays-beforeWait;
  expect(spent,'real fractional waiting must spend time').toBeGreaterThan(0);
  expect(spent,'supported quarter-hour equivalent cannot silently spend a whole day').toBeLessThanOrEqual(requested+1e-7);
  expect(routineTime(h.game.atHand!)-worldBeforeWait).toBeCloseTo(spent,7);
  if(spent<requested-1e-7)expect(waiting.toolCalls.some(call=>call.name==='engine.spanCutShort'),'shortened real waiting needs an actual interruption').toBe(true);
  expect(h.game.currentRun().cultivator.alive,'ordinary waiting must preserve a real living service body').toBe(true);
  expect(h.game.worldPlaceOf(h.game.currentRun().cultivator)).toBe(h.site.id);
 }
 expect(keeper,'actual inn availability must be reached before buying its roof').not.toBeNull();
 await observedAct(h,'I take a room at the inn for '+nights+' nights');
 const now=h.game.currentRun(),room=whereTheyAreLodged(h.game,now.cultivator);
 expect(room,'native keeper must actually sell the roof used by this long service').not.toBeNull();
 expect(room!.paidThroughDay).toBeGreaterThanOrEqual(due);
 expect(now.cultivator.spiritStones).toBeLessThan(before.cultivator.spiritStones);
 expect(h.game.worldPlaceOf(now.cultivator)).toBe(h.site.id);
}
async function serveUntilActualDeadline(h:Awaited<ReturnType<typeof atTheBoard>>,due:number) {
 let result=await observedAct(h,'I look around');
 for(let decision=0;decision<240&&h.game.currentRun().run.elapsedDays<due;decision++) {
  const answered=await answerActualSummons(h);
  if(answered){result=answered;if(result.narration.includes('Your post is served'))return result;}
  const current=h.game.currentRun();
  expect(current.cultivator.alive,'real body must survive actual service').toBe(true);
  expect(h.game.worldPlaceOf(current.cultivator)).toBe(h.site.id);
  if(current.run.elapsedDays>=due)break;
  result=await observedAct(h,'I wait for '+(due-current.run.elapsedDays)+' days');
  if(result.narration.includes('Your post is served'))return result;
 }
 expect(h.game.currentRun().run.elapsedDays,'explicit continuation must reach the unchanged native deadline').toBeGreaterThanOrEqual(due);
 return result;
}
async function followTheActualOfferedRoute(h:Awaited<ReturnType<typeof atTheBoard>>) {
 let result=await observedAct(h,'I travel to '+h.site.name+'.');
 for(let leg=0;leg<12&&h.game.worldPlaceOf(h.game.currentRun().cultivator)!==h.site.id;leg++) {
  await answerActualSummons(h);
  const before=h.game.currentRun(),world=h.game.atHand!;
  const line=publicTransportFrom(world,before.cultivator.location??'',Math.floor(routineTime(world)))
   .find(line=>line.service==='ship'&&result.narration.includes(line.to+' by ship:'));
  expect(line,'a nonwalking route must offer a real native ship leg, not a fabricated shortcut').toBeDefined();
  const hub=publicTransportHubsAt(world,before.cultivator.location??'',Math.floor(routineTime(world)))
   .find(hub=>hub.kind==='landing'&&hub.destinations.includes(line!.to));
  expect(hub).toBeDefined();
  await observedAct(h,'I walk to '+hub!.name);
  const facts=new Set(h.game.atHand!.history.facts.map(fact=>fact.id)),purse=h.game.currentRun().cultivator.spiritStones;
  const boarding=h.game.currentRun(),boardingOrigin=h.game.worldPlaceOf(boarding.cultivator);
  result=await observedAct(h,'I take the ship to '+line!.to);
  const receipt=h.game.atHand!.history.facts.find(fact=>!facts.has(fact.id)&&fact.data.publicPassage===true);
  expect(receipt,'actual counter must bind a real finite hull course before the journey: '+JSON.stringify({calls:result.toolCalls,
   at:before.cultivator.location,line,clock:[h.game.atHand!.currentDay,routineTime(h.game.atHand!)],
   hull:h.game.atHand!.objects.find(o=>o.id===shipIdForLane(line!.lane!)),
   plans:h.game.atHand!.history.facts.filter(f=>typeof f.data.publicReservations==='string'&&String(f.data.publicReservations).includes(shipIdForLane(line!.lane!))).map(f=>f.data),
   crew:h.game.atHand!.npcs.filter(n=>n.tags.includes('crew-of:'+shipIdForLane(line!.lane!))),
   receipts:h.game.atHand!.history.facts.filter(f=>f.data.vesselId===shipIdForLane(line!.lane!)).map(f=>({day:f.day,data:f.data}))})).toBeDefined();
  expect(receipt!.data.runId).toBe(boarding.run.id);
  expect(receipt!.data.boardingRunElapsedDays).toBe(boarding.run.elapsedDays);
  expect(receipt!.data.fromLocationId).toBe(boardingOrigin);
  expect(receipt!.data.toLocationId).toBe(h.game.atHand!.locations.find(place=>place.name===line!.to)!.id);
  expect(receipt!.data.seaLaneId).toBe(line!.lane!.id);
  expect(arrivalCourseOfFact(receipt!),'the accepted ticket must retain its real finite course').not.toBeNull();
  expect(h.game.currentRun().cultivator.spiritStones).toBeLessThan(purse);
  for(let decision=0;decision<240;decision++) {
   const voyage=recordedVoyage(h.db,h.id);
   if(!voyage)break;
   expect(voyage.receiptId).toBeTruthy();
   const aboard=shipPassengerAt(h.game.atHand!,voyage.receiptId!,routineTime(h.game.atHand!));
   expect(aboard).not.toBeNull();expect(aboard!.unavailable).toBeNull();
   await answerActualSummons(h);
   const currentCourse=shipPassengerAt(h.game.atHand!,voyage.receiptId!,routineTime(h.game.atHand!));
   expect(currentCourse).not.toBeNull();expect(currentCourse!.unavailable).toBeNull();
   if(currentCourse!.remainingDays<=0){result=await observedAct(h,'I look around');break;}
   result=await observedAct(h,'I wait for '+currentCourse!.remainingDays+' days');
   expect(h.game.currentRun().cultivator.alive).toBe(true);
  }
  expect(recordedVoyage(h.db,h.id),'actual hull must finish or honestly fail before the next leg').toBeNull();
  const arrived=shipPassengerAt(h.game.atHand!,receipt!.id,routineTime(h.game.atHand!));
  expect(arrived?.arrived,'native crew/body course must actually reach the offered port').toBe(true);
  if(h.game.worldPlaceOf(h.game.currentRun().cultivator)===h.site.id)break;
  result=await observedAct(h,'I travel to '+h.site.name+'.');
 }
 return result;
}
