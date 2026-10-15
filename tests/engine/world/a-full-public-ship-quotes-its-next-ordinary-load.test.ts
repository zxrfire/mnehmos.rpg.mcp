/**
 * Public ships had no advance held-ticket departure, so a full actual hull
 * could only refuse. The next-load quote now reads one real lane hull, its
 * finite accepted appointments and the ordinary crossing authority. Filling a
 * departure's physical paid seats quotes the real return and next outward leg.
 * Quotes themselves create no crew, hull, appointment, ticket or movement.
 * The last control runs the paid appointments through their actual departures;
 * the companion played file covers counter purchase and hand-in.
 */
import {expect,it} from 'vitest';
import {loadCultivationCatalog} from '../../../src/engine/world/catalog';
import {seedWorld} from '../../../src/engine/world/seeding';
import {publicShipLinesFrom,publicShipPassengerBerths} from '../../../src/engine/world/public-shipping';
import {offerTheNextPublicShip,freePublicShipSeats,purchaseAcceptedPublicShipTally,publicShipDepartures,settleDuePublicShips} from '../../../src/engine/world/the-next-public-ship-is-an-ordinary-trip';
import {routineTime} from '../../../src/engine/world/npc-routines';
import {ensureShipCrew} from '../../../src/engine/world/ship-crew';
import {aVehicleOf} from '../../../src/engine/world/a-vehicle';
import {createNpc} from '../../../src/engine/world/npc-state';
import {makeFact} from '../../../src/engine/world/history';
import {appendWorldFact} from '../../../src/engine/world/who-was-there-when-it-happened';
import {makePassageTally} from '../../../src/engine/world/a-passage-tally-is-the-seat-you-own';
import {ruin} from '../../../src/engine/world/possessions';
const catalog=await loadCultivationCatalog();
function fixture() {
    const world=seedWorld({seed:'public-ship-next-load',catalog,presentYear:0}).state;
    const from=world.locations.find(p=>p.name==='Emerald Water City')!;
    const line=publicShipLinesFrom(world,from.name,routineTime(world)).find(l=>l.runsFromDay===null)!;
    const to=world.locations.find(p=>p.name===line.to)!;
    const offer=offerTheNextPublicShip(world,from.id,to.id)!;expect(offer).toBeTruthy();
    return {world,from,to,offer};
}
it('quotes an ordinary cold departure without realising or accepting anything',()=>{
    const h=fixture(),before=structuredClone(h.world);
    const quote=offerTheNextPublicShip(h.world,h.from.id,h.to.id)!;
    expect(quote.departure.terms).toEqual(h.offer.departure.terms);
    expect(quote.departure.terms.departureDay).toBeGreaterThan(routineTime(h.world));
    expect(quote.departure.arrivalDay).toBeGreaterThan(quote.departure.terms.departureDay);
    expect(h.world).toEqual(before);
});
it('a full paid load quotes the same captain and hull after an actual return leg',()=>{
    const h=fixture(),now=routineTime(h.world),d=h.offer.departure;
    const crew=ensureShipCrew(h.world,d.leg.lane,h.from.id,now),master=crew.find(n=>n.identity.occupation==='shipmaster')!;
    master.spiritStones=50;
    h.world.objects.push(aVehicleOf({id:d.terms.vesselId,conveyanceId:'conv-water-ship',ownerId:master.id,ownerName:master.name,at:h.from.id}));
    for(const effect of h.offer.newAppointments){effect.data.operatorId=master.id;effect.actorIds=[master.id];h.world.schedule.push(effect);}
    const capacity=publicShipPassengerBerths(h.world,d.terms.vesselId);
    for(let seat=1;seat<=capacity;seat++) {
        const buyer=createNpc(h.world.seed,{id:'paid-ship-holder-'+seat,locationId:h.from.id,onDay:now,bornOnDay:now-7300});
        buyer.spiritStones=1000-d.fareStones;h.world.npcs.find(p=>p.id===master.id)!.spiritStones+=d.fareStones;h.world.npcs.push(buyer);
        const terms={...d.terms,seat,fareStones:d.fareStones};
        const purchase=appendWorldFact(h.world,makeFact({day:now,kind:'gathering',visibility:'secret',summary:'A passage tally was bought at the landing.',
            actors:[{id:buyer.id,name:buyer.name,role:'buyer'},{id:master.id,name:master.name,role:'carrier'}],
            data:{passageTallyPurchase:true,service:'ship',vesselId:terms.vesselId,fromLocationId:terms.fromId,toLocationId:terms.toId,
                departureDay:terms.departureDay,seat,fareStones:terms.fareStones,stones:terms.fareStones}}),{recur:false,bystanders:false});
        h.world.objects.push(makePassageTally({terms,buyer,purchase,onDay:now,fromName:h.from.name,toName:h.to.name}));
    }
    expect(freePublicShipSeats(h.world,d)).toHaveLength(0);
    const before=structuredClone(h.world),next=offerTheNextPublicShip(h.world,h.from.id,h.to.id)!;
    expect(next).toBeTruthy();expect(next.fullDepartureDay).toBe(d.terms.departureDay);
    expect(next.newAppointments).toHaveLength(2);
    const [back,out]=next.newAppointments;
    expect(back!.data.fromLocationId).toBe(h.to.id);expect(back!.data.toLocationId).toBe(h.from.id);
    expect(back!.dueOnDay).toBeGreaterThanOrEqual(d.arrivalDay);
    expect(out!.dueOnDay).toBeGreaterThanOrEqual(Number(back!.data.arrivalDay));
    expect(next.departure.terms.vesselId).toBe(d.terms.vesselId);expect(next.departure.operatorId).toBe(master.id);
    expect(h.world.npcs.find(p=>p.id===master.id)!.spiritStones).toBe(50+capacity*d.fareStones);
    expect(h.world).toEqual(before);
});
it('a ruined real hull is not replaced to sell a later load',()=>{
    const h=fixture(),d=h.offer.departure,now=routineTime(h.world);
    const master=ensureShipCrew(h.world,d.leg.lane,h.from.id,now).find(p=>p.identity.occupation==='shipmaster')!;
    h.world.objects.push(ruin(aVehicleOf({id:d.terms.vesselId,conveyanceId:'conv-water-ship',ownerId:master.id,ownerName:master.name,at:h.from.id}),{onDay:now,source:'The hull was lost.'}));
    const before=structuredClone(h.world);
    expect(offerTheNextPublicShip(h.world,h.from.id,h.to.id)).toBeNull();expect(h.world).toEqual(before);
});

