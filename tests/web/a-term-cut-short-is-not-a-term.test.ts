/**
 * One day of a twenty-day posting, and the house paid the whole wage.
 *
 * FOUND BY PLAYING BLIND. Three consecutive sentences off one screen:
 *
 *     Sect duty: A Culling Notice Written From an Old Survey of 20 days was
 *     intended.
 *     It ran 1 day and not 20 days. Something was already on its way.
 *     Completed. 94 spirit stones paid, and nothing on anybody's ledger.
 *
 * `shortSkip` cuts a span at its first interrupting occurrence, and the only
 * thing `completeDuty` was ever gated on was whether the cultivator came back
 * alive. So a posting that ran one day of twenty settled as a finished term -
 * and what interrupted it in the played run was a piece of NEWS arriving.
 *
 * Measured over 24 seeded runs at the same board: 2 duties were cut short, and
 * both were paid in full. It is the third of three things wrong with the same
 * screen, and the only one that is also free money.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * A TERM CUT SHORT IS NOT A TERM. Nothing is paid, nothing is credited, and the
 * oath stays open and due on the day it was always due - the state this engine
 * already names where `refuseDuty` is called: *a duty sworn and not finished
 * leaves a standing obligation somebody can read in forty years.*
 *
 * AND THE POSTING IS STILL ON THE WALL, which is what keeps that from being a
 * trap. Taking it up again is serving the word already given, so it lands on
 * the SAME oath row rather than opening a second one - see `aStandingDutyOath`.
 * Without that, the fix for `a-finished-duty-is-off-the-ledger.test.ts` would
 * have been undone by this one's own remedy: two open words for one posting,
 * and settling would close only the newer.
 *
 * A run through the whole loop, played:
 *
 *     > I put my name down for A Culling Notice...
 *     1 day of the 20 days asked for, and then it was broken off... The word
 *     stands, due on day 20, and the posting is still on the wall.
 *
 *     > I put my name down for A Culling Notice...
 *     Completed. 94 spirit stones paid.
 *
 *     > what oaths do i have
 *     Nothing, in either direction.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { makeGameInWorld } from './harness.js';

const WORLD = 'duty-cut';

beforeAll(() => {
    process.env.ADMIN_MODE = 'true';
});

interface Said { narration?: string; error?: string }

/**
 * `cut-19` is a pinned seed: the posting asks 20 days and the span is cut on
 * day 1. Pinned rather than searched for, because the whole finding is that an
 * interrupt is rare - 2 runs in 24 - and a test that hunts for one is a test
 * that passes by not finding it.
 */
async function aBoardWhereTheTermGetsCut(seed = 'cut-19') {
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
    await say(`ADMIN move ${game.atHand.locations.find(l => l.kind === 'sect_seat')!.name}`);
    const board = await say('what duties are there');
    const offered = /\n {2}([^:\n]{5,60}): /.exec(board.narration ?? '')?.[1];
    return { game, say, repos, offered };
}

describe('a duty broken off before its days were served', () => {
    it('is not reported as completed and is not paid', async () => {
        const { say, offered } = await aBoardWhereTheTermGetsCut();
        expect(offered).toBeTruthy();

        const first = await say(`I put my name down for ${offered}`);
        const said = first.narration ?? '';

        // The pinned seed cuts the span. If a later change stops it cutting,
        // this assertion is what says so rather than the test silently
        // passing on a run that had nothing to measure.
        expect(said, said).toMatch(/and not \d+ days|broken off/i);
        expect(said, said).toMatch(/broken off/i);
        expect(said, said).not.toMatch(/completed/i);
        expect(said, said).toMatch(/nothing is paid/i);
    }, 300_000);

    it('leaves the word standing, due on the day it was always due', async () => {
        const { say, repos, game, offered } = await aBoardWhereTheTermGetsCut();
        if (!offered) return;
        await say(`I put my name down for ${offered}`);

        const me = game.currentRun().cultivator;
        const duties = ledgerAbout(repos.db, me.id).filter(o => o.tags.includes('duty'));
        expect(duties.length, JSON.stringify(duties, null, 1)).toBe(1);
        expect(duties[0].status).toBe('open');
    }, 300_000);

    /**
     * THE HALF THAT KEEPS IT FROM BEING A TRAP, and the half that protects the
     * ledger fix in the sibling file. See the header.
     */
    it('is closed by taking the posting up again, on the same word', async () => {
        const { say, repos, game, offered } = await aBoardWhereTheTermGetsCut();
        if (!offered) return;
        await say(`I put my name down for ${offered}`);
        const second = await say(`I put my name down for ${offered}`);

        expect(second.narration ?? '', second.narration ?? '').toMatch(/completed/i);

        const me = game.currentRun().cultivator;
        const duties = ledgerAbout(repos.db, me.id).filter(o => o.tags.includes('duty'));
        // ONE word for one posting, however many attempts it took.
        expect(duties.length, JSON.stringify(duties, null, 1)).toBe(1);
        expect(duties[0].status).toBe('settled');

        const oaths = (await say('what oaths do i have')).narration ?? '';
        expect(oaths, oaths).not.toMatch(/service term/i);
    }, 300_000);
});
