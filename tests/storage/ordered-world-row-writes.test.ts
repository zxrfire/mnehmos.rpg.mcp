/**
 * At walked age 300 a short flight still spent over three sampled seconds in
 * SQLite run calls after the route optimizations. World appends rewrote every
 * mutable row. Conditional updates must preserve the REPLACE writer's observable
 * reload sequence, including omitted historical rows and repeated identities.
 * Each arm below starts with the same rows in the same command and compares all
 * persisted values in reload order. No simulation or second row store is needed.
 */
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { OrderedWorldRowWrites } from '../../src/storage/repos/ordered-world-row-writes';

function arrangement() {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE world_rows (
        world_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL,
        note TEXT, amount REAL, PRIMARY KEY(world_id, id, kind)
    )`);
    const replace = db.prepare(`INSERT OR REPLACE INTO world_rows (world_id, id, kind, note, amount)
        VALUES (@worldId, @id, @kind, @note, @amount)`);
    const writer = new OrderedWorldRowWrites(db, replace);
    const read = (world: string) => db.prepare('SELECT * FROM world_rows WHERE world_id = ? ORDER BY rowid').all(world)
        .map(row => ({ ...(row as object), world_id: 'same-world' }));
    const write = (worldId: string, ids: readonly string[], fast = false) => {
        const statement = fast ? writer.forOrder(worldId, ids.map(id => [id, 'kin'])) : replace;
        ids.forEach((id, i) => statement.run({ worldId, id, kind: 'kin', note: i % 2 ? null : `row-${i}`, amount: i + .5 }));
    };
    return { db, replace, writer, read, write };
}

it('matches replacement values and ordering across every short sequence, omissions and duplicate IDs', () => {
    const h = arrangement();
    try {
        const sequences: string[][] = [[]];
        let layer: string[][] = [[]];
        for (let length = 1; length <= 4; length++) {
            layer = layer.flatMap(prefix => ['a', 'b', 'c'].map(id => [...prefix, id]));
            sequences.push(...layer);
        }
        for (const initial of [[], ['a', 'b'], ['c', 'a', 'b'], ['b', 'a']]) for (const next of sequences) {
            h.db.exec('DELETE FROM world_rows');
            h.write('control', initial); h.write('optimized', initial);
            h.write('control', next); h.write('optimized', next, true);
            expect(h.read('optimized'), JSON.stringify({ initial, next })).toEqual(h.read('control'));
        }
    } finally { h.db.close(); }
});

it('reads external changes and rolled-back writes without a cached copy of a row', () => {
    const h = arrangement();
    try {
        h.write('control', ['a', 'b']); h.write('optimized', ['a', 'b'], true);
        const rollback = new Error('rollback');
        expect(() => h.db.transaction(() => { h.write('optimized', ['b', 'c'], true); throw rollback; })()).toThrow(rollback);
        expect(h.read('optimized')).toEqual(h.read('control'));
        // Another repository can replace a row between batches, or clear a field.
        for (const worldId of ['control', 'optimized']) h.replace.run({ worldId, id: 'a', kind: 'kin', note: 'external', amount: null });
        h.write('control', ['a', 'b']); h.write('optimized', ['a', 'b'], true);
        expect(h.read('optimized')).toEqual(h.read('control'));
    } finally { h.db.close(); }
});

it('keeps each kind of a relationship and each world distinct', () => {
    const h = arrangement();
    try {
        const keys = [['a', 'kin'], ['a', 'master'], ['b', 'kin']];
        for (let pass = 0; pass < 2; pass++) for (const worldId of ['control', 'optimized']) {
            const statement = worldId === 'optimized' ? h.writer.forOrder(worldId, keys) : h.replace;
            keys.forEach(([id, kind], i) => statement.run({ worldId, id, kind, note: pass ? null : kind, amount: pass + i }));
        }
        expect(h.read('optimized')).toEqual(h.read('control'));
        h.write('optimized', ['b'], true);
        expect(h.read('control')).toHaveLength(3);
    } finally { h.db.close(); }
});
