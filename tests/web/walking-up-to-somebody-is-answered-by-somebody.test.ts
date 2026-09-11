/**
 * `interact` WAS ONE VERB DOING NINE THINGS, AND IT REFUSED 93% OF THE TIME.
 *
 * Measured on a replayed corpus - 744 turns, three situations, two pinned
 * worlds. `interact` was chosen 162 times and came back a refusal 150 of them.
 * The verbs that route by INTENT did not collide: `look`, `status`,
 * `inventory`, `assess`, `teacher`, `ceiling` and `work` between them refused
 * nothing at all.
 *
 * The seam was already one layer down. The 150 split across four different
 * resolvers, and two of the four are what this file pins:
 *
 *   engine.resolveParty/interact       72   nobody was named
 *   engine.resolveInteraction/talk     18   somebody was, and nothing happened
 *
 * ── A REFUSAL THAT CONTRADICTS ITSELF ON ONE SCREEN ──────────────────────
 *
 * `I introduce myself`, with two people standing in the square, came back:
 *
 *     Unresolved party: no subject named, and nobody is co-located to have
 *     meant. Known to this cultivator, or standing here: Jiang Ruoshui,
 *     Handworn Gate, Pei Hanyue, The Sitting Stone, Tao Chunxi, The Swept Gate.
 *
 * Nobody is co-located, and here are the people who are. A game master handed
 * that sentence asks who you meant and names them, which is what happens now:
 * one person here and it is put to them, several and somebody asks which.
 *
 * ── AND A PERSON WHO RESOLVED STILL GOT NOTHING ──────────────────────────
 *
 * `I talk to the nearest cultivator` resolved the person, printed their rung,
 * their age, their house, their rank and their whole open ledger, and then:
 *
 *     Attempt recorded; outcome not resolvable yet. No agreement, no exchange,
 *     no change of standing.
 *
 * A turn spent walking up to somebody who then does not exist. The shape this
 * repo already established for exactly this is in `costOfTeaching`, and
 * `taught-what-is-a-question-and-not-a-refusal.test.ts` states the rule: a
 * request that is coherent and underspecified is a QUESTION, put in the
 * character's mouth, with what can be asked for named in a fixed order so the
 * answer has somewhere to land. Walking up to somebody and saying nothing in
 * particular is that request with nothing named at all.
 *
 * ── WHAT IS NOT WIDENED ──────────────────────────────────────────────────
 *
 * No gate moves. A name the player has not been told still reaches nobody -
 * `nobodyByThatName` is untouched and still refuses, still naming the people
 * here who could be put it to. What changes is that a sentence which named
 * nobody, in a square with somebody in it, is a question rather than a denial.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';

/** The engine's own refusals for this turn, with the narrator rows dropped. */
function declined(turn: { toolCalls: { name: string; ok: boolean; summary: string }[] }) {
    return turn.toolCalls.filter(call => !call.ok && !call.name.startsWith('narrator.'));
}

describe('a sentence that named nobody, in a square with somebody in it', () => {
    it('never says nobody is here and then lists who is', async () => {
        const { game } = await makeGameInWorld({
            seed: 'walking-up', worldSeed: 'walking-up-world'
        });
        await game.newRun('Prober');

        // Who is actually standing here, read out of the game's own answer.
        const looked = await game.act('I look around');
        expect(looked.narration.trim().length).toBeGreaterThan(0);

        for (const said of ['I introduce myself', 'I make friends', 'I try to get to know people']) {
            const turn = await game.act(said);
            const summaries = turn.toolCalls.map(call => call.summary).join(' ');
            expect(summaries, said).not.toContain('nobody is co-located');
        }
    }, 300000);
});

describe('walking up to somebody who is there', () => {
    it('is a question they ask back, not an attempt that did not resolve', async () => {
        const { game } = await makeGameInWorld({
            seed: 'walking-up-2', worldSeed: 'walking-up-world'
        });
        await game.newRun('Prober');

        for (const said of ['I talk to the nearest cultivator', 'I bow to him']) {
            const turn = await game.act(said);
            expect(
                declined(turn).map(call => `${call.name}: ${call.summary}`),
                said
            ).toEqual([]);
            expect(turn.narration, said).not.toContain('No answer came back');
        }
    }, 300000);

    /**
     * The half that must not move. A name nobody told the player is still a
     * name that reaches nobody, and the refusal still says what would.
     */
    it('still refuses a name the player was never told', async () => {
        const { game } = await makeGameInWorld({
            seed: 'walking-up-3', worldSeed: 'walking-up-world'
        });
        await game.newRun('Prober');

        const turn = await game.act('I talk to Bai Wuxiang of the Ninefold Terrace');
        expect(declined(turn).length).toBeGreaterThan(0);
    }, 300000);
});
