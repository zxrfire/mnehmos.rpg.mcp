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
        expect(broken.map(b => `${b.from} -> ${b.to}`)).toEqual([]);
    });
});
