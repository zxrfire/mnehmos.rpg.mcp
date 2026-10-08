/**
 * Actual live-model town11 bought a real month of care beside the physician:
 * fee1 + provision2, purse500->497, HP1->11 after24 care HP and14 weather loss.
 * The request delegated into treat, but central weather read the outer request
 * label; direct treat had a blanket roof exemption while the same clinical
 * area's delegated month was counted outdoors. Receipt text also claimed the
 * fee fed the patient despite the separately charged provisions. Narration
 * repeated that contradiction and inferred an unrecorded lack of stronger pills.
 * Clinical ground, not profession or action label, supplies physical cover.
 * These tests retain ordinary fees/food and prove actual body/area/refusal
 * outcomes; no bed, free food, discount or clinic inventory is manufactured.
 */
import { expect, it } from 'vitest';
import { atAWorkingPhysician } from './at-a-working-physician.js';
import { ScriptedProvider } from './harness.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { purposeOf } from '../../src/engine/world/architecture.js';
import { askingAboutCareHere } from '../../src/web/asking-about-the-care-actually-offered-here.js';

const requested = { lane: 'speak', intent: 'ask_them_to_give_or_do_something', target: 'physician', topic: 'treat my injuries' };
function script(plans: unknown[]) { return new ScriptedProvider({ plans: plans.map(p => JSON.stringify(p)), narrations: ['Debug prose; not model acceptance.'] }); }
it('a delegated actual clinical month has the same cover as directly requested care and separate food payment', async () => {
    const results: number[] = [];
    for (const plan of [{ action: 'treat' }, requested]) {
        const provider = script([plan]);
        const h = await atAWorkingPhysician('clinical-physical-cover', { provider });
        h.repos.cultivators.update(h.cultivator.id, { hp: 1, spiritStones: 500 });
        const said = plan === requested ? 'I ask the physician to treat my injuries.' : 'I get my injuries treated';
        const turn = await h.game.act(said);
        expect(turn.toolCalls.some(c => c.name === 'engine.mortalCare' && c.ok)).toBe(true);
        const fee = turn.toolCalls.find(c => c.name === 'cultivator.applyDeltas' && c.action === 'treat')!;
        const food = turn.toolCalls.find(c => c.action === 'buy_provisions')!;
        expect(fee).toBeDefined(); expect(food).toBeDefined();
        const charged = Number(/= (\d+) stones/.exec(fee.summary)?.[1]);
        const provisioned = Number(/for (\d+) spirit stones/.exec(food.summary)?.[1]);
        const body = h.game.state().cultivator;
        expect(charged + provisioned + body.spiritStones).toBe(500);
        expect(body.hp).toBeGreaterThan(1);
        expect(provider.calls.some(c => c.messages.at(-1)?.content.includes('Food is provisioned separately'))).toBe(true);
        expect(provider.calls.some(c => /nights? in the open.*worn the body/.test(c.messages.at(-1)?.content ?? ''))).toBe(false);
        results.push(body.hp); h.db.close();
    }
    expect(results[1]).toBe(results[0]);
}, 120_000);
it('the same physician outside cannot sell care or turn outdoor nights into covered ones', async () => {
    const h = await atAWorkingPhysician('clinical-outdoor-control', { provider: script([requested, { action: 'wait', days: 30 }]) });
    const street = theAreasOf(h.world, h.place).areas.find(a => a.for === 'street')!;
    expect(street).toBeDefined();
    const now = routineTime(h.world);
    h.physician.activity = { kind: 'talking', note: 'Talking outside.', withIds: [], sinceDay: h.world.currentDay,
        untilDay: h.world.currentDay + 31, redirect: { until: now + 31, previous: null, standingIn: street.id } };
    h.game.theWorldMoved(); h.repos.cultivators.standIn(h.cultivator.id, street.id);
    expect(h.game.present(h.game.state().cultivator).some(p => p.id === h.physician.id)).toBe(true);
    const before = h.game.state();
    const refused = await h.game.act('I ask the physician to treat my injuries.');
    expect(refused.toolCalls.some(c => c.name === 'engine.resolveParty' && !c.ok)).toBe(false);
    expect(refused.toolCalls.some(c => c.name === 'engine.mortalCare')).toBe(false);
    expect(h.game.state().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
    expect(h.game.state().run.elapsedDays).toBe(before.run.elapsedDays);
    const waited = await h.game.act('I wait thirty days');
    expect(h.game.state().cultivator.hp).toBeLessThan(before.cultivator.hp);
    expect(waited.narration).toMatch(/nights? in the open.*worn the body/);
    h.db.close();
}, 120_000);
it('a public clinic keeps its actual cover when the physician is absent', async () => {
    const h = await atAWorkingPhysician('clinical-empty-cover', { provider: script([{ action: 'wait', days: 30 }]) });
    h.physician.status = 'physically_dead'; h.game.theWorldMoved();
    expect(h.game.present(h.game.state().cultivator).some(p => p.id === h.physician.id)).toBe(false);
    const before = h.game.state().cultivator.hp;
    const waited = await h.game.act('I wait thirty days');
    expect(h.game.state().cultivator.hp).toBe(before);
    expect(waited.narration).not.toMatch(/nights? in the open.*worn the body/);
    h.db.close();
}, 120_000);
it('a physician grade quote does not claim an inventory of stronger medicine', async () => {
    const h = await atAWorkingPhysician('clinical-grade-not-stock');
    const quote = askingAboutCareHere(h.game, h.game.state().cultivator, h.physician.id, 'what care do you offer travellers?')!;
    expect(quote.lines.some(l => l.includes('mortal-grade care'))).toBe(true);
    expect(quote.lines.some(l => l.includes('not what other medicines may be kept here'))).toBe(true);
    expect(quote.lines.join(' ')).not.toMatch(/clinic.*(?:does not stock|holds no)/);
    h.db.close();
});

it('existing enclosed house rooms retain their physical cover without a clinical provider', async () => {
    const h = await atAWorkingPhysician('clinical-existing-enclosure', { provider: script([{ action: 'wait', days: 30 }]) });
    const room = h.world.locations.find(p => purposeOf(p) === 'infirmary' && p.tags.includes('interior'))!;
    expect(room).toBeDefined();
    // Explicit body fixture on real built ground; this is not proof of admission/access.
    h.repos.cultivators.update(h.cultivator.id, { location: room.name });
    h.repos.cultivators.standIn(h.cultivator.id, theAreasOf(h.world, room).areas[0]!.id);
    const before = h.game.state().cultivator.hp;
    const waited = await h.game.act('I wait thirty days');
    expect(h.game.state().cultivator.hp).toBe(before);
    expect(waited.narration).not.toMatch(/nights? in the open.*worn the body/);
    h.db.close();
}, 120_000);
