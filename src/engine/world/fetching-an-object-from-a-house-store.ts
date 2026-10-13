/**
 * A service carries the existing object through ordinary
 * travel. No reservation, job table, copied position or SQL authority lives here.
 */
import type { WorldState } from './world-state.js';
import type { WhatTheyMeanToDo } from '../social-leverage/who-has-to-agree-before-it-leaves-the-store.js';
import { type NpcRecord, type NpcActivity, setLocation } from './npc-state.js';
import { type ObjectRecord, type HowItIsHad, isRuined, hadAs, transferPossession } from './possessions.js';
import { type HistoricalFact, type HistoricalActor, type PendingFact, makeFact } from './history.js';
import { walkingDaysFrom, walkingRouteFrom, type RouteQueries } from './locations.js';
import { locationOfNpcOnItsJourney } from './places-on-the-way.js';
import { readPhysicalRetrievals, type PhysicalRetrievalRead } from './reading-a-physical-store-retrieval.js';

export interface RetrievalIntent {
    requesterId: string;
    carrierId: string;
    objectId: string;
    houseId: string;
    storeId: string;
    meetingId: string;
    meetingAreaId: string;
    meaning: WhatTheyMeanToDo;
}

/** A real person read at THIS boundary; unavailable is not dead or absent. */
export type RetrievalRecipient =
    | { kind: 'unavailable' }
    | { kind: 'dead' }
    | { kind: 'absent' }
    | { kind: 'present'; id: string; name: string; groundId: string | null; areaId: string | null };

/**
 * These callbacks forward existing canonical readers, not policy switches.
 * approval: whetherItLeavesTheStore with fresh roll, portfolios and ledger;
 * entry: reachThrough/pathTo with real body, actually held keys and enteredAt
 * set to the actual admitted departure ground (ordinary exit contract);
 * packing: whereItWouldGo with actual held rows/countable pouch/capacity.
 * The recipient callback is after true-time passenger projection. No callback
 * may capture a roster, body, keys or approval from acceptance or end-of-span.
 */
export interface RetrievalAuthority {
    approval(state: WorldState, actor: NpcRecord, intent: RetrievalIntent, at: number):
        { allowed: boolean; reason: string };
    entry(state: WorldState, actor: NpcRecord, storeId: string, at: number):
        { allowed: boolean; reason: string };
    packing(state: WorldState, personId: string, object: ObjectRecord, at: number):
        { allowed: true; how: HowItIsHad } | { allowed: false; reason: string };
    recipient(state: WorldState, id: string, at: number): RetrievalRecipient;
    /** Normal canonical placement, not an invitation or a fabricated meeting position. */
    carrierArea(state: WorldState, actor: NpcRecord, at: number): string | null;
    /** Existing finite local walk into the accepted area; never an instant handover.
     * null: no genuine reachable approach. Callback reuses native area/access/clock.
     */
    approachArea?(state: WorldState, actor: NpcRecord, intent: RetrievalIntent, at: number): NpcRecord | null;
}

export interface RetrievalDelta {
    people: NpcRecord[];
    objects: ObjectRecord[];
    facts: PendingFact[];
    /** Real ordinary-activity deadlines only; pending delivery has no timer. */
    due: { personId: string; at: number }[];
}

type LinkedActivity = NpcActivity & { retrievalRequestId?: string };
const none = (): RetrievalDelta => ({ people: [], objects: [], facts: [], due: [] });

export function intentOfRetrieval(fact: HistoricalFact | null): RetrievalIntent | null {
    if (!fact || fact.data.physicalStoreRetrieval !== true) return null;
    const d = fact.data;
    for (const k of ['requesterId', 'carrierId', 'objectId', 'houseId', 'storeId', 'meetingId', 'meetingAreaId'])
        if (typeof d[k] !== 'string' || !d[k]) return null;
    if (d.meaning !== 'use_it_and_return_it' && d.meaning !== 'pass_it_on' && d.meaning !== 'use_it_up') return null;
    return { requesterId: d.requesterId as string, carrierId: d.carrierId as string,
        objectId: d.objectId as string, houseId: d.houseId as string, storeId: d.storeId as string,
        meetingId: d.meetingId as string, meetingAreaId: d.meetingAreaId as string, meaning: d.meaning };
}

