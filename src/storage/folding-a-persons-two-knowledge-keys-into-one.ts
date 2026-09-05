/**
 * Rewrite existence claims filed under a catalog person's world-row id.
 *
 * An existing database holds BOTH forms for the same person and holder: the
 * hearsay layer wrote the catalog id, meeting somebody wrote the `npc-` world
 * row. Now that `existenceClaimKey` folds onto the catalog id, the rows written
 * under the world id would stop resolving - a player losing names they had
 * already earned. The direction of the fold is argued in
 * `engine/world/a-catalog-person-and-their-world-row.ts`.
 *
 * NOTHING IS DELETED AND NOTHING IS MERGED - one `UPDATE` per affected key,
 * rewriting the claim key and touching nothing else. Several rows under one
 * claim key is the normal case, and collapsing two into one would throw away the
 * provenance the table exists to keep.
 *
 * `migrate(db)` runs in full on every open, so this costs one indexed count on
 * the common path and rewrites nothing on a second run.
 */

import type Database from 'better-sqlite3';

import {
    catalogPersonBehind,
    WORLD_ROW_PREFIX
} from '../engine/world/a-catalog-person-and-their-world-row.js';

/** Tables that file a row against a claim key. Both are rewritten together. */
const KEYED_TABLES = ['knowledge_records', 'knowledge_revisions'] as const;

const STALE_PREFIX = `exists:cultivator:${WORLD_ROW_PREFIX}`;

export function foldPersonKnowledgeKeys(db: Database.Database): void {
    let rewritten = 0;

    for (const table of KEYED_TABLES) {
        // The table may not exist on a very old database opened out of order.
        const present = db
            .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
            .get(table);
        if (!present) continue;

        // Only the keys that are actually a catalog person's world row. Every
        // other `npc-` id - procedural, apex, above the Lid - is somebody whose
        // only id is the one they have, and must be left exactly as it is.
        const stale = db
            .prepare(`SELECT DISTINCT claim_key FROM ${table} WHERE claim_key LIKE ?`)
            .all(`${STALE_PREFIX}%`) as { claim_key: string }[];
        if (stale.length === 0) continue;

        const update = db.prepare(
            `UPDATE ${table} SET claim_key = ? WHERE claim_key = ?`
        );

        db.transaction(() => {
            for (const row of stale) {
                const behind = catalogPersonBehind(
                    row.claim_key.slice('exists:cultivator:'.length)
                );
                if (!behind) continue;
                rewritten += update.run(`exists:cultivator:${behind}`, row.claim_key).changes;
            }
        })();
    }

    if (rewritten > 0) {
        // stderr, because stdout is the MCP transport.
        console.error(
            `[Migration] Folded ${rewritten} existence claim(s) onto the catalog id of the `
            + 'person they were about. A name earned before the fold is still a name held.'
        );
    }
}
