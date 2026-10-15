/**
 * Asking a folding counter for a ticket previously spent the whole wait and
 * crossing, made no held item and removed money without a recipient. Public
 * folding now sells the same ordinary passage tally as other services. Its
 * holder may wait elsewhere, hand it to the actual attendant, or miss the real
 * departure and hear once that it went to dust. The published opening,
 * crossing hour, recovery and actual destination gate fee remain their existing authorities.
 */
import {afterEach,expect,it,vi} from 'vitest';
import {makeGameInWorld} from './harness';
import {SPAN_ROUTES} from '../../src/engine/world/where-the-measured-span-still-answers';
import {worldLocationFor} from '../../src/engine/world/place-lookup';
import {theAreasOf} from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import {createNpc} from '../../src/engine/world/npc-state';
import {routineTime} from '../../src/engine/world/npc-routines';
import {publicFoldingDepartures,settleDuePublicFoldingDepartures} from '../../src/engine/world/public-folding-departures';
import {passageTallyTerms} from '../../src/engine/world/a-passage-tally-is-the-seat-you-own';
import * as possessions from '../../src/engine/world/possessions';
async function prepared(){
    const h=await makeGameInWorld({seed:'held-folding-ticket',worldSeed:'held-folding-ticket-world'});
    const {cultivator}=await h.game.newRun('Traveller'),world=h.game.atHand!,route=SPAN_ROUTES[0]!,now=routineTime(world);
    const from=worldLocationFor(world,route.fromPlace)!,to=worldLocationFor(world,route.toPlace)!,area=theAreasOf(world,from).areas.find(a=>a.for==='span_counter')!;
    expect(area).toBeTruthy();
    const keeper=createNpc(world.seed,{id:'actual-folding-attendant',name:'Attendant Wen',occupation:'folding attendant',locationId:from.id,onDay:now,bornOnDay:now-10000});
    keeper.spiritStones=40;keeper.activity={kind:'trade',note:'Keeping the folding counter.',withIds:[],sinceDay:now,untilDay:null,standingIn:area.id};world.npcs.push(keeper);
    h.repos.cultivators.update(cultivator.id,{location:from.name,spiritStones:5000});h.repos.cultivators.standIn(cultivator.id,area.id);h.game.theWorldMoved();
    return {...h,cultivator,keeper,from,to,route,area,get world(){return h.game.atHand!;}};
}
afterEach(()=>{vi.restoreAllMocks();});
it('buys a held dated portal tally and pays the real attendant without crossing',async()=>{
    const h=await prepared(),before=h.game.currentRun();
    const turn=await h.game.act('I buy a ticket to '+h.to.name);
    const tally=h.world.objects.find(o=>o.possessorId===h.cultivator.id&&passageTallyTerms(o)?.service==='portal');expect(tally,turn.narration).toBeTruthy();
    const terms=passageTallyTerms(tally!)!;
    expect(h.game.currentRun().cultivator.location).toBe(h.from.name);expect(h.game.currentRun().cultivator.standingIn).toBe(h.area.id);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones-terms.fareStones);
    expect(h.world.npcs.find(p=>p.id===h.keeper.id)!.spiritStones).toBe(40+terms.fareStones);
    expect(publicFoldingDepartures(h.world).some(d=>d.terms.departureDay===terms.departureDay)).toBe(true);
    expect(routineTime(h.world)).toBeLessThan(terms.departureDay);expect(turn.narration).toContain('departure');
});
it('hands the held tally to the attendant and crosses without another fare',async()=>{
    const h=await prepared();await h.game.act('I buy a ticket to '+h.to.name);
    const tally=h.world.objects.find(o=>o.possessorId===h.cultivator.id&&passageTallyTerms(o)?.service==='portal')!;expect(tally).toBeTruthy();
    // Buy the real recovery provisions first, so this assertion isolates the fare.
    const provisions=h.game.buyProvisions(h.game.currentRun().cultivator,h.route.schedule.periodDays);
    h.game.putBackWhatWasNotEaten(provisions.cultivator,{endState:{rationsRemaining:provisions.rations}});
    const purse=h.game.currentRun().cultivator.spiritStones,spy=vi.spyOn(possessions,'transferPossession');
    const turn=await h.game.act('I hand in my passage tally');
    const index=spy.mock.calls.findIndex(([o,change])=>o.id===tally.id&&change.toHolderId===h.keeper.id);expect(index,turn.narration).toBeGreaterThanOrEqual(0);
    expect(spy.mock.results[index]!.value.possessorId).toBe(h.keeper.id);
    expect(h.world.objects.some(o=>o.id===tally.id)).toBe(false);const gateFee=h.world.history.facts.filter(f=>f.data.gateRegistrant===h.cultivator.id).reduce((sum,f)=>sum+Number(f.data.stones??0),0);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(purse-gateFee);
    expect(h.world.history.facts.filter(f=>f.data.passageTallyPurchase===true&&f.actors.some(a=>a.id===h.cultivator.id&&a.role==='buyer'))).toHaveLength(1);
    expect(h.game.currentRun().cultivator.location,turn.narration).toBe(h.to.name);
});
it('expires only on the actual staffed departure and reports dust once',async()=>{
    const h=await prepared();await h.game.act('I buy a ticket to '+h.to.name);
    const tally=h.world.objects.find(o=>o.possessorId===h.cultivator.id&&passageTallyTerms(o)?.service==='portal')!,t=passageTallyTerms(tally)!;
    h.world.npcs.find(p=>p.id===h.keeper.id)!.locationId=null;
    h.world.currentDay=t.departureDay;h.world.currentHour=(t.departureDay%1)*24;settleDuePublicFoldingDepartures(h.world);
    expect(h.world.objects.some(o=>o.id===tally.id)).toBe(true);
    h.world.npcs.find(p=>p.id===h.keeper.id)!.locationId=h.from.id;
    settleDuePublicFoldingDepartures(h.world);h.game.theWorldMoved();expect(h.world.objects.some(o=>o.id===tally.id)).toBe(false);
    const first=await h.game.act('I check my inventory');expect(first.narration).toContain(tally.name+' is now useless and has gone to dust.');
    const second=await h.game.act('I check my inventory');expect(second.narration).not.toContain(tally.name+' is now useless and has gone to dust.');
});
