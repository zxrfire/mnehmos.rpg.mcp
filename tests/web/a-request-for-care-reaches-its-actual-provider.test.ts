/**
 * Actual model rooms09 asked the physician to treat the player's injuries.
 * Its accepted plan was speak/ask_them_to_give_or_do_something, target physician,
 * topic "treat my injuries". Anonymous-role resolution failed. Even after that
 * repair, generic request pricing had no route to the existing treatment act.
 * These front-door controls keep that exact plan and prove real care receipts,
 * physician fee credit, elapsed month and persisted bodily recovery. Questions,
 * off-duty providers, an empty purse and another listener buy no treatment.
 * No new care calculation or promised outcome is introduced; named provider
 * identity must survive delegation into the existing finite service authorities.
 */
import { expect, it } from 'vitest';
import { atAWorkingPhysician } from './at-a-working-physician.js';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { getOccupation } from '../../src/data/cultivation/mortal-world.js';
import { purposeOf } from '../../src/engine/world/architecture.js';
import { whoDispensesAtTheHouse } from '../../src/engine/world/who-is-actually-seeing-to-wounds.js';
import { onTheShelf } from '../../src/engine/world/house-wound-medicine.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';

function request(role = 'physician', topic = 'treat my injuries') {
    return new ScriptedProvider({ plans: [JSON.stringify({ lane: 'speak',
        intent: 'ask_them_to_give_or_do_something', target: role, topic })],
        narrations: ['Debug prose, not actual-model acceptance.'] });
}
function state(h: Awaited<ReturnType<typeof atAWorkingPhysician>>) {
    const patient = h.game.state().cultivator;
    return { elapsed: h.game.state().run.elapsedDays, hp: patient.hp, wounds: patient.injuries,
        stones: patient.spiritStones, physicianStones: h.physician.spiritStones };
}
it('executes the exact rooms09 request through paid care from its actual physician', async () => {
    const h = await atAWorkingPhysician('named-request-paid-care', { provider: request() });
    h.repos.cultivators.update(h.cultivator.id, { hp: 1, spiritStones: 500 });
    const before = state(h);
    const turn = await h.game.act('I ask the physician to treat my injuries.');
    expect(turn.toolCalls.find(c => c.name === 'narrator.plan')?.source).toBe('model');
    expect(turn.toolCalls.some(c => c.name === 'engine.mortalCare' && c.ok), turn.narration).toBe(true);
    const receipt = turn.toolCalls.find(c => c.name === 'cultivator.applyDeltas' && c.action === 'treat')!;
    expect(receipt).toBeDefined();
    const fee = Number(/= (\d+) stones/.exec(receipt.summary)?.[1]);
    expect(fee).toBeGreaterThan(0);
    expect(h.game.atHand!.npcs.find(n => n.id === h.physician.id)!.spiritStones - before.physicianStones).toBe(fee);
    const after = h.repos.cultivators.getById(h.cultivator.id)!;
    expect(after.hp).toBeGreaterThan(before.hp);
    expect(after.spiritStones).toBeLessThan(before.stones);
    expect(h.game.state().run.elapsedDays - before.elapsed).toBeGreaterThanOrEqual(30);
    h.db.close();
}, 120_000);
for (const refusal of ['off-duty', 'empty purse'] as const) {
    it('does not buy requested care with ' + refusal, async () => {
        const h = await atAWorkingPhysician('named-request-' + refusal, { provider: request() });
        h.repos.cultivators.update(h.cultivator.id, { hp: 1, spiritStones: refusal === 'empty purse' ? 0 : 500 });
        if (refusal === 'off-duty') {
            h.physician.activity = { kind: 'at_a_table', note: 'Eating.', withIds: [], sinceDay: h.world.currentDay, untilDay: h.world.currentDay + 1 };
            h.game.theWorldMoved();
            h.repos.cultivators.standIn(h.cultivator.id, theAreasOf(h.world, h.place).whereIs.get(h.physician.id)!);
            expect(h.game.present(h.game.state().cultivator).some(n => n.id === h.physician.id)).toBe(true);
        }
        const before = state(h);
        const turn = await h.game.act('I ask the physician to treat my injuries.');
        expect(turn.toolCalls.find(c => c.name === 'narrator.plan')?.source).toBe('model');
        expect(turn.toolCalls.some(c => c.name === 'engine.resolveParty' && !c.ok)).toBe(false);
        expect(turn.toolCalls.some(c => c.name === 'engine.mortalCare' && c.ok)).toBe(false);
        expect(turn.toolCalls.some(c => !c.ok && c.action === 'treat')).toBe(true);
        expect(state(h)).toEqual(before);
        h.db.close();
    }, 120_000);
}
it('keeps a request to another ordinary listener from choosing the nearby physician', async () => {
    const h = await atAWorkingPhysician('named-request-wrong-listener', { provider: request('the scribe') });
    h.repos.cultivators.update(h.cultivator.id, { hp: 1, spiritStones: 500 });
    const listener = createNpc(h.world.seed, { id: 'actual-scribe-in-clinic', bornOnDay: h.world.currentDay - 30 * 365,
        onDay: h.world.currentDay, locationId: h.place.id, occupation: getOccupation('job-scribe')!.name,
        cultivation: { realmOrdinal: 0 }, takenNames: new Set(h.world.npcs.map(n => n.name)) });
    listener.activity = { kind: 'talking', note: 'A visitor at the clinic.', withIds: [],
        sinceDay: h.world.currentDay, redirect: { until: routineTime(h.world) + 1, previous: null, standingIn: h.area } };
    h.world.npcs.push(listener); h.game.theWorldMoved();
    const present = h.game.present(h.game.state().cultivator);
    expect(present.some(n => n.id === h.physician.id)).toBe(true);
    expect(present.some(n => n.id === listener.id)).toBe(true);
    const before = state(h);
    const turn = await h.game.act('I ask the scribe to treat my injuries.');
    expect(turn.toolCalls.find(c => c.name === 'narrator.plan')?.source).toBe('model');
    expect(turn.toolCalls.some(c => c.name === 'engine.resolveParty' && !c.ok)).toBe(false);
    expect(turn.toolCalls.some(c => c.name === 'world.physicianIsWorking' && !c.ok)).toBe(true);
    expect(state(h)).toEqual(before);
    h.db.close();
}, 120_000);
it('keeps an information question in the exact request lane from buying a course', async () => {
    const provider = request('physician', 'what care do you offer travellers?');
    const h = await atAWorkingPhysician('named-request-information', { provider });
    const before = state(h);
    const turn = await h.game.act('I ask the physician what care you offer travellers?');
    expect(turn.toolCalls.some(c => c.name === 'engine.readState' && c.ok)).toBe(true);
    expect(turn.toolCalls.some(c => c.name === 'engine.mortalCare')).toBe(false);
    const after = state(h);
    expect({ ...after, elapsed: before.elapsed }).toEqual(before);
    expect(after.elapsed - before.elapsed).toBeCloseTo(0.125);
    h.db.close();
}, 120_000);

