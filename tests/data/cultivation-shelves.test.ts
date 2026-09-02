/**
 * What each house has to teach, and the rule that ties a road's reach to how
 * many houses hold it.
 *
 * `cultivation-technique-caps.test.ts` owns what a cap MEANS. This file owns
 * the other half: how the caps are distributed across the world's shelves. The
 * two are separate because the first is a property of the ladder and the second
 * is a property of the institutions standing on it, and an edit that is correct
 * for one is routinely wrong for the other.
 *
 * THE COUNTING RULE IS MEASURED, NOT AUTHORED. Nothing here assigns a road to a
 * rarity tier. Every assertion below reads the `teaches` arrays and checks that
 * what falls out of them still has the shape the setting claims - which is how
 * "every manual above the Void Refinement line is taught by exactly one house"
 * came to be a fact in `docs/world/things/items.md` rather than a policy.
 */
import { describe, it, expect } from 'vitest';

import { SECTS } from '../../src/data/cultivation/sects.js';
import { TECHNIQUES, getTechnique } from '../../src/data/cultivation/techniques.js';
import { BOOKLESS_CEILING } from '../../src/engine/world/manuals.js';

/** The cultivation-class rows on a teach list. The rest is what you fight with. */
function roadsOf(teaches: readonly string[]) {
    return teaches
        .map(id => getTechnique(id))
        .filter((t): t is NonNullable<ReturnType<typeof getTechnique>> =>
            !!t && t.class === 'cultivation');
}

/** How many houses list each road. The only source of rarity in this file. */
const HOLDERS: ReadonlyMap<string, string[]> = (() => {
    const m = new Map<string, string[]>();
    for (const s of SECTS) {
        for (const t of roadsOf(s.teaches)) m.set(t.id, [...(m.get(t.id) ?? []), s.id]);
    }
    return m;
})();

const ROADS = TECHNIQUES.filter(t => t.class === 'cultivation');
const holdersOf = (id: string): string[] => HOLDERS.get(id) ?? [];
/** Uncapped sorts above every capped road; only one book in the world is. */
const capOf = (t: { cap: number | null }): number => t.cap ?? 99;

describe('the counting rule - rarity rises with reach', () => {
    it('never lets a deeper band be held more widely than a shallower one', () => {
        // The owner's rule, stated as "it is more rare as we go", and it is a
        // claim about the MOST widely held road at each height rather than
        // about the average one.
        //
        // The average is the trap and it caught the probe that produced this
        // file: averaging houses-per-road across a cap band includes the ruin
        // and grave books no house teaches at all, which cluster at the top and
        // drag the mean to zero there. Measured that way, cap 25 came out as
        // the most widely held band in the world and cap 33 came out rarer than
        // cap 45 - two inversions, both entirely artifacts of dividing by books
        // nobody holds. Take the maximum over taught roads and the real series
        // is 24, 24, 13, 13, 3, 1, 1, 1.
        const widest = new Map<number, { id: string; n: number }>();
        for (const t of ROADS) {
            const n = holdersOf(t.id).length;
            if (n === 0) continue;                  // not on any shelf: not a datum about shelves
            const at = widest.get(capOf(t));
            if (!at || n > at.n) widest.set(capOf(t), { id: t.id, n });
        }

        const caps = [...widest.keys()].sort((a, b) => a - b);
        expect(caps.length, 'no taught roads at all').toBeGreaterThan(3);
        for (let i = 1; i < caps.length; i++) {
            const below = widest.get(caps[i - 1])!;
            const above = widest.get(caps[i])!;
            expect(
                above.n,
                `${above.id} caps at ${caps[i]} and is held by ${above.n} houses, ` +
                `more widely than ${below.id} which caps lower at ${caps[i - 1]} ` +
                `and is held by ${below.n}. A road that carries further must not be commoner.`
            ).toBeLessThanOrEqual(below.n);
        }
    });

    it('leaves the top of the ladder in exactly one pair of hands per road', () => {
        // The documented fact in `docs/world/things/items.md`, which was found by
        // counting rather than decided. It is asserted here so that a content
        // pass adding shelves cannot quietly turn a house's private road into
        // the province's standard crossing without the suite saying so.
        for (const t of ROADS) {
            if (capOf(t) <= 32) continue;           // at or below Void Refinement
            const houses = holdersOf(t.id);
            expect(
                houses.length,
                `${t.id} carries to ${t.cap} and is taught by ${houses.length} houses ` +
                `(${houses.join(', ')}). Above the Void Refinement line a road is one ` +
                `house's property or nobody's.`
            ).toBeLessThanOrEqual(1);
        }
    });

    it('keeps a road nobody teaches out of the rarity count entirely', () => {
        // A ruin book is not "the rarest road", it is not a road any house has.
        // Those are two different statements and conflating them is what broke
        // the measurement above.
        const untaught = ROADS.filter(t => holdersOf(t.id).length === 0);
        expect(untaught.length, 'every road is on a shelf, which cannot be right')
            .toBeGreaterThan(0);
    });
});

