import { describe, it, expect } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from '../web/harness.js';
import type { GameService } from '../../src/web/game.js';
import type { CultivationRepos } from '../../src/server/consolidated/cultivation-support.js';
import {
    THE_ANSWER_IS_TO_GO,
    THE_ANSWER_IS_TO_KEEP_SITTING
} from '../../src/web/choosing-what-to-do-when-a-seclusion-is-broken.js';

const NO_ROAD_OUT = 's3';
const A_ROAD_OUT = 's2';
const THE_WORLD = 'w1';

async function sitUntilSomebodyComes(seed: string, provider?: ScriptedProvider): Promise<{
    game: GameService;
    repos: CultivationRepos;
    fork: NonNullable<ReturnType<GameService['state']>['crossroads']>;
}> {
    const { game, repos } = await makeGameInWorld(
        provider ? { seed, worldSeed: THE_WORLD, provider } : { seed, worldSeed: THE_WORLD }
    );
    const { cultivator } = await game.newRun('Probe');
    repos.cultivators.applyDeltas(cultivator.id, { spiritStones: 5000 });
    await game.act('I learn a cultivation technique');

    for (let attempt = 0; attempt < 6; attempt++) {
        await game.cultivate(14600, { anyway: true });
        const state = game.state();
        if (state.crossroads) return { game, repos, fork: state.crossroads };
    }
    throw new Error(`seed ${seed} never reached a broken seclusion`);
}

describe('REPRO: the conjoined stay sentence', () => {
    it('halves match, the whole does not', () => {
        expect(THE_ANSWER_IS_TO_KEEP_SITTING.test('I stay put')).toBe(true);
        expect(THE_ANSWER_IS_TO_KEEP_SITTING.test('I keep sitting')).toBe(true);
        expect(THE_ANSWER_IS_TO_KEEP_SITTING.test('I stay put and keep sitting')).toBe(false);
        expect(THE_ANSWER_IS_TO_GO.test('I stay put and keep sitting')).toBe(false);
        expect(THE_ANSWER_IS_TO_GO.test('leave before they arrive')).toBe(false);
        expect(THE_ANSWER_IS_TO_KEEP_SITTING.test('leave before they arrive')).toBe(false);
    });

    it('deterministic narrator: what actually happens to the fork', async () => {
        const { game, fork } = await sitUntilSomebodyComes(NO_ROAD_OUT);
        const remaining = fork.daysRemaining;
        const dayBefore = game.state().run.elapsedDays;

        const out = await game.act('I stay put and keep sitting');
        const after = game.state();
        const engineSaid = after.log.filter(e => e.role === 'engine').map(e => e.text).join('\n');

        console.log('=== NO ROAD / deterministic ===');
        console.log('question was:', fork.question);
        console.log('daysRemaining:', remaining);
        console.log('crossroads after:', after.crossroads === null ? 'GONE' : 'STILL OPEN');
        console.log('days elapsed delta:', after.run.elapsedDays - dayBefore);
        console.log('--- narration ---\n' + out.narration);
        console.log('--- engine ---\n' + engineSaid.split('\n').slice(-12).join('\n'));
        expect(true).toBe(true);
    }, 180000);

    it('model routes it to wait, as the live session did', async () => {
        const provider = new ScriptedProvider({
            plans: [JSON.stringify({ action: 'wait' })],
            narrations: ['...']
        });
        const { game, fork } = await sitUntilSomebodyComes(NO_ROAD_OUT, provider);
        const remaining = fork.daysRemaining;
        const dayBefore = game.state().run.elapsedDays;

        const out = await game.act('I stay put and keep sitting');
        const after = game.state();
        const engineSaid = after.log.filter(e => e.role === 'engine').map(e => e.text).join('\n');

        console.log('=== NO ROAD / model says wait ===');
        console.log('daysRemaining was:', remaining);
        console.log('crossroads after:', after.crossroads === null ? 'GONE' : 'STILL OPEN');
        console.log('days elapsed delta:', after.run.elapsedDays - dayBefore);
        console.log('--- narration ---\n' + out.narration);
        console.log('--- engine tail ---\n' + engineSaid.split('\n').slice(-14).join('\n'));
        expect(true).toBe(true);
    }, 180000);

    it('leave before they arrive, and the menu it prints', async () => {
        const { game, fork } = await sitUntilSomebodyComes(A_ROAD_OUT);
        console.log('=== A ROAD OUT: "leave before they arrive" ===');
        console.log('canWithdraw:', fork.canWithdraw, 'remaining:', fork.daysRemaining);
        const before = game.state().run.elapsedDays;
        const out = await game.act('leave before they arrive');
        const after = game.state();
        console.log('crossroads after:', after.crossroads === null ? 'GONE' : 'STILL OPEN');
        console.log('days delta:', after.run.elapsedDays - before);
        console.log('--- narration ---\n' + out.narration);
        expect(true).toBe(true);
    }, 180000);
});
