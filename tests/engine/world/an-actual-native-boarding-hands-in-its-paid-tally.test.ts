/**
 * The older native sea planner debited its passenger but committed only a
 * journey receipt: no physical tally reached the crew and no carrier received
 * those stones. The same gap affected already prepaid mission legs. These
 * controls keep the existing personal debit or actual dispatch payment and
 * require one real carrier credit and item hand-in, with no second charge.
 * Landing also found public-ticket boarding reusing a depleted crew without
 * calling the ordinary replacement path. A lost hand is replaced by a new
 * real person before boarding, while the dead row stays dead.
 * A rates boarding settled when met later must use its actual earlier source
 * date; it cannot require the ship to still be at that source port now.
 */
import {afterEach,expect,it,vi} from 'vitest';
import {loadCultivationCatalog} from '../../../src/engine/world/catalog';
import {seedWorld} from '../../../src/engine/world/seeding';
import {createNpc,markDead} from '../../../src/engine/world/npc-state';
import {publicShipLinesFrom,quotePublicPassage,onSponsoredPublicPassage} from '../../../src/engine/world/public-shipping';
import {settleNpcTravelOnContact} from '../../../src/engine/world/npc-departure-approaches';
import {passageTallyTerms} from '../../../src/engine/world/a-passage-tally-is-the-seat-you-own';
import {theAreasOf} from '../../../src/engine/world/where-in-a-place-somebody-is-standing';
import {bookNpcPassageForRoute,startNpcPassage} from '../../../src/engine/world/places-on-the-way';
import {ensureShipCrew,commitNpcPublicPassage} from '../../../src/engine/world/ship-crew';
import {offerTheNextPublicShip,purchaseAcceptedPublicShipTally,boardThePublicShip} from '../../../src/engine/world/the-next-public-ship-is-an-ordinary-trip';
import {keepTheBusinessStillOnTheBooks} from '../../../src/engine/world/the-business-the-world-still-keeps';
import {routineTime} from '../../../src/engine/world/npc-routines';
import {makeFact} from '../../../src/engine/world/history';
import {appendWorldFact} from '../../../src/engine/world/who-was-there-when-it-happened';
import * as possessions from '../../../src/engine/world/possessions';
const catalog=await loadCultivationCatalog();
afterEach(()=>{vi.restoreAllMocks();});
function prepared(){
    const world=seedWorld({seed:'native-tally-hand-in',catalog,presentYear:0}).state,day=routineTime(world);
    const from=world.locations.find(p=>p.name==='Emerald Water City')!;
    const line=publicShipLinesFrom(world,from.name,day).find(l=>l.runsFromDay===null&&l.days>2)!;
    const to=world.locations.find(p=>p.name===line.to)!,quote=quotePublicPassage(world,from.id,to.id,day)!;
    const buyer=createNpc(world.seed,{id:'native-paying-passenger',locationId:from.id,onDay:day,bornOnDay:day-9000});buyer.spiritStones=1000;world.npcs.push(buyer);
    const master=ensureShipCrew(world,line.lane,from.id,day).find(p=>p.identity.occupation==='shipmaster')!;
    return {world,day,from,to,line,quote,buyer,master,masterPurse:master.spiritStones};
}
for(const historical of [false,true])it('settles one actual personal payment and hand-in; later contact='+historical,()=>{
    const h=prepared();const accepted=startNpcPassage(h.world.locations,h.buyer,{lane:h.line.lane,destinationId:h.to.id,onDay:h.day,
        days:h.quote.days,fareStones:h.quote.fareStones,purpose:'Taking the paid public passage.'})!;expect(accepted).toBeTruthy();
    h.world.npcs[h.world.npcs.findIndex(p=>p.id===h.buyer.id)]=accepted;
    if(historical){h.world.currentDay=h.day+Math.min(1,h.quote.days/2);h.world.currentHour=(h.world.currentDay%1)*24;}
    const spy=vi.spyOn(possessions,'transferPossession');
    expect(commitNpcPublicPassage(h.world,h.world.npcs.find(p=>p.id===h.buyer.id)!)).toBe(true);
    expect(h.world.npcs.find(p=>p.id===h.buyer.id)!.spiritStones).toBe(1000-h.quote.fareStones);
    expect(h.world.npcs.find(p=>p.id===h.master.id)!.spiritStones).toBe(h.masterPurse+h.quote.fareStones);
    const hand=spy.mock.calls.find(([o,change])=>o.tags.includes('passage-tally')&&change.toHolderId===h.master.id);expect(hand).toBeTruthy();
    expect(hand![1].onDay).toBe(h.day);expect(spy.mock.results[spy.mock.calls.indexOf(hand!)]!.value.possessorId).toBe(h.master.id);
    expect(h.world.objects.some(o=>o.tags.includes('passage-tally'))).toBe(false);
    const purchases=h.world.history.facts.filter(f=>f.data.passageTallyPurchase===true&&f.actors.some(a=>a.id===h.buyer.id&&a.role==='buyer'));expect(purchases).toHaveLength(1);
    expect(purchases[0]!.data.stones).toBe(h.quote.fareStones);
    expect(commitNpcPublicPassage(h.world,h.world.npcs.find(p=>p.id===h.buyer.id)!)).toBe(true);
    expect(h.world.npcs.find(p=>p.id===h.master.id)!.spiritStones).toBe(h.masterPurse+h.quote.fareStones);
    expect(h.world.history.facts.filter(f=>f.data.passageTallyPurchase===true&&f.actors.some(a=>a.id===h.buyer.id&&a.role==='buyer'))).toHaveLength(1);
});
it('allocates an already paid house dispatch to the real carrier once for each member',()=>{
    const h=prepared(),house=h.world.factions[0]!,second=createNpc(h.world.seed,{id:'native-sponsored-passenger',locationId:h.from.id,onDay:h.day,bornOnDay:h.day-9000});
    second.spiritStones=70;h.world.npcs.push(second);house.resources.spirit_stones=500;
    const fare=h.quote.fareStones;house.resources.spirit_stones-=2*fare;
    const dispatch=appendWorldFact(h.world,makeFact({day:h.day,kind:'gathering',visibility:'faction',locationId:h.from.id,factionIds:[house.id],
        actors:[{id:h.buyer.id,name:h.buyer.name,role:'delegate'},{id:second.id,name:second.name,role:'delegate'}],summary:'The house paid public passage for its two delegates.',
        data:{capitalMission:true,publicMission:true,publicFareStones:2*fare,publicPayerId:house.id}}),{bystanders:false,recur:false});
    for(const id of [h.buyer.id,second.id]){
        const at=h.world.npcs.findIndex(p=>p.id===id),person=onSponsoredPublicPassage(h.world,h.world.npcs[at]!,h.quote,'On the funded house errand.')!;
        h.world.npcs[at]={...person,activity:{...person.activity!,capitalMissionId:dispatch.id}};
        expect(commitNpcPublicPassage(h.world,h.world.npcs[at]!)).toBe(true);
    }
    expect(house.resources.spirit_stones).toBe(500-2*fare);expect(h.world.npcs.find(p=>p.id===h.buyer.id)!.spiritStones).toBe(1000);
    expect(h.world.npcs.find(p=>p.id===second.id)!.spiritStones).toBe(70);expect(h.world.npcs.find(p=>p.id===h.master.id)!.spiritStones).toBe(h.masterPurse+2*fare);
    const purchases=h.world.history.facts.filter(f=>f.data.passageTallyPurchase===true&&f.actors.some(a=>[h.buyer.id,second.id].includes(a.id)&&a.role==='buyer'));expect(purchases).toHaveLength(2);
    expect(new Set(purchases.map(f=>f.data.seat)).size).toBe(2);expect(purchases.every(f=>f.causes.includes(dispatch.id))).toBe(true);
    expect(h.world.objects.some(o=>o.tags.includes('passage-tally'))).toBe(false);
});

