/**
 * Played: a sentence that contains a plan, driven through the real service.
 *
 * The law is unit-tested next door. This file asserts the things only a real
 * run can say - that several engine calls actually happen in one turn, in the
 * order the player said them, against the world each previous step left; that
 * two costly acts produce a question and spend nothing; and that the answer to
 * that question runs the act the player picked.
 *
 * `worldEnabled: true` throughout, because `AGENTS.md` is explicit that hand-
 * playing with the world off is playing a configuration where every guard that
 * needs a world to check against is skipped by design.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import type { LLMProvider } from '../../src/agent/provider/types.js';
import { theSentenceSaysItsOwnOrder } from '../../src/web/a-sentence-can-be-more-than-one-call.js';

/** A provider whose phase-1 answers are the plans below, one per turn. */
function planning(plans: string[]): LLMProvider {
    return new ScriptedProvider({ plans, narrations: ['The moment passes.'] });
}

async function playing(plans: string[], seed = 'plan-seed') {
    const provider = planning(plans);
    return await makeGameInWorld({
        worldSeed: 'plan-world',
        seed,
        narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 })
    });
}

const STEPS = (...steps: unknown[]) => JSON.stringify({ steps });

describe('one sentence, several engine calls', () => {
    it('runs every step, in the order the player said them', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'look', said: 'see who is here' },
                { action: 'status', said: 'check what I am carrying' },
                { action: 'recall', said: 'and what I know of them' }
            )
        ]);
        await game.newRun('Probe');

        const turn = await game.act('who is here, what am I carrying, and what do I know of them');

        const steps = turn.toolCalls.filter(row => row.name === 'engine.step');
        expect(steps.map(row => row.action)).toEqual(['look', 'status', 'recall']);
        // Every call visible, not a summary of them: each step's own engine
        // rows sit between the step rows rather than being replaced by them.
        const between = turn.toolCalls.filter(
            row => !row.name.startsWith('narrator.') && row.name !== 'engine.step'
        );
        expect(between.map(row => row.action)).toEqual(['look', 'status', 'recall']);
    });

    it('keeps every word the engine said, from every step', async () => {
        const { game } = await playing([
            STEPS({ action: 'status', said: 'my sheet' }, { action: 'inventory', said: 'my pouch' })
        ]);
        await game.newRun('Probe');
        const turn = await game.act('what am I and what am I carrying');

        // Two reads, two accounts. A fold that summarised would be the dropped
        // clause defect coming back wearing a feature.
        expect(turn.narration.length).toBeGreaterThan(0);
        expect(turn.toolCalls.filter(row => row.name === 'engine.readState')).toHaveLength(2);
        expect(turn.toolCalls.filter(row => row.name === 'engine.step')).toHaveLength(2);
    });

    it('the routing row says it was read as a plan, and in what order', async () => {
        const { game } = await playing([
            STEPS({ action: 'look' }, { action: 'status' })
        ]);
        await game.newRun('Probe');
        const turn = await game.act('look around and check myself over');

        const routing = turn.toolCalls.find(row => row.name === 'narrator.plan')!;
        expect(routing.summary).toContain('read as a plan of 2');
        expect(routing.summary).toContain('look -> status');
    });
});

