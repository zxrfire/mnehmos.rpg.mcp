/**
 * The play log.
 *
 * Three roles, and the distinction between them is the point rather than a
 * styling detail:
 *
 *   player    what the operator typed. Verbatim.
 *   engine    a factual ruling. Always sourced from facts.ts, which is always
 *             sourced from an engine result.
 *   narrator  prose. Decorative by construction - nothing reads it back.
 *
 * A reader scrolling the log can therefore always tell which lines are load
 * bearing. When the narrator and the engine disagree, the engine line is the
 * one that happened, and it is sitting right there to be compared against.
 *
 * The table is created here rather than in src/storage/migrations.cultivation.ts
 * because it belongs to the web presentation layer, not the game model: nothing
 * in the engine, the MCP tools or the repositories reads it, and a deployment
 * that never starts the web server never needs it. `CREATE TABLE IF NOT EXISTS`
 * makes installing it idempotent and harmless alongside the real migrations.
 */

import type Database from 'better-sqlite3';

export type LogRole = 'narrator' | 'player' | 'engine';

export interface LogEntry {
    role: LogRole;
    text: string;
    turn: number;
}

interface LogRow {
    role: string;
    text: string;
    turn: number;
}

/** Most recent entries returned by default. A run of a hundred turns is long. */
export const DEFAULT_LOG_LIMIT = 250;

export function installLogTable(db: Database.Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS web_play_log (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id     TEXT NOT NULL,
            role       TEXT NOT NULL CHECK (role IN ('narrator', 'player', 'engine')),
            text       TEXT NOT NULL,
            turn       INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_web_play_log_run ON web_play_log(run_id, id);
    `);
}

export class PlayLog {
    private readonly appendStmt: Database.Statement;
    private readonly listStmt: Database.Statement;
    private readonly clearStmt: Database.Statement;

    constructor(private readonly db: Database.Database) {
        installLogTable(db);

        this.appendStmt = db.prepare(`
            INSERT INTO web_play_log (run_id, role, text, turn, created_at)
            VALUES (@runId, @role, @text, @turn, @createdAt)
        `);

        // Newest-first inside the query so the LIMIT keeps the *recent* tail,
        // then reversed in JS so the caller gets chronological order.
        this.listStmt = db.prepare(`
            SELECT role, text, turn FROM (
                SELECT role, text, turn, id FROM web_play_log
                WHERE run_id = ? ORDER BY id DESC LIMIT ?
            ) ORDER BY id ASC
        `);

        this.clearStmt = db.prepare('DELETE FROM web_play_log WHERE run_id = ?');
    }

    append(runId: string, entries: readonly LogEntry[]): void {
        if (entries.length === 0) return;
        const createdAt = new Date().toISOString();
        const write = this.db.transaction((rows: readonly LogEntry[]) => {
            for (const row of rows) {
                const text = row.text.trim();
                if (text.length === 0) continue;
                this.appendStmt.run({
                    runId,
                    role: row.role,
                    text,
                    turn: Math.max(0, Math.round(row.turn)),
                    createdAt
                });
            }
        });
        write(entries);
    }

    list(runId: string, limit = DEFAULT_LOG_LIMIT): LogEntry[] {
        const rows = this.listStmt.all(runId, Math.max(1, Math.round(limit))) as LogRow[];
        return rows.map(row => ({ role: row.role as LogRole, text: row.text, turn: row.turn }));
    }

    clear(runId: string): void {
        this.clearStmt.run(runId);
    }
}