for(const atSea of [false,true])it('contact settles an already prepaid rates passage without charging again; at sea='+atSea,()=>{
    const h=prepared(),route=h.world.locations.flatMap(from=>publicShipLinesFrom(h.world,from.name,h.day)
        .filter(l=>l.runsFromDay!==null).map(line=>({from,line,to:h.world.locations.find(p=>p.name===line.to)!}))).find(r=>r.to)!;
    expect(route).toBeTruthy();const area=theAreasOf(h.world,route.from).areas.find(a=>a.for==='landing')!;
    const person=createNpc(h.world.seed,{id:'native-future-ticket-buyer',locationId:route.from.id,onDay:h.day,bornOnDay:h.day-9000});person.spiritStones=1000;h.world.npcs.push(person);
    const clerk=createNpc(h.world.seed,{id:'native-future-ticket-clerk',occupation:'shipmaster',locationId:route.from.id,onDay:h.day,bornOnDay:h.day-12000});
    clerk.activity={kind:'trade',note:'Keeping the landing counter.',withIds:[],sinceDay:h.day,untilDay:null,standingIn:area.id};h.world.npcs.push(clerk);
    const booked=bookNpcPassageForRoute(h.world,person,route.to.id,h.day,'Waiting for the public ship.')!;expect(booked).toBeTruthy();
    expect(booked.activity!.sinceDay).toBeGreaterThan(h.day);const at=h.world.npcs.findIndex(p=>p.id===person.id);h.world.npcs[at]=booked;
    expect(commitNpcPublicPassage(h.world,booked)).toBe(false);
    expect(h.world.history.facts.some(f=>f.data.actualBoarding===true&&f.actors.some(a=>a.id===person.id))).toBe(false);
    const master=ensureShipCrew(h.world,route.line.lane,route.from.id,h.day).find(p=>p.identity.occupation==='shipmaster')!,before=master.spiritStones;
    if(atSea){h.world.currentDay=booked.activity!.sinceDay+.25;h.world.currentHour=(h.world.currentDay%1)*24;}
    expect(settleNpcTravelOnContact(h.world,new Set([person.id]))).toBe(true);
    const purchases=h.world.history.facts.filter(f=>f.data.passageTallyPurchase===true&&f.actors.some(a=>a.id===person.id&&a.role==='buyer'));
    expect(purchases).toHaveLength(1);const fare=Number(purchases[0]!.data.fareStones);
    expect(h.world.npcs.find(p=>p.id===person.id)!.spiritStones).toBe(1000-fare);expect(h.world.npcs.find(p=>p.id===master.id)!.spiritStones).toBe(before+fare);
    expect(h.world.npcs.find(p=>p.id===person.id)!.activity?.publicFarePaid).toBeUndefined();
    const ticket=h.world.objects.find(o=>o.possessorId===person.id&&passageTallyTerms(o));
    if(atSea){expect(ticket).toBeUndefined();expect(h.world.npcs.find(p=>p.id===person.id)!.activity?.kind).toBe('travelling');}
    else {expect(ticket).toBeTruthy();expect(h.world.npcs.find(p=>p.id===person.id)!.activity?.passageTallyId).toBe(ticket!.id);}
    expect(settleNpcTravelOnContact(h.world,new Set([person.id]))).toBe(false);
    expect(h.world.npcs.find(p=>p.id===master.id)!.spiritStones).toBe(before+fare);
});

