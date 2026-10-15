/** Physical passage tallies use the ordinary object and possession machinery.
 * The caller accepts the ordinary departure, seat and payment before issuing
 * a tally, and accepts the actual boarding before handing it in. Only an
 * actual departure triggers expiry; the date printed on a tally is no timer.
 */
import { makeObject, isRuined, transferPossession, type ObjectRecord } from './possessions.js';
import { madeTokensGoToDust, theTokenWentToDust } from './a-made-token-goes-to-dust.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue, witnessIndexFor } from './witness-reaction-index.js';
import type { WorldState } from './world-state.js';
import { hourOnTheClock, routineTime } from './npc-routines.js';
import { locationOfNpcOnItsJourney } from './places-on-the-way.js';

export interface TallyDeparture {
    service: 'ship' | 'carriage' | 'spirit_boat' | 'air' | 'portal';
    vesselId: string;
    fromId: string;
    toId: string;
    departureDay: number;
}

export interface PassageTallyTerms extends TallyDeparture {
    seat: number;
    fareStones: number;
}

/** One identity for the same ordinary departure, independent of its passenger. */
export function passageDepartureKey(departure: TallyDeparture): string {
    return JSON.stringify([departure.service, departure.vesselId, departure.fromId,
        departure.toId, departure.departureDay]);
}

const TALLY_SLOTS = new WeakMap<readonly ObjectRecord[], {
    length: number; tail: ObjectRecord | undefined; slots: { at: number; id: string }[];
}>();

/** Issuance appends items; deletion publishes the changed collection. Custody
 * changes keep their ids and are read from the current row, never cached. */
function physicalTallies(objects: readonly ObjectRecord[]): ObjectRecord[] {
    let read = TALLY_SLOTS.get(objects);
    if (!read || objects.length < read.length || objects[read.length - 1] !== read.tail
        || read.slots.some(slot => objects[slot.at]?.id !== slot.id)) {
        read = { length: 0, tail: undefined, slots: [] };
        TALLY_SLOTS.set(objects, read);
    }
    for (let at = read.length; at < objects.length; at++) {
        const object = objects[at]!;
        if (object.kind === 'token' && object.tags.includes('passage-tally')) read.slots.push({ at, id: object.id });
    }
    read.length = objects.length; read.tail = objects.at(-1);
    return read.slots.map(slot => objects[slot.at]!);
}

/** A tracked item states the accepted seat; it creates no departure or payment. */
export function makePassageTally(input: {
    terms: PassageTallyTerms;
    buyer: { id: string; name: string };
    fromName: string;
    toName: string;
    onDay: number;
    purchase: HistoricalFact;
}): ObjectRecord {
    const t = input.terms;
    if (!Number.isInteger(t.seat) || t.seat < 1 || !Number.isFinite(t.departureDay)
        || !Number.isFinite(t.fareStones) || t.fareStones < 0 || !Number.isFinite(input.onDay)
        || !t.vesselId || !t.fromId || !t.toId || t.fromId === t.toId
        || input.purchase.data.passageTallyPurchase !== true
        || !input.purchase.actors.some(actor => actor.id === input.buyer.id && actor.role === 'buyer')
        || input.purchase.data.vesselId !== t.vesselId || input.purchase.data.service !== t.service
        || input.purchase.data.fromLocationId !== t.fromId || input.purchase.data.toLocationId !== t.toId
        || input.purchase.data.departureDay !== t.departureDay || input.purchase.data.seat !== t.seat
        || input.purchase.data.fareStones !== t.fareStones)
        throw new Error('A passage tally needs its accepted departure, seat, fare and purchase.');
    const name = 'Passage tally for ' + input.fromName + ' to ' + input.toName
        + ', departure day ' + Math.floor(t.departureDay) + ' at '
        + hourOnTheClock((t.departureDay - Math.floor(t.departureDay)) * 24) + ', seat ' + t.seat;
    const object = makeObject({ id: 'passage-tally:' + input.purchase.id,
        name, kind: 'token', significance: 'notable', ownerId: input.buyer.id,
        ownerName: input.buyer.name, possessorId: input.buyer.id,
        tags: ['made-token', 'passage-tally'],
        data: { passageTally: true, service: t.service,
            vesselId: t.vesselId, fromLocationId: t.fromId, toLocationId: t.toId,
            departureDay: t.departureDay, seat: t.seat, fareStones: t.fareStones } });
    object.provenance.push({ onDay: input.onDay, holderId: input.buyer.id,
        holderName: input.buyer.name, how: 'bought', source: input.fromName,
        previousHolderId: null, previousHolderName: null,
        factId: input.purchase.id, note: 'The accepted passage seat.' });
    return object;
}

