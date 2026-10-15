/**
 * Public ships previously only issued tallies inside immediate boarding. A
 * bought seat must instead be a held item when requested, with a real fare to
 * its carrier. A full sailing sells the same hull's next load after its return;
 * buying never spends that wait. Boarding gives the item to a present crew
 * member before deletion; missing the actual sailing dusts it once.
 */
import {afterEach,expect,it,vi} from 'vitest';
import {makeGameInWorld} from './harness';
import {worldLocationFor} from '../../src/engine/world/place-lookup';
import {theAreasOf} from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import {ensureShipCrew} from '../../src/engine/world/ship-crew';
import {createNpc} from '../../src/engine/world/npc-state';
import {routineTime} from '../../src/engine/world/npc-routines';
import {publicShipLinesFrom,publicShipPassengerBerths} from '../../src/engine/world/public-shipping';
import {buyPublicShipTally} from '../../src/web/public-ship-tallies-at-the-counter';
import {publicShipDepartures,settleDuePublicShips} from '../../src/engine/world/the-next-public-ship-is-an-ordinary-trip';
import {passageTallyTerms} from '../../src/engine/world/a-passage-tally-is-the-seat-you-own';
import * as possessions from '../../src/engine/world/possessions';
async function prepared(){
    const h=await makeGameInWorld({seed:'public-ship-held-tally',worldSeed:'public-ship-held-tally-world'});
    const {cultivator}=await h.game.newRun('Traveller'),world=h.game.atHand!,now=routineTime(world);
    const from=worldLocationFor(world,'Emerald Water City')!;
    const line=publicShipLinesFrom(world,from.name,now).find(l=>l.runsFromDay===null)!;
    const to=worldLocationFor(world,line.to)!,landing=theAreasOf(world,from).areas.find(a=>a.for==='landing')!;
    const keeper=createNpc(world.seed,{id:'public-ship-ticket-clerk',name:'Clerk Wen',occupation:'merchant',locationId:from.id,onDay:now,bornOnDay:now-10000});
    keeper.activity={kind:'trade',note:'Keeping the landing counter.',withIds:[],sinceDay:now,untilDay:null,standingIn:landing.id};world.npcs.push(keeper);
    h.repos.cultivators.update(cultivator.id,{location:from.name,spiritStones:10000});h.repos.cultivators.standIn(cultivator.id,landing.id);h.game.theWorldMoved();
    return {...h,from,to,landing,keeper,cultivator,get world(){return h.game.atHand!;}};
}
afterEach(()=>{vi.restoreAllMocks();});
it('buys a physical dated tally without boarding and pays the actual master',async()=>{
    const h=await prepared(),before=h.game.currentRun();
    const line=publicShipLinesFrom(h.world,h.from.name,routineTime(h.world)).find(l=>l.to===h.to.name)!;
    const masterBefore=ensureShipCrew(h.world,line.lane,h.from.id,routineTime(h.world)).find(p=>p.identity.occupation==='shipmaster')!;
    const masterPurse=masterBefore.spiritStones;
    const turn=await h.game.act('I buy a ship ticket to '+h.to.name);
    const tally=h.world.objects.find(o=>o.possessorId===h.cultivator.id&&passageTallyTerms(o));expect(tally,turn.narration).toBeTruthy();
    const terms=passageTallyTerms(tally!)!,purchase=h.world.history.facts.find(f=>f.data.passageTallyPurchase===true&&f.data.seat===terms.seat)!;
    const master=h.world.npcs.find(p=>p.id===purchase.data.receiverId)!;
    expect(h.game.currentRun().cultivator.location).toBe(h.from.name);expect(h.game.currentRun().cultivator.standingIn).toBe(h.landing.id);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones-terms.fareStones);
    expect(master.spiritStones).toBe(masterPurse+terms.fareStones);
    expect(h.world.history.facts.some(f=>f.data.actualBoarding===true&&f.actors.some(a=>a.id===h.cultivator.id))).toBe(false);
    expect(turn.narration).toContain('departure');expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeLessThan(terms.departureDay-routineTime(h.world)+1);
});
it('a full paid ship sells the next dated load on the same real hull',async()=>{
    const h=await prepared();let first:number|undefined,vessel:string|undefined;
    for(let seat=0;seat<30;seat++){
        if(vessel&&seat>=publicShipPassengerBerths(h.world,vessel))break;
        const now=routineTime(h.world),p=createNpc(h.world.seed,{id:'public-ship-load-'+seat,locationId:h.from.id,onDay:now,bornOnDay:now-9000});
        p.spiritStones=1000;p.activity={kind:'idle',note:'At the landing counter.',withIds:[],sinceDay:now,untilDay:null,standingIn:h.landing.id};h.world.npcs.push(p);
        const purchase=buyPublicShipTally(h.game,h.from.id,h.to.id,p,p,h.keeper.id);expect(purchase.ok).toBe(true);if(!purchase.ok)throw new Error(purchase.reason);
        const t=passageTallyTerms(purchase.tally)!;first??=t.departureDay;vessel??=t.vesselId;expect(t.departureDay).toBe(first);
        h.world.npcs.find(n=>n.id===p.id)!.activity!.standingIn=theAreasOf(h.world,h.from).areas.find(a=>a.id!==h.landing.id)!.id;
    }
    const bodyBefore=h.game.currentRun().cultivator.location;
    const turn=await h.game.act('I buy a ship ticket to '+h.to.name);
    const tally=h.world.objects.find(o=>o.possessorId===h.cultivator.id&&passageTallyTerms(o));expect(tally,turn.narration).toBeTruthy();
    const t=passageTallyTerms(tally!)!;expect(t.vesselId).toBe(vessel);expect(t.departureDay).toBeGreaterThan(first!);
    const jobs=publicShipDepartures(h.world,vessel);expect(jobs.some(d=>d.terms.fromId===h.to.id&&d.terms.toId===h.from.id)).toBe(true);
    expect(h.game.currentRun().cultivator.location).toBe(bodyBefore);expect(turn.narration).toContain('no passenger seat');
    expect(h.world.objects.filter(o=>o.id===vessel)).toHaveLength(1);
});
it('hands the held tally to the real crew before deletion without another fare',async()=>{
    const h=await prepared();await h.game.act('I buy a ship ticket to '+h.to.name);
    const tally=h.world.objects.find(o=>o.possessorId===h.cultivator.id&&passageTallyTerms(o))!;expect(tally).toBeTruthy();
    const purse=h.game.currentRun().cultivator.spiritStones,handover=vi.spyOn(possessions,'transferPossession');
    const turn=await h.game.act('I board the ship to '+h.to.name);
    const call=handover.mock.calls.find(([o,change])=>o.id===tally.id&&change.note==='The passage tally was handed in at boarding.');
    expect(call,turn.narration).toBeTruthy();const taker=h.world.npcs.find(p=>p.id===call![1].toHolderId)!;expect(taker.tags).toContain('crew-of:'+passageTallyTerms(tally)!.vesselId);
    expect(handover.mock.results[handover.mock.calls.indexOf(call!)].value.possessorId).toBe(taker.id);
    expect(h.world.objects.some(o=>o.id===tally.id)).toBe(false);expect(h.game.currentRun().cultivator.spiritStones).toBe(purse);
    expect(h.world.history.facts.some(f=>f.data.actualBoarding===true&&f.actors.some(a=>a.id===h.cultivator.id))).toBe(true);
});
it('dusts an unhanded tally at the actual sailing and tells its holder once',async()=>{
    const h=await prepared();await h.game.act('I buy a ship ticket to '+h.to.name);
    const tally=h.world.objects.find(o=>o.possessorId===h.cultivator.id&&passageTallyTerms(o))!,terms=passageTallyTerms(tally)!;
    h.world.currentDay=terms.departureDay;h.world.currentHour=(terms.departureDay%1)*24;settleDuePublicShips(h.world,terms.departureDay);h.game.theWorldMoved();
    expect(h.world.objects.some(o=>o.id===tally.id)).toBe(false);
    const first=await h.game.act('I check my inventory');expect(first.narration).toContain(tally.name+' is now useless and has gone to dust.');
    const second=await h.game.act('I check my inventory');expect(second.narration).not.toContain(tally.name+' is now useless and has gone to dust.');
});