it('does not take house medicine from a different attendant than the requested listener', async () => {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['Debug prose, not actual-model acceptance.'] });
    const h = await makeGameInWorld({ seed: 'named-house-provider-mismatch', worldSeed: 'a-member-is-seen-to', provider });
    const { cultivator } = await h.game.newRun('Member');
    const world = (await h.game.loadWorld())!;
    const house = world.factions.find(f => f.dissolvedOnDay === null && onTheShelf(f, 'pill-clear-meridian') >= 5
        && whoDispensesAtTheHouse(world, f.id) !== null)!;
    expect(house, 'an actual house currently dispensing counted medicine').toBeDefined();
    const dispenser = whoDispensesAtTheHouse(world, house.id)!;
    const ground = world.locations.find(p => p.controllingFactionId === house.id && purposeOf(p) === 'infirmary')!;
    const area = theAreasOf(world, ground).whereIs.get(dispenser.id)!;
    expect(area, 'actual attendant placement agrees with clinical duty').toBeDefined();
    const listener = world.npcs.find(n => n.status === 'alive' && n.factionId === house.id && n.id !== dispenser.id)!;
    expect(listener).toBeDefined();
    listener.locationId = ground.id;
    listener.activity = { kind: 'talking', note: 'A visit at the infirmary.', withIds: [], sinceDay: world.currentDay,
        redirect: { until: routineTime(world) + 1, previous: null, standingIn: area } };
    h.repos.sects.addMember(house.id, cultivator.id, 1);
    h.repos.sects.addContribution(house.id, cultivator.id, 500);
    h.repos.cultivators.update(cultivator.id, { location: ground.name, spiritStones: 500 });
    h.repos.cultivators.standIn(cultivator.id, area); h.game.theWorldMoved();
    h.db.prepare(`INSERT INTO cultivator_injuries (id,cultivator_id,severity,source,description,sustained_on_turn,treated,cultivation_penalty,breakthrough_penalty)
        VALUES (?,?,'serious','combat','A torn meridian.',1,0,0.1,0.05)`).run('fc751388-e7fc-4cbc-8385-0653ee5396db', cultivator.id);
    const present = h.game.present(h.game.state().cultivator);
    expect(present.some(n => n.id === listener.id)).toBe(true);
    expect(present.some(n => n.id === dispenser.id)).toBe(true);
    plans.push(JSON.stringify({ lane: 'speak', intent: 'ask_them_to_give_or_do_something', target: listener.name, topic: 'treat my injuries' }));
    const before = { stock: onTheShelf(house, 'pill-clear-meridian'), body: h.game.state().cultivator,
        elapsed: h.game.state().run.elapsedDays, member: h.repos.sects.getMembership(cultivator.id) };
    const turn = await h.game.act('I ask ' + listener.name + ' to treat my injuries.');
    expect(turn.toolCalls.find(c => c.name === 'narrator.plan')?.source).toBe('model');
    expect(turn.toolCalls.some(c => c.name === 'engine.resolveParty' && !c.ok)).toBe(false);
    expect(turn.toolCalls.some(c => c.name === 'world.whatTheShelfGivesAMember' && c.ok)).toBe(false);
    expect({ stock: onTheShelf(h.game.atHand!.factions.find(f => f.id === house.id)!, 'pill-clear-meridian'),
        body: h.game.state().cultivator, elapsed: h.game.state().run.elapsedDays,
        member: h.repos.sects.getMembership(cultivator.id) }).toEqual(before);
    h.db.close();
}, 120_000);
