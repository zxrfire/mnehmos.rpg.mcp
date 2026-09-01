import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { DeathCause, Run, RunSchema } from '../../schema/cultivation.js';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';

interface RunRow {
    id: string;
    cultivator_id: string;
    seed: string;
    status: string;
    turn: number;
    elapsed_days: number;
    started_at: string;
    ended_at: string | null;
    death_cause: string | null;
    death_description: string | null;
    peak_ordinal: number;
}

export interface StartRunInput {
    cultivatorId: string;
    seed: string;
    /** Supplied only by tests and by replay, which need a reproducible id. */
    id?: string;
    startedAt?: string;
    /** The cultivator's ordinal at the moment the run begins; usually 0. */
    peakOrdinal?: number;
}

/**
 * Run lifecycle and the death ledger.
 *
 * A run is the unit of permadeath. It carries the seed every stochastic system
 * derives from - reproducibility is a feature, not a debugging convenience -
 * and once ended it is never reopened. `endRun` is the only writer of a
 * terminal status, and it is idempotent-by-refusal: a finished run cannot be
 * finished twice with a different cause.
 */
export class RunRepository {
    private readonly insertStmt: Database.Statement;
    private readonly selectByIdStmt: Database.Statement;
    private readonly selectActiveForCultivatorStmt: Database.Statement;
    private readonly selectLatestActiveStmt: Database.Statement;
    private readonly incrementTurnStmt: Database.Statement;
    private readonly advanceDaysStmt: Database.Statement;
    private readonly endRunStmt: Database.Statement;
    private readonly peakStmt: Database.Statement;
    private readonly ledgerStmt: Database.Statement;
    private readonly cleanLedgerStmt: Database.Statement;
    private readonly latestFinishedStmt: Database.Statement;
    private readonly stampCultivatorRunStmt: Database.Statement;

    constructor(private db: Database.Database) {
        this.insertStmt = db.prepare(`
            INSERT INTO runs (
                id, cultivator_id, seed, status, turn, elapsed_days,
                started_at, ended_at, death_cause, death_description, peak_ordinal
            ) VALUES (
                @id, @cultivatorId, @seed, @status, @turn, @elapsedDays,
                @startedAt, @endedAt, @deathCause, @deathDescription, @peakOrdinal
            )
        `);

        this.selectByIdStmt = db.prepare('SELECT * FROM runs WHERE id = ?');

        this.selectActiveForCultivatorStmt = db.prepare(`
            SELECT * FROM runs WHERE cultivator_id = ? AND status = 'active' LIMIT 1
        `);
        this.selectLatestActiveStmt = db.prepare(`
            SELECT * FROM runs WHERE status = 'active' ORDER BY started_at DESC, rowid DESC LIMIT 1
        `);

        // Turn and day advancement are read-free UPDATEs on purpose: they run
        // on every action, and a select-then-write would be both slower and
        // racy against a concurrent writer on the same campaign database.
        this.incrementTurnStmt = db.prepare(`
            UPDATE runs SET turn = turn + @by WHERE id = @id AND status = 'active'
        `);
        this.advanceDaysStmt = db.prepare(`
            UPDATE runs SET elapsed_days = elapsed_days + @days WHERE id = @id AND status = 'active'
        `);

        this.endRunStmt = db.prepare(`
            UPDATE runs SET
                status = @status,
                ended_at = @endedAt,
                death_cause = @deathCause,
                death_description = @deathDescription
            WHERE id = @id AND status = 'active'
        `);

        this.peakStmt = db.prepare(`
            UPDATE runs SET peak_ordinal = @ordinal WHERE id = @id AND peak_ordinal < @ordinal
        `);

        // Finished runs only. An in-progress run has not yet earned a place in
        // the "how cultivators die" ledger.
        //
        // ADMIN-FLAGGED RUNS ARE NOT IN IT, AND THAT IS THE LEDGER'S CONTRACT
        // rather than a caller's preference. `admin_manage.set_realm` has always
        // promised in so many words that "this run is now excluded from the
        // death ledger", `run_manage.ledger` filters them out, the migration
        // that added the column says the same - and this statement, which is
        // what /api/ledger actually reads, did not. A run called "Scenario Rig"
        // that had been stood at ordinal 45 by hand sat at the top of the
        // ledger with a starvation death against it, in the statistics, as
        // balance data. A rigged run is not evidence about anything.
        this.ledgerStmt = db.prepare(`
            SELECT * FROM runs
            WHERE status != 'active'
            ORDER BY ended_at DESC, rowid DESC
            LIMIT ?
        `);

        this.cleanLedgerStmt = db.prepare(`
            SELECT * FROM runs
            WHERE status != 'active' AND admin = 0
            ORDER BY ended_at DESC, rowid DESC
            LIMIT ?
        `);

        this.latestFinishedStmt = db.prepare(`
            SELECT * FROM runs
            WHERE status != 'active'
            ORDER BY ended_at DESC, rowid DESC
            LIMIT 1
        `);

        this.stampCultivatorRunStmt = db.prepare('UPDATE cultivators SET run_id = ? WHERE id = ?');
    }

