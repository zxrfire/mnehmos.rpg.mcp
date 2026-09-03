/**
 * A column whose every row says the same thing, lifted out of the grid.
 *
 * THE RULE THIS EXISTS TO ENFORCE. `facts.ts` states it with the measurement
 * behind it: **say a constant once**. A table that prints one value down every
 * row of a column has made the reader pay for it once per row to learn it once,
 * and it is the defect the design owner has now objected to twice - a `no route`
 * stamped on every row of the admin map, under a heading that already said it.
 *
 * Measured on the standing register the day this was written: the comprehension
 * materials table printed four of its six columns identically on all seven rows
 * - a grade, a storage model, a price note and a provenance sentence, 28 cells
 * carrying four facts. The arterials table printed one province and one holder
 * down every row of a four-row table.
 *
 * ── WHY IT IS COMPUTED AND NOT WRITTEN INTO THE CAPTION ──────────────────
 *
 * Because the constant is a fact about the world right now, not a design
 * decision. Every comprehension material is sent down TODAY; a catalog edit
 * that made one of them refinable here would make a hand-written caption a lie
 * that nothing would catch. Computed, the column simply comes back the moment
 * two rows disagree, which is the same discipline the rest of the sheet uses
 * for claims it would rather measure than repeat.
 *
 * ── WHAT IS DELIBERATELY NOT HOISTED ─────────────────────────────────────
 *
 * The first column, always. It is what a reader is looking a row up BY, and a
 * table whose identity column had one value would be a bug rather than a
 * saving. And nothing at all below `MIN_ROWS`: on two rows, "both of these are
 * tracked" costs a reader more than reading the word twice.
 */

/** Under this, a repeated cell is cheaper to read than a sentence about it. */
const MIN_ROWS = 3;

export interface HoistedColumn {
    /** The column head, as it appeared in the table. */
    head: string;
    /** The one value every row carried, as HTML. */
    value: string;
}

export interface HoistedTable {
    heads: string[];
    rows: string[][];
    /**
     * Which of the original columns survived, in order.
     *
     * Returned rather than recovered from the heads, because a caller carries
     * per-column widths and cell classes and has to reindex them: matching on
     * the head text would break the first time two columns shared a name.
     */
    kept: number[];
    /** In column order. Empty where nothing was constant. */
    hoisted: HoistedColumn[];
}

/**
 * Split a table into the columns that vary and the ones that do not.
 *
 * Cells are compared as the HTML they render to, which is exact: two cells
 * built by the same expression from the same value are the same string, and two
 * built from different values are not. Heads and rows come back with the
 * constant columns removed, in their original order.
 */
export function hoistConstantColumns(
    heads: readonly string[],
    rows: readonly (readonly string[])[]
): HoistedTable {
    const whole = (): HoistedTable => ({
        heads: [...heads],
        rows: rows.map(r => [...r]),
        kept: heads.map((_, c) => c),
        hoisted: []
    });

    if (rows.length < MIN_ROWS) return whole();

    const constant = new Set<number>();
    for (let c = 1; c < heads.length; c++) {
        const first = rows[0][c] ?? '';
        if (rows.every(r => (r[c] ?? '') === first)) constant.add(c);
    }
    if (!constant.size) return whole();
    // A table with nothing left but its identity column has not been improved,
    // it has been emptied. Keep it whole and let the reader see the repetition.
    if (constant.size >= heads.length - 1) return whole();

    const kept = heads.map((_, c) => c).filter(c => !constant.has(c));
    return {
        heads: kept.map(c => heads[c]),
        rows: rows.map(r => kept.map(c => r[c] ?? '')),
        kept,
        hoisted: [...constant].sort((a, b) => a - b)
            .map(c => ({ head: heads[c], value: rows[0][c] ?? '' }))
    };
}

/**
 * The hoisted columns as one line, for printing under a caption.
 *
 * Says the head and the value, because a value with no label is a fact nobody
 * can place: "tracked" on its own is not an answer to a question the reader has
 * asked yet.
 */
export function hoistedLine(hoisted: readonly HoistedColumn[], rowCount: number): string {
    if (!hoisted.length) return '';
    return `<p class="note"><strong>The same on all ${rowCount}:</strong> `
        + hoisted.map(h => `${h.head.toLowerCase()} ${h.value}`).join(' &middot; ')
        + '</p>';
}
