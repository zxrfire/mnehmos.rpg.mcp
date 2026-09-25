/**
 * Three ways to have a thing: worn, held, or in your inventory. The owner: "so 3 states: held,
 * worn and inventory", weapons use held too, and a stolen thing that does not fit "would be in
 * your hand". And everything has a size, against what a body carries.
 */
import { describe, expect, it } from 'vitest';

import {
    aUniformFor,
    holdsTheRobesOf,
    wearsTheRobesOf
} from '../../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import {
    hadAs,
    howItIsHad,
    makeObject,
    transferPossession
} from '../../../src/engine/world/possessions.js';
import {
    howManyHeld,
    whatTheirThingsTake,
    whereItWouldGo
} from '../../../src/engine/world/what-somebody-is-carrying-takes.js';
import {
    changeInto,
    theClothesTheyStandUpIn,
    whatTheyHaveOn
} from '../../../src/engine/world/what-somebody-stands-up-in.js';

const sword = makeObject({ id: 'sword', name: 'a plain iron sword', kind: 'artifact', possessorId: 'you', volume: 3, weight: 2 });
const clothes = theClothesTheyStandUpIn({ personId: 'you', personName: 'Shen Wuyou', onDay: 1 });
const robes = { ...aUniformFor({ memberId: 'you', houseId: 'h', houseName: 'Bountiful Sheaf Sect', onDay: 2 }) };

describe('worn, held and inventory', () => {
    it('are three states of one thing, and a thing issued to be worn is worn', () => {
        expect(howItIsHad(clothes)).toBe('worn');
        expect(howItIsHad(robes)).toBe('worn');
        expect(howItIsHad(sword)).toBe('inventory');
        expect(howItIsHad(hadAs(sword, 'held'))).toBe('held');
        expect(howItIsHad(hadAs(hadAs(sword, 'held'), 'inventory'))).toBe('inventory');
    });

    it('lands a thing that changes hands in the new holder\'s inventory, never on them or in their hand', () => {
        for (const had of [robes, hadAs(sword, 'held')]) {
            const moved = transferPossession(had, { toHolderId: 'thief', toHolderName: 'A Thief', onDay: 3, how: 'stolen' } as never);
            expect(howItIsHad(moved)).toBe('inventory');
        }
    });

    it('reads a house\'s robes as worn only when they are on', () => {
        const inTheBag = hadAs(robes, 'inventory');
        expect(wearsTheRobesOf([robes], 'you', 'h')).toBe(true);
        expect(wearsTheRobesOf([inTheBag], 'you', 'h')).toBe(false);
        expect(holdsTheRobesOf([inTheBag], 'you', 'h')).toBe(true);
    });

    it('wears one outfit at a time: changing in puts the other in the inventory', () => {
        const objects = [clothes, robes];
        const cameOff = changeInto(objects, 'you', clothes.id);
        expect(cameOff.map(o => o.id)).toEqual([robes.id]);
        expect(whatTheyHaveOn(objects, 'you').map(o => o.name)).toEqual(['plain clothes']);
        expect(wearsTheRobesOf(objects, 'you', 'h')).toBe(false);
    });
});

describe('what everything takes, against what a body carries', () => {
    it('counts what is worn or held by weight only, and what is in the inventory by both', () => {
        const worn = whatTheirThingsTake([clothes], 'you');
        expect(worn.volume).toBe(0);
        expect(worn.weight).toBeGreaterThan(0);
        expect(whatTheirThingsTake([sword], 'you')).toEqual({ volume: 3, weight: 2 });
        expect(whatTheirThingsTake([hadAs(sword, 'held')], 'you')).toEqual({ volume: 0, weight: 2 });
    });

    it('puts a thing in the inventory if it fits, held if it does not, and nowhere past the body or two hands', () => {
        const capacity = { volume: 10, weight: 20 };
        expect(whereItWouldGo({ volume: 0, weight: 0 }, { volume: 3, weight: 2 }, capacity, 0)).toBe('inventory');
        expect(whereItWouldGo({ volume: 9, weight: 0 }, { volume: 3, weight: 2 }, capacity, 0)).toBe('held');
        expect(whereItWouldGo({ volume: 9, weight: 0 }, { volume: 3, weight: 2 }, capacity, 2)).toBe('hands_full');
        expect(whereItWouldGo({ volume: 0, weight: 19 }, { volume: 3, weight: 2 }, capacity, 0)).toBe('too_heavy');
        expect(howManyHeld([hadAs(sword, 'held'), clothes], 'you')).toBe(1);
    });
});
