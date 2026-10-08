/**
 * Actual-model quarters14 (2026-10-03) passed18 mechanics controls but narrated
 * stepping out into a corridor, walking to another door and testing a firm lock
 * after the actual invitation refusal kept private area/time/purse unchanged.
 * Only lack of invitation reached narrator facts; unchanged/no-time stayed in
 * debug structure. Successful my-quarters facts also repeated public lodging
 * name as both ends, obscuring the actual accepted private holder area.
 * These front-door controls capture the provider's actual narration input and
 * persisted result. Debug provider prose cannot settle movement or barriers.
 * They should be red against the observed missing facts before source apply;
 * they prove engine fact delivery, not real-model prose compliance.
 * First baseline: the success fact was missing as intended; refusal setup used
 * a pre-membership world-only door label, which became the player's own door
 * after canonical projection. Refusal now selects a distinct holder id/name
 * from the live SQL-aware movement roster after placing the actual player.
 * A second fixture run showed loadWorld alone does not refresh that player
 * projection: act refreshes it before resolving movement. A native free look
 * now refreshes it before selecting a door, as actual model14 setup did.
 * Only the original success-fact baseline was a meaningful source red.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { narrationSystemPrompt } from '../../src/web/prompt.js';
import { whereCompoundsAre } from '../../src/engine/world/where-inside-a-house-somebody-is-standing.js';
import { aRoomOfTheirOwn, theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { theQuartersThisCultivatorHas } from '../../src/web/leaving-a-thing-in-your-own-room.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';

async function quarters(seed: string) {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['Debug prose; no movement or barrier authority.'] });
    const h = await makeGameInWorld({ seed, worldSeed: 'lived-rooms-20261003', provider });
    await h.game.newRun('Room observer');
    const world = (await h.game.loadWorld())!;
    const compound = [...whereCompoundsAre(world).bySeat.values()].find(c => {
        const lodging = c.rooms.get('dormitory');
        return lodging && theAreasOf(world, lodging).areas.some(a => a.for === 'room');
    })!;
    expect(compound).toBeDefined();
    const me = h.game.state().cultivator;
    h.repos.sects.addMember(compound.houseId, me.id, 0);
    const assigned = theQuartersThisCultivatorHas(h.game, world, h.game.state().cultivator)!;
    expect(assigned).not.toBeNull();
    const lodging = world.locations.find(p => p.id === assigned.quarters.locationId)!;
    const own = aRoomOfTheirOwn(lodging, me.id);
    h.repos.cultivators.update(me.id, { location: lodging.name });
    const areas = theAreasOf(world, lodging).areas;
    const publicArea = areas.find(a => a.for !== 'room')!;
    expect(publicArea).toBeDefined();
    h.repos.cultivators.standIn(me.id, publicArea.id);
    return { ...h, provider, plans, world, lodging, own, areas };
}
function rulings(provider: ScriptedProvider) {
    const call = provider.calls.filter(c => c.messages[0]?.content === narrationSystemPrompt()).at(-1)!;
    expect(call).toBeDefined();
    const prompt = String(call.messages.at(-1)?.content ?? '');
    const start = prompt.indexOf('WHAT THE ENGINE RULED');
    const end = prompt.indexOf('THE REGISTER FOR THIS TURN', start);
    expect(start).toBeGreaterThanOrEqual(0);
    return prompt.slice(start, end < 0 ? undefined : end);
}
it('accepted my quarters exposes the actual private-area destination to narration', async () => {
    const h = await quarters('private-facts-success');
    h.plans.push(JSON.stringify({ action: 'move', target: 'my quarters' }));
    const before = h.game.state();
    const turn = await h.game.act('I walk to my quarters.');
    expect(turn.toolCalls.some(c => c.name === 'world.walkInsideTheWalls' && c.ok)).toBe(true);
    const after = h.game.state();
    expect(after.cultivator.location).toBe(h.lodging.name);
    expect(after.cultivator.standingIn).toBe(h.own.id);
    expect(after.run.elapsedDays - before.run.elapsedDays).toBeCloseTo(0.25);
    // The scene header alone already named a private door before this repair.
    // Its executed movement ruling must identify the accepted area too.
    expect(rulings(h.provider)).toContain('into ' + h.own.name);
    h.db.close();
}, 120_000);
it('refused private entry exposes unchanged own area and time without inventing a lock', async () => {
    const h = await quarters('private-facts-refusal');
    h.repos.cultivators.standIn(h.game.state().cultivator.id, h.own.id);
    const beforeRefresh = h.game.state();
    h.plans.push(JSON.stringify({ action: 'look' }));
    await h.game.act('I look around.');
    const afterRefresh = h.game.state();
    expect(afterRefresh.run.elapsedDays).toBe(beforeRefresh.run.elapsedDays);
    expect(afterRefresh.cultivator.location).toBe(beforeRefresh.cultivator.location);
    expect(afterRefresh.cultivator.standingIn).toBe(beforeRefresh.cultivator.standingIn);
    const liveWorld = (await h.game.loadWorld())!;
    const live = peopleInThisPlace(h.repos, h.game.state().cultivator, liveWorld, h.lodging);
    const currentArea = live.areas.find(a => a.id === h.own.id)!;
    const other = live.areas.find(a => a.for === 'room' && a.id !== h.own.id)!;
    expect(currentArea).toBeDefined();
    expect(other).toBeDefined();
    expect(other.id).not.toBe(currentArea.id);
    expect(other.name).not.toBe(currentArea.name);
    h.plans.push(JSON.stringify({ action: 'move', target: other.name }));
    const before = h.game.state();
    const turn = await h.game.act('I walk to ' + other.name + '.');
    expect(turn.toolCalls.find(c => c.name === 'narrator.plan')?.summary).toContain('target=' + JSON.stringify(other.name));
    expect(turn.toolCalls.some(c => c.name === 'engine.walkAcrossThePlace' && !c.ok)).toBe(true);
    const after = h.game.state();
    expect(after.cultivator.location).toBe(before.cultivator.location);
    expect(after.cultivator.standingIn).toBe(h.own.id);
    expect(after.run.elapsedDays).toBe(before.run.elapsedDays);
    expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
    const facts = rulings(h.provider);
    expect(facts).toMatch(/not.*invited|Nobody has invited/i);
    expect(facts).toContain(currentArea.name);
    expect(facts).toMatch(/remain|unchanged/i);
    expect(facts).toMatch(/no time (?:passes|passed)/i);
    expect(facts).not.toMatch(/lock|bolt|handle/i);
    h.db.close();
}, 120_000);
