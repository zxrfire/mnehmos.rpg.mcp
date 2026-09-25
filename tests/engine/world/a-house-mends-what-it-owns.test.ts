/**
 * A house mends what it owns that was holed, once a year, for material.
 *
 * Owner ruling 2026-09-25: houses close holes in their yearly pass, out of the
 * material they hold, and a house without it leaves the thing holed. Things are
 * taken in the order the world holds them while material lasts.
 */

import { describe, expect, it } from 'vitest';
import { isBroken, isHoled } from '../../../src/engine/world/object-damage.js';
import { makeObject, type ObjectRecord } from '../../../src/engine/world/possessions.js';
import { housesMendWhatTheyOwn } from '../../../src/engine/world/a-house-mends-what-it-owns.js';
import { makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { whatMendingAHoleTakes, whatWouldFill } from '../../../src/data/cultivation/what-an-artifact-is-made-of.js';

const SLOT = whatMendingAHoleTakes('earth')![0]!;
const MATERIAL = whatWouldFill(SLOT)[0]!;

function aHouse(opts: {
    handAt: number; pieces: number; scars?: number; tags?: string[]; carriedBy?: string;
}): WorldState {
    const scars = opts.scars ?? 1;
    const objects: ObjectRecord[] = [
        makeObject({
            id: 'blade', name: 'the house blade', kind: 'artifact', power: 18 - scars,
            ownerId: 'house', ownerName: 'the House', possessorId: opts.carriedBy ?? null,
            tags: opts.tags ?? ['damaged', 'holed'],
            data: { grade: 'earth', scars, ratedWhole: 18 }
        })
    ];
    if (opts.pieces > 0) {
        objects.push(makeObject({
            id: 'stock', name: `${opts.pieces} ${MATERIAL.name}`, kind: 'material',
            ownerId: 'house', ownerName: 'the House', possessorId: null,
            data: { materialId: MATERIAL.id, quantity: opts.pieces, resource: MATERIAL.name }
        }));
    }
    return {
        factions: [makeFaction({ id: 'house', name: 'the House' })],
        npcs: [{ id: 'elder', name: 'Elder Wu', status: 'alive', factionId: 'house', cultivation: { realmOrdinal: opts.handAt } }],
        objects
    } as unknown as WorldState;
}

const blade = (state: WorldState) => state.objects.find(o => o.id === 'blade')!;
const stock = (state: WorldState) => state.objects.find(o => o.id === 'stock');

describe('a house mends what it owns, out of its own stores', () => {
    it('closes a hole and takes one piece that fills the first slot of the grade\'s recipe', () => {
        const state = aHouse({ handAt: 20, pieces: 2 });
        expect(housesMendWhatTheyOwn(state, 400)).toBe(1);
        expect(isHoled(blade(state))).toBe(false);
        expect(blade(state).power).toBe(18);
        expect(stock(state)!.data.quantity).toBe(1);
        expect(stock(state)!.name).toBe(`1 ${MATERIAL.name}`);
    });

    it('closes as many holes as it has pieces for, and leaves the rest open', () => {
        const state = aHouse({ handAt: 20, pieces: 1, scars: 2 });
        expect(housesMendWhatTheyOwn(state, 400)).toBe(1);
        expect(isHoled(blade(state))).toBe(true);
        expect(blade(state).power).toBe(17);
    });

    it('leaves it holed when the stores hold nothing that fills the slot', () => {
        const state = aHouse({ handAt: 20, pieces: 0 });
        expect(housesMendWhatTheyOwn(state, 400)).toBe(0);
        expect(isHoled(blade(state))).toBe(true);
    });

    it('leaves it holed, and spends nothing, when nobody in the house reaches its rung', () => {
        const state = aHouse({ handAt: 17, pieces: 2 });
        expect(housesMendWhatTheyOwn(state, 400)).toBe(0);
        expect(isHoled(blade(state))).toBe(true);
        expect(stock(state)!.data.quantity).toBe(2);
    });

    it('does not reach a thing out of its hands, which waits until it is back', () => {
        const state = aHouse({ handAt: 20, pieces: 2, carriedBy: 'somebody-it-was-lent-to' });
        expect(housesMendWhatTheyOwn(state, 400)).toBe(0);
        expect(isHoled(blade(state))).toBe(true);
        expect(stock(state)!.data.quantity).toBe(2);
    });

    it('does not mend a broken thing, and spends nothing on it', () => {
        const state = aHouse({ handAt: 30, pieces: 2, scars: 3, tags: ['damaged', 'broken'] });
        expect(housesMendWhatTheyOwn(state, 400)).toBe(0);
        expect(isBroken(blade(state))).toBe(true);
        expect(stock(state)!.data.quantity).toBe(2);
    });
});
