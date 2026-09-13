/**
 * A recipe takes the stuff out of your hands, which no recipe did.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT, AS FOUND
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `what-an-artifact-is-made-of.ts` was written, `whetherTheirHandsCanDoIt` was
 * wired to consult it, and the whole of it was a READ. Nothing anywhere took a
 * gram of anything. The design owner: *"recipes should take stuff out of your
 * inventory."*
 *
 * Three things were true at once and each of them hid the other two:
 *
 *   1. The one caller of the recipe - the commission in `asking-verbs.ts` -
 *      asks and answers and hands over nothing. It is explicit about it in its
 *      own header. So the gate guarded a question, not a thing.
 *   2. The yard (`craft` -> `half-built-craft.ts`) mints a real object and runs
 *      on the CONVEYANCE bill instead, which it does enforce and does consume.
 *      A reader checking whether crafting consumed anything found that it did,
 *      in the one place the artifact recipe is not.
 *   3. Nothing at all made a thing at a bench. MEASURED on the pattern table:
 *      "I craft a talisman", "I cut a slip", "I make myself a talisman" and
 *      "I forge an earth-grade sword" all parsed to `unclear`, while "I build a
 *      carriage" reached the yard. `a-talisman-is-one-act-somebody-already-
 *      paid-for.ts` - gate, fold, mint and burn - had one caller in `src/`, and
 *      it was world seeding.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THESE ASSERTIONS ENCODE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   A thing made at a bench is IN THEIR HANDS afterwards, and the pieces the
 *   recipe named are NOT. Both halves, because either alone is a lie: a mint
 *   with no spend is something out of nothing, and a spend with no mint is
 *   robbery.
 *
 *   A BENCH THAT IS SHORT TAKES NOTHING. Not the two pieces it could have used,
 *   not one. A craft refused after the materials were taken is the bug players
 *   are right to hate, and `whatTheRecipeSpends` is shaped so that a partial
 *   answer cannot be expressed - it returns null rather than a short list.
 *
 *   AND THE REFUSAL NAMES WHAT WOULD HAVE WORKED, which is this repo's standing
 *   rule for every refusal: what is wanted, why this is not it, and what would
 *   change it.
 *
 * RED-CHECKED, twice, and the second one is worth recording because it found
 * something.
 *
 *   With `takeWhatTheRecipeNames` made to return its answer without writing
 *   anything - the exact shape of the defect, a gate that reads and never takes
 *   - "the pieces are gone" fails and the other seven pass.
 *
 *   With the short-bench guard removed from `whatTheRecipeSpends` so that a
 *   partial spend is expressible, the two assertions under "the spend cannot be
 *   partial" fail and THE PLAYED ONE STILL PASSES - because the gate refuses
 *   the turn before the take is ever reached. So the played test is not what
 *   protects that rule; it measures the gate, and the guard is the only thing
 *   holding the layer below it. Both are kept. A defence that is only reachable
 *   through a check that currently runs first is a defence nobody is testing.
 *
 * THE WORLD IS PINNED. These read the rows a person is carrying, and an
 * unpinned `worldEnabled` harness mints a world from `randomUUID()`, so the
 * arrangement would silently be a different arrangement each run.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';
import { addToPouch, pouchQuantity } from '../../src/server/consolidated/cultivation-support';
import {
    WHAT_AN_ARTIFACT_IS_MADE_OF,
    whatTheRecipeSpends,
    whatWouldFill
} from '../../src/data/cultivation/what-an-artifact-is-made-of';
import { refiningOrdinalFor } from '../../src/engine/cultivation/who-can-refine-a-grade-of-medicine';

/**
 * One material per slot of the earth recipe, read out of the recipe itself.
 *
 * Never a hard-coded catalog id: a row regraded or renamed moves the set behind
 * a slot on its own, which is the whole reason a slot is a predicate. The
 * cheapest that fills each is the first, because `whatWouldFill` sorts by value.
 */
function oneOfEach(): string[] {
    return WHAT_AN_ARTIFACT_IS_MADE_OF.earth.map(slot => {
        const fills = whatWouldFill(slot);
        expect(fills.length, `nothing fills "${slot.what}"`).toBeGreaterThan(0);
        return fills[0].id;
    });
}

async function atABench(seed: string, holding: readonly string[]) {
    const harness = await makeGameInWorld({ seed, worldSeed: seed, worldEnabled: true });
    const { game, db } = harness;
    const { cultivator } = await game.newRun('Apprentice');
    // Arranged by admin rather than played to, which is the repo's rule: a
    // fixture that takes forty turns to reach goes flaky. The rung is the one
    // the CATALOG says works earth grade, never a number typed here.
    db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
        .run(refiningOrdinalFor('earth'), cultivator.id);
    for (const id of holding) addToPouch(db, cultivator.id, id, 'herb', 1);
    return { ...harness, cultivatorId: cultivator.id };
}

