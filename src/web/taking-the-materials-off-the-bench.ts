/**
 * Taking the materials off the bench, which nothing did.
 *
 * The recipes were written, the gate was wired, and the whole of it was a read:
 * `whetherTheirHandsCanDoIt` looked at what was on the bench and said yes, and
 * nothing anywhere took a single gram of anything. The design owner, on the
 * ruling this file is: *"recipes should take stuff out of your inventory."*
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A GRADE SAYS WHICH STORE, AND BOTH STORES HOLD THE SAME THING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `howAGradeIsStored` is the authority and is asked here rather than restated:
 * mortal and earth are a counted stack, heaven and above are a row with a
 * history. What is easy to miss is that a tracked material is BOTH - `hunt`
 * writes the pouch row beside the object row deliberately, the row being which
 * one this is and where it has been, the stack being the thing a counter quotes.
 *
 * So taking one off ends both. A take that deleted the pouch row and left the
 * object standing is the defect `half-built-craft.ts` refuses a core over in so
 * many words: *"putting it in without the record saying so would leave you
 * holding something you had already spent."* `ruin` is the existing and only
 * way a thing stops being itself, and a material worked into a finished thing
 * is exactly that - it is not lost, it is in the sword.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A PARTIAL SPEND CANNOT HAPPEN, AND IT IS THE SHAPE THAT STOPS IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Three things, in order, and each of them is load-bearing:
 *
 *   1. `whatTheRecipeSpends` returns NULL for a bench that is short. There is
 *      no partial answer to hand a caller, so no caller can act on one.
 *   2. Every stack and every row is CHECKED BEFORE ANYTHING IS WRITTEN. The
 *      check is what makes the promise true rather than likely.
 *   3. The stacks come off inside ONE transaction that throws on a short row,
 *      and the rows are ruined only AFTER it commits. SQLite rolls back and a
 *      JavaScript object does not, which AGENTS.md states and which decides the
 *      order: put the half that cannot be undone last, behind the half that can.
 *
 * And the caller's half of the same promise: the materials come off when the
 * thing is FINISHED, never when the work starts. A cultivator who dies at the
 * bench has spent nothing, because nothing had been taken yet.
 */

import type Database from 'better-sqlite3';

import { whatAnIngredientIs } from '../engine/cultivation/what-a-cauldron-will-take.js';
import {
    whatTheRecipeSpends,
    type Recipe
} from '../data/cultivation/what-an-artifact-is-made-of.js';
import {
    howAGradeIsStored,
    isRuined,
    ruin,
    type ObjectRecord
} from '../engine/world/possessions.js';
import { pouchQuantity, removeFromPouch } from '../server/consolidated/cultivation-support.js';
import type { TechniqueGrade } from '../schema/cultivation.js';
import { theIdsOnTheBench, type AUnitOnTheBench } from './what-is-on-the-bench.js';

/** One piece, gone into the thing. */
export interface WhatOneSlotCost {
    /** The slot's own words, so a report says what it was FOR. */
    what: string;
    materialId: string;
    name: string;
    holderId: string;
    /** Whether a row with a history ended, as against a number going down. */
    aRowEnded: boolean;
}

export interface WhatCameOffTheBench {
    took: readonly WhatOneSlotCost[];
    lines: string[];
    structure: string[];
    /** For the call log. Every one of these is a real write. */
    calls: { name: string; summary: string }[];
}

export interface TakingTheMaterials {
    db: Database.Database;
    /**
     * The world's object rows. A ruined row is replaced IN PLACE, so a caller
     * holding the world state passes its own array and then says the world
     * moved.
     */
    objects: ObjectRecord[];
    grade: TechniqueGrade;
    bench: readonly AUnitOnTheBench[];
    onDay: number;
    /** What it went into, for the provenance line on a row that ended. */
    intoWhat: string;
    /** A recipe other than the grade's own: mending takes `whatMendingAHoleTakes`. */
    recipe?: Recipe | null;
}

/**
 * Take what the recipe names, or take nothing.
 *
 * NULL MEANS NOTHING WAS TAKEN, and a caller that mints anyway has minted a
 * thing out of nothing. The readable refusal is not this function's - the gate
 * produces it, naming the slot, four substitutes and the route - and by the
 * time anybody is here that gate has already passed, so a null is the bench
 * having moved underneath the work rather than a player having asked for
 * something they cannot have.
 */
