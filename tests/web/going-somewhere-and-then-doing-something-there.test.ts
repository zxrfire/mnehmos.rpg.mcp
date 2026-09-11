/**
 * Played, and the whole sentence came back half run. Typed:
 *
 *     i go to the market and ask around
 *
 * and the turn answered:
 *
 *     Mo Rongzhi is speaking to no one in particular... He says that Cao Peixue
 *     died at Green Water City some time ago...
 *
 *     You remain where you are. The market is still a distance away, and no
 *     steps were taken toward it.
 *
 *     "i go to the market" was not part of what happened - that part of the
 *     sentence did not become an act, so nothing was done about it and nothing
 *     was spent on it. Say it on its own and it will run.
 *
 * Two clauses, coherent, in a sensible order, and only the second one ran. The
 * design owner: *i go to the market and ask around should work as 2 actions,
 * they are coherent in that order.*
 *
 * WHY THE FIRST CLAUSE VANISHED, measured rather than guessed. Both readers
 * agreed the clause was about the market and disagreed about what going there
 * costs:
 *
 *     parseIntent("i go to the market")        -> market(the market), FREE
 *     the model's step for the same clause     -> move(the market), COSTLY
 *
 * `theModelIsNotWhyThisTurnIsDangerous` exists to stop a model being the reason
 * a turn spends days, and here it fired correctly: a costly reading where a free
 * one would do. What it then did was the defect. On the single-verb path a
 * declined reading is REPLACED by the deterministic one and that one runs; inside
 * a plan the step was dropped outright, and the clause with it. The same clause
 * would have been put back and run had the model omitted it altogether, because
 * `theWholeSentenceAsAPlan` backfills a missing clause on exactly the reading
 * the guard had just computed and thrown away. One clause, two treatments,
 * and the harsher one fell on the sentence that described it MORE fully.
 *
 * THE RULING. Declining a model's reading of a clause is not declining the
 * clause. A declined step falls back to what the player's own words read as
 * without a model, the way a declined sentence already does, and that reading
 * runs in the position the player wrote it. The guard's rule is untouched: the
 * substituted reading is the deterministic one, so a model still cannot be why
 * a turn became dangerous. A clause is dropped only where nothing reads it at
 * all, or where the step quotes no clause of the sentence and is therefore the
 * reader's invention rather than the player's request.
 *
 * The other three questions this raised, and the answers the engine already
 * had, pinned here because nothing was asserting them:
 *
 *   - A later step runs where the earlier one LEFT the player, not where they
 *     were standing when they typed. The executor re-reads the run between
 *     steps rather than remembering it.
 *   - A sequence whose first half did not come off does not run its second half
 *     somewhere it does not belong. The plan stops and says where.
 *   - How many acts may spend time is unchanged at one. The reported sentence
 *     turns out to contain no costly act at all once it is read correctly, so
 *     it never reached that rule.
 *
 * MEASURED, played through the real service with the model answering one step
 * per clause. Left of the arrow is what the turn did before, right of it after:
 *
 *     "i go to the market and ask around"   ran interact, told them the first
 *                                           clause did not happen
 *                                        -> ran market then interact, nothing said
 *     "I go to the market"                  ran market AND told them "i go to the
 *                                           market" was not part of what happened,
 *                                           which are two accounts of one turn
 *                                        -> ran market, nothing said
 *     "I ask around"                        ran interact           -> unchanged
 *     "I gather herbs and then sell them"   ran gather, held sell, 7 days
 *                                                                  -> unchanged
 *     "I cultivate a year, then break through"
 *                                           ran cultivate, held breakthrough
 *                                                                  -> unchanged
 *     "I attack him and take his sword"     ran attack, held the taking
 *                                                                  -> unchanged
 *     "I go north and look around"          ran look, dropped the move
 *                                                                  -> unchanged
 *
 * The last row is NOT fixed here, and the reason is worth writing down because
 * it is a different one: `parseIntent("I go north")` is `unclear` and the tier
 * below it will not route a bare compass direction either, so there is no
 * reading of that clause to fall back to. The engine has no answer for a
 * direction that is not a destination. That is a gap, recorded rather than
 * licensed - and while it stands, the refusal's own advice to "say it on its
 * own and it will run" is untrue for exactly that clause, since saying it alone
 * reaches nothing either.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import type { LLMProvider } from '../../src/agent/provider/types.js';

function planning(plans: string[]): LLMProvider {
    return new ScriptedProvider({ plans, narrations: ['The moment passes.'] });
}

async function playing(plans: string[], seed = 'market-seed') {
    return await makeGameInWorld({
        worldSeed: 'market-world',
        seed,
        narrator: new ProviderNarrator(planning(plans), { model: 'test-model', timeoutMs: 5000 })
    });
}

const STEPS = (...steps: unknown[]) => JSON.stringify({ steps });

/** The verbs of the steps the turn actually ran, in order. */
function ranInOrder(turn: { toolCalls: Array<{ name: string; action: string }> }): string[] {
    return turn.toolCalls.filter(row => row.name === 'engine.step').map(row => row.action);
}

