/**
 * Played: a sentence that contains a plan, driven through the real service.
 *
 * 2026-10-03 agency ruling: the earlier one-costly-act cap is retired. Ordered
 * acts all run against fresh state until an actual refusal, interruption or death.
 * Tests formerly asserting engine.stillToCome now assert no artificial hold.
 *
 * The law is unit-tested next door. This file asserts the things only a real
 * run can say - that several engine calls actually happen in one turn, in the
 * order the player said them, against the world each previous step left; that
 * unresolved fallback ordering produces a question and spends nothing; and that the answer to
 * that question runs the act the player picked.
 *
 * `worldEnabled: true` throughout, because `tests/AGENTS.md#engine-only-and-played-tests` is explicit that hand-
 * playing with the world off is playing a configuration where every guard that
 * needs a world to check against is skipped by design.
 *
 * A run now opens at 08:00, a third of a day already on the clock before any
 * act (`turn-engine.ts`'s `newRun`), so an assertion that a question "spends
 * nothing" reads the run's clock against that baseline, not against zero.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import type { LLMProvider } from '../../src/agent/provider/types.js';
import { whatThisTurnMayRun } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { theSentenceSaysItsOwnOrder } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { stepsInTheResponse } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { thePlayerIsSureItIsThem } from '../../src/web/the-narrator-plays-the-world.js';
import { routeQueriesFor } from '../../src/engine/world/locations.js';
import { journeyNeedsWater } from '../../src/engine/world/places-on-the-way.js';
import { FALSE_IMMORTAL_ORDINAL, maxHpForOrdinal } from '../../src/engine/cultivation/realms.js';

/** A provider whose phase-1 answers are the plans below, one per turn. */
function planning(plans: string[]): LLMProvider {
    return new ScriptedProvider({ plans, narrations: ['The moment passes.'] });
}

/**
 * A game whose PLAN comes from the table and whose NARRATION comes from a
 * model, which is what the fork's own tests need: the question is the
 * deterministic tier's, and the thing it has to survive is a narrator.
 *
 * The plan text is deliberately not a plan. `ProviderNarrator` rejects it and
 * falls back to reading the sentence itself, so `source` is `fallback` and the
 * order is nobody's decision - while `narrate` still goes to the provider.
 */
async function askedRatherThanReasoned(narrations: string[], seed = 'plan-seed') {
    const provider = new ScriptedProvider({ plans: ['not a plan at all'], narrations });
    return await makeGameInWorld({
        worldSeed: 'plan-world',
        seed,
        narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 })
    });
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
        // Every call visible, not a summary of them: each step's own engine rows
        // sit between the step rows rather than being replaced by them.
        //
        // Asserted as "each verb did something" rather than as an exact list,
        // because a step legitimately files more than one row - the world writes
        // a `name_in_passing` on a `look` when somebody says a name near you -
        // and pinning the whole set makes this test a tripwire for other
        // people's work rather than a statement about sequencing.
        const between = turn.toolCalls.filter(
            row => !row.name.startsWith('narrator.') && row.name !== 'engine.step'
        );
        for (const verb of ['look', 'status', 'recall']) {
            expect(between.some(row => row.action === verb), `${verb} filed nothing`).toBe(true);
        }
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

