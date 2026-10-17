/**
 * Private close company could visit a ruin or a road but never undertake a
 * hunt. NPC-only hunts now spend the original personal itinerary, resolve real
 * melee bodies and pick up actual materials. No house, merit or contribution
 * is introduced. These are native controls; player admission/following and its
 * foreground fight still depend on transport's separate 130/131 adapter.
 * A native500-year composition found three hunt-ending facts missing from
 * hunters' careers. Returning pre-receipt survivor rows let the continuation
 * restore those stale careers. Returned survivors must carry their ending.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, upsertRelationship, woundsCarriedBy, maxBodyOf } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { formPrivateParty, closePeopleThisYear } from '../../../src/engine/world/close-people-go-together.js';
import { advancePublicCapitalMission } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { finishPrivatePartyHunt } from '../../../src/engine/world/private-party-hunt.js';
import { HUNTING_DAYS } from '../../../src/engine/world/hunting-a-spirit-beast.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';

function arrangement(seed: number, ordinal = 18) {
    const world = createWorld({ seed: `private-hunt-${seed}`, regionCount: 0, skipPriorAges: true });
    const home = makeLocation({ id: 'home', name: 'Home', kind: 'wilds' });
    const ground = makeLocation({ id: 'hunt-ground', name: 'The hunting ground', kind: 'wilds',
        thresholds: { entry: 0, survival: 0, operational: 0, mastery: 0 } });
    linkLocations(home, ground, 'road', 2); world.locations.push(home, ground);
    for (const id of ['leader', 'friend']) {
        const person = createNpc(world.seed, { id, name: id === 'leader' ? 'The leader' : 'The close friend',
            locationId: home.id, bornOnDay: -30 * 365, onDay: 0, spiritStones: 10000,
            cultivation: { realmOrdinal: ordinal } });
        person.activity = null; world.npcs.push(person);
    }
    world.npcs = world.npcs.map(person => upsertRelationship(person, { targetId: person.id === 'leader' ? 'friend' : 'leader',
        targetName: person.id === 'leader' ? 'The close friend' : 'The leader', kind: 'acquaintance', standing: 0.9 }, 0));
    const area = theAreasOf({ ...world, currentHour: 12 }, home).whereIs.get('leader')!;
    for (const person of world.npcs) person.activity = { kind: 'talking', withIds: [], note: 'Planning together.',
        sinceDay: 0, untilDay: 0.5, standingIn: area };
    return { world, home, ground };
}

it('willing close people hunt through their actual personal itinerary and keep each real pickup', () => {
    let went = 0, took = 0;
    for (let seed = 0; seed < 32; seed++) {
        const h = arrangement(seed);
        const party = formPrivateParty(h.world, 'leader', h.ground, ['friend'], 0.5, undefined, 'hunt');
        if (!party) continue;
        went++;
        expect(party.factionIds).toEqual([]);
        expect(party.data.publicServiceDays).toBe(HUNTING_DAYS);
        const held = h.world.npcs.find(person => person.id === 'leader')!.spiritStones;
        advancePublicCapitalMission(h.world, 'leader', Number(party.data.publicServiceEnd));
        const result = h.world.history.facts.find(fact => fact.data.privateHuntResolved === party.id)!;
        expect(result).toBeDefined();
        const finds = h.world.history.facts.filter(fact => fact.data.privatePartyFind === result.id);
        took += finds.length;
        for (const find of finds) {
            const object = h.world.objects.find(object => object.id === find.data.objectId)!;
            expect(['leader', 'friend']).toContain(object.possessorId);
            expect(object.ownerId).toBe(object.possessorId);
            expect(find.actors.some(actor => actor.role === 'finder' && actor.id === object.possessorId)).toBe(true);
        }
        const count = h.world.objects.length;
        advancePublicCapitalMission(h.world, 'leader', Number(party.data.publicServiceEnd));
        expect(h.world.objects.length).toBe(count);
        expect(h.world.npcs.find(person => person.id === 'leader')!.spiritStones).toBe(held);
        expect(h.world.history.facts.some(fact => fact.data.privateFindAllocation)).toBe(false);
        expect(h.world.obligations.some(word => word.tags.includes('house-merit'))).toBe(false);
    }
    expect(went).toBeGreaterThan(0); expect(took).toBeGreaterThan(0);
});

it('a wounded hunter risks their actual body and named ending through the common confrontation writer', () => {
    let consequences = 0;
    for (let seed = 0; seed < 32; seed++) {
        const h = arrangement(seed, 0), day = 10;
        for (const person of h.world.npcs) {
            person.locationId = h.ground.id;
            person.cultivation.hp = 1; person.cultivation.bodyOnDay = day;
        }
        const mission = appendWorldFact(h.world, makeFact({ day: 0, kind: 'gathering', visibility: 'secret', locationId: h.home.id,
            actors: [], summary: 'An explicit native hunt arrangement.',
            data: { privateHunt: true, leaderId: 'leader', destinationId: h.ground.id } }));
        finishPrivatePartyHunt(h.world, mission, h.world.npcs.slice(), h.ground, day);
        for (const person of h.world.npcs.filter(person => ['leader', 'friend'].includes(person.id)))
            if (person.status !== 'alive' || woundsCarriedBy(person).length) consequences++;
        for (const fact of h.world.history.facts.filter(fact => fact.kind === 'death'))
            expect(fact.actors.some(actor => actor.role === 'victim' && h.world.npcs.some(person => person.id === actor.id))).toBe(true);
    }
    expect(consequences).toBeGreaterThan(0);
});

it('returns surviving hunters with the ending already linked to their careers', () => {
    let returned = 0;
    for (let seed = 0; seed < 16; seed++) {
        const h = arrangement(seed), day = 10;
        for (const person of h.world.npcs) {
            person.locationId = h.ground.id;
            person.cultivation.hp = maxBodyOf(person); person.cultivation.bodyOnDay = day;
        }
        const mission = appendWorldFact(h.world, makeFact({ day: 0, kind: 'gathering', visibility: 'secret',
            summary: 'A healthy private party set out.', data: { privateHunt: true, leaderId: 'leader' } }));
        const survivors = finishPrivatePartyHunt(h.world, mission, h.world.npcs.slice(), h.ground, day);
        const ending = h.world.history.facts.find(fact => fact.data.privateHuntResolved === mission.id)!;
        expect(ending).toBeDefined();
        for (const survivor of survivors) expect(survivor.historyFactIds).toContain(ending.id);
        returned += survivors.length;
    }
    expect(returned, 'the return assertion must inspect actual surviving hunters').toBeGreaterThan(0);
});

it('the rate producer actually chooses a known private hunt without a house', () => {
    let hunts = 0;
    for (let seed = 0; seed < 160; seed++) {
        const h = arrangement(seed), day = 60.5;
        h.world.currentDay = 60; h.world.currentHour = 12;
        for (const person of h.world.npcs) person.activity = { ...person.activity!, untilDay: day };
        appendWorldFact(h.world, makeFact({ day: -1, kind: 'migration', visibility: 'secret', locationId: h.ground.id,
            actors: [{ id: 'leader', name: 'The leader', role: 'visitor' }], summary: 'The leader visited this hunting ground.' }));
        closePeopleThisYear(h.world, 0, day);
        hunts += h.world.history.facts.filter(fact => fact.data.privateHunt === true).length;
        expect(h.world.factions).toHaveLength(0);
    }
    expect(hunts).toBeGreaterThan(0);
});