describe('the sentence reaches your own bench', () => {
    it('is a craft and not an unclear, and keeps the grade word', () => {
        // Every one of these parsed to `unclear` before the bench existed.
        for (const said of [
            'I craft a talisman',
            'I cut a slip',
            'I make myself a talisman',
            'I forge an earth-grade sword'
        ]) {
            expect(parseIntent(said).action, said).toBe('craft');
        }
        expect(parseIntent('I craft an earth-grade talisman').target)
            .toBe('earth-grade talisman');
    });

    it('and asking somebody ELSE is still a commission, not your bench', () => {
        // The one sentence the bench rule would otherwise steal, because "ask
        // him to cut me a talisman" contains "cut me a talisman" entire.
        const plan = parseIntent('I ask my master to cut me an earth-grade talisman');
        expect(plan.action).toBe('request');
    });

    it('and the yard keeps its hulls', () => {
        expect(parseIntent('I build a carriage').action).toBe('craft');
        expect(parseIntent('I build a carriage').target).toBe('carriage');
    });
});

describe('what a bench takes', () => {
    it('puts the thing in their hands and takes the pieces out of them', async () => {
        const held = oneOfEach();
        const { game, db, cultivatorId } = await atABench('bench-takes', held);

        const before = held.map(id => pouchQuantity(db, cultivatorId, id));
        expect(before.every(n => n === 1), 'the bench was not stocked').toBe(true);

        const answer = await game.act('I craft an earth-grade talisman') as unknown as {
            narration: string;
            toolCalls: { summary: string }[];
        };

        // THE THING EXISTS AND IS THEIRS.
        const carrying = await game.act('what am I carrying') as unknown as {
            narration: string;
        };
        expect(carrying.narration).toMatch(/talisman/i);

        // AND THE PIECES ARE GONE. This is the assertion the defect fails.
        for (const id of held) {
            expect(pouchQuantity(db, cultivatorId, id), `${id} was not taken`).toBe(0);
        }
        expect(answer.narration.length).toBeGreaterThan(0);
    }, 300_000);

    it('and a bench that is short takes nothing at all', async () => {
        // Two of the three slots filled, which is the arrangement a partial
        // spend would eat. The player is told what is missing and is still
        // holding both of the pieces they had.
        const held = oneOfEach();
        const kept = held.slice(0, held.length - 1);
        const { game, db, cultivatorId } = await atABench('bench-short', kept);

        const answer = await game.act('I craft an earth-grade talisman') as unknown as {
            narration: string;
        };

        for (const id of kept) {
            expect(pouchQuantity(db, cultivatorId, id), `${id} was taken anyway`).toBe(1);
        }

        // AND THE REFUSAL NAMES WHAT WOULD HAVE DONE. Read out of the recipe,
        // never spelled here: any name the game prints is a name the game has
        // to accept, and a name typed into a test is a name that goes stale.
        const missing = WHAT_AN_ARTIFACT_IS_MADE_OF.earth[WHAT_AN_ARTIFACT_IS_MADE_OF.earth.length - 1];
        const wouldHaveDone = whatWouldFill(missing).slice(0, 4).map(row => row.name);
        expect(
            wouldHaveDone.some(name => answer.narration.includes(name)),
            `nothing that would have filled "${missing.what}" was named`
        ).toBe(true);
    }, 300_000);

    it('and a hand at the wrong rung is a different answer from a bare bench', async () => {
        // NOT HAVING THE RUNG AND NOT HAVING THE STUFF ARE TWO THINGS TO GO AND
        // DO, and a line that said "your hands cannot" about an empty bench
        // would send somebody after the wrong one entirely.
        const { game } = await atABench('bench-rung', oneOfEach());
        const answer = await game.act('I craft a heaven-grade talisman') as unknown as {
            narration: string;
        };
        expect(answer.narration).not.toMatch(/nothing here is one/i);
    }, 300_000);
});

describe('and the spend cannot be partial', () => {
    it('is null for a short bench rather than the pieces it could have used', () => {
        const held = oneOfEach();
        expect(whatTheRecipeSpends('earth', held)).toHaveLength(held.length);
        expect(whatTheRecipeSpends('earth', held.slice(0, held.length - 1))).toBeNull();
        // Empty and null are two answers. Mortal grade is roadside work: it
        // takes nothing and it is made, which is not the same as refused.
        expect(whatTheRecipeSpends('mortal', [])).toEqual([]);
    });

    it('and spends one unit per slot, never one unit twice', () => {
        const body = whatWouldFill(WHAT_AN_ARTIFACT_IS_MADE_OF.earth[0])[0].id;
        // Three of one thing is three of one thing, and it fills one slot.
        expect(whatTheRecipeSpends('earth', [body, body, body])).toBeNull();
        const spend = whatTheRecipeSpends('earth', oneOfEach());
        expect(new Set(spend!.map(one => one.at)).size).toBe(spend!.length);
    });
});
