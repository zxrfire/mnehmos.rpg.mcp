/**
 * `getNpc`, `getFaction` and `getLocation` answer exactly what a scan answers.
 *
 * WHY THERE IS A MEMO AT ALL. All three were `Array.prototype.find`. Measured
 * with `node --cpu-prof` on one seed advanced 1,200 years: `highestOrdinalIn`
 * in `what-people-are-saying.ts` - two `getNpc` calls per actor per fact per
 * teller - cost 0.04ms per simulated year at 100 years and 19.9ms at 1,200.
 * That was 26% of the whole per-year cost of a world advance, and the growth is
 * the product of two sizes: the ledger decides how many lookups happen and the
 * population decides what each one costs. `rowById` memoises id -> position.
 *
 * WHY THIS TEST EXISTS RATHER THAN A FINGERPRINT. A memo beside a mutable array
 * is the shape the working agreement warns about: a second copy that does not
 * fail loudly, it drifts. `rowById` is built not to be able to - the remembered
 * position is VERIFIED against the row before it is returned, and a hint that
 * fails falls through to the scan - and this pins that property directly, by
 * running both against each other, rather than inferring it from a world that
 * came out the same. It is also the only proof that survives a tree somebody
 * else is editing: two soaks minutes apart are two different trees, and this
 * compares the two readings inside one process.
 *
 * The mutations exercised are the ones the world actually performs: `push`
 * (births, minted ruins), in-place element replacement at the same index
 * (`state.npcs[i] = { ...npc, ... }`, `state.locations[i] = { ...location }`),
 * a whole new array (`upsertNpc`, `cloneWorld`), and a shrink, which nothing
 * does today and which the memo must survive anyway.
 *
 * Break it by deleting the verification line in `rowById` and replacing an
 * element with a row carrying a different id: the memo then answers with the
 * wrong row and the in-place case goes red.
 */

import { describe, it, expect } from 'vitest';
import { soakedWorld } from '../../support/soaked-world.js';
import {
    getFaction,
    getLocation,
    getNpc,
    indexById,
    rowById,
    type WorldState
} from '../../../src/engine/world/world-state.js';

/** What the lookups used to be, kept here as the thing to agree with. */
function byScan<T extends { id: string }>(rows: readonly T[], id: string): T | null {
    return rows.find(r => r.id === id) ?? null;
}
function positionByScan<T extends { id: string }>(rows: readonly T[], id: string): number {
    return rows.findIndex(r => r.id === id);
}

let world: Promise<WorldState> | null = null;
function lived(): Promise<WorldState> {
    // Long enough that people have died, houses have fallen and ruins have
    // been minted, so the arrays have been pushed to and written over.
    // Kept and shared: see `tests/support/soaked-world.ts`.
    world ??= soakedWorld('a-lookup-is-a-memo', { years: 60 });
    return world;
}

describe('a lookup answers what a scan answers', () => {
    it('agrees on every row the world holds, and on ids it does not', async () => {
        const state = await lived();
        expect(state.npcs.length).toBeGreaterThan(100);

        for (const npc of state.npcs) expect(getNpc(state, npc.id)).toBe(byScan(state.npcs, npc.id));
        for (const f of state.factions) expect(getFaction(state, f.id)).toBe(byScan(state.factions, f.id));
        for (const l of state.locations) {
            expect(getLocation(state, l.id)).toBe(byScan(state.locations, l.id));
        }

        for (const missing of ['', 'no-such-id', state.npcs[0].id + '-x']) {
            expect(getNpc(state, missing)).toBeNull();
            expect(getFaction(state, missing)).toBeNull();
            expect(getLocation(state, missing)).toBeNull();
        }
    });

    it('agrees after the four ways the world changes an array', async () => {
        const state = await lived();
        const rows = state.npcs.map(n => ({ id: n.id, mark: 'first' }));
        const check = (id: string) => {
            expect(rowById(rows, id)).toBe(byScan(rows, id));
            expect(indexById(rows, id)).toBe(positionByScan(rows, id));
        };

        for (const row of rows) check(row.id);

        // Appended, which is how a birth arrives.
        rows.push({ id: 'appended-1', mark: 'first' });
        check('appended-1');
        check(rows[0].id);

        // Written over in place at the same index, which is how every field on
        // an NPC or a location changes. Same id: the position still holds, and
        // the lookup has to hand back the NEW row rather than the one it saw.
        const at = 3;
        const replaced = { id: rows[at].id, mark: 'second' };
        rows[at] = replaced;
        expect(rowById(rows, replaced.id)).toBe(replaced);

        // Written over in place with a DIFFERENT id, which nothing does today.
        // The memo's remembered position is wrong for both ids and has to say
        // so rather than hand back whatever is sitting there.
        const displaced = rows[at].id;
        rows[at] = { id: 'substituted-1', mark: 'third' };
        check('substituted-1');
        expect(rowById(rows, displaced)).toBe(byScan(rows, displaced));

        // Shortened.
        const dropped = rows[rows.length - 1].id;
        rows.pop();
        expect(rowById(rows, dropped)).toBeNull();
        expect(indexById(rows, dropped)).toBe(-1);
        for (const row of rows) check(row.id);

        // And a whole new array, which is what `upsertNpc` and `cloneWorld`
        // hand back. A fresh array is a fresh memo by construction.
        const copy = rows.map(r => ({ ...r }));
        for (const row of copy) expect(rowById(copy, row.id)).toBe(byScan(copy, row.id));
    });

    it('returns the first of two rows carrying one id, as a scan does', () => {
        const first = { id: 'twice' };
        const second = { id: 'twice' };
        const rows = [first, { id: 'other' }, second];
        expect(rowById(rows, 'twice')).toBe(first);
        expect(rowById(rows, 'twice')).toBe(byScan(rows, 'twice'));
    });
});
