/**
 * THE ONE PLACE A CHANGE BECOMES DURABLE.
 *
 * A transition body runs inside one SQLite transaction, its world write goes in
 * the same transaction, its events are projected in the same transaction, and
 * the world's revision advances in the same transaction. All of it, or none.
 *
 * ── THE THREE RULINGS THIS FILE ENFORCES ─────────────────────────────────
 *
 * 1. IT IS SYNCHRONOUS BY CONSTRUCTION, and the type says so. better-sqlite3
 *    cannot hold a transaction across an `await` - the connection would commit
 *    other work in between. Anything a transition needs that is async is
 *    acquired BEFORE the boundary, in the caller's prologue, and handed in.
 *
 * 2. THE WORLD WRITE IS `appendWorld` AND ONLY EVER `appendWorld`. `saveWorld`
 *    clears all 25 world tables and re-inserts, so it is lifecycle-only - a
 *    reviewer who "unifies the two write modes" destroys a world. `appendWorld`
 *    skips the chronicle and memory bulk below its high-water mark, which is
 *    the difference between a five-century soak costing one write and five
 *    hundred.
 *
 * 3. SQLITE ROLLS BACK AND A JAVASCRIPT OBJECT DOES NOT. The world is an
 *    in-memory graph that a failed body has already mutated. On a throw the
 *    handle is FORGOTTEN rather than trusted: the next touch reloads it from
 *    the rows the rollback restored. Anything else leaves the process holding a
 *    world that never existed.
 */

import type Database from 'better-sqlite3';
import type { WorldState } from '../../engine/world/world-state.js';
import type { TransitionEvent, WhatTheTransitionDid } from '../../schema/transitions.js';
import { advanceWorldRevision } from './world-revision.js';

/** What a transition body is handed. */
export interface TransitionContext {
    /** The connection. Already inside the transaction. */
    db: Database.Database;
    /**
     * The world, or null for a transition in a run with no world.
     *
     * Mutating it is allowed and is how the world half of a change happens -
     * but it is only written back if the body says it changed.
     */
    world: WorldState | null;
    /** The day the change happens on. */
    onDay: number;
    /** Leave something behind for whoever has to be told. */
    emit(event: TransitionEvent): void;
    /**
     * Say the world moved.
     *
     * Explicit rather than inferred, because "did this graph change" is not a
     * question that can be asked of an object without deep-comparing it, and a
     * body that changed nothing should not pay for a write.
     */
    markWorldChanged(): void;
}

/** What the runner needs from the world layer, and nothing more. */
export interface TheWorldAtHand {
    id: string;
    state: WorldState;
    /**
     * `appendWorld`, and never `saveWorld`. See ruling 2.
     */
    append(state: WorldState): void;
    /**
     * Drop the cached handle so the next touch reloads from disk. See ruling 3.
     */
    forget(): void;
    /**
     * The handle is now at this revision.
     *
     * Told rather than inferred, because the handle that ran the transition is
     * the one that is current - and a cache that cannot be told would read its
     * own writes as somebody else's and reload the world after every commit.
     */
    nowAt?(revision: number): void;
}

/**
 * Run one transition and commit it.
 *
 * SYNCHRONOUS. If you find yourself wanting an `await` in `body`, the thing you
 * are awaiting belongs above this call.
 */
export function commitOneTransition<T>(input: {
    db: Database.Database;
    /** The world this changes, or null where it changes none. */
    at: TheWorldAtHand | null;
    onDay: number;
    body: (ctx: TransitionContext) => T;
    /**
     * Where an event goes once the change is committed alongside it.
     *
     * Optional, and deliberately a parameter rather than a table: events are
     * projected onto readers that already exist. See `schema/transitions.ts`.
     */
    project?: (event: TransitionEvent, ctx: TransitionContext) => void;
}): WhatTheTransitionDid<T> {
    const events: TransitionEvent[] = [];
    let worldChanged = false;

    const ctx: TransitionContext = {
        db: input.db,
        world: input.at?.state ?? null,
        onDay: input.onDay,
        emit: event => { events.push(event); },
        markWorldChanged: () => { worldChanged = true; }
    };

    let revision = 0;
    try {
        const result = input.db.transaction(() => {
            const out = input.body(ctx);

            // The events, before the world write, so a projector that touches
            // the world is inside the same append.
            if (input.project) for (const event of events) input.project(event, ctx);

            if (input.at && worldChanged) input.at.append(input.at.state);
            revision = input.at ? advanceWorldRevision(input.db, input.at.id) : 0;
            return out;
        })();
        input.at?.nowAt?.(revision);
        return { result, revision, events };
    } catch (err) {
        // SQLite is clean. The world graph is not.
        input.at?.forget();
        throw err;
    }
}
