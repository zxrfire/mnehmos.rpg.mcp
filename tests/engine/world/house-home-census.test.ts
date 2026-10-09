/** Manual owner census. The former capital assertion found 249/588 members
 * physically home at ten years. Each canonical decade is cached once; fifty
 * and one hundred years reuse those walks. The report partitions actual away
 * bodies by their current activity, dispatch binding and physical ground, with
 * the written activity and recent ledger facts retained for inspection.
 * Owner correction: a majority home was the coordinator's wording. A member
 * may be away on real business; an idle body stranded away is the defect. Every
 * checkpoint now checks that each absence has a reason and reports those reasons.
 * Enable HOUSE_HOME_CENSUS=before or after. Ordinary suites skip the walk. */
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { soakedWorld } from '../../support/soaked-world.js';
import { routeQueriesFor } from '../../../src/engine/world/locations.js';
import { locationOnNpcJourney, journeyNeedsWater } from '../../../src/engine/world/places-on-the-way.js';
import { publicShipLinesFrom, thePortsShipsPutInAt } from '../../../src/engine/world/public-shipping.js';
import { exteriorGroundOfDeparture } from '../../../src/engine/world/departure-approach.js';
import { capitalPlaces, journeySelectedToHouseSeat } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';

const mode = process.env.HOUSE_HOME_CENSUS;
const snapshots = process.env.HOUSE_HOME_SNAPSHOTS;
for (const years of process.env.HOUSE_HOME_HORIZONS?.split(',').map(Number)
    ?? (snapshots ? [0, 10, 50, 100] : Array.from({ length: 11 }, (_, index) => index * 10))) {
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
            dispatched: 0, shuttle_assembly: 0, wandering: 0, dao_ground: 0, envoy: 0,
            tribute: 0, progress: 0, experience: 0, board_work: 0, gathering: 0, errand: 0, other: 0, idle_away: 0 };
        const people = members.map(person => {
            const physicalId = locationOnNpcJourney(state.locations, person, state.currentDay, routes,
                undefined, id => state.npcs.find(n => n.id === id));
            const homeId = livingHouses.get(person.factionId!)!.seatLocationId;
            const enclosingId = physicalId ? exteriorGroundOfDeparture(state, physicalId, routes.places)?.id : null;
            const home = physicalId === homeId || enclosingId === homeId;
            const activity = person.activity;
            const sending = pending.get(person.id);
            const mission = activity?.capitalMissionId ? facts.get(activity.capitalMissionId) : undefined;
            let reason = 'home';
            if (!home) {
                const expired=activity?.untilDay!=null && activity.untilDay<state.currentDay
                    && !['travelling','stationed','out_with_a_party','comprehending'].includes(activity.kind);
                reason = (!activity || expired) && !sending ? 'idle_away'
                    : typeof mission?.data.houseBusiness === 'string' && mission.data.houseBusiness in away
                        ? mission.data.houseBusiness
                    : activity?.kind === 'stationed' ? 'posted'
                    : mission?.data.publicMission === true && mission.data.publicOneWay !== true
                        ? activity?.kind === 'travelling' || activity?.capitalMissionWaiting ? 'capital_travel' : 'capital_mission'
                    : mission?.data.houseAssembly === true ? 'shuttle_assembly'
                    : sending || activity?.airDutyReceiptId || activity?.kind === 'out_with_a_party' ? 'dispatched'
                    : activity?.kind === 'comprehending' ? 'dao_ground'
                    : mission?.data.publicOneWay === true || activity?.note.startsWith('Going to live at ')
                        || activity?.note.startsWith('Lost to ')
                        || activity?.note.startsWith('On the way to ')
                        || activity?.note.startsWith('Entered on the roll at ')
                        || activity?.note === 'Returning home from a house posting.' ? 'other'
                    : activity?.kind === 'travelling' ? 'wandering'
                    : activity?.kind==='the_work_of_their_rank'||activity?.kind==='trade'
                        || activity?.untilDay!=null && activity.kind==='teaching' ? 'errand'
                    : 'idle_away';
                away[reason]!++;
            }
            return { id: person.id, name: person.name, houseId: person.factionId, homeId, physicalId,
                enclosingId,
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
        if(process.env.HOUSE_HOME_ROUTE_PERSON){
            const person=state.npcs.find(person=>person.id===process.env.HOUSE_HOME_ROUTE_PERSON)!;
            const house=livingHouses.get(person.factionId!)!;
            console.log('ACTUAL ADMISSION',JSON.stringify({person,house,
                walking:routes.treeFrom(person.locationId!).days.get(house.seatLocationId!),
                currentDay:state.currentDay,
                native:journeySelectedToHouseSeat(state,house,person,state.currentDay)}));
            console.log('ACTUAL DOCKS',JSON.stringify(thePortsShipsPutInAt(state,routes).map(name=>{
                const port=state.locations.find(place=>place.name===name)!;
                return {name,id:port.id,from:routes.treeFrom(person.locationId!).days.get(port.id),
                    to:routes.treeFrom(house.seatLocationId!).days.get(port.id),
                    fromWater:journeyNeedsWater(state.locations,person.locationId!,port.id,routes),
                    toWater:journeyNeedsWater(state.locations,port.id,house.seatLocationId!,routes),
                    lines:publicShipLinesFrom(state,name,state.currentDay,routes).map(line=>({to:line.to,cash:line.cashPerSeat,days:line.days}))};
            })));
            writeFileSync('.claude/house-away-route-probe.json',JSON.stringify(state));
        }
        expect(home + Object.values(away).reduce((sum, count) => sum + count, 0)).toBe(members.length);
        if (mode === 'after') expect(people.filter(person => person.reason === 'idle_away'),
            'every absence has a current activity or dispatch').toEqual([]);
        if (mode === 'after' && [10, 50, 100].includes(years)) {
            const business = ['envoy', 'tribute', 'progress', 'experience', 'board_work', 'capital_mission', 'capital_travel']
                .reduce((sum, reason) => sum + away[reason]!, 0);
            expect(business, 'members are out on house business').toBeGreaterThan(0);
            expect(business / members.length, 'business leaves hands at home').toBeLessThan(0.5);
        }
    }, 900_000);
}

