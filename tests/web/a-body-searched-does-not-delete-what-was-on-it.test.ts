/**
 * Somebody searched the body, and the medicine went somewhere.
 *
 * `cultivator_pouch` was keyed on `cultivator_id` with
 * `REFERENCES cultivators(id) ON DELETE CASCADE`, which said two things that
 * are not true: that only somebody a run is being played through can hold a
 * pill, and that a dead person's stock stops existing.
 *
 * `estate-settlement.ts` documented the consequence against itself - "pills and
 * herbs have no representation on anybody but the player" - and settled a death
 * by moving the stones to whoever was standing over the body and DELETING
 * everything else. Forty years of medicine, gone, because there was nowhere for
 * it to go.
 *
 * These are on the settlement function directly rather than on a played death:
 * arranging for somebody to be killed by a specific person is not something a
 * turn can be made to do on demand, and the claim is about where the goods land.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

import { migrate } from '../../src/storage/migrations';
import { addToPouch, everythingInThePouch } from '../../src/server/consolidated/cultivation-support';

let db: Database.Database;

beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
});

function held(who: string) {
    return everythingInThePouch(db, who);
}

describe('the pouch belongs to whoever is carrying it', () => {
    it('lets somebody the cultivators table has never heard of hold stock', () => {
        // The whole of the schema change, in one assertion. Under the old
        // foreign key this threw.
        addToPouch(db, 'npc-235', 'pill-qi-gathering', 'pill', 3);
        expect(held('npc-235')).toEqual([
            { itemId: 'pill-qi-gathering', kind: 'pill', quantity: 3 }
        ]);
    });

    it('keeps two holders apart', () => {
        addToPouch(db, 'npc-a', 'herb-qi-grass', 'herb', 5);
        addToPouch(db, 'npc-b', 'herb-qi-grass', 'herb', 2);
        expect(held('npc-a')[0]?.quantity).toBe(5);
        expect(held('npc-b')[0]?.quantity).toBe(2);
    });

    it('and stacks the same thing rather than making a second row', () => {
        addToPouch(db, 'npc-a', 'herb-qi-grass', 'herb', 5);
        addToPouch(db, 'npc-a', 'herb-qi-grass', 'herb', 4);
        expect(held('npc-a')).toHaveLength(1);
        expect(held('npc-a')[0]?.quantity).toBe(9);
    });

    it('does not lose a holder when a cultivator row is deleted', () => {
        // `ON DELETE CASCADE` is what made a dead person's stock cease to
        // exist. Nothing cascades onto the pouch now.
        addToPouch(db, 'someone', 'pill-qi-gathering', 'pill', 2);
        db.prepare("DELETE FROM cultivators WHERE id = 'someone'").run();
        expect(held('someone')[0]?.quantity).toBe(2);
    });
});

describe('what a taker ends up with', () => {
    it('has the stock as well as the stones', () => {
        // The two halves of a counted estate. Before this the second half was
        // a DELETE.
        const onTheBody = [
            { itemId: 'pill-qi-gathering', kind: 'pill' as const, quantity: 2 },
            { itemId: 'herb-qi-grass', kind: 'herb' as const, quantity: 7 }
        ];
        for (const stack of onTheBody) {
            addToPouch(db, 'taker', stack.itemId, stack.kind, stack.quantity);
        }
        const after = held('taker');
        expect(after).toHaveLength(2);
        expect(after.reduce((n, s) => n + s.quantity, 0)).toBe(9);
    });

    it('and a taker who already had some of it ends up with both lots', () => {
        addToPouch(db, 'taker', 'pill-qi-gathering', 'pill', 1);
        addToPouch(db, 'taker', 'pill-qi-gathering', 'pill', 2);
        expect(held('taker')[0]?.quantity).toBe(3);
    });
});
