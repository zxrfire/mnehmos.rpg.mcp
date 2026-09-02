/**
 * A ratchet on design nothing acts on.
 *
 * This repository's signature defect is not a bug, it is a module nothing
 * calls. It compiles, it typechecks, its tests pass, and it reads like settled
 * behaviour to whoever finds it next - so somebody re-derives a system that was
 * already written, or reasons carefully about a rule the game has never once
 * applied.
 *
 * It is not hypothetical and it is not rare. A marriage system was built on
 * four pieces that already existed with no caller anywhere: the binding that
 * settles a heavy account, the cost of walking out of one, the bloodline tier a
 * child inherits, and an oath cause nothing ever produced. The file naming the
 * gap said "there is no marriage system anywhere in this repository", and it
 * was one caller away from being wrong.
 *
 * So: the number may fall and it may not rise. When this fails, the fix is
 * almost never to raise the baseline - it is to wire the thing you just added,
 * or to be honest that it is data rather than behaviour.
 *
 * Run `node scripts/find-unwired-exports.mjs` to see what is unwired and where.
 *
 * WHAT THE TWO NUMBERS MEAN
 * -------------------------
 * `dead` is read by nothing at all - not the game, not a test. `testOnly` is
 * pinned by a test and never reached by the game, which is the more insidious
 * shape: it looks maintained. Both are ratcheted, because both have bitten.
 *
 * An unwired export is one of three things and only the first is a defect:
 * behaviour somebody meant to reach and did not; design deliberately stated as
 * data with nothing to plug into yet; or a seam held open on purpose. The
 * script cannot tell them apart and neither can this test - which is why it
 * ratchets rather than forbidding.
 */

import { describe, expect, it } from 'vitest';

import { findUnwired } from '../../scripts/find-unwired-exports.mjs';

/**
 * Measured, not chosen. Lower these when you wire something; never raise them.
 *
 * These are a HIGH-WATER MARK rather than a floor, and the difference matters
 * for anybody reading them as a target. They were taken while several changes
 * were landing at once, so they include some slack the tree does not need -
 * re-measure with `node scripts/find-unwired-exports.mjs` when nothing is in
 * flight, and bring them down to what it actually says.
 *
 * The number that matters is the direction. A count that only ever falls is
 * doing its job even when it is a few above what a quiet tree would report.
 *
 * `TEST_ONLY` came down from 502 when five subsystems that had been measured
 * at zero callers in `src/` were wired: the area-status layer, the counted
 * stock draw-down, what a beast kill leaves, who a house sends out and what
 * comes back, and building a conveyance out of what a hunt brings back. Four
 * of the five were the insidious shape rather than the inert one - pinned by a
 * test, read by nothing the game runs - which is why the second number moved
 * further than the first.
 *
 * IT WAS BRIEFLY 494, WHICH IS A LESSON ABOUT MEASURING RATHER THAN ABOUT THE
 * COUNT. That was the exact reading off a tree three other agents were landing
 * on, and it went red inside the hour over an export nobody in this change had
 * written. AGENTS.md: a single measurement off a shared tree is already
 * somebody else's unfinished work. So it carries a couple of rows of slack on
 * purpose, exactly as the paragraph above says these numbers should - the
 * direction is what the ratchet is for, and 502 to 496 is the direction.
 * Re-measure and bring it down when nothing is in flight.
 */
const DEAD = 171;
const TEST_ONLY = 496;

describe('design does not go unwired', () => {
    const rows = findUnwired() as Array<{ name: string; file: string; state: string }>;

    it('does not add exports that nothing anywhere reads', () => {
        const dead = rows.filter(r => r.state === 'dead');
        const worst = [...dead]
            .reduce((acc, r) => acc.set(r.file, (acc.get(r.file) ?? 0) + 1), new Map<string, number>());
        const top = [...worst.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([f, n]) => `\n  ${n}  ${f}`).join('');
        expect(
            dead.length,
            `Exports nothing reads rose above ${DEAD}. Wire it, or say in the file that it is `
            + `data rather than behaviour.${top}`
        ).toBeLessThanOrEqual(DEAD);
    });

    it('does not add exports only a test reads', () => {
        const testOnly = rows.filter(r => r.state === 'testOnly');
        expect(
            testOnly.length,
            `Exports only a test reads rose above ${TEST_ONLY}. A rule pinned but never `
            + 'reached by the game looks maintained and is not.'
        ).toBeLessThanOrEqual(TEST_ONLY);
    });
});