/** The audit intercepts actual body-row writes during one ordinary year. It
 * changes no production code and publishes no observer-altered canonical walk. */
it.skipIf(!process.env.HOUSE_HOME_WRITES)('records the writes that move members or erase their away binding', async () => {
    const arm = process.env.HOUSE_HOME_WRITES!;
    const years = Number(process.env.HOUSE_HOME_WRITES_YEARS ?? 1);
    const world: WorldState = process.env.HOUSE_HOME_WRITES_SNAPSHOT
        ? JSON.parse(readFileSync(process.env.HOUSE_HOME_WRITES_SNAPSHOT, 'utf8'))
        : process.env.HOUSE_HOME_WRITES_START ? await soakedWorld('demography',{years:Number(process.env.HOUSE_HOME_WRITES_START)})
        : years === 1 ? JSON.parse(readFileSync('.claude/house-world-before-0.json', 'utf8'))
        : await soakedWorld('demography', { years: 0 });
    const tracked = process.env.HOUSE_HOME_WRITES_IDS ? new Set(process.env.HOUSE_HOME_WRITES_IDS.split(',')) : null;
    const writes: unknown[] = [];
    const watch = (rows: NpcRecord[]) => new Proxy(rows, {
        set(target, key, value: NpcRecord) {
            const before = target[Number(key)];
            if (value?.id && (!tracked || tracked.has(value.id)) && (before?.factionId || value.factionId)
                && (!before || before.locationId !== value.locationId || before.factionId !== value.factionId
                    || before.activity?.capitalMissionId && before.activity.capitalMissionId !== value.activity?.capitalMissionId
                    || before.activity?.airCourseLocationId && before.activity.airCourseLocationId !== value.activity?.airCourseLocationId
                    || before.activity && !value.activity)) {
                writes.push({ id: value.id, name: value.name, day: value.updatedOnDay, factionId: value.factionId,
                    before: before && { factionId:before.factionId,locationId: before.locationId, activity: before.activity },
                    after: { factionId:value.factionId,locationId: value.locationId, activity: value.activity },
                    stack: new Error().stack?.split('\n').filter(line => line.includes('/src/') || line.includes('\\src\\')).slice(0, 5) });
            }
            return Reflect.set(target, key, value);
        }
    });
    world.npcs = watch(world.npcs);
    const state = new Proxy(world, { set(target, key, value) {
        return Reflect.set(target, key, key === 'npcs' ? watch(value) : value);
    } });
    advanceWorldForPlay(state, { days: years * 365, stopOnInterrupt: false });
    writeFileSync(`.claude/house-writes-${arm}.json`, JSON.stringify(writes, null, 2));
    expect(writes.length).toBeGreaterThan(0);
}, 900_000);
