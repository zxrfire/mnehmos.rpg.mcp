/**
 * All of it, or none of it - and a rolled-back world is not trusted.
 *
 * The runner's whole job is two guarantees the engine did not have: that the
 * SQLite rows and the world write land in one transaction, and that a body
 * which threw does not leave this process holding a world that never existed.
 * SQLite rolls back; a JavaScript object does not.
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import { commitOneTransition, type TheWorldAtHand } from '../../../src/server/state/transition-runner';
import { readWorldRevision } from '../../../src/server/state/world-revision';
import { migrate } from '../../../src/storage/migrations';
import { migrateWorld } from '../../../src/storage/migrations.world';
import { createWorld } from '../../../src/engine/world/world-state';
import type { WorldState } from '../../../src/engine/world/world-state';

function aDatabase(): Database.Database {
    const db = new Database(':memory:');
    migrate(db);
    migrateWorld(db);
    db.exec("CREATE TABLE IF NOT EXISTS scratch (id INTEGER PRIMARY KEY, note TEXT)");
    return db;
}

/** A world row the revision can be bumped against. */
function aWorldRow(db: Database.Database, id: string): WorldState {
    const state = createWorld({ seed: id, skipPriorAges: true, regionCount: 1 });
    db.prepare('INSERT INTO world_runtime (id, seed, current_day) VALUES (?, ?, ?)')
        .run(id, id, 0);
    return { ...state, id };
}

interface Spy extends TheWorldAtHand {
    appends: number;
    forgets: number;
}

function watching(id: string, state: WorldState): Spy {
    return {
        id,
        state,
        appends: 0,
        forgets: 0,
        append() { this.appends += 1; },
        forget() { this.forgets += 1; }
    } as Spy;
}

function notes(db: Database.Database): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM scratch').get() as { n: number }).n;
}

describe('a transition that succeeds', () => {
    it('writes the world once and advances the revision once', () => {
        const db = aDatabase();
        const at = watching('w1', aWorldRow(db, 'w1'));
        const done = commitOneTransition({
            db,
            at,
            onDay: 10,
            body: ctx => {
                db.prepare('INSERT INTO scratch (note) VALUES (?)').run('a row');
                ctx.markWorldChanged();
                return 'settled';
            }
        });
        expect(done.result).toBe('settled');
        expect(at.appends).toBe(1);
        expect(done.revision).toBe(1);
        expect(readWorldRevision(db, 'w1')).toBe(1);
        expect(notes(db)).toBe(1);
        db.close();
    });

    it('does not write a world the body never changed', () => {
        const db = aDatabase();
        const at = watching('w2', aWorldRow(db, 'w2'));
        commitOneTransition({
            db,
            at,
            onDay: 10,
            body: () => { db.prepare('INSERT INTO scratch (note) VALUES (?)').run('rows only'); }
        });
        // A read-only-on-the-world transition still commits its rows and still
        // moves the revision - what it does not do is pay for a world write.
        expect(at.appends).toBe(0);
        expect(notes(db)).toBe(1);
        db.close();
    });

    it('carries out what the body left behind', () => {
        const db = aDatabase();
        const at = watching('w3', aWorldRow(db, 'w3'));
        const done = commitOneTransition({
            db,
            at,
            onDay: 44,
            body: ctx => {
                ctx.emit({ kind: 'fact', factId: 'f1', day: ctx.onDay, summary: '' });
                ctx.emit({
                    kind: 'field_changed',
                    entity: 'npc', entityId: 'npc-1', field: 'status',
                    from: 'alive', to: 'dead'
                });
            }
        });
        expect(done.events.map(e => e.kind)).toEqual(['fact', 'field_changed']);
        db.close();
    });

    it('projects every event inside the same transaction as the change', () => {
        const db = aDatabase();
        const at = watching('w4', aWorldRow(db, 'w4'));
        commitOneTransition({
            db,
            at,
            onDay: 1,
            body: ctx => {
                db.prepare('INSERT INTO scratch (note) VALUES (?)').run('the change');
                ctx.emit({ kind: 'fact', factId: 'f1', day: 1, summary: '' });
            },
            project: event => {
                db.prepare('INSERT INTO scratch (note) VALUES (?)').run('projected:' + event.kind);
            }
        });
        expect(notes(db)).toBe(2);
        db.close();
    });
});

