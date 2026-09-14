/**
 * The elementless road, and the apex door it reaches.
 *
 * THE DESIGN THIS PINS
 * --------------------
 * `techniques.ts` starves the two mutated elements on purpose - "every wuxing
 * element has strictly more arts than either mutated element does" - and the
 * compensation it names in the same breath is `element: null`: an art any root
 * may cultivate without wuxing conflict, a little weaker per qi spent than a
 * matched elemental art of the same grade.
 *
 * That compensation is only real if the elementless line is a LADDER rather
 * than a handful of books. The case it has to carry is somebody holding a
 * mutated root - rare, fast, and with almost nothing written for it - whose
 * one house of matching arts is shut to them. Their road is the elementless
 * one, and the requirement on it is not that it be easy. It is that it reach
 * an apex door at all.
 *
 * Two numbers settle that and neither is read twice by anybody:
 *
 *   - the elementless line's own reach, which is a property of nine `cap` and
 *     `requiredOrdinal` fields spread over two hundred thousand lines of
 *     catalog, and
 *   - the Hollow Court's `admissionOrdinal`, which is 29.
 *
 * The second is 29, so the road clears the door with no elemental book anywhere
 * in the chain. Either number can be edited in isolation by somebody who has
 * never seen the other, and the moment the first drops below the second a
 * mutated root is a character sheet with no road out of the middle of the
 * ladder.
 *
 * WHAT THE ONE-KIND RULING DID TO THE FIRST NUMBER, MEASURED
 * ---------------------------------------------------------
 * It was 33. It is 45, and this file is the loudest consequence of collapsing
 * the two kinds of technique into one, so it is written down here in full.
 *
 * The old chain was six cultivation canons. The new one is nine books and only
 * three of them are canons - a rung-0 elementless PUNCH carries somebody to 13,
 * a movement art carries them 13 to 17, a needle art 17 to 21. That is the
 * ruling working exactly as stated: every technique carries its practitioner up
 * a few rungs, and a technique with no element carries any root.
 *
 * The part a design owner should look at is the top of it. Body Integration -
 * ordinals 33, 34 and 35 - used to hold no elementless book at all, and that
 * neck was AUTHORED, the narrowest in the world, and the file said so. It is
 * bridged now, by `gate-that-was-closed` and `sixteen-thread-command`. Both are
 * immortal grade and both are `provenance: 'ruin'`, so the neck is not widened
 * on anybody's shelf - it is crossed by what somebody dug out of a dead house -
 * but it is crossed, and the sentence "that neck is authored" is no longer
 * true. Whether that is the intended price of one kind of art is the owner's
 * call and not this file's.
 */

import { describe, it, expect } from 'vitest';
import { TECHNIQUES, stopsSomewhere, isWideSpan } from '../../src/data/cultivation/techniques.js';
import { SECTS, SECT_ADMISSION } from '../../src/data/cultivation/sects.js';
import { conflictsWithRoot, getSpiritRoot } from '../../src/engine/cultivation/spirit-roots.js';
import { techniqueExhausted } from '../../src/engine/cultivation/cultivation.js';

interface Book {
    id: string;
    req: number;
    cap: number;
    element: string | null;
}

/** Ordinary cultivation manuals only - wide-span treasures are a separate road. */
const ORDINARY_MANUALS: readonly Book[] = TECHNIQUES
    .filter(t => stopsSomewhere(t) && !isWideSpan(t))
    .map(t => ({ id: t.id, req: t.requiredOrdinal, cap: Number(t.cap), element: t.element ?? null }));

/**
 * How far a succession of these books carries somebody from the bottom.
 *
 * `techniqueExhausted` is the arbiter of when a book stops, so it is what
 * decides each step rather than a `>` written out again here: a book is still
 * teaching at `o` when it is not exhausted at `o`, and the walk cannot drift
 * from the engine that will actually stop the player.
 */
function reachOf(books: readonly Book[]): { ordinal: number; chain: Book[] } {
    let ordinal = 0;
    const chain: Book[] = [];
    for (let guard = 0; guard < ORDINARY_MANUALS.length + 1; guard++) {
        const open = books.filter(b => b.req <= ordinal && !techniqueExhausted(ordinal, b.cap));
        if (open.length === 0) break;
        const best = open.reduce((a, b) => (b.cap > a.cap ? b : a));
        chain.push(best);
        ordinal = best.cap;
    }
    return { ordinal, chain };
}

const ELEMENTLESS = ORDINARY_MANUALS.filter(b => b.element === null);

