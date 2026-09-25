/**
 * Somebody robbed of what they wore does something about it when next seen: gets something to
 * wear, from their house if they reported it, or whatever they could find. The owner: "gemma says
 * they have nothing on and the NPCs take an action to get something".
 */
import { describe, expect, it } from 'vitest';

import { aUniformFor } from '../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { transferPossession } from '../../src/engine/world/possessions.js';
import { theClothesTakenOffThem, whatTheyHaveOn } from '../../src/engine/world/what-somebody-stands-up-in.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import {
    theyDoSomethingAboutWhatTheyWore,
    whatTheyDidAboutWhatTheyWore
} from '../../src/web/somebody-robbed-of-what-they-wore.js';

const HOUSE = { id: 'house-1', name: 'Bountiful Sheaf Sect' };

/** A disciple whose robes the player took on run day 5. */
function robbed(memberId: string) {
    const robes = aUniformFor({ memberId, houseId: HOUSE.id, houseName: HOUSE.name, onDay: 1 });
    const stolen = transferPossession(robes, { toHolderId: 'you', toHolderName: 'Shen Wuyou', onDay: 5, how: 'stolen' } as never);
    const world = { objects: [stolen], factions: [HOUSE], currentDay: 100 } as unknown as WorldState;
    const person = { id: memberId, name: 'Wei Lan', realmOrdinal: 3, houseId: HOUSE.id };
    return { world, person };
}

describe('somebody robbed of what they wore', () => {
    it('does nothing about it on the day it happened: they have nothing on', () => {
        const { world, person } = robbed('wei');
        expect(theyDoSomethingAboutWhatTheyWore({ world, person, takenByOrdinal: 3, today: 5 })).toBe(false);
        expect(theClothesTakenOffThem(world.objects, 'wei')).not.toBeNull();
    });

    it('has something on within a few days, from their house or wherever, and the card says so that day', () => {
        const ways = new Set<string>();
        for (let i = 0; i < 60; i++) {
            const { world, person } = robbed(`npc-${i}`);
            let day = 6;
            while (!theyDoSomethingAboutWhatTheyWore({ world, person, takenByOrdinal: 3, today: day }) && day < 9) day++;
            expect(whatTheyHaveOn(world.objects, person.id).length, `npc-${i} still has nothing on`).toBe(1);
            const said = whatTheyDidAboutWhatTheyWore(world.objects, person.id, day)!;
            expect(said).toMatch(/^Since what they wore was taken off them, they /);
            expect(whatTheyDidAboutWhatTheyWore(world.objects, person.id, day + 1)).toBeNull();
            ways.add(said.includes('fresh robes') ? 'their house' : 'whatever they found');
        }
        expect(ways).toEqual(new Set(['their house', 'whatever they found']));
    });
});