it('keeps fare allocations while their paid mission account is live, then ages them out',()=>{
    const h=prepared(),house=h.world.factions[0]!,fare=h.quote.fareStones;
    house.resources.spirit_stones=500-2*fare;
    const dispatch=appendWorldFact(h.world,makeFact({day:h.day,kind:'gathering',visibility:'faction',locationId:h.from.id,factionIds:[house.id],
        actors:[{id:h.buyer.id,name:h.buyer.name,role:'delegate'}],summary:'The house prepaid its delegate public journey.',
        data:{publicMission:true,publicFareStones:2*fare,publicPayerId:house.id}}),{bystanders:false,recur:false});
    const at=h.world.npcs.findIndex(p=>p.id===h.buyer.id),person=onSponsoredPublicPassage(h.world,h.world.npcs[at]!,h.quote,'On the funded mission.')!;
    h.world.npcs[at]={...person,activity:{...person.activity!,capitalMissionId:dispatch.id}};expect(commitNpcPublicPassage(h.world,h.world.npcs[at]!)).toBe(true);
    const allocation=h.world.history.facts.find(f=>f.data.publicFareFundingId===dispatch.id)!;expect(allocation).toBeTruthy();
    const live=h.world.npcs.findIndex(p=>p.id===h.buyer.id);h.world.npcs[live]={...h.world.npcs[live]!,locationId:h.to.id,
        activity:{kind:'out_with_a_party',note:'Doing the funded mission work.',withIds:[],sinceDay:h.quote.arrivalDay,untilDay:h.day+3*365,capitalMissionId:dispatch.id}};
    h.world.currentDay=h.day+366;keepTheBusinessStillOnTheBooks(h.world);
    expect(h.world.history.facts.some(f=>f.id===allocation.id)).toBe(true);
    h.world.npcs[h.world.npcs.findIndex(p=>p.id===h.buyer.id)]!.activity=null;
    h.world.currentDay+=365;keepTheBusinessStillOnTheBooks(h.world);
    expect(h.world.history.facts.some(f=>f.id===allocation.id)).toBe(false);
});

