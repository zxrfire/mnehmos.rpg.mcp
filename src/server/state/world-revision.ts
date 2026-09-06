/**
 * THE WORLD'S OWN COUNTER.
 *
 * One integer per world, bumped by every committed transition. It exists so a
 * process holding a cached `WorldState` can ask whether what it is holding is
 * still the world.
 *
 * ── AND IT IS NOT `world_runtime.version` ────────────────────────────────
 *
 * That column already means something: it is the SCHEMA version the loader
 * migrates a saved world against, read at `world-state.repo.ts` in `loadWorld`
 * and `listWorlds` and written on save. Putting a second meaning on it would
 * make every load compare a revision against a schema number.
 *
 * ── WHY IT LANDS WITH ITS READER ─────────────────────────────────────────
 *
 * `cultivation-world.ts` keeps loaded worlds in a process-global `Map` and
 * nothing revalidates them. A second process, a migration, or a test that wrote
 * through the repository leaves that cache holding a world that is no longer
 * the one on disk, and the next append writes the stale copy back over it.
 *
 * So the counter and the staleness check are one change. A revision column with
 * no reader would be a dead export added by a refactor whose whole point is to
 * remove them.
 */

import type Database from 'better-sqlite3';

/** The column. Guarded-ALTERed onto `world_runtime` by the world migration. */
export const WORLD_REVISION_COLUMN = 'revision';

/**
 * What a world that has never committed a transition is at.
 *
 * Zero, and every existing saved world starts here, which is right: none of
 * them has been through a transition and none of the caches holding them can
 * claim to be current on that basis.
 */
export const A_WORLD_THAT_HAS_NOT_MOVED = 0;

/** Read a world's revision. Absent row or absent column reads as unmoved. */
export function readWorldRevision(db: Database.Database, worldId: string): number {
    try {
        const row = db
            .prepare(`SELECT ${WORLD_REVISION_COLUMN} AS revision FROM world_runtime WHERE id = ?`)
            .get(worldId) as { revision: number | null } | undefined;
        return Number(row?.revision ?? A_WORLD_THAT_HAS_NOT_MOVED);
    } catch {
        // A database migrated by an older build. Unmoved is the honest answer
        // and makes every cached handle look stale, which is the safe way to
        // be wrong.
        return A_WORLD_THAT_HAS_NOT_MOVED;
    }
}

/**
 * Bump it, and report what it now is.
 *
 * Must be called INSIDE the transition's transaction. A revision that advanced
 * without the change it describes is worse than no revision: it tells every
 * cache that a stale world is current.
 */
export function advanceWorldRevision(db: Database.Database, worldId: string): number {
    db.prepare(
        `UPDATE world_runtime SET ${WORLD_REVISION_COLUMN} = ${WORLD_REVISION_COLUMN} + 1 WHERE id = ?`
    ).run(worldId);
    return readWorldRevision(db, worldId);
}
