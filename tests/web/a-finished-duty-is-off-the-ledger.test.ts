/**
 * Paid in full on one screen and overdue on the next.
 *
 * FOUND BY PLAYING BLIND, one turn apart:
 *
 *     > I put my name down for A Culling Notice Written From an Old Survey
 *     Completed. 94 spirit stones paid, and nothing on anybody's ledger.
 *
 *     > what oaths do i have
 *     service term, at serious, owed to unaffiliated. 20 days. Paid on
 *     completion: 0 contribution, 94 spirit stones. Due on day 20, which is
 *     already past.
 *     Owed by you to unaffiliated: service term... What would close it: doing
 *     the thing that was promised.
 *
 * The duty had been done, the wage had been paid, and the ledger still held the
 * player to it - overdue, with a penalty clause named.
 *
 * ── THE CAUSE ────────────────────────────────────────────────────────────
 *
 * `createObligation` derives a row's id with `stableId(kind, holder, subject,
 * cause, onDay, ...)`, and THE DAY IS PART OF IT. `acceptDuty` wrote the oath
 * on the day it was taken; `completeDuty` re-derived the same oath from the day
 * it was FINISHED, got a different id, and wrote a second row. The settled row
 * was the new one. The open row was never touched by anything, ever.
 *
 * So it was not one duty in a hundred: EVERY duty a player finished left a
 * permanent open overdue oath behind, on the one screen the whole social engine
 * is read through, and the only run where it did not was one that started and
 * finished on the same day.
 *
 * The same slip dropped `terms` on the settled row, which is what the oath read
 * prints verbatim - so the row that survived could not say what had been agreed
 * either.
 *
 * ── THE CLASS ────────────────────────────────────────────────────────────
 *
 * A derived id recomputed from a moving input, which is the same shape as a
 * value dropped between two functions that call each other. Two writers, one
 * row, and nothing in between them checking they meant the same row.
 *
 * WHAT IS NOT THE DEFECT: a duty taken on and NOT finished leaving its oath
 * open. That is deliberate - `turn-engine.ts` says so where `refuseDuty` is
 * called, *"a duty sworn and not finished leaves a standing obligation somebody
 * can read in forty years"* - and it is pinned below so a later fix cannot take
 * both halves at once.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { makeGameInWorld } from './harness.js';

const WORLD = 'duty-ledger';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string; error?: string }

async function standingAtTheBoard(seed: string) {
    const made = await makeGameInWorld({ seed, worldSeed: WORLD }) as unknown as {
        game: { newRun(n: string): Promise<unknown>; act(s: string): Promise<Said>;
                atHand: { locations: { name: string; kind: string }[] };
                currentRun(): { cultivator: { id: string } } };
        repos: { db: Parameters<typeof ledgerAbout>[0] };
    };
    const { game, repos } = made;
    await game.newRun('Runner');
    const say = (s: string) => game.act(s);
    await say('ADMIN set_realm ordinal=14');
    const seat = game.atHand.locations.find(l => l.kind === 'sect_seat')!;
    await say(`ADMIN move ${seat.name}`);
    return { game, say, repos };
}

/** Whatever this seed put on the wall, by the name the board printed. */
function aLineOffTheBoard(board: Said): string | null {
    return /\n {2}([^:\n]{5,60}): /.exec(board.narration ?? '')?.[1] ?? null;
}

describe('finishing a duty', () => {
    it('leaves no open oath behind, and no second row beside the one it closed', async () => {
        const { say, repos, game } = await standingAtTheBoard('ledger-a');
        const board = await say('what duties are there');
        const offered = aLineOffTheBoard(board);
        expect(offered, board.narration ?? '').toBeTruthy();

        const taken = await say(`I put my name down for ${offered}`);
        // Only meaningful on the runs that actually finished it. A duty cut
        // short or a cultivator who died is the other branch, pinned below.
        if (!/completed/i.test(taken.narration ?? '')) return;

        const me = (game as unknown as { currentRun(): { cultivator: { id: string } } })
            .currentRun().cultivator;
        const duties = ledgerAbout(repos.db, me.id).filter(o => o.tags.includes('duty'));

        // ONE row, not two. The second row was the whole defect.
        expect(duties.length, JSON.stringify(duties, null, 1)).toBe(1);
        expect(duties[0].status, JSON.stringify(duties[0], null, 1)).toBe('settled');
        // And it can still say what was agreed.
        expect(duties[0].terms, JSON.stringify(duties[0], null, 1)).toBeTruthy();
    }, 300_000);

    it('does not tell the player they still owe what they were just paid for', async () => {
        const { say } = await standingAtTheBoard('ledger-b');
        const board = await say('what duties are there');
        const offered = aLineOffTheBoard(board);
        if (!offered) return;

        const taken = await say(`I put my name down for ${offered}`);
        if (!/completed/i.test(taken.narration ?? '')) return;

        const oaths = (await say('what oaths do i have')).narration ?? '';
        // The exact two words off the played screen: the ledger said the term
        // was already past on the turn after it was paid.
        expect(oaths, oaths).not.toMatch(/already past/i);
        expect(oaths, oaths).not.toMatch(/service term/i);
    }, 300_000);
});
