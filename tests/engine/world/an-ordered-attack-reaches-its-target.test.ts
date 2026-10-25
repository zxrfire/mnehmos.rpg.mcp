/** Replay2 N3: compulsion supplies an attempt by a real body, never remote harm.
 * A stale destination cannot make a named person who has left fight there. */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { layPersonSeal } from '../../../src/engine/world/person-seals.js';
import { commandSlave, settleSlaveOrders, unfinishedSlaveOrders, slaveOrderReport } from '../../../src/engine/world/slave-orders.js';
import { startNpcJourney } from '../../../src/engine/world/dao-ground-stints.js';
import { routineLocationOf, routineTime } from '../../../src/engine/world/npc-routines.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';

for (const left of ['place', 'area', false] as const) it(left ? `cannot attack a named body that has left the ordered ${left}`
    : 'a reached commanded kill uses ordinary melee and attributes the real death to the holder', () => {
    const world = createWorld({ seed: 'reading3-ordered-attack', regionCount: 0, skipPriorAges: true });
    world.currentDay = 0; world.currentHour = 0;
    const here = makeLocation({ id: 'attack-home', name: 'The home court', kind: 'settlement' });
    const there = makeLocation({ id: 'attack-away', name: 'The far court', kind: 'settlement' });
    linkLocations(here, there, 'road', 2);
    world.locations = [here, there]; world.npcs = []; world.factions = []; world.objects = [];
    const ordinal = (key: string) => REALM_TIERS.find(tier => tier.key === key)!.ordinalStart;
    const holder = createNpc(world.seed, { id: 'holder', name: 'The Holder', onDay: 0, bornOnDay: -30 * 365, locationId: here.id });
    const slave = createNpc(world.seed, { id: 'slave', name: 'The Bound Person', onDay: 0, bornOnDay: -25 * 365,
        locationId: here.id, cultivation: { realmOrdinal: ordinal('nascent_soul') } });
    const victim = createNpc(world.seed, { id: 'target', name: 'The Target', onDay: 0, bornOnDay: -25 * 365,
        locationId: there.id, cultivation: { realmOrdinal: ordinal('foundation_establishment') } });
    world.npcs.push(holder, slave, left === 'place' ? startNpcJourney(world, victim, here.id, -10, 'Already left by the real road.') : victim);
    if (left === 'place') expect(routineLocationOf(world, world.npcs[2])).toBe(here.id);
    const areas = theAreasOf(world, there).areas.filter(area => area.for === 'street');
    if (left === 'area') victim.activity = { kind: 'stationed', sinceDay: 0, untilDay: null, withIds: [],
        note: 'Actually standing elsewhere in the same town.', standingIn: areas[1].id };
    // The force itself is arranged through the ordinary consent admission.
    holder.cultivation.realmOrdinal = REALM_TIERS.find(tier => tier.ordinalStart > slave.cultivation.realmOrdinal)!.ordinalStart;
    expect(layPersonSeal(world, holder, slave, { kind: 'slave', day: 0, consentOrSubmission: true, note: 'Real held service.' }).went).toBe(true);
    const fact = commandSlave(world, holder, world.npcs.find(person => person.id === slave.id)!, {
        action: 'attack', destinationId: there.id, targetId: victim.id, words: `kill ${victim.name}`,
        ...(left === 'area' ? { destinationAreaId: areas[0].id } : {})
    }, 0, true)!;
    const due = world.npcs.find(person => person.id === slave.id)!.activity!.untilDay!;
    expect(due).toBeGreaterThan(0);
    world.currentDay = Math.floor(due); world.currentHour = due % 1 * 24;
    settleSlaveOrders(world, due);
    const walking = world.npcs.find(person => person.id === slave.id)!.activity;
    if (walking?.capitalMissionId === fact.id && walking.untilDay != null) {
        world.currentDay = Math.floor(walking.untilDay); world.currentHour = walking.untilDay % 1 * 24;
        settleSlaveOrders(world, walking.untilDay);
    }
    const actual = world.npcs.find(person => person.id === victim.id)!;
    if (left) {
        expect(actual.status).toBe('alive');
        expect(actual.cultivation.hp).toBe(victim.cultivation.hp);
        expect(world.history.facts.some(row => row.kind === 'death')).toBe(false);
        expect(unfinishedSlaveOrders(world).some(row => row.id === fact.id)).toBe(false);
        expect(world.history.facts.find(row => row.data.slaveOrderEnded === fact.id)?.summary).toContain(`${victim.name} is not at`);
        expect(world.npcs.find(person => person.id === slave.id)!.activity?.note).not.toBe(`kill ${victim.name}`);
    } else {
        expect(actual.status).toBe('physically_dead');
        const death = world.history.facts.find(row => row.kind === 'death' && row.actors.some(actor => actor.id === victim.id))!;
        expect(death.data.commandedBy).toBe(holder.id);
        expect(death.actors.some(actor => actor.id === holder.id && actor.role === 'commander')).toBe(true);
        expect(world.history.facts.find(row => row.data.slaveOrderStepEnded === fact.id)?.summary).toContain(`${victim.name} died`);
        expect(world.memories.records.some(memory => memory.ownerId === slave.id && memory.tags.includes('slave-order'))).toBe(true);
    }
});

