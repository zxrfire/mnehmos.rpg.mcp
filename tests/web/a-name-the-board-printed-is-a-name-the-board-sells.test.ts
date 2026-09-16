/**
 * A thing the game printed, bought by the name the game printed.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS PLAYED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `I buy the Cross-Meridian Strike` - row one of the first board a beginner
 * ever reads - reached the engine with NOTHING TO BUY. The stones stayed in the
 * pouch, no book arrived, and the prose described the stall correctly, because
 * the prose was right about everything the engine told it.
 *
 * THE CAUSE IS A FIELD NOBODY PUT BACK. A reader that answers `{"action":
 * "buy"}` has chosen the verb and said nothing about the subject, which is the
 * commonest shape a small model answers with. `carryWhatOnlyTheSentenceKnows`
 * exists for exactly that - it puts back the facts about the sentence a model's
 * answer cannot carry, and it carried `leverage`, `terms`, `opening`, `thrown`,
 * `withArt`, `rations`, `stones` and the span, and not the name of the thing.
 *
 * ── AND ROW ONE WAS NOT THE CASUALTY. THE BOARD WAS ─────────────────────
 *
 * Measured here, by toggling the one line that fixes it: with the subject not
 * carried, **all eight rows of the stall board bought nothing**, not just the
 * first. There was no name a player could type that worked, which means the
 * defect was never about a particular book or a particular rename - it was
 * about every targeted verb losing its subject whenever the reader answered
 * with the verb alone.
 *
 * ── WHY IT IS NOT DONE FOR EVERY VERB ────────────────────────────────────
 *
 * `WHOSE_TARGET_IS_AN_OBJECT_OFF_A_CATALOG` is the guard, and the reason is
 * what a WRONG name costs. An object name is matched against a closed catalog
 * and refused by name with the board attached, so putting one back can only
 * improve a plan that had none. A FACE is different: the table's reading of a
 * person verb takes the whole tail of the sentence, so "I tell Cao Antao what
 * Ru Anwei said" yields the target "Cao Antao what Ru Anwei said" - and an
 * absent target means whoever is at hand while a wrong one is a refusal about
 * somebody who is not there. `a-name-the-verb-dropped-is-put-back.test.ts`
 * holds that line and went red when this was first written too widely.
 *
 * The other half of the same guard is WHERE it runs. `GameService.carryOut`
 * calls the same function after the reference resolver has had the plan, and
 * that resolver deliberately takes an unbindable phrase OFF the field so the
 * verb falls back to its own listing - "I buy the cheaper one" over a tied
 * board is answered with the board. So the subject is put back at phase 1 and
 * not in the executor, which is what the flag on the function is for.
 */

import { describe, expect, it } from 'vitest';

import { makeGame, ScriptedProvider } from './harness';
import { manualsAStallCarries } from '../../src/engine/world/what-a-copy-of-a-manual-costs-at-a-stall';
import { copyNamesHeldBy } from '../../src/server/consolidated/technique-manage';
import { carryWhatOnlyTheSentenceKnows } from '../../src/web/actions';

/** A reader that picked the verb and said nothing else, which is the common shape. */
const THE_VERB_ALONE = { plans: ['{"action":"buy"}'], narrations: ['(scripted)'] };

describe('a name the board printed is a name the board sells', () => {
    /**
     * Every row, not one. The names are read OUT of the catalog the stall reads
     * from rather than written here, because any name the game prints is a name
     * the game must accept and a name hard-coded here measures somebody else's
     * rename instead.
     */
    it('buys each row of the stall board by the name the stall printed', async () => {
        for (const row of manualsAStallCarries()) {
            const harness = makeGame({
                seed: `printed-${row.id}`, provider: new ScriptedProvider(THE_VERB_ALONE)
            });
            const { cultivator } = await harness.game.newRun('Holder');
            harness.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: 500 });

            await harness.game.act(`I buy the ${row.name}`);

            expect(
                copyNamesHeldBy(harness.repos.db, cultivator.id),
                `"I buy the ${row.name}" bought nothing`
            ).toContain(row.name);
        }
    }, 300_000);

    /**
     * The unit under it, so a regression names the field rather than a book.
     */
    it('puts the subject back when the reader answered with the verb alone', () => {
        const plan = carryWhatOnlyTheSentenceKnows(
            { action: 'buy' }, 'I buy the Cross-Meridian Strike', [], true
        );
        expect(plan.target).toBe('Cross-Meridian Strike');
    });

    /** And never over a subject the reader did supply, which is the better read. */
    it('never overwrites a subject the reader chose', () => {
        const plan = carryWhatOnlyTheSentenceKnows(
            { action: 'buy', target: 'Stone Hide Mantle' },
            'I buy the Cross-Meridian Strike', [], true
        );
        expect(plan.target).toBe('Stone Hide Mantle');
    });

    /**
     * And not at all where the two readings disagree about what is happening.
     * The sentence's reading of a DIFFERENT act is not a fact about this one,
     * which is the guard every other field in that function already sits
     * behind.
     */
    it('carries nothing across when the two readings name different verbs', () => {
        const plan = carryWhatOnlyTheSentenceKnows(
            { action: 'sell' }, 'I buy the Cross-Meridian Strike', [], true
        );
        expect(plan.target).toBeUndefined();
    });
});
