/**
 * Somebody robbed of a thing they need does something about it when next seen, where it is
 * possible. The owner: "gemma says they have nothing on and the NPCs take an action to get
 * something", "if you rob them very far away from a sect, they can't easily get another set", and
 * "this is the same boat if you robbed their sword, or their identity token ... it's not bespoke".
 */
import { describe, expect, it } from 'vitest';

import { aUniformFor } from '../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { makeObject, transferPossession, type ObjectRecord } from '../../src/engine/world/possessions.js';
import { whatTheyHaveOn } from '../../src/engine/world/what-somebody-stands-up-in.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import {
    theyDoSomethingAboutWhatTheyLost,
    whatALossLeftThemShortOf,
    whatTheCardSaysOfALoss
} from '../../src/web/somebody-robbed-of-something-they-need.js';

const HOUSE = { id: 'house-1', name: 'Bountiful Sheaf Sect', seatLocationId: 'seat' };
const PLACES = [
    { id: 'seat', kind: 'sect_seat', parentId: null },
    { id: 'hall', kind: 'room', parentId: 'seat' },
    { id: 'town', kind: 'settlement', parentId: null },
    { id: 'ridge', kind: 'wilds', parentId: null }
];

const stolenOnDay5 = (thing: ObjectRecord) =>
    transferPossession(thing, { toHolderId: 'you', toHolderName: 'Shen Wuyou', onDay: 5, how: 'stolen' } as never);

/** A disciple the player robbed on run day 5 of what `things` makes, standing at `at`. */
function robbed(memberId: string, at: string, things: (id: string) => ObjectRecord[]) {
    const world = { objects: things(memberId).map(stolenOnDay5), factions: [HOUSE], locations: PLACES, currentDay: 100 } as unknown as WorldState;
    const person = { id: memberId, name: 'Wei Lan', realmOrdinal: 3, houseId: HOUSE.id, locationId: at };
    return { world, person };
}
const robes = (id: string) => [aUniformFor({ memberId: id, houseId: HOUSE.id, houseName: HOUSE.name, onDay: 1 })];
const sword = (id: string) => [makeObject({ id: `sword-${id}`, name: 'an iron sword', kind: 'artifact', power: 3, possessorId: id, ownerId: id })];

/** Days 6 to 9, as the person is seen each day. */
function theNextFewDays(world: WorldState, person: ReturnType<typeof robbed>['person']) {
    for (let day = 6; day < 10; day++) theyDoSomethingAboutWhatTheyLost({ world, person, takenByOrdinal: 3, today: day });
}

describe('somebody robbed of a thing they need', () => {
    it('is short of it on the day it happened, and the card says so', () => {
        const { world, person } = robbed('wei', 'hall', robes);
        expect(theyDoSomethingAboutWhatTheyLost({ world, person, takenByOrdinal: 3, today: 5 })).toBe(false);
        expect(whatTheCardSaysOfALoss(world.objects, 'wei', 5)).toEqual([
            'Has nothing on: their Bountiful Sheaf Sect robes were taken off them.'
        ]);
    });

    it('comes by another within a few days inside their house, from the house or wherever', () => {
        const ways = new Set<string>();
        for (let i = 0; i < 60; i++) {
            const { world, person } = robbed(`npc-${i}`, 'hall', robes);
            theNextFewDays(world, person);
            expect(whatTheyHaveOn(world.objects, person.id).length, `npc-${i} still has nothing on`).toBe(1);
            ways.add(whatTheyHaveOn(world.objects, person.id)[0]!.tags.includes('uniform') ? 'their house' : 'wherever');
        }
        expect(ways).toEqual(new Set(['their house', 'wherever']));
    });

    it('gets plain clothes among people away from their house, and nothing at all in the wilds', () => {
        for (let i = 0; i < 60; i++) {
            const inTown = robbed(`npc-${i}`, 'town', robes);
            theNextFewDays(inTown.world, inTown.person);
            expect(whatTheyHaveOn(inTown.world.objects, `npc-${i}`).map(o => o.name)).toEqual(['plain clothes']);

            const outThere = robbed(`npc-${i}`, 'ridge', robes);
            theNextFewDays(outThere.world, outThere.person);
            expect(whatALossLeftThemShortOf(outThere.world.objects, `npc-${i}`).map(s => s.need)).toEqual(['something_to_wear']);
        }
    });

    it('is the same for a sword, and for a token, which only their house re-cuts', () => {
        const { world, person } = robbed('wei', 'town', sword);
        expect(whatTheCardSaysOfALoss(world.objects, 'wei', 5)).toEqual([
            'Has nothing to fight with: their iron sword was taken off them.'
        ]);
        theNextFewDays(world, person);
        expect(whatALossLeftThemShortOf(world.objects, 'wei')).toEqual([]);

        const token = (id: string) => [makeObject({ id: `token-${id}`, name: 'a jade token', kind: 'token', tags: ['token', `member:${id}`], possessorId: id, ownerId: HOUSE.id })];
        const withoutProof = robbed('wei', 'town', token);
        theNextFewDays(withoutProof.world, withoutProof.person);
        expect(whatALossLeftThemShortOf(withoutProof.world.objects, 'wei').map(s => s.need)).toEqual(['proof_of_who_they_are']);
    });

    it('is not short of what nobody took: a thing of theirs on the ground, or a second one still held', () => {
        const dropped = { ...robes('wei')[0]!, possessorId: null };
        expect(whatALossLeftThemShortOf([dropped], 'wei')).toEqual([]);
        const spare = { ...sword('wei')[0]!, id: 'spare' };
        expect(whatALossLeftThemShortOf([stolenOnDay5(sword('wei')[0]!), spare], 'wei')).toEqual([]);
    });
});
