/** Conditional world-row upserts preserve the existing replacement writer's reload order. */
import type Database from 'better-sqlite3';

type RowKey = string | readonly string[];

/** No row values are cached: each batch reads the current transaction's keys,
 * and SQLite compares its actual columns. Rollbacks and other writers therefore
 * need no invalidation. Only prepared statements survive a batch.
 */
export class OrderedWorldRowWrites {
    private readonly keys: Database.Statement;
    private readonly update: Database.Statement;

    constructor(db: Database.Database, private readonly replace: Database.Statement) {
        // These are this repository's own single-row, named-parameter inserts.
        // Derive the conditional update from their column list so a new stored
        // field cannot be omitted from a parallel comparison or update list.
        const match = replace.source.match(/^\s*INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*$/);
        if (!match) throw new Error('Expected an ordinary world row replacement');
        const [, table, list] = match;
        const columns = list.split(',').map(column => column.trim());
        const primary = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; pk: number }[])
            .filter(column => column.pk > 0).sort((a, b) => a.pk - b.pk).map(column => column.name);
        if (!primary.includes('world_id')) throw new Error('Expected world-scoped primary keys');
        const mutable = columns.filter(column => !primary.includes(column));
        const identity = primary.filter(column => column !== 'world_id');
        this.keys = db.prepare(`SELECT ${identity.join(', ')} FROM ${table} WHERE world_id = ? ORDER BY rowid ASC`).raw();
        this.update = db.prepare(`${replace.source.replace('INSERT OR REPLACE', 'INSERT')}
            ON CONFLICT(${primary.join(', ')}) DO UPDATE SET
                ${mutable.map(column => `${column} = excluded.${column}`).join(', ')}
            WHERE ${mutable.map(column => `${table}.${column} IS NOT excluded.${column}`).join(' OR ')}`);
    }

    /** REPLACE moves a row to the tail, including on repeated identities.
     * Use updates only when keeping existing positions and appending new ones
     * yields that exact same sequence; otherwise retain the original writer.
     * Input keys follow the table's primary-key order, excluding world_id.
     */
    forOrder(worldId: string, incoming: readonly RowKey[]): Database.Statement {
        const rows = this.keys.all(worldId) as string[][];
        // The ordinary unchanged snapshot already has REPLACE's final order.
        // Compare actual key columns first, without serializing keys or building
        // the four sets/arrays needed for omissions, reorders and duplicates.
        if (rows.length === incoming.length && rows.every((row, at) => {
            const key = incoming[at]!;
            return typeof key === 'string' ? row.length === 1 && row[0] === key
                : row.length === key.length && row.every((value, column) => value === key[column]);
        })) return this.update;
        const existing = rows.map(row => JSON.stringify(row));
        const written = incoming.map(key => JSON.stringify(typeof key === 'string' ? [key] : key));
        const last = new Set<string>();
        const tail: string[] = [];
        for (let i = written.length - 1; i >= 0; i--) {
            const key = written[i]!;
            if (!last.has(key)) { last.add(key); tail.push(key); }
        }
        const expected = existing.filter(key => !last.has(key)).concat(tail.reverse());
        const seen = new Set(existing);
        const updated = existing.slice();
        for (const key of written) if (!seen.has(key)) { seen.add(key); updated.push(key); }
        return expected.length === updated.length && expected.every((key, at) => key === updated[at])
            ? this.update : this.replace;
    }
}
