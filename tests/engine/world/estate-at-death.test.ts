/**
 * What comes off a body, and where it goes.
 *
 * The claim each case pins is a ruling rather than an implementation detail:
 * `docs/world/things/items.md` says the two stored tiers move differently, and
 * `docs/world/things/economy.md` says a grave is involuntary, holds whatever
 * they happened to be carrying, and never refuses anybody. Both of those live
 * only as branches in `settleEstate`, so they need a test that says so.
 */

import { describe, it, expect } from 'vitest';

import {
    settleEstate,
    leftSomething,
    estateObjectId,
    type EstateInput
} from '../../../src/engine/world/estate-at-death';
import { isRuined, isStolen, makeObject, transferPossession } from '../../../src/engine/world/possessions';

const DEAD = { id: 'cult-1', name: 'Shen Ke' };

function dying(over: Partial<EstateInput> = {}): EstateInput {
    return {
        dead: DEAD,
        onDay: 4000,
        locationId: 'loc-wheatgate',
        counted: {
            spiritStones: 30,
            stock: [
                { itemId: 'pill-qi-gathering', kind: 'pill', quantity: 2 },
                { itemId: 'herb-qi-grass', kind: 'herb', quantity: 3 }
            ]
        },
        tracked: [{
            itemId: 'artifact-a-blade',
            name: 'A Blade',
            kind: 'artifact',
            significance: 'significant',
            power: 12
        }],
        standingOver: [],
        causeNote: 'Starved.',
        ...over
    };
}

describe('what a death leaves', () => {
    it('puts the counted half in the ground where they fell when nobody is there', () => {
        const estate = settleEstate(dying());

        expect(estate.destination).toBe('in the ground');
        expect(estate.taker).toBeNull();
        expect(estate.taken).toBeNull();
        expect(estate.buried).not.toBeNull();
        expect(estate.buried!.spiritStones).toBe(30);
        expect(estate.buried!.stock.map(s => s.itemId))
            .toEqual(['pill-qi-gathering', 'herb-qi-grass']);
        expect(leftSomething(estate)).toBe(true);
    });

    it('leaves the tracked half at the place, held by nobody, with the dead in its chain', () => {
        const estate = settleEstate(dying());

        expect(estate.objects).toHaveLength(1);
        const object = estate.objects[0];
        expect(object.id).toBe(estateObjectId(DEAD.id, 'artifact-a-blade'));
        expect(object.possessorId).toBeNull();
        expect(object.locationId).toBe('loc-wheatgate');

        // THE POINT OF THE WHOLE MODULE. A chain that does not name the person
        // it came off is a chain nobody can be asked about.
        expect(object.provenance).toHaveLength(2);
        expect(object.provenance[0].holderId).toBe(DEAD.id);
        expect(object.provenance[1].previousHolderId).toBe(DEAD.id);
        expect(object.provenance[1].previousHolderName).toBe(DEAD.name);
        expect(object.provenance[1].how).toBe('lost');

        // And whose it was survives them, which is what gives a house standing
        // to want it back.
        expect(object.ownerId).toBe(DEAD.id);
    });

    it('hands everything to whoever was standing there instead of burying it', () => {
        const estate = settleEstate(dying({
            standingOver: [{ id: 'npc-7', name: 'Cao Antao' }, { id: 'npc-9', name: 'Liang Fuhe' }]
        }));

        expect(estate.destination).toBe('taken');
        expect(estate.taker).toEqual({ id: 'npc-7', name: 'Cao Antao' });
        expect(estate.buried).toBeNull();
        expect(estate.taken!.spiritStones).toBe(30);

        const object = estate.objects[0];
        expect(object.possessorId).toBe('npc-7');
        // Taking a thing does not make it yours, and the record says so.
        expect(object.ownerId).toBe(DEAD.id);
        expect(isStolen(object)).toBe(true);
        expect(object.provenance[1].how).toBe('looted');
    });

    it('moves the world\'s own row rather than minting a second copy of it', () => {
        const worldRow = makeObject({
            id: 'artifact-a-blade',
            name: 'A Blade',
            kind: 'artifact',
            significance: 'significant',
            power: 12
        });
        const estate = settleEstate(dying({
            tracked: [{
                itemId: 'artifact-a-blade',
                name: 'A Blade',
                kind: 'artifact',
                significance: 'significant',
                power: 12,
                worldRow
            }]
        }));

        expect(estate.objects[0].id).toBe('artifact-a-blade');
        expect(estate.objects[0].id).not.toBe(estateObjectId(DEAD.id, 'artifact-a-blade'));
    });

    it('leaves nothing to search where there was no body, and keeps the record anyway', () => {
        const estate = settleEstate(dying({ leavesBody: false, standingOver: [{ id: 'npc-7', name: 'Cao Antao' }] }));

        expect(estate.destination).toBe('gone with the body');
        expect(estate.buried).toBeNull();
        expect(estate.taken).toBeNull();
        expect(estate.taker).toBeNull();

        // `possessions.ts`: spent is not gone. The row stays, and it can still
        // be asked about two centuries later.
        expect(estate.objects).toHaveLength(1);
        expect(isRuined(estate.objects[0])).toBe(true);
        expect(estate.objects[0].provenance[0].holderId).toBe(DEAD.id);
    });

    it('reports an empty body as an empty body rather than a hole with nothing in it', () => {
        const estate = settleEstate(dying({
            counted: { spiritStones: 0, stock: [{ itemId: 'pill-qi-gathering', kind: 'pill', quantity: 0 }] },
            tracked: []
        }));

        expect(estate.buried).toBeNull();
        expect(leftSomething(estate)).toBe(false);
    });
});


