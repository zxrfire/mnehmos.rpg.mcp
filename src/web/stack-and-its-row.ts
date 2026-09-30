/**
 * A material's row goes where its pouch stack goes.
 *
 * A material with a world row - a tracked grade, and every bone, whose row says
 * whose body it came off (`bones-off-a-body.ts`) - is two records of one thing:
 * the row says which one it is and where it came from, the stack is what a
 * counter quotes. `what-is-on-the-bench.ts` pairs them the same way. A verb that
 * moves the stack between holders moves the row with it, or the origin stays
 * with somebody who no longer has the thing.
 */

import { isRuined, isWorn, type ObjectRecord } from '../engine/world/possessions.js';

/** Where in `objects` the rows are that go with `count` of this stack held by `holderId`. */
export function theRowsThatGoWithAStack(
    objects: readonly ObjectRecord[],
    holderId: string,
    itemId: string,
    count: number
): number[] {
    const out: number[] = [];
    for (let at = 0; at < objects.length && out.length < count; at++) {
        const row = objects[at]!;
        if (row.possessorId !== holderId || row.kind !== 'material') continue;
        if (row.data?.materialId !== itemId || isRuined(row) || isWorn(row)) continue;
        out.push(at);
    }
    return out;
}