describe('a turn spends at most one costly act', () => {
    it('two costly acts ask which comes first, and spend nothing', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'look', said: 'see who is about' },
                { action: 'cultivate', days: 365, said: 'sit for a year' },
                { action: 'work', days: 90, said: 'take work for a season' }
            )
        ]);
        await game.newRun('Probe');
        const before = game.state().run.elapsedDays;

        const turn = await game.act('I sit for a year and take work for a season');

        // Nothing was spent. This is the whole point: the question costs the
        // player a moment and not a season.
        expect(game.state().run.elapsedDays).toBe(before);

        const asked = turn.toolCalls.find(row => row.name === 'engine.whichComesFirst');
        expect(asked).toBeDefined();
        expect(asked!.ok).toBe(true);
        expect(turn.narration).toContain('Which comes first?');
        expect(turn.narration).toContain('sit for a year');
        expect(turn.narration).toContain('take work for a season');
    });

    /**
     * MEASURED AGAINST A LIVE MODEL, AND IT IGNORED THE QUESTION.
     *
     * Handed a turn whose only fact was that it was asking, ollama/gemma4:26b
     * wrote *"You reach for Cao Antao's purse and press it into Shen Liefeng's
     * hand. Then you walk away."* - three acts, none of which happened, on a
     * turn that spent nothing. A question the player never sees is worse than
     * no question, because they believe the turn ran.
     *
     * `required` is the channel that survives a model, and a question about how
     * the next years of somebody's life are spent is exactly what it is for.
     */
    it('and the question survives a narrator that writes something else entirely', async () => {
        const provider = new ScriptedProvider({
            plans: [STEPS(
                { action: 'cultivate', days: 365, said: 'sit for a year' },
                { action: 'work', days: 90, said: 'take work for a season' }
            )],
            narrations: ['You settle in for the year, and afterwards you take the work.']
        });
        const { game } = await makeGameInWorld({
            worldSeed: 'plan-world', seed: 'plan-seed',
            narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 })
        });
        await game.newRun('Probe');

        const turn = await game.act('I sit for a year and take work for a season');
        expect(turn.narration).toContain('Which comes first?');
        expect(game.state().run.elapsedDays).toBe(0);
    });

    it('the free read before the question still runs, so the question is informed', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'look', said: 'see who is about' },
                { action: 'cultivate', days: 365, said: 'sit for a year' },
                { action: 'work', days: 90, said: 'take work' }
            )
        ]);
        await game.newRun('Probe');
        const turn = await game.act('look about, sit a year, take work');

        expect(turn.toolCalls.filter(row => row.name === 'engine.step').map(r => r.action))
            .toEqual(['look']);
    });

    it('the question is answered in one word, and the chosen act then runs', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'cultivate', days: 365, said: 'sit for a year' },
                { action: 'work', days: 90, said: 'take work for a season' }
            ),
            // Phase 1 must not be reached on the answering turn. If it were,
            // this fixture would run and the assertion below would fail.
            JSON.stringify({ action: 'look' })
        ]);
        await game.newRun('Probe');
        await game.act('I sit for a year and take work for a season');

        const before = game.state().run.elapsedDays;
        const answer = await game.act('work');

        const routing = answer.toolCalls.find(row => row.name === 'narrator.plan')!;
        expect(routing.action).toBe('work');
        expect(routing.summary).toContain('the player chose this one');
        expect(game.state().run.elapsedDays).toBeGreaterThan(before);
    });

    it('IS NOT A MODAL JAIL - another sentence next turn is an ordinary turn', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'cultivate', days: 365, said: 'sit for a year' },
                { action: 'work', days: 90, said: 'take work' }
            ),
            JSON.stringify({ action: 'status' })
        ]);
        await game.newRun('Probe');
        await game.act('I sit for a year and take work');

        const next = await game.act('what am I');
        expect(next.toolCalls.find(row => row.name === 'narrator.plan')!.action).toBe('status');
    });
});

/**
 * FOUND BY PLAYING, and it fired BOTH mechanisms at once. Typed:
 *
 *   > I go to Ninewatch and then sit down and cultivate for a year
 *
 * The turn asked which came first AND the single-verb clause reporter said
 * "Ran move. Not run: sit down" - two rulings, contradicting each other, on one
 * turn. The player could not tell which to believe.
 *
 * Both halves are fixed here. The clause reporter is off when a plan ran, since
 * a turn that ran three verbs has already answered the question it asks; and
 * the question does not fire at all, because the player wrote "and then".
 */
describe('where the player said the order, the turn takes it and asks nothing', () => {
    it('runs the first act, holds the rest, and files exactly one ruling', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'work', days: 90, said: 'look for work' },
                { action: 'cultivate', days: 365, said: 'sit down and cultivate for a year' }
            )
        ]);
        await game.newRun('Probe');
        const before = game.state().run.elapsedDays;

        const turn = await game.act('I look for work and then sit down and cultivate for a year');

        // No question, and no contradiction: one account of one turn.
        expect(turn.toolCalls.filter(row => row.name === 'engine.whichComesFirst')).toHaveLength(0);
        expect(turn.toolCalls.filter(row => row.name === 'engine.parseIntent')).toHaveLength(0);

        // The first act ran and the second is named as still ahead.
        expect(game.state().run.elapsedDays).toBeGreaterThan(before);
        expect(turn.toolCalls.filter(row => row.name === 'engine.stillToCome').map(r => r.action))
            .toEqual(['cultivate']);
        expect(turn.narration).toContain('still ahead of you');
    });
});

