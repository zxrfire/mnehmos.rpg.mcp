/**
 * The sheet's crowding panel must not invent a measurement, and must not call
 * the one it has by the wrong name.
 *
 * ── WHAT WENT WRONG ──────────────────────────────────────────────────────
 *
 * `CrowdingRead.share` is `number | null`, and the null is load-bearing:
 * `what-you-can-tell-about-the-ground.ts` masks the surveyor's figures for
 * anybody who cannot yet read a vein, and the sheet is supposed to fall back to
 * a bare headcount. `groundBlock` read it with `Number(g.share)`, `Number(null)`
 * is 0, and `Number.isFinite(0)` is true - so "nobody has looked" rendered as a
 * measured `0% rate`.
 *
 * Found by playing a served build. A Qi Condensation cultivator sat on ground
 * the panel's own note called plentiful, came out of one seclusion two rungs
 * higher with progress moved from 0/100 to 277/100, and the panel read
 * `7 - 0% RATE` on both sides of it. The same masking makes the figure appear
 * and disappear with the READER rather than the ground: 52 heads at 22% before
 * a stretch and 49 heads at 0% after it, on ground whose real share had risen
 * from 0.2241 to 0.2364, because the person who had been reading the vein was
 * no longer there. Fewer people, and an apparently vanished rate.
 *
 * ── AND THE LABEL ────────────────────────────────────────────────────────
 *
 * The figure is `crowdingMultiplier`: the fraction of the ground's qi still
 * going spare once everybody standing here has taken their draw. It is one term
 * among several in the rate and it is not the cultivator's rate - untreated
 * meridian injuries take their own percentage, in `injuryRatePenalty`, in a
 * different field. So the number is kept exactly as the engine computed it and
 * the words say what it measures.
 *
 * ── WHY THIS TEST IS A SOURCE SLICE ──────────────────────────────────────
 *
 * `web/app.js` is a browser asset with no module boundary, so there is nothing
 * to import. This evaluates the shipped source text of the helper block and of
 * `groundBlock` itself, which means it is testing the bytes the page actually
 * serves rather than a copy that can drift. Same approach as
 * `markup-does-not-print-itself.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../../web/app.js', import.meta.url));

interface GroundLike {
    placeName: string;
    supported: number | null;
    drawing: number | null;
    heads: number;
    share: number | null;
    barren: boolean;
    line: string;
}

/** `groundBlock` as the page defines it, with the helpers it closes over. */
function loadGroundBlock(): (d: { ground: GroundLike | null }) => string {
    const src = readFileSync(APP, 'utf8');

    const helpersEnd = src.indexOf('\nfunction fmtPct');
    expect(helpersEnd, 'the helper block at the head of app.js has moved').toBeGreaterThan(0);

    const start = src.indexOf('function groundBlock(d) {');
    expect(start, 'groundBlock has been renamed or removed').toBeGreaterThan(0);
    const end = src.indexOf('\nfunction daoSection', start);
    expect(end, 'daoSection no longer follows groundBlock').toBeGreaterThan(start);

    const built = new Function(
        `${src.slice(0, helpersEnd)}\n${src.slice(start, end)}\nreturn groundBlock;`
    )();
    return built as (d: { ground: GroundLike | null }) => string;
}

const groundBlock = loadGroundBlock();

/** The rendered panel as flat text, which is what a player reads. */
function panelText(ground: GroundLike | null): string {
    return String(groundBlock({ ground }))
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const MASKED: GroundLike = {
    placeName: 'Thirdwall',
    supported: null,
    drawing: null,
    heads: 10,
    share: null,
    barren: false,
    line: 'What gets to you here comes grudgingly, and has to be worked for.'
};

const READABLE: GroundLike = {
    placeName: 'Sweptground',
    supported: 13,
    drawing: 58,
    heads: 52,
    share: 0.22413793103448276,
    barren: false,
    line: 'Sweptground comfortably carries a draw of 13, and 52 are drawing on it. '
        + 'Qi drawn by one is not available to another, so cultivation here runs at 22% '
        + 'of what this ground would give somebody sitting on it alone.'
};

describe('the ground panel on the cultivator sheet', () => {
    it('shows no percentage at all when the engine sent no measurement', () => {
        const text = panelText(MASKED);
        expect(text).not.toMatch(/\d+\s*%/);
        expect(text).not.toContain('0%');
    });

    it('still counts the heads, which is not a thing masking takes away', () => {
        expect(panelText(MASKED)).toContain('10');
    });

    it('keeps the engine\'s own sentence under the figures either way', () => {
        expect(panelText(MASKED)).toContain(MASKED.line);
        expect(panelText(READABLE)).toContain(READABLE.line);
    });

    it('prints the share exactly as the engine computed it when it has one', () => {
        expect(panelText(READABLE)).toContain('22%');
        expect(panelText(READABLE)).toContain('52');
    });

    it('does not call the crowding share the cultivator\'s rate', () => {
        expect(panelText(READABLE).toLowerCase()).not.toMatch(/\d+\s*%\s*rate/);
    });

    it('says what the share is a share OF, so the number can be acted on', () => {
        expect(panelText(READABLE)).toContain('against sitting alone');
    });

    it('says nothing about a share when nothing is being shared thin', () => {
        const text = panelText({
            placeName: 'Sixmile',
            supported: 30,
            drawing: 5,
            heads: 5,
            share: 1,
            barren: false,
            line: 'Sixmile comfortably carries a draw of 30, and 5 are drawing on it. '
                + 'Nothing here is being shared thin.'
        });
        expect(text).not.toMatch(/\d+\s*%/);
        expect(text).toContain('5');
    });

    it('renders nothing at all when there is no world to read', () => {
        expect(groundBlock({ ground: null })).toBe('');
    });
});

/**
 * The regression itself, stated as arithmetic rather than as a rendering.
 *
 * This is the transition the owner saw. Three people left the ground and the
 * share the engine computed went UP; what fell out was the reader, and the old
 * panel reported that as the rate going to zero.
 */
describe('losing the person who could read the vein', () => {
    it('does not read as the rate collapsing', () => {
        const before = panelText({ ...READABLE, heads: 52, share: 0.2241379310344827 });
        const after = panelText({
            ...MASKED,
            placeName: 'Sweptground',
            heads: 49,
            line: 'What gets to you here comes grudgingly, and has to be worked for.'
        });

        expect(before).toContain('22%');
        // The old panel rendered this as "49 - 0% RATE": a worse figure off
        // thinner ground, which is backwards on its face.
        expect(after).not.toMatch(/\d+\s*%/);
        expect(after).toContain('49');
    });
});