export function retrievalIntentFact(intent: RetrievalIntent, at: number, actors: HistoricalActor[]): PendingFact {
    return makeFact({ day: at, kind: 'gathering', visibility: 'regional',
        actors, factionIds: [intent.houseId],
        locationId: intent.meetingId, summary: 'A person agreed to fetch a named house object.',
        data: { physicalStoreRetrieval: true, ...intent } });
}

function event(actor: NpcRecord, id: string, at: number, reason: string, terminal: boolean): PendingFact {
    return makeFact({ day: at, kind: 'gathering', actors: [{ id: actor.id, name: actor.name, role: 'carrier' }], locationId: actor.locationId,
        causes: [id], summary: reason,
        data: { retrievalRequestId: id, retrievalClosed: terminal, retrievalDeliveryStopped: !terminal } });
}

function leg(state: WorldState, actor: NpcRecord, from: string, to: string, at: number,
    id: string, objectId: string | null, authority: RetrievalAuthority, routes?: RouteQueries): NpcRecord | null {
    const route = walkingRouteFrom(state.locations, from, to, routes);
    if (!route) return null;
    const hop = route[1] ?? route[0]!;
    to = hop.locationId;
    const days = hop.days;
    if (days == null || !Number.isFinite(days) || days < 0) return null;
    // Starting the inward edge is admission. A later closure does not eject a person.
    if (to !== from && !authority.entry(state, setLocation(actor, from, at), to, at).allowed) return null;
    return { ...setLocation(actor, to, at), activity: { kind: 'travelling',
        note: 'Fetching a requested house object.', withIds: [], sinceDay: at,
        untilDay: at + days, fromLocationId: from, returnTo: to, thingId: objectId,
        retrievalRequestId: id } as LinkedActivity };
}
function withPerson(delta: RetrievalDelta, actor: NpcRecord): RetrievalDelta {
    delta.people.push(actor);
    if (actor.activity?.untilDay != null) delta.due.push({ personId: actor.id, at: actor.activity.untilDay });
    return delta;
}
function finished(actor: NpcRecord, ground: string, at: number): NpcRecord {
    return { ...setLocation(actor, ground, at), activity: null };
}

/** Called only after the accepted fact has its actual appendWorldFact id. */
function mayStart(state: WorldState, actor: NpcRecord, intent: RetrievalIntent,
    at: number, authority: RetrievalAuthority, routes?: RouteQueries): boolean {
    if (actor.id !== intent.carrierId || actor.status !== 'alive') return false;
    const a = actor.activity;
    if (a && (a.kind !== 'the_work_of_their_rank' || a.thingId || a.redirect || a.withIds.length)) return false;
    const actual = locationOfNpcOnItsJourney(state, actor, at, routes);
    const object = state.objects.find(o => o.id === intent.objectId);
    const store = state.locations.find(l => l.id === intent.storeId);
    if (!actual || actual !== intent.meetingId || authority.carrierArea(state, actor, at) !== intent.meetingAreaId
        || !store?.parentId || !object || isRuined(object)
        || object.data.spent === true || object.ownerId !== intent.houseId
        || (object.possessorId !== null && object.possessorId !== intent.houseId) || object.locationId !== store.id) return false;
    if (!authority.approval(state, actor, intent, at).allowed
        || !authority.entry(state, actor, store.id, at).allowed
        || !authority.packing(state, actor.id, object, at).allowed) return false;
    return walkingDaysFrom(state.locations, actual, undefined, routes).has(store.id);
}

/** Refusal writes no acceptance fact. The caller appends only this successful preparation. */
export function preparePhysicalRetrieval(state: WorldState, actor: NpcRecord, intent: RetrievalIntent,
    at: number, authority: RetrievalAuthority, routes?: RouteQueries): PendingFact | null {
    if (!mayStart(state, actor, intent, at, authority, routes)) return null;
    const recipient = authority.recipient(state, intent.requesterId, at);
    if (recipient.kind !== 'present' || recipient.id !== intent.requesterId
        || recipient.groundId !== intent.meetingId || recipient.areaId !== intent.meetingAreaId) return null;
    return retrievalIntentFact(intent, at, [{ id: recipient.id, name: recipient.name, role: 'requester' },
        { id: actor.id, name: actor.name, role: 'carrier' }]);
}