describe('the elementless road reaches an apex door', () => {
    it('is an unbroken ladder from the bottom of the world, with no seam in it', () => {
        const { ordinal, chain } = reachOf(ELEMENTLESS);

        // THE SHAPE, NOT THE LIST. This pinned six ids in order, and the order
        // is an artefact of which books exist at which rungs - the exact thing
        // a content pass is allowed to change. What the road has to be is
        // unbroken and elementless, so that is what is asked.
        expect(chain.length).toBeGreaterThan(0);
        expect(chain[0].req).toBe(0);
        for (let i = 1; i < chain.length; i++) {
            expect(chain[i].req, `${chain[i].id} opens above where ${chain[i - 1].id} stops`)
                .toBeLessThanOrEqual(chain[i - 1].cap);
        }
        // Not one of them borrows an element. This is the whole claim.
        expect(chain.every(b => b.element === null)).toBe(true);
        // And it reaches past the last realm boundary an ordinary manual covers.
        // It was 33 before every art started carrying somebody; see the header.
        expect(ordinal).toBeGreaterThanOrEqual(33);
    });

    it('clears the Hollow Court, which is the apex door that tests a rung and nothing else', () => {
        const court = SECTS.find(s => s.id === 'sect-hollow-court');
        expect(court).toBeDefined();

        const bar = SECT_ADMISSION['sect-hollow-court'];
        expect(court!.admissionOrdinal).toBe(29);
        expect(bar.minOrdinal).toBe(29);
        expect(reachOf(ELEMENTLESS).ordinal).toBeGreaterThanOrEqual(court!.admissionOrdinal);

        // The reason the road is enough on its own: the Court asks for a rung
        // and for evidence, and for no attribute, no lineage and no element.
        // `preferredRoots` is not a gate anywhere in `src/` - `sect-manage.ts`
        // says so in as many words - but an EMPTY list is the stronger fact,
        // because it means there is nothing here for a later reader to promote
        // into one.
        expect(bar.preferredRoots).toEqual([]);
        expect(bar.minMight).toBeUndefined();
        expect(bar.minInsight).toBeUndefined();
        expect(bar.minCharm).toBeUndefined();
        expect(court!.recruits).toBe(true);
    });

    it('is the same road for a mutated root and for a muddled one, and neither is refused a book on it', () => {
        // The two roots the catalog treats as unserved, for opposite reasons:
        // one is rare and has almost nothing written for it, the other is the
        // byword for a hopeless draw. The elementless line answers both, and
        // the answer is identical, which is why one audit covers them.
        for (const key of ['mutated_lightning', 'muddled_five_element'] as const) {
            const root = getSpiritRoot(key);
            for (const book of reachOf(ELEMENTLESS).chain) {
                // Vacuously true while the chain is elementless, and that is
                // the point: it is what "any spirit root may cultivate the art
                // without wuxing conflict" means when it is checked rather than
                // asserted.
                expect(book.element === null || !conflictsWithRoot(root, book.element as never)).toBe(true);
            }
        }
    });

    it('crosses Body Integration on what somebody dug up, never on a shelf', () => {
        // WHAT THIS USED TO ASSERT, AND WHY IT CANNOT ANY MORE. It was
        // "leaves Body Integration to somebody else's element, and that neck is
        // authored rather than missing", and it held that every ordinary manual
        // still teaching at 33, 34 and 35 was elemental. That was true of four
        // books while a predicate kept 111 rows out of the set.
        //
        // Every technique carries somebody now, so two elementless arts reach
        // into the neck and it is no longer shut. The claim that survives - and
        // it is the one that mattered, because it is about what a house can
        // hand you - is that NO HOUSE TEACHES either of them. An elementless
        // root still cannot be walked through Body Integration by joining
        // anybody. They have to find the book.
        const stillTeachingAt = (o: number) =>
            ORDINARY_MANUALS.filter(b => b.req <= o && !techniqueExhausted(o, b.cap));

        for (const o of [33, 34, 35]) {
            const open = stillTeachingAt(o);
            expect(open.length).toBeGreaterThan(0);
            for (const book of open) {
                if (book.element !== null) continue;
                const row = TECHNIQUES.find(t => t.id === book.id)!;
                expect(row.provenance, `${book.id} crosses the neck and is taught`)
                    .not.toBe('taught');
                expect(
                    SECTS.some(s => s.teaches.includes(book.id)
                        || s.signatureTechniqueId === book.id),
                    `${book.id} crosses the neck and sits on a house's shelf`
                ).toBe(false);
            }
        }

        // Neither element overcomes lightning, so the neck is narrow for her
        // and it is not shut. `OVERCOMES` maps both mutated elements to null,
        // which is what makes every elemental book in the world at worst
        // neutral to a mutated root rather than a torn meridian.
        const lightning = getSpiritRoot('mutated_lightning');
        for (const book of stillTeachingAt(33)) {
            expect(conflictsWithRoot(lightning, book.element as never)).toBe(false);
        }
    });
});
