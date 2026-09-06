/**
 * WHAT A TRANSITION IS, AND WHAT IT LEAVES BEHIND.
 *
 * Redux as DISCIPLINE, not as a second store. SQLite is the state; nothing here
 * holds any. What is borrowed is the shape:
 *
 *     a Command says what was asked for
 *     a Transition is the one function allowed to change anything about it
 *     a Transaction is the boundary it commits in - all of it or none of it
 *     Events are what it left behind, for whoever has to be told
 *
 * ── WHY, MEASURED ────────────────────────────────────────────────────────
 *
 * Before this existed: 237 SQL write statements over 91 tables, plus 265
 * in-place mutations of an in-memory `WorldState`, reaching durability through
 * 85 independent `db.transaction()` calls and two deferred world flushes. No
 * write site declared what it needed to be atomic with; 85 callers each decided
 * separately. A single `cultivate` turn committed six times at minimum.
 *
 * The death path was the plainest case: five commits, zero transactions.
 * `enshrineRun`, `upsertObject` and `upsertNpc` touched RAM; `ledger.write` and
 * `emptyTheBody`'s two statements each autocommitted. A failure between any two
 * left a cultivator dead with their pouch still full, or emptied with no grave.
 *
 * ── AND WHY THERE IS NO EVENT TABLE ──────────────────────────────────────
 *
 * Event sourcing requires that replaying the log reproduces the state. This
 * engine has released reproducibility: a run may draw the same SETS of numbers
 * and still differ run to run. So a log of what happened is a RECORD, not a
 * recipe, and promoting one to the source of truth would be promising something
 * the design has already declined to give.
 *
 * Events here are therefore projections onto readers that already exist -
 * `appendWorldFact` for the fact, the obligation ledger for the accounts - and
 * they are written inside the same transaction as the change they describe, so
 * a fact never survives the thing it is about.
 */

/**
 * What was asked for.
 *
 * A closed union deliberately: the point of naming commands is that the set is
 * countable, and a `kind: string` would be the 85 scattered write sites again
 * wearing a type.
 */
export type Command =
    /** This run's cultivator died and their estate has to be settled. */
    | { kind: 'die'; runId: string; cultivatorId: string };

/** What a transition left behind, for whoever has to be told. */
export type TransitionEvent =
    /**
     * One field of one record moved.
     *
     * The shape `world-state.ts` has produced since it was written, retargeted
     * off the actor tier that was deleted onto the records that exist.
     */
    | {
        kind: 'field_changed';
        entity: 'npc' | 'faction' | 'location' | 'object' | 'cultivator';
        entityId: string;
        field: string;
        from: string | number | boolean | null;
        to: string | number | boolean | null;
    }
    /** Something happened that the world should remember happened. */
    | { kind: 'fact'; factId: string; day: number; summary: string };

/**
 * What one committed transition did.
 *
 * `revision` is the world's own counter after the commit, so a caller holding a
 * cached world can tell whether what it is holding is still the world.
 */
export interface WhatTheTransitionDid<T> {
    result: T;
    revision: number;
    events: readonly TransitionEvent[];
}