export function startPhysicalRetrieval(state: WorldState, actor: NpcRecord, request: HistoricalFact,
    at: number, authority: RetrievalAuthority, routes?: RouteQueries): RetrievalDelta {
    const intent = intentOfRetrieval(request);
    if (!intent || readPhysicalRetrievals(state).closed.has(request.id) || !mayStart(state, actor, intent, at, authority, routes)) return none();
    const store = state.locations.find(l => l.id === intent.storeId)!;
    const going = leg(state, actor, intent.meetingId, store.id, at, request.id, intent.objectId, authority, routes);
    return going ? withPerson(none(), going) : none();
}

/** One actual boundary, not a time-skipping loop; the caller schedules the next deadline. */
export function continuePhysicalRetrieval(state: WorldState, actor: NpcRecord, at: number,
    authority: RetrievalAuthority, routes?: RouteQueries, read: PhysicalRetrievalRead = readPhysicalRetrievals(state)): RetrievalDelta {
    const doing = actor.activity as LinkedActivity | null;
    const id = doing?.retrievalRequestId;
    if (!id) return none();
    if (read.closed.has(id)) {
        if (doing?.thingId !== null || actor.status !== 'alive') return none();
        if (doing.untilDay != null && at < doing.untilDay) return none();
        const ground = locationOfNpcOnItsJourney(state, actor, at, routes);
        if (!ground) return none();
        const intent = intentOfRetrieval(read.byId.get(id) ?? null);
        if (!intent || ground === intent.meetingId) return withPerson(none(), finished(actor, ground, at));
        const returning = leg(state, setLocation(actor, ground, at), ground, intent.meetingId,
            at, id, null, authority, routes);
        return withPerson(none(), returning ?? finished(actor, ground, at));
    }
    const delta = none();
    if (actor.status !== 'alive') {
        delta.facts.push(event(actor, id, at, 'The carrier can no longer finish the request; ordinary estate custody remains.', true));
        return delta;
    }
    if (doing?.untilDay != null && at < doing.untilDay) return none();
    // This inward ordinary leg was admitted at departure from its real outside
    // ground. A later door closure cannot eject an already admitted traveller.
    // The NEXT edge gets a new reachThrough/enteredAt read before it starts.
    const ground = locationOfNpcOnItsJourney(state, actor, at, routes);
    if (!ground) return none();
    const actualActor = setLocation(actor, ground, at);
    const request = read.byId.get(id) ?? null;
    const intent = intentOfRetrieval(request);
    const object = state.objects.find(o => o.id === doing?.thingId);
    if (!intent || intent.carrierId !== actor.id || doing?.thingId !== intent.objectId) {
        delta.facts.push(event(actualActor, id, at, 'The request record is unavailable; actual custody remains where it is.', true));
        return withPerson(delta, finished(actor, ground, at));
    }
    const store = state.locations.find(l => l.id === intent.storeId);
    const held = object?.possessorId === actor.id;
    const block = (reason: string): RetrievalDelta => {
        delta.facts.push(event(actualActor, id, at, reason, true));
        if (!held && ground !== intent.meetingId) {
            const home = leg(state, actualActor, ground, intent.meetingId, at, id, null, authority, routes);
            if (home) return withPerson(delta, home);
        }
        return withPerson(delta, finished(actor, ground, at));
    };
    const returnObject = (reason: string): RetrievalDelta => {
        if (!held) return block(reason);
        if (!store?.parentId) return block(reason + ' No real store route remains; custody stays with the carrier.');
        if (!read.stopped.has(id)) delta.facts.push(event(actualActor, id, at, reason, false));
        const going = leg(state, actualActor, ground, store.id, at, id, object!.id, authority, routes);
        return going ? withPerson(delta, going) : block(reason + ' The carrier cannot reach the store; custody remains.');
    };
    if (!store) return block('The original store is unavailable; no storage destination is invented.');
    if (ground === store.id) {
        if (held) {
            if (object!.ownerId !== intent.houseId || isRuined(object!)) return block('The carried object has changed; ordinary custody is retained.');
            const returned = transferPossession(object!, { onDay: at, toHolderId: null,
                toHolderName: 'the house store', how: 'lent', transfersOwnership: false,
                source: store.name, factId: id, note: 'Returned after a retrieval request.' });
            delta.objects.push({ ...returned, locationId: store.id });
            delta.facts.push(event(setLocation(actor, store.id, at), id, at, 'The same object was physically returned to its store.', true));
            const home = leg(state, actor, store.id, intent.meetingId, at, id, null, authority, routes);
            // The obligation is closed; a null subject distinguishes real unladen return.
            // Its receipt link only selects the next ordinary admitted edge.
            if (home) return withPerson(delta, home);
            return withPerson(delta, finished(actor, store.id, at));
        }
        if (read.stopped.has(id)) return block('The request stopped before collection; no shelf custody changed.');
        if (!object || object.id !== intent.objectId || isRuined(object) || object.data.spent === true || object.ownerId !== intent.houseId
            || (object.possessorId !== null && object.possessorId !== intent.houseId)
            || object.locationId !== store.id) return block('The requested stock is no longer available.');
        const approval = authority.approval(state, actualActor, intent, at);
        if (!approval.allowed) return block(approval.reason);
        const packing = authority.packing(state, actor.id, object, at);
        if (!packing.allowed) return block(packing.reason);
        const going = leg(state, actor, store.id, intent.meetingId, at, id, object.id, authority, routes);
        if (!going) return block('The carrier cannot return to the meeting; the object remains in its store.');
        delta.objects.push(hadAs(transferPossession(object, { onDay: at, toHolderId: actor.id,
            toHolderName: actor.name, how: 'lent', transfersOwnership: false,
            source: store.name, factId: id, note: 'Carrying a requested house object to its meeting.' }), packing.how));
        return withPerson(delta, going);
    }
    if (ground === intent.meetingId && held) {
        if (read.stopped.has(id)) return returnObject('The delivery was canceled; the actual object must return.');
        const recipient = authority.recipient(state, intent.requesterId, at);
        if (recipient.kind === 'unavailable') {
            // No fake dead/absent result, no polling fee, no handover to the world mirror.
            return withPerson(delta, { ...actualActor, activity: { kind: 'the_work_of_their_rank',
                note: 'Holding the requested object for its recipient.', withIds: [], sinceDay: at,
                untilDay: null, thingId: object!.id, retrievalRequestId: id } as LinkedActivity });
        }
        if (recipient.kind === 'dead' || recipient.kind === 'absent' || recipient.id !== intent.requesterId
            || recipient.groundId !== ground || recipient.areaId !== intent.meetingAreaId)
            return returnObject('The recipient is no longer at the actual meeting.');
        if (authority.carrierArea(state, actualActor, at) !== recipient.areaId) {
            // The ordinary geographic leg reaches the precinct, not a particular
            // three-person area. Complete an actual local walk before handover.
            const alreadyApproached = doing.fromLocationId === ground && doing.returnTo === ground
                && doing.redirect?.standingIn === intent.meetingAreaId;
            if (alreadyApproached) return returnObject('The actual meeting area could not be reached.');
            const coming = authority.approachArea?.(state, actualActor, intent, at);
            if (coming) return withPerson(delta, coming);
            return returnObject('The carrier cannot approach the actual accepted meeting area.');
        }
        const approval = authority.approval(state, actualActor, intent, at);
        if (!approval.allowed) return returnObject(approval.reason);
        const packing = authority.packing(state, recipient.id, object!, at);
        if (!packing.allowed) return returnObject(packing.reason);
        if (isRuined(object!) || object!.ownerId !== intent.houseId) return returnObject('The carried stock has changed.');
        delta.objects.push(hadAs(transferPossession(object!, { onDay: at, toHolderId: recipient.id,
            toHolderName: recipient.name, how: intent.meaning === 'use_it_and_return_it' ? 'lent' : 'gifted',
            transfersOwnership: intent.meaning !== 'use_it_and_return_it', source: store.name, factId: id,
            note: 'Handed over at the actual retrieval meeting.' }), packing.how));
        delta.facts.push(event(actualActor, id, at, 'The same requested object reached its actual recipient.', true));
        return withPerson(delta, finished(actor, ground, at));
    }
    // A genuine intermediate route place: take the next ordinary edge, reusing
    // no stored path, position or permissive door decision.
    if (!held && read.stopped.has(id)) return block('The request stopped before collection; stock remains where it is.');
    const goal = held && !read.stopped.has(id) ? intent.meetingId : store.id;
    const going = leg(state, actualActor, ground, goal, at, id, intent.objectId, authority, routes);
    return going ? withPerson(delta, going) : block('The actual next retrieval edge is no longer reachable.');
}
