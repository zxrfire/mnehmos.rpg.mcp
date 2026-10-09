/** Owner ruling: sect business continues between the city's occasional dates.
 * Actual allies receive envoys, actual patrons receive carried tribute, and a
 * progress is an arrived ranked party. The same itinerary supplies road time,
 * service and homecoming. No calendar entry grants a future arrival or payment.
 * Experience work remains ordinary board work, and leading it pays more than
 * a talk through the talk's own face and merit figures. */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { houseBusinessCalendar, sendScheduledHouseBusiness, sendHouseMission,
    advancePublicCapitalMission } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';
import { SECTS } from '../../../src/data/cultivation/sects.js';
import { theBodyItAnswersTo } from '../../../src/data/cultivation/governance-and-water-rights.js';
import { resolveWithPlayerPresent } from '../../../src/engine/world/background-incident-draw.js';
import { whatAttentionIsWorth, whatLeadingDisciplesIsWorth, meritWith } from '../../../src/engine/world/what-a-house-counts-in-somebodys-favour.js';
import { whatBeingWatchedIsWorth, faceOf } from '../../../src/engine/world/what-a-face-is-worth.js';
import { getSendingReason } from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { aPostingAsAnOffer } from '../../../src/engine/encounters/what-a-house-has-on-its-board.js';
import { makeObject, HELD_TAG } from '../../../src/engine/world/possessions.js';
import { npcCombatArts } from '../../../src/engine/world/the-arts-an-npc-actually-uses-in-a-fight.js';

function world() {
    const state = createWorld({ seed: 'house-business-calendar', skipPriorAges: true, regionCount: 0 });
    const row = SECTS.find(house => theBodyItAnswersTo(house.id))!;
    const home = makeLocation({ id: 'home', name: 'Pine Grounds', kind: 'sect_seat' });
    const city = makeLocation({ id: 'city', name: 'River Town', kind: 'settlement' });
    const there = makeLocation({ id: 'there', name: 'Jade Grounds', kind: 'sect_seat', tags: ['forbidden_river'] });
    linkLocations(home, city, 'road', 4); linkLocations(city, there, 'road', 3);
    state.locations.push(home, city, there);
    const house = makeFaction({ id: row.id, name: row.name, seatLocationId: home.id,
        ranks: ['Disciple', 'Inner', 'Elder', 'Head'], resources: { power_ordinal: 41, tribute_owed_per_year: 1000, spirit_stones: 10000 } });
    const host = makeFaction({ id: theBodyItAnswersTo(row.id)!, name: 'Jade House', seatLocationId: there.id,
        ranks: ['Disciple', 'Elder', 'Head'], resources: { spirit_stones: 10000 } });
    house.standing[host.id] = .5; host.standing[house.id] = .5;
    state.factions.push(house, host);
    for (let index = 0; index < 12; index++) {
        const person = setRealm(createNpc(state.seed, { id: `member-${index}`, locationId: home.id,
            onDay: state.currentDay, bornOnDay: state.currentDay - 20 * 365 }), index === 0 ? 35 : index <= 3 ? 23 : 3,
            state.currentDay);
        person.factionId = house.id; person.factionRankIndex = index === 0 ? 3 : index <= 3 ? 2 : 0;
        person.activity = null; person.cultivation.techniqueIds = [];
        state.npcs.push(person);
    }
    const receiver = createNpc(state.seed, { id: 'receiver', locationId: there.id, onDay: state.currentDay,
        bornOnDay: state.currentDay - 20 * 365 });
    receiver.factionId = host.id; receiver.factionRankIndex = 2; receiver.activity = null;
    state.npcs.push(receiver);
    return { state, house, host, home, city, there };
}

