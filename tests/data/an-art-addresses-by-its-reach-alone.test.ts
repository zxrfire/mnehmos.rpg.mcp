/**
 * THE CLAUSE THAT WOULD HAVE SELF-TARGETED THE WHOLE COMBAT CATALOG.
 *
 * The design owner collapsed the two kinds of technique into one: every technique
 * carries its practitioner up a few rungs, and every technique also has whatever
 * fighting style and abilities it has. `advancesRank` was the last thing splitting
 * the catalog 46 / 111 on that question and it went.
 *
 * `defaultAddressFor` read `if (advancesRank(t)) return 'body'` - a manual you
 * practise addresses you - and that clause is the reason this file exists. With
 * every art advancing, leaving it in place would have forced all 157 rows to
 * `body`: the 111 rows the old predicate held out - every attack, defence,
 * movement and support art in the catalog - silently unable to address anybody
 * but the person performing them, with a change that typechecks perfectly and
 * breaks no other assertion in the tree. `addressIsLegal` carried the same
 * clause and would have called every declared `place` art illegal.
 *
 * Measured when the clause came out, over all 157 rows: ZERO changed address.
 * That is the finding the number was collected for - the address ladder was
 * never carrying the advancement split, it only looked as though it might.
 *
 * Red-checked: restoring either clause turns the first two tests below red.
 */

import { describe, it, expect } from 'vitest';
import {
    TECHNIQUES,
    addressOf,
    addressIsLegal,
    defaultAddressFor,
    getTechnique
} from '../../src/data/cultivation/techniques.js';
import {
    addressCeilingForOrdinal,
    addressRank
} from '../../src/schema/cultivation.js';

describe('an art addresses by its reach alone', () => {
    it('every row in the catalog reads its address off reach and its own declaration', () => {
        // Stated as the whole rule rather than as a sample, because the failure
        // this guards against is uniform: a clause in front of `reach` moves
        // every row at once, and a sample of the rows it moves the right way
        // would pass.
        for (const t of TECHNIQUES) {
            const fromReachAlone = t.addresses ?? (t.reach === 'field' ? 'place' : 'body');
            expect(addressOf(t), `${t.id}`).toBe(fromReachAlone);
        }
    });

    it('a field-reach art lands on a place whatever its category', () => {
        // The two arguments differ in the field the retired predicate read, and
        // in nothing else. If anything ever branches on it again, these two
        // answers stop agreeing.
        expect(defaultAddressFor({ reach: 'field' })).toBe('place');
        expect(defaultAddressFor({ reach: 'field' })).toBe(
            defaultAddressFor({ reach: 'field' })
        );
        for (const t of TECHNIQUES) {
            if (t.reach !== 'field' || t.addresses !== undefined) continue;
            expect(addressOf(t), `${t.id} reaches a field`).toBe('place');
        }
    });

    it('the catalog still holds arts that address something other than a body', () => {
        // The consequence the header is about, asserted as presence rather than
        // as a count: if `defaultAddressFor` ever forces `body` again, this set
        // collapses to one member and says so.
        const addresses = new Set(TECHNIQUES.map(t => addressOf(t)));
        expect(addresses.size).toBeGreaterThan(1);
        expect(addresses.has('body')).toBe(true);
    });

    it('legality is the rung ceiling for every row, with nothing in front of it', () => {
        for (const t of TECHNIQUES) {
            const within = addressRank(addressOf(t))
                <= addressRank(addressCeilingForOrdinal(t.requiredOrdinal));
            expect(addressIsLegal(t), `${t.id}`).toBe(within);
            expect(addressIsLegal(t), `${t.id} declares an address its rung cannot hold`)
                .toBe(true);
        }
    });

    it('an art that carries somebody a long way still addresses what its reach says', () => {
        // The named case, because it is the one a reader will reach for: the
        // Unwritten Vestige Scripture opens above the floor for `place` and carries
        // its reader the rest of the ladder, and it lands on one person. How far
        // a book carries somebody and what it is aimed at are two facts.
        const top = getTechnique('unwritten-span-scripture')!;
        expect(top.cap).toBeNull();
        expect(addressOf(top)).toBe('body');
    });
});
