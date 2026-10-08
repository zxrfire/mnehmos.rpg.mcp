/**
 * 2026-10-03 native invitation diagnostic: local consent at08:00 silently
 * short-skipped3days because a_real_favour selects ASK_DAYS=3. The actual
 * company costing offered only13hours of the SUBJECT's remaining day.
 * Asking a person here does not request a persuasion campaign. Same consent
 * resolver/actual people, native positive operator control and unforced refusal:
 * the exchange spends ordinary request time, not three days or no time.
 * A consent at20:00 can expire during that exchange; it cannot respawn for
 * next night. These controls do not remove real road/lesson/pressing spans.
 * Union04 runtime37017 reached correct native party/time/history; the final
 * assertion falsely required printed hour20 instead of actual19.99999999953434.
 * Read the captured day/hour through canonical routineTime and compare the
 * pre-exchange absolute clock, without rounding or inventing a tolerance.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness';
import { worldLocationFor } from '../../src/web/entities';
import { peopleInThisPlace } from '../../src/web/hearsay';
import { routineTime } from '../../src/engine/world/npc-routines';
import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land';

async function localScene(hour = 8) {
    const plans: string[] = hour === 8 ? [] : [JSON.stringify({ action: 'wait' })];
    const provider = new ScriptedProvider({ plans, narrations: ['Opening.', 'Reply.'] });
    const h = await makeGameInWorld({ seed: 'routine-visit', worldSeed: 'road-world', provider });
    const { cultivator } = await h.game.newRun('Visitor');
    if (hour !== 8) await h.game.act('I wait for ' + (hour - 8) + ' hours');
    const world = (await h.game.loadWorld())!;
    const body = h.repos.cultivators.getById(cultivator.id)!;
    const place = worldLocationFor(world, body.location)!;
    const read = peopleInThisPlace(h.repos, body, world, place);
    const other = world.npcs.find(n => n.status === 'alive' && n.identity.sex === 'female' && read.whereIs.has(n.id))!;
    expect(other).toBeDefined();
    h.repos.cultivators.standIn(body.id, read.whereIs.get(other.id)!);
    plans.push(JSON.stringify({ action: 'look', intent: 'around' }));
    await h.game.act('I look around.');
    expect(h.game.present(h.game.state().cultivator).map(n => n.id)).toContain(other.id);
    // Operator fixture: this actual present person has already introduced themself.
    // Use the same name-giving authority; this test does not claim played introduction.
    h.game.theyGaveTheirName(h.game.state().cultivator, h.game.currentRun().run, other);
    expect(h.game.partyPutTo(h.game.state().cultivator, other.name, h.game.scopeFor(h.game.state().cultivator))?.id).toBe(other.id);
    plans.push(JSON.stringify({ action: 'request', intent: 'company', target: other.name, topic: 'my room' }));
    return { ...h, provider, other, before: h.game.state(), at: routineTime(h.game.atHand!) };
}
it('accepted local company consent spends one ordinary exchange, with its real party and account', async () => {
    const h = await localScene();
    const accepted = await withTheAttemptLanding('request', () => h.game.act('I invite ' + h.other.name + ' to my room'));
    expect(accepted.result.toolCalls.some(c => c.name === 'world.takeThemWithYou' && c.ok)).toBe(true);
    expect(accepted.result.toolCalls.some(c => c.name === 'social.createObligation' && c.ok)).toBe(true);
    expect(h.game.whoIsWithYouOnTheRoad(h.game.state().cultivator).map(n => n.id)).toContain(h.other.id);
    expect(h.game.state().run.elapsedDays - h.before.run.elapsedDays).toBeCloseTo(0.125, 8);
    expect(h.game.state().run.turn - h.before.run.turn).toBe(1);
    expect(routineTime(h.game.atHand!) - h.at).toBeCloseTo(0.125, 8);
    expect(h.game.state().cultivator.spiritStones).toBe(h.before.cultivator.spiritStones);
}, 180_000);
it('the actual unforced local refusal answers and charges the exchange without creating company', async () => {
    const h = await localScene();
    const refused = await h.game.act('I invite ' + h.other.name + ' to my room');
    expect(refused.toolCalls.some(c => c.name === 'engine.resolveAttempt' && !c.ok)).toBe(true);
    expect(refused.toolCalls.some(c => c.name === 'world.takeThemWithYou' && c.ok)).toBe(false);
    expect(h.game.whoIsWithYouOnTheRoad(h.game.state().cultivator)).toHaveLength(0);
    expect(h.game.state().run.elapsedDays - h.before.run.elapsedDays).toBeCloseTo(0.125, 8);
    expect(h.game.state().run.turn - h.before.run.turn).toBe(1);
    expect(routineTime(h.game.atHand!) - h.at).toBeCloseTo(0.125, 8);
    expect(h.game.state().cultivator.spiritStones).toBe(h.before.cultivator.spiritStones);
}, 180_000);
it('consent at20:00 expires in native exchange time instead of being recreated after23:00', async () => {
    const h = await localScene(20);
    expect(h.game.atHand!.currentHour).toBeCloseTo(20);
    const accepted = await withTheAttemptLanding('request', () => h.game.act('I invite ' + h.other.name + ' to my room'));
    expect(accepted.result.toolCalls.some(c => c.name === 'world.takeThemWithYou' && c.ok)).toBe(true);
    expect(h.game.atHand!.currentHour).toBeCloseTo(23);
    expect(h.game.whoIsWithYouOnTheRoad(h.game.state().cultivator)).toHaveLength(0);
    expect(h.game.atHand!.npcs.find(n => n.id === h.other.id)!.activity?.kind).not.toBe('out_with_a_party');
    expect(h.game.present(h.game.state().cultivator).map(n => n.id)).not.toContain(h.other.id);
    const narrativeCall = [...h.provider.calls].reverse().find(call =>
        !call.messages.some(message => message.role === 'system' && message.content.startsWith('You are the intent router')))!;
    const actualNarratorInput = narrativeCall.messages.map(message => message.content).join('\n');
    const captured = /Executed reply at [^\n]*day ([0-9]+), hour ([0-9]+(?:\.[0-9]+)?)/.exec(actualNarratorInput);
    expect(captured, 'the actual earlier reply must retain its native clock metadata').not.toBeNull();
    const capturedMoment = routineTime({ currentDay: Number(captured![1]), currentHour: Number(captured![2]) });
    expect(capturedMoment).toBe(h.at);
    expect(h.game.state().run.elapsedDays - h.before.run.elapsedDays).toBeCloseTo(0.125, 8);
    expect(h.game.state().run.turn - h.before.run.turn).toBe(1);
}, 180_000);
