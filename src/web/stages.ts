/**
 * How far a manual has been written, and how far a holder has got through it.
 *
 * A derivation is the next STAGE of a manual rather than a new book, so nothing
 * here creates a technique: the manual stays the catalog row it always was, and
 * these two tables record only what the catalog cannot state - stages written
 * after it shipped, and which holder stands on how many of them.
 *
 * ── THE ONE RULE ─────────────────────────────────────────────────────────
 *
 * ONLY RUNTIME-WRITTEN STAGES GET ROWS. The stages a manual shipped with are
 * implied by `cap - requiredOrdinal`, and back-filling them would give the same
 * fact two representations that drift. So `stagesWrittenSince` is a plain
 * COUNT(*), which is exactly what `writtenTo` and `effectiveCapOf` take.
 *
 * ── WHY THIS IS NOT A REPOSITORY ─────────────────────────────────────────
 *
 * It wants to be `src/storage/repos/stage.repo.ts` and it is not one yet, for
 * the same reason `writeObligation` in `encounters.ts` is not: the tables are
 * new, this is their only caller, and lifting them into the repository layer is
 * a move somebody who owns that directory should make rather than something to
 * assume in passing. When it happens these five functions become calls to it
 * and nothing else changes.
 */

import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';

/** Minimal shape of the handle `repos.db` is. Avoids a value import. */
interface DatabaseHandle {
    prepare(sql: string): {
        run(...params: unknown[]): unknown;
        get(...params: unknown[]): unknown;
        all(...params: unknown[]): unknown;
    };
}

const handleOf = (repos: CultivationRepos): DatabaseHandle =>
    repos.db as unknown as DatabaseHandle;

/**
 * Stages written onto this manual AFTER the catalog's own.
 *
 * The number `writtenTo` and `effectiveCapOf` take. Zero for every manual
 * nobody has extended, which is all but a handful of them.
 */
export function stagesWrittenSince(repos: CultivationRepos, manualId: string): number {
    const row = handleOf(repos)
        .prepare('SELECT COUNT(*) AS n FROM technique_stages WHERE manual_id = ?')
        .get(manualId) as { n: number } | undefined;
    return row ? row.n : 0;
}

/**
 * How far past the catalog's ending THIS holder actually stands.
 *
 * Contiguity is the whole point of storing one integer: a stage past the end of
 * the book is worth nothing to somebody who has not reached the end of the
 * book, so there is no gapped set to reconstruct here.
 */
export function stagesHeldBy(
    repos: CultivationRepos,
    cultivatorId: string,
    manualId: string
): number {
    const row = handleOf(repos)
        .prepare(
            'SELECT through_stage FROM cultivator_stages '
            + 'WHERE cultivator_id = ? AND manual_id = ?'
        )
        .get(cultivatorId, manualId) as { through_stage: number } | undefined;
    return row ? Math.max(0, row.through_stage) : 0;
}

export interface WrittenStage {
    manualId: string;
    stageNumber: number;
    authorId: string;
    writtenOnDay: number;
    opacity: number;
}

/**
 * Write the next stage onto a manual, and put its author on it.
 *
 * The stage number is derived rather than passed: it is one past however many
 * have been written since the catalog's, which makes a double call idempotent
 * in intent - the second one writes stage two, not a duplicate of stage one.
 *
 * The author is granted it in the same transaction. Writing something down and
 * not knowing it is not a state this world has.
 */
export function writeStage(
    repos: CultivationRepos,
    input: { manualId: string; authorId: string; onDay: number; opacity: number }
): WrittenStage {
    const db = handleOf(repos);
    let written: WrittenStage | null = null;

    repos.db.transaction(() => {
        const stageNumber = stagesWrittenSince(repos, input.manualId) + 1;
        db.prepare(
            'INSERT OR REPLACE INTO technique_stages '
            + '(manual_id, stage_number, author_id, written_on_day, opacity) '
            + 'VALUES (?, ?, ?, ?, ?)'
        ).run(
            input.manualId,
            stageNumber,
            input.authorId,
            Math.floor(input.onDay),
            input.opacity
        );
        grantStage(repos, input.authorId, input.manualId, stageNumber);
        written = {
            manualId: input.manualId,
            stageNumber,
            authorId: input.authorId,
            writtenOnDay: Math.floor(input.onDay),
            opacity: input.opacity
        };
    })();

    // The transaction body always assigns, and the closure's write is invisible
    // to the checker - so this is a narrowing rather than a fallback.
    return written as unknown as WrittenStage;
}

/**
 * Put a holder one stage further through a manual, or at a stated stage.
 *
 * THE WHOLE OF TRANSMISSION. Teaching somebody a stage, handing them the pages,
 * and writing one yourself are the same write - which is the point of the model
 * rather than a shortcut: what moves is how far this person has got, and how
 * they got there is the fiction around it.
 *
 * Never moves anybody backwards. A holder who already stands further on has
 * been given something they had.
 */
export function grantStage(
    repos: CultivationRepos,
    cultivatorId: string,
    manualId: string,
    through?: number
): number {
    const current = stagesHeldBy(repos, cultivatorId, manualId);
    const next = Math.max(current, through ?? current + 1);
    if (next === current && through !== undefined) return current;

    handleOf(repos).prepare(
        'INSERT INTO cultivator_stages (cultivator_id, manual_id, through_stage) '
        + 'VALUES (?, ?, ?) '
        + 'ON CONFLICT(cultivator_id, manual_id) DO UPDATE SET '
        + 'through_stage = MAX(cultivator_stages.through_stage, excluded.through_stage)'
    ).run(cultivatorId, manualId, next);
    return next;
}

/** Every stage written onto a manual since it shipped, oldest first. */
export function stagesOf(repos: CultivationRepos, manualId: string): WrittenStage[] {
    const rows = handleOf(repos)
        .prepare(
            'SELECT manual_id, stage_number, author_id, written_on_day, opacity '
            + 'FROM technique_stages WHERE manual_id = ? ORDER BY stage_number ASC'
        )
        .all(manualId) as {
            manual_id: string;
            stage_number: number;
            author_id: string | null;
            written_on_day: number | null;
            opacity: number;
        }[];

    return rows.map(row => ({
        manualId: row.manual_id,
        stageNumber: row.stage_number,
        authorId: row.author_id ?? '',
        writtenOnDay: row.written_on_day ?? 0,
        opacity: row.opacity
    }));
}
