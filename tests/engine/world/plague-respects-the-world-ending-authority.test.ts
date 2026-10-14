/**
 * The run2 ending-authority guard found autonomous plague calling the unguarded
 * death primitive. A catalog-standing row could die despite the shared world
 * ending rule. Arrange an already-fatal course at its actual boundary: an
 * ordinary person dies once, while a stated person receives no false death
 * receipt and can finish the ordinary illness course. Late settlement must
 * still honor an ordinary death that fell due before the course ended.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, CATALOG_STATES_STANDING_TAG } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { settleNativePlague } from '../../../src/engine/world/plague-in-a-place.js';
import { PLAGUE_COURSE_DAYS, PLAGUE_DANGER_DAYS } from '../../../src/engine/cultivation/plague.js';

function patient(stated: boolean, day: number) {
    const world = createWorld({ seed: 'plague-ending-authority', presentYear: 0, regionCount: 0, skipPriorAges: true });
    const home = makeLocation({ id: 'village', name: 'The village', kind: 'settlement' });
    world.locations.push(home);
    const person = createNpc(world.seed, { id: 'patient', name: 'Lan Sheng', onDay: 0,
        bornOnDay: -20 * 365, locationId: home.id, cultivation: { realmOrdinal: 0 },
        tags: stated ? [CATALOG_STATES_STANDING_TAG] : [] });
    person.cultivation.plague = { outbreakId: 'outbreak', contractedOnDay: 0,
        fatalOnDay: PLAGUE_DANGER_DAYS, endsOnDay: PLAGUE_COURSE_DAYS, treatedOnDay: null };
    world.npcs.push(person);
    world.currentDay = day;
    return { world, person };
}

it('consults the ordinary world ending authority without announcing an unperformed death', () => {
    const { world, person } = patient(true, PLAGUE_DANGER_DAYS);
    settleNativePlague(world, person.id, world.currentDay);
    expect(world.npcs.find(row => row.id === person.id)!.status).toBe('alive');
    expect(world.history.facts.some(fact => fact.data.plagueDeath === true)).toBe(false);
});

it('lets a protected patient finish the actual course instead of retaining fatal illness forever', () => {
    const { world, person } = patient(true, PLAGUE_COURSE_DAYS);
    settleNativePlague(world, person.id, world.currentDay);
    const after = world.npcs.find(row => row.id === person.id)!;
    expect(after.status).toBe('alive');
    expect(after.cultivation.plague).toBeNull();
    expect(world.history.facts.some(fact => fact.data.plagueRecovery === true)).toBe(true);
    expect(world.history.facts.some(fact => fact.data.plagueDeath === true)).toBe(false);
});

it('settles an ordinary overdue death at its actual fatal date, once, even after course expiry', () => {
    const { world, person } = patient(false, PLAGUE_COURSE_DAYS + 3);
    settleNativePlague(world, person.id, world.currentDay);
    settleNativePlague(world, person.id, world.currentDay);
    const deaths = world.history.facts.filter(fact => fact.data.plagueDeath === true);
    expect(deaths).toHaveLength(1);
    expect(deaths[0].day).toBe(PLAGUE_DANGER_DAYS);
    expect(world.npcs.find(row => row.id === person.id)!.status).toBe('physically_dead');
});