export function passageTallyTerms(object: ObjectRecord): PassageTallyTerms | null {
    const d = object.data;
    if (object.kind !== 'token' || !object.tags.includes('passage-tally') || d.passageTally !== true
        || typeof d.service !== 'string' || !['ship', 'carriage', 'spirit_boat', 'air', 'portal'].includes(d.service)
        || typeof d.vesselId !== 'string' || typeof d.fromLocationId !== 'string'
        || typeof d.toLocationId !== 'string' || typeof d.departureDay !== 'number'
        || !Number.isFinite(d.departureDay) || typeof d.seat !== 'number'
        || !Number.isInteger(d.seat) || d.seat < 1 || typeof d.fareStones !== 'number'
        || !Number.isFinite(d.fareStones) || d.fareStones < 0) return null;
    return { service: d.service as TallyDeparture['service'], vesselId: d.vesselId,
        fromId: d.fromLocationId, toId: d.toLocationId, departureDay: d.departureDay,
        seat: d.seat, fareStones: d.fareStones };
}

/** Physical seats remain reserved even when their items are lost or transferred. */
export function passageTalliesForDeparture(state: { objects: readonly ObjectRecord[] },
    departure: TallyDeparture): ObjectRecord[] {
    const key = passageDepartureKey(departure);
    return physicalTallies(state.objects).filter(object => {
        if (isRuined(object)) return false;
        const terms = passageTallyTerms(object);
        return terms !== null && passageDepartureKey(terms) === key;
    });
}

/** A boarding body uses at most one of the actual tallies in its custody. */
export function passageTallySeatsForBoarding(state: { objects: readonly ObjectRecord[] },
    departure: TallyDeparture, boardingIds: ReadonlySet<string>): { used: number; other: number } {
    const used = new Set<string>();
    let other = 0;
    for (const tally of passageTalliesForDeparture(state, departure)) {
        const holder = tally.possessorId;
        if (holder && boardingIds.has(holder) && !used.has(holder)) used.add(holder);
        else other++;
    }
    return { used: used.size, other };
}

/** Custody supplies the seat, including a given, bought or stolen tally. */
export function theHeldPassageTally(state: Pick<WorldState, 'objects' | 'history'>, holderId: string,
    departure: TallyDeparture): ObjectRecord | null {
    return passageTalliesForDeparture(state, departure).find(object => object.possessorId === holderId) ?? null;
}

/** A real receiver must be alive and present at the actual boarding. */
export function whatStopsHandingInPassageTally(state: WorldState, holderId: string,
    departure: TallyDeparture, receiverId: string | null,onDay=routineTime(state)): string | null {
    if (!theHeldPassageTally(state, holderId, departure))
        return 'You do not hold a passage tally for that departure.';
    const receiver = state.npcs.find(person => person.id === receiverId && person.status === 'alive');
    if (!receiver || receiver.id === holderId || receiver.identity.bornOnDay > onDay)
        return 'Nobody is here to receive that passage tally.';
    if (locationOfNpcOnItsJourney(state, receiver, onDay) !== departure.fromId)
        return 'The person receiving that passage tally is not at this departure.';
    return null;
}

