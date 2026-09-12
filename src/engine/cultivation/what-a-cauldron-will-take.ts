/**
 * WHAT A CAULDRON WILL TAKE, AND WHERE IT CAME FROM.
 *
 * The design owner: *"wire up the dao of alchemy, which lets you refine [pills]
 * from materials (natural & spirit beast)"*, and *"that should already exist."*
 *
 * It half did. Both catalogs were already here and already the same shape -
 * `herbs.ts` and the `BEAST_MATERIALS` table in `beasts.ts` each carry an id, a
 * name, a grade, a value, a rarity weight and the rung below which taking it is
 * not survivable. What did not exist was any way for a recipe to name one of
 * the second kind: every ingredient went through `getHerb`, so a spirit beast's
 * core was a thing you could hunt, harvest, carry and sell, and could not put
 * in a cauldron.
 *
 * Which is backwards for the genre and backwards for this world's own economy.
 * A beast core is *"somebody else's centuries, in a form that can be eaten or
 * sold"* - `beasts.ts` says so - and the whole reason anybody hunts one is that
 * it goes into medicine.
 *
 * ── ONE RESOLVER, AND NOTHING DOWNSTREAM KNOWS WHICH ─────────────────────
 *
 * The same shape the trade gate uses: ONE matcher that every reader goes
 * through, rather than two lookups and a branch at each call site. A recipe
 * names an id; this says what that id is. Pricing, the stock check, the
 * consume step and the refusal text all read the same row and none of them
 * asks which table it came from - which is the point, because a cauldron does
 * not care either.
 *
 * `source` is carried anyway, because the two are not interchangeable to a
 * PERSON: one is picked and one has to be killed first, and a refusal that
 * cannot say which is not a refusal anybody can act on.
 */

import { HERBS, getHerb } from '../../data/cultivation/herbs.js';
import { BEAST_MATERIALS, getBeastMaterial } from '../../data/cultivation/beasts.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';

/**
 * Where a material comes from, which is the one thing the two tables do not
 * agree about.
 */
export type WhereAMaterialComesFrom =
    /** It grew. Somebody picked it. */
    | 'a_growing_thing'
    /** It was taken off a spirit beast, which had to stop being one first. */
    | 'a_beast';

/**
 * A material, as alchemy needs it, whichever table it lives in.
 *
 * Deliberately the intersection of the two rows and not the union: everything
 * here is a fact both catalogs already carry, so nothing is invented for one
 * source and defaulted for the other.
 */
export interface WhatTheCauldronIsBeingHanded {
    id: string;
    name: string;
    grade: TechniqueGrade;
    /** Base market value in spirit stones. The same bands on both tables. */
    value: number;
    /** The rung below which getting hold of this is not survivable. */
    harvestOrdinal: number;
    from: WhereAMaterialComesFrom;
}

/**
 * What this id is, or null where it is nothing.
 *
 * Herbs first, because they are the overwhelming majority and because a herb id
 * and a material id have never collided - the two tables use different prefixes
 * and `theTwoTablesDoNotCollide` holds them to it.
 */
export function whatAnIngredientIs(itemId: string): WhatTheCauldronIsBeingHanded | null {
    const herb = getHerb(itemId);
    if (herb !== undefined) {
        return {
            id: herb.id,
            name: herb.name,
            grade: herb.grade,
            value: herb.value,
            harvestOrdinal: herb.harvestOrdinal,
            from: 'a_growing_thing'
        };
    }
    const material = getBeastMaterial(itemId);
    if (material !== undefined) {
        return {
            id: material.id,
            name: material.name,
            grade: material.grade,
            value: material.value,
            harvestOrdinal: material.harvestOrdinal,
            from: 'a_beast'
        };
    }
    return null;
}

/**
 * How somebody would say where it has to come from, for a refusal that names
 * the honest route.
 *
 * The engine does not grade the player and does not suggest. What it owes
 * somebody who is short an ingredient is the difference between a thing they
 * can walk out and pick and a thing that is currently inside something that
 * will object.
 */
export function howYouWouldComeByIt(material: WhatTheCauldronIsBeingHanded): string {
    return material.from === 'a_beast'
        ? `${material.name} comes off a spirit beast, and the beast has to be dealt with first`
        : `${material.name} grows, and somebody has to be standing where it grows`;
}

/**
 * The same read backwards: given a grade and a source, what reaches it.
 *
 * `whatAnIngredientIs` answers "what is this id", and until now nothing could
 * ask "what would do instead" - so a recipe or a refusal that wanted to name a
 * substitute had to carry its own list of ids, which is the second copy that
 * goes stale the first time a catalog row is regraded.
 *
 * Sorted by value, cheapest first, because that is the order somebody short of
 * a thing wants to hear it in.
 */
export function everyIngredientThatIs(filter: {
    grade?: TechniqueGrade;
    from?: WhereAMaterialComesFrom;
    /** The rung the gatherer stands at. Omit to ignore where it has to be got. */
    withinReachOf?: number;
}): readonly WhatTheCauldronIsBeingHanded[] {
    const rows: WhatTheCauldronIsBeingHanded[] = [];
    for (const herb of HERBS) {
        const row = whatAnIngredientIs(herb.id);
        if (row !== null) rows.push(row);
    }
    for (const material of BEAST_MATERIALS) {
        const row = whatAnIngredientIs(material.id);
        if (row !== null) rows.push(row);
    }
    return rows
        .filter(row => filter.grade === undefined || row.grade === filter.grade)
        .filter(row => filter.from === undefined || row.from === filter.from)
        .filter(row =>
            filter.withinReachOf === undefined || row.harvestOrdinal <= filter.withinReachOf)
        .sort((a, b) => a.value - b.value || (a.id < b.id ? -1 : 1));
}
