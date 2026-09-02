/**
 * Rewrite existence claims filed under a catalog person's world-row id.
 *
 * ── Why a live save needs touching at all ────────────────────────────────
 *
 * The content catalogs name a hundred and eighty-six people by a CATALOG id
 * and `seedNamedFigures` instantiates each of them into the world as `npc-`
 * plus that id. `KnowledgeGate` keys existence claims by exact id, and until
 * the fold landed in `existenceClaimKey` the two halves of the game wrote
 * different keys for the same human being: the hearsay layer wrote the
 * catalog's, and meeting somebody wrote the world row's.
 *
 * So an existing database holds BOTH forms, for the same person, for the same
 * holder. Once `existenceClaimKey` folds every person onto the catalog id, the
 * rows written under the world id would stop resolving - which is a player
 * losing names they had already earned, and is a worse outcome than the bug
 * this is part of fixing. The whole argument for the direction of the fold is
 * in `engine/world/a-catalog-person-and-their-world-row.ts`.
 *
 * ── What it does, and what it deliberately does not ──────────────────────
 *
 * One `UPDATE` per affected key, inside one transaction: the claim key is
 * rewritten and nothing else about the row is touched - not its stance, not
 * its source, not its day, not its stage tag. Several rows under one claim key
 * is already the normal and intended case (`provenanceOf` returns the chain
 * oldest-first, and `stageOf` takes the highest), so a holder who overheard a
 * name and later met the person ends with one ladder built out of both
 * acquisitions rather than two that cannot see each other. That is what the
 * module documents and what it was failing to deliver.
 *
 * Nothing is deleted and nothing is merged. A rewrite that collapsed two rows
 * into one would throw away the provenance the table exists to keep.
 *
 * ── Idempotent, and cheap when there is nothing to do ────────────────────
 *
 * `migrate(db)` runs in full every time a process opens a database, so this is
 * written to cost one indexed count on the overwhelmingly common path where
 * there is nothing to rewrite. Running it twice rewrites nothing the second
 * time, because after the first pass no key matches the pattern.
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
