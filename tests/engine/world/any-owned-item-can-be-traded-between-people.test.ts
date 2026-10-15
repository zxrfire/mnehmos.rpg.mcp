/**
 * Ordinary held-item trade must have no item-kind eligibility list. Catalog
 * prices are evidence for a decision, not permission to offer an item. These
 * native controls pass the same cash/custody writer a manual, medicine, gear,
 * material, key, token, currency, corpse and an uncatalogued personal object.
 * They also check a real native meeting offer, ownership and a price's failure
 * to compel consent. A follow-up found that sale facts replace NPC rows;
 * purse assertions therefore read the current world rows, not fixture handles.
 * No trade outcome or RNG stream is stubbed.
 */
import {expect,it} from 'vitest';
import {tradeAtCapitalExchanges} from '../../../src/engine/world/wares-at-a-capital-exchange';
import {createWorld} from '../../../src/engine/world/world-state';
import {createNpc,addGoal,PLAYER_ROW_TAG} from '../../../src/engine/world/npc-state';
import {makeLocation} from '../../../src/engine/world/locations';
import {makeObject,type ObjectKind} from '../../../src/engine/world/possessions';
import {routineTime} from '../../../src/engine/world/npc-routines';
import {completeHeldItemSale,wouldPartWithHeldItem,wouldBuyHeldItem,heldItemNeed,priceOfferedForHeldItem,
    tradeOwnedItemsAtAMeeting} from '../../../src/engine/world/a-person-is-offered-a-price-for-what-they-hold';

function arrangement(kind:ObjectKind) {
    const world=createWorld({seed:'ordinary-owned-items',skipPriorAges:true,regionCount:0});
    const place=makeLocation({id:'town',name:'A town',kind:'settlement'});world.locations.push(place);
    const now=routineTime(world);
    const seller=createNpc(world.seed,{id:'seller',name:'Seller Wen',locationId:place.id,onDay:now,bornOnDay:now-7300});
    seller.spiritStones=20;
    const object=makeObject({id:'item-'+kind,name:'Held '+kind,kind,ownerId:seller.id,possessorId:seller.id,ownerName:seller.name});
    world.npcs.push(seller);world.objects.push(object);
    return {world,place,now,seller,object};
}
for(const kind of ['manual','pill','artifact','material','key','token','currency','corpse','other'] as const) {
    it(`puts an owned ${kind} to the same real buyer decision and transfers the same row`,()=>{
        const h=arrangement(kind);
        const buyer=Array.from({length:128},(_,i)=>{
            const p=createNpc(h.world.seed,{id:'buyer-'+i,locationId:h.place.id,onDay:h.now,bornOnDay:h.now-7300});p.spiritStones=100;
            return p;
        }).find(p=>wouldBuyHeldItem(h.world,p,h.seller,h.object,7));
        expect(buyer).toBeDefined();h.world.npcs.push(buyer!);
        expect(completeHeldItemSale(h.world,h.object.id,h.seller,buyer!,7,h.place.id,commit=>{
            if(buyer!.spiritStones<7)return false;buyer!.spiritStones-=7;h.seller.spiritStones+=7;commit();return true;
        })).toBe(true);
        expect(h.world.objects).toHaveLength(1);expect(h.world.objects[0]!.id).toBe(h.object.id);
        expect(h.world.objects[0]!.ownerId).toBe(buyer!.id);expect(h.world.objects[0]!.possessorId).toBe(buyer!.id);
        expect(h.world.npcs.find(p=>p.id===h.seller.id)!.spiritStones).toBe(27);
        expect(h.world.npcs.find(p=>p.id===buyer!.id)!.spiritStones).toBe(93);
        expect(h.world.objects[0]!.provenance.at(-1)?.how).toBe('bought');
    });
}
it('a person offers and buys another person?s known wanted inventory item in an ordinary meeting',()=>{
    const h=arrangement('other');
    const buyer=Array.from({length:128},(_,i)=>{
        let p=createNpc(h.world.seed,{id:'wanted-buyer-'+i,locationId:h.place.id,onDay:h.now,bornOnDay:h.now-7300});p.spiritStones=100;
        p=addGoal(p,{kind:'discovery',targetId:h.object.id,text:'Obtain the named object.',priority:1},h.now);
        h.object.knownOwnershipBy.push(p.id);return p;
    }).find(p=>{const offer=priceOfferedForHeldItem(h.world,h.object,h.seller,p);
        return offer&&wouldPartWithHeldItem(h.world,h.seller,p,h.object,offer.stones,heldItemNeed(h.world,h.seller,h.object));});
    expect(buyer).toBeDefined();h.world.npcs.push(buyer!);
    tradeOwnedItemsAtAMeeting(h.world,[h.seller.id,buyer!.id],h.place.id);
    expect(h.world.objects[0]!.possessorId).toBe(buyer!.id);
    expect(h.seller.spiritStones+buyer!.spiritStones).toBe(120);
    expect(h.world.history.facts.some(f=>f.data.heldItemOffer===true)).toBe(true);
    const sale=h.world.history.facts.find(f=>f.data.heldItemSale===true)!;
    expect(sale).toBeDefined();
    expect(h.world.npcs.find(p=>p.id===h.seller.id)!.spiritStones).toBe(20+Number(sale.data.stones));
    expect(h.world.npcs.find(p=>p.id===buyer!.id)!.spiritStones).toBe(100-Number(sale.data.stones));
});
it('more money never replaces the holder?s decision, and the player?s answer is never automatic',()=>{
    const h=arrangement('token'),buyer=createNpc(h.world.seed,{id:'buyer',locationId:h.place.id,onDay:h.now,bornOnDay:h.now-7300});
    const values={replacementStones:5,waitingDays:2,missesTheirPurpose:true};
    const answers=Array.from({length:128},(_,i)=>{
        const seller=createNpc(h.world.seed,{id:'holder-'+i,locationId:h.place.id,onDay:h.now,bornOnDay:h.now-7300});
        const object={...h.object,ownerId:seller.id,possessorId:seller.id};
        return [wouldPartWithHeldItem(h.world,seller,buyer,object,10,values),wouldPartWithHeldItem(h.world,seller,buyer,object,50,values)];
    });
    expect(answers.some(a=>a[0])).toBe(true);expect(answers.some(a=>!a[1])).toBe(true);
    const player={...h.seller,tags:[...h.seller.tags,PLAYER_ROW_TAG]};
    expect(wouldPartWithHeldItem(h.world,player,buyer,h.object,100000,values)).toBe(false);
});
it('a borrowed object cannot be sold as the holder?s own property',()=>{
    const h=arrangement('token'),buyer=createNpc(h.world.seed,{id:'buyer',locationId:h.place.id,onDay:h.now,bornOnDay:h.now-7300});
    h.object.ownerId='somebody-else';let paid=false;
    expect(completeHeldItemSale(h.world,h.object.id,h.seller,buyer,10,h.place.id,()=>{paid=true;return true;})).toBe(false);
    expect(paid).toBe(false);expect(h.world.objects[0]!.possessorId).toBe(h.seller.id);
});

