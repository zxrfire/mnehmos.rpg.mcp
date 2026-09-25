/**
 * No world pass moves the player's rank, in either direction.
 *
 * The play layer owns the player's rank, purse, body, arts and standing; the
 * world owns what other people think and what houses decide about everybody
 * else. A world pass that wrote `factionRankIndex` on the player's row would be
 * overwritten by the next end-of-turn refresh from the sect repository, so the
 * promotion or the demotion would vanish and the chronicle fact about it would
 * not - which is the shape `applyPromotions` was caught in once already.
 *
 * Three passes in this path can write a rank: `assessPromotions` /
 * `applyPromotions`, the conclave tournament, and taking an elder in from
 * outside. Each is asked here with a fixture where the player is the obvious
 * person to move.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../../src/data/cultivation/sects.js';
import { rankRealmBand } from '../../../src/data/cultivation/members.js';
import { elderRungOf } from '../../../src/engine/cultivation/leadership.js';
import {
    theConclaveRungOf,
    theConclavesAreContested,
    itsContestFallsIn
} from '../../../src/engine/world/a-conclave-seat-is-won-in-a-tournament.js';
import {
    theHousesTakeInEldersFromOutside
} from '../../../src/engine/world/a-house-takes-in-an-elder-from-outside.js';
import { whatAnInsiderMustStandAt, assessPromotions } from '../../../src/engine/world/promotion-inside-a-house.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { PLAYER_ROW_TAG, createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const HOUSE = SECTS.find(s => s.id === 'sect-azure-cloud-pavilion')!;
const RANKS = HOUSE.ranks.length;
const CONCLAVE = theConclaveRungOf(RANKS);
const ELDER = elderRungOf(RANKS);
const DAY = 500 * 365;

function person(id: string, rank: number, ordinal: number, tags: string[] = []): NpcRecord {
    const npc = createNpc('player-rank', { id, bornOnDay: DAY - 365 * 90, onDay: DAY, locationId: 'loc-seat' });
    return {
        ...setRealm(npc, ordinal, DAY),
        factionId: rank < 0 ? null : HOUSE.id,
        factionRankIndex: rank,
        activity: null,
        tags,
        merit: rank < 0 ? null : [{ houseId: HOUSE.id, points: 1_000_000 }]
    };
}

function world(people: NpcRecord[], rooms: string[] = ['treasury', 'archive', 'punishment_hall']): WorldState {
    const state = createWorld({ seed: 'players-rank', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' }));
    state.locations.push(makeLocation({ id: 'loc-seat', name: 'The Seat', kind: 'sect_seat', parentId: 'loc-region' }));
    for (const purpose of rooms) {
        state.locations.push(makeLocation({
            id: `room-${purpose}`, name: purpose, kind: 'hall', parentId: 'loc-seat',
            data: { factionId: HOUSE.id, purpose }
        }));
    }
    state.factions.push(makeFaction({
        id: HOUSE.id, name: HOUSE.name, ranks: HOUSE.ranks.slice(), seatLocationId: 'loc-seat', foundedOnDay: 0,
        resources: {
            spirit_stones: 10_000_000,
            admission_ordinal: HOUSE.admissionOrdinal, power_ordinal: HOUSE.powerOrdinal
        }
    }));
    state.npcs.push(...people);
    return state;
}

describe('the world never moves the player\'s rank', () => {
    it('does not raise them, however far past the bar and the merit they stand', () => {
        const bar = rankRealmBand(HOUSE.id, CONCLAVE)!.minOrdinal;
        const state = world([
            person('head', RANKS - 1, HOUSE.powerOrdinal),
            ...Array.from({ length: 30 }, (_, i) => person(`inner-${i}`, CONCLAVE - 1, bar - 1)),
            person('player', CONCLAVE - 1, bar + 10, [PLAYER_ROW_TAG])
        ]);
        const { promotions, blocked } = assessPromotions(state);
        expect(promotions.some(p => p.npcId === 'player')).toBe(false);
        expect(blocked.some(b => b.npcId === 'player')).toBe(false);
    });

    it('does not enter them in the conclave contest, so it can neither seat nor unseat them', () => {
        const band = rankRealmBand(HOUSE.id, CONCLAVE)!;
        const people = [
            person('head', RANKS - 1, HOUSE.powerOrdinal),
            ...Array.from({ length: 40 }, (_, i) => person(`outer-${i}`, 0, HOUSE.admissionOrdinal)),
            ...Array.from({ length: 3 }, (_, i) => person(`holder-${i}`, CONCLAVE, band.minOrdinal)),
            ...Array.from({ length: 4 }, (_, i) => person(`rising-${i}`, CONCLAVE - 1, band.maxOrdinal)),
            // Standing at the very top of the band on both sides of the line:
            // the strongest challenger, and a holder nobody should be able to
            // beat out of their seat by a pass.
            person('player-rising', CONCLAVE - 1, band.maxOrdinal, [PLAYER_ROW_TAG])
        ];
        const state = world(people);
        let year = 500;
        while (!itsContestFallsIn(state.seed, state.factions[0]!, year)) year++;
        const settled = theConclavesAreContested(state, year, DAY);
        expect(settled.length).toBeGreaterThan(0);
        for (const row of settled) {
            expect(row.raised).not.toContain('player-rising');
            expect(row.stepped).not.toContain('player-rising');
        }
        expect(state.npcs.find(n => n.id === 'player-rising')!.factionRankIndex).toBe(CONCLAVE - 1);
    });

    it('does not take them in from outside, however well they would fill the chair', () => {
        const bar = whatAnInsiderMustStandAt(
            HOUSE.id, ELDER, RANKS, HOUSE.admissionOrdinal, HOUSE.powerOrdinal);
        const state = world([
            person('head', RANKS - 1, HOUSE.powerOrdinal),
            { ...person('player', -1, bar + 1, [PLAYER_ROW_TAG]), locationId: 'loc-seat' }
        ]);
        expect(theHousesTakeInEldersFromOutside(state, DAY)).toBe(0);
        const player = state.npcs.find(n => n.id === 'player')!;
        expect(player.factionId).toBeNull();
        expect(player.factionRankIndex).toBe(-1);
    });
});
