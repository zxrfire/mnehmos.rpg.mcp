/**
 * A fact that keeps happening is one row, not one row per time.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A seeded world advanced two thousand years held 17,559 facts, of which 4,556 -
 * 25.9% - were rows saying something an earlier row already said, word for word.
 * The single worst statement appeared 167 times:
 *
 *     x167  The Ashen Forge Clan's grant on its vein comes up for renewal.
 *
 * It is not noise that crept in. `seedGrantSchedule` puts a REPEATING scheduled
 * effect on the books for every federated house, and `advanceTime` writes a fact
 * every time one fires, forever, with identical everything. At six thousand
 * years that is five hundred rows per house, each of which is then walked by
 * every pass, carried through every back-link, and serialised on every save.
 *
 * ── Why this is a write-time fix and not a read-time one ─────────────────
 *
 * Filtering on the way out would tidy one renderer and leave the cost. Every row
 * that exists is paid for at every step of the simulation, not at the moment
 * somebody reads it, and the ledger is now load-bearing for the person-to-fact
 * back-links - so a row nobody wants is a row that still has to be linked,
 * indexed, cloned and stored. The saving has to be in not creating it.
 *
 * It is also the better record. One row saying a renewal came round a hundred
 * and sixty-seven times between year 1004 and year 3000 is shorter AND says more
 * than a hundred and sixty-seven rows each saying it happened once.
 *
 * ── "The same fact" is defined so that merging cannot lose anything ──────
 *
 * The key below is every field that would make two occurrences different
 * statements. If any of them differs the rows are not duplicates and both are
 * kept, which is why deaths and killings never coalesce - their summaries name
 * a person, so no two of them collide.
 *
 * What the merge then folds, rather than discards:
 *
 *   witnessIds          UNIONED. Different people were standing there on
 *                       different occasions and all of them were there.
 *   locationChangeIds   CONCATENATED. Each occurrence physically changed
 *                       something and each change record survives.
 *   causes              UNIONED.
 *   the days            kept, in `data`, with the first and the last.
 *
 * The row's own `day`, `year` and `id` never move. The coordinator's rule and
 * the right one: extend the first row, never rewrite history. Nothing is ever
 * deleted, so no `historyFactIds` entry anywhere can be left pointing at a row
 * that stopped existing - a person linked to the row before it absorbed a
 * further occurrence is simply linked to a row that now says more.
 */

import type { HistoricalFact, HistoryLedger, PendingFact } from './history.js';

/** Keys this module owns inside `data`. Excluded from the recurrence key. */
export const RECURRENCE_KEYS = [
    'recurrences',
    'firstOccurrenceDay',
    'lastOccurrenceDay',
    'recurredOnDays'
] as const;

/**
 * The most occurrence days written onto a row.
 *
 * Bounded because a statement that recurs eight hundred times over six thousand
 * years would otherwise carry an eight-hundred-entry string through every
 * serialisation - which is the cost this file exists to remove, arriving by a
 * different door. The count and the two endpoints are complete on their own;
 * the day list is a convenience for reading a short recurrence, and it says so
 * when it has stopped being complete.
 */
export const MOST_DAYS_KEPT = 24;

/**
 * Everything that would make two occurrences different statements.
 *
 * `data` is included, minus this module's own keys, which is what keeps the
 * merge honest without any per-template knowledge: a market shift that carries
 * its own price factor does not collide with one that carries a different
 * factor, and nothing here had to be told what a market shift is.
 */
export function recurrenceKeyOf(fact: PendingFact): string {
    const data: Record<string, unknown> = {};
    for (const key of Object.keys(fact.data).sort()) {
        if ((RECURRENCE_KEYS as readonly string[]).includes(key)) continue;
        data[key] = fact.data[key];
    }
    return JSON.stringify([
        fact.kind,
        fact.scale,
        fact.summary,
        fact.locationId,
        fact.place,
        [...fact.factionIds].sort(),
        fact.visibility,
        fact.fidelity,
        fact.causeKnown,
        fact.truth,
        fact.nearMiss,
        fact.nearMissNote,
        fact.magnitude,
        fact.actors.map(a => `${a.id}:${a.role}`).sort(),
        [...fact.claimedOutcomes].sort(),
        fact.consequences,
        data
    ]);
}

// ─────────────────────────────────────────────────────────────────────────
// THE INDEX
//
// Held beside the ledger rather than on it. A ledger round-trips through the
// repo and through `cloneWorld`, and a Map hung off the record would either be
// serialised - which it must not be - or silently lost. A WeakMap keyed by the
// ledger is invisible to both, and rebuilds itself from the rows on first use
// after a load or a clone.
// ─────────────────────────────────────────────────────────────────────────

