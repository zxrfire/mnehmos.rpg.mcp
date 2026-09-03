/**
 * The obligation ledger's rows, read back.
 *
 * `src/web/encounters.ts` asks for this file by name, in a comment above the
 * only insert anybody has ever written to these tables:
 *
 *   > There is no obligations repository yet - the tables have existed since
 *   > the social migration and nothing has ever written to them - so the insert
 *   > lives here beside its only caller. It wants lifting into
 *   > `src/storage/repos/obligation.repo.ts` by whoever owns that directory.
 *
 * This is the READ half of that file. The write and the two pair-shaped reads
 * are still in `encounters.ts` and want moving here when its owner is free; the
 * row shape and the mapper below are the ones they use, so the move is a cut
 * and a re-import rather than a rewrite.
 *
 * Why the read half arrived first: nothing anywhere asked the ledger the
 * question *what does the world hold about this person*. Both existing reads
 * are pair-shaped - what stands between these two, what oaths does this one
 * carry - and neither can answer a question about somebody's whole record. So
 * the ledger was a table the world wrote to, and read back only when it already
 * knew who the other party was.
 *
 * Columns are `snake_case` and the domain model is `camelCase`, and this is the
 * only place the translation happens.
 */

import type { ObligationRecord } from '../../engine/social/grudges.js';

/**
 * The minimal handle these reads need.
 *
 * Declared here rather than imported from `better-sqlite3` for the same reason
 * every other consumer of this shape declares it: a value import of the driver
 * pulls a native module into every file that only wanted to name a type.
 */
export interface ObligationDb {
    prepare(sql: string): { all(...params: unknown[]): unknown };
}

/**
 * The row, declared rather than inferred.
 *
 * Storage's own convention and its own reason: a column renamed in the
 * migration fails compilation here instead of silently producing `undefined`
 * at the schema boundary.
 */
export interface ObligationRow {
    id: string;
    kind: string;
    holder_id: string;
    subject_id: string;
    cause: string;
    severity: string;
    incurred_on_day: number;
    triggering_event_id: string | null;
    description: string;
    participants: string;
    tags: string;
    terms: string | null;
    due_on_day: number | null;
    status: string;
    settlement_resolution: string | null;
    settled_on_day: number | null;
    settled_by_id: string | null;
    settlement_note: string | null;
    inheritance: string;
    generation: number;
    origin_holder_id: string;
    from_belief: number;
    recorded_on_day: number;
}

/**
 * Everything the ledger holds where this person is one of the two principals.
 *
 * BOTH DIRECTIONS AND BOTH STATUSES, because the caller decides which it wants
 * and the two questions that read this differ on it. What somebody IS reads the
 * open ledger only - a settled record has been answered - and a caller looking
 * at a life reads the closed ones too.
 *
 * `participants` is deliberately not searched. A bystander named on a record is
 * findable FROM it, which is what that column is for; they are not a party to
 * it, and treating them as one would put a house's whole roster on the hook for
 * a thing one member did in front of them.
 *
 * Ordered oldest first, so a listing reads as a history and two reads of the
 * same ledger are the same list.
 */
export function ledgerAbout(db: ObligationDb, personId: string): ObligationRecord[] {
    const rows = db.prepare(`
        SELECT * FROM obligations
        WHERE holder_id = ? OR subject_id = ?
        ORDER BY incurred_on_day ASC, id ASC
    `).all(personId, personId) as ObligationRow[];
    return rows.map(obligationFromRow);
}

/** One row, in the domain model's own words. */
export function obligationFromRow(row: ObligationRow): ObligationRecord {
    return {
        id: row.id,
        kind: row.kind as ObligationRecord['kind'],
        holderId: row.holder_id,
        subjectId: row.subject_id,
        cause: row.cause as ObligationRecord['cause'],
        severity: row.severity as ObligationRecord['severity'],
        incurredOnDay: row.incurred_on_day,
        triggeringEventId: row.triggering_event_id,
        description: row.description,
        participants: parseList(row.participants),
        tags: parseList(row.tags),
        terms: row.terms,
        dueOnDay: row.due_on_day,
        status: row.status as ObligationRecord['status'],
        settlement: row.settlement_resolution === null ? null : {
            resolution: row.settlement_resolution as NonNullable<
                ObligationRecord['settlement']
            >['resolution'],
            onDay: row.settled_on_day ?? row.recorded_on_day,
            note: row.settlement_note ?? '',
            ...(row.settled_by_id ? { byId: row.settled_by_id } : {})
        },
        inheritance: parseInheritance(row.inheritance),
        generation: row.generation,
        originHolderId: row.origin_holder_id,
        fromBelief: row.from_belief === 1,
        recordedOnDay: row.recorded_on_day
    };
}

function parseList(json: string): string[] {
    try {
        const parsed: unknown = JSON.parse(json);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

function parseInheritance(json: string): ObligationRecord['inheritance'] {
    try {
        const parsed: unknown = JSON.parse(json);
        return Array.isArray(parsed) ? (parsed as ObligationRecord['inheritance']) : [];
    } catch {
        return [];
    }
}