    /**
     * Open a run and bind the cultivator to it. The back reference on
     * `cultivators.run_id` is written in the same transaction, because a
     * cultivator that does not know its own run cannot have its death
     * recorded in the ledger.
     */
    startRun(input: StartRunInput): Run {
        const run = RunSchema.parse({
            id: input.id ?? randomUUID(),
            cultivatorId: input.cultivatorId,
            seed: input.seed,
            status: 'active',
            turn: 0,
            elapsedDays: 0,
            startedAt: input.startedAt ?? new Date().toISOString(),
            endedAt: null,
            deathCause: null,
            deathDescription: null,
            peakOrdinal: input.peakOrdinal ?? 0
        });

        const open = this.db.transaction((r: Run) => {
            this.insertStmt.run(toParams(r));
            this.stampCultivatorRunStmt.run(r.id, r.cultivatorId);
        });
        open(run);

        return run;
    }

    getById(id: string): Run | null {
        const row = this.selectByIdStmt.get(id) as RunRow | undefined;
        return row ? rowToRun(row) : null;
    }

    /**
     * The live run - for a given cultivator when one is named, otherwise the
     * most recently started live run in this database.
     */
    getActiveRun(cultivatorId?: string): Run | null {
        const row = (cultivatorId !== undefined
            ? this.selectActiveForCultivatorStmt.get(cultivatorId)
            : this.selectLatestActiveStmt.get()) as RunRow | undefined;
        return row ? rowToRun(row) : null;
    }

    listByCultivator(cultivatorId: string): Run[] {
        const rows = this.db
            .prepare('SELECT * FROM runs WHERE cultivator_id = ? ORDER BY started_at ASC, rowid ASC')
            .all(cultivatorId) as RunRow[];
        return rows.map(rowToRun);
    }

    /** Advance the turn counter. Returns null for an unknown or finished run. */
    incrementTurn(runId: string, by = 1): Run | null {
        if (this.incrementTurnStmt.run({ id: runId, by: Math.max(0, Math.round(by)) }).changes === 0) {
            return null;
        }
        return this.getById(runId);
    }

    /**
     * Advance in-world time. Days are fractional because a time-skip resolves
     * in one pass and may stop partway through a day when an event interrupts.
     */
    advanceDays(runId: string, days: number): Run | null {
        if (this.advanceDaysStmt.run({ id: runId, days: Math.max(0, days) }).changes === 0) {
            return null;
        }
        return this.getById(runId);
    }

    /** Raise the recorded peak. Never lowers it - the ledger remembers the best moment. */
    updatePeakOrdinal(runId: string, ordinal: number): Run | null {
        const clamped = Math.max(0, Math.min(MAX_ORDINAL, Math.round(ordinal)));
        this.peakStmt.run({ id: runId, ordinal: clamped });
        return this.getById(runId);
    }

    /**
     * Close a run. Returns null when the run is unknown or already closed;
     * the caller must not be able to overwrite a recorded death with a second
     * one, and silently accepting the write would corrupt the ledger.
     */
    endRun(
        runId: string,
        cause: DeathCause | null,
        description: string | null,
        status: 'dead' | 'ascended' = 'dead'
    ): Run | null {
        const result = this.endRunStmt.run({
            id: runId,
            status,
            endedAt: new Date().toISOString(),
            deathCause: cause,
            deathDescription: description
        });
        if (result.changes === 0) return null;
        return this.getById(runId);
    }

    /**
     * Finished runs, newest first - the "how cultivators die" screen. Ordered
     * by ended_at so the ledger reads as a chronicle of endings rather than of
     * beginnings.
     */
    /**
     * The death ledger: finished runs, admin-flagged ones left out.
     *
     * `includeAdmin` exists for the one caller that legitimately wants them -
     * `run_manage.ledger({ includeAdminRuns: true })`, an operator asking to
     * see the rigged runs on purpose. Everything else gets the ledger the rest
     * of the codebase already describes.
     */
    deathLedger(limit = 20, options: { includeAdmin?: boolean } = {}): Run[] {
        const stmt = options.includeAdmin ? this.ledgerStmt : this.cleanLedgerStmt;
        const rows = stmt.all(Math.max(1, Math.round(limit))) as RunRow[];
        return rows.map(rowToRun);
    }

    /**
     * The most recent finished run, whatever it was - rigged runs included.
     *
     * NOT the ledger, and deliberately a separate method. Several callers want
     * "the run that just ended" so they can keep showing its world, its roster
     * marker or its lineage after it closes, and they had been reaching for
     * `deathLedger(1)[0]` to get it. That is a different question from "what
     * does this world's record of deaths say", and answering both from one
     * statement is how an admin-flagged run ended up in the statistics.
     */
    latestFinishedRun(): Run | null {
        const row = this.latestFinishedStmt.get() as RunRow | undefined;
        return row ? rowToRun(row) : null;
    }
}

function toParams(run: Run): Record<string, unknown> {
    return {
        id: run.id,
        cultivatorId: run.cultivatorId,
        seed: run.seed,
        status: run.status,
        turn: run.turn,
        elapsedDays: run.elapsedDays,
        startedAt: run.startedAt,
        endedAt: run.endedAt ?? null,
        deathCause: run.deathCause ?? null,
        deathDescription: run.deathDescription ?? null,
        peakOrdinal: run.peakOrdinal
    };
}

function rowToRun(row: RunRow): Run {
    return RunSchema.parse({
        id: row.id,
        cultivatorId: row.cultivator_id,
        seed: row.seed,
        status: row.status,
        turn: row.turn,
        elapsedDays: row.elapsed_days,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        deathCause: row.death_cause,
        deathDescription: row.death_description,
        peakOrdinal: row.peak_ordinal
    });
}
