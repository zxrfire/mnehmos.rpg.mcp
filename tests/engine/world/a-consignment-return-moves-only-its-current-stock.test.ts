/**
 * Live census profile census-live-20261003-01 measured consignment return at
 * .792s inclusive/.501s self of 12.736s. Reusing its per-call matched indices
 * must return only this carrier's marked goods owned by this house, preserve
 * other goods, conserve the purse, and observe newly held stock on a later call.
 */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { returnExchangeConsignment } from '../../../src/engine/world/wares-at-a-capital-exchange.js';

it('returns the actual marked house load and reads new stock on the next stint', () => {
    const state = createWorld({ seed: 'return-current-load', regionCount: 0, skipPriorAges: true });
    const house = makeFaction({ id: 'house', name: 'House', seatLocationId: 'seat', resources: { spirit_stones: 100 } });
    state.factions.push(house);
    const seller = { ...setRealm(createNpc(state.seed, { id: 'npc-90003', locationId: 'seat', onDay: 0, bornOnDay: -30 * 365 }), 8, 0), factionId: house.id, spiritStones: 17 };
    state.npcs.push(seller);
    const row = (id: string, ownerId: string, possessorId: string, exchange = true) => makeObject({ id, name: id, kind: 'other', ownerId, possessorId, locationId: 'venue', tags: exchange ? ['exchange'] : [] });
    const otherOwner = row('other-owner', 'another-house', seller.id);
    const own = row('current-load', house.id, seller.id);
    const otherCarrier = row('other-carrier', house.id, 'somebody-else');
    const unmarked = row('unmarked', house.id, seller.id, false);
    state.objects.push(otherOwner, own, otherCarrier, unmarked);
    returnExchangeConsignment(state, seller, 10, 0);
    const returned = state.objects.find(o => o.id === own.id)!;
    expect(returned.possessorId).toBeNull();
    expect(returned.ownerId).toBe(house.id);
    expect(returned.locationId).toBe(house.seatLocationId);
    expect(returned.provenance.map(p => p.how)).toEqual(['lent']);
    for (const before of [otherOwner, otherCarrier, unmarked]) expect(state.objects.find(o => o.id === before.id)).toEqual(before);
    expect(Number(house.resources.spirit_stones) + state.npcs[0]!.spiritStones).toBe(117);
    returnExchangeConsignment(state, state.npcs[0]!, 11, 0);
    expect(state.objects.find(o => o.id === own.id)!.provenance).toHaveLength(1);
    const newlyHeld = row('later-load', house.id, seller.id);
    state.objects.push(newlyHeld);
    returnExchangeConsignment(state, state.npcs[0]!, 20, 12);
    expect(state.objects.find(o => o.id === newlyHeld.id)!.possessorId).toBeNull();
    expect(state.objects.find(o => o.id === newlyHeld.id)!.locationId).toBe(house.seatLocationId);
    expect(Number(house.resources.spirit_stones) + state.npcs[0]!.spiritStones).toBe(117);
});