it('the existing seasonal exchange contact also trades owned non-catalogue inventory',()=>{
    const h=arrangement('key');h.place.tags.push('city');
    h.seller.activity={kind:'trade',note:'Trading at the market.',withIds:[],sinceDay:h.now,untilDay:h.now+1};
    const buyer=Array.from({length:128},(_,i)=>{
        let p=createNpc(h.world.seed,{id:'market-buyer-'+i,locationId:h.place.id,onDay:h.now,bornOnDay:h.now-7300});p.spiritStones=100;
        p=addGoal(p,{kind:'discovery',targetId:h.object.id,text:'Obtain the named object.',priority:1},h.now);
        p.activity={kind:'trade',note:'Trading at the market.',withIds:[],sinceDay:h.now,untilDay:h.now+1};
        return p;
    }).find(p=>{const offer=priceOfferedForHeldItem(h.world,{...h.object,knownOwnershipBy:[p.id]},h.seller,p);
        return offer&&wouldPartWithHeldItem(h.world,h.seller,p,h.object,offer.stones,heldItemNeed(h.world,h.seller,h.object));});
    expect(buyer).toBeDefined();h.object.knownOwnershipBy.push(buyer!.id);h.world.npcs.push(buyer!);
    tradeAtCapitalExchanges(h.world,h.now);
    expect(h.world.objects[0]!.possessorId).toBe(buyer!.id);
    expect(h.seller.spiritStones+buyer!.spiritStones).toBe(120);
    const sale=h.world.history.facts.find(f=>f.data.heldItemSale===true)!;
    expect(sale).toBeDefined();
    expect(h.world.npcs.find(p=>p.id===h.seller.id)!.spiritStones).toBe(20+Number(sale.data.stones));
    expect(h.world.npcs.find(p=>p.id===buyer!.id)!.spiritStones).toBe(100-Number(sale.data.stones));
});
