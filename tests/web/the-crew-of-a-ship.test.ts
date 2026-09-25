/**
 * A ship's crew are people: a shipmaster and two or three hands, written the first time anybody
 * boards that ship on its lane, then kept.
 *
 * Before this, a ship stopped at sea on the passage from the river mouth left the passenger on a
 * deck with nobody on it, because the Pearl Ocean's own row holds one person in `road-world`. The
 * owner: the crew are real, "helps with gathering knowledge". So they are world rows that can be
 * talked to and remember, `sailor` and `shipmaster` by occupation, which is a life that has seen
 * the road. They go where the ship goes, and at sea the passenger stands on the shipmaster's deck,
 * three at most in view. And aboard, eating draws on the hull's rations before the pack
 * (`whereFoodComesFromHere`).
 *
 * Played on `road-world` with `sea-6`, the stop on day 6 of the passage from the river mouth.
 */

import { describe, expect, it } from 'vitest';

import { whatSomebodyKnowsOfTheLand } from '../../src/engine/world/what-somebody-knows-of-the-land';
import { markDead } from '../../src/engine/world/npc-state';
import { makeGameInWorld } from './harness';

const THE_CREW = /^npc-crew-/;

async function stoppedAtSea() {
    const harness = await makeGameInWorld({ seed: 'sea-6', worldSeed: 'road-world' });
    await harness.game.newRun('Rider');
    const id = harness.game.state().cultivator.id;
    harness.db.prepare("UPDATE cultivators SET location = 'Emerald Water City', spirit_stones = 500 WHERE id = ?").run(id);
    await harness.game.act('I take the ship to Sweet Spring Island');
    const crew = () => harness.game.atHand!.npcs.filter(npc => THE_CREW.test(npc.id));
    return { ...harness, id, crew };
}

