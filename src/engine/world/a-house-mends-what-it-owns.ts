/**
 * A house mends what it owns that was holed, once a year, out of its own stock.
 *
 * Owner ruling 2026-09-25: houses mend their holed things in their yearly pass,
 * and mending costs material. A hole is closed by the house's best living hand
 * when that hand reaches the rung the thing was made at (`mend`'s own gate),
 * and each hole costs one piece that fills the first slot of the thing's
 * grade's recipe; a broken thing is restored to whole for the whole recipe
 * (`whatMendingItTakes`). Both come from the material the house
 * keeps in its stores (`whatTheHouseKeepsToWorkWith` seeds it). A house short
 * of the material leaves the thing holed. Things are taken in the order the
 * world holds them, while material lasts; there is no priority.
 *
 * What it does not reach: a thing out of the house's hands (lent, carried off
 * or taken), which is mended when it is back, and a thing a member owns in
 * their own name.
 */

import { TechniqueGradeSchema, type TechniqueGrade } from '../../schema/cultivation.js';
import { gradeForOrdinal } from '../../data/cultivation/techniques.js';
import {
    fillsTheSlot,
    whatMendingItTakes,
    type Recipe
} from '../../data/cultivation/what-an-artifact-is-made-of.js';
import { isBroken, isHoled, mend, ratedWhole } from './object-damage.js';
import { isRuined, ruin, type ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';

/**
 * The grade a thing was made at: the grade a made thing carries on its row
 * (`data.grade`, then a `grade:` tag), else the band the rung it was made at
 * stands in, on the one scale (`which-rungs-a-grade-covers.ts`).
 */
export function theGradeItWasMadeAt(row: Pick<ObjectRecord, 'data' | 'tags' | 'power'>): TechniqueGrade {
    const stored = TechniqueGradeSchema.safeParse(row.data?.grade);
    if (stored.success) return stored.data;
    const tagged = TechniqueGradeSchema.safeParse(row.tags.find(t => t.startsWith('grade:'))?.slice('grade:'.length));
    if (tagged.success) return tagged.data;
    return gradeForOrdinal(ratedWhole(row) ?? 0);
}

/** How many of a stock row there are. A row with no quantity is one thing. */
function howManyIn(row: ObjectRecord): number {
    const n = Number(row.data?.quantity ?? 1);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1;
}

/**
 * The house's stock rows that pay this recipe, one per slot, or null where it
 * is short. Material in the stores: owned by the house, carried by nobody.
 */
function whatTheStoresWouldGive(
    objects: readonly ObjectRecord[],
    houseId: string,
    recipe: Recipe
): number[] | null {
    const taken = new Map<number, number>();
    const out: number[] = [];
    for (const slot of recipe) {
        const at = objects.findIndex((row, i) =>
            row.ownerId === houseId
            && row.possessorId === null
            && row.kind === 'material'
            && !isRuined(row)
            && typeof row.data?.materialId === 'string'
            && fillsTheSlot(slot, row.data.materialId)
            && howManyIn(row) - (taken.get(i) ?? 0) > 0);
        if (at < 0) return null;
        taken.set(at, (taken.get(at) ?? 0) + 1);
        out.push(at);
    }
    return out;
}

/** One piece off a stock row: a count goes down, and the last one is worked in. */
function takeOne(objects: ObjectRecord[], at: number, onDay: number, intoWhat: string): void {
    const row = objects[at]!;
    const left = howManyIn(row) - 1;
    if (left <= 0) {
        objects[at] = ruin(row, { onDay, source: intoWhat, note: `Worked into ${intoWhat}.` });
        return;
    }
    const resource = typeof row.data.resource === 'string' ? row.data.resource : null;
    objects[at] = {
        ...row,
        name: resource === null ? row.name : `${left} ${resource}`,
        data: { ...row.data, quantity: left }
    };
}

/**
 * Every house closes the holes in what it owns and restores what is broken,
 * while its stock lasts. Returns how many mends were made. No draw.
 */
export function housesMendWhatTheyOwn(state: WorldState, day: number): number {
    let closed = 0;
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        let hand: { id: string; name: string; ordinal: number } | null = null;
        for (const npc of state.npcs) {
            if (npc.status !== 'alive' || npc.factionId !== house.id) continue;
            if (hand === null || npc.cultivation.realmOrdinal > hand.ordinal) {
                hand = { id: npc.id, name: npc.name, ordinal: npc.cultivation.realmOrdinal };
            }
        }
        if (hand === null) continue;

        for (let at = 0; at < state.objects.length; at++) {
            const row = state.objects[at]!;
            if (row.ownerId !== house.id) continue;
            if (row.possessorId !== null && row.possessorId !== house.id) continue;
            while (isHoled(state.objects[at]!) || isBroken(state.objects[at]!)) {
                const thing = state.objects[at]!;
                const done = mend(thing, { byOrdinal: hand.ordinal, onDay: day, byId: hand.id, byName: hand.name });
                if (!done.mended) break;
                const recipe = whatMendingItTakes(theGradeItWasMadeAt(thing), isBroken(thing)) ?? [];
                const paying = whatTheStoresWouldGive(state.objects, house.id, recipe);
                if (paying === null) break;
                for (const from of paying) takeOne(state.objects, from, day, `mending ${thing.name}`);
                state.objects[at] = done.row;
                closed++;
            }
        }
    }
    return closed;
}