describe('whose order it is', () => {
    /**
     * The design owner, settling it:
     *
     *   > if the order is wrong, we don't try to determine it, we just act
     *   > confused. the llm should just try it in the order and give back
     *   > whatever error the world state gave, right?
     *
     * So a reader that can reason gets its order RUN, and the engine neither
     * reorders it nor asks a model to predict whether it will work. This
     * replaced two channels that did the predicting - a flag saying the reader
     * had settled the order, and a sentence saying it could not work - because
     * the world's own answer is true where a prediction is only plausible.
     */
    it('runs a backwards order and lets the world refuse it', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'breakthrough', said: 'I break through' },
                { action: 'cultivate', days: 365, said: 'cultivate for a year' }
            )
        ]);
        await game.newRun('Probe');
        const before = game.state().run.elapsedDays;

        const turn = await game.act('I break through and then cultivate for a year');

        // THE BARRIER ANSWERED, which is what the player asked for and what no
        // reader could have said in advance and been sure of. The row is the
        // engine's own record of it; a scripted narrator can overwrite prose
        // and cannot overwrite this.
        const asked = turn.toolCalls.find(row => row.name === 'engine.canAttemptBreakthrough');
        expect(asked, JSON.stringify(turn.toolCalls.map(row => row.name))).toBeDefined();
        // The summary is the mechanical channel, and it used to be the bare
        // headline because this refusal was built without one. It now
        // carries the distance, which is what a player plans against and
        // what a model cannot paraphrase away.
        expect(asked!.summary).toMatch(/striking for/);
        expect(asked!.summary).toMatch(/\bshort\b/);
        expect(turn.toolCalls.some(row => row.name === 'engine.whichComesFirst')).toBe(false);
        // And the year is not spent on a crossing that did not happen.
        expect(game.state().run.elapsedDays).toBe(before);
    });

    it('runs a workable order in the order it was given', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'move', intent: 'travel', target: 'Moraine Gate', said: 'I go to Moraine Gate' },
                { action: 'gather', said: 'gather herbs' }
            )
        ]);
        await game.newRun('Probe');
        const turn = await game.act('I go to Moraine Gate and gather herbs');

        expect(turn.narration).not.toContain('Which comes first?');
        expect(turn.toolCalls.some(row => row.name === 'engine.stillToCome')).toBe(false);
    });

    it('spends both requested spans in an ordered plan', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'wait', days: 1, said: 'I wait for one day' },
                { action: 'wait', days: 2, said: 'wait for two days' }
            )
        ]);
        await game.newRun('Probe');
        const before = game.state().run.elapsedDays;
        const turn = await game.act('I wait for one day and then wait for two days');
        expect(turn.toolCalls.filter(row => row.name === 'engine.step').map(row => row.action)).toEqual(['wait', 'wait']);
        expect(game.state().run.elapsedDays - before).toBeCloseTo(3);
        expect(turn.toolCalls.some(row => row.name === 'engine.stillToCome')).toBe(false);
    });
});


describe('fallback unresolved ordering', () => {
    it('two costly acts ask which comes first, and spend nothing', async () => {
        const { game } = await askedRatherThanReasoned(['(scripted)']);
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
        const { game } = await askedRatherThanReasoned([
            'You settle in for the year, and afterwards you take the work.'
        ]);
        await game.newRun('Probe');

        const turn = await game.act('I sit for a year and take work for a season');
        expect(turn.narration).toContain('Which comes first?');
        expect(game.state().run.elapsedDays).toBeCloseTo(1 / 3);
    });

    it('the free read before the question still runs, so the question is informed', async () => {
        const { game } = await askedRatherThanReasoned(['(scripted)']);
        await game.newRun('Probe');
        const turn = await game.act('look about, sit a year, take work');

        expect(turn.toolCalls.filter(row => row.name === 'engine.step').map(r => r.action))
            .toEqual(['look']);
    });

    it('the question is answered in one word, and the chosen act then runs', async () => {
        // The fork is the deterministic tier's, so the question is raised from
        // there. Phase 1 must not be reached on the ANSWERING turn either, and
        // is not: the provider's plan text is never a plan, so a turn that
        // reached it would read the word "work" as a verb and spend a season.
        const { game } = await askedRatherThanReasoned(['(scripted)']);
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
 *   > I go to Cloud Gate and then sit down and cultivate for a year
 *
 * The turn asked which came first AND the single-verb clause reporter said
 * "Ran move. Not run: sit down" - two rulings, contradicting each other, on one
 * turn. The player could not tell which to believe.
 *
 * Both halves are fixed here. The clause reporter is off when a plan ran, since
 * a turn that ran three verbs has already answered the question it asks; and
 * the question does not fire at all, because the player wrote "and then".
 *
 * ── THE FIRST CLAUSE IS THE PLAYED ONE AGAIN, AND WAS NOT ────────────────
 *
 * The rule above is unchanged. What changed is the sentence it was measured
 * on: this had drifted to `I look for work and then sit down and cultivate for
 * a year`, and `i look for work` was ruled a SEARCH rather than a taking - the
 * board, which spends nothing. So the sentence stopped holding two costly acts
 * and stopped being able to say anything about which of them a turn runs.
 *
 * Restored to the turn the header records. `move` is costly on any reading, so
 * the claim is about sequencing rather than about how one verb is read.
 */
describe('where the player said the order, the turn takes it and asks nothing', () => {
    it('uses the supplied order without an artificial hold', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'move', target: 'Cloud Gate', said: 'I go to Cloud Gate' },
                { action: 'cultivate', days: 365, said: 'sit down and cultivate for a year' }
            )
        ]);
        await game.newRun('Probe');
        const before = game.state().run.elapsedDays;

        const turn = await game.act('I go to Cloud Gate and then sit down and cultivate for a year');

        // No question, and no contradiction: one account of one turn.
        expect(turn.toolCalls.filter(row => row.name === 'engine.whichComesFirst')).toHaveLength(0);
        expect(turn.toolCalls.filter(row => row.name === 'engine.parseIntent')).toHaveLength(0);

        // Any unreached act must be stopped by the actual world, never by a one-act budget.
        expect(game.state().run.elapsedDays).toBeGreaterThan(before);
        expect(turn.toolCalls.filter(row => row.name === 'engine.stillToCome').map(r => r.action))
            .toEqual([]);
        expect(turn.toolCalls.some(row => row.name === 'engine.stillToCome')).toBe(false);
    });
});

