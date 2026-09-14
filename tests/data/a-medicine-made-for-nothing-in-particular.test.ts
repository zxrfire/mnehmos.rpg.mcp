/**
 * The best medicine in the world could not touch a single thing the catalog
 * calls permanent.
 *
 * The Sky-Mending Pill is chaos grade, costs 480,000, and two are known to
 * have been refined. It was `treat_injury` - the severity-graded ladder, which
 * skips every permanent wound at every grade on purpose, because a medicine
 * that reached them on a severity band would let a cheap meridian pill start
 * closing heart demons. So the row said *"treats every injury a body is
 * carrying"* and the resolver could not reach a parted channel, a missing arm,
 * a rooted heart demon or a burnt span.
 *
 * ── AND CHAOS IS THE ONE GRADE THAT IS NOT MADE FOR ANYTHING ────────────
 *
 * The design owner: *"it's chaos grade, not immortal or heaven grade so it has
 * to have a random affect. it randomly cures a permanent would, it doesn't say
 * which (good if you only have one)."*
 *
 * That is already the architecture rather than a new rule. `GRADE_SPREAD` has
 * `mortal`, `earth`, `heaven` and `immortal` all at `AS_MADE` - one outcome,
 * settled when the thing was made - and `chaos` is the only grade with a spread
 * drawn at the moment of use. `isSettledOnUse` is that fact, already exported.
 *
 * So there is ONE effect and two ways of choosing what it lands on, and the row
 * says which: a medicine that NAMES its wound reaches that wound, and a medicine
 * that names none reaches one of whatever the body is carrying that nothing
 * closes. This file pins that both halves work and that neither leaks into the
 * other.
 */

import { describe, it, expect } from 'vitest';

import { PILLS, getPill } from '../../src/data/cultivation/pills';
import { WOUND_TYPES } from '../../src/data/cultivation/wounds';
import { GRADE_SPREAD, isSettledOnUse } from '../../src/engine/cultivation/grade-spread';

const MENDS = 'mends_what_will_not_close';

describe('a medicine is made for one wound, or for none', () => {
    /**
     * THE OTHER HALF OF THIS FILE WAS OVERRULED WHILE IT WAS BEING WRITTEN.
     *
     * It pinned two immortal rows that NAMED the permanent wound each was made
     * for. The design owner then ruled that permanent injuries are structural
     * repair medicine's job, by rank, and that a bespoke pill beside it was a
     * second module doing the first one's work. One of the two was invented on
     * that premise and is gone; the other went back to the graded treat-injury
     * ladder it came from.
     *
     * So the claim inverts and gets sharper: on this effect nothing names a
     * wound, because naming one is what the other family does. What is left is
     * the rung the owner kept - *"KEEP THE CHAOS ONE WHICH REPAIRS A RANDOM ONE
     * AT ANY RANK"*.
     */
    it('has nothing on this effect naming a wound it was made for', () => {
        const named = PILLS.filter(p => p.effect === MENDS && (p.mends?.length ?? 0) > 0);
        expect(named.map(p => p.id), 'a pill named a permanent wound again').toEqual([]);
    });

    it('has the one that names nothing be the grade that is drawn on use', () => {
        const unnamed = PILLS.filter(p => p.effect === MENDS && (p.mends?.length ?? 0) === 0);
        expect(unnamed.length, 'nothing in the catalog answers without naming a wound')
            .toBe(1);
        const pill = unnamed[0];
        expect(pill.grade).toBe('chaos');
        // The reason it may be drawn at all, read off the spread rather than
        // asserted about the grade: chaos is the only one with more than one
        // outcome in it, which is what `isSettledOnUse` means.
        expect(isSettledOnUse(pill.grade)).toBe(true);
        expect(GRADE_SPREAD[pill.grade].length).toBeGreaterThan(1);
        for (const other of ['mortal', 'earth', 'heaven', 'immortal'] as const) {
            expect([other, isSettledOnUse(other)]).toEqual([other, false]);
        }
    });

    it('does not promise what it cannot do, in either direction', () => {
        // The sentence that started this: "Treats every injury a body is
        // carrying." It cannot and it no longer says so.
        const heaven = getPill('pill-sky-mending')!;
        expect(heaven.description).not.toMatch(/every injury/i);
        expect(heaven.description).toMatch(/one of the things about a body that nothing closes/i);

        // And the immortal row is no longer named for a diagnosis. It lost the
        // clinical name and kept its job: the top rung of the graded ladder,
        // which is where it was before an hour of edits moved it twice.
        expect(getPill('pill-severed-meridian-restoration')).toBeUndefined();
        const returning = getPill('pill-returning-spring')!;
        expect(returning.effect).toBe('treat_injury');
        expect(returning.mends ?? []).toEqual([]);
    });

    it('leaves no permanent wound answered by a medicine that names it', () => {
        // THE LINE THAT KEEPS A PERMANENT WOUND FROM BEING A THING MONEY
        // SOLVES, and it moved from `mends` to rank. Nothing in the pill
        // catalog names a permanent wound at all now: what answers one is
        // structural repair medicine at the rung the body stands on, and above
        // that ladder the drawn rung, which reaches any rank and picks for you.
        const namedAnywhere = PILLS.filter(p => (p.mends ?? []).length > 0);
        expect(namedAnywhere.map(p => p.id)).toEqual([]);
        expect(WOUND_TYPES.filter(w => w.permanent).length).toBeGreaterThan(0);
    });
});