/** Clauses the turn told the player it had thrown away. */
function droppedRows(turn: { toolCalls: Array<{ name: string; summary: string }> }): string[] {
    return turn.toolCalls
        .filter(row => row.name === 'engine.stepNotRun')
        .map(row => row.summary);
}

describe('going somewhere and then doing something there', () => {
    it('runs both clauses of the sentence that was played', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'move', target: 'the market', said: 'i go to the market' },
                { action: 'interact', intent: 'talk', said: 'ask around' }
            )
        ]);
        await game.newRun('Probe');

        const turn = await game.act('i go to the market and ask around');

        // TWO ACTS, IN THE ORDER THEY WERE SAID. The first is the reading the
        // player's own words carry - going over to the stalls where they are
        // standing, which costs nothing - rather than the model's journey.
        const ran = ranInOrder(turn);
        expect(ran).toHaveLength(2);
        expect(ran[1]).toBe('interact');

        // And nothing was thrown away. This is the sentence the player read,
        // verbatim, and the assertion that would have gone red before.
        expect(droppedRows(turn)).toEqual([]);
        expect(turn.narration).not.toContain('was not part of what happened');
    });

    it('still runs each half on its own', async () => {
        const { game } = await playing([
            STEPS({ action: 'move', target: 'the market', said: 'I go to the market' }),
            STEPS({ action: 'interact', intent: 'talk', said: 'I ask around' })
        ]);
        await game.newRun('Probe');

        // The refusal the player was given said "say it on its own and it will
        // run", and before this it did not: the same guard declined the same
        // clause and left the turn with no step at all.
        // A one-step turn files no `engine.step` row - that row exists to tell
        // a sequence apart, and there is no sequence - so what says the clause
        // became an act is the routing row and the absence of a refusal.
        const alone = await game.act('I go to the market');
        expect(alone.toolCalls.find(row => row.name === 'narrator.plan')!.action)
            .not.toBe('unclear');
        expect(droppedRows(alone)).toEqual([]);
        expect(alone.narration).not.toContain('was not part of what happened');

        const asking = await game.act('I ask around');
        expect(asking.toolCalls.find(row => row.name === 'narrator.plan')!.action)
            .toBe('interact');
        expect(droppedRows(asking)).toEqual([]);
    });

    /**
     * The played output asked around where the player was standing, which read
     * as the two steps having run against different worlds. They do not: the
     * executor re-reads the run between steps. Pinned because the symptom would
     * have looked identical either way, and only one of the two was true.
     */
    it('does the second thing where the first one left you', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'move', intent: 'travel', target: 'Cold Peak', said: 'I go to Cold Peak' },
                { action: 'look', said: 'look around' }
            )
        ]);
        await game.newRun('Probe');
        const before = game.state().cultivator.location;

        const turn = await game.act('I go to Cold Peak and then look around');

        expect(ranInOrder(turn)).toEqual(['move', 'look']);
        const after = game.state().cultivator.location;
        expect(after).not.toBe(before);
        // The read is of where they now are. Read out of the state rather than
        // hard-coded, because the name is the world's to choose.
        const looked = turn.toolCalls.find(
            row => row.action === 'look' && row.name !== 'engine.step'
        );
        expect(looked, JSON.stringify(turn.toolCalls.map(r => r.name))).toBeDefined();
        expect(`${looked!.summary} ${turn.narration}`).toContain(after);
    });

    /**
     * The other half of the same rule. Going somewhere and asking there is one
     * thing in two parts, and the second part has nowhere to happen if the
     * first did not.
     */
    it('does not do the second thing when the first one did not come off', async () => {
        const { game } = await playing([
            STEPS(
                {
                    action: 'move',
                    intent: 'travel',
                    target: 'Nowhere At All',
                    said: 'I go to Nowhere At All'
                },
                { action: 'interact', intent: 'talk', said: 'ask around' }
            )
        ]);
        await game.newRun('Probe');

        const turn = await game.act('I go to Nowhere At All and then ask around');

        expect(ranInOrder(turn)).toEqual(['move']);
        expect(turn.toolCalls.some(row => row.name === 'engine.planStopped')).toBe(true);
        expect(turn.narration).toContain('That is as far as it went');
    });

    /**
     * The bound is unchanged. Two acts that both spend time still spend one of
     * them, and the rest is still ahead of the player - this is here so that a
     * later reading of the fix above cannot quietly turn a sentence into two
     * seasons.
     */
    it('still spends one costly act and holds the rest', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'gather', target: 'herbs', said: 'I gather herbs' },
                { action: 'sell', target: 'herbs', said: 'sell them' }
            )
        ]);
        await game.newRun('Probe');

        const turn = await game.act('I gather herbs and then sell them');

        expect(ranInOrder(turn)).toEqual(['gather']);
        expect(turn.narration).toContain('still ahead of you');
    });
});
