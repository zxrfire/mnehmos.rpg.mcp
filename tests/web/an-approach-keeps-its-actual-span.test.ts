/**
 * executeAction used to stand in the listener's area and resolve the requested
 * act BEFORE spending the quarter-day approach; it discarded that receipt.
 * execute then discarded a successful lesser receipt, or replaced an earlier
 * valid reply with a later interrupted span. These controls use game.act and
 * native shortSkip/world/apply paths. The listener's actual existing public
 * area is held by an ordinary dated redirect, not by a parallel scene store.
 * An ordinary dated work deadline splits the quarter-day at .125; selected
 * world consequences run after that real advance, never instead of it. The
 * later eighth-day must not commit after actual relocation or native death.
 * Red controls remove only deferred area commit / ordered receipt composition /
 * deferred native completion respectively, keeping the same fixture and world.
 * Candidate controls remain pending root compiler and runtime verification.
 */
import { expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { crossToWhoeverTheyNamed } from '../../src/web/walking-across-a-place.js';
import { writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import type { Execution } from '../../src/web/turn-wire-shapes.js';

async function arranged() {
    const { game, db, narrator } = await makeGameInWorld({ seed: 'actual-local-approach', worldSeed: 'actual-local-approach-world' });
    await game.newRun('Approaching visitor');
    game.atHand = await prepareWorldClockForPreciseSpan(game.currentRun().run, game.currentRun().cultivator);
    const world = game.atHand!, now = routineTime(world);
    const place = makeLocation({ id: 'approach-market', name: 'Approach market', kind: 'settlement' });
    const elsewhere = makeLocation({ id: 'approach-elsewhere', name: 'Another clearing', kind: 'settlement' });
    world.locations = [place, elsewhere]; world.factions = []; world.objects = []; world.schedule = [];
    const me = game.currentRun().cultivator;
    game.repos.cultivators.update(me.id, { location: place.name, realmOrdinal: 20, hp: 1000, maxHp: 1000, spiritStones: 5000 });
    game.repos.cultivators.standIn(me.id, null);
    writeFlag(db, me.id, 'rations_held', '20');
    world.npcs = Array.from({ length: 12 }, (_, i) => {
        const npc = createNpc(world.seed, { id: `approach-speaker-${i}`, name: `Market speaker ${i}`,
            onDay: now, bornOnDay: now - 20 * 365, locationId: place.id });
        npc.activity = { kind: 'trade', withIds: [], sinceDay: now, untilDay: now + 1, note: 'At the market.' };
        return npc;
    });
    const read = peopleInThisPlace(game.repos, game.currentRun().cultivator, world, place);
    const targetArea = read.areas.find(area => area.for !== 'room' && [...read.whereIs.values()].includes(area.id))!;
    const fromArea = read.areas.find(area => area.for !== 'room' && area.id !== targetArea.id)!;
    expect(fromArea).toBeDefined(); expect(targetArea).toBeDefined();
    const target = world.npcs.find(npc => read.whereIs.get(npc.id) === targetArea.id)!;
    const previous = target.activity!;
    target.activity = { ...previous, redirect: { until: now + 10, standingIn: targetArea.id, previous } };
    world.npcs = [target];
    game.repos.cultivators.standIn(me.id, fromArea.id);
    game.noteEncounter(game.currentRun().cultivator, game.currentRun().run,
        { kind: 'cultivator', id: target.id, name: target.name }, 'told', `${target.name} gave their name.`);
    game.theWorldMoved();
    expect(crossToWhoeverTheyNamed(game, game.currentRun().cultivator, target.name, false)?.areaId).toBe(targetArea.id);
    const receipts: Execution[] = [];
    const native = game.shortSkip.bind(game);
    vi.spyOn(game, 'shortSkip').mockImplementation(async (...args) => {
        const receipt = await native(...args); receipts.push(receipt); return receipt;
    });
    const narrated = vi.spyOn(narrator, 'narrate');
    return { game, db, narrator, world, now, target, targetArea, fromArea, elsewhere, receipts, narrated };
}

for (const consequence of ['death', 'relocation'] as const) it('does not commit the listener area or handler after actual ' + consequence, async () => {
    const { game, db, narrator, world, now, target, fromArea, targetArea, elsewhere, receipts } = await arranged();
    const boundary = createNpc(world.seed, { id: 'approach-boundary-body', name: 'Dated market hand',
        onDay: now, bornOnDay: now - 20 * 365, locationId: elsewhere.id });
    boundary.activity = { kind: 'trade', withIds: [], sinceDay: now, untilDay: now + .125, note: 'Ending actual work.' };
    world.npcs.push(boundary); game.theWorldMoved();
    try {
        vi.spyOn(narrator, 'plan').mockResolvedValue({ action: { action: 'interact', target: target.name, intent: 'talk' }, source: 'fallback' });
        const handler = vi.spyOn(game, 'interact');
        const native = game.advanceWorld.bind(game);
        let observedArea: string | null | undefined;
        vi.spyOn(game, 'advanceWorld').mockImplementation(async (...args) => {
            const report = await native(...args);
            const current = game.currentRun(); observedArea = current.cultivator.standingIn;
            if (consequence === 'death') {
                game.repos.cultivators.markDead(current.cultivator.id, 'obviously_fatal_choice', current.run.turn, 'Selected actual boundary death.');
                game.repos.runs.endRun(current.run.id, 'obviously_fatal_choice', 'Selected actual boundary death.');
            } else {
                game.repos.cultivators.update(current.cultivator.id, { location: elsewhere.name });
                game.repos.cultivators.standIn(current.cultivator.id, null);
            }
            return report;
        });
        const before = game.currentRun();
        const result = await game.act('I greet ' + target.name);
        expect(observedArea).toBe(fromArea.id);
        expect(handler).not.toHaveBeenCalled();
        expect(game.currentRun().cultivator.standingIn).not.toBe(targetArea.id);
        expect(receipts).toHaveLength(1);
        expect(result.toolCalls.some(call => call.name === 'engine.approachUnfinished')).toBe(true);
        expect(result.toolCalls.filter(call => call.name === 'engine.approachTime')).toEqual([]);
        expect(journeyTimeHasReached(game.currentRun().run.elapsedDays - before.run.elapsedDays, .125)).toBe(true);
        expect(journeyTimeHasReached(.125, game.currentRun().run.elapsedDays - before.run.elapsedDays)).toBe(true);
        expect(receipts[0]!.timeSkip?.simulatedDays).toBe(.125);
        if (consequence === 'relocation') expect(game.currentRun().run.turn).toBe(before.run.turn + 1);
        if (consequence === 'death') expect(game.currentRun().cultivator.alive).toBe(false);
        else expect(game.currentRun().cultivator.location).toBe(elsewhere.name);
    } finally { vi.restoreAllMocks(); db.close(); }
}, 120_000);

it('keeps the actual successful approach receipt when the following object request is refused', async () => {
    const { game, db, narrator, target, targetArea, receipts, narrated } = await arranged();
    try {
        // The person is reachable; their name does not make them a breakable object.
        vi.spyOn(narrator, 'plan').mockResolvedValue({ action: { action: 'destroy', target: target.name }, source: 'fallback' });
        const before = game.currentRun();
        const result = await game.act('I break ' + target.name);
        expect(game.currentRun().cultivator.standingIn).toBe(targetArea.id);
        expect(result.toolCalls.some(call => call.name === 'engine.approachTime')).toBe(true);
        expect(result.toolCalls.some(call => !call.ok && !call.name.startsWith('narrator.'))).toBe(true);
        expect(receipts).toHaveLength(1);
        const facts = narrated.mock.calls.at(-1)![0];
        for (const line of receipts[0]!.facts.lines) expect(facts.lines).toContain(line);
        expect(journeyTimeHasReached(game.currentRun().run.elapsedDays, before.run.elapsedDays + .25)).toBe(true);
        expect(journeyTimeHasReached(before.run.elapsedDays + .25, game.currentRun().run.elapsedDays)).toBe(true);
        expect(game.currentRun().run.turn).toBe(before.run.turn + 1);
    } finally { vi.restoreAllMocks(); db.close(); }
}, 120_000);

it('retains the reply and both actual native spans with one action completion', async () => {
    const { game, db, narrator, target, receipts, narrated } = await arranged();
    try {
        vi.spyOn(narrator, 'plan').mockResolvedValue({ action: { action: 'interact', target: target.name, intent: 'talk' }, source: 'fallback' });
        const before = game.currentRun();
        const handler = vi.spyOn(game, 'interact');
        const result = await game.act('I greet ' + target.name);
        expect(handler).toHaveBeenCalledOnce();
        const reply = await handler.mock.results[0]!.value;
        expect(receipts.map(receipt => receipt.timeSkip?.simulatedDays)).toEqual([.25, .125]);
        const facts = narrated.mock.calls.at(-1)![0];
        for (const receipt of receipts) for (const line of receipt.facts.lines) expect(facts.lines).toContain(line);
        expect(result.toolCalls.some(call => call.name === 'engine.approachTime')).toBe(true);
        for (const line of reply.facts.lines) expect(facts.lines).toContain(line);
        expect(result.toolCalls.some(call => call.name === 'engine.lesserActionTime')).toBe(true);
        expect(journeyTimeHasReached(game.currentRun().run.elapsedDays, before.run.elapsedDays + .375)).toBe(true);
        expect(journeyTimeHasReached(before.run.elapsedDays + .375, game.currentRun().run.elapsedDays)).toBe(true);
        expect(game.currentRun().run.turn).toBe(before.run.turn + 1);
    } finally { vi.restoreAllMocks(); db.close(); }
}, 120_000);
