/**
 * What material is actually within reach of a commission.
 *
 * `whetherTheirHandsCanDoIt` asks for the catalog ids on the bench, and until
 * this existed no call site in `src/web/` could answer, so the material gate was
 * wired in the engine and reachable by nobody - which is the same defect the
 * gate itself was fixing, one layer up.
 *
 * ── WHOSE MATERIAL IS THE BENCH ─────────────────────────────────────────
 *
 * WHOEVER ASKED BRINGS THE STUFF, plus whatever the maker happens to be
 * carrying. That is the genre's own arrangement and it is what the commission
 * price is a price FOR: `whatACommissionComesTo` is a year of the income of the
 * rung that can only just make one, which is a fee for a pair of hands and not
 * a bill for materials.
 *
 * A HOUSE'S STORES ARE NOT ON THIS BENCH, and that is deliberate rather than an
 * omission. Whether something leaves a treasury already has a door -
 * `whetherItLeavesTheStore`, and the offices behind it - and a commission that
 * silently drew on a house's stock would be a second way through it.
 */

import type Database from 'better-sqlite3';
import { whatAnIngredientIs } from '../engine/cultivation/what-a-cauldron-will-take.js';
import type { ObjectRecord } from '../engine/world/possessions.js';

/**
 * Catalog ids of the material this pouch holds, one entry per unit, so two of a
 * thing is two things - `whatTheBenchIsShortOf` spends one per slot.
 *
 * Pills and books in the same table resolve to nothing and drop out, which is
 * what `whatAnIngredientIs` returning null means.
 */
export function materialInThePouch(db: Database.Database, holderId: string): string[] {
    const rows = db
        .prepare(`
            SELECT item_id, quantity FROM cultivator_pouch
            WHERE holder_id = ? AND quantity > 0
            ORDER BY item_id ASC
        `)
        .all(holderId) as { item_id: string; quantity: number }[];
    const out: string[] = [];
    for (const row of rows) {
        if (whatAnIngredientIs(row.item_id) === null) continue;
        for (let i = 0; i < Math.min(row.quantity, A_STACK_WORTH_COUNTING); i++) {
            out.push(row.item_id);
        }
    }
    return out;
}

/**
 * No recipe asks for more than a handful of one thing, so a stack of four
 * hundred is counted to a few and the rest is never looked at.
 */
const A_STACK_WORTH_COUNTING = 8;

/** Catalog ids of the material rows this person is physically carrying. */
export function materialBeingCarriedBy(
    objects: readonly ObjectRecord[],
    personId: string
): string[] {
    const out: string[] = [];
    for (const row of objects) {
        if (row.possessorId !== personId) continue;
        if (row.kind !== 'material') continue;
        const id = typeof row.data.materialId === 'string' ? row.data.materialId : null;
        if (id === null || whatAnIngredientIs(id) === null) continue;
        const quantity = typeof row.data.quantity === 'number' ? row.data.quantity : 1;
        for (let i = 0; i < Math.min(Math.max(1, quantity), A_STACK_WORTH_COUNTING); i++) {
            out.push(id);
        }
    }
    return out;
}
