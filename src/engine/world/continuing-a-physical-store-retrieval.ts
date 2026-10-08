/** Existing true-clock transition commits pure leaf deltas. */
import type { WorldState } from './world-state.js';
import type { NpcActivity, NpcRecord } from './npc-state.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact } from './history.js';
import { readPhysicalRetrievals, type PhysicalRetrievalRead } from './reading-a-physical-store-retrieval.js';
import { continuePhysicalRetrieval, type RetrievalAuthority } from './fetching-an-object-from-a-house-store.js';

type LinkedActivity = NpcActivity & { retrievalRequestId?: string };

/** Scheduler key only; the shared true-clock reader owns deadline discovery. */
export function physicalRetrievalDeadline(npc: NpcRecord, read: PhysicalRetrievalRead): { key: string; day: number } | null {
    const a = npc.activity as LinkedActivity | null;
    if (!a?.retrievalRequestId || a.untilDay == null || npc.status !== 'alive'
        || read.closed.has(a.retrievalRequestId) && a.thingId !== null) return null;
    return { key: `store-retrieval:${npc.id}:${a.retrievalRequestId}:${a.kind}:${a.fromLocationId ?? ''}:${a.returnTo ?? ''}:${a.sinceDay}:${a.untilDay}`,
        day: a.untilDay };
}

/** Existing task builder wrapper, not a copied calendar or independent scheduler. */
export function physicalRetrievalDeadlines(state: WorldState): { key: string; day: number }[] {
    const carriers = state.npcs.filter(n => (n.activity as LinkedActivity | null)?.retrievalRequestId);
    if (!carriers.length) return [];
    const read = readPhysicalRetrievals(state);
    return carriers.flatMap(n => { const due = physicalRetrievalDeadline(n, read); return due ? [due] : []; });
}

/**
 * AFTER atWorldBoundary projected passengers, at the actual clock reached by
 * the shared body/world iterator. Never worldForRun/look or endpoint replay.
 * Pending handovers are revisited at real transitions without polling timers.
 */
export function continuePhysicalRetrievalsAtBoundary(state: WorldState, onDay: number,
    authority: RetrievalAuthority, schedule?: (key: string, day: number) => void): void {
    const read = readPhysicalRetrievals(state);
    const ids = state.npcs.filter(n => (n.activity as LinkedActivity | null)?.retrievalRequestId).map(n => n.id);
    if (!ids.length && !read.requests.length) return;
    for (const id of ids) {
        const index = state.npcs.findIndex(n => n.id === id);
        if (index < 0) continue;
        const delta = continuePhysicalRetrieval(state, state.npcs[index]!, onDay, authority, undefined, read);
        for (const person of delta.people) {
            const at = state.npcs.findIndex(n => n.id === person.id);
            if (at >= 0) state.npcs[at] = person;
        }
        for (const object of delta.objects) {
            const at = state.objects.findIndex(o => o.id === object.id);
            if (at >= 0) state.objects[at] = object;
        }
        for (const fact of delta.facts) read.observe(appendWorldFact(state, fact));
        // Schedule only this carrier, never rescan all history/NPCs per carrier.
        const next = state.npcs.find(n => n.id === id);
        const due = next ? physicalRetrievalDeadline(next, read) : null;
        if (due) schedule?.(due.key, due.day);
    }
    // Ordinary pruning/superseding jobs can remove a link. Indexed request rows
    // close without overwriting a new journey or selecting an imagined store.
    for (const request of read.requests) {
        if (read.closed.has(request.id)) continue;
        const carrier = typeof request.data.carrierId === 'string'
            ? state.npcs.find(n => n.id === request.data.carrierId) : null;
        if ((carrier?.activity as LinkedActivity | null)?.retrievalRequestId === request.id) continue;
        read.observe(appendWorldFact(state, makeFact({ day: onDay, kind: 'gathering', causes: [request.id],
            actors: carrier ? [{ id: carrier.id, name: carrier.name, role: 'carrier' }] : [], locationId: null,
            summary: 'The retrieval undertaking is no longer present; existing custody and journeys remain.',
            data: { retrievalRequestId: request.id, retrievalClosed: true, retrievalOrphaned: true } })));
    }
}
