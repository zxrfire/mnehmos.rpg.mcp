import { tradeOwnedItemsAtAMeeting } from './a-person-is-offered-a-price-for-what-they-hold.js';
/** Public counter promises are ordinary appointments on one real carriage. */
import { makeScheduledEffect, type ScheduledEffect, type WorldState } from './world-state.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue } from './witness-reaction-index.js';
import { publicTransportFrom } from './public-transport-at-a-place.js';
import { routineTime } from './npc-routines.js';
import { LOCAL_WALK_DAYS } from './local-walking-cost.js';
import { locationOfNpcOnItsJourney } from './places-on-the-way.js';
import { isRuined, type ObjectRecord } from './possessions.js';
import { whoItIsWith } from './a-vehicle.js';
import { carriageIdForRoad, publicCarriageGround, publicCarriageRoadTerms,
    quotePublicCarriage, commitPublicCarriage, realiseAcceptedPublicCarriageSource,
    type PublicRoadQuote } from './public-carriages.js';
import { passageDepartureKey, passageTalliesForDeparture, passageTallyTerms,
    theHeldPassageTally, makePassageTally, unusedPassageTalliesGoToDust, type TallyDeparture } from './a-passage-tally-is-the-seat-you-own.js';
import { stonesFor } from './the-fare-and-calendar-of-a-passage.js';
import { readActualDepartureApproach } from './departure-approach.js';
import { theAreasOf } from './where-in-a-place-somebody-is-standing.js';
import { companyAgreement } from './company-during-a-passage.js';
import { PLAYER_ROW_TAG, activeGoals, type NpcRecord } from './npc-state.js';

const CARRIAGE = 'conv-carriage-mortal';

export interface PublicCarriageDeparture {
    effect: ScheduledEffect;
    terms: TallyDeparture;
    operatorId: string;
    conveyanceId: string;
    arrivalDay: number;
    fareStones: number;
}

export function carriageDepartureIn(effect: ScheduledEffect): PublicCarriageDeparture | null {
    const d = effect.data;
    if (d.publicCarrierDeparture !== true || d.service !== 'carriage'
        || typeof d.vesselId !== 'string' || typeof d.operatorId !== 'string'
        || typeof d.fromLocationId !== 'string' || typeof d.toLocationId !== 'string'
        || typeof d.arrivalDay !== 'number' || typeof d.fareStones !== 'number'
        || typeof d.conveyanceId !== 'string') return null;
    return { effect, operatorId: d.operatorId, conveyanceId: d.conveyanceId,
        arrivalDay: d.arrivalDay, fareStones: d.fareStones,
        terms: { service: 'carriage', vesselId: d.vesselId, fromId: d.fromLocationId,
            toId: d.toLocationId, departureDay: effect.dueOnDay } };
}

function completed(world: WorldState, id: string): boolean {
    return factsWithDataValue(world, 'publicDepartureCompleted', id).length > 0;
}

export function publicCarriageDepartures(world: WorldState, vesselId?: string): PublicCarriageDeparture[] {
    return world.schedule.flatMap(effect => {
        if (effect.data.publicCarrierDeparture !== true) return [];
        const departure = carriageDepartureIn(effect);
        return departure && (!vesselId || departure.terms.vesselId === vesselId)
            && !completed(world, effect.id) ? [departure] : [];
    }).sort((a, b) => a.terms.departureDay - b.terms.departureDay);
}

function boardings(world: WorldState, departureId: string): readonly HistoricalFact[] {
    return factsWithDataValue(world, 'publicDepartureId', departureId)
        .filter(fact => fact.data.publicPassage === true && fact.data.service === 'carriage');
}

export function freePublicCarriageSeats(world: WorldState, departure: PublicCarriageDeparture): number[] {
    const road = publicCarriageRoadTerms(world, departure.terms.fromId, departure.terms.toId, departure.conveyanceId);
    if (!road) return [];
    const used = new Set(passageTalliesForDeparture(world, departure.terms)
        .map(tally => passageTallyTerms(tally)!.seat));
    for (const receipt of boardings(world, departure.effect.id)) {
        if (typeof receipt.data.passageTallySeats !== 'string') continue;
        const rows: unknown = JSON.parse(receipt.data.passageTallySeats);
        if (Array.isArray(rows)) for (const row of rows) if (typeof row?.seat === 'number') used.add(row.seat);
    }
    return Array.from({ length: road.conveyance.heads - 1 }, (_, at) => at + 1).filter(seat => !used.has(seat));
}

