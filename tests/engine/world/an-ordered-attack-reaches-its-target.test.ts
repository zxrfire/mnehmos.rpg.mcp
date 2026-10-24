/** Replay2 N3: compulsion supplies an attempt by a real body, never remote harm.
 * A stale destination cannot make a named person who has left fight there. */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { layPersonSeal } from '../../../src/engine/world/person-seals.js';
import { commandSlave, settleSlaveOrders, unfinishedSlaveOrders } from '../../../src/engine/world/slave-orders.js';
import { startNpcJourney } from '../../../src/engine/world/dao-ground-stints.js';
import { routineLocationOf } from '../../../src/engine/world/npc-routines.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';

for (const left of [true, false]) it(left ? 'cannot attack a named body that has already left the ordered destination'
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
    world.npcs.push(holder, slave, left ? startNpcJourney(world, victim, here.id, -10, 'Already left by the real road.') : victim);
    if (left) expect(routineLocationOf(world, world.npcs[2])).toBe(here.id);
    // The force itself is arranged through the ordinary consent admission.
    holder.cultivation.realmOrdinal = REALM_TIERS.find(tier => tier.ordinalStart > slave.cultivation.realmOrdinal)!.ordinalStart;
    expect(layPersonSeal(world, holder, slave, { kind: 'slave', day: 0, consentOrSubmission: true, note: 'Real held service.' }).went).toBe(true);
    const fact = commandSlave(world, holder, world.npcs.find(person => person.id === slave.id)!, {
        action: 'attack', destinationId: there.id, targetId: victim.id, words: `kill ${victim.name}`
    }, 0, true)!;
    const due = world.npcs.find(person => person.id === slave.id)!.activity!.untilDay!;
    expect(due).toBeGreaterThan(0);
    world.currentDay = Math.floor(due); world.currentHour = due % 1 * 24;
    settleSlaveOrders(world, due);
    const actual = world.npcs.find(person => person.id === victim.id)!;
    if (left) {
        expect(actual.status).toBe('alive');
        expect(actual.cultivation.hp).toBe(victim.cultivation.hp);
        expect(world.history.facts.some(row => row.kind === 'death')).toBe(false);
        expect(unfinishedSlaveOrders(world).some(row => row.id === fact.id)).toBe(true);
    } else {
        expect(actual.status).toBe('physically_dead');
        const death = world.history.facts.find(row => row.kind === 'death' && row.actors.some(actor => actor.id === victim.id))!;
        expect(death.data.commandedBy).toBe(holder.id);
        expect(death.actors.some(actor => actor.id === holder.id && actor.role === 'commander')).toBe(true);
        expect(world.memories.records.some(memory => memory.ownerId === slave.id && memory.tags.includes('slave-order'))).toBe(true);
    }
});
