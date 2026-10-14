/**
 * Return settlement read every object twice for every homebound member, even
 * when that person carried no bought supplies. A transient cargo read can
 * share the existing consignment scan. Counted medicine disappears when put
 * on the shelf; finished gear must still reach the stores after those rows
 * are removed. Physical absence still prevents either delivery.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeObject, transferPossession } from '../../../src/engine/world/possessions.js';
import { mintAMadeThing } from '../../../src/engine/social-leverage/whether-the-work-holds.js';
import { PILLS } from '../../../src/data/cultivation/pills.js';
import { pillStorageModel } from '../../../src/engine/cultivation/buying-and-bartering-pills.js';
import { returnExchangeConsignment } from '../../../src/engine/world/wares-at-a-capital-exchange.js';
import { onTheShelf } from '../../../src/engine/world/house-wound-medicine.js';
function arrived() {
    const state = createWorld({ seed: 'actual-returning-cargo', regionCount: 0, skipPriorAges: true });
    const house = makeFaction({ id: 'reed-house', name: 'Reed House', seatLocationId: 'seat' });
    state.factions.push(house);
    state.locations.push(makeLocation({ id: 'seat', name: 'Reed Grounds', kind: 'sect_seat' }),
        makeLocation({ id: 'quarters', name: 'Quarters', kind: 'hall',
            data: { factionId: house.id, purpose: 'dormitory' } }));
    const factor = createNpc(state.seed, { id: 'actual-factor', bornOnDay: -7300, onDay: 0,
        factionId: house.id, locationId: 'seat' });
    state.npcs.push(factor);
    const pill = PILLS.find(p => p.effect === 'treat_injury' && pillStorageModel(p) === 'count')!;
    const medicine = makeObject({ id: 'carried-medicine', name: pill.name, kind: 'pill',
        ownerId: house.id, possessorId: factor.id, locationId: 'seat', tags: ['house-medicine-purchase'],
        data: { pillId: pill.id, quantity: 2 } });
    const gear = { ...transferPossession(mintAMadeThing({ id: 'carried-sabre',
        ask: { named: 'Reed sabre', grade: 'mortal' },
        maker: { id: factor.id, name: factor.name, ordinal: factor.cultivation.realmOrdinal }, onDay: 0 }),
        { onDay: 0, toHolderId: house.id, toHolderName: house.name, how: 'bought', transfersOwnership: true }),
        possessorId: factor.id, locationId: 'seat', tags: ['made', 'grade:mortal', 'house-artifact-purchase'] };
    state.objects.push(medicine, gear);
    return { state, house, factor, pill, medicine, gear };
}

describe('a returning factor unloads actual counted and tracked cargo', () => {
    for (const indexed of [false, true]) {
        it(indexed ? 'delivers both kinds after counted rows disappear from a shared cargo read'
            : 'retains the ordinary standalone return path', () => {
            const h = arrived();
            const medicineAt = h.state.objects.indexOf(h.medicine);
            const gearAt = h.state.objects.indexOf(h.gear);
            returnExchangeConsignment(h.state, h.factor, 1, 0, h.house.id, [],
                indexed ? [medicineAt, gearAt] : undefined);
            expect(onTheShelf(h.house, h.pill.id)).toBe(2);
            expect(h.state.objects.some(o => o.id === h.medicine.id)).toBe(false);
            const stored = h.state.objects.find(o => o.id === h.gear.id)!;
            expect(stored.ownerId).toBe(h.house.id);
            expect(stored.possessorId).toBeNull();
            expect(stored.locationId).toBe('quarters');
            expect(h.state.history.facts.filter(f => f.data.houseMedicineDelivery === true)).toHaveLength(1);
            expect(h.state.history.facts.filter(f => f.data.houseArtifactDelivery === true)).toHaveLength(1);
            returnExchangeConsignment(h.state, h.factor, 2, 0, h.house.id, [], []);
            expect(onTheShelf(h.house, h.pill.id)).toBe(2);
            expect(h.state.history.facts.filter(f => f.data.houseArtifactDelivery === true)).toHaveLength(1);
        });
    }

    it('keeps both kinds carried until the actual factor reaches home', () => {
        const h = arrived();
        h.factor.locationId = 'elsewhere';
        returnExchangeConsignment(h.state, h.factor, 1, 0, h.house.id, [],
            [h.state.objects.indexOf(h.medicine), h.state.objects.indexOf(h.gear)]);
        expect(onTheShelf(h.house, h.pill.id)).toBe(0);
        expect(h.state.objects.find(o => o.id === h.gear.id)!.possessorId).toBe(h.factor.id);
        expect(h.state.objects.some(o => o.id === h.medicine.id)).toBe(true);
        expect(h.state.history.facts.some(f => f.data.houseMedicineDelivery === true
            || f.data.houseArtifactDelivery === true)).toBe(false);
    });
});
