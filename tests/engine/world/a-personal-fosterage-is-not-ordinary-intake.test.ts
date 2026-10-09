/** Four fifty-year write traces recorded 527 ordinary-slice vacancy refusals
 * inside fostering and only three placements. A personal word is not a draw
 * from that slice; it still needs a living taker, a movable bar and its price. */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { vacanciesForOrdinaryIntake } from '../../../src/engine/world/a-house-takes-in-one-of-its-own.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { createFavor } from '../../../src/engine/social/grudges.js';
import { writeFileSync } from 'node:fs';

function arrangement(owed: boolean) {
    const world = createWorld({ seed: 'personal-child-placement', regionCount: 0, skipPriorAges: true, presentYear: 0 });
    world.populationTarget = 20;
    world.locations.push(makeLocation({ id: 'province', name: 'Birth province', kind: 'region', data: { localCeilingOrdinal: 0 } }),
        makeLocation({ id: 'other-province', name: 'Another province', kind: 'region', data: { localCeilingOrdinal: 0 } }),
        makeLocation({ id: 'home', name: 'Birth town', kind: 'settlement', parentId: 'province', data: { populationWeight: 20 } }),
        makeLocation({ id: 'receiving', name: 'Receiving ground', kind: 'sect_seat', parentId: 'other-province' }));
    world.locations[2]!.links.push({ toLocationId: 'receiving', kind: 'road', travelDays: 3, open: true, requiresKeyId: null, note: '' });
    world.locations[3]!.links.push({ toLocationId: 'home', kind: 'road', travelDays: 3, open: true, requiresKeyId: null, note: '' });
    world.factions.push(makeFaction({ id: 'sect-hollow-court', name: 'Hollow Court', seatLocationId: 'home' }),
        makeFaction({ id: 'house-ninefold-karma', name: 'Ninefold Karma Palace', seatLocationId: 'receiving' }));
    const person = (id: string, factionId: string, locationId: string) => ({
        ...setRealm(createNpc(world.seed, { id, factionId, locationId, bornOnDay: -80 * 365, onDay: 0 }), 29, 0),
        activity: { kind: 'their_practice' as const, note: 'Cultivating.', sinceDay: 0, untilDay: 365, withIds: [] }
    });
    for (const id of ['parent-one', 'parent-two']) {
        world.npcs.push(upsertRelationship(person(id, 'sect-hollow-court', 'home'), {
            targetId: 'taker', targetName: 'Taker', kind: 'acquaintance', standing: owed ? 0 : 0.9
        }, 0));
        if (owed) world.obligations.push(createFavor({ holderId: id, subjectId: 'taker', cause: 'saved_life',
            severity: 'grave', onDay: 0, description: 'An actual favour owed.' }));
    }
    for (let n = 0; n < 24; n++) world.npcs.push(person(n ? `member-${n}` : 'taker', 'house-ninefold-karma', 'receiving'));
    expect(vacanciesForOrdinaryIntake(world, 0).get('house-ninefold-karma')).toBe(0);
    return world;
}

for (const owed of [false, true]) it(owed ? 'calls in a held favour once even without a warm tie'
    : 'records the debt of a personal placement beyond the ordinary modelled slice', () => {
    const world = arrangement(owed);
    const writes: unknown[] = [];
    world.history.facts = new Proxy(world.history.facts, { set(target, key, value) {
        if (value?.data?.fostering) writes.push({ write: 'history.facts', value });
        return Reflect.set(target, key, value);
    } });
    world.obligations = new Proxy(world.obligations, { set(target, key, value) {
        if (value && typeof value === 'object') writes.push({ write: 'obligations', value });
        return Reflect.set(target, key, value);
    } });
    world.npcs = new Proxy(world.npcs, { set(target, key, value) {
        if (value?.tags?.includes('fostered') && !target[Number(key)]?.tags?.includes('fostered'))
            writes.push({ write: 'npcs', value });
        return Reflect.set(target, key, value);
    } });
    advanceWorldForPlay(world, { days: 181, stopOnInterrupt: false, pressure: { intensity: 0 } });
    writeFileSync(`.claude/fosterage-controlled-writes-${owed ? 'spent' : 'incurred'}.json`, JSON.stringify(writes, null, 2));
    const placement = world.history.facts.find(fact => fact.data.fostering === 'the bar');
    expect(placement).toBeDefined();
    const child = world.npcs.find(person => person.id === placement!.actors.find(actor => actor.role === 'child')!.id)!;
    expect(child.factionId).toBe('house-ninefold-karma');
    expect(child.tags).toContain('fostered');
    expect(child.cultivation.realmOrdinal).toBeLessThan(Number(placement!.data.barSkipped));
    const parentId = String(placement!.data.fostererId);
    if (owed) {
        expect(world.obligations.find(account => account.holderId === parentId && account.subjectId === 'taker')?.status).toBe('settled');
        expect(world.obligations.some(account => account.cause === 'sponsored_admission')).toBe(false);
    } else {
        expect(world.obligations.some(account => account.cause === 'sponsored_admission'
            && account.holderId === 'taker' && account.subjectId === parentId && account.status === 'open')).toBe(true);
    }
});