/**
 * THE COORDINATOR'S PLAYED TURN, PINNED.
 *
 *   > I rob Cao Antao and then run away to Cloud Gate
 *
 * The theft landed - `taken`, a reprisal, a serious wound - and lifted nothing,
 * because the man had nothing. Previously the journey was held by a one-act
 * budget. The agency ruling removes that hold; real refusal/interruption still stops it.
 *
 * Reported wrongly it said the approach "did not come off" and that the journey
 * "depended on it having done" - two false sentences about one true turn, and
 * the first of them teaches the player something false about themselves.
 */
describe('a step that landed is not reported as a step that failed', () => {
    /**
     * 2026-10-03 fixture correction: Bai Zhenru was neither placed in this
     * observer's area nor known to them. That legitimate refusal stopped the
     * plan, and checking only the absence of stillToCome proved no landed act.
     *
     * Use an actual seeded mortal through the canonical current placement and
     * presence reads. The fixture arranges the player's strong mortal-world
     * body and an already exchanged name through the existing encounter/name
     * authority; it does not claim to test introduction or travel to the setup.
     * No person/stock/transfer is invented, no roll is forced, and the fixed
     * run/world seeds stay unchanged. The real resolver must accept the theft
     * and spend time before the second act can prove the old cap is absent.
     * A genuine refused attempt must fail this case's landed precondition;
     * the next test separately preserves the legitimate refusal contract.
     */
    it('never holds the journey merely because the theft spent time', async () => {
        const plans: string[] = [];
        const { game, repos } = await playing(plans);
        const { cultivator } = await game.newRun('Probe');
        const world = (await game.loadWorld())!;
        const prepared = repos.cultivators.update(cultivator.id, {
            realmOrdinal: FALSE_IMMORTAL_ORDINAL,
            hp: maxHpForOrdinal(cultivator.attributes.might, FALSE_IMMORTAL_ORDINAL),
            maxHp: maxHpForOrdinal(cultivator.attributes.might, FALSE_IMMORTAL_ORDINAL)
        })!;
        // Placement is the authority on actual routines/journeys and area caps.
        // Stop at the first real public settlement containing a mortal; there
        // is no seeded name, row id, copied routine or artificial crowd here.
        const setting = (() => {
            for (const place of world.locations) {
                if (place.kind !== 'settlement') continue;
                const read = peopleInThisPlace(repos, prepared, world, place);
                const target = read.people.find(person => person.realmOrdinal === 0
                    && world.npcs.some(npc => npc.id === person.id && npc.status === 'alive')
                    && read.whereIs.has(person.id));
                if (target) return { place, read, target };
            }
            return undefined;
        })();
        expect(setting, 'no actual mortal in a settlement to arrange this landed case').toBeDefined();
        const target = setting!.target;
        repos.cultivators.update(cultivator.id, { location: setting!.place.name });
        repos.cultivators.standIn(cultivator.id, setting!.read.whereIs.get(target.id)!);
        const me = game.state().cultivator;
        expect(game.present(me).map(person => person.id)).toContain(target.id);
        game.noteEncounter(me, game.currentRun().run,
            { kind: 'cultivator', id: target.id, name: target.name }, 'witnessed',
            'Fixture: already met this actual person at the arranged settlement.');
        game.theyGaveTheirName(me, game.currentRun().run, target);
        expect(thePlayerIsSureItIsThem(target.name, game.knowledge.awareness(me.id))).toBe(true);

        const routes = routeQueriesFor(world.locations);
        const distances = routes.treeFrom(setting!.place.id).days;
        const destination = world.locations.filter(place => place.kind === 'settlement'
            && place.id !== setting!.place.id && Number.isFinite(distances.get(place.id))
            && !journeyNeedsWater(world.locations, setting!.place.id, place.id, routes))
            .sort((a, b) => distances.get(a.id)! - distances.get(b.id)!)[0];
        expect(destination, 'no actual dry-land settlement journey from the arranged scene').toBeDefined();
        game.noteEncounter(me, game.currentRun().run,
            { kind: 'place', id: destination!.name, name: destination!.name }, 'told',
            'Fixture: the actual road destination was already described.');
        expect(game.canPointAtLocation(me, destination!)).toBe(true);
        plans.push(STEPS(
            { action: 'interact', target: target.name, intent: 'steal', said: `rob ${target.name}` },
            { action: 'move', target: destination!.name, said: `run away to ${destination!.name}` }
        ));
        const before = game.state().run.elapsedDays;
        const turn = await game.act(`I rob ${target.name} and then run away to ${destination!.name}`);
        const receipts = JSON.stringify(turn.toolCalls);
        const theft = turn.toolCalls.find(row => row.name === 'engine.resolveAttempt'
            && row.action === 'interact');
        expect(theft, receipts).toBeDefined();
        expect(theft!.ok, receipts).toBe(true);
        const theftStep = turn.toolCalls.findIndex(row => row.name === 'engine.step' && row.action === 'interact');
        const moveStep = turn.toolCalls.findIndex(row => row.name === 'engine.step' && row.action === 'move');
        expect(theftStep, receipts).toBeGreaterThanOrEqual(0);
        expect(moveStep, receipts).toBeGreaterThan(theftStep);
        const firstAct = turn.toolCalls.slice(theftStep + 1, moveStep);
        expect(firstAct.some(row => row.name === 'engine.simulateTimeSkip'
            && /^[1-9]\d*(?:\.\d+)? of /.test(row.summary)), receipts).toBe(true);
        expect(turn.toolCalls.slice(moveStep + 1).some(row => row.name === 'engine.simulateTimeSkip'
            && /^[1-9]\d*(?:\.\d+)? of /.test(row.summary)), receipts).toBe(true);
        expect(game.state().run.elapsedDays).toBeGreaterThan(before);
        expect(turn.toolCalls.some(row => row.name === 'engine.planStopped'), receipts).toBe(false);
        expect(turn.toolCalls.some(row => row.name === 'engine.stillToCome'), receipts).toBe(false);
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
                //
                // A TAKING, AND IT SAYS SO. This clause was `and look for work`,
                // which is now the BOARD - a search, ruled apart from a taking -
                // so the sentence had no costly act left in it and the claim
                // below had nothing to be about. The claim is unchanged; the
                // clause is the one it needs.
                { action: 'work', days: 90, said: 'and take work for the season' }
            )
        ]);
        await game.newRun('Probe');
        const before = game.state().run.elapsedDays;

        const turn = await game.act(
            'I look over the stalls, ask who is selling, and take work for the season'
        );

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

/**
 * A STEP READS ITS OWN CLAUSE, AND THE SENTENCE'S FACTS ARE NOT ALL ITS OWN.
 *
 * `carryWhatOnlyTheSentenceKnows` puts back what a model's answer cannot carry,
 * and the span is the one field it overrides a model on - a player who typed
 * twenty years must not be handed five. Pointed at a whole sentence that holds
 * a PLAN, that override takes a span stated in one clause and spends it on
 * another: measured, a reader answering `work(days=90)` then
 * `cultivate(days=365)` had its work step come back at 365, so a sentence
 * asking for a stretch of work and then a year of sitting bought a year of
 * hauling and no sitting at all.
 *
 * Unit rather than played, because the defect is in the reading and a played
 * turn would be measuring the work verb as well.
 */
describe('a step reads its own clause', () => {
    it('does not spend on one clause a span another clause stated', () => {
        const steps = stepsInTheResponse(
            {
                steps: [
                    { action: 'work', days: 90, said: 'take work' },
                    { action: 'cultivate', days: 365, said: 'sit down and cultivate for a year' }
                ]
            },
            'I take work and then sit down and cultivate for a year'
        )!;

        expect(steps.map(step => step.action.days)).toEqual([90, 365]);
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
        expect(theSentenceSaysItsOwnOrder('I go to Cloud Gate')).toBe(false);
        expect(theSentenceSaysItsOwnOrder('I sit for a year and take work for a season')).toBe(false);
        expect(theSentenceSaysItsOwnOrder('I talk to the elder')).toBe(false);
    });
});

/**
 * THE OWNER'S ACCEPTANCE SENTENCE, END TO END.
 *
 *   > I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away
 *
 * Three acts the game already has, and the framing falls out of the ORDER
 * rather than out of a frame verb. Two things had to be fixed before it could
 * reach the engine at all: the danger check was declining the theft against a
 * whole-sentence reading and substituting a duplicate verb in its place, and
 * "it" in the second clause was being looked up among the things the player is
 * carrying, where there is no row called "it".
 */
describe("the owner's acceptance sentence", () => {
    const SAID = "I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away";

    it('reaches the engine as three acts, with "it" meaning the purse', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'interact', target: 'Cao Antao', intent: 'steal',
                    said: "I take Cao Antao's purse" },
                { action: 'give', target: 'Shen Liefeng', topic: 'it',
                    said: "press it into Shen Liefeng's hand" },
                { action: 'move', target: 'away', said: 'walk away' }
            )
        ]);
        await game.newRun('Probe');
        const turn = await game.act(SAID);

        // The requested theft is NOT missing - which
        // is what the danger check was eating before it compared against the
        // player's own clauses.
        const steps = turn.toolCalls.filter(row => row.name === 'engine.step');
        expect(steps.some(row => row.action === 'interact')).toBe(true);
        expect(turn.toolCalls.filter(row => row.name === 'engine.stepNotRun')).toHaveLength(0);

        // The back-reference fixes the order. No count or cost taxonomy holds
        // the departure; a genuine world/body interruption still can.
        expect(turn.toolCalls.filter(row => row.name === 'engine.whichComesFirst')).toHaveLength(0);
        expect(turn.toolCalls.filter(row => row.name === 'engine.stillToCome').map(r => r.action))
            .toEqual([]);
    });

    it('a back-reference settles the order as firmly as "then" does', () => {
        // The back-reference must order the taking before the handover.
        const chained = [
            { action: { action: 'interact' as const, target: 'Cao Antao', intent: 'steal' } },
            { action: { action: 'give' as const, target: 'Shen Liefeng', topic: 'it' } },
            { action: { action: 'move' as const, target: 'away' } }
        ];
        // No sequencing word anywhere, and nothing to ask: the pressing cannot
        // precede the taking, because "it" is the purse.
        expect(whatThisTurnMayRun(chained, SAID).askAbout).toHaveLength(0);
        expect(whatThisTurnMayRun(chained, SAID).theOrderWasGiven).toBe(true);
    });

    /**
     * A step the READER added is declined and dropped without telling the
     * player, because they never asked for it. Found by playing: the model
     * added a theft to "I press Cao Antao's purse into Shen Liefeng's hand and
     * walk away", the check declined it, and the turn then told the player that
     * "the approach to Cao Antao" was not part of what happened - a clause that
     * does not exist, and an invitation to say a thing they never said.
     */
    it('declines a step the reader added without blaming the player’s sentence', async () => {
        const { game } = await playing([
            STEPS(
                // A fight nobody could read out of this sentence, quoting no
                // clause of it: the reader reaching for something on its own.
                { action: 'attack', target: 'Cao Antao', said: 'I run him through' },
                { action: 'status', said: 'look myself over' }
            )
        ]);
        await game.newRun('Probe');
        const turn = await game.act('I look myself over');

        // Visible to an operator, which is what that surface is for...
        const row = turn.toolCalls.find(r => r.name === 'engine.stepNotRun');
        expect(row).toBeDefined();
        expect(row!.summary).toContain('the reader added');

        // ...and never said to the player as a clause of theirs.
        expect(turn.narration).not.toContain('not part of what happened');
        expect(turn.narration).not.toContain('run him through');
    });
});

