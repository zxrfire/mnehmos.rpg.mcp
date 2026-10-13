/**
 * Plague was a village encounter and a population comment, without a named
 * bodily course. These controls require actual susceptible people, a dated
 * death and ordinary estate, real medicine, and contagion carried by an actual
 * journey. Background cohorts are rate draws; no test ticks every person daily.
 * Ordinary retention may forget an unheld mortal's dead row. The named dated
 * handoff and actual estate, rather than indefinite row retention, prove death.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, maxBodyOf } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { beginPlagueOutbreak, plagueHere, settleNativePlague, treatNativePlagueWithMedicine,
    plagueOutbreaksThisYear, seekNativePlagueMedicine } from '../../../src/engine/world/plague-in-a-place.js';
import { activePlague } from '../../../src/engine/cultivation/plague.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { PILLS } from '../../../src/data/cultivation/pills.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { sendHouseMission, advancePublicCapitalMission } from '../../../src/engine/world/capital-missions-and-calendar.js';

function village(seed: number) {
    const world = createWorld({ seed: `named-plague-${seed}`, regionCount: 0, skipPriorAges: true });
    const home = makeLocation({ id: 'village', name: 'The village', kind: 'settlement' });
    world.locations.push(home);
    for (let i = 0; i < 32; i++) {
        const person = createNpc(world.seed, { id: `resident-${i}`, name: `Resident ${i}`, locationId: home.id,
            onDay: 0, bornOnDay: -30 * 365, spiritStones: 100, cultivation: { realmOrdinal: 0 } });
        person.activity = null; world.npcs.push(person);
    }
    const deity = REALM_TIERS.find(realm => realm.key === 'deity_transformation')!.ordinalStart;
    const immune = createNpc(world.seed, { id: 'immune-resident', name: 'The immune resident', locationId: home.id,
        onDay: 0, bornOnDay: -30 * 365, cultivation: { realmOrdinal: deity } });
    immune.activity = null; world.npcs.push(immune);
    return { world, home };
}

it('an actual outbreak strikes named mortal bodies and leaves the body that no longer eats immune', () => {
    const h = village(0), outbreak = beginPlagueOutbreak(h.world, h.home.id, 0)!;
    expect(plagueHere(h.world, h.home.id, 0)?.id).toBe(outbreak.id);
    const stricken = h.world.npcs.filter(person => activePlague(person.cultivation, 0));
    expect(stricken.length).toBeGreaterThan(0); expect(stricken.length).toBeLessThanOrEqual(8);
    expect(h.world.npcs.find(person => person.id === 'immune-resident')!.cultivation.plague).toBeUndefined();
    for (const person of stricken) {
        expect(person.cultivation.hp).toBeLessThan(maxBodyOf(person));
        expect(h.world.history.facts.some(fact => fact.data.plagueInfection === true && fact.actors.some(actor => actor.id === person.id))).toBe(true);
    }
    expect(beginPlagueOutbreak(h.world, h.home.id, 1)?.id).toBe(outbreak.id);
});

it('ordinary advancement reaches a sampled named plague death on its actual date and settles the estate once', () => {
    let proved = false;
    for (let seed = 0; seed < 32; seed++) {
        const h = village(seed);
        beginPlagueOutbreak(h.world, h.home.id, 0);
        const person = h.world.npcs.find(person => person.cultivation.plague?.fatalOnDay !== null && person.cultivation.plague?.fatalOnDay !== undefined);
        if (!person) continue;
        const date = person.cultivation.plague!.fatalOnDay!;
        h.world.objects.push(makeObject({ id: 'their-keepsake', name: 'Their keepsake', kind: 'other',
            ownerId: person.id, possessorId: person.id, locationId: h.home.id }));
        const result = advanceWorldForPlay(h.world, { days: date });
        const ended = h.world.npcs.find(row => row.id === person.id);
        expect(ended?.status).not.toBe('alive');
        if (ended) { expect(ended.status).toBe('physically_dead'); expect(ended.diedOnDay).toBe(date); expect(ended.spiritStones).toBe(0); }
        expect(h.world.objects.find(object => object.id === 'their-keepsake')!.possessorId).not.toBe(person.id);
        expect(result.deaths.some(death => death.deceasedId === person.id && death.onDay === date)).toBe(true);
        const death = result.pressure.filter(event => event.fact.data.plagueDeath === true && event.fact.actors.some(actor => actor.id === person.id));
        expect(death).toHaveLength(1); expect(death[0].fact.summary).toContain(person.name);
        const retained = h.world.history.facts.filter(fact => fact.data.plagueDeath === true && fact.actors.some(actor => actor.id === person.id)).length;
        settleNativePlague(h.world, person.id, date + 1);
        expect(h.world.history.facts.filter(fact => fact.data.plagueDeath === true && fact.actors.some(actor => actor.id === person.id))).toHaveLength(retained);
        proved = true; break;
    }
    expect(proved).toBe(true);
});

it('an actual medicine dose treats a named patient, spends one unit and prevents the pending death', () => {
    const h = village(20);
    beginPlagueOutbreak(h.world, h.home.id, 0);
    const person = h.world.npcs.find(person => activePlague(person.cultivation, 0))!;
    const pill = PILLS.find(pill => pill.effect === 'treat_injury' && pill.grade === 'mortal')!;
    h.world.objects.push(makeObject({ id: 'medicine', name: pill.name, kind: 'pill', ownerId: person.id,
        possessorId: person.id, data: { pillId: pill.id, quantity: 2 } }));
    expect(treatNativePlagueWithMedicine(h.world, person.id, person.id, 1)).toBe(true);
    expect(activePlague(h.world.npcs.find(row => row.id === person.id)!.cultivation, 1)).toBeNull();
    expect(h.world.objects.find(object => object.id === 'medicine')!.data.quantity).toBe(1);
    expect(treatNativePlagueWithMedicine(h.world, person.id, person.id, 1)).toBe(false);
    advanceWorldForPlay(h.world, { days: 16 });
    expect(h.world.npcs.find(row => row.id === person.id)!.status).toBe('alive');
});

it('a reached provider decides whether to give its own medicine and an actual gift leaves the ordinary favour', () => {
    let gave = 0, kept = 0;
    for (let seed = 0; seed < 64; seed++) {
        const h = village(seed);
        beginPlagueOutbreak(h.world, h.home.id, 0);
        const patient = h.world.npcs.find(person => activePlague(person.cultivation, 0))!;
        const healer = createNpc(h.world.seed, { id: `provider-${seed}`, name: 'The medicine provider', locationId: h.home.id,
            occupation: 'physician', onDay: 0, bornOnDay: -30 * 365, spiritStones: 100,
            cultivation: { realmOrdinal: 13 } });
        healer.activity = null; h.world.npcs.push(healer);
        const area = theAreasOf(h.world, h.home).whereIs.get(patient.id)!;
        for (const id of [patient.id, healer.id]) h.world.npcs.find(person => person.id === id)!.activity = {
            kind: 'talking', note: 'At the medicine consultation.', standingIn: area, sinceDay: 0, untilDay: 2, withIds: [] };
        const pill = PILLS.find(pill => pill.effect === 'treat_injury' && pill.grade === 'mortal')!;
        h.world.objects.push(makeObject({ id: 'medicine', name: pill.name, kind: 'pill', ownerId: healer.id,
            possessorId: healer.id, data: { pillId: pill.id } }));
        if (seekNativePlagueMedicine(h.world, patient.id, 1)) {
            gave++;
            expect(h.world.objects[0].data.spent).toBe(true);
            expect(h.world.obligations.some(word => word.kind === 'favor' && word.holderId === healer.id && word.subjectId === patient.id)).toBe(true);
        } else { kept++; expect(h.world.objects[0].possessorId).toBe(healer.id); }
    }
    expect(gave).toBeGreaterThan(0); expect(kept).toBeGreaterThan(0);
});

it('the actual returning itinerary carries contagion to the destination without moving anyone in advance', () => {
    const h = village(40);
    beginPlagueOutbreak(h.world, h.home.id, 0);
    const person = h.world.npcs.find(person => activePlague(person.cultivation, 0))!;
    person.activity = null;
    const destination = makeLocation({ id: 'destination', name: 'The next town', kind: 'settlement' });
    linkLocations(h.home, destination, 'road', 2); h.world.locations.push(destination);
    const trip = sendHouseMission(h.world, null, destination, [person], 'a private journey', 0, { days: 1 },
        undefined, undefined, undefined, { leaderId: person.id, privateVenture: false }, person)!;
    expect(trip).not.toBeNull();
    expect(plagueHere(h.world, destination.id, 0)).toBeNull();
    advancePublicCapitalMission(h.world, person.id, Number(trip.data.publicServiceEnd));
    const outbreak = h.world.statuses.find(status => status.kind === 'plague' && status.areaId === destination.id)!;
    expect(outbreak, JSON.stringify({ phase: h.world.npcs.find(row => row.id === person.id)?.activity,
        arrivalFacts: h.world.history.facts.filter(fact => fact.data.actualBodyArrival).map(fact => ({ day: fact.day, data: fact.data })) })).toBeDefined();
    expect(outbreak.beganOnDay).toBeGreaterThan(0);
    expect(h.world.history.facts.some(fact => fact.data.actualBodyArrival === true && fact.data.bodyId === person.id
        && fact.day === outbreak.beganOnDay && fact.locationId === destination.id)).toBe(true);
});

it('the real annual producer can begin outbreaks at actual populated settlements', () => {
    let begun = 0;
    for (let seed = 0; seed < 160; seed++) {
        const h = village(seed);
        plagueOutbreaksThisYear(h.world, 0, 65.5);
        begun += h.world.statuses.filter(status => status.kind === 'plague').length;
    }
    expect(begun).toBeGreaterThan(0);
});