interface LedgerIndex {
    byKey: Map<string, HistoricalFact>;
    /** How many rows have been folded in. Anything past this is indexed lazily. */
    indexedUpTo: number;
}

const INDEXES = new WeakMap<HistoryLedger, LedgerIndex>();

/**
 * The index for this ledger, caught up to whatever is currently in it.
 *
 * Incremental: rows appended by any other path - a direct `appendFact`, a load
 * from the repo - are folded in on the next call rather than triggering a full
 * rebuild. If the ledger has somehow shrunk, the index is rebuilt, because a
 * stale entry pointing at a row that is no longer there is the one state this
 * must never be in.
 */
function indexFor(ledger: HistoryLedger): LedgerIndex {
    let index = INDEXES.get(ledger);
    if (!index || index.indexedUpTo > ledger.facts.length) {
        index = { byKey: new Map(), indexedUpTo: 0 };
        INDEXES.set(ledger, index);
    }
    for (let at = index.indexedUpTo; at < ledger.facts.length; at++) {
        const fact = ledger.facts[at];
        const key = recurrenceKeyOf(fact);
        // First row wins. A later duplicate that predates this module keeps its
        // own row rather than being retro-merged; history is not rewritten.
        if (!index.byKey.has(key)) index.byKey.set(key, fact);
    }
    index.indexedUpTo = ledger.facts.length;
    return index;
}

/** The row this occurrence belongs to, if the ledger already holds one. */
export function rowThisRecurs(ledger: HistoryLedger, pending: PendingFact): HistoricalFact | null {
    return indexFor(ledger).byKey.get(recurrenceKeyOf(pending)) ?? null;
}

/**
 * Fold a further occurrence into the row that already says it.
 *
 * Mutates the row in place, which is what makes this a saving rather than a
 * rearrangement: every reference to it - the ids on people's records, the ids
 * in `causes` on later facts - keeps pointing at the same row and finds it
 * saying more than it did.
 *
 * Returns the row, so a caller cannot tell whether it appended or extended
 * except by asking.
 */
export function foldOccurrenceInto(row: HistoricalFact, pending: PendingFact): HistoricalFact {
    const previous = Number(row.data.recurrences ?? 1);
    const occurrences = previous + 1;

    for (const id of pending.witnessIds) {
        if (!row.witnessIds.includes(id)) row.witnessIds.push(id);
    }
    for (const id of pending.locationChangeIds) {
        if (!row.locationChangeIds.includes(id)) row.locationChangeIds.push(id);
    }
    for (const id of pending.causes) {
        if (!row.causes.includes(id)) row.causes.push(id);
    }

    const first = Number(row.data.firstOccurrenceDay ?? row.day);
    const days = String(row.data.recurredOnDays ?? row.day);
    row.data = {
        ...row.data,
        recurrences: occurrences,
        firstOccurrenceDay: first,
        lastOccurrenceDay: pending.day,
        recurredOnDays: occurrences <= MOST_DAYS_KEPT ? `${days},${pending.day}` : days
    };
    return row;
}

/** How many times this row's statement happened. One for an ordinary row. */
export function occurrencesOf(fact: HistoricalFact): number {
    const n = Number(fact.data.recurrences ?? 1);
    return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** The day of the last occurrence. The row's own day for an ordinary row. */
export function lastOccurrenceOf(fact: HistoricalFact): number {
    const n = Number(fact.data.lastOccurrenceDay ?? fact.day);
    return Number.isFinite(n) ? n : fact.day;
}

/**
 * The row's statement with its recurrence said out loud.
 *
 * The summary itself is never rewritten - it is part of the recurrence key, and
 * a row whose key drifted would stop absorbing its own further occurrences and
 * start a second row beside itself. So the recurrence is composed at read time
 * from what the row stores, which costs nothing and keeps the key stable.
 */
export function describeWithRecurrence(fact: HistoricalFact, yearOfDay: (day: number) => number): string {
    const occurrences = occurrencesOf(fact);
    if (occurrences <= 1) return fact.summary;
    const from = yearOfDay(Number(fact.data.firstOccurrenceDay ?? fact.day));
    const to = yearOfDay(lastOccurrenceOf(fact));
    if (from === to) return `${fact.summary} (${occurrences} times in year ${from}.)`;
    return `${fact.summary} (${occurrences} times, years ${from} to ${to}.)`;
}