/**
 * COMPOSITION MUST NOT DEPEND ON THE MODEL BEING GOOD AT COMPOSITION.
 *
 * The reader here sends two steps for a three-act sentence, which is exactly
 * what gemma4:26b did on the owner's acceptance sentence, repeatedly. The
 * middle clause - the handover, which is the clause the other two exist for -
 * is put back from the player's own text.
 */
describe('the sentence composes even when the reader under-splits', () => {
    it('routes the clause the reader missed, in the position it was written', async () => {
        const { game } = await playing([
            // Two steps for three acts: the handover is gone.
            STEPS(
                { action: 'interact', target: 'Cao Antao', intent: 'steal',
                    said: "I take Cao Antao's purse" },
                { action: 'move', target: 'away', said: 'walk away' }
            )
        ]);
        await game.newRun('Probe');

        const turn = await game.act(
            "I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away"
        );

        const routing = turn.toolCalls.find(row => row.name === 'narrator.plan')!;
        expect(routing.summary).toContain('read as a plan of 3');
        expect(routing.summary).toContain('interact -> give -> move');
        // And the reading is SHOWN rather than done quietly.
        expect(routing.summary).toContain('PUT BACK from the sentence itself');

        // Nothing is reported as lost any more, because nothing was lost.
        expect(turn.toolCalls.filter(row => row.name === 'engine.stepNotRun')).toHaveLength(0);
    });
});