describe('the crew of a ship', () => {
    it('defend the ship themselves, by name, when a band attacks it', async () => {
        // The owner: the real named crew fights, not four unnamed guards. `east-64` is a band that
        // beats the crew on the Eastern Tideway early and turns the ship back.
        const { game, db } = await makeGameInWorld({ seed: 'east-64', worldSeed: 'road-world' });
        await game.newRun('Rider');
        const id = game.state().cultivator.id;
        db.prepare("UPDATE cultivators SET location = 'Sweet Spring Island', spirit_stones = 500 WHERE id = ?").run(id);
        db.prepare('UPDATE runs SET elapsed_days = 100 WHERE cultivator_id = ?').run(id);

        const stopped = await game.act('I take the ship to Cloud Gate');

        const crew = game.atHand!.npcs.filter(npc => THE_CREW.test(npc.id));
        const fought = stopped.narration.split('\n').find(line => /^Around the ship, /.test(line)) ?? '';
        expect(crew.length).toBeGreaterThanOrEqual(3);
        for (const one of crew) expect(fought, one.name).toContain(one.name);
        expect(fought).not.toMatch(/\bguards?\b/);
    }, 120_000);

    it('who have died stay dead, and somebody new is taken on in their place', async () => {
        // Found writing this: the world forgets its mortal dead (`theWorldForgetsTheMortalDead`), and
        // a crew written under fixed ids wrote the forgotten hand again at the next boarding, which
        // the store refused as a resurrection and the turn threw. A replacement has an id of its own.
        const { game, crew } = await stoppedAtSea();
        await game.act('I wait until we arrive');
        // Arranged: a hand dies ashore. What is asserted is that nobody raises them.
        const lost = crew().find(npc => npc.identity.occupation === 'sailor')!;
        const at = game.atHand!.npcs.findIndex(npc => npc.id === lost.id);
        game.atHand!.npcs[at] = markDead(game.atHand!.npcs[at]!, Math.floor(game.atHand!.currentDay), 'Drowned in port.');
        game.theWorldMoved();
        const living = crew().filter(npc => npc.status === 'alive').length;

        await game.act('I take the ship to Emerald Water City');

        expect(game.state().cultivator.location).toBe('Emerald Water City');
        expect(game.atHand!.npcs.filter(npc => npc.id === lost.id).every(npc => npc.status !== 'alive')).toBe(true);
        const aboard = crew().filter(npc => npc.status === 'alive');
        expect(aboard).toHaveLength(living + 1);
        const home = game.atHand!.locations.find(row => row.name === 'Emerald Water City')!;
        expect(aboard.every(npc => npc.locationId === home.id)).toBe(true);
    }, 120_000);

    it('are a shipmaster and two or three hands, aboard with the passenger, three at most in view', async () => {
        const { game, crew } = await stoppedAtSea();

        const aboard = crew();
        expect(aboard.filter(npc => npc.identity.occupation === 'shipmaster')).toHaveLength(1);
        expect(aboard.length).toBeGreaterThanOrEqual(3);
        expect(aboard.length).toBeLessThanOrEqual(4);
        expect(aboard.every(npc => npc.cultivation.realmOrdinal <= 4 && npc.factionId === null)).toBe(true);

        const seen = game.present(game.state().cultivator);
        expect(seen.length).toBeLessThanOrEqual(3);
        const master = aboard.find(npc => npc.identity.occupation === 'shipmaster')!;
        expect(seen.map(row => row.id)).toContain(master.id);
        expect((await game.act('look around')).narration).not.toMatch(/Nobody is about/);

        const asked = await game.act(`I ask ${master.name} how long until Sweet Spring Island`);
        expect(asked.narration).toContain(master.name);
    }, 120_000);

    it('go where the ship goes, and are the same people on the next voyage of that lane', async () => {
        const { game, crew } = await stoppedAtSea();
        const first = crew().map(npc => npc.id).sort();
        expect(first.length).toBeGreaterThanOrEqual(3);

        await game.act('I wait until we arrive');
        const port = game.atHand!.locations.find(row => row.name === 'Sweet Spring Island')!;
        expect(crew().every(npc => npc.locationId === port.id)).toBe(true);

        await game.act('I take the ship to Emerald Water City');
        expect(game.state().cultivator.location).toBe('Emerald Water City');
        const home = game.atHand!.locations.find(row => row.name === 'Emerald Water City')!;
        expect(crew().map(npc => npc.id).sort()).toEqual(first);
        expect(crew().every(npc => npc.locationId === home.id)).toBe(true);
    }, 120_000);

    it('know the ports of the water they work', async () => {
        const { game, crew } = await stoppedAtSea();
        const master = crew().find(npc => npc.identity.occupation === 'shipmaster')!;

        const known = whatSomebodyKnowsOfTheLand(game.atHand!, {
            id: master.id, from: 'Sweet Spring Island', ordinal: master.cultivation.realmOrdinal, travelled: 2
        });

        for (const port of ['Silver Island', 'Bronze Gong Cliff', 'Emerald Water City']) {
            expect(known.places.find(place => place.name === port)?.stage, port).toBe('placed');
        }
    }, 120_000);

    it('feed the passenger from the hull when they eat aboard, at no charge', async () => {
        const { game, db, id } = await stoppedAtSea();
        db.prepare('UPDATE cultivators SET satiety = 60 WHERE id = ?').run(id);
        const stones = game.state().cultivator.spiritStones;
        const before = /The hull's rations cover (\d+) more days?/.exec((await game.act('status')).narration)![1];

        const ate = await game.act('I eat');

        expect(ate.narration).toMatch(/You eat from the ship's rations/);
        expect(game.state().cultivator.satiety).toBeGreaterThan(60);
        expect(game.state().cultivator.spiritStones).toBe(stones);
        const after = /The hull's rations cover (\d+) more days?/.exec((await game.act('status')).narration)?.[1] ?? '0';
        expect(Number(after)).toBeLessThan(Number(before));
    }, 120_000);
});
