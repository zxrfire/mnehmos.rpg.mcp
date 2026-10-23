/** Replay R6: the board re-listed fares, but Gemma narrated a paid seat while
 * the purse remained unchanged. Inspect the actual listing facts sent to a
 * scripted narrator; listing and a failed destination lookup spend nothing. */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { aSeatOnAShipOrACarriage } from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import { publicTransportFrom } from '../../src/engine/world/public-transport-at-a-place.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';

describe('a fare listing carries its non-transaction outcome', () => {
    it.each(['read', 'buy'])('the %s listing says nothing was bought or paid (replay R6)', async intent => {
        const h = await makeGameInWorld({ seed: `fare-list-${intent}`, worldSeed: 'road-world' });
        await h.game.newRun('Rider');
        const world = h.game.atHand!;
        const port = world.locations.find(place => place.kind === 'settlement'
            && publicTransportFrom(world, place.name, world.currentDay).some(line => line.service === 'ship'))!;
        expect(port).toBeDefined();
        const landing = theAreasOf(world, port).areas.find(area => area.for === 'landing')!;
        h.repos.cultivators.update(h.game.currentRun().cultivator.id, { location: port.name });
        h.repos.cultivators.standIn(h.game.currentRun().cultivator.id, landing.id);
        h.game.theWorldMoved();
        const before = h.game.currentRun();
        const result = await aSeatOnAShipOrACarriage(h.game, before.run, before.cultivator,
            intent === 'buy' ? 'an unresolved destination' : undefined, intent, 'ship');
        expect(result.facts.headline).toContain('What runs from');
        expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        const provider = new ScriptedProvider({ narrations: ['The clerk takes two stones and sells you a seat.'] });
        await new ProviderNarrator(provider, { model: 'test' }).narrate(result.facts,
            { place: port.name, ambient: 'normal', playerSaid: 'ok one seat please' });
        const told = provider.calls.at(-1)!.messages.find(message => message.role === 'user')!.content;
        expect(told).toContain('No seat was bought and nothing was paid');
        expect(told).toContain('in this listing');
        expect(told).toContain('cash a seat');
    });
});