/**
 * THE SPLIT CAN BE WRONG IN ANY OF THE THREE POSITIONS.
 *
 * Played twice on one build, the same sentence: once the model dropped the
 * MIDDLE clause and once the FIRST. That variance is the strongest argument for
 * the sentence being the authority, and it means the backfill has to hold
 * wherever the gap falls - so all three are pinned, plus the two ways a reader's
 * own labelling was able to defeat it.
 */
describe('the sentence composes wherever the reader’s split went wrong', () => {
    const SAID = "I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away";
    const THEFT = { action: 'interact', target: 'Cao Antao', intent: 'steal' };
    const GIVE = { action: 'give', target: 'Shen Liefeng' };
    const WALK = { action: 'move', target: 'Six Li' };

    async function planOf(steps: unknown[]) {
        const provider = new ScriptedProvider({
            plans: [JSON.stringify({ steps })], narrations: ['x']
        });
        const narrator = new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 });
        return await narrator.plan(SAID, 'state');
    }

    it('puts back the FIRST clause when the reader loses it', async () => {
        const plan = await planOf([GIVE, WALK]);
        expect(plan.steps!.map(s => s.action.action)).toEqual(['interact', 'give', 'move']);
        expect(plan.droppedClauses ?? []).toHaveLength(0);
    });

    it('puts back the MIDDLE clause when the reader loses it', async () => {
        const plan = await planOf([THEFT, WALK]);
        expect(plan.steps!.map(s => s.action.action)).toEqual(['interact', 'give', 'move']);
    });

    it('puts back the LAST clause when the reader loses it', async () => {
        const plan = await planOf([THEFT, GIVE]);
        expect(plan.steps!.map(s => s.action.action)).toEqual(['interact', 'give', 'move']);
    });

    /**
     * The reader labelled its `give` with the THEFT'S words. That claimed the
     * theft's clause, so the theft was never put back and the fill produced a
     * second `give` for the clause that really was one - the act at the head of
     * the owner's sentence gone, with nothing said about it.
     */
    it('is not defeated by a step labelled with another clause’s words', async () => {
        const plan = await planOf([
            { ...GIVE, said: "I take Cao Antao's purse" },
            { ...WALK, said: 'walk away' }
        ]);
        expect(plan.steps!.map(s => s.action.action)).toEqual(['interact', 'give', 'move']);
    });

    /**
     * And when a clause genuinely cannot be put back, it is REPORTED. This is
     * the half that was silently dead: the lost-clause check rebuilt a plan from
     * a bare verb name, and `interact` with no intent is free while `interact`
     * with `steal` is not - so a lost theft priced itself as a free read and
     * nobody was told.
     */
    it('prices a lost clause by its whole reading, not by its bare verb', async () => {
        const { theClausesNoStepAccountsFor } =
            await import('../../src/web/a-sentence-can-be-more-than-one-call.js');
        const { parseIntent } = await import('../../src/web/actions.js');

        const lost = await theClausesNoStepAccountsFor(
            SAID, [{ action: { action: 'give' } }, { action: { action: 'move' } }],
            async clause => parseIntent(clause)
        );
        expect(lost.map(s => s.action.action)).toEqual(['interact']);
        expect(lost[0]!.action.intent).toBe('steal');
    });
});

