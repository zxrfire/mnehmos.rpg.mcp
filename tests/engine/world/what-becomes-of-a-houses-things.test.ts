/**
 * A house falls. Who owns its blade the next morning?
 *
 * `faction_fell` marked the house dissolved, cut every member loose and left
 * the compound ruined, and said nothing about the treasury. So every object a
 * fallen house owned kept `ownerId` pointing at an institution that no longer
 * existed, for the rest of the world's life - and the record claimed a dead
 * house was still watching its things.
 *
 * The design owner, stating the rule: *"once a faction ends, their item
 * ownership is marked now as whoever is holding it (maybe a surviving
 * disciple). So in ruins that owners are long gone, no owner."*
 *
 * Ownership is a live fact here and not a label, and the holder decides which
 * of the two cases applies. There is no third.
 */

import { describe, it, expect } from 'vitest';

import {
    whoOwnsThemNow
} from '../../../src/engine/world/what-becomes-of-a-houses-things-when-the-house-ends';

const FALLEN = 'sect-the-severed';
const STANDING = 'sect-azure-cloud-pavilion';

const thing = (id: string, over: Partial<{
    ownerId: string | null; possessorId: string | null; ownerName: string;
}> = {}) => ({
    id,
    ownerId: over.ownerId === undefined ? FALLEN : over.ownerId,
    ownerName: over.ownerName ?? 'The Severed',
    possessorId: over.possessorId ?? null
});

const NAMES: Record<string, string> = { 'npc-survivor': 'Xue Lianhua' };
const nameOf = (id: string) => NAMES[id] ?? null;

describe('what becomes of a house\'s things when the house ends', () => {
    it('gives it to whoever walked out with it', () => {
        const landed = whoOwnsThemNow(
            [thing('blade', { possessorId: 'npc-survivor' })], FALLEN, nameOf
        );
        expect(landed).toEqual([
            { objectId: 'blade', ownerId: 'npc-survivor', ownerName: 'Xue Lianhua' }
        ]);
    });

    it('leaves what nobody carried with no owner at all', () => {
        // Not "owned by the ruin" and not still the dead house's. Nobody's.
        // This is the whole difference between robbing a ruin and robbing a
        // house: there is nobody on the row to be wronged.
        expect(whoOwnsThemNow([thing('cauldron')], FALLEN, nameOf)).toEqual([
            { objectId: 'cauldron', ownerId: null, ownerName: '' }
        ]);
    });

    it('does not touch what the house did not own', () => {
        // A thing sitting in the falling house's compound that belongs to
        // somebody else stays theirs. Their claim did not fall over.
        expect(whoOwnsThemNow([
            thing('lent-in', { ownerId: STANDING }),
            thing('personal', { ownerId: 'npc-survivor', possessorId: 'npc-survivor' }),
            thing('nobodys', { ownerId: null })
        ], FALLEN, nameOf)).toEqual([]);
    });

    it('treats a holder the world cannot name as no owner', () => {
        // A claim nobody can press is not a claim. Better an honest ruin than
        // a row pointing at somebody who is not there either.
        expect(whoOwnsThemNow(
            [thing('blade', { possessorId: 'npc-also-gone' })], FALLEN, nameOf
        )).toEqual([{ objectId: 'blade', ownerId: null, ownerName: '' }]);
    });

    it('decides every one of the house\'s things and nothing else', () => {
        const landed = whoOwnsThemNow([
            thing('a'),
            thing('b', { possessorId: 'npc-survivor' }),
            thing('c', { ownerId: STANDING })
        ], FALLEN, nameOf);
        expect(landed.map(where => where.objectId)).toEqual(['a', 'b']);
        // And nothing is left pointing at the house that ended.
        for (const where of landed) expect(where.ownerId).not.toBe(FALLEN);
    });
});
