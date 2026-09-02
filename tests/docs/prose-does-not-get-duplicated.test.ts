import { describe, it, expect } from 'vitest';
import { findDuplicates } from '../../scripts/find-duplicated-prose.mjs';

/**
 * A ratchet, not a gate.
 *
 * There are already passages in this repo that exist in two files, and fixing
 * all of them at once is not worth blocking work over - each needs a judgement
 * about which copy owns the fact. What is worth blocking is the number going
 * UP, because every new pair is another rule that can drift out of agreement
 * with itself while both copies still read as authoritative.
 *
 * When you legitimately reduce the count, lower the baseline in the same
 * commit. When this fails, the fix is almost never to raise it: delete one
 * copy and link to the other.
 *
 * Run `node scripts/find-duplicated-prose.mjs` to see what is duplicated and
 * where.
 */
const BASELINE = 24;

/*
 * Raised from 25 when the ancestral roll was lifted out of `sects.ts`, and the
 * two extra pairs are a GAIN in information rather than new duplication.
 *
 * A passage repeated twice inside one file is invisible to this scan, which
 * only counts a passage appearing in more than one file. Splitting a file turns
 * that invisible repetition into a visible pair. Nothing was copied; the same
 * words are in the same repository in the same number of places.
 *
 * What it exposed is worth acting on: `sealed-ancestors.ts` and
 * `the-ancestors-a-house-still-names.ts` now share FOUR passages and are the
 * largest pair in the list. They are two files about the same people, which is
 * exactly what the split was meant to make legible, and they are the next thing
 * to reconcile.
 *
 * The scan reads whole lines, so it used to count two files importing the same
 * names from the same module, and two files dividing themselves with the same
 * section banner. Neither is a passage anybody wrote twice - the first is what
 * a shared dependency looks like, and the language requires it. Every pair left
 * in the count is now real prose.
 */

describe('duplicated prose', () => {
    it('does not increase', () => {
        const dupes = findDuplicates();
        const where = dupes.slice(0, 5).map(d => `\n  ${d.files.join(' <-> ')}\n    "${d.text.slice(0, 90)}..."`);
        expect(
            dupes.length,
            `Duplicated passages rose above ${BASELINE}. Delete one copy and link to the other.${where.join('')}`
        ).toBeLessThanOrEqual(BASELINE);
    });

    it('is measured over the files that actually carry design', () => {
        // A guard on the guard: if the scan stops reaching the catalog, the
        // ratchet would pass by finding nothing at all.
        const dupes = findDuplicates();
        const scanned = new Set(dupes.flatMap(d => d.files));
        expect([...scanned].some(f => f.startsWith('src/data/cultivation/'))).toBe(true);
    });
});
