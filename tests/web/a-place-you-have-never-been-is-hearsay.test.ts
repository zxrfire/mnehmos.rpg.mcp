/**
 * The travel list may say what a place is LIKE. It may not say who is standing
 * in it this morning.
 *
 * ── THE LEAK ─────────────────────────────────────────────────────────────
 *
 * `GameService.occupancyOf` fills `Destination.occupants` from
 * `npcsAt(world, record.id).length` - the live headcount off the loaded world -
 * and `whereCouldTheyGo` filters `hereNow` out, so EVERY row in this read is
 * somewhere the player has never been. A first-day cultivator asking "where can
 * I go" was told "8 are drawing on ground that comfortably carries 7", which is
 * a sensor reading on a town a week's walk away.
 *
 * Found beside the opposite defect on the character sheet: the sheet masks the
 * surveyor's figures for anybody who cannot read a vein, and this read handed
 * the same cultivator exact ones for everywhere else.
 *
 * ── WHY THE SHAPE STAYS AND THE COUNT GOES ───────────────────────────────
 *
 * This read is reputation rather than perception - you have heard what the next
 * valley is like, which needs somebody to have mentioned it and not a rung on
 * the ladder. What a reputation can carry is what is stable. Measured over 5
 * seeds and 90 settlements advanced 40 years in 5-year steps: the COUNT changed
 * at 60% of steps, the SHAPE (empty / comfortable / over) at 5%, and the shape's
 * changes were near enough all single monotonic transitions - a place filling up
 * over decades, which is a reputation catching up correctly.
 *
 * So: the shape and the ground's carrying capacity stay, because both are
 * standing properties and both are what teaches the mechanic. The headcount
 * goes.
 */

import { describe, it, expect } from 'vitest';
import { whereCouldTheyGo } from '../../src/web/where-this-cultivator-could-go.js';

/** One row, as `GameService` assembles it. */
function place(over: {
    name?: string;
    occupants: number | null;
    supportedDraw: number | null;
    hereNow?: boolean;
}) {
    return {
        name: over.name ?? 'Iron Gate',
        kind: 'market_town',
        ambient: 'thin' as const,
        regionName: 'The Silent Cliffs',
        travelDays: 4,
        localCeilingOrdinal: 12,
        hereNow: over.hereNow ?? false,
        sameProvince: false,
        occupants: over.occupants,
        supportedDraw: over.supportedDraw
    };
}

/**
 * The read, split so the assertions can be about ROWS.
 *
 * `engineRows` is the per-destination lines only, deliberately excluding the
 * read's own explanatory notes: `occupancyIsReported` quotes the measurement
 * that justifies this rule ("5 seeds", "5%", "60%"), and a bare digit search
 * across the whole blob matches those and reports the note as a leak. What has
 * to be free of headcounts is the rows.
 */
function read(rows: ReturnType<typeof place>[]) {
    const out = whereCouldTheyGo({
        ordinal: 0,
        placeName: 'Willow Village',
        regionName: 'The Silent Cliffs',
        localCeilingOrdinal: 12,
        reachable: rows,
        unplaceable: 0
    });
    const names = rows.map(r => r.name);
    return {
        prose: out.lines.filter(l => names.some(n => l.startsWith(n))).join('\n'),
        engineRows: out.structure.filter(l => names.some(n => l.startsWith(n))).join('\n'),
        engine: out.structure.join('\n'),
        all: [out.headline, ...out.lines, ...out.structure].join('\n')
    };
}

describe('what the travel list may say about a place nobody has been to', () => {
    it('does not print the live headcount of an over-subscribed place', () => {
        const { prose, engineRows } = read([place({ occupants: 9, supportedDraw: 7 })]);
        // The count is the leak. 7 is the ground's carrying capacity, which is
        // a standing property and is meant to still be here.
        expect(prose).not.toMatch(/\b9\b/);
        expect(engineRows).not.toMatch(/\b9\b/);
        expect(prose).toContain('7');
    });

    it('does not print the live headcount of a comfortable place either', () => {
        const { prose, engineRows } = read([place({ occupants: 5, supportedDraw: 7 })]);
        expect(prose).not.toMatch(/\b5\b/);
        expect(engineRows).not.toMatch(/\b5\b/);
    });

    it('still says it is over, which is what teaches the mechanic', () => {
        const { prose } = read([place({ occupants: 9, supportedDraw: 7 })]);
        expect(prose).toContain('over the draw of 7 it comfortably carries');
        expect(prose).toMatch(/slowing the rest/);
    });

    it('still says it is not over, so the two can be told apart', () => {
        const { prose } = read([place({ occupants: 5, supportedDraw: 7 })]);
        expect(prose).toContain('comfortably carries a draw of 7');
        expect(prose).not.toMatch(/over the draw/);
    });

    it('still says when nobody draws on it, which is the row worth travelling for', () => {
        const { prose } = read([place({ name: 'the Jade Gorge vein', occupants: 0, supportedDraw: 30 })]);
        expect(prose).toMatch(/[Nn]obody is said to draw on it/);
    });

    /**
     * Empty ground is its own band, and both channels have to agree it is.
     * Played and caught: the prose said "Nobody is said to draw on it at all"
     * and the engine row said "occupancy said to sit inside the draw of 47" -
     * about the same spirit vein, in the same answer.
     */
    it('says empty ground is empty in the engine channel too', () => {
        const { prose, engineRows } = read([
            place({ name: 'the Jade Gorge vein', occupants: 0, supportedDraw: 47 })
        ]);
        expect(prose).toMatch(/[Nn]obody is said to draw on it/);
        expect(engineRows).toContain('nothing said to be drawing on it');
        expect(engineRows).not.toContain('sit inside the draw');
    });

    it('says nothing at all where the world holds no record', () => {
        const { prose } = read([place({ occupants: null, supportedDraw: null })]);
        expect(prose).not.toMatch(/draw/i);
    });

    /**
     * The engine channel is read by the player, so the count cannot survive
     * there either - and its absence is stated rather than left to be noticed.
     */
    it('keeps the count out of the engine channel, and says why it is not there', () => {
        const { engine, engineRows } = read([place({ occupants: 9, supportedDraw: 7 })]);
        expect(engineRows).not.toMatch(/\b9\b/);
        expect(engineRows).toContain('7');
        expect(engine).toContain('never as a count');
    });

    /**
     * The register. These rows are what is SAID about a place, and a player who
     * can tell that from a measurement can also tell that it might be wrong.
     */
    it('reads as report rather than as measurement', () => {
        const { prose } = read([
            place({ name: 'Iron Gate', occupants: 9, supportedDraw: 7 }),
            place({ name: 'Six Li', occupants: 5, supportedDraw: 7 })
        ]);
        expect(prose).toMatch(/spoken of|said to|nobody speaks of/);
    });
});
