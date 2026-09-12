/**
 * A measurement whose answer depends on the order of its own corpus is not a
 * measurement of the game.
 *
 * `scripts/probe-what-a-refusal-is-still-for.ts` used to open ONE run per
 * scenario and play every sentence down it, so turn N inherited turns 1..N-1:
 * days spent, stones gone, items bought, and a fight left standing. Reordering
 * the list would have moved the published figures, which makes them a property
 * of the list.
 *
 * The fix is that each sentence now runs against a restored copy of the
 * arranged state behind a freshly constructed service. This file is the
 * property that fix has to keep: **the same sentence gets the same answer
 * wherever it sits in the corpus.**
 *
 * ── WHAT IT COST, AND WHY IT IS A RESTORE RATHER THAN A REPLAY ───────────
 *
 * Replaying the arrangement before every sentence is the obvious fix and was
 * costed: the arrangements run 0.4s to 4.3s each, which is about 86 minutes
 * added across the scenario matrix. Capturing the arranged rows once and
 * putting them back is 8ms to capture 5,727 rows across 105 tables and 48ms to
 * restore and construct a service, or 2.6 minutes across the same matrix.
 *
 * Restoring rows is a real state rather than a replayed one, and it is not a
 * hand-written fixture: what comes back is whatever the played arrangement
 * actually produced, so a path that starts writing a different column is
 * captured with it.
 *
 * ── THE LEAK THAT WAS MEASURED, AND THE SECOND ARM ───────────────────────
 *
 * Measured on 'all of it at once' with the twenty state-carrying sentences
 * below, in the corpus order and shuffled:
 *
 *   with the state restored between sentences   0 of 20 disagree
 *   played sequentially, as the probe used to   1 of 20 disagrees
 *
 * and over the whole 124-sentence corpus, which is too slow to assert here,
 * 0 of 124 disagree in this scenario and in the back-reference one.
 *
 * and the one is the sentence the previous pass reported:
 *
 *   I stand guard while she crosses    attack/answered  vs  guard/refused
 *
 * A fight left standing by an earlier sentence turns a request to guard
 * somebody into a round of the fight. That is why the second arm is here: an
 * equality test on its own would pass just as well if the corpus carried no
 * state at all, and would then be proving nothing.
 *
 * WHEN THE SECOND ARM GOES RED, the corpus has stopped carrying state between
 * turns - which is a finding and not a failure. Confirm it, then delete that
 * arm rather than the file: the first one is the property worth keeping.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SCENARIOS, measureAgainst, type Row } from '../../scripts/probe-what-a-refusal-is-still-for.js';
import { makeGameInWorld } from './harness.js';

const WORLD = 'refusal-audit-a';
const SITUATION = 'all of it at once';

/**
 * The sentences that carry state, rather than a sample of the whole corpus.
 *
 * A slice chosen at random would mostly be sentences that spend nothing and
 * change nothing, and would hold the property for the wrong reason. These start
 * fights, spend days, spend stones, buy things and refer back to what the last
 * turn listed.
 */
const STATE_CARRYING = [
    'I kill everyone here', 'I pick a fight', 'I attack the strongest person here',
    'I stand guard while she crosses', 'I watch over his breakthrough',
    'I sit down', 'I count my spirit stones', 'I take a nap', 'I wait for morning',
    'give me everything you have', 'I give him my spirit stones',
    'I leave', 'where can I go', 'I ask him about the sect',
    'more', 'the second one', 'I take it', 'I read what I am carrying',
    'I buy a manual', 'I look at the sky'
] as const;

/** A shuffle that is the same every run, because a flaky order is not a proof. */
function shuffled(said: readonly string[], seed: number): string[] {
    const out = [...said];
    let state = seed;
    for (let i = out.length - 1; i > 0; i -= 1) {
        state = (state * 1103515245 + 12345) % 2147483648;
        const j = state % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** What a sentence was read as, which is the whole of what must not move. */
const readAs = (row: Row): string => `${row.verb}/${row.verdict}`;

const scenario = SCENARIOS.find(s => s.given === SITUATION)!;

let before: string | undefined;
beforeAll(() => {
    before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
});
afterAll(() => {
    if (before === undefined) delete process.env.ADMIN_MODE;
    else process.env.ADMIN_MODE = before;
});

describe('given the probe, when the corpus is shuffled', () => {
    it('then every sentence reads the same as it did in the corpus order', async () => {
        const inOrder = await measureAgainst(scenario, WORLD, STATE_CARRYING);
        const mixed = await measureAgainst(scenario, WORLD, shuffled(STATE_CARRYING, 7));

        const then = new Map(mixed.map(row => [row.said, readAs(row)]));
        const moved = inOrder
            .filter(row => then.get(row.said) !== readAs(row))
            .map(row => `${row.said}: ${readAs(row)} -> ${then.get(row.said)}`);

        expect(moved, moved.join('\n')).toEqual([]);
    }, 300_000);

    /**
     * The arm that makes the one above worth having. See the header.
     */
    it('but played down one run, as it used to be, at least one sentence moves', async () => {
        const played = async (order: readonly string[]): Promise<Map<string, string>> => {
            const { game } = await makeGameInWorld({
                seed: `${WORLD}-${SITUATION}`, worldSeed: WORLD, adminMode: true
            });
            await game.newRun('Prober');
            await scenario.arrange(line => game.act(line));

            const read = new Map<string, string>();
            for (const said of order) {
                try {
                    const turn = await game.act(said);
                    const plan = turn.toolCalls.find(call => call.name === 'narrator.plan');
                    const declined = turn.toolCalls.filter(
                        call => !call.ok && !call.name.startsWith('narrator.')
                    );
                    read.set(said, `${plan?.action ?? 'none'}/${declined.length > 0 ? 'refused' : 'answered'}`);
                } catch {
                    read.set(said, 'threw');
                }
            }
            return read;
        };

        const first = await played(STATE_CARRYING);
        const second = await played(shuffled(STATE_CARRYING, 7));
        const moved = STATE_CARRYING
            .filter(said => first.get(said) !== second.get(said))
            .map(said => `${said}: ${first.get(said)} -> ${second.get(said)}`);

        expect(
            moved.length,
            'the corpus no longer carries state between turns, so the reset the probe '
            + 'does between sentences is no longer buying anything. Confirm that, then '
            + 'delete this arm and keep the one above.'
        ).toBeGreaterThan(0);
    }, 300_000);
});