export function takeWhatTheRecipeNames(
    input: TakingTheMaterials
): WhatCameOffTheBench | null {
    const spend = input.recipe === undefined
        ? whatTheRecipeSpends(input.grade, theIdsOnTheBench(input.bench))
        : whatTheRecipeSpends(input.grade, theIdsOnTheBench(input.bench), input.recipe);
    if (spend === null) return null;

    // ── WHAT WOULD COME OFF, AND FROM WHERE ──────────────────────────────
    const took: WhatOneSlotCost[] = [];
    // Holder, then material. NESTED RATHER THAN A JOINED KEY: a separator
    // between two free-text ids is a separator that one of them can contain,
    // and the only characters that certainly cannot are the ones that make a
    // source file binary to `grep`.
    const offStacks = new Map<string, Map<string, number>>();
    const rowsToEnd: { unit: AUnitOnTheBench; at: number }[] = [];
    for (const filled of spend) {
        const unit = input.bench[filled.at];
        if (unit === undefined) return null;
        const row = whatAnIngredientIs(unit.materialId);
        if (row === null) return null;
        const tracked = howAGradeIsStored(row.grade) === 'tracked';
        if (unit.countedInThePouch) {
            const theirs = offStacks.get(unit.holderId) ?? new Map<string, number>();
            theirs.set(unit.materialId, (theirs.get(unit.materialId) ?? 0) + 1);
            offStacks.set(unit.holderId, theirs);
        }
        if (unit.objectId !== null) {
            const at = input.objects.findIndex(o => o.id === unit.objectId);
            if (at < 0 || isRuined(input.objects[at])) return null;
            rowsToEnd.push({ unit, at });
        } else if (tracked) {
            // A heaven-grade thing with no row is a thing the world cannot say
            // it ended. Refusing is the only honest answer: the alternative is
            // decrementing a stack and leaving no record that the object it
            // stood for is gone, which is the drift this file exists against.
            return null;
        }
        took.push({
            what: filled.slot.what,
            materialId: unit.materialId,
            name: row.name,
            holderId: unit.holderId,
            aRowEnded: unit.objectId !== null
        });
    }

    // ── AND WHETHER IT IS ALL STILL THERE ────────────────────────────────
    for (const [holderId, theirs] of offStacks) {
        for (const [materialId, wanted] of theirs) {
            if (pouchQuantity(input.db, holderId, materialId) < wanted) return null;
        }
    }

    // ── THE HALF THAT ROLLS BACK ─────────────────────────────────────────
    const calls: { name: string; summary: string }[] = [];
    try {
        input.db.transaction(() => {
            for (const [holderId, theirs] of offStacks) {
                for (const [materialId, n] of theirs) {
                    if (!removeFromPouch(input.db, holderId, materialId, n)) {
                        throw new Error(`${materialId} x${n} was not on ${holderId} after all.`);
                    }
                    calls.push({
                        name: 'storage.removeFromPouch',
                        summary: `${materialId} x${n} out of ${holderId}'s pouch and into `
                            + `${input.intoWhat}.`
                    });
                }
            }
        })();
    } catch {
        return null;
    }

    // ── AND THE HALF THAT DOES NOT ───────────────────────────────────────
    for (const ending of rowsToEnd) {
        const before = input.objects[ending.at];
        input.objects[ending.at] = ruin(before, {
            onDay: input.onDay,
            source: input.intoWhat,
            note: `Worked into ${input.intoWhat}. It is not lost; it is in the thing.`
        });
        calls.push({
            name: 'world.ruin',
            summary: `${before.id} (${before.name}) ends: worked into ${input.intoWhat} on day `
                + `${input.onDay}. The chain says where it went.`
        });
    }

    return {
        took,
        lines: took.length === 0
            ? []
            : [
                'What it took: '
                + took.map(one => `${one.name} for ${one.what}`).join('; ') + '.'
            ],
        structure: took.length === 0
            ? [
                `${input.grade} grade asks for no materials, so nothing came off the bench. `
                + 'Roadside work.'
            ]
            : [
                `Spent against the ${input.grade} recipe: `
                + took.map(one =>
                    `${one.materialId} (${one.aRowEnded ? 'a row, ended' : 'a stack, -1'}) `
                    + `off ${one.holderId}`).join('; ') + '.'
            ],
        calls
    };
}
