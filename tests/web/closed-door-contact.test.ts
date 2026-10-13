/**
 * A remembered elder behind a closed door used to remain a request target.
 * The played request must tell a member why the elder cannot answer and the
 * known remaining span, while leaving cultivation and its prepaid purse alone.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { beginClosedDoorCultivation } from '../../src/engine/world/closed-door-cultivation.js';
import { theLodgingsOfAHouse } from '../../src/engine/world/the-room-a-house-gives-you.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';

it('a member gets the actual closed-door answer when asking an elder for guidance', async () => {
    const h = await makeGameInWorld({ seed: 'closed-door-contact', worldSeed: 'closed-door-contact-world' });
    await h.game.newRun('Member');
    await h.game.act('I wait for three days');
    h.game.atHand = await prepareWorldClockForPreciseSpan(h.game.currentRun().run, h.game.currentRun().cultivator);
    const world = h.game.atHand!;
    const elder = world.npcs.find(person => person.status === 'alive' && person.cultivation.realmOrdinal > 0
        && person.factionId && world.factions.some(house => house.id === person.factionId && house.seatLocationId === person.locationId)
        && theLodgingsOfAHouse(world, person.factionId).length);
    expect(elder).toBeDefined();
    const house = world.factions.find(row => row.id === elder!.factionId)!;
    const me = h.game.currentRun().cultivator;
    h.repos.sects.addMember(house.id, me.id, 0);
    h.repos.cultivators.update(me.id, { location: world.locations.find(row => row.id === house.seatLocationId)!.name });
    const at = world.npcs.findIndex(row => row.id === elder!.id);
    world.npcs[at] = { ...world.npcs[at], activity: null, spiritStones: 10000 };
    h.game.noteEncounter(h.game.currentRun().cultivator, h.game.currentRun().run,
        { kind: 'cultivator', id: elder!.id, name: elder!.name }, 'told', 'The elder gave their name.');
    h.game.theWorldMoved();
    expect(beginClosedDoorCultivation(world, elder!.id, world.currentDay, 365)).toBe(true);
    const purse = world.npcs[at].spiritStones, deadline = world.npcs[at].activity!.untilDay;
    const answer = await h.game.act(`I ask ${elder!.name} for guidance`);
    expect(answer.narration).toContain('closed-door cultivation');
    expect(answer.narration).toMatch(/finish in \d+ days/);
    expect(world.npcs.find(row => row.id === elder!.id)!.activity!.untilDay).toBe(deadline);
    expect(world.npcs.find(row => row.id === elder!.id)!.spiritStones).toBe(purse);
    h.db.close();
});
