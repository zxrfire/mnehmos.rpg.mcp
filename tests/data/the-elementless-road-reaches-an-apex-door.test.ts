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
 * The first is 33 and the second is 29, so the road clears the door by four
 * rungs with no elemental book anywhere in the chain. Either number can be
 * edited in isolation by somebody who has never seen the other, and the moment
 * the first drops below the second a mutated root is a character sheet with no
 * road out of the middle of the ladder.
 *
 * WHAT THIS DELIBERATELY DOES NOT ASSERT
 * --------------------------------------
 * That the elementless line reaches the TOP unaided. It does not: Body
 * Integration holds exactly two ordinary manuals in the whole catalog, one ice
 * and one fire, and no elementless one - so ordinals 33, 34 and 35 are crossed
 * on somebody else's element, on a wide-span treasure, or not at all. That neck
 * is authored and is the narrowest in the world; widening it with an
 * elementless book would loosen the ladder for every root at once. The hole is
 * pinned below as a fact so that a later reader meets it deliberately rather
 * than mistaking it for an oversight.
 */

import { describe, it, expect } from 'vitest';
import { TECHNIQUES, isWideSpan } from '../../src/data/cultivation/techniques.js';
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
    .filter(t => t.class === 'cultivation' && t.cap !== null && !isWideSpan(t))
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
    it('is an unbroken ladder from the bottom of the world to ordinal 33', () => {
        const { ordinal, chain } = reachOf(ELEMENTLESS);

        expect(ordinal).toBe(33);
        // Six books, one per realm boundary, no seam anywhere.
        expect(chain.map(b => b.id)).toEqual([
            'lesser-qi-gathering-manual',      //  0 -> 13  Qi Condensation
            'foundation-tempering-scripture',  // 13 -> 17  Foundation Establishment
            'undyed-core-canon',               // 17 -> 21  Core Formation
            'nascent-lotus-canon',             // 21 -> 25  Nascent Soul
            'meridian-devouring-art',          // 25 -> 29  Deity Transformation
            'void-tide-breathing-canon'        // 29 -> 33  Void Refinement
        ]);
        // Not one of them borrows an element. This is the whole claim.
        expect(chain.every(b => b.element === null)).toBe(true);
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

    it('leaves Body Integration to somebody else element, and that neck is authored rather than missing', () => {
        // The gap is where the road stops, so it is asked the way the road
        // asks: standing on 33, 34 or 35, which ordinary manual is still
        // teaching? A book pitched at 36 is not an answer to that question -
        // nothing elementless can put anybody on 36 in the first place.
        const stillTeachingAt = (o: number) =>
            ORDINARY_MANUALS.filter(b => b.req <= o && !techniqueExhausted(o, b.cap));

        for (const o of [33, 34, 35]) {
            const open = stillTeachingAt(o);
            expect(open.length).toBeGreaterThan(0);
            expect(open.every(b => b.element !== null)).toBe(true);
            expect(open.map(b => b.id).sort()).toEqual([
                'cinder-lung-tempering-canon',  // fire, The Severed
                'rime-heart-stillness-canon'    // ice, the Frostmirror Court
            ]);
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
