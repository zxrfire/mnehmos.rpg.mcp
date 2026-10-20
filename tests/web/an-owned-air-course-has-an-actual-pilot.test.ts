/**
 * Oct7 actual-air prototype. A spiritboat used the same walking detour as an
 * ordinary road carrier. This arrangement creates a real ordinary owned hull
 * and an actual factory NPC company/pilot, then asks the shared metric quote.
 * Native passHours owns body, provisions, world events, operator expiry and
 * course arrival. It does not fabricate a hull, an NPC, a route or a landing
 * during resolution. The operator arrangement is explicit; dialogue acceptance
 * is not tested here. SQL death controls inject an actual final-boundary death
 * through the same native world callback as existing body-oracle controls.
 * A dead passenger cannot steer, but a genuine surviving pilot retains custody
 * but its personal purse does not inherit the owner's incremental fuel bill.
 * Both deaths therefore freeze the actual paid reached point in this fixture;
 * the surviving pilot can retain custody without acquiring unpaid motion.
 * These controls arrange the operator rather than test model acceptance.
 * Native04 measured the shared landing assertion against a stale fixture NPC.
 * Diagnostic01 showed actual world day exactly equal its accepted arrival,
 * SQL body and live pilot at the destination, restored company, fraction1 and
 * no stop/interruption. The old immutable pilot still referred to the air site.
 * Both prefix and endpoint checks now ask the actual current pilot row.
 * No duration, projection, landing rule or assertion is relaxed.
 * Oct11's repeated-trip ruling requires the same actual pilot and hull to be
 * available after landing. The repeated-load control uses ordinary accepted
 * legs and played waits; each pays its native fuel and real elapsed time.
 * Its first landing also pays a three-stone Jade Register fee. Both expenses
 * are read from their actual receipts, so registration is not mistaken for fuel.
 */
import { expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { createNpc, setRealm } from '../../src/engine/world/npc-state.js';
import { aVehicleOf, takeItAlong, whoItIsWith } from '../../src/engine/world/a-vehicle.js';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { quoteAnAirJourney } from '../../src/engine/world/what-an-air-journey-takes.js';
import { witnessIndexFor } from '../../src/engine/world/witness-reaction-index.js';
import { LI_PER_WALKING_DAY } from '../../src/engine/world/the-metric-ground-under-a-journey.js';
import { airPositionAt } from '../../src/engine/world/an-air-course-in-the-world.js';
import { acceptOwnedPassage, ownedCarrierAt, peopleUnavailableForOwnedBoarding } from '../../src/web/an-owned-passage.js';
import { locationOnNpcJourney } from '../../src/engine/world/places-on-the-way.js';
import { passHours } from '../../src/web/routine-invitations.js';

async function departure(companion:boolean) {
    const h=await makeGameInWorld({seed:'actual-owned-air',worldSeed:'road-world'});
    await h.game.newRun('Actual air hull owner');
    let now=h.game.currentRun();
    h.repos.cultivators.update(now.cultivator.id,{realmOrdinal:29,spiritStones:10000,hp:1000,maxHp:1000,satiety:100});
    now=h.game.currentRun();
    h.game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
    const world=h.game.atHand,day=routineTime(world),from=worldLocationFor(world,now.cultivator.location);
    if(!from)throw new Error('Actual departure ground absent');
    const bundle=h.game.buyProvisions(now.cultivator,120);
    h.game.putBackWhatWasNotEaten(bundle.cultivator,{endState:{rationsRemaining:bundle.rations}});
    const boat=aVehicleOf({id:'operator-arranged-air-hull',conveyanceId:'conv-spirit-boat',
        ownerId:now.cultivator.id,ownerName:now.cultivator.name,at:from.id});
    world.objects.push(boat);takeItAlong(world.objects,boat,now.cultivator.id);
    let pilot=companion?setRealm(createNpc(world.seed,{id:'operator-arranged-air-pilot',name:'Actual companion',
        onDay:day,bornOnDay:day-40*365,locationId:from.id}),29,day):null;
    if(pilot){pilot.activity={kind:'out_with_a_party',note:'Operator-arranged existing company',
        withIds:[now.cultivator.id],sinceDay:day,untilDay:day+100};world.npcs.push(pilot);}
    const kind=requireConveyance('conv-spirit-boat');
    const choice=world.locations.map(to=>({to,quote:quoteAnAirJourney(world.locations,from.id,to.id,
        kind,boat.power,companion?2:1,{facts:witnessIndexFor(world).byId,onDay:day})}))
        .find(row=>row.to.kind==='settlement'&&!row.to.tags.includes('interior')&&row.quote
            &&row.quote.trips===1&&row.quote.daysOneWay>.25&&row.quote.daysOneWay<10);
    if(!choice?.quote)throw new Error('Actual metric catalog lacks bounded air-hull route');
    now=h.game.currentRun();
    const receiptId=acceptOwnedPassage(h.game,now.run,now.cultivator,{vesselId:boat.id,
        pilotId:pilot?.id??now.cultivator.id,fromId:from.id,toId:choice.to.id,
        walkingDays:choice.quote.distanceLi/LI_PER_WALKING_DAY,days:choice.quote.daysOneWay,
        conveyanceId:kind.id,power:boat.power,companions:pilot?[pilot.id]:[],air:true});
    const site=world.locations.find(place=>place.originFactId===receiptId&&place.tags.includes('air-course'));
    if(!site)throw new Error('Accepted actual hull has no physical air site');
    pilot=pilot&&world.npcs.find(person=>person.id===pilot!.id)!;
    return {...h,world,day,from,to:choice.to,quote:choice.quote,boat,pilot,receiptId,site};
}

/** World advancement replaces NPC rows; retain identity, never a stale body snapshot. */
function actualPilot(h:Awaited<ReturnType<typeof departure>>){
    const world=h.game.atHand,id=h.pilot?.id;
    if(!world||!id)throw new Error('Actual shared hull lost its pilot identity or world');
    const person=world.npcs.find(row=>row.id===id);
    if(!person)throw new Error('Actual shared hull pilot disappeared from the current world');
    return person;
}

it('the same actual pilot carries successive ordinary loads after landing', async () => {
    const h = await departure(true);
    try {
        const craft = requireConveyance('conv-spirit-boat');
        let receiptId = h.receiptId;
        for (let leg = 0; leg < 3; leg++) {
            const from = leg % 2 === 0 ? h.from : h.to;
            const to = leg % 2 === 0 ? h.to : h.from;
            const world = h.game.atHand!;
            const day = routineTime(world);
            const quote = quoteAnAirJourney(world.locations, from.id, to.id, craft, h.boat.power, 2,
                { facts: witnessIndexFor(world).byId, onDay: day });
            expect(quote).not.toBeNull();
            expect(quote!.trips).toBe(1);
            if (leg > 0) {
                expect(peopleUnavailableForOwnedBoarding(world, [h.pilot!.id], from.id, day),
                    JSON.stringify(actualPilot(h).activity)).toEqual([]);
                const now = h.game.currentRun();
                const prior = receiptId;
                receiptId = acceptOwnedPassage(h.game, now.run, now.cultivator, {
                    vesselId: h.boat.id, pilotId: h.pilot!.id, fromId: from.id, toId: to.id,
                    walkingDays: quote!.distanceLi / LI_PER_WALKING_DAY, days: quote!.daysOneWay,
                    conveyanceId: craft.id, power: h.boat.power, companions: [h.pilot!.id],
                    priorReceiptId: prior, air: true
                });
                expect(receiptId).not.toBe(prior);
            }
            const before = h.game.currentRun();
            const beforeFacts = new Set(h.game.atHand!.history.facts.map(fact => fact.id));
            const turn = await h.game.act(`I wait for ${quote!.daysOneWay} days`);
            const after = h.game.currentRun();
            expect(after.cultivator.alive, turn.narration).toBe(true);
            expect(after.cultivator.location, turn.narration).toBe(to.name);
            expect(locationOnNpcJourney(h.game.atHand!.locations, actualPilot(h), routineTime(h.game.atHand!))).toBe(to.id);
            expect(after.run.elapsedDays - before.run.elapsedDays, turn.narration).toBeCloseTo(quote!.daysOneWay, 10);
            const facts = h.game.atHand!.history.facts;
            const fuel = facts.filter(fact => fact.data.airFuelPaidFor === receiptId
                && fact.data.payerId === before.cultivator.id)
                .reduce((sum, fact) => sum + Number(fact.data.stonesDebited), 0);
            const registration = facts.filter(fact => !beforeFacts.has(fact.id)
                && fact.data.gateRegistration === true && fact.data.gateRegistrant === before.cultivator.id)
                .reduce((sum, fact) => sum + Number(fact.data.stones ?? 0), 0);
            expect(fuel).toBe(quote!.stonesBurned);
            expect(before.cultivator.spiritStones - after.cultivator.spiritStones, turn.narration)
                .toBe(fuel + registration);
            expect(whoItIsWith(h.game.atHand!.objects.find(object => object.id === h.boat.id)!)).toBe(after.cultivator.id);
        }
    } finally { h.db.close(); }
}, 120_000);

it('actual shared spiritboat has the same airborne body site and reaches its metric endpoint',async()=>{
    const h=await departure(true);
    try{
        const before=h.game.currentRun();
        const part=await passHours(h.game,before.run,before.cultivator,3);
        expect(part.finished).toBe(true);
        expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBe(.125);
        expect(ownedCarrierAt(h.world,h.receiptId,h.game.currentRun().cultivator,routineTime(h.world))?.locationId).toBe(h.site.id);
        expect(locationOnNpcJourney(h.world.locations,actualPilot(h),routineTime(h.world))).toBe(h.site.id);
        expect(airPositionAt(h.world,h.site,routineTime(h.world))?.kind).toBe('air');
        expect(h.game.currentRun().cultivator.spiritStones).toBeLessThan(before.cultivator.spiritStones);
        const remaining=h.day+h.quote.daysOneWay-routineTime(h.world);
        const arrived=await passHours(h.game,h.game.currentRun().run,h.game.currentRun().cultivator,remaining*24);
        expect(arrived.finished).toBe(true);
        expect(h.game.currentRun().cultivator.location).toBe(h.to.name);
        expect(locationOnNpcJourney(h.world.locations,actualPilot(h),routineTime(h.world))).toBe(h.to.id);
        expect(routineTime(h.world)).toBeCloseTo(h.day+h.quote.daysOneWay,12);
    }finally{h.db.close();}
},180000);

for(const companion of [false,true])it('actual SQL passenger death preserves custody without unfunded motion; companion='+companion,async()=>{
    const h=await departure(companion);
    try{
        const original=h.game.advancePreparedWorld.bind(h.game);
        let consequences=0;
        vi.spyOn(h.game,'advancePreparedWorld').mockImplementation((days,body,run,options)=>{
            const receipt=original(days,body,run,options);
            if(consequences++===0)h.repos.cultivators.markDead(body.id,'lifespan_exhausted',run.turn,
                'Explicit native final-boundary operator consequence');
            return receipt;
        });
        const now=h.game.currentRun();
        const span=await passHours(h.game,now.run,now.cultivator,3);
        expect(span.finished).toBe(false);
        expect(consequences).toBeGreaterThan(0);
        expect(h.game.currentRun().cultivator.alive).toBe(false);
        expect(h.game.currentRun().cultivator.location).toBe(h.site.id);
        const actual=routineTime(h.world),point=airPositionAt(h.world,h.site,actual);
        if(companion)
            expect(whoItIsWith(h.world.objects.find(row=>row.id===h.boat.id)!)).toBe(h.pilot!.id);
        expect(typeof h.site.data.airStoppedFactId).toBe('string');
        expect(airPositionAt(h.world,h.site,actual+100)?.point).toEqual(point?.point);
        expect(airPositionAt(h.world,h.site,actual+100)?.kind).toBe('air');
        // A later date is a read, not proof that a dead player's action advances the world.
        // The actual paid prefix and custody are independently asserted above.
    }finally{h.db.close();}
},180000);
