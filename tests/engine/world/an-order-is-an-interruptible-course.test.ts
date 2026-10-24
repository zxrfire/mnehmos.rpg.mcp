/** Replay2 N2: ordered spans and journeys are one interruptible course.
 * Completion receipts, not syntax or a second queue, advance the actual body. */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { layPersonSeal, releasePersonSeal } from '../../../src/engine/world/person-seals.js';
import { commandSlave, currentSlaveOrder, settleSlaveOrders, unfinishedSlaveOrders } from '../../../src/engine/world/slave-orders.js';
import { settleClosedDoorCultivation, interruptClosedDoorCultivation } from '../../../src/engine/world/closed-door-cultivation.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { THE_TAG_A_RESIDENCE_CARRIES } from '../../../src/engine/world/somewhere-that-is-theirs.js';

function arranged() {
    const world = createWorld({ seed: 'reading3-ordered-course', regionCount: 0, skipPriorAges: true });
    world.currentDay = 0; world.currentHour = 0;
    const home = makeLocation({ id: 'ordered-home', name: 'The home cave', kind: 'cave' });
    const away = makeLocation({ id: 'ordered-away', name: 'The far village', kind: 'settlement' });
    linkLocations(home, away, 'road', 2);
    world.locations = [home, away]; world.npcs = []; world.factions = []; world.objects = []; world.schedule = [];
    const ordinal = (key: string) => REALM_TIERS.find(tier => tier.key === key)!.ordinalStart;
    const holder = createNpc(world.seed, { id: 'holder', name: 'The Holder', onDay: 0, bornOnDay: -30 * 365,
        locationId: home.id, cultivation: { realmOrdinal: ordinal('nascent_soul') } });
    const slave = createNpc(world.seed, { id: 'slave', name: 'The Bound Person', onDay: 0, bornOnDay: -25 * 365,
        locationId: home.id, cultivation: { realmOrdinal: ordinal('foundation_establishment') } });
    slave.spiritStones = 1000;
    home.tags.push(THE_TAG_A_RESIDENCE_CARRIES); home.data.heldById = slave.id;
    world.npcs.push(holder, slave);
    expect(layPersonSeal(world, holder, slave, { kind: 'slave', day: 0, consentOrSubmission: true, note: 'Actual service.' }).went).toBe(true);
    const body = () => world.npcs.find(person => person.id === slave.id)!;
    const settle = (day: number) => { world.currentDay = Math.floor(day); world.currentHour = day % 1 * 24; settleSlaveOrders(world, day); };
    return { world, home, away, holder, body, settle };
}

it('walks, waits the actual term without resetting it, then starts the next road', () => {
    const a = arranged();
    const fact = commandSlave(a.world, a.holder, a.body(), { action: 'travel', destinationId: a.away.id, words: 'go there', following: [
        { action: 'wait', destinationId: a.away.id, days: 1, words: 'wait one day' },
        { action: 'travel', destinationId: a.home.id, words: 'come home' }
    ] }, 0, true)!;
    expect(a.body().activity?.untilDay).toBe(2);
    a.settle(2);
    expect(currentSlaveOrder(a.world, fact)?.action).toBe('wait');
    expect(a.body().activity?.sinceDay).toBe(2);
    a.settle(2.5);
    expect(a.body().activity?.untilDay).toBe(3);
    a.settle(3);
    expect(currentSlaveOrder(a.world, fact)?.action).toBe('travel');
    expect(a.body().activity?.untilDay).toBe(5);
    a.settle(5);
    expect(a.body().locationId).toBe(a.home.id);
    expect(unfinishedSlaveOrders(a.world)).toHaveLength(0);
});

it('release during the first journey cancels all unreached work', () => {
    const a = arranged();
    const fact = commandSlave(a.world, a.holder, a.body(), { action: 'travel', destinationId: a.away.id, words: 'go there', following: [
        { action: 'guard', destinationId: a.away.id, days: 30, words: 'keep watch' }
    ] }, 0, true)!;
    releasePersonSeal(a.world, a.body().id, 1);
    a.settle(4);
    expect(unfinishedSlaveOrders(a.world)).toHaveLength(0);
    expect(a.world.history.facts.some(row => row.data.slaveOrderStepEnded === fact.id)).toBe(false);
    expect(a.body().activity).toBeNull();
});

for (const interrupted of [false, true]) it(interrupted ? 'an interrupted ordered sitting stops before the next road'
    : 'finishes the ordered sitting before starting the next road', () => {
    const a = arranged();
    a.body().factionId = 'the-called-house';
    const fact = commandSlave(a.world, a.holder, a.body(), { action: 'cultivate', destinationId: a.home.id, days: 30, words: 'sit for a month', following: [
        { action: 'travel', destinationId: a.away.id, words: 'then go to the village' }
    ] }, 0, true)!;
    expect(a.body().activity?.kind).toBe('closed_door_cultivation');
    expect(currentSlaveOrder(a.world, fact)?.action).toBe('cultivate');
    if (interrupted) {
        expect(interruptClosedDoorCultivation(a.world, 'the-called-house', 2, 'actual-attack')).toBe(1);
        a.settle(2);
        expect(unfinishedSlaveOrders(a.world)).toHaveLength(0);
        expect(a.body().locationId).toBe(a.home.id);
        expect(a.body().activity).toBeNull();
    } else {
        a.settle(15);
        expect(a.body().activity?.kind).toBe('closed_door_cultivation');
        settleClosedDoorCultivation(a.world, 30, () => {});
        a.settle(30);
        expect(currentSlaveOrder(a.world, fact)?.action).toBe('travel');
        expect(a.body().activity?.kind).toBe('travelling');
        expect(a.body().activity?.sinceDay).toBe(30);
    }
});