export interface PublicCarriageOffer {
    departure: PublicCarriageDeparture;
    newAppointments: ScheduledEffect[];
    sourceQuote: PublicRoadQuote | null;
    fullDepartureDay: number | null;
    seat: number;
}

/** A quote promises future work; only boarding reads the real body at that time. */
export function offerTheNextPublicCarriage(world: WorldState, fromId: string, toId: string,
    buyerId: string, playedPassenger?: PublicRoadQuote['playedPassenger'],heads=1): PublicCarriageOffer | null {
    const now = routineTime(world), from = world.locations.find(place => place.id === fromId),
        to = world.locations.find(place => place.id === toId);
    if (!from || !to) return null;
    const line = publicTransportFrom(world, from.name, Math.floor(now)).find(line => line.service === 'carriage' && line.to === to.name);
    const road = publicCarriageRoadTerms(world, fromId, toId, CARRIAGE);
    if (!line || !road || !Number.isInteger(heads)||heads<1||heads>road.conveyance.heads-1) return null;
    const vesselId = carriageIdForRoad(fromId, toId, CARRIAGE);
    const vehicle = world.objects.find(object => object.id === vesselId);
    const owner = vehicle ? world.npcs.find(person => person.id === vehicle.ownerId && person.status === 'alive') : undefined;
    if (vehicle && (isRuined(vehicle) || !owner || whoItIsWith(vehicle) !== owner.id)) return null;
    const sourceQuote = vehicle ? null : quotePublicCarriage(world, { fromId, toId, day: now,
        conveyanceId: CARRIAGE, passengerIds: [buyerId], fareStones: stonesFor(line.cashPerSeat),
        hired: false, playedPassenger });
    if (!vehicle && !sourceQuote) return null;
    const operatorId = owner?.id ?? sourceQuote!.driverId;
    const jobs = publicCarriageDepartures(world, vesselId);
    let fullDepartureDay: number | null = null;
    for (const departure of jobs) {
        if (departure.terms.fromId !== fromId || departure.terms.toId !== toId) continue;
        const free = freePublicCarriageSeats(world, departure);
        if (free.length>=heads) return { departure, newAppointments: [], sourceQuote, fullDepartureDay, seat: free[0]! };
        fullDepartureDay ??= departure.terms.departureDay;
    }
    let ready = now, position = vehicle ? publicCarriageGround(world, vehicle, now) : fromId;
    const actual = owner?.activity;
    if (actual?.kind === 'travelling' && actual.vesselId === vesselId && actual.untilDay != null && actual.untilDay > now) {
        ready = actual.untilDay; position = actual.returnTo ?? null;
    }
    const last = jobs.at(-1);
    if (last) { ready = Math.max(ready, last.arrivalDay); position = last.terms.toId; }
    if (position !== fromId && position !== toId) return null;
    const additions: ScheduledEffect[] = [];
    const propose = (originId: string, destinationId: string, leaves: number): PublicCarriageDeparture | null => {
        const origin = world.locations.find(place => place.id === originId)!, destination = world.locations.find(place => place.id === destinationId)!;
        const terms = publicCarriageRoadTerms(world, originId, destinationId, CARRIAGE);
        const offered = publicTransportFrom(world, origin.name, Math.floor(leaves))
            .find(line => line.service === 'carriage' && line.to === destination.name);
        if (!terms || !offered) return null;
        const departure: TallyDeparture = { service: 'carriage', vesselId, fromId: originId, toId: destinationId, departureDay: leaves };
        const effect = makeScheduledEffect({ id: 'public-departure:' + passageDepartureKey(departure),
            kind: 'meeting', dueOnDay: leaves, locationId: originId, actorIds: [operatorId, buyerId],
            summary: 'The accepted public carriage departure falls due.',
            data: { publicCarrierDeparture: true, service: 'carriage', vesselId, operatorId,
                fromLocationId: originId, toLocationId: destinationId,
                conveyanceId: CARRIAGE, arrivalDay: leaves + terms.days, fareStones: stonesFor(offered.cashPerSeat) } });
        additions.push(effect);
        return carriageDepartureIn(effect)!;
    };
    // The usual gathering walk is also the loading window for this ordinary run.
    if (position !== fromId) {
        const back = propose(position!, fromId, ready + LOCAL_WALK_DAYS);
        if (!back) return null;
        ready = back.arrivalDay;
    }
    const departure = propose(fromId, toId, ready + LOCAL_WALK_DAYS);
    return departure ? { departure, newAppointments: additions, sourceQuote, fullDepartureDay, seat: 1 } : null;
}

