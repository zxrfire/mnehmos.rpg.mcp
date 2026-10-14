/**
 * The yearly care pass treated wounds by spending a house purse and reading
 * medicine grade from its power, without a dose, a seller or a transaction.
 * The 2026-10-10 buying ruling requires actual medicine: wealth alone cannot
 * close a wound. Natural recovery retains its own rate, and a held dose still
 * works in a house without an institutional alchemy room.
 * House doses also need physical delivery: a member away from home cannot
 * swallow a pill still kept by the house, but can use medicine they carry.
 */
import { describe, expect, it } from 'vitest';
import { PILLS } from '../../../src/data/cultivation/pills.js';
import type { Injury } from '../../../src/schema/cultivation.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { woundsCloseThisYear } from '../../../src/engine/world/what-a-house-does-about-its-people-being-hurt.js';

function woundedHouse(severity: Injury['severity']) {
    const state = createWorld({ seed: 'care-needs-actual-medicine', regionCount: 0, skipPriorAges: true });
    const house = makeFaction({ id: 'house', name: 'Reed House', seatLocationId: 'seat',
        resources: { spirit_stones: 100_000, power_ordinal: 30 } });
    state.factions.push(house);
    state.locations.push(makeLocation({ id: 'seat', name: 'Reed Grounds', kind: 'sect_seat' }),
        makeLocation({ id: 'quarters', name: 'Quarters', kind: 'hall',
            data: { factionId: house.id, purpose: 'dormitory' } }));
    const member = setRealm(createNpc(state.seed, { id: 'member', bornOnDay: -7300, onDay: 0,
        locationId: 'seat', factionId: house.id }), 0, 0);
    const injury: Injury = { id: 'tear', severity, source: 'combat', description: 'A torn meridian.',
        sustainedOnTurn: 0, treated: false, cultivationPenalty: 0.1, breakthroughPenalty: 0.05,
        woundType: null };
    member.cultivation.injuries = [injury];
    member.cultivation.untreatedInjuries = 1;
    state.npcs.push(member);
    return { state, house, member };
}

describe('a house spends actual medicine on its wounded', () => {
    it('does not turn a funded purse into an unrecorded treatment purchase', () => {
        const h = woundedHouse('serious');
        const care = woundsCloseThisYear(h.state, 1, 365);
        expect(care.seenTo).toBe(0);
        expect(care.spent).toBe(0);
        expect(care.fromTheShelf).toBe(0);
        expect(care.swallowed).toBe(0);
        expect(h.house.resources.spirit_stones).toBe(100_000);
        expect(h.state.objects).toEqual([]);
    });

    it('keeps a crippling wound open when the wealthy house holds no medicine', () => {
        const h = woundedHouse('crippling');
        const care = woundsCloseThisYear(h.state, 1, 365);
        expect(h.state.npcs.find(n => n.id === h.member.id)!.cultivation.injuries[0]!.treated).toBe(false);
        expect(care.closedOnTheirOwn).toBe(0);
        expect(h.house.resources.spirit_stones).toBe(100_000);
    });

    it('spends a real held dose without requiring an alchemy hall', () => {
        const h = woundedHouse('crippling');
        const pill = PILLS.find(p => p.effect === 'treat_injury' && p.grade === 'heaven')!;
        h.state.objects.push(makeObject({ id: 'real-dose', name: pill.name, kind: 'pill',
            ownerId: h.house.id, possessorId: h.house.id,
            tags: [`grade:${pill.grade}`], data: { pillId: pill.id } }));
        const care = woundsCloseThisYear(h.state, 1, 365);
        expect(care.swallowed).toBe(1);
        expect(h.state.npcs.find(n => n.id === h.member.id)!.cultivation.injuries[0]!.treated).toBe(true);
        expect(h.state.objects.find(row => row.id === 'real-dose')!.data.spent).toBe(true);
        expect(h.house.resources.spirit_stones).toBe(100_000);
    });

    it('does not send a house-held dose to a member on other ground', () => {
        const h = woundedHouse('crippling');
        h.state.locations.push(makeLocation({ id: 'town', name: 'Market Town', kind: 'settlement' }));
        h.member.locationId = 'town';
        const pill = PILLS.find(p => p.effect === 'treat_injury' && p.grade === 'heaven')!;
        h.state.objects.push(makeObject({ id: 'home-dose', name: pill.name, kind: 'pill',
            ownerId: h.house.id, possessorId: h.house.id, locationId: 'quarters',
            tags: [`grade:${pill.grade}`], data: { pillId: pill.id } }));
        const care = woundsCloseThisYear(h.state, 1, 365);
        expect(care.swallowed).toBe(0);
        expect(h.state.npcs.find(n => n.id === h.member.id)!.cultivation.injuries[0]!.treated).toBe(false);
        expect(h.state.objects.find(row => row.id === 'home-dose')!.data.spent).not.toBe(true);
    });

    it('lets an absent member use the dose actually in their own hand', () => {
        const h = woundedHouse('crippling');
        h.state.locations.push(makeLocation({ id: 'town', name: 'Market Town', kind: 'settlement' }));
        h.member.locationId = 'town';
        const pill = PILLS.find(p => p.effect === 'treat_injury' && p.grade === 'heaven')!;
        h.state.objects.push(makeObject({ id: 'carried-dose', name: pill.name, kind: 'pill',
            ownerId: h.member.id, possessorId: h.member.id,
            tags: [`grade:${pill.grade}`], data: { pillId: pill.id } }));
        const care = woundsCloseThisYear(h.state, 1, 365);
        expect(care.swallowed).toBe(1);
        expect(h.state.npcs.find(n => n.id === h.member.id)!.cultivation.injuries[0]!.treated).toBe(true);
        expect(h.state.objects.find(row => row.id === 'carried-dose')!.data.spent).toBe(true);
    });
});
