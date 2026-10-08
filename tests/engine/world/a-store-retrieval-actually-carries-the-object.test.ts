/**
 * Review-only continuation controls, 2026-10-03. Junior requests currently
 * require the player inside the sealed store; there is no staff-fetch path.
 * A future path must carry the SAME row through real timed travel, validate a
 * lost key BEFORE store admission, and keep custody pending when the played
 * body's authority is unavailable. These pure controls isolate continuation;
 * the existing played house-store tests remain the authority/provider floor.
 * The ordinary no-office loan arrangement below asks the existing approval
 * reader, not a pretend favorable elder. No tests have been run on this draft.
 */
import { describe, it, expect } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, markDead } from '../../../src/engine/world/npc-state.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';
import { routineTime } from '../../../src/engine/world/npc-routines.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { pathTo, reachThrough } from '../../../src/engine/world/architecture.js';
import { whetherItLeavesTheStore } from '../../../src/engine/social-leverage/who-has-to-agree-before-it-leaves-the-store.js';
import { whatABodyCanCarry } from '../../../src/engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';
import { whereItWouldGo, whatTheirThingsTake, howManyHeld } from '../../../src/engine/world/what-somebody-is-carrying-takes.js';
import { theDoorKeysTheyActuallyCarry } from '../../../src/web/the-door-keys-they-actually-carry.js';
import { preparePhysicalRetrieval, startPhysicalRetrieval, type RetrievalAuthority, type RetrievalRecipient } from '../../../src/engine/world/fetching-an-object-from-a-house-store.js';
import { continuePhysicalRetrievalsAtBoundary, physicalRetrievalDeadlines } from '../../../src/engine/world/continuing-a-physical-store-retrieval.js';

function fixture() {
    const world = createWorld({ seed: 'physical-retrieval-boundaries', regionCount: 0, skipPriorAges: true });
    world.currentDay = 0; world.currentHour = 0;
    const meeting = makeLocation({ id: 'meeting', name: 'Meeting room', kind: 'hall' });
    const parent = makeLocation({ id: 'parent', name: 'Store approach', kind: 'precinct' });
    const store = makeLocation({ id: 'store', name: 'Locked store', kind: 'vault', parentId: parent.id,
        sealed: true, data: { keyId: 'actual-lock', purpose: 'treasury' } });
    linkLocations(meeting, parent, 'path', .25);
    linkLocations(parent, store, 'path', .125);
    world.locations = [meeting, parent, store];
    const actor = createNpc(world.seed, { id: 'carrier', bornOnDay: 0, onDay: 0, locationId: meeting.id });
    actor.activity = { kind: 'the_work_of_their_rank', note: 'Ordinary work.', withIds: [], sinceDay: 0 };
    const recipient = createNpc(world.seed, { id: 'recipient', bornOnDay: 0, onDay: 0, locationId: meeting.id });
    world.npcs = [actor, recipient];
    const object = makeObject({ id: 'row-to-carry', name: 'A stored implement', kind: 'artifact',
        significance: 'mundane', locationId: store.id, ownerId: 'house', weight: 0, volume: 0 });
    const key = makeObject({ id: 'held-key', name: 'The real key', kind: 'key',
        possessorId: actor.id, data: { keyId: 'actual-lock' } });
    world.objects = [object, key];
    let recipientRead: RetrievalRecipient = { kind: 'present', id: recipient.id, name: recipient.name,
        groundId: meeting.id, areaId: 'meeting-area' };
    const authority: RetrievalAuthority = {
        approval: (_state, _carrier, intent, at) => {
            const answer = whetherItLeavesTheStore({ significance: object.significance, meaning: intent.meaning,
                room: 'treasury', portfolios: [], roll: [], rankCount: 1, askerId: intent.requesterId, asOfDay: at });
            return { allowed: answer.allowed, reason: answer.line };
        },
        entry: (state, carrier, storeId, at) => {
            const access = reachThrough(pathTo(state.locations, storeId), { realmOrdinal: carrier.cultivation.realmOrdinal,
                keyIds: theDoorKeysTheyActuallyCarry(state.objects, carrier.id), onDay: at }, { enteredAt: carrier.locationId ?? undefined });
            return { allowed: access.stoppedAt === null, reason: access.reason };
        },
        packing: (state, id, row) => {
            const person = state.npcs.find(n => n.id === id)!;
            const answer = whereItWouldGo(whatTheirThingsTake(state.objects, id), row,
                whatABodyCanCarry(person.cultivation.realmOrdinal), howManyHeld(state.objects, id));
            return answer === 'too_heavy' || answer === 'hands_full'
                ? { allowed: false, reason: answer } : { allowed: true, how: answer };
        },
        recipient: () => recipientRead,
        carrierArea: () => 'meeting-area'
    };
    const intent = { requesterId: recipient.id, carrierId: actor.id, objectId: object.id, houseId: 'house',
        storeId: store.id, meetingId: meeting.id, meetingAreaId: 'meeting-area', meaning: 'use_it_and_return_it' as const };
    const prepared = preparePhysicalRetrieval(world, actor, intent, 0, authority);
    expect(prepared).not.toBeNull();
    const request = appendWorldFact(world, prepared!);
    const started = startPhysicalRetrieval(world, actor, request, 0, authority);
    expect(started.people).toHaveLength(1);
    world.npcs[0] = started.people[0]!;
    const at = (day: number) => {
        world.currentDay = Math.floor(day); world.currentHour = (day - Math.floor(day)) * 24;
        continuePhysicalRetrievalsAtBoundary(world, day, authority);
    };
    const next = () => Math.min(...physicalRetrievalDeadlines(world).map(d => d.day));
    const finish = () => { while (physicalRetrievalDeadlines(world).length) at(next()); };
    return { world, object, key, parent, store, request, at, next, finish,
        recipient: (read: RetrievalRecipient) => { recipientRead = read; } };
}