/** Acceptance publishes the ordinary appointments; it changes no passenger's place. */
export function acceptPublicCarriageOffer(world: WorldState, offer: PublicCarriageOffer,publish=true): NpcRecord | null {
    const source = offer.sourceQuote ? realiseAcceptedPublicCarriageSource(world, offer.sourceQuote) : null;
    const driver = source?.driver ?? world.npcs.find(person => person.id === offer.departure.operatorId && person.status === 'alive');
    if (!driver) return null;
    if(!publish)return driver;
    for (const effect of offer.newAppointments) if (!world.schedule.some(old => old.id === effect.id)) world.schedule.push(effect);
    const next = publicCarriageDepartures(world, offer.departure.terms.vesselId)[0];
    if (next) {
        const at = world.npcs.findIndex(person => person.id === driver.id);
        const activity = driver.activity ?? { kind: 'idle' as const, note: 'At the carriage station.', withIds: [], sinceDay: routineTime(world), untilDay: null };
        world.npcs[at] = { ...driver, activity: { ...activity, publicDepartureId: next.effect.id } };
        if (activity.kind !== 'travelling' && next.terms.departureDay - routineTime(world) <= LOCAL_WALK_DAYS) {
            const station = theAreasOf(world, world.locations.find(place => place.id === next.terms.fromId)!).areas
                .find(area => area.for === 'carriage_station');
            world.npcs[at]!.activity = { ...world.npcs[at]!.activity!, kind: 'trade',
                note: 'Receiving passengers before the carriage departure.', sinceDay: routineTime(world),
                untilDay: next.terms.departureDay, standingIn: station?.id ?? null };
        }
    }
    return world.npcs.find(person => person.id === driver.id)!;
}

export function waitForThePublicCarriage(world: WorldState, person: NpcRecord, tally: ObjectRecord): void {
    if (person.tags.includes(PLAYER_ROW_TAG)) return;
    const terms = passageTallyTerms(tally)!;
    const at = world.npcs.findIndex(candidate => candidate.id === person.id);
    const company = companyAgreement(person.activity, routineTime(world));
    world.npcs[at] = { ...person, activity: { kind: 'waiting_for_a_departure',
        note: 'Waiting to use the bought passage tally.',
        withIds: company?.withIds ?? [], sinceDay: routineTime(world), untilDay: terms.departureDay,
        returnTo: terms.toId, passageTallyId: tally.id,
        publicDepartureId: 'public-departure:' + passageDepartureKey(terms), standingIn: person.activity?.standingIn,
        ...(person.activity?.capitalMissionId ? { capitalMissionId: person.activity.capitalMissionId,
            capitalMissionLeg: person.activity.capitalMissionLeg, capitalMissionWaiting: person.activity.capitalMissionWaiting } : {}),
        ...(company ? { passageCompany: company } : {}) } };
}

