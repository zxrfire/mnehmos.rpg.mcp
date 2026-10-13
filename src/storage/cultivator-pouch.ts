/** The actual pouch has one SQL quantity reader and one pair of stock writers. */
import type Database from 'better-sqlite3';
import type { PouchItemKind } from '../engine/world/what-a-body-can-carry-and-what-a-ring-holds.js';

export function pouchQuantity(
    db: Database.Database,
    cultivatorId: string,
    itemId: string
): number {
    const row = db
        .prepare('SELECT quantity FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
        .get(cultivatorId, itemId) as { quantity: number } | undefined;
    return row ? row.quantity : 0;
}

export function addToPouch(
    db: Database.Database,
    cultivatorId: string,
    itemId: string,
    kind: PouchItemKind,
    quantity: number
): void {
    const amount = Math.max(0, Math.floor(quantity));
    if (amount === 0) return;
    db.prepare(`
        INSERT INTO cultivator_pouch (holder_id, item_id, item_kind, quantity, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(holder_id, item_id) DO UPDATE SET
            quantity = cultivator_pouch.quantity + excluded.quantity,
            updated_at = excluded.updated_at
    `).run(cultivatorId, itemId, kind, amount);
}

/** Remove stock. Returns false and writes nothing when the pouch is short. */
export function removeFromPouch(
    db: Database.Database,
    cultivatorId: string,
    itemId: string,
    quantity: number
): boolean {
    const amount = Math.max(0, Math.floor(quantity));
    if (amount === 0) return true;
    const held = pouchQuantity(db, cultivatorId, itemId);
    if (held < amount) return false;
    db.prepare(`
        UPDATE cultivator_pouch SET quantity = quantity - ?, updated_at = datetime('now')
        WHERE holder_id = ? AND item_id = ?
    `).run(amount, cultivatorId, itemId);
    return true;
}
