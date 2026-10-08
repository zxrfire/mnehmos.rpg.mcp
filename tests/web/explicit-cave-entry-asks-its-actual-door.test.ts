import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
/**
 * Source audit 2026-10-03: a known noncompound cave with explicit move/enter
 * reached the geographic local branch, which moved SQL before approach and
 * never asked native evaluateAccess. This is an interior-admission gap; a ruin's
 * geographic outside arrival still belongs to its separate ruin_inside reader.
 * These native factory arrangements explicitly store a cave beneath an existing
 * accessible parent and actual key objects; they are operator setup, not seeded
 * grants or a narrative outcome. The normal game.act plan retains the exact known
 * printed noun and enter intent. Native fallback/receipt, location, elapsed body
 * time and actual custody are the acceptance evidence, not scripted LLM prose.
 * Arrival relocation is an actual SQL write after the genuine world advance,
 * testing fresh-body revalidation without fabricating a completed receipt.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { makeLocation, evaluateAccess } from '../../src/engine/world/locations.js';
import { makeObject } from '../../src/engine/world/possessions.js';
import { FALSE_IMMORTAL_ORDINAL } from '../../src/engine/cultivation/realms.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { howThisCultivatorStandsInTheHouseHolding } from '../../src/web/how-this-cultivator-stands-on-this-ground.js';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs.js';

async function outsideACave(key: 'none' | 'held' | 'elsewhere' = 'none', cyclic = false) {
    const plans: string[] = [];
    const h = await makeGameInWorld({ seed: 'actual-local-cave-entry', worldSeed: 'road-world',
        provider: new ScriptedProvider({ plans, narrations: [] }) });
    const opened = await h.game.newRun('Cave visitor');
    const world = (await h.game.loadWorld())!;
    const parent = world.locations.find(row => row.kind === 'settlement' && !row.sealed && !row.cycle)!;
    expect(parent, 'a real ordinary outside town in the pinned world').toBeDefined();
    const cave = makeLocation({ id: 'operator-native-cave', name: 'The Recorded Key Cave', kind: 'cave',
        parentId: parent.id, sealed: true, data: { keyId: 'actual-cave-lock' } });
    if (cyclic) {
        const now = routineTime(world);
        cave.cycle = { periodDays: 10, openDays: 1, phaseDay: now + 5 };
    }
    world.locations.push(cave);
    if (key !== 'none') world.objects.push(makeObject({ id: 'actual-carried-cave-key',
        name: 'Recorded cave key', kind: 'key', possessorId: key === 'held' ? opened.cultivator.id : null,
        ownerId: opened.cultivator.id, locationId: key === 'elsewhere' ? parent.id : null,
        data: { keyId: 'actual-cave-lock' } }));
    h.repos.cultivators.update(opened.cultivator.id, { location: parent.name, realmOrdinal: FALSE_IMMORTAL_ORDINAL });
    h.repos.cultivators.standIn(opened.cultivator.id, null);
    h.game.noteEncounter(h.repos.cultivators.getById(opened.cultivator.id)!, h.game.currentRun().run,
        { kind: 'place', id: cave.name, name: cave.name }, 'witnessed', 'Operator arrangement: actual known cave doorway at the outside parent.');
    h.game.theWorldMoved();
    await h.game.act('I look around');
    const before = h.game.currentRun();
    const read = howThisCultivatorStandsInTheHouseHolding({ ground: cave, cultivator: before.cultivator,
        standing: null, objects: h.game.atHand!.objects, onDay: routineTime(h.game.atHand!) }).access;
    return { ...h, ...opened, parent, cave, plans, before, access: evaluateAccess(cave, read) };
}
async function enter(h: Awaited<ReturnType<typeof outsideACave>>) {
    h.plans.push(JSON.stringify({ actions: [{ action: 'move', target: h.cave.name, intent: 'enter' }] }));
    return h.game.act(`I enter ${h.cave.name}.`);
}
it('explicit known closed cave entry refuses outside without spending the body or moving stock', async () => {
    const h = await outsideACave(); expect(h.access.closed).toBe(true);
    const objects = structuredClone(h.game.atHand!.objects);
    const turn = await enter(h);
    expect(turn.toolCalls.some(call => call.action === 'move' && !call.ok)).toBe(true);
    expect(h.game.currentRun().cultivator.location).toBe(h.parent.name);
    expect(h.game.currentRun().run.elapsedDays).toBe(h.before.run.elapsedDays);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(h.before.cultivator.spiritStones);
    expect(h.game.atHand!.objects).toEqual(objects); h.db.close();
});
it('the actual held key admits explicit cave entry only after the native local approach', async () => {
    const h = await outsideACave('held'); expect(h.access.closed).toBe(false);
    const turn = await enter(h);
    expect(turn.toolCalls.some(call => call.action === 'move' && call.ok)).toBe(true);
    expect(h.game.currentRun().cultivator.location).toBe(h.cave.name);
    expect(journeyTimeHasReached(h.game.currentRun().run.elapsedDays, h.before.run.elapsedDays + LESSER_ACTION_DAYS.move)).toBe(true);
    expect(journeyTimeHasReached(h.before.run.elapsedDays + LESSER_ACTION_DAYS.move, h.game.currentRun().run.elapsedDays)).toBe(true);
    expect(h.game.atHand!.objects.find(row => row.id === 'actual-carried-cave-key')!.possessorId).toBe(h.cultivator.id);
    h.db.close();
});
it('legal title to a key elsewhere does not admit the body', async () => {
    const h = await outsideACave('elsewhere'); expect(h.access.closed).toBe(true);
    const turn = await enter(h);
    expect(turn.toolCalls.some(call => call.action === 'move' && !call.ok)).toBe(true);
    expect(h.game.currentRun().cultivator.location).toBe(h.parent.name);
    expect(h.game.currentRun().run.elapsedDays).toBe(h.before.run.elapsedDays); h.db.close();
});
it('an actual held key leaves a closed opening cycle closed', async () => {
    const h = await outsideACave('held', true); expect(h.access.closed).toBe(true);
    const turn = await enter(h);
    expect(turn.toolCalls.some(call => call.action === 'move' && !call.ok)).toBe(true);
    expect(h.game.currentRun().cultivator.location).toBe(h.parent.name);
    expect(h.game.currentRun().run.elapsedDays).toBe(h.before.run.elapsedDays); h.db.close();
});
it('real relocation during approach is retained instead of entering the old cave endpoint', async () => {
    const h = await outsideACave('held');
    const elsewhere = h.game.atHand!.locations.find(row => row.kind === 'settlement' && row.id !== h.parent.id)!;
    expect(elsewhere).toBeDefined();
    const advance = h.game.advanceWorld.bind(h.game);
    h.game.advanceWorld = async (...args: Parameters<typeof h.game.advanceWorld>) => {
        const result = await advance(...args);
        h.repos.cultivators.update(h.cultivator.id, { location: elsewhere.name });
        return result;
    };
    await enter(h);
    expect(h.game.currentRun().cultivator.location).toBe(elsewhere.name);
    expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(h.before.run.elapsedDays);
    expect(h.game.currentRun().run.elapsedDays - h.before.run.elapsedDays).toBeLessThanOrEqual(LESSER_ACTION_DAYS.move);
    expect(h.game.atHand!.objects.find(row => row.id === 'actual-carried-cave-key')!.possessorId).toBe(h.cultivator.id);
    h.db.close();
});
it('actual body death at an approach boundary cannot enter or be modified into an arrival', async () => {
    const h = await outsideACave('held');
    const advance = h.game.advanceWorld.bind(h.game);
    h.game.advanceWorld = async (...args: Parameters<typeof h.game.advanceWorld>) => {
        const result = await advance(...args);
        const live = h.game.currentRun();
        if (live.cultivator.alive) h.repos.cultivators.markDead(h.cultivator.id,
            'combat_defeat', live.run.turn, 'Explicit actual-boundary death fixture');
        return result;
    };
    await enter(h);
    const actual = h.repos.cultivators.getById(h.cultivator.id)!;
    expect(actual.alive).toBe(false);
    expect(actual.location).toBe(h.parent.name);
    expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(h.before.run.elapsedDays);
    expect(h.game.currentRun().run.elapsedDays - h.before.run.elapsedDays).toBeLessThanOrEqual(LESSER_ACTION_DAYS.move);
    h.db.close();
});