/** Boarding hands the tally to its real receiver, then consumes their item. */
export function handInPassageTally(state: WorldState, holderId: string,
    departure: TallyDeparture, receiverId: string | null,onDay=routineTime(state)): PassageTallyTerms | null {
    if (whatStopsHandingInPassageTally(state, holderId, departure, receiverId,onDay)) return null;
    const object = theHeldPassageTally(state, holderId, departure);
    if (!object) return null;
    const terms = passageTallyTerms(object)!;
    const receiver = state.npcs.find(person => person.id === receiverId)!;
    const handed = transferPossession(object, { onDay,
        toHolderId: receiver.id, toHolderName: receiver.name, how: 'gifted',
        transfersOwnership: true, note: 'The passage tally was handed in at boarding.' });
    state.objects[state.objects.indexOf(object)] = handed;
    madeTokensGoToDust(state.objects, new Set([handed.id]));
    state.objects = [...state.objects];
    return terms;
}

/** The holder's own acquisition cost, read from its ordinary provenance. */
function whatTheHeldTallyCost(state: WorldState, object: ObjectRecord, holderId: string): number {
    const acquired = [...object.provenance].reverse().find(link => link.holderId === holderId);
    if (acquired?.how !== 'bought') return 0;
    const payment = acquired.factId ? witnessIndexFor(state).byId.get(acquired.factId) : undefined;
    const paid = payment?.data.stones ?? payment?.data.fareStones;
    return typeof paid === 'number' && Number.isFinite(paid) && paid >= 0
        ? paid : 0;
}

/** Only the actual departure calls this; no daily or general item sweep. */
export function unusedPassageTalliesGoToDust(state: WorldState, departure: TallyDeparture,
    leavesOnDay: number): ObjectRecord[] {
    const ids = new Set(passageTalliesForDeparture(state, departure).map(object => object.id));
    if (!ids.size) return [];
    const dust = madeTokensGoToDust(state.objects, ids);
    // A departure may also realise a hull. Publish the changed collection even
    // when additions and deletions leave its length unchanged for another read.
    if (dust.length) state.objects = [...state.objects];
    const aboard = new Set([...factsWithDataValue(state, 'departureDay', departure.departureDay),
        ...factsWithDataValue(state, 'tallyDepartureDay', departure.departureDay)]
        .filter(fact => fact.data.publicPassage === true && fact.data.vesselId === departure.vesselId
            && fact.data.fromLocationId === departure.fromId && fact.data.toLocationId === departure.toId
            && fact.day <= leavesOnDay && (fact.data.service === 'carriage' || fact.data.actualBoarding === true))
        .flatMap(fact => fact.actors.filter(actor => actor.role === 'passenger' || actor.role === 'aboard')
            .map(actor => actor.id)));
    for (const object of dust) {
        const holderId = object.possessorId ?? object.ownerId;
        const holder = holderId ? state.npcs.find(person => person.id === holderId) : undefined;
        const heldName = [...object.provenance].reverse().find(link => link.holderId === holderId)?.holderName;
        const terms = passageTallyTerms(object)!;
        const boarded = holderId !== null && aboard.has(holderId);
        const actors = holderId ? [{ id: holderId, name: holder?.name ?? heldName ?? object.ownerName,
            role: boarded ? 'unused tally holder' : 'missed passenger' }] : [];
        const data: HistoricalFact['data'] = { unusedPassageTally: true,
            missedDeparture: !boarded, madeTokenDust: true,
            tokenId: object.id, tokenName: object.name,
            service: departure.service, vesselId: departure.vesselId,
            fromLocationId: departure.fromId, toLocationId: departure.toId,
            departureDay: departure.departureDay, leftOnDay: leavesOnDay,
            fareStones: terms.fareStones, costStones: holderId ? whatTheHeldTallyCost(state, object, holderId) : 0,
            carriedById: object.possessorId };
        appendWorldFact(state, makeFact({ day: leavesOnDay, kind: 'object_destroyed',
            visibility: 'secret', locationId: departure.fromId, actors,
            witnessIds: object.possessorId ? [object.possessorId] : [],
            summary: theTokenWentToDust(object.name, true), data }), { bystanders: false, recur: false });
    }
    return dust;
}
