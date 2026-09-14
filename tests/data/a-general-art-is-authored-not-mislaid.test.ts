/**
 * A sword canon cannot become a book about nothing.
 *
 * `asksNothingOfTheRoad` answers true for an art that names no road, no element
 * and is not forbidden, and that is what makes an art GENERAL: it asks nothing,
 * so it refuses nobody. The primer everybody starts with is one, and before it
 * said so every derivation attempt against one refused `wrong_dao` forever.
 *
 * ── AND THE SAME PREDICATE IS TRUE OF A ROW THAT LOST ITS ROADS ──────────
 *
 * That is the hazard, and it is not hypothetical. An engine path that dropped
 * an art's `subjects` on the floor has already existed in this repo and has its
 * own regression test: `a-cast-to-never-is-not-a-type.test.ts`, which used to
 * pin that the sword cultivator got REFUSED and now pins something worse -
 * strip the roads off a sword canon and the wrong road walks in, because a
 * canon with nothing left to compare reads as a general art rather than as a
 * damaged one.
 *
 * The design owner, on being shown that: *"a sword canon can't be a book about
 * nothing lol"*. Correct, and a comment saying so would not stop it happening.
 *
 * So the set is pinned by name. Being general is a thing the catalog SAYS,
 * checkable against a list somebody wrote down on purpose, and an art that
 * joins the set by losing a field fails here with its own name in the message.
 * Nothing about this file blocks a new general art being authored - it asks for
 * one line, which is the point: the line is where the deliberateness lives.
 */

import { describe, it, expect } from 'vitest';

import { TECHNIQUES } from '../../src/data/cultivation/techniques';
import { asksNothingOfTheRoad } from '../../src/engine/cultivation/dao';

/**
 * Every art in the catalog that makes no claim about the road, by name.
 *
 * All seventeen are `category: 'cultivation'` - manuals somebody practises to
 * climb, written to be practicable by whoever picks them up. That is the shape
 * a general art has, and it is the reason the list is not arbitrary: a strike
 * or a step is about SOMETHING, and one that turns up here has lost a field
 * rather than been written that way.
 */
const ARTS_THAT_ASK_NOTHING: readonly string[] = [
    'arterial-sounding-canon',
    'azure-dew-gathering-canon',
    'chaos-origin-scripture',
    'driven-ground-endurance-canon',
    'first-and-last-breath-canon',
    'five-breath-circulation-scripture',
    'foundation-tempering-scripture',
    'heaven-conversing-primordial-canon',
    'lesser-qi-gathering-manual',
    'nascent-lotus-canon',
    'paired-breath-canon',
    'protected-crossing-canon',
    'single-road-treatise',
    'standing-mirror-first-register',
    'undyed-core-canon',
    'unwritten-span-scripture',
    'void-tide-breathing-canon'
];

describe('an art that asks nothing of the road', () => {
    it('is exactly the set somebody wrote down', () => {
        const found = TECHNIQUES.filter(asksNothingOfTheRoad).map(t => t.id).sort();
        expect(
            found,
            'an art became general, or stopped being general, without anybody saying so. '
            + 'If a row here lost its `subjects` or `element`, that is the defect - a sword '
            + 'canon with its roads stripped reads as a book about nothing and lets the wrong '
            + 'road walk in. If a general art was genuinely authored, add it to the list.'
        ).toEqual([...ARTS_THAT_ASK_NOTHING].sort());
    });

    /**
     * The half that says WHY the list is not arbitrary, so a future reader can
     * tell a general art from a damaged one without consulting this file.
     */
    it('is a manual somebody practises, never a strike or a step', () => {
        for (const id of ARTS_THAT_ASK_NOTHING) {
            const art = TECHNIQUES.find(t => t.id === id);
            expect(art, `${id} is not in the catalog any more`).toBeDefined();
            expect([id, art!.category]).toEqual([id, 'cultivation']);
        }
    });

    /**
     * And the reason the predicate is worth having at all: without it every one
     * of these refused every cultivator who ever lived, which is not a hard art
     * but an unreachable one.
     */
    it('covers the primer a run opens holding', () => {
        expect(ARTS_THAT_ASK_NOTHING).toContain('lesser-qi-gathering-manual');
    });
});
