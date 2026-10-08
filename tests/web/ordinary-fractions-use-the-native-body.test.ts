/**
 * 2026-10-03 scratch composition audit: transport12 kept an ordinary scalar
 * fractional fallback while retrieval7's native shortSkip selected precise
 * body parts only with an active retrieval. A local .125-day conversation
 * therefore either bypassed food/hostility/body arithmetic or floored to zero.
 * These controls run the adapter and its native control in ONE invocation,
 * each in the same opening world and run seed. The native result supplies
 * actual age rounding and food outcomes; this file copies no roundYears rule.
 * The final-boundary death is an explicit authoritative SQL consequence fixture,
 * not a claim that this seed naturally kills somebody. It proves that later
 * world consequences cannot be hidden behind a successful scalar time receipt.
 * Existing native transport and retrieval suites cover actual boarding/delivery;
 * consent controls separately prove historical reply and actual night expiry.
 * Union04 runtime37017: native direct and adapter arithmetic was reached,
 * but the food fixture compared empty pack0 with pack0. buyProvisions returns
 * a reserved unopened bundle, not packed stock. Return that actually bought
 * bundle via the native unused-provisions authority before opening this
 * waiting span, and require actual pack stock. Consumption assertions stay.
 * Oct7 postapply21 shared regression:56/57passed; the quiet finished=true
 * assertion failed. Diagnostic19791 proved both native and adapter spent the
 * same .125, consumed their only actual packet, reached satiety100 and ended
 * with provisions_exhausted at the final boundary. The adapter honestly refused
 * quiet completion. Buying60days via the same authority supplies at least two
 * packets for the quiet consumption control; the original30-day/one-packet
 * arrangement remains a separate native final-exhaustion parity control.
 * Neither resource interruption nor final death is erased to make time quiet.
 * Native fact text floors .125 to '0 days/at outset'; that presentation gap is
 * recorded separately and is not licensed or changed by these body controls.
 * No model acceptance is claimed.
 */
import { expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness';
import { passHours } from '../../src/web/routine-invitations';
import { WAITING_FOCUS } from '../../src/web/turn-constants';
import { routineTime } from '../../src/engine/world/npc-routines';
import type { Cultivator } from '../../src/schema/cultivation';

async function arrangement(purchaseDays = 30) {
    const h = await makeGameInWorld({ seed: 'ordinary-fraction-body', worldSeed: 'ordinary-fraction-world' });
    const opened = await h.game.newRun('The actual waiting body');
    h.repos.cultivators.update(opened.cultivator.id, { satiety: 0, spiritStones: 100 });
    const purchase = h.game.buyProvisions(h.repos.cultivators.getById(opened.cultivator.id)!, purchaseDays);
    expect(purchase.rations).toBeGreaterThan(0);
    const before = purchase.cultivator;
    // Operator arrangement: the actually purchased bundle is entirely unopened.
    h.game.putBackWhatWasNotEaten(before, { endState: { rationsRemaining: purchase.rations } });
    expect(h.game.rationsHeld(before)).toBe(purchase.rations);
    expect(h.game.rationsHeld(before)).toBeGreaterThan(0);
    const run = h.repos.runs.getById(opened.run.id)!;
    return { ...h, before, run, food: h.game.rationsHeld(before) };
}
function bodyReceipt(body: Cultivator) {
    return { age: body.age, yearsAtCurrentRealm: body.yearsAtCurrentRealm,
        hp: body.hp, satiety: body.satiety, spiritStones: body.spiritStones, alive: body.alive };
}
it('ordinary .125 time has the actual native body, food and clock receipt, completing once', async () => {
    const native = await arrangement(60);
    expect(native.food).toBeGreaterThanOrEqual(2);
    const control = await native.game.shortSkip(native.run, native.before,
        native.game.ambientFor(native.before, native.run), WAITING_FOCUS, 'Waiting', 0.125);
    expect(control.timeSkip?.simulatedDays).toBe(0.125);
    expect(control.timeSkip?.interrupted).toBe(false);
    expect(control.cutShort).toBeNull();
    const expectedBody = bodyReceipt(native.repos.cultivators.getById(native.before.id)!);
    const expectedFood = native.game.rationsHeld(native.before);
    const expectedClock = routineTime(native.game.atHand!);
    expect(expectedFood).toBeLessThan(native.food);
    expect(expectedBody.satiety).toBeGreaterThan(native.before.satiety);
    expect(native.repos.runs.getById(native.run.id)!.turn - native.run.turn).toBe(1);

    // Creating this arm resets only its own private harness world/DB. The
    // control above has already been recorded; no production tree is changed.
    native.db.close();
    const adapter = await arrangement(60);
    expect(adapter.food).toBeGreaterThanOrEqual(2);
    const spent = await passHours(adapter.game, adapter.run, adapter.before, 3);
    expect(spent.finished).toBe(true);
    expect(spent.spent?.timeSkip?.simulatedDays).toBe(0.125);
    expect(bodyReceipt(adapter.repos.cultivators.getById(adapter.before.id)!)).toEqual(expectedBody);
    expect(adapter.game.rationsHeld(adapter.before)).toBe(expectedFood);
    expect(routineTime(adapter.game.atHand!)).toBe(expectedClock);
    expect(adapter.repos.runs.getById(adapter.run.id)!.elapsedDays - adapter.run.elapsedDays).toBe(0.125);
    expect(adapter.repos.runs.getById(adapter.run.id)!.turn - adapter.run.turn).toBe(1);
}, 180_000);
it('the original last-packet fraction preserves native exhaustion, body and clock, completing once', async () => {
    const native = await arrangement();
    expect(native.food).toBe(1);
    const control = await native.game.shortSkip(native.run, native.before,
        native.game.ambientFor(native.before, native.run), WAITING_FOCUS, 'Waiting', 0.125);
    expect(control.timeSkip?.requestedDays).toBe(0.125);
    expect(control.timeSkip?.simulatedDays).toBe(0.125);
    expect(control.timeSkip?.interrupted).toBe(true);
    expect(control.timeSkip?.interruptReason).toBe('provisions_exhausted');
    expect(control.timeSkip?.events.some(event => event.kind === 'resource_depleted'
        && event.interrupts && event.dayOffset === 0.125)).toBe(true);
    const expectedBody = bodyReceipt(native.repos.cultivators.getById(native.before.id)!);
    const expectedFood = native.game.rationsHeld(native.before);
    const expectedClock = routineTime(native.game.atHand!);
    expect(expectedFood).toBe(0);
    expect(expectedBody.satiety).toBeGreaterThan(native.before.satiety);
    expect(native.repos.runs.getById(native.run.id)!.elapsedDays - native.run.elapsedDays).toBe(0.125);
    expect(native.repos.runs.getById(native.run.id)!.turn - native.run.turn).toBe(1);
    native.db.close();
    const adapter = await arrangement();
    expect(adapter.food).toBe(1);
    const spent = await passHours(adapter.game, adapter.run, adapter.before, 3);
    expect(spent.finished).toBe(false);
    expect(spent.spent?.timeSkip).toEqual(control.timeSkip);
    expect(spent.spent?.cutShort).toEqual(control.cutShort);
    expect(bodyReceipt(adapter.repos.cultivators.getById(adapter.before.id)!)).toEqual(expectedBody);
    expect(adapter.game.rationsHeld(adapter.before)).toBe(expectedFood);
    expect(routineTime(adapter.game.atHand!)).toBe(expectedClock);
    expect(adapter.repos.runs.getById(adapter.run.id)!.elapsedDays - adapter.run.elapsedDays).toBe(0.125);
    expect(adapter.repos.runs.getById(adapter.run.id)!.turn - adapter.run.turn).toBe(1);
}, 180_000);

it('a final native fraction boundary death remains an interruption, with no extra clock or completion', async () => {
    const h = await arrangement();
    let worldPortions = 0;
    vi.spyOn(h.game, 'advanceWorld').mockImplementation(async (_days, body, run) => {
        worldPortions++;
        h.repos.cultivators.markDead(body.id, 'lifespan_exhausted', run.turn,
            'Explicit final-boundary consequence fixture');
        return { lines: [], structure: [] };
    });
    const spent = await passHours(h.game, h.run, h.before, 3);
    expect(worldPortions).toBeGreaterThan(0);
    expect(spent.finished).toBe(false);
    expect(spent.spent?.timeSkip?.simulatedDays).toBe(0.125);
    expect(spent.spent?.timeSkip?.interrupted || spent.spent?.timeSkip?.died).toBe(true);
    expect(h.repos.cultivators.getById(h.before.id)!.alive).toBe(false);
    expect(h.repos.runs.getById(h.run.id)!.status).toBe('dead');
    expect(h.repos.runs.getById(h.run.id)!.elapsedDays - h.run.elapsedDays).toBe(0.125);
    expect(h.repos.runs.getById(h.run.id)!.turn - h.run.turn).toBe(1);
}, 180_000);