/**
 * THE COORDINATOR'S PLAYED TURN, PINNED.
 *
 *   > I rob Cao Antao and then run away to Ninewatch
 *
 * The theft landed - `taken`, a reprisal, a serious wound - and lifted nothing,
 * because the man had nothing. The journey was never this turn's: the player
 * wrote "and then", so the budget held it for the next one.
 *
 * Reported wrongly it said the approach "did not come off" and that the journey
 * "depended on it having done" - two false sentences about one true turn, and
 * the first of them teaches the player something false about themselves.
 */
describe('a step that landed is not reported as a step that failed', () => {
    it('says the journey is still ahead, not that it was collateral of a failure', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'interact', target: 'Bai Zhenru', intent: 'steal', said: 'rob Bai Zhenru' },
                { action: 'move', target: 'Ninewatch', said: 'run away to Ninewatch' }
            )
        ]);
        await game.newRun('Probe');

        const turn = await game.act('I rob Bai Zhenru and then run away to Ninewatch');

        // The theft is the turn's one costly act; the journey was sequenced for
        // later by the player's own "and then" and is named as such.
        expect(turn.toolCalls.filter(row => row.name === 'engine.stillToCome').map(r => r.action))
            .toEqual(['move']);
        expect(turn.narration).toContain('still ahead of you');

        // And whatever the theft did, the journey is never described as having
        // depended on it - that is the sentence that inverted the lesson.
        expect(turn.narration).not.toContain('depended on it having done');
    });
});

describe('a plan that stops halfway is an outcome', () => {
    it('names the first failure and does not run what depended on it', async () => {
        const { game } = await playing([
            STEPS(
                // Nobody by this name, anywhere. The step is COSTLY - a theft -
                // so the engine refusing it stops the plan, and the handoff that
                // depended on it never runs.
                { action: 'interact', target: 'Nobody At All Whatsoever', intent: 'steal',
                    said: "take the stranger's purse" },
                { action: 'interact', target: 'the man beside him', intent: 'give',
                    said: 'press it into his hand' }
            )
        ]);
        await game.newRun('Probe');
        const turn = await game.act("I take the stranger's purse and press it into his hand");

        const stopped = turn.toolCalls.find(row => row.name === 'engine.planStopped');
        expect(stopped).toBeDefined();
        // The second step never ran, and the account says so as a thing that
        // happened rather than as a report about the executor.
        expect(turn.toolCalls.filter(row => row.name === 'engine.step').map(r => r.action))
            .toEqual(['interact']);
        expect(turn.narration).toMatch(/did not come off/);
        expect(turn.narration).not.toMatch(/step \d of \d/i);
    });
});

/**
 * THE CASE THIS WHOLE FEATURE IS FOR, PLAYED.
 *
 * Reported by the coordinator against a live ollama run and then reproduced
 * here: *"I look over the stalls, ask who is selling a manual, and buy the
 * cheapest one they have"* is the commonest sentence a stuck player types, and
 * before this it read as ONE free market browse with the buy dropped on the
 * floor and the model filling the hole with an invented purchase.
 *
 * The middle clause is the interesting part. "who is selling" names a CATEGORY
 * rather than a person, so it resolves to nobody - and a plan that stopped
 * there would throw away the act the sentence was actually for. A free read
 * that came back empty must never outrank a costly act.
 */
