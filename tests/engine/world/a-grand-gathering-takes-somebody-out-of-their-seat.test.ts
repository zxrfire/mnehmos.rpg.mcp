/**
 * A gathering of powers is one of the reasons a head or an elder is not at home.
 *
 * Every gathering in this world was drawn from `chosenOf`, so for two thousand
 * years the seniors of every house stood at their own seats while their juniors
 * went out to meet each other. `aGrandGatheringOfPowers` is the outing the
 * design owner's list has on it, built where gatherings already are: where the
 * circle's host stands at Core Formation or above, each house sends the deepest
 * person standing at home, on a `travelling` term their own seat closes.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../../src/data/cultivation/sects.js';
import { elderRungOf } from '../../../src/engine/cultivation/leadership.js';
import {
    A_GATHERING_OF_POWERS_STANDS_AT,
    A_SENIOR_IS_AWAY_FOR_DAYS,
    aGrandGatheringOfPowers,
    type Circle
} from '../../../src/engine/world/gatherings.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { PLAYER_ROW_TAG, createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { createWorld, makeFaction, type FactionRecord, type WorldState } from '../../../src/engine/world/world-state.js';

const HOUSE = SECTS.find(s => s.id === 'sect-azure-cloud-pavilion')!;
const DAY = 700 * 365;

function member(id: string, houseId: string, rank: number, ordinal: number, tags: string[] = []): NpcRecord {
    const npc = createNpc('powers', { id, bornOnDay: DAY - 365 * 200, onDay: DAY, locationId: `seat-${houseId}` });
    return { ...setRealm(npc, ordinal, DAY), factionId: houseId, factionRankIndex: rank, activity: null, tags };
}

function house(id: string, power: number): FactionRecord {
    return makeFaction({
        id, name: id, ranks: HOUSE.ranks.slice(), seatLocationId: `seat-${id}`, foundedOnDay: 0,
        resources: { spirit_stones: 400_000, admission_ordinal: 4, power_ordinal: power }
    });
}

function world(power: number): WorldState {
    const state = createWorld({ seed: 'powers', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' }));
    for (const id of ['host', 'guest']) {
        state.locations.push(makeLocation({ id: `seat-${id}`, name: `${id} seat`, kind: 'sect_seat', parentId: 'loc-region' }));
        state.factions.push(house(id, power));
        const elder = elderRungOf(HOUSE.ranks.length);
        state.npcs.push(
            member(`${id}-head`, id, HOUSE.ranks.length - 1, 30),
            member(`${id}-elder`, id, elder, 24),
            member(`${id}-disciple`, id, 1, 12)
        );
    }
    return state;
}

const circleOf = (state: WorldState): Circle => ({
    host: state.factions[0]!,
    members: state.factions.slice()
});

describe('a grand gathering of powers', () => {
    it('takes the deepest person of each house out of their own seat, on a term', () => {
        const state = world(A_GATHERING_OF_POWERS_STANDS_AT + 8);
        const went = aGrandGatheringOfPowers(state, circleOf(state), state.factions, 'seat-host', DAY);
        expect(went.map(n => n.id)).toContain('guest-head');
        const away = state.npcs.find(n => n.id === 'guest-head')!;
        expect(away.locationId).toBe('seat-host');
        expect(away.activity?.kind).toBe('travelling');
        expect(away.activity?.returnTo).toBe('seat-guest');
        expect(away.activity?.untilDay).toBe(DAY + A_SENIOR_IS_AWAY_FOR_DAYS);
        // Not the disciples: they are who a gathering was already drawing on.
        expect(went.some(n => n.id.endsWith('disciple'))).toBe(false);
    });

    it('takes nobody where the circle does not stand high enough', () => {
        const state = world(A_GATHERING_OF_POWERS_STANDS_AT - 1);
        expect(aGrandGatheringOfPowers(state, circleOf(state), state.factions, 'seat-host', DAY)).toHaveLength(0);
    });

    it('never takes the player, and never somebody already away', () => {
        const state = world(A_GATHERING_OF_POWERS_STANDS_AT + 8);
        const at = state.npcs.findIndex(n => n.id === 'guest-head');
        state.npcs[at] = { ...state.npcs[at]!, tags: [PLAYER_ROW_TAG] };
        const busy = state.npcs.findIndex(n => n.id === 'guest-elder');
        state.npcs[busy] = {
            ...state.npcs[busy]!,
            activity: {
                kind: 'stationed', note: 'On a watch.', withIds: [],
                sinceDay: DAY - 100, untilDay: DAY + 100, returnTo: 'seat-guest'
            }
        };
        const went = aGrandGatheringOfPowers(state, circleOf(state), state.factions, 'seat-host', DAY);
        expect(went.some(n => n.id === 'guest-head')).toBe(false);
        expect(went.some(n => n.id === 'guest-elder')).toBe(false);
    });
});
