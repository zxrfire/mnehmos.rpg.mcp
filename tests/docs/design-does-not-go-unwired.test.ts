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

import { findDataWithNoVerb, findUnwired } from '../../scripts/find-unwired-exports.mjs';

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
/**
 * 497 -> 496: `canHurtYou` HAS ITS CONSUMER, AND THE SEAM IS CLOSED.
 *
 * The slot was held open by name for exactly one export - the harm axis in
 * `src/web/action-set.ts`, landed contract-first so that the rule would not
 * live inside the surface that ranks by it. `situated-reads.ts` now imports it
 * and stamps every suggestion the strip produces, which is what the slot was
 * being held for, so it comes back down.
 *
 * That is the whole discipline this row was demonstrating: a seam held open on
 * purpose carries the name of the consumer that will close it, and somebody
 * closes it. A slot nobody brings back down is indistinguishable from the
 * defect this ratchet exists to catch.
 */
/**
 * AND IT COUNTS CODE, NOT PROSE.
 *
 * The header above names three things an unwired export can be and says only
 * the first is the finding. The second, *design deliberately stated as data*,
 * turned out to be a real and growing category: this repo writes its arguments
 * into the catalog as objects of sentences, and `THE_CANDIDATE_REGISTER` is
 * 5,396 characters of text with no code in it anywhere. Counting those as
 * unwired BEHAVIOUR made the ratchet measure the wrong thing, so a tree could
 * go over its ceiling by writing down more of its own reasoning.
 *
 * Measured when the split was added: 50 of 567 test-only exports and 10 of 161
 * dead ones were prose. That is a real correction rather than an escape hatch,
 * and the proof is that it does not close the gap on its own - the code-only
 * count was still 514 against a ceiling of 496, and the difference had to be
 * wired rather than reclassified.
 *
 * `isDesignStatedAsProse` in the script is the classifier: no function syntax,
 * and overwhelmingly quoted text by volume. A label or a small lookup fails the
 * length floor and stays counted as code, which is the conservative direction.
 */
/**
 * LOWERED WHEN THE INSTRUMENT WAS FIXED, not when the tree got better.
 *
 * These were 171 and 496. `find-unwired-exports.mjs` skipped every `index.ts`
 * as a reader on the rule that *"a barrel re-exporting a name has not read
 * it"* - true of a re-export, false of the several barrels in this repo that
 * import their steps and RUN them. Those steps were all reported unwired while
 * being called from their own barrel, which is the worst kind of false
 * positive: it points at working code and says delete it.
 *
 * The script now strips re-export statements and reads what is left, so a name
 * that survives is one the barrel actually does something with. That removed 26
 * dead and 51 test-only false positives, and the ceilings come down by exactly
 * that much. Nothing was wired to earn it - the tree did not change, the
 * measurement did.
 */
const DEAD = 144;
const TEST_ONLY = 445;

describe('design does not go unwired', () => {
    const rows = findUnwired() as Array<{
        name: string; file: string; state: string; kind: 'code' | 'prose';
    }>;

    it('does not add exports that nothing anywhere reads', () => {
        const dead = rows.filter(r => r.state === 'dead' && r.kind === 'code');
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
        const testOnly = rows.filter(r => r.state === 'testOnly' && r.kind === 'code');
        expect(
            testOnly.length,
            `Exports only a test reads rose above ${TEST_ONLY}. A rule pinned but never `
            + 'reached by the game looks maintained and is not.'
        ).toBeLessThanOrEqual(TEST_ONLY);
    });
});

/**
 * ── THE SECOND SHAPE, BECAUSE THE FIRST ONE IS THE CHEAP ONE ─────────────
 *
 * Everything above answers one question: does anything IMPORT this name. That
 * turns out to be the cheapest shape of unreachable to detect and the rarest
 * one in practice - the ratchet above sat green through a whole sweep of
 * defects, every one of which was unreachable in a way it cannot see:
 *
 *   a sentence with no branch      five route questions filed under a verb
 *                                  that reads dao ground, answered
 *                                  confidently by the wrong read
 *   a value dropped mid-flight     the head left off the roll that hands out
 *                                  a house's rooms; the house name dropped
 *                                  from a standing read; the recipient
 *                                  dropped from a gift
 *   data with no verb              auction venues with cadence, entry bonds
 *                                  and floor protections, and no way to bid
 *   output thrown away             a narration discarded by a guard that read
 *                                  a house's intake bar as the player
 *                                  breaking through
 *
 * Every one of those is a value going missing between two functions that DO
 * call each other, or a table nothing lets anybody act on. This covers the
 * second of them, which is the one that can be measured mechanically: a
 * catalog in `src/data/` that no player-facing act reads.
 *
 * THE ACT SURFACE IS `src/web/` AND `src/server/`. The first turns a sentence
 * into a verb and the second is where several of those verbs run. Measured
 * against `web` alone this called the dao-ground catalog unreachable while the
 * standing read was calling into it from `server/consolidated`.
 *
 * A ROW HERE IS A QUESTION AND NOT A TASK. Plenty of this data is the WORLD's
 * own - what a region grows, what a prefecture is called - and the player acts
 * on its consequences rather than on the table. Reading the engine is not
 * enough to clear a row, and that is the point: a table the simulation
 * consults is live for the world and unreachable for the player, and those are
 * two different findings.
 */
const DATA_NO_ACT_READS = 15;

describe('a catalog the player cannot act on', () => {
    it('does not add data no player-facing act reads', () => {
        const rows = findDataWithNoVerb() as Array<{ file: string; exports: number }>;
        const worst = [...rows]
            .sort((a, b) => b.exports - a.exports)
            .slice(0, 5)
            .map(r => `\n  ${r.exports}  ${r.file}`)
            .join('');
        expect(
            rows.length,
            `Catalogs no player-facing act reads rose above ${DATA_NO_ACT_READS}. `
            + 'Give it a verb, or say in the file that it belongs to the world and the '
            + `player meets it through its consequences.${worst}`
        ).toBeLessThanOrEqual(DATA_NO_ACT_READS);
    });
});