describe('a house keeps its business calendar', () => {
    it('keeps recurring dates with its actual ally and patron, and drops a broken alliance', () => {
        const { state, house, host, home } = world();
        const calendar = (year: number) => resolveWithPlayerPresent(state, home.id, () => houseBusinessCalendar(state, year));
        const first = calendar(1).filter(date => date.houseId === house.id);
        const second = calendar(2).filter(date => date.houseId === house.id);
        for (const purpose of ['envoy', 'tribute'] as const) {
            const before = first.find(date => date.purpose === purpose)!;
            expect(before.receivingId).toBe(host.id);
            expect(second.find(date => date.purpose === purpose)!.onDay - before.onDay).toBe(365);
        }
        house.standing[host.id] = -.6;
        expect(calendar(2).filter(date => date.houseId === house.id && date.purpose === 'envoy')).toEqual([]);
        expect(calendar(2).some(date => date.houseId === house.id && date.purpose === 'tribute')).toBe(true);
    });

    it('carries reserved tribute through real intermediate ground, pays only on arrival and returns', () => {
        const { state, house, host, home, city, there } = world();
        const day = state.currentDay;
        const original = Number(house.resources.spirit_stones) + Number(host.resources.spirit_stones);
        const dispatch = sendScheduledHouseBusiness(state, { houseId: house.id, receivingId: host.id, purpose: 'tribute', onDay: day })!;
        expect(dispatch).not.toBeNull();
        const cargo = state.objects.find(object => object.data.missionId === dispatch.id)!;
        const carrier = state.npcs.find(person => person.id === cargo.possessorId)!;
        expect(cargo.possessorId).toBe(carrier.id);
        expect(host.resources.spirit_stones).toBe(10000);
        expect(Number(house.resources.spirit_stones) + Number(host.resources.spirit_stones) + Number(cargo.data.tributeStones)).toBe(original);
        expect(locationOnNpcJourney(state.locations, carrier, day + 4)).toBe(city.id);
        advancePublicCapitalMission(state, carrier.id, day + 7);
        expect(state.npcs.find(person => person.id === carrier.id)!.locationId).toBe(there.id);
        expect(host.resources.spirit_stones).toBe(10100);
        expect(state.objects.find(object => object.id === cargo.id)!.ownerId).toBe(host.id);
        advancePublicCapitalMission(state, carrier.id, Number(dispatch.data.plannedReturnDay));
        expect(state.npcs.find(person => person.id === carrier.id)!.locationId).toBe(home.id);
        expect(Number(house.resources.spirit_stones) + Number(host.resources.spirit_stones)).toBe(original);
        expect(state.history.facts.filter(fact => fact.data.tributeReceived === true)).toHaveLength(1);
    });

    it('a progress is a large actual party carrying its possessions, seen at the receiving ground', () => {
        const { state, house, host, home, city, there } = world();
        const day = state.currentDay;
        for (const person of state.npcs.filter(member => member.factionId === house.id))
            state.objects.push(makeObject({ id: `carried-blade:${person.id}`, name: 'Jade Edge', kind: 'artifact', power: 23,
                ownerId: person.id, possessorId: person.id, tags: [`house:${house.id}`, HELD_TAG] }));
        state.objects.push(makeObject({id:'packed-jade',name:'Jade Seal',kind:'artifact',power:23,
            ownerId:state.npcs[0]!.id,possessorId:state.npcs[0]!.id}));
        const dispatch = sendScheduledHouseBusiness(state, { houseId: house.id, receivingId: host.id, purpose: 'progress', onDay: day })!;
        expect(dispatch.actors.length).toBeGreaterThanOrEqual(4);
        const leader = dispatch.actors[0]!;
        expect(state.history.facts.some(fact => fact.data.houseProgress)).toBe(false);
        advancePublicCapitalMission(state, leader.id, day + 4);
        expect(state.history.facts.some(fact=>fact.data.houseProgress && fact.locationId===city.id)).toBe(true);
        advancePublicCapitalMission(state, leader.id, day + 7);
        const seen = state.history.facts.find(fact => fact.data.houseProgress && fact.locationId===there.id)!;
        expect(seen.locationId).toBe(there.id);
        expect(seen.data.carriedObjectIds).toContain(`carried-blade:${leader.id}`);
        expect(seen.data.carriedObjectIds).not.toContain('packed-jade');
        expect(state.npcs.find(person => person.id === leader.id)!.cultivation.realmOrdinal).toBeGreaterThanOrEqual(20);
        expect(faceOf(state.npcs.find(person => person.id === leader.id)!)).toBeGreaterThan(0);
        expect(state.npcs.find(person => person.id === leader.id)!.relationships.some(tie => tie.targetId === 'receiver')).toBe(true);
        advancePublicCapitalMission(state, leader.id, Number(dispatch.data.plannedReturnDay));
        for (const actor of dispatch.actors) expect(state.npcs.find(person => person.id === actor.id)!.locationId).toBe(home.id);
    });

    it('successful collection delivers actual stock only when the mission party gets home',()=>{
        const {state,house,home,there}=world(),day=state.currentDay;
        const party=state.npcs.slice(1,4),reason=getSendingReason('sending-for-materials')!;
        const entry=aPostingAsAnOffer({reason,house,pitchOrdinal:3});
        const dispatch=sendHouseMission(state,house,there,party,reason.name,day,{days:20},undefined,undefined,undefined,
            {houseBusiness:'board_work',boardEntryId:entry.id,leaderId:party[0]!.id,pitchOrdinal:3,dutyDays:20})!;
        const before=structuredClone(house.resources),objects=state.objects.length;
        advancePublicCapitalMission(state,party[0]!.id,day+27);
        expect(state.history.facts.some(fact=>fact.data.missionWork===dispatch.id && fact.data.finished===true)).toBe(true);
        expect(house.resources).toEqual(before);expect(state.objects).toHaveLength(objects);
        advancePublicCapitalMission(state,party[0]!.id,Number(dispatch.data.plannedReturnDay));
        expect(state.npcs.find(person=>person.id===party[0]!.id)!.locationId).toBe(home.id);
        expect(Object.entries(house.resources).some(([key,value])=>Number(value)>Number(before[key]??0))).toBe(true);
        const landed=structuredClone(house.resources);
        advancePublicCapitalMission(state,party[0]!.id,Number(dispatch.data.plannedReturnDay)+1);
        expect(house.resources).toEqual(landed);
    });

    it('senior-led ordinary board work earns actual comprehension and the scaled lecture reward on return', () => {
        const { state, house, home, there } = world();
        const day = state.currentDay;
        state.npcs[2] = setRealm(state.npcs[2]!, 3, day);
        state.npcs[3] = setRealm(state.npcs[3]!, 3, day);
        const senior = state.npcs[1]!, disciples = state.npcs.slice(2, 4);
        const reason = getSendingReason('sending-an-escort')!;
        const entry = aPostingAsAnOffer({ reason, house, pitchOrdinal: 3 });
        const dispatch = sendHouseMission(state, house, there, [senior, ...disciples], reason.name, day,
            { days: 20 }, undefined, undefined, undefined,
            { houseBusiness: 'experience', boardEntryId: entry.id, leaderId: senior.id, pitchOrdinal: 3, dutyDays: 20 })!;
        expect(meritWith(state.npcs[1]!, house.id)).toBe(0);
        advancePublicCapitalMission(state, senior.id, day + 27);
        expect(meritWith(state.npcs[1]!, house.id)).toBe(0);
        expect(disciples.some(person => (state.npcs.find(row => row.id === person.id)!.cultivation.insights?.length ?? 0) > 0)).toBe(true);
        for (const disciple of disciples) {
            const learned = state.npcs.find(row => row.id === disciple.id)!;
            for (const insight of learned.cultivation.insights ?? [])
                expect(learned.cultivation.achievements?.some(row => row.id === insight.provenance.achievementId)).toBe(true);
            expect(npcCombatArts(learned, day + 27).insights).toEqual(learned.cultivation.insights ?? []);
        }
        const days = Number(dispatch.data.plannedReturnDay) - day;
        const reward = whatLeadingDisciplesIsWorth(senior.cultivation.realmOrdinal, days, 2, 2, 0);
        expect(whatLeadingDisciplesIsWorth(23, 20, 2, 2, 0).ratio).toBe(3);
        advancePublicCapitalMission(state, senior.id, Number(dispatch.data.plannedReturnDay));
        expect(meritWith(state.npcs[1]!, house.id)).toBe(reward.merit);
        expect(faceOf(state.npcs[1]!)).toBeCloseTo(reward.face, 2);
        expect(state.npcs[1]!.locationId).toBe(home.id);
        expect(reward.merit).toBe(Math.round(reward.ratio * whatAttentionIsWorth(senior.cultivation.realmOrdinal, days, 2, 2)));
        expect(reward.face).toBe(reward.ratio * whatBeingWatchedIsWorth(2));
        expect(whatLeadingDisciplesIsWorth(23, 90, 2, 2, .5).ratio).toBeGreaterThan(reward.ratio);
        const credited = meritWith(state.npcs[1]!, house.id);
        advancePublicCapitalMission(state, senior.id, Number(dispatch.data.plannedReturnDay) + 1);
        expect(meritWith(state.npcs[1]!, house.id)).toBe(credited);
    });
});
