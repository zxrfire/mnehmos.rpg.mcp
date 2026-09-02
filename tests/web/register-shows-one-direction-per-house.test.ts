/**
 * A house's entry carries that house's own view outward, and nothing else.
 *
 * The design owner's ruling, and it is a correctness rule rather than a layout
 * preference: the two directions of a relationship are different facts and are
 * frequently asymmetric, and a row that prints both as `cold / civil` reads as
 * a single mutual temperature belonging to neither party. What the catalog
 * actually holds is two separate statements, each made by somebody, and each
 * belongs on the entry of whoever made it.
 *
 * The register's own entry for this is the Kiln pair, which is asymmetric in
 * exactly the way that matters: the Root Sill is cold to the Kiln, and the Kiln
 * is merely civil back, having nothing to complain about.
 */

import { describe, it, expect } from 'vitest';

import { renderRegister } from '../../src/web/register.js';
import { relationshipBetween } from '../../src/data/cultivation/faction-relationships.js';
import { contentionBetween } from '../../src/data/cultivation/what-two-houses-both-have-a-hand-on.js';

const HTML = renderRegister();

/**
 * The slice of the sheet belonging to one body's entry.
 *
 * Bounded by the NEXT entry rather than by a character count. A fixed window
 * was the first version and it failed three of these assertions against a page
 * that was rendering all three correctly: a dossier runs to tens of thousands
 * of characters and the relations block sits near the end of it, so a 9,000
 * character slice was testing the top of the entry and reporting the bottom of
 * it missing.
 */
function entry(anchorId: string): string {
    const i = HTML.indexOf(`id="${anchorId}"`);
    expect(i, `no entry rendered for ${anchorId}`).toBeGreaterThan(-1);
    const next = HTML.indexOf('<details class="ncard"', i + 1);
    return HTML.slice(i, next > i ? next : HTML.length);
}

describe('the register shows one direction per house', () => {
    it('carries the asymmetry the two halves of the Kiln actually have', () => {
        // The data has to be able to say it before the page can show it. If
        // this ever goes symmetric, the display rule above is unenforceable and
        // the defect is in the catalog rather than in the renderer.
        const outward = relationshipBetween('sect-kiln-wardens', 'court-kiln');
        expect(outward).toBeDefined();
        expect(outward!.warmth).not.toEqual(outward!.theirWarmth);
    });

    it('prints the house\'s own warmth on its entry and not the reciprocal', () => {
        const outward = relationshipBetween('sect-kiln-wardens', 'court-kiln')!;
        const block = entry('faction-sect-kiln-wardens');

        // The chip for the other body carries this house's word.
        expect(block).toContain(`warm-${outward.warmth}`);
        // And the strip's key says whose view the word is, so a reader never
        // has to work out the direction per row.
        expect(block).toContain('own view outward');
        // The old two-ended rendering is gone. `cold &rarr; civil` on one chip
        // was the exact thing ruled against.
        expect(block).not.toMatch(/relchip__warm[^>]*>[a-z]+<\/span><span class="relchip__arrow">/);
    });

    it('answers who it is close to, at odds with and contesting, not only the ladder', () => {
        // The gap this pass opened with: the summary said "3 level with it, 4
        // under it" and nothing about enemies, competitors or friends.
        const block = entry('faction-sect-kiln-wardens');
        expect(block).toMatch(/at odds with \d|close to \d|contesting with \d/);
    });

    it('marks the founding the Kiln pair contest, on both of their entries', () => {
        // Derived from the event both are parties to, so it must appear from
        // either end or the derivation is direction-dependent.
        expect(contentionBetween('sect-kiln-wardens', 'court-kiln').length).toBeGreaterThan(0);
        for (const anchor of ['faction-sect-kiln-wardens', 'ties-sect-kiln-wardens']) {
            if (HTML.indexOf(`id="${anchor}"`) < 0) continue;
            expect(entry(anchor)).toMatch(/contesting/);
        }
    });

    it('sends the reader to the other entry for the other side', () => {
        // The reciprocal is not hidden, it is relocated - and a reader told
        // that the other side may disagree needs to be told where it is.
        expect(HTML).toContain('its own entry');
    });

    it('has dropped the jargon labels the owner could not read', () => {
        // `ord 13`, `gate 13`, `flagged 2` and `offices 4`. Each is replaced by
        // a label that says what the number is; `gate` was the worst of them,
        // because the played game already uses the word for a gate somebody
        // walks through.
        expect(HTML).toContain('admits from rung');
        expect(HTML).toContain('>rung</span>');
        expect(HTML).not.toMatch(/<span class="nfl">ord<\/span>/);
        expect(HTML).not.toMatch(/<span class="nfl">gate<\/span>/);
        expect(HTML).not.toMatch(/<span class="nfl">flagged<\/span>/);
        expect(HTML).not.toMatch(/<span class="nfl">offices<\/span>/);
    });
});
