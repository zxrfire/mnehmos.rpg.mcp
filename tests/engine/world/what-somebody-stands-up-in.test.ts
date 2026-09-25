/**
 * What somebody has on is tracked, and can be taken off them.
 *
 * The owner: "we need the inventory system working and the engine tracking it. i need to know
 * what's on me." Played before this: a new character asking what they carried was told "what
 * you are standing in", and a disciple's robes could not be stolen at any phrasing, because
 * robes are mundane and the theft gate let only the tracked tier through.
 */
import { describe, expect, it } from 'vitest';

import { aUniformFor } from '../../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import {
    isAGarment,
    theClothesTheyStandUpIn,
    theLineForWhatTheyHaveOn,
    whatTheyHaveOn
} from '../../../src/engine/world/what-somebody-stands-up-in.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import { whatIsWithinReachOf } from '../../../src/web/object-theft.js';

const clothes = theClothesTheyStandUpIn({ personId: 'you', personName: 'Shen Wuyou', onDay: 3 });
const robes = aUniformFor({ memberId: 'wei', houseId: 'house-1', houseName: 'Bountiful Sheaf Sect', onDay: 1 });
const aBowl = makeObject({ id: 'bowl', name: 'a clay bowl', kind: 'other', significance: 'mundane', possessorId: 'wei' });

describe('what somebody has on', () => {
    it('is a row they own, and it reads as worn', () => {
        expect(clothes.ownerId).toBe('you');
        expect(clothes.possessorId).toBe('you');
        expect(isAGarment(clothes)).toBe(true);
        expect(isAGarment(robes)).toBe(true);
        expect(isAGarment(aBowl)).toBe(false);
    });

    it('gives a second set handed out the same day an id of its own', () => {
        const again = theClothesTheyStandUpIn({ personId: 'you', personName: 'Shen Wuyou', onDay: 3, among: [clothes] });
        expect(again.id).not.toBe(clothes.id);
    });

    it('lists the robes first, then the clothes under them', () => {
        const robesOnYou = { ...robes, possessorId: 'you' };
        expect(whatTheyHaveOn([clothes, aBowl, robesOnYou], 'you').map(o => o.name))
            .toEqual(['Bountiful Sheaf Sect robes', 'plain clothes']);
        expect(theLineForWhatTheyHaveOn(whatTheyHaveOn([clothes], 'you'))).toBe('Wearing: plain clothes.');
        expect(theLineForWhatTheyHaveOn([])).toBe('You have nothing on.');
    });
});

describe('what somebody has on can be taken off them', () => {
    it('puts a disciple\'s robes within reach, and still not a mundane bowl', () => {
        const world = { objects: [robes, aBowl] } as unknown as WorldState;
        expect(whatIsWithinReachOf(world, 'wei', null).map(found => found.object.id)).toEqual([robes.id]);
    });
});
