/**
 * The obligation ledger's rows, read back. The only place the `snake_case`
 * column / `camelCase` domain translation happens.
 *
 * The WRITE half and the two pair-shaped reads are still in `src/web/encounters.ts`
 * and want moving here when its owner is free; they use the row shape and mapper
 * below, so the move is a cut and a re-import rather than a rewrite.
 */

import type { ObligationRecord } from '../../engine/social/grudges.js';

/**
 * The minimal handle these reads need. Declared rather than imported from
 * `better-sqlite3`: a value import of the driver pulls a native module into every
 * file that only wanted to name a type.
 */
export interface ObligationDb {
    prepare(sql: string): { all(...params: unknown[]): unknown };
}

/**
 * The row, declared rather than inferred, so a column renamed in the migration
 * fails compilation here instead of producing `undefined` at the boundary.
 */
export interface ObligationRow {
    id: string;
    kind: string;
    holder_id: string;
    subject_id: string | null;
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
 * BOTH DIRECTIONS AND BOTH STATUSES: the caller decides which it wants, and
 * "what somebody IS" reads only the open ledger while a caller looking at a life
 * reads the closed ones too.
 *
 * `participants` is deliberately NOT searched. A bystander is findable FROM a
 * record and is not a party to it, and treating them as one would put a house's
 * whole roster on the hook for a thing one member did in front of them.
 *
 * Ordered oldest first, so two reads of the same ledger are the same list.
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

/**
 * Write obligation rows.
 *
 * The write half of the file `src/web/encounters.ts` asked for by name. It
 * arrived when the world started deciding accounts a tick could not persist -
 * a war's dead - because that path has no business importing a web module to
 * get at a row writer.
 *
 * `INSERT OR REPLACE`, and that is what makes a replayed span safe rather than
 * doubled: `createObligation` derives its id from the pair, the cause, the day
 * and the triggering event, so the same death arriving twice is the same row
 * written over itself. The severity is whatever was decided when the record was
 * made and nothing here recomputes it.
 *
 * `encounters.ts` still holds its own copy of this insert. The two are the same
 * statement and the older one wants deleting in favour of this when its file is
 * free; until then, both write the same columns from the same record type.
 */
export function writeObligations(
    db: ObligationWriteDb,
    records: readonly ObligationRecord[]
): number {
    if (records.length === 0) return 0;
    const statement = db.prepare(`
        INSERT OR REPLACE INTO obligations (
            id, kind, holder_id, subject_id, cause, severity, incurred_on_day,
            triggering_event_id, description, participants, tags, terms, due_on_day,
            status, settlement_resolution, settled_on_day, settled_by_id, settlement_note,
            inheritance, generation, origin_holder_id, from_belief, recorded_on_day
        ) VALUES (
            @id, @kind, @holderId, @subjectId, @cause, @severity, @incurredOnDay,
            @triggeringEventId, @description, @participants, @tags, @terms, @dueOnDay,
            @status, @settlementResolution, @settledOnDay, @settledById, @settlementNote,
            @inheritance, @generation, @originHolderId, @fromBelief, @recordedOnDay
        )
    `);
    for (const record of records) {
        statement.run({
            id: record.id,
            kind: record.kind,
            holderId: record.holderId,
            subjectId: record.subjectId,
            cause: record.cause,
            severity: record.severity,
            incurredOnDay: record.incurredOnDay,
            triggeringEventId: record.triggeringEventId,
            description: record.description,
            participants: JSON.stringify(record.participants),
            tags: JSON.stringify(record.tags),
            terms: record.terms,
            dueOnDay: record.dueOnDay,
            status: record.status,
            settlementResolution: record.settlement?.resolution ?? null,
            settledOnDay: record.settlement?.onDay ?? null,
            settledById: record.settlement?.byId ?? null,
            settlementNote: record.settlement?.note ?? null,
            inheritance: JSON.stringify(record.inheritance),
            generation: record.generation,
            originHolderId: record.originHolderId,
            fromBelief: record.fromBelief ? 1 : 0,
            recordedOnDay: record.recordedOnDay
        });
    }
    return records.length;
}

/** The handle a write needs. Separate from the read one so neither widens. */
export interface ObligationWriteDb {
    prepare(sql: string): { run(params: Record<string, unknown>): unknown };
}
