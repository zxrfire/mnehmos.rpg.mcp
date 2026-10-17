/** A historical identity is not a current body reference. The8210cf97 guard
 * missed seven occurrences in real auction/competition settlement evidence;
 * their surviving lot/entry keeps each closing result through existing indices.
 * Live fields and unheld records still fail this same whole-world reader. */
import type { WorldState } from '../../src/engine/world/world-state.js';
import { witnessIndexFor } from '../../src/engine/world/witness-reaction-index.js';

export function whatStillNames(state: WorldState, ids: ReadonlySet<string>): string[] {
    const found: string[] = [];
    const seen = new WeakSet<object>();
    const walk = (node: unknown, path: string): void => {
        if (typeof node === 'string') {
            if (ids.has(node)) found.push(`${path} = ${node}`);
            return;
        }
        if (node === null || typeof node !== 'object') return;
        if (seen.has(node as object)) return;
        seen.add(node as object);
        if (Array.isArray(node)) { for (const v of node) walk(v, `${path}[]`); return; }
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
            if (ids.has(key)) found.push(`${path}.{key} = ${key}`);
            walk(value, `${path}.${key}`);
        }
    };
    for (const [key, value] of Object.entries(state as unknown as Record<string, unknown>)) {
        if (key !== 'history') { walk(value, key); continue; }
        walk(state.history.eras, 'history.eras');
        const index = witnessIndexFor(state);
        const archivalIds = new Set<string>();
        for (const [id, references] of index.references) if (index.byId.has(id)
            && [...references].some(row => row.id !== id)) archivalIds.add(id);
        // Closing results are retained evidence of actual surviving lots/entries.
        for (const [lotId, results] of index.auctionResults) if (index.byId.has(lotId))
            for (const id of results) archivalIds.add(id);
        for (const board of index.competitions.values()) if (board.entries.some(entry => index.byId.has(entry.id)))
            for (const id of board.resultIds) archivalIds.add(id);
        for (const fact of state.history.facts) {
            // Existing factual receipts retain the original archival evidence
            // they cite. They do not retain a body or any live placement. Actual
            // direct citations and retained settlement authorities are archival.
            const archival = archivalIds.has(fact.id);
            if (!archival) walk(fact, `history.facts[${fact.id}]`);
        }
    }
    return found;
}
