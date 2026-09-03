import { describe, it, expect } from 'vitest';
import { surveyBible, docsWithNoPointer, catalogNames } from '../../scripts/bible-catalog-pointers.mjs';

/**
 * A ratchet, not a gate. The same shape as `prose-does-not-get-duplicated`,
 * pointed at the other half of the same defect.
 *
 * That test stops one fact acquiring a second copy. This one stops a doc from
 * having no route to the copy that already exists - which is the failure that
 * actually costs time here, because it is invisible. A reader who finds the
 * bible's account of a subject has no way to learn that the catalog holds a
 * fuller one, so they do not go looking, and the two drift while both read as
 * authoritative.
 *
 * Measured when this was written: an agent spent twenty minutes deriving rulings
 * about a house's Protector with the design owner. All of them were already in
 * `THE_OFFICE` in `false-immortals.ts`, and one of them had anticipated and
 * answered the exact confusion being had. `immortals.md` covered the same
 * subject and named no catalog file at all.
 *
 * When you legitimately reduce the count, lower the baseline in the same commit.
 * The fix is never to raise it. Either name the catalog file the section is
 * about, or - if there genuinely is not one - say so in place with a reason:
 *
 *     <!-- no-catalog: authoring guidance; nothing in the catalog models it -->
 *
 * Run `node scripts/bible-catalog-pointers.mjs` to see the queue.
 */
const BASELINE = 10;

describe('the bible points at the catalog', () => {
    it('does not gain another doc with no route into the design', () => {
        const missing = docsWithNoPointer();
        expect(
            missing.length,
            `Bible files naming no catalog file rose above ${BASELINE}. Name the catalog the `
            + `section is about, or mark it <!-- no-catalog: reason -->.\n  `
            + missing.join('\n  ')
        ).toBeLessThanOrEqual(BASELINE);
    });

    it('is measured against a catalog it can actually see', () => {
        // A guard on the guard. If the catalog walk stops finding files - a
        // non-recursive read is how the world index lost sixteen of them - every
        // doc would "fail" for the wrong reason, or the exemption path would
        // quietly pass everything. Both directions are worth pinning.
        const names = catalogNames();
        expect(names.size).toBeGreaterThan(50);
        expect(names.has('false-immortals.ts')).toBe(true);
        expect(names.has('provinces.ts'), 'the catalog walk is not reaching regions/').toBe(true);
    });

    it('counts a pointer rather than a mention of the subject', () => {
        // The rule is a route into the code, not a paragraph about it. This
        // pins that the survey is reading links and filenames: immortals.md
        // discusses the Protector at length and only passes because it now
        // names false-immortals.ts.
        const rows = surveyBible();
        const immortals = rows.find(r => r.file === 'climbing/immortals.md');
        expect(immortals, 'climbing/immortals.md is not being surveyed').toBeTruthy();
        expect(immortals!.points).toContain('false-immortals.ts');
    });
});