it('the same master completes the outward, empty return and bought next load',()=>{
    const h=fixture(),now=routineTime(h.world);
    const buyer=createNpc(h.world.seed,{id:'repeat-ship-buyer',locationId:h.from.id,onDay:now,bornOnDay:now-9000});
    buyer.spiritStones=10000;h.world.npcs.push(buyer);
    const first=purchaseAcceptedPublicShipTally(h.world,h.offer,buyer,buyer,(id,stones,commit)=>{
        const payer=h.world.npcs.find(p=>p.id===buyer.id)!,carrier=h.world.npcs.find(p=>p.id===id)!;
        payer.spiritStones-=stones;carrier.spiritStones+=stones;commit();return true;
    });expect(first).toBeTruthy();
    // The unboarded full load's items still reserve every berth.
    const initial=publicShipDepartures(h.world)[0]!;
    for(let seat=2;seat<=publicShipPassengerBerths(h.world,initial.terms.vesselId);seat++) {
        const offer=offerTheNextPublicShip(h.world,h.from.id,h.to.id)!;
        expect(purchaseAcceptedPublicShipTally(h.world,offer,buyer,buyer,(id,stones,commit)=>{
            h.world.npcs.find(p=>p.id===buyer.id)!.spiritStones-=stones;h.world.npcs.find(p=>p.id===id)!.spiritStones+=stones;commit();return true;
        })).toBeTruthy();
    }
    const next=offerTheNextPublicShip(h.world,h.from.id,h.to.id)!;
    expect(next.departure.terms.departureDay).toBeGreaterThan(initial.arrivalDay);
    expect(purchaseAcceptedPublicShipTally(h.world,next,buyer,buyer,(id,stones,commit)=>{
        h.world.npcs.find(p=>p.id===buyer.id)!.spiritStones-=stones;h.world.npcs.find(p=>p.id===id)!.spiritStones+=stones;commit();return true;
    })).toBeTruthy();
    // The buyer spends the wait elsewhere; the appointments still make real trips.
    h.world.npcs.find(p=>p.id===buyer.id)!.activity=null;
    const jobs=publicShipDepartures(h.world);expect(jobs).toHaveLength(3);
    const master=jobs[0]!.operatorId;
    for(const job of jobs) {
        h.world.currentDay=job.terms.departureDay;h.world.currentHour=(h.world.currentDay%1)*24;
        settleDuePublicShips(h.world);
        const actual=h.world.npcs.find(p=>p.id===master)!.activity!;
        expect(actual.vesselId).toBe(initial.terms.vesselId);expect(actual.fromLocationId).toBe(job.terms.fromId);
        expect(actual.returnTo).toBe(job.terms.toId);expect(actual.sinceDay).toBe(job.terms.departureDay);
        expect(actual.untilDay).toBeGreaterThan(actual.sinceDay);
        expect(h.world.history.facts.some(f=>f.data.publicDepartureCompleted===job.effect.id)).toBe(true);
    }
    expect(publicShipDepartures(h.world)).toHaveLength(0);
});
