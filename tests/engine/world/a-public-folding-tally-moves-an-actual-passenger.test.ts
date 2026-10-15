/**
 * A public portal ticket is not only a player command: a world holder pays the
 * actual attendant and crosses on its actual accepted opening. The body is at
 * neither landfall during the crossing hour, then recovers at the destination.
 * A missing attendant delays the actual departure, and a changed independent
 * course cannot be overwritten by an old arrival appointment.
 */
import {expect,it} from 'vitest';
import {loadCultivationCatalog} from '../../../src/engine/world/catalog';
import {seedWorld} from '../../../src/engine/world/seeding';
import {createNpc} from '../../../src/engine/world/npc-state';
import {SPAN_ROUTES} from '../../../src/engine/world/where-the-measured-span-still-answers';
import {SPAN_CROSSING_DAYS} from '../../../src/engine/world/buying-passage-at-a-measured-span-counter';
import {worldLocationFor} from '../../../src/engine/world/place-lookup';
import {routineTime} from '../../../src/engine/world/npc-routines';
import {theAreasOf} from '../../../src/engine/world/where-in-a-place-somebody-is-standing';
import {offerPublicFoldingDeparture,purchasePublicFoldingTally,settleDuePublicFoldingDepartures,publicFoldingDepartures}
    from '../../../src/engine/world/public-folding-departures';
const catalog=await loadCultivationCatalog();
function prepared(){
    const world=seedWorld({seed:'native-public-folding-passenger',catalog,presentYear:0}).state,now=routineTime(world),route=SPAN_ROUTES[0]!;
    const from=worldLocationFor(world,route.fromPlace)!,to=worldLocationFor(world,route.toPlace)!,area=theAreasOf(world,from).areas.find(a=>a.for==='span_counter')!;
    const keeper=createNpc(world.seed,{id:'fold-worker',locationId:from.id,onDay:now,bornOnDay:now-9000,occupation:'folding attendant'});
    const buyer=createNpc(world.seed,{id:'fold-buyer',locationId:from.id,onDay:now,bornOnDay:now-9000});
    for(const p of [keeper,buyer])p.activity={kind:'trade',note:'At the folding counter.',withIds:[],sinceDay:now,untilDay:null,standingIn:area.id};
    keeper.spiritStones=20;buyer.spiritStones=100;world.npcs.push(keeper,buyer);
    const departure=offerPublicFoldingDeparture(world,route,keeper.id)!;expect(departure).toBeTruthy();
    const tally=purchasePublicFoldingTally(world,departure,buyer,buyer,40,(id,stones,commit)=>{
        world.npcs.find(p=>p.id===buyer.id)!.spiritStones-=stones;world.npcs.find(p=>p.id===id)!.spiritStones+=stones;commit();return true;
    });expect(tally).toBeTruthy();
    return {world,from,to,keeper,buyer,departure,tally:tally!,at(day:number){world.currentDay=day;world.currentHour=(day%1)*24;settleDuePublicFoldingDepartures(world,day);}};
}
it('pays the actual worker and spends a real crossing hour before recovery',()=>{
    const h=prepared();expect(h.world.npcs.find(p=>p.id===h.buyer.id)!.spiritStones).toBe(60);expect(h.world.npcs.find(p=>p.id===h.keeper.id)!.spiritStones).toBe(60);
    h.at(h.departure.terms.departureDay);
    expect(h.world.objects.some(o=>o.id===h.tally.id)).toBe(false);expect(h.world.npcs.find(p=>p.id===h.buyer.id)!.locationId).toBeNull();
    h.at(h.departure.terms.departureDay+SPAN_CROSSING_DAYS);
    const body=h.world.npcs.find(p=>p.id===h.buyer.id)!;expect(body.locationId).toBe(h.to.id);expect(body.activity?.kind).toBe('mending');
    expect(body.updatedOnDay).toBe(h.departure.terms.departureDay+SPAN_CROSSING_DAYS);expect(publicFoldingDepartures(h.world)).toHaveLength(0);
});
it('cannot depart or consume a ticket without its real attendant',()=>{
    const h=prepared();h.world.npcs.find(p=>p.id===h.keeper.id)!.locationId=null;h.at(h.departure.terms.departureDay);
    expect(h.world.objects.some(o=>o.id===h.tally.id)).toBe(true);expect(h.world.npcs.find(p=>p.id===h.buyer.id)!.locationId).toBe(h.from.id);
    expect(publicFoldingDepartures(h.world)).toHaveLength(1);
});
it('does not overwrite a body whose accepted course changed during the crossing',()=>{
    const h=prepared();h.at(h.departure.terms.departureDay);
    const at=h.world.npcs.findIndex(p=>p.id===h.buyer.id),p=h.world.npcs[at]!;
    h.world.npcs[at]={...p,locationId:h.from.id,activity:{kind:'idle',note:'An independent actual interruption.',withIds:[],sinceDay:h.departure.terms.departureDay,untilDay:null}};
    h.at(h.departure.terms.departureDay+SPAN_CROSSING_DAYS);expect(h.world.npcs[at]!.locationId).toBe(h.from.id);expect(h.world.npcs[at]!.activity?.kind).toBe('idle');
});
