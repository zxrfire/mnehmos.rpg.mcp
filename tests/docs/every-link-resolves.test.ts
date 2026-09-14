/**
 * Every relative link in docs/ and in a src/ README resolves.
 *
 * A doc pointing at a moved neighbour is worse than one pointing nowhere: it
 * looks like it worked. This was 65 broken before the folder pass and is the
 * check that keeps a reorganisation mechanical.
 */
import { describe, expect, it } from 'vitest';
import { brokenLinks } from '../../scripts/check-doc-links.mjs';

describe('the docs link to each other', () => {
    it('has no broken relative links', () => {
        const { broken, checked } = brokenLinks();
        expect(checked).toBeGreaterThan(1000);
        // The script is a `.mjs` with no declarations, so what it returns is
        // `any` until the build typechecks it. Naming the shape here at least
        // keeps this call honest about what it reads off each entry.
        expect(broken.map((b: { from: string; to: string }) => `${b.from} -> ${b.to}`)).toEqual([]);
    });
});
