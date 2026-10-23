/** Replay R6: after fares, "one seat to ... please" only repeated the board.
 * The travel lane must distinguish buying a held ticket from reading routes.
 * Scripted intent stands for the model; actual fare and tally writers decide.
 */
import { expect, it } from 'vitest';
import { validatePlan } from '../../src/web/planned-action.js';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { publicShipLinesFrom } from '../../src/engine/world/public-shipping.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { passageTallyTerms } from '../../src/engine/world/a-passage-tally-is-the-seat-you-own.js';

it('expands buying a ticket separately from reading routes or boarding', () => {
    expect(validatePlan({ lane: 'travel', intent: 'buy_ticket', target: 'a destination' })).toEqual({
        ok: true, action: { action: 'passage', intent: 'ticket', target: 'a destination' }
    });
    expect(validatePlan({ lane: 'travel', intent: 'board_passage', target: 'a destination' })).toEqual({
        ok: true, action: { action: 'passage', intent: 'embark', target: 'a destination' }
    });
});

it('buys the fare just discussed at the counter without boarding or waiting', async () => {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['The counter exchange ends.'] });
    const h = await makeGameInWorld({ seed: 'reading2-ticket', worldSeed: 'public-ship-held-tally-world', provider });
    try {
        const { cultivator } = await h.game.newRun('Passenger');
        const world = h.game.atHand!, from = worldLocationFor(world, 'Emerald Water City')!;
        const landing = theAreasOf(world, from).areas.find(area => area.for === 'landing')!;
        h.repos.cultivators.update(cultivator.id, { location: from.name, spiritStones: 100 });
        h.repos.cultivators.standIn(cultivator.id, landing.id);
        const line = publicShipLinesFrom(world, from.name, routineTime(world)).find(line => line.runsFromDay === null)!;
        expect(line).toBeDefined();
        plans.push(JSON.stringify({ action: 'passage', intent: 'board', topic: 'ship' }));
        await h.game.act('What ships run from here, and what does a seat cost?');
        expect(h.game.atHand!.objects.some(object => object.possessorId === cultivator.id && passageTallyTerms(object))).toBe(false);
        const before = h.game.currentRun();
        plans.push(JSON.stringify({ lane: 'travel', intent: 'buy_ticket', target: line.to, topic: 'ship' }));
        const turn = await h.game.act(`ok one seat to ${line.to.toLowerCase()} please`);
        const tally = h.game.atHand!.objects.find(object => object.possessorId === cultivator.id && passageTallyTerms(object));
        expect(tally, JSON.stringify(turn.toolCalls)).toBeDefined();
        const terms = passageTallyTerms(tally!)!;
        expect(terms.toId).toBe(worldLocationFor(h.game.atHand!, line.to)!.id);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones - terms.fareStones);
        expect(h.game.currentRun().cultivator.location).toBe(from.name);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(h.game.atHand!.history.facts.some(fact => fact.data.actualBoarding === true && fact.actors.some(actor => actor.id === cultivator.id))).toBe(false);
    } finally { h.db.close(); }
});
