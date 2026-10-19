/** Certification's area-occupancy 500-year checkpoint held two Thunder Hawk
 * Cores with the same id and material-hunt provenance (day 453032.2). Collection
 * length is reusable when stock is consumed. A later return must remain a
 * separate object even when another row disappeared. The same defect affected
 * reissued clothes when an earlier set disappeared between issuings. */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { landSuccessfulHouseWork } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { getSendingReason } from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { theClothesTheyStandUpIn } from '../../../src/engine/world/what-somebody-stands-up-in.js';

it('keeps both material-hunt returns distinct after unrelated stock disappears', () => {
    const state = createWorld({ seed: 'shrinking-stock', skipPriorAges: true, regionCount: 0 });
    const house = makeFaction({ id: 'house', name: 'A House', seatLocationId: 'yard' });
    const disposable = makeObject({ id: 'consumed', name: 'a dose', kind: 'pill' });
    state.objects.push(disposable);
    const reason = getSendingReason('sending-for-materials')!;
    const party = [{ id: 'hunter', name: 'Hunter', ordinal: 35 }];
    landSuccessfulHouseWork(state, house, reason, party, null, 10);
    const first = state.objects.find(object => object.ownerId === house.id)!;
    state.objects.splice(state.objects.indexOf(disposable), 1);
    landSuccessfulHouseWork(state, house, reason, party, null, 10);
    expect(state.objects).toHaveLength(2);
    expect(new Set(state.objects.map(object => object.id)).size).toBe(2);
    expect(state.objects[0]).toEqual(first);
    expect(state.objects.every(object => object.provenance[0]?.source === 'returned from a material hunt')).toBe(true);
});

it('reissues clothes without aliasing a surviving set after an older set disappears', () => {
    const input = { personId: 'wearer', personName: 'Wearer', onDay: 10 };
    const first = theClothesTheyStandUpIn(input);
    const second = theClothesTheyStandUpIn({ ...input, among: [first] });
    const third = theClothesTheyStandUpIn({ ...input, among: [second] });
    expect(third.id).not.toBe(second.id);
});