/**
 * PICKING ONE OUT OF WHAT THE LAST STEP FOUND, PLAYED. At ordinal 40:
 *
 *   > I look over who is here, pick the strongest one, and tell them I want
 *   > their sect to answer for something
 *
 *   read as 2: gather(strongest one), interact(unnamed cultivator)
 *   Which comes first? "pick the strongest one" or "the approach to unnamed
 *   cultivator"?
 *
 * The middle clause selects from what the first returned. Nothing carried the
 * set, so the third clause's target was a placeholder - and the selection had
 * landed on a costly verb, so the turn asked the player to choose between two
 * acts, one of which spends nothing.
 */
describe('a clause that chooses from what the last one found', () => {
    const SAID = 'I look over who is here, pick the strongest one, '
        + 'and tell them I want their sect to answer for something';

    it('spends nothing, names who it landed on, and points the next clause at them', async () => {
        const { game } = await playing([
            STEPS(
                { action: 'look', said: 'I look over who is here' },
                // `pick the strongest one` reached `gather`, the herb verb.
                { action: 'gather', target: 'strongest one', said: 'pick the strongest one' },
                { action: 'interact', target: 'unnamed cultivator', intent: 'threaten',
                    said: 'tell them I want their sect to answer for something' }
            )
        ]);
        await game.newRun('Probe');
        const turn = await game.act(SAID);

        // The choice is not one of the acts, so there is nothing to ask about.
        expect(turn.toolCalls.filter(row => row.name === 'engine.whichComesFirst')).toHaveLength(0);
        expect(turn.toolCalls.some(row => row.action === 'gather')).toBe(false);

        // Who it landed on is said out loud, with the field it was chosen on.
        const choice = turn.toolCalls.find(row => row.summary.includes('Choice over rung'));
        expect(choice).toBeDefined();

        // And the approach is pointed at a real person rather than a placeholder.
        const approach = turn.toolCalls.find(
            row => row.name === 'engine.step' && row.action === 'interact'
        );
        expect(approach).toBeDefined();
        expect(approach!.summary).not.toContain('unnamed cultivator');
    });
});
