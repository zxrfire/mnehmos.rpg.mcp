/**
 * A SPEND MADE BEFORE A SPAN IS STILL SPENT AFTER IT.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `applyTimeSkip` wrote eight fields as ABSOLUTE end states - `end - mid`,
 * where `end` is `skipEndState(before, skip)` and `before` is the caller's
 * snapshot. For the body and the clock that is right and deliberate:
 * `advanceRealm` moves some of those rows in between, and the simulation's own
 * end state is the only correct answer for where they finished.
 *
 * The purse is the one field on that list that is not exclusively the skip's,
 * and writing it absolutely silently REVERTED anything spent between the
 * snapshot and the call. `pressSomebody` debits a bribe and then runs the days
 * through `shortSkip`, so every bribe that landed was refunded by the span it
 * paid for.
 *
 * Measured in a live run, four bribes in a row:
 *
 *     "It was taken, and 60 spirit stones went with it."   67 -> 67
 *     "It was taken, and  5 spirit stones went with it."   67 -> 67
 *     "It was taken, and 10 spirit stones went with it."   67 -> 68
 *
 * The third is the tell and is not a second bug: the debit landed at 67 -> 57,
 * and then the write-back put the purse at the OLD base plus the span's own
 * income. The player was told ten stones left their hand and finished the turn
 * one stone richer.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE IS NOT IN THE BRIBE SUITE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Because the bribe is where it was SEEN and not what is wrong. Any caller that
 * charges for something and then spends days is exposed - a purchase before
 * travel, a fee before a duty, anything added later - and a guard written
 * against `pressSomebody` would pass while the next one broke. So the claim
 * here is about the primitive: **the skip applies what it spent, and never
 * asserts what it believes the total should be.**
 *
 * `tests/web/a-bribe-is-a-number.test.ts` holds the played-verb half.
 */

import { describe, it, expect } from 'vitest';
import { makeGame } from './harness';
import { applyTimeSkip } from '../../src/web/apply';
import type { TimeSkipResult } from '../../src/schema/cultivation';

/**
 * A span that changed nothing but the clock, and optionally the purse.
 *
 * Deliberately inert everywhere else: the claim is about one field, and a
 * fixture that also moved hp and progress would let a wrong answer hide in the
 * arithmetic of the others.
 */
function spanCosting(stones: number): TimeSkipResult {
    return {
        requestedDays: 30,
        simulatedDays: 30,
        interrupted: false,
        interruptReason: null,
        events: [],
        deltas: {
            cultivationProgress: 0,
            realmOrdinal: 0,
            hp: 0,
            qi: 0,
            satiety: 0,
            age: 30 / 360,
            injuriesGained: 0,
            spiritStones: stones
        },
        died: false,
        deathCause: null,
        injuriesSustained: [],
        breakthroughs: [],
        tolls: [],
        foundationEstablished: null,
        insightsGained: [],
        achievements: [],
        visions: [],
        endState: { starvationTurns: 0, bleedingTurns: 0, yearsAtCurrentRealm: 0 }
    } as unknown as TimeSkipResult;
}

describe('what a span does to a purse somebody else already touched', () => {
    /**
     * The reproduction, at the primitive. Snapshot, spend, then run the span
     * against the snapshot - which is exactly the order every caller uses,
     * because the snapshot is what the simulation has to be run against.
     */
    it('keeps a debit made between the snapshot and the call', async () => {
        const { game, repos } = makeGame({ seed: 'spend-survives' });
        const { cultivator, run } = (await game.newRun('Payer')) as never as {
            cultivator: { id: string }; run: { id: string };
        };
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: 500 });

        const before = repos.cultivators.getById(cultivator.id)!;
        const opened = before.spiritStones;
        expect(opened).toBeGreaterThan(60);

        // Somebody is paid. This is the write the span used to revert.
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -60 });
        expect(repos.cultivators.getById(cultivator.id)!.spiritStones).toBe(opened - 60);

        const applied = applyTimeSkip(repos, {
            before,
            run: repos.runs.getById(run.id)!,
            skip: spanCosting(0)
        });

        expect(
            applied.cultivator.spiritStones,
            'the span refunded a spend it had nothing to do with'
        ).toBe(opened - 60);
    }, 60_000);

    /**
     * And the span still charges what the span charges. The fix must not turn
     * into "the skip stopped touching the purse", which would pass the test
     * above and break every seclusion in the game.
     */
    it('still applies its own cost, on top of the debit', async () => {
        const { game, repos } = makeGame({ seed: 'spend-survives-2' });
        const { cultivator, run } = (await game.newRun('Payer')) as never as {
            cultivator: { id: string }; run: { id: string };
        };
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: 500 });

        const before = repos.cultivators.getById(cultivator.id)!;
        const opened = before.spiritStones;

        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -60 });

        const applied = applyTimeSkip(repos, {
            before,
            run: repos.runs.getById(run.id)!,
            skip: spanCosting(-25)
        });

        // Both, in order: the sixty that was paid to somebody and the
        // twenty-five the span itself ate.
        expect(applied.cultivator.spiritStones).toBe(opened - 60 - 25);
    }, 60_000);

    /**
     * The ordinary case, unchanged. Where nothing wrote in between, the row as
     * it stands and the snapshot hold the same purse, so the old expression and
     * the new one are identical - which is what makes this the general fix
     * rather than a behaviour change every other caller has to absorb.
     */
    it('is unchanged when nobody wrote in between', async () => {
        const { game, repos } = makeGame({ seed: 'spend-survives-3' });
        const { cultivator, run } = (await game.newRun('Payer')) as never as {
            cultivator: { id: string }; run: { id: string };
        };
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: 500 });

        const before = repos.cultivators.getById(cultivator.id)!;
        const opened = before.spiritStones;

        const applied = applyTimeSkip(repos, {
            before,
            run: repos.runs.getById(run.id)!,
            skip: spanCosting(-40)
        });

        expect(applied.cultivator.spiritStones).toBe(opened - 40);
    }, 60_000);

    /** A purse cannot go below nothing, however the arithmetic arrives there. */
    it('does not take a purse past empty', async () => {
        const { game, repos } = makeGame({ seed: 'spend-survives-4' });
        const { cultivator, run } = (await game.newRun('Payer')) as never as {
            cultivator: { id: string }; run: { id: string };
        };

        const before = repos.cultivators.getById(cultivator.id)!;
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -before.spiritStones });

        const applied = applyTimeSkip(repos, {
            before,
            run: repos.runs.getById(run.id)!,
            skip: spanCosting(-1000)
        });

        expect(applied.cultivator.spiritStones).toBe(0);
    }, 60_000);
});