it('reports the replay3 target who really withdrew alive, without substituting the ordered death', () => {
    // These occurrence/body identities intentionally retain replay3 f739's combat
    // stream. The readonly replay DB had a wound, 1.72 HP and completed receipts.
    const world = createWorld({ seed: '06bd8dfb-8eb1-4f60-8128-0d0a0501a390', regionCount: 0, skipPriorAges: true });
    world.currentDay = 365002; world.currentHour = 2;
    const day = routineTime(world);
    const place = makeLocation({ id: 'replay-court', name: 'The encounter ground', kind: 'settlement' });
    world.locations = [place]; world.npcs = []; world.factions = []; world.objects = [];
    const holder = createNpc(world.seed, { id: 'holder', name: 'The Holder', onDay: day, bornOnDay: day - 30 * 365, locationId: place.id });
    holder.cultivation.realmOrdinal = REALM_TIERS.find(tier => tier.key === 'core_formation')!.ordinalStart;
    const slave = createNpc(world.seed, { id: 'npc-admin-10c15c8ef4c68491c1d707b7', name: 'The Bound Person',
        onDay: day, bornOnDay: day - 20 * 365, locationId: place.id, cultivation: { realmOrdinal: 8,
            spiritRoot: 'single_wood', attributes: { might: 2, insight: 2, fortune: 1, charm: 1 } } });
    const victim = createNpc(world.seed, { id: 'npc-admin-1c39cebde0f6c69c2c071367', name: 'The Target',
        onDay: day, bornOnDay: day - 20 * 365, locationId: place.id, cultivation: { realmOrdinal: 1,
            spiritRoot: 'single_wood', attributes: { might: 2, insight: 3, fortune: 0, charm: 1 } } });
    world.npcs.push(holder, slave, victim);
    expect(layPersonSeal(world, holder, slave, { kind: 'slave', day, consentOrSubmission: true, note: 'Existing service.' }).went).toBe(true);
    world.history.nextFactSeq = 739;
    const fact = commandSlave(world, holder, world.npcs.find(person => person.id === slave.id)!, {
        action: 'attack', destinationId: place.id, targetId: victim.id, words: `kill ${victim.name}`
    }, day, true)!;
    const actual = world.npcs.find(person => person.id === victim.id)!;
    expect(actual.status).toBe('alive');
    expect(actual.cultivation.hp).toBeCloseTo(1.72);
    expect(slaveOrderReport(world, fact).join(' ')).toContain(`${victim.name} withdrew from the fight alive`);
    expect(unfinishedSlaveOrders(world)).toHaveLength(0);
    const after = JSON.stringify(world);
    settleSlaveOrders(world, day);
    expect(JSON.stringify(world)).toBe(after);
});
