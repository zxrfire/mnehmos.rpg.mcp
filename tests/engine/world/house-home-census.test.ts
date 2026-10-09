/** Manual owner census. The unchanged capital assertion found 249/588 members
 * physically home at ten years. Each canonical decade is cached once; fifty
 * and one hundred years reuse those walks. The report partitions actual away
 * bodies by their current activity, dispatch binding and physical ground, with
 * the written activity and recent ledger facts retained for inspection.
 * Enable HOUSE_HOME_CENSUS=before or after. Ordinary suites skip the walk. */
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { soakedWorld } from '../../support/soaked-world.js';
import { routeQueriesFor } from '../../../src/engine/world/locations.js';
import { locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';
import { groundAtLocation } from '../../../src/engine/world/how-a-cultivator-comes-by-a-road.js';
import { exteriorGroundOfDeparture } from '../../../src/engine/world/departure-approach.js';
import { capitalPlaces } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';

const mode = process.env.HOUSE_HOME_CENSUS;
const snapshots = process.env.HOUSE_HOME_SNAPSHOTS;
for (const years of snapshots ? [0, 10, 50, 100] : Array.from({ length: 11 }, (_, index) => index * 10)) {
    it.skipIf(!mode)(`reads the actual house census at ${years} years`, async () => {
        const began = performance.now();
        const state: WorldState = snapshots
            ? JSON.parse(readFileSync(`.claude/house-world-${snapshots}-${years}.json`, 'utf8'))
            : await soakedWorld('demography', { years });
        const elapsedMs = performance.now() - began;
        const routes = routeQueriesFor(state.locations);
        const livingHouses = new Map(state.factions.filter(h => h.dissolvedOnDay === null).map(h => [h.id, h]));
        const members = state.npcs.filter(n => n.status === 'alive' && n.factionId && livingHouses.has(n.factionId));
        const pending = new Map((state.pendingSendings ?? []).flatMap(row => row.party.map(person => [person.id, row] as const)));
        const facts = new Map(state.history.facts.map(fact => [fact.id, fact]));
        const recent = new Map<string, typeof state.history.facts>();
        for (const fact of state.history.facts) for (const actor of fact.actors) {
            const rows = recent.get(actor.id) ?? [];
            rows.push(fact); if (rows.length > 6) rows.shift(); recent.set(actor.id, rows);
        }
        const away: Record<string, number> = { posted: 0, capital_mission: 0, capital_travel: 0,
            dispatched: 0, shuttle_assembly: 0, wandering: 0, dao_ground: 0, other: 0 };
        const people = members.map(person => {
            const physicalId = locationOnNpcJourney(state.locations, person, state.currentDay, routes,
                undefined, id => state.npcs.find(n => n.id === id));
            const physical = physicalId ? routes.places.get(physicalId) : undefined;
            const homeId = livingHouses.get(person.factionId!)!.seatLocationId;
            const home = physicalId === homeId;
            const activity = person.activity;
            const sending = pending.get(person.id);
            const mission = activity?.capitalMissionId ? facts.get(activity.capitalMissionId) : undefined;
            let reason = 'home';
            if (!home) {
                reason = activity?.kind === 'stationed' ? 'posted'
                    : mission?.data.publicMission === true && mission.data.publicOneWay !== true
                        ? activity?.kind === 'travelling' || activity?.capitalMissionWaiting ? 'capital_travel' : 'capital_mission'
                    : mission?.data.houseAssembly === true ? 'shuttle_assembly'
                    : sending || activity?.airDutyReceiptId || activity?.kind === 'out_with_a_party' ? 'dispatched'
                    : activity?.kind === 'comprehending' || physical && groundAtLocation(physical) ? 'dao_ground'
                    : mission?.data.publicOneWay === true || activity?.note.startsWith('Going to live at ')
                        || activity?.note.startsWith('Lost to ')
                        || activity?.note.startsWith('On the way to ')
                        || activity?.note.startsWith('Entered on the roll at ')
                        || activity?.note === 'Returning home from a house posting.' ? 'other'
                    : activity?.kind === 'travelling' ? 'wandering' : 'other';
                away[reason]!++;
            }
            return { id: person.id, name: person.name, houseId: person.factionId, homeId, physicalId,
                enclosingId: physicalId ? exteriorGroundOfDeparture(state, physicalId, routes.places)?.id : null,
                reason, locationId: person.locationId, updatedOnDay: person.updatedOnDay, activity,
                dispatch: sending && { departsOnDay: sending.departsOnDay, posting: sending.posting,
                    locationId: sending.locationId, dispatchFactId: sending.dispatchFactId },
                facts: (recent.get(person.id) ?? []).map(f => ({ id: f.id, day: f.day, summary: f.summary, data: f.data })) };
        });
        const home = people.filter(person => person.reason === 'home').length;
        const cities = capitalPlaces(state).map(city => ({ name: city.name,
            present: state.npcs.filter(n => n.status === 'alive' && locationOnNpcJourney(state.locations, n,
                state.currentDay, routes, undefined, id => state.npcs.find(person => person.id === id)) === city.id).length }));
        const hash = createHash('sha256').update(JSON.stringify(state)).digest('hex');
        const result = { years, elapsedMs, members: members.length, home, homeShare: home / members.length, away, cities, hash, people };
        writeFileSync(`.claude/house-home-${mode}-${years}.json`, JSON.stringify(result, null, 2));
        if ([0, 10, 50, 100].includes(years)) writeFileSync(`.claude/house-world-${mode}-${years}.json`, JSON.stringify(state));
        console.log('HOUSE CENSUS', JSON.stringify({ years, elapsedMs, members: members.length, home,
            homeShare: home / members.length, away, cities, hash }));
        expect(home + Object.values(away).reduce((sum, count) => sum + count, 0)).toBe(members.length);
        if (mode === 'after' && [10, 50, 100].includes(years)) expect(home / members.length).toBeGreaterThan(0.5);
    }, 900_000);
}

/** The audit intercepts actual body-row writes during one ordinary year. It
 * changes no production code and publishes no observer-altered canonical walk. */
it.skipIf(!process.env.HOUSE_HOME_WRITES)('records the writes that move members or erase their away binding', () => {
    const arm = process.env.HOUSE_HOME_WRITES!;
    const world: WorldState = JSON.parse(readFileSync('.claude/house-world-before-0.json', 'utf8'));
    const writes: unknown[] = [];
    const watch = (rows: NpcRecord[]) => new Proxy(rows, {
        set(target, key, value: NpcRecord) {
            const before = target[Number(key)];
            if (before && value?.id === before.id && (before.factionId || value.factionId)
                && (before.locationId !== value.locationId || before.activity && !value.activity)) {
                writes.push({ id: value.id, name: value.name, day: value.updatedOnDay, factionId: value.factionId,
                    before: { locationId: before.locationId, activity: before.activity },
                    after: { locationId: value.locationId, activity: value.activity },
                    stack: new Error().stack?.split('\n').filter(line => line.includes('/src/') || line.includes('\\src\\')).slice(0, 5) });
            }
            return Reflect.set(target, key, value);
        }
    });
    world.npcs = watch(world.npcs);
    const state = new Proxy(world, { set(target, key, value) {
        return Reflect.set(target, key, key === 'npcs' ? watch(value) : value);
    } });
    advanceWorldForPlay(state, { days: 365, stopOnInterrupt: false });
    writeFileSync(`.claude/house-writes-${arm}.json`, JSON.stringify(writes, null, 2));
    expect(writes.length).toBeGreaterThan(0);
}, 120_000);