describe('physical stored-object retrieval boundaries', () => {
    it('retains the exact shelf row until actual entry, then carries and hands over that same loan', () => {
        const f = fixture();
        expect(f.world.objects.find(o => o.id === f.object.id)?.possessorId).toBeNull();
        f.at(f.next());
        expect(locationOnNpcJourney(f.world.locations, f.world.npcs[0]!, routineTime(f.world))).toBe(f.parent.id);
        expect(f.world.objects.find(o => o.id === f.object.id)?.possessorId).toBeNull();
        f.at(f.next());
        expect(f.world.objects.find(o => o.id === f.object.id)).toMatchObject({ ownerId: 'house', possessorId: 'carrier' });
        f.finish();
        expect(f.world.objects.find(o => o.id === f.object.id)).toMatchObject({ ownerId: 'house', possessorId: 'recipient' });
        expect(f.world.objects.find(o => o.id === f.object.id)!.provenance.at(-1)?.how).toBe('lent');
    });

    it('a key taken after dispatch blocks admission at the actual parent, without picking up or duplicating stock', () => {
        const f = fixture();
        f.world.objects = f.world.objects.map(o => o.id === f.key.id ? { ...o, possessorId: 'recipient' } : o);
        f.at(f.next());
        expect(f.world.npcs[0]!.activity?.fromLocationId).toBe(f.parent.id);
        expect(f.world.objects.find(o => o.id === f.object.id)).toMatchObject({ locationId: f.store.id, possessorId: null });
        expect(f.world.history.facts.some(h => h.data.retrievalClosed === true && h.data.retrievalRequestId === f.request.id)).toBe(true);
    });

    it('an unavailable played-body read keeps actual carrier custody until a later authoritative meeting', () => {
        const f = fixture(); f.at(f.next()); f.at(f.next());
        f.recipient({ kind: 'unavailable' }); f.finish();
        expect(f.world.objects.find(o => o.id === f.object.id)?.possessorId).toBe('carrier');
        expect(f.world.npcs[0]!.activity?.untilDay).toBeNull();
        expect(f.world.history.facts.some(h => h.data.retrievalClosed === true)).toBe(false);
        f.recipient({ kind: 'present', id: 'recipient', name: f.world.npcs[1]!.name, groundId: 'meeting', areaId: 'meeting-area' });
        f.at(1);
        expect(f.world.objects.find(o => o.id === f.object.id)?.possessorId).toBe('recipient');
    });

    it('a later lock change cannot retroactively eject an already admitted inward journey', () => {
        const f = fixture(); f.at(f.next());
        f.world.objects = f.world.objects.map(o => o.id === f.key.id ? { ...o, possessorId: 'recipient' } : o);
        f.at(f.next());
        expect(f.world.objects.find(o => o.id === f.object.id)?.possessorId).toBe('carrier');
        f.finish();
        expect(f.world.objects.find(o => o.id === f.object.id)?.possessorId).toBe('recipient');
    });

    it('a departed recipient gets no remote grant; the same goods return through travel and admitted storage', () => {
        const f = fixture(); f.at(f.next()); f.at(f.next());
        f.recipient({ kind: 'present', id: 'recipient', name: f.world.npcs[1]!.name, groundId: 'elsewhere', areaId: null });
        f.at(f.next());
        expect(f.world.objects.find(o => o.id === f.object.id)?.possessorId).toBe('carrier');
        f.finish();
        expect(f.world.objects.find(o => o.id === f.object.id)).toMatchObject({ ownerId: 'house', possessorId: null, locationId: f.store.id });
    });

    it('ordinary pruning of the acceptance cannot invent a handover or a remembered store', () => {
        const f = fixture(); f.at(f.next()); f.at(f.next());
        f.world.history.facts = f.world.history.facts.filter(h => h.id !== f.request.id);
        f.finish(); f.at(1);
        expect(f.world.objects.find(o => o.id === f.object.id)?.possessorId).toBe('carrier');
        expect(f.world.npcs[0]!.activity).toBeNull();
    });

    it('an explicitly canceled delivery physically returns the same row instead of handing it over', () => {
        const f = fixture(); f.at(f.next()); f.at(f.next());
        appendWorldFact(f.world, makeFact({ day: routineTime(f.world),
            kind: 'gathering', summary: 'The requester canceled this retrieval.', actors: [{ id: 'recipient', name: f.world.npcs[1]!.name, role: 'requester' }],
            data: { retrievalRequestId: f.request.id, retrievalCanceled: true } }));
        f.finish();
        expect(f.world.objects.find(o => o.id === f.object.id)).toMatchObject({ possessorId: null, locationId: f.store.id, ownerId: 'house' });
    });

    it('stock taken before pickup remains with its actual holder and is never duplicated for the request', () => {
        const f = fixture(); f.at(f.next());
        f.world.objects = f.world.objects.map(o => o.id === f.object.id ? { ...o, possessorId: 'recipient' } : o);
        f.finish();
        expect(f.world.objects.filter(o => o.id === f.object.id)).toEqual([expect.objectContaining({ possessorId: 'recipient' })]);
        expect(f.world.objects.find(o => o.id === f.object.id)!.provenance).toEqual([]);
    });

    it('changed actual carrying requirements can prevent pickup without moving the stored object', () => {
        const f = fixture(); f.at(f.next());
        f.world.objects = f.world.objects.map(o => o.id === f.object.id ? { ...o, weight: Number.MAX_SAFE_INTEGER } : o);
        f.finish();
        expect(f.world.objects.find(o => o.id === f.object.id)).toMatchObject({ possessorId: null, locationId: f.store.id });
    });

    it('closing the object obligation does not strand the real unladen return between actual doorways', () => {
        const f = fixture(); f.at(f.next());
        f.world.objects = f.world.objects.map(o => o.id === f.object.id ? { ...o, weight: Number.MAX_SAFE_INTEGER } : o);
        f.at(f.next());
        expect(f.world.history.facts.some(h => h.data.retrievalClosed === true && h.data.retrievalRequestId === f.request.id)).toBe(true);
        expect(f.world.npcs[0]!.activity?.thingId).toBeNull();
        expect(locationOnNpcJourney(f.world.locations, f.world.npcs[0]!, routineTime(f.world))).toBe(f.store.id);
        f.at(f.next());
        expect(locationOnNpcJourney(f.world.locations, f.world.npcs[0]!, routineTime(f.world))).toBe(f.parent.id);
        f.finish();
        expect(f.world.npcs[0]!.locationId).toBe('meeting');
        expect(f.world.npcs[0]!.activity).toBeNull();
    });

    it('carrier death closes the service without resurrecting a person or reclaiming estate-owned custody', () => {
        const f = fixture(); f.at(f.next()); f.at(f.next());
        f.world.npcs[0] = markDead(f.world.npcs[0]!, routineTime(f.world), 'Fixture bodily death.');
        const stock = f.world.objects.find(o => o.id === f.object.id)!;
        f.at(f.next());
        expect(f.world.npcs[0]!.status).not.toBe('alive');
        expect(f.world.objects.find(o => o.id === f.object.id)).toBe(stock);
        expect(f.world.history.facts.some(h => h.data.retrievalClosed === true && h.data.retrievalRequestId === f.request.id)).toBe(true);
    });
});