describe('a free read that finds nothing does not cost the player the act they asked for', () => {
    it('carries on past it and spends the turn on the costly step', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'market', said: 'look over the stalls' },
                { action: 'interact', target: 'merchants', intent: 'talk',
                    said: 'ask who is selling a manual' },
                // The clause reads as `work` to the table on its own, which is
                // what the danger check compares against - see
                // `theClauseThisStepQuotes`.
                { action: 'work', days: 90, said: 'and look for work' }
            )
        ]);
        await game.newRun('Probe');
        const before = game.state().run.elapsedDays;

        const turn = await game.act('I look over the stalls, ask who is selling, and look for work');

        // All three reached the engine, in order, and the plan did not stop.
        expect(turn.toolCalls.filter(row => row.name === 'engine.step').map(r => r.action))
            .toEqual(['market', 'interact', 'work']);
        expect(turn.toolCalls.filter(row => row.name === 'engine.planStopped')).toHaveLength(0);

        // The refusal in the middle stays fully visible rather than being
        // swallowed to make the sequence look tidy.
        expect(turn.toolCalls.some(row => !row.ok && row.action === 'interact')).toBe(true);

        // And the act the sentence was for is the one the turn spent.
        expect(game.state().run.elapsedDays).toBeGreaterThan(before);
    });
});

describe('the deterministic tier is untouched', () => {
    it('makes exactly one engine call for a sentence, with no step rows at all', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'plan-world', seed: 'plan-seed' });
        await game.newRun('Probe');
        const turn = await game.act('look around');

        expect(turn.toolCalls.filter(row => row.name === 'engine.step')).toHaveLength(0);
        expect(turn.toolCalls.find(row => row.name === 'narrator.plan')!.source).toBe('fallback');
    });

    /**
     * THE DETERMINISM CLAIM, MADE BACK TO BACK IN ONE COMMAND.
     *
     * A new RNG draw is a regression until proved otherwise, and more calls per
     * turn is exactly where draw order shifts. Two runs of the same seed in the
     * same world, playing the same six sentences with no model configured, must
     * produce identical state - which they can only do if the multi-call path is
     * unreachable without one.
     *
     * `AGENTS.md` on why this shape and not a stored baseline: a number taken
     * across a gap while other agents are committing is worthless, and the only
     * trustworthy comparison is back to back in a single command.
     */
    it('plays the same seed to the same state, twice', async () => {
        const SENTENCES = [
            'look around', 'what am I carrying', 'I cultivate for a month',
            'what is stopping me', 'I look for work', 'what news is there'
        ];

        const play = async () => {
            const { game } = await makeGameInWorld({ worldSeed: 'determinism', seed: 'determinism' });
            await game.newRun('Probe');
            const verbs: string[] = [];
            for (const said of SENTENCES) {
                const turn = await game.act(said);
                verbs.push(turn.toolCalls.find(row => row.name === 'narrator.plan')!.action);
            }
            const state = game.state();
            return {
                verbs,
                days: state.run.elapsedDays,
                ordinal: state.cultivator.realmOrdinal,
                progress: state.cultivator.cultivationProgress,
                stones: state.cultivator.spiritStones,
                hp: state.cultivator.hp,
                satiety: state.cultivator.satiety
            };
        };

        expect(await play()).toEqual(await play());
    });
});

describe('a clause that says why says when', () => {
    // Played at 1 of 40 health and 2 spirit stones, with the game's own refusal
    // saying "Earning is the move before either of them". The sentence came
    // back as work(water), buy(physician's visit) and a question about which
    // came first - a question with nothing in it to answer, because you cannot
    // buy a thing with money you are still working to earn.
    it('reads a purpose clause as the order it is', () => {
        expect(theSentenceSaysItsOwnOrder(
            'I keep my head down and work the water for a year until I have enough for the physician'
        )).toBe(true);
        expect(theSentenceSaysItsOwnOrder('I take work so I can pay the physician')).toBe(true);
        expect(theSentenceSaysItsOwnOrder('I sell the manual to afford a room')).toBe(true);
        expect(theSentenceSaysItsOwnOrder('I gather herbs until I have enough to buy passage')).toBe(true);
    });

    // The other half of the rule, and the reason bare `to` is not a purpose
    // word: an infinitive of motion is not a plan with two halves.
    it('leaves a sentence with no order between its halves alone', () => {
        expect(theSentenceSaysItsOwnOrder('I go to Ninewatch')).toBe(false);
        expect(theSentenceSaysItsOwnOrder('I sit for a year and take work for a season')).toBe(false);
        expect(theSentenceSaysItsOwnOrder('I talk to the elder')).toBe(false);
    });
});
