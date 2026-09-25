/**
 * How big a duty is and how long its term runs, off the tags a board row
 * carries. Apart from `duties.ts` so the board can word a posting with the term
 * it will be priced at: `duties.ts` imports the board, and the board cannot
 * import it back.
 */

/**
 * How big the thing is.
 */
export type DutyScale =
    /** One road, one village, one nest. Days. */
    | 'local'
    /** A province notices. A beast tide, a contested vein, a secret realm. */
    | 'regional'
    /** The house is at war. Everybody ranked is on the list. */
    | 'total';

/**
 * The span an ordinary errand runs to, and the span every duty's contribution
 * is measured against.
 *
 * One number doing both jobs, which is why it is named rather than typed three
 * times: {@link daysATermRuns} returns it for a row carrying no scale tag, and
 * `dutyTermsFor` divides by it, so a duty of this length credits exactly its
 * base. It is the unit of work on a board.
 */
export const ORDINARY_DUTY_DAYS = 20;

/**
 * How big, off the tags.
 */
export function scaleFor(tags: ReadonlySet<string>): DutyScale {
    if (tags.has('war')) return 'total';
    if (tags.has('tide') || tags.has('regional') || tags.has('competition')) return 'regional';
    return 'local';
}

/**
 * How long it takes. Off the tags, because the catalog already says which things
 * are urgent, which are campaigns and which are errands. Fixed rather than
 * rolled: the terms of an offer do not change while you think about it.
 */
export function daysATermRuns(tags: ReadonlySet<string>): number {
    const scale = scaleFor(tags);
    // A war is not a long errand. It is the thing that happens instead of the
    // decade the cultivator had planned, and the term says so.
    if (scale === 'total') return 720;
    if (scale === 'regional') return 90;
    if (tags.has('obligation')) return 60;
    if (tags.has('timed')) return 12;
    if (tags.has('quest')) return 30;
    return ORDINARY_DUTY_DAYS;
}
