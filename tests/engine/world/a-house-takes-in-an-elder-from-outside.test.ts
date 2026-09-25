/**
 * An office the year's promotions left empty is filled from outside, by somebody
 * who clears the bar an insider is held to at that rung, and the treasury pays.
 *
 * The bar was once four ordinals higher for somebody from outside. The owner
 * ruled it back: *"it ought to be the same bar as internal elder, just
 * external."*
 *
 * See `a-house-takes-in-an-elder-from-outside.ts`.
 */

import { describe, expect, it } from 'vitest';

import { SECTS, stipendForRank } from '../../../src/data/cultivation/sects.js';
import { elderRungOf } from '../../../src/engine/cultivation/leadership.js';
import {
    TAKEN_IN_AS_AN_ELDER,
    theHousesTakeInEldersFromOutside,
    whatTakingInAnElderCosts
} from '../../../src/engine/world/a-house-takes-in-an-elder-from-outside.js';
import { makeLocation, type LocationRecord } from '../../../src/engine/world/locations.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { whatAnInsiderMustStandAt } from '../../../src/engine/world/promotion-inside-a-house.js';
import { GUEST_OF } from '../../../src/engine/world/the-wanderer-the-catalog-names-is-somebody.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const SECT = SECTS.find(s => s.recruits && s.ranks.length >= 5
    && stipendForRank(s.id, elderRungOf(s.ranks.length)) > 0)!;
const RUNG = elderRungOf(SECT.ranks.length);
const DAY = 400 * 365;
const BAR = whatAnInsiderMustStandAt(SECT.id, RUNG, SECT.ranks.length, SECT.admissionOrdinal, SECT.powerOrdinal);

function person(id: string, ordinal: number, over: Partial<NpcRecord> = {}): NpcRecord {
    const npc = setRealm(createNpc('outside-elder', { id, bornOnDay: DAY - 365 * 300, onDay: DAY, locationId: 'loc-town' }), ordinal, DAY);
    return { ...npc, activity: null, ...over };
}

function world(opts: { stones?: number; offices?: string[]; free?: NpcRecord[] } = {}): WorldState {
    const state = createWorld({ seed: 'outside-elder', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' }));
    state.locations.push(makeLocation({ id: 'loc-town', name: 'The Town', kind: 'settlement', parentId: 'loc-region' }));
    state.locations.push(makeLocation({ id: 'loc-far', name: 'Far Away', kind: 'region' }));
    state.locations.push(makeLocation({ id: 'loc-seat', name: 'The Seat', kind: 'sect_seat', parentId: 'loc-region' }));
    for (const purpose of opts.offices ?? ['treasury', 'archive', 'punishment_hall']) {
        state.locations.push(makeLocation({
            id: `room-${purpose}`, name: purpose, kind: 'hall', parentId: 'loc-seat',
            data: { factionId: SECT.id, purpose }
        }) as LocationRecord);
    }
    state.factions.push(makeFaction({
        id: SECT.id, name: SECT.name, ranks: SECT.ranks.slice(), seatLocationId: 'loc-seat', foundedOnDay: 0,
        resources: {
            spirit_stones: opts.stones ?? 10_000_000,
            admission_ordinal: SECT.admissionOrdinal, power_ordinal: SECT.powerOrdinal
        }
    }));
    const head = person('head', SECT.powerOrdinal, { factionId: SECT.id, factionRankIndex: SECT.ranks.length - 1, locationId: 'loc-seat' });
    state.npcs.push(head, ...(opts.free ?? []));
    return state;
}

describe('a house takes in an elder from outside', () => {
    it('fills an empty office with the strongest free person in its province at the elder bar', () => {
        const state = world({ free: [person('strong', BAR + 1), person('stronger', BAR + 2), person('short', BAR - 1)] });
        const before = state.factions[0]!.resources.spirit_stones!;
        expect(theHousesTakeInEldersFromOutside(state, DAY)).toBe(1);
        const taken = state.npcs.find(n => n.id === 'stronger')!;
        expect(taken.factionId).toBe(SECT.id);
        expect(taken.factionRankIndex).toBe(RUNG);
        expect(taken.locationId).toBe('loc-seat');
        expect(taken.merit ?? null).toBeNull();
        expect(taken.tags).toContain(`${TAKEN_IN_AS_AN_ELDER}${SECT.id}`);
        expect(state.factions[0]!.resources.spirit_stones).toBe(before - whatTakingInAnElderCosts(SECT.id, RUNG, 0)!);
        expect(state.history.facts.some(f => f.summary.includes('taken in from outside'))).toBe(true);
    });

    it('takes nobody who stands under the elder bar', () => {
        const state = world({ free: [person('under-the-bar', BAR - 1)] });
        expect(theHousesTakeInEldersFromOutside(state, DAY)).toBe(0);
    });

    it('takes a guest of the house before anybody stronger', () => {
        const state = world({
            free: [
                person('stranger', BAR + 5),
                person('guest', BAR, { tags: [`${GUEST_OF}${SECT.id}`], locationId: 'loc-far' })
            ]
        });
        expect(theHousesTakeInEldersFromOutside(state, DAY)).toBe(1);
        const guest = state.npcs.find(n => n.id === 'guest')!;
        expect(guest.factionId).toBe(SECT.id);
        expect(guest.tags).not.toContain(`${GUEST_OF}${SECT.id}`);
    });

    it('takes nobody from another province, and nothing a treasury cannot pay', () => {
        expect(theHousesTakeInEldersFromOutside(world({ free: [person('far', BAR + 3, { locationId: 'loc-far' })] }), DAY)).toBe(0);
        expect(theHousesTakeInEldersFromOutside(world({ stones: 1, free: [person('strong', BAR + 3)] }), DAY)).toBe(0);
    });

    it('takes nobody where every office has its own holder', () => {
        const state = world({ offices: ['treasury'], free: [person('strong', BAR + 3)] });
        expect(theHousesTakeInEldersFromOutside(state, DAY)).toBe(0);
    });

    it('costs more for every elder from outside the house already has', () => {
        expect(whatTakingInAnElderCosts(SECT.id, RUNG, 1)!).toBeGreaterThan(whatTakingInAnElderCosts(SECT.id, RUNG, 0)!);
    });
});
