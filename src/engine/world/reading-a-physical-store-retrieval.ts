/** One boundary's read of the existing ledger index, never stored. */
import type { WorldState } from './world-state.js';
import type { HistoricalFact } from './history.js';
import { factsWithData, factsWithDataValue, witnessIndexFor } from './witness-reaction-index.js';

export interface PhysicalRetrievalRead {
    readonly byId: ReadonlyMap<string, HistoricalFact>;
    readonly requests: readonly HistoricalFact[];
    readonly closed: Set<string>;
    readonly stopped: Set<string>;
    /** Update this same ephemeral read after a genuine append; no authority result is cached. */
    observe(fact: HistoricalFact): void;
}

export function readPhysicalRetrievals(state: WorldState): PhysicalRetrievalRead {
    // Existing witness index owns append/prune freshness. Only the indexed
    // request bucket is considered; a world without requests returns here.
    const requests = factsWithDataValue(state, 'physicalStoreRetrieval', true);
    const closed = new Set<string>();
    const stopped = new Set<string>();
    const observe = (fact: HistoricalFact) => {
        const id = fact.data.retrievalRequestId;
        if (typeof id !== 'string') return;
        if (fact.data.retrievalClosed === true) closed.add(id);
        if (fact.data.retrievalCanceled === true || fact.data.retrievalDeliveryStopped === true) stopped.add(id);
    };
    if (requests.length) for (const fact of factsWithData(state, 'retrievalRequestId')) observe(fact);
    return { byId: witnessIndexFor(state).byId, requests, closed, stopped, observe };
}