it('an empty-purse native uses the ordinary gifted held seat without buying another',()=>{
    const h=prepared(),area=theAreasOf(h.world,h.from).areas.find(a=>a.for==='landing')!;
    h.buyer.spiritStones=0;h.buyer.activity={kind:'idle',note:'At the landing counter.',withIds:[],sinceDay:h.day,untilDay:null,standingIn:area.id};
    const giver=createNpc(h.world.seed,{id:'native-ticket-giver',locationId:h.from.id,onDay:h.day,bornOnDay:h.day-9000});giver.spiritStones=100;h.world.npcs.push(giver);
    const offer=offerTheNextPublicShip(h.world,h.from.id,h.to.id)!,ticket=purchaseAcceptedPublicShipTally(h.world,offer,giver,giver,(id,stones,commit)=>{
        h.world.npcs.find(p=>p.id===giver.id)!.spiritStones-=stones;h.world.npcs.find(p=>p.id===id)!.spiritStones+=stones;commit();return true;
    })!;expect(ticket).toBeTruthy();
    h.world.objects[h.world.objects.findIndex(o=>o.id===ticket.id)]=possessions.transferPossession(ticket,{onDay:h.day,toHolderId:h.buyer.id,
        toHolderName:h.buyer.name,how:'gifted',transfersOwnership:true});
    const before=h.world.history.facts.filter(f=>f.data.passageTallyPurchase===true).length;
    const current=h.world.npcs.find(p=>p.id===h.buyer.id)!,waiting=bookNpcPassageForRoute(h.world,current,h.to.id,h.day,'Using the held paid seat.');
    expect(waiting).toBeTruthy();expect(waiting!.spiritStones).toBe(0);expect(waiting!.activity?.passageTallyId).toBe(ticket.id);
    expect(h.world.history.facts.filter(f=>f.data.passageTallyPurchase===true)).toHaveLength(before);
    expect(h.world.objects.find(o=>o.id===ticket.id)?.possessorId).toBe(h.buyer.id);
});


it('replaces a dead hand with a new person when the paid public load boards',()=>{
    const h=prepared(),original=h.world.npcs.filter(p=>p.status==='alive'&&p.tags.includes('crew-of:'+h.quote.vesselId));
    const lost=original.find(p=>p.identity.occupation==='sailor')!;expect(lost).toBeTruthy();
    const offer=offerTheNextPublicShip(h.world,h.from.id,h.to.id)!;expect(offer).toBeTruthy();
    const tally=purchaseAcceptedPublicShipTally(h.world,offer,h.buyer,h.buyer,(id,stones,commit)=>{
        h.world.npcs.find(p=>p.id===h.buyer.id)!.spiritStones-=stones;
        h.world.npcs.find(p=>p.id===id)!.spiritStones+=stones;commit();return true;
    })!;expect(tally).toBeTruthy();
    const lostAt=h.world.npcs.findIndex(p=>p.id===lost.id);
    h.world.npcs[lostAt]=markDead(h.world.npcs[lostAt]!,h.day,'Died ashore after the ticket was sold.');
    h.world.currentDay=h.day+1/24;
    const boarded=boardThePublicShip(h.world,offer.departure,[{id:h.buyer.id,name:h.buyer.name}]);
    expect(boarded).toBeTruthy();
    const living=h.world.npcs.filter(p=>p.status==='alive'&&p.tags.includes('crew-of:'+h.quote.vesselId));
    expect(h.world.npcs.find(p=>p.id===lost.id)?.status).not.toBe('alive');
    expect(living).toHaveLength(original.length);
    const replacements=living.filter(p=>!original.some(one=>one.id===p.id));
    expect(replacements).toHaveLength(1);expect(replacements[0]!.identity.occupation).toBe('sailor');
    expect(boarded!.crew).toBe(original.length);
    for(const survivor of original.filter(p=>p.id!==lost.id))expect(living.some(p=>p.id===survivor.id)).toBe(true);
});