/**
 * Lived-in belongings audit, 2026-10-03: death's custody link used to rewrite
 * an existing borrowed or stolen world object's owner to the dead carrier.
 * items.md says an unchecked pouch is no claim on the register and taking
 * from a corpse moves possession, not title. Preserve the actual owner,
 * including a real null owner, while recording the dead carrier and taker.
 * This is every tracked object's rule; keys need no estate exception.
 */
it.each(['artifact', 'manual', 'key'] as const)('death preserves an existing %s title through physical looting', kind => {
    for (const ownerId of ['house-owner', 'other-person', null]) {
        const row = transferPossession(makeObject({ id: 'known-property', name: 'Known property',
            kind, significance: 'significant', ownerId, ownerName: ownerId ?? '' }),
            { onDay: 1, toHolderId: DEAD.id, toHolderName: DEAD.name, how: 'lent' });
        for (const standingOver of [[], [{ id: 'taker', name: 'Taker' }]]) {
            const result = settleEstate(dying({ tracked: [{ itemId: row.id, name: row.name,
                kind, significance: row.significance, power: row.power, worldRow: row }], standingOver }));
            const after = result.objects[0]!;
            expect(after.id).toBe(row.id);
            expect(after.ownerId).toBe(ownerId);
            expect(after.ownerName).toBe(row.ownerName);
            expect(after.possessorId).toBe(standingOver[0]?.id ?? null);
            expect(after.provenance.slice(row.provenance.length).map(p => p.how))
                .toEqual(['found', standingOver.length ? 'looted' : 'lost']);
            expect(after.provenance.at(-1)?.previousHolderId).toBe(DEAD.id);
            expect(row.ownerId).toBe(ownerId);
            expect(row.possessorId).toBe(DEAD.id);
        }
    }
});

it('a newly materialised pouch object still establishes the dead carrier as its first owner', () => {
    const result = settleEstate(dying({ tracked: [{ itemId: 'pouch-object', name: 'Pouch object',
        kind: 'artifact', significance: 'significant', power: 12, worldRow: null }] }));
    expect(result.objects[0]!.ownerId).toBe(DEAD.id);
    expect(result.objects[0]!.possessorId).toBeNull();
});