describe('a transition that throws', () => {
    it('leaves no row behind', () => {
        const db = aDatabase();
        const at = watching('w5', aWorldRow(db, 'w5'));
        expect(() => commitOneTransition({
            db,
            at,
            onDay: 10,
            body: ctx => {
                db.prepare('INSERT INTO scratch (note) VALUES (?)').run('half a death');
                ctx.markWorldChanged();
                throw new Error('the body could not be emptied');
            }
        })).toThrow(/could not be emptied/);
        // This is the assertion that failed on its first line before the
        // boundary existed: the row was already committed by then.
        expect(notes(db)).toBe(0);
        db.close();
    });

    it('does not advance the revision', () => {
        const db = aDatabase();
        const at = watching('w6', aWorldRow(db, 'w6'));
        expect(() => commitOneTransition({
            db, at, onDay: 10,
            body: () => { throw new Error('no'); }
        })).toThrow();
        expect(readWorldRevision(db, 'w6')).toBe(0);
        db.close();
    });

    it('FORGETS the world, because the graph it mutated did not roll back', () => {
        const db = aDatabase();
        const at = watching('w7', aWorldRow(db, 'w7'));
        expect(() => commitOneTransition({
            db, at, onDay: 10,
            body: ctx => {
                // A real body mutates the world in place before it fails.
                ctx.world!.currentDay = 999;
                ctx.markWorldChanged();
                throw new Error('and then it fell over');
            }
        })).toThrow();
        // The in-memory day is still wrong - that is the point. Nothing can fix
        // it in place, so the handle is dropped and the next touch reloads.
        expect(at.state.currentDay).toBe(999);
        expect(at.forgets).toBe(1);
        db.close();
    });

    it('does not write the world it was about to write', () => {
        const db = aDatabase();
        const at = watching('w8', aWorldRow(db, 'w8'));
        expect(() => commitOneTransition({
            db, at, onDay: 10,
            body: ctx => { ctx.markWorldChanged(); throw new Error('no'); }
        })).toThrow();
        expect(at.appends).toBe(0);
        db.close();
    });
});

describe('a transition in a run with no world', () => {
    it('still commits its rows, and asks nobody for a revision', () => {
        const db = aDatabase();
        const done = commitOneTransition({
            db,
            at: null,
            onDay: 3,
            body: () => { db.prepare('INSERT INTO scratch (note) VALUES (?)').run('worldless'); }
        });
        expect(done.revision).toBe(0);
        expect(notes(db)).toBe(1);
        db.close();
    });

    it('and still rolls back', () => {
        const db = aDatabase();
        expect(() => commitOneTransition({
            db, at: null, onDay: 3,
            body: () => {
                db.prepare('INSERT INTO scratch (note) VALUES (?)').run('doomed');
                throw new Error('no');
            }
        })).toThrow();
        expect(notes(db)).toBe(0);
        db.close();
    });
});

describe('nesting, because production already does it', () => {
    it('runs a transition inside a transaction the caller opened', () => {
        const db = aDatabase();
        const at = watching('w9', aWorldRow(db, 'w9'));
        db.transaction(() => {
            db.prepare('INSERT INTO scratch (note) VALUES (?)').run('the caller');
            commitOneTransition({
                db, at, onDay: 1,
                body: () => { db.prepare('INSERT INTO scratch (note) VALUES (?)').run('the transition'); }
            });
        })();
        expect(notes(db)).toBe(2);
        db.close();
    });
});