/** One accepted paid counter commit, shared by actual SQL and native purses. */
export function purchaseAcceptedPublicCarriageTally(world:WorldState,offer:PublicCarriageOffer,
    buyer:{id:string;name:string},payer:{id:string;name:string},
    pay:(carrierId:string,stones:number,commit:()=>void)=>boolean,witnessIds:readonly string[]=[]):ObjectRecord|null {
    if(!freePublicCarriageSeats(world,offer.departure).includes(offer.seat)||buyer.id===offer.departure.operatorId)return null;
    const driver=acceptPublicCarriageOffer(world,offer,false);if(!driver)return null;
    let tally:ObjectRecord|null=null;
    const paid=pay(driver.id,offer.departure.fareStones,()=>{
        acceptPublicCarriageOffer(world,offer);
        const t=offer.departure.terms;
        const purchase=appendWorldFact(world,makeFact({day:routineTime(world),kind:'gathering',visibility:'secret',
            locationId:t.fromId,witnessIds:[...witnessIds],
            actors:[{...buyer,role:'buyer'},{...payer,role:'payer'},{id:driver.id,name:driver.name,role:'carrier'}],
            summary:'A passage tally was bought for its named public carriage departure.',
            data:{passageTallyPurchase:true,publicDepartureId:offer.departure.effect.id,
                service:t.service,vesselId:t.vesselId,fromLocationId:t.fromId,toLocationId:t.toId,
                departureDay:t.departureDay,seat:offer.seat,fareStones:offer.departure.fareStones,
                stones:buyer.id===payer.id?offer.departure.fareStones:0,payerId:payer.id,receiverId:driver.id}}),
            {bystanders:false,recur:false});
        tally=makePassageTally({terms:{...t,seat:offer.seat,fareStones:offer.departure.fareStones},buyer,purchase,
            onDay:routineTime(world),fromName:world.locations.find(p=>p.id===t.fromId)!.name,
            toName:world.locations.find(p=>p.id===t.toId)!.name});
        world.objects.push(tally);
        const person=world.npcs.find(p=>p.id===buyer.id);if(person)waitForThePublicCarriage(world,person,tally);
    });
    return paid?tally:null;
}

export function quoteBoardingThePublicCarriage(world: WorldState, departure: PublicCarriageDeparture,
    ids: readonly string[], playedPassenger?: PublicRoadQuote['playedPassenger']): PublicRoadQuote | null {
    const day = Math.max(routineTime(world), departure.terms.departureDay);
    return quotePublicCarriage(world, { fromId: departure.terms.fromId, toId: departure.terms.toId,
        day, conveyanceId: departure.conveyanceId, passengerIds: ids, fareStones: 0, hired: false,
        actualVesselId: departure.terms.vesselId, publicDepartureId: departure.effect.id,
        tallyDepartureDay: departure.terms.departureDay, playedPassenger });
}

/** Continue an accepted native route intention after its held seat changes hands. */
export function settleNativeCarriageTallyIntentions(world:WorldState,day=routineTime(world),contactedIds?:ReadonlySet<string>):boolean {
    const departures=publicCarriageDepartures(world);if(!departures.length)return false;
    let changed=false;
    const byId=new Map(departures.map(d=>[d.effect.id,d]));
    const people=world.npcs.filter(p=>p.status==='alive'&&!p.tags.includes(PLAYER_ROW_TAG)
        &&p.activity?.kind==='waiting_for_a_departure'&&p.activity.passageTallyId
        &&(!contactedIds||contactedIds.has(p.id))).map(p=>p.id);
    for(const id of people) {
        const person=world.npcs.find(p=>p.id===id)!,doing=person.activity!;
        const original=byId.get(doing.publicDepartureId??'');if(!original)continue;
        const old=world.objects.find(o=>o.id===doing.passageTallyId);
        if(old?.possessorId===id)continue;
        const station=theAreasOf(world,world.locations.find(p=>p.id===original.terms.fromId)!).areas.find(a=>a.for==='carriage_station');
        if(readActualDepartureApproach(world,id,{intentId:'continue-paid-public-route',target:{locationId:original.terms.fromId,areaId:station?.id??null}},day).kind!=='ready')continue;
        const offer=offerTheNextPublicCarriage(world,original.terms.fromId,original.terms.toId,id);
        if(!offer||person.spiritStones<offer.departure.fareStones)continue;
        const operator=world.npcs.find(p=>p.id===offer.departure.operatorId&&p.status==='alive');
        if(operator&&locationOfNpcOnItsJourney(world,operator,day)!==original.terms.fromId)continue;
        const actualArea=station?theAreasOf(world,world.locations.find(p=>p.id===original.terms.fromId)!,undefined,{id,standingIn:station.id}):null;
        const witnesses=actualArea?[...actualArea.whereIs].filter(([,area])=>area===station!.id).map(([p])=>p):[];
        const bought=purchaseAcceptedPublicCarriageTally(world,offer,person,person,(carrierId,stones,commit)=>{
            const payer=world.npcs.find(p=>p.id===id)!,carrier=world.npcs.find(p=>p.id===carrierId);
            if(!carrier||payer.spiritStones<stones)return false;
            payer.spiritStones-=stones;carrier.spiritStones+=stones;commit();return true;
        },witnesses);
        changed ||= !!bought;
    }
    return changed;
}