describe('a shelf is a working library', () => {
    it('never shelves a book no living house could be reading', () => {
        // `sects.ts` states it in its own header: a teach list is the WORKING
        // library, so anything recovered from a hole or taken off a body is by
        // definition not on it.
        for (const s of SECTS) {
            for (const t of roadsOf(s.teaches)) {
                expect(t.provenance, `${s.id} shelves ${t.id}, which is ${t.provenance}`)
                    .toBe('taught');
            }
        }
    });

    it('gives a house with any road at all a road its newest member can reach', () => {
        // A shelf whose shallowest book opens above what a new member can get
        // to is a shelf nobody walks in able to read. This is the entry end of
        // the same walkability argument `manuals.md` makes about gaps in the
        // middle of a shelf.
        //
        // THE BAR IS NOT THE ADMISSION ORDINAL, and asserting that it was is
        // what this test did first. It failed on the Lantern Hall, which admits
        // at 2 and whose one road opens at 5 - which reads as a three-rung dead
        // zone at the gate and is not one, because `BOOKLESS_CEILING` is 6. A
        // person admitted at 2 circulates by feel up to 6 on their own, passes
        // 5 on the way, and picks the road up there. The bookless climb exists
        // precisely so the bottom of the ladder does not need a book, so it is
        // the reach a new member actually has and the bar the shelf has to meet.
        // AND A LIVING MASTER BRIDGES ANY GAP, which is the setting's own
        // answer to a shelf that does not join up: guidance from somebody of an
        // appropriate level, passed master to student. The Hollow Court is the
        // case that forced this clause - it admits at 29 and its one road opens
        // at 41, a twelve-rung hole that looks indefensible until you notice
        // that its seats stand at 42 to 44 and can simply carry somebody over
        // it. `newlyEntitled` implements exactly that with its `teachable` set.
        // So the bar is: a new member can reach the shelf on their own, OR the
        // house still has somebody standing high enough to walk them to it.
        for (const s of SECTS) {
            const roads = roadsOf(s.teaches);
            if (roads.length === 0) continue;       // teaches nothing: a fact, not a defect
            const shallowest = Math.min(...roads.map(t => t.requiredOrdinal));
            const reach = Math.max(s.admissionOrdinal, BOOKLESS_CEILING);
            const carried = s.powerOrdinal >= shallowest;
            expect(
                shallowest <= reach || carried,
                `${s.id} admits at ${s.admissionOrdinal}, so a new member reaches ${reach} ` +
                `on the bookless climb; its shallowest road opens at ${shallowest} and its ` +
                `strongest member stands at ${s.powerOrdinal}, so nobody can be carried to it either`
            ).toBe(true);
        }
    });

    it('records how far each house can carry somebody, so a regression is visible', () => {
        // A characterisation rather than a bar. The point of pinning it is that
        // a shelf pass changes these numbers on purpose, and an accident is
        // then the diff nobody meant to write.
        const carry = new Map<string, number>();
        for (const s of SECTS) {
            const roads = roadsOf(s.teaches);
            carry.set(s.id, roads.length ? Math.max(...roads.map(capOf)) : 0);
        }
        // Two houses reach the top of the ladder; both hold a road nobody else
        // has. Everything else stops at Grand Ascension or below.
        const toTheTop = [...carry.entries()]
            .filter(([, c]) => c >= 45)
            .map(([id]) => id)
            .sort();
        expect(toTheTop).toEqual(['sect-azure-cloud-pavilion', 'sect-hollow-court']);
        // And a house that teaches no road at all is a power that does not
        // recruit, never a house with an empty library.
        for (const s of SECTS) {
            if (carry.get(s.id) === 0) {
                expect(s.recruits, `${s.id} recruits and teaches no road at all`).toBe(false);
            }
        }
    });
});
