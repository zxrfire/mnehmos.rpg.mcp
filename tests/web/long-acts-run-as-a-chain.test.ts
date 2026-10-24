/** Owner ruling, 2026-10-22: the root agency rule retires the two-long-act
 * question. Run requested acts in their supplied order until the real world
 * stops the chain. A cut first span spends nothing on the unreached road.
 */
import { expect, it, vi } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { whatThisTurnMayRun, type PlanStep } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { makeLocation, linkLocations } from '../../src/engine/world/locations.js';
import { makeScheduledEffect } from '../../src/engine/world/world-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { maxHpForOrdinal } from '../../src/engine/cultivation/realms.js';
import { writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';

it('keeps two long acts in supplied order without an ordering word or a model exemption', () => {
    const steps: PlanStep[] = [
        { action: { action: 'cultivate', days: 30 }, said: 'I meditate for a month' },
        { action: { action: 'move', target: 'the destination' }, said: 'walk to the destination' }
    ];
    expect(whatThisTurnMayRun(steps).toRun).toEqual(steps);
});

for (const mode of ['complete', 'interrupted', 'fallback', 'methodless'] as const) it(mode === 'interrupted'
    ? 'an actual interruption in the month stops before the two-day walk'
    : `meditates for a month and walks the actual two-day road in ${mode} order`, async () => {
    const interrupted = mode === 'interrupted';
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The resolved span ends.'] });
    const h = await makeGameInWorld({ seed: 'reading2-long-chain', worldSeed: 'reading2-long-chain-world', provider });
    try {
        const { cultivator } = await h.game.newRun('Traveller');
        h.game.atHand = await prepareWorldClockForPreciseSpan(h.game.currentRun().run, cultivator);
        const world = h.game.atHand!, now = routineTime(world);
        const home = makeLocation({ id: 'chain-home', name: 'A quiet cave', kind: 'cave', ambient: 'normal' });
        const destination = makeLocation({ id: 'chain-destination', name: 'The roadside village', kind: 'settlement' });
        linkLocations(home, destination, 'road', 2);
        world.locations = [home, destination]; world.npcs = []; world.factions = []; world.objects = []; world.schedule = [];
        const method = 'lesser-qi-gathering-manual';
        if (mode !== 'methodless') h.repos.techniques.learn(cultivator.id, method, 0.6);
        const hp = maxHpForOrdinal(cultivator.attributes.might, cultivator.realmOrdinal);
        h.repos.cultivators.update(cultivator.id, { location: home.name, hp, maxHp: hp,
            knownTechniques: mode === 'methodless' ? [] : [method], spiritStones: 10000 });
        h.repos.cultivators.standIn(cultivator.id, null);
        writeFlag(h.db, cultivator.id, 'rations_held', '20');
        h.game.noteEncounter(h.game.currentRun().cultivator, h.game.currentRun().run,
            { kind: 'place', id: destination.id, name: destination.name }, 'told', 'The road reaches this village in two days.');
        if (interrupted) world.schedule.push(makeScheduledEffect({ id: 'chain-interruption', kind: 'concurrent_event',
            dueOnDay: now + 2, locationId: home.id, interrupts: true, summary: 'Somebody opens the cave door.' }));
        h.game.theWorldMoved();
        plans.push(mode === 'fallback' ? 'not a model plan' : JSON.stringify({ steps: [
            { action: 'cultivate', days: 30, said: 'I meditate for a month' },
            { action: 'move', intent: 'travel', target: destination.name, said: `walk to ${destination.name}` }
        ] }));
        const before = h.game.currentRun().run.elapsedDays;
        const progress = h.game.currentRun().cultivator.cultivationProgress;
        const walk = vi.spyOn(h.game, 'move');
        const turn = await h.game.act(`I meditate for a month and ${mode === 'fallback' ? '' : 'then '}walk to ${destination.name}`);
        const opened = turn.toolCalls.filter(call => call.name === 'engine.step').map(call => call.action);
        expect(turn.toolCalls.some(call => call.name === 'engine.whichComesFirst')).toBe(false);
        if (interrupted) {
            expect(opened).toEqual(['cultivate']);
            const elapsed = h.game.currentRun().run.elapsedDays - before;
            expect(elapsed).toBeGreaterThan(0);
            expect(elapsed).toBeLessThan(30);
            expect(walk).not.toHaveBeenCalled();
            expect(h.game.currentRun().cultivator.location).toBe(home.name);
            expect(turn.toolCalls.some(call => call.name === 'engine.planCutShort')).toBe(true);
            expect(turn.narration).toContain(`"walk to ${destination.name}" was never reached and cost nothing.`);
        } else {
            expect(opened).toEqual(['cultivate', 'move']);
            expect(h.game.currentRun().run.elapsedDays - before).toBeCloseTo(32);
            expect(h.game.currentRun().cultivator.location).toBe(destination.name);
            expect(walk).toHaveBeenCalledOnce();
            // Replay2 N5: no method means no gain, not a refusal to spend the month.
            if (mode === 'methodless') {
                expect(h.game.currentRun().cultivator.cultivationProgress).toBe(progress);
                expect(turn.narration).toContain('No cultivation method');
            }
        }
    } finally { vi.restoreAllMocks(); h.db.close(); }
});
