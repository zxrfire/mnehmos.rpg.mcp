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
 *
 * ── A UNIT SAYS WHERE IT IS, BECAUSE SOMETHING HAS TO TAKE IT OFF ────────
 *
 * This file first answered in bare catalog ids, which is all a GATE needs: a
 * list of what is here, spent one per slot. It is not enough to spend anything
 * by. Two Stone Ox Horns are two units of one id, and they can be in two
 * different places - one counted in a pouch row, one a tracked object row on
 * somebody's belt - so a taker handed the id alone has to pick, and picking is
 * how a thing gets taken off the wrong person or taken off nobody. Each unit
 * carries its holder and its row.
 */

import type Database from 'better-sqlite3';
import { whatAnIngredientIs } from '../engine/cultivation/what-a-cauldron-will-take.js';
import type { ObjectRecord } from '../engine/world/possessions.js';

/**
 * One piece of material within reach, and where it actually is.
 */
export interface AUnitOnTheBench {
    materialId: string;
    /** Whose hands it is in. */
    holderId: string;
    /**
     * The world object row this unit IS, where it is one, and null where the
     * unit is only a counted stack.
     *
     * Not the same question as the grade's tier. `howAGradeIsStored` says which
     * tier a grade BELONGS in and is the authority on that; this says which
     * rows are actually here for this particular unit. A tracked material has
     * BOTH - `hunt` writes the pouch row beside the object row on purpose, the
     * object row being which one this is and the pouch row being the thing a
     * counter quotes - and a taker has to end both, or the world goes on saying
     * you are holding a thing you already spent.
     */
    objectId: string | null;
    /** Whether a counted stack stands for this unit as well. */
    countedInThePouch: boolean;
}

/**
 * Everything one person could put on a bench: what they carry as rows, and what
 * they carry as stock, with the two halves of a tracked thing counted ONCE.
 *
 * THE DOUBLE COUNT IS THE WHOLE REASON THIS FUNCTION EXISTS. A heaven-grade
 * horn in somebody's hands is two records of one physical object, so adding the
 * two reads together gives a bench holding two horns, and a recipe wanting one
 * heart and one body would be satisfied by a single horn twice over. Pairing
 * them here means the gate and the spend both see one.
 */
export function whatThisPersonHasOnTheBench(
    db: Database.Database,
    objects: readonly ObjectRecord[],
    personId: string
): AUnitOnTheBench[] {
    const carried = unitsBeingCarriedBy(objects, personId);
    const stock = unitsInThePouch(db, personId);
    const bench: AUnitOnTheBench[] = [];
    for (const unit of carried) {
        const at = stock.findIndex(row => row.materialId === unit.materialId);
        if (at >= 0) stock.splice(at, 1);
        bench.push({ ...unit, countedInThePouch: at >= 0 });
    }
    return bench.concat(stock);
}

/**
 * The material this pouch holds, one entry per unit, so two of a thing is two
 * things - a recipe spends one per slot.
 *
 * Pills and books in the same table resolve to nothing and drop out, which is
 * what `whatAnIngredientIs` returning null means.
 */
export function unitsInThePouch(
    db: Database.Database,
    holderId: string
): AUnitOnTheBench[] {
    const rows = db
        .prepare(`
            SELECT item_id, quantity FROM cultivator_pouch
            WHERE holder_id = ? AND quantity > 0
            ORDER BY item_id ASC
        `)
        .all(holderId) as { item_id: string; quantity: number }[];
    const out: AUnitOnTheBench[] = [];
    for (const row of rows) {
        if (whatAnIngredientIs(row.item_id) === null) continue;
        for (let i = 0; i < Math.min(row.quantity, A_STACK_WORTH_COUNTING); i++) {
            out.push({
                materialId: row.item_id, holderId, objectId: null, countedInThePouch: true
            });
        }
    }
    return out;
}

/**
 * No recipe asks for more than a handful of one thing, so a stack of four
 * hundred is counted to a few and the rest is never looked at.
 */
const A_STACK_WORTH_COUNTING = 8;

/** The material rows this person is physically carrying. */
export function unitsBeingCarriedBy(
    objects: readonly ObjectRecord[],
    personId: string
): AUnitOnTheBench[] {
    const out: AUnitOnTheBench[] = [];
    for (const row of objects) {
        if (row.possessorId !== personId) continue;
        if (row.kind !== 'material') continue;
        const id = typeof row.data.materialId === 'string' ? row.data.materialId : null;
        if (id === null || whatAnIngredientIs(id) === null) continue;
        const quantity = typeof row.data.quantity === 'number' ? row.data.quantity : 1;
        for (let i = 0; i < Math.min(Math.max(1, quantity), A_STACK_WORTH_COUNTING); i++) {
            out.push({
                materialId: id, holderId: personId, objectId: row.id, countedInThePouch: false
            });
        }
    }
    return out;
}

/** The ids, in order, for a gate that only wants to know what is here. */
export function theIdsOnTheBench(bench: readonly AUnitOnTheBench[]): string[] {
    return bench.map(unit => unit.materialId);
}

/**
 * Catalog ids of the material this pouch holds. The gate's read of
 * {@link unitsInThePouch}, and not a second walk of the table.
 */
export function materialInThePouch(db: Database.Database, holderId: string): string[] {
    return theIdsOnTheBench(unitsInThePouch(db, holderId));
}

/** Catalog ids of the material rows this person is physically carrying. */
export function materialBeingCarriedBy(
    objects: readonly ObjectRecord[],
    personId: string
): string[] {
    return theIdsOnTheBench(unitsBeingCarriedBy(objects, personId));
}
