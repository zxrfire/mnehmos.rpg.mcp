/** Read the members named in an ordinary roll-check fact's scalar data. */
import type { HistoricalFact } from './history.js';

export function missingMembersInRollCheck(fact: HistoricalFact): string[] {
    let raw: unknown = fact.data.missingMemberIds;
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { return []; }
    }
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}