/** One event per bought run; there is no daily or indefinitely repeating loop. */
export function settleDuePublicCarriages(world: WorldState, day = routineTime(world)): void {
    settleNativeCarriageTallyIntentions(world,day);
    for (const departure of publicCarriageDepartures(world)) {
        if (departure.terms.departureDay > day) continue;
        const driver = world.npcs.find(person => person.id === departure.operatorId && person.status === 'alive');
        const hull = world.objects.find(object => object.id === departure.terms.vesselId);
        if (!driver || !hull || isRuined(hull) || hull.ownerId !== driver.id || whoItIsWith(hull) !== driver.id) continue;
        const existing = boardings(world, departure.effect.id);
        let receipt = existing.find(fact => fact.actors.some(actor => actor.role === 'passenger'));
        const station = theAreasOf(world, world.locations.find(place => place.id === departure.terms.fromId)!).areas
            .find(area => area.for === 'carriage_station');
        const atCounter = world.npcs.filter(person => person.status === 'alive' && !person.tags.includes(PLAYER_ROW_TAG)
            && readActualDepartureApproach(world, person.id,
                { intentId: departure.effect.id, target: { locationId: departure.terms.fromId, areaId: station?.id ?? null } }, day).kind === 'ready');
        tradeOwnedItemsAtAMeeting(world, atCounter.map(person => person.id), departure.terms.fromId, day);
        settleNativeCarriageTallyIntentions(world,day,new Set(atCounter.map(p=>p.id)));
        const passengers = atCounter.map(p=>world.npcs.find(current=>current.id===p.id)!)
            .filter(person => theHeldPassageTally(world, person.id, departure.terms)
            && (person.activity?.kind==='waiting_for_a_departure'&&person.activity.returnTo===departure.terms.toId
                || activeGoals(person).some(goal=>goal.targetId===departure.terms.toId)
                    && theHeldPassageTally(world,person.id,departure.terms)?.provenance.at(-1)?.how==='bought')
            && readActualDepartureApproach(world, person.id,
                { intentId: departure.effect.id, target: { locationId: departure.terms.fromId, areaId: station?.id ?? null } }, day).kind === 'ready');
        if (passengers.length || !receipt) {
            const quote = quoteBoardingThePublicCarriage(world, departure, passengers.map(person => person.id));
            if (!quote) continue;
            receipt = commitPublicCarriage(world, quote) ?? undefined;
            if (!receipt) continue;
        } else {
            if (driver.activity?.publicDepartureId !== departure.effect.id
                || driver.activity.kind !== 'travelling' || driver.activity.sinceDay > day) continue;
            unusedPassageTalliesGoToDust(world, departure.terms, departure.terms.departureDay);
        }
        const at = world.npcs.findIndex(person => person.id === driver.id);
        const current = world.npcs[at]!;
        if (current.activity) world.npcs[at] = { ...current, activity: { ...current.activity,
            note: 'Driving the carriage on its scheduled public road passage.', publicDepartureId: undefined } };
        appendWorldFact(world, makeFact({ day: Math.max(departure.terms.departureDay, Number(receipt.data.departureDay)),
            kind: 'gathering', visibility: 'public', locationId: departure.terms.fromId,
            actors: [{ id: driver.id, name: driver.name, role: 'driver' }], causes: [receipt.id],
            summary: 'The carriage left for its accepted public destination.',
            data: { publicCarrierDeparture: true, publicDepartureCompleted: departure.effect.id,
                boardingReceiptId: receipt.id } }), { recur: false });
        // The completed appointment leaves the ordinary queue. Its actual
        // departure is already a fact; forgotten paperwork cannot replay it.
        world.schedule = world.schedule.filter(effect => effect.id !== departure.effect.id);
        const next = publicCarriageDepartures(world, departure.terms.vesselId)[0];
        if (next && world.npcs[at]!.activity) world.npcs[at]!.activity!.publicDepartureId = next.effect.id;
        for (let personAt = 0; personAt < world.npcs.length; personAt++) {
            const person = world.npcs[personAt]!;
            if (person.activity?.kind !== 'waiting_for_a_departure' || person.activity.publicDepartureId !== departure.effect.id) continue;
            world.npcs[personAt] = { ...person, activity: companyAgreement(person.activity, day) };
        }
    }
}
