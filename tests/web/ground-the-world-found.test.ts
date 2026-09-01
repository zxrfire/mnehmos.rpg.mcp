/**
 * Ground the simulation uncovered, reaching a player.
 *
 * `nameableSites` and `whereCouldTheyGo` read the STATIC catalogs and never
 * `state.locations`, so every ruin the world found on its own went into a table
 * nothing player-facing read. That was survivable while the discovery engine
 * did nothing; the repaired engine produces 4.1-5.0 openings per century across
 * 5,000 years, so the world now steadily uncovers closed ground that a player
 * could never visit.
 *
 * The finds are rare on purpose - a few per century across a whole world - so
 * these build the row rather than waiting for one, which is also the only way
 * to assert the shape of a row this module has to read correctly.
 */

import {
    describeFoundGround,
    foundGroundIn,
    foundGroundOf,
    isFoundGround,
    readFoundGroundAccess,
    resolveFoundGround
} from '../../src/web/ground-the-world-found';
import { FOUND_BY_PROSPECTING_TAG } from '../../src/engine/world/how-the-world-keeps-finding-more-ruins';

/** A find, shaped exactly as the prospecting pass writes one. */
function find(over: Record<string, unknown> = {}, data: Record<string, unknown> = {}) {
    return {
        id: 'loc-find-1',
        name: 'The Hollow Under Nine Steps',
        kind: 'ruin',
        parentId: 'loc-region-low-fall',
        discovered: true,
        discoveredOnDay: 41_000,
        tags: ['ruin', FOUND_BY_PROSPECTING_TAG, 'ruin-character:vault', 'left-at-the-end'],
        data: {
            ruinCharacter: 'vault',
            ruinOrigin: 'abandoned_by_a_house',
            ruinScale: 'a_building',
            intentStanding: 'left_for_a_successor',
            occupantName: 'Qiu Zhaoxun',
            setByOrdinal: 24,
            wardIntegrity: 0.4,
            admits: 'anyone_who_survives_it',
            floorOrdinal: 16,
            ceilingOrdinal: null,
            ...data
        },
        ...over
    } as never;
}

describe('recognising a find', () => {
    it('takes what the prospecting pass tagged, and nothing else', () => {
        expect(isFoundGround(find())).toBe(true);
        expect(isFoundGround(find({ tags: ['ruin'] }))).toBe(false);
        // Undiscovered ground is in the table and is not found.
        expect(isFoundGround(find({ discovered: false }))).toBe(false);
    });

    it('reads every field off the row rather than deriving any of them', () => {
        const ground = foundGroundOf(find());
        expect(ground.character).toBe('vault');
        expect(ground.origin).toBe('abandoned_by_a_house');
        expect(ground.scale).toBe('a_building');
        expect(ground.occupantName).toBe('Qiu Zhaoxun');
        expect(ground.setByOrdinal).toBe(24);
        expect(ground.wardIntegrity).toBe(0.4);
        expect(ground.access?.admits).toBe('anyone_who_survives_it');
        expect(ground.access?.floorOrdinal).toBe(16);
    });

    /**
     * A find with no recorded access is ground nobody has read yet, and saying
     * so is better than defaulting it open - which would quietly let anybody
     * walk into anything the world turned up.
     */
    it('leaves access null rather than guessing when the row does not say', () => {
        expect(foundGroundOf(find({}, { admits: undefined })).access).toBeNull();
        expect(foundGroundOf(find({}, { floorOrdinal: undefined })).access).toBeNull();
        // A cap with no ceiling recorded is incomplete, not an open door.
        expect(foundGroundOf(
            find({}, { admits: 'nobody_above_the_line', ceilingOrdinal: undefined })
        ).access).toBeNull();
    });
});

describe('what reaches a player', () => {
    const world = { locations: [find(), find({ id: 'loc-find-2', name: 'The Second' })] } as never;

    /**
     * The world knowing about a ruin is not the player knowing about it. Listing
     * every find the moment it is uncovered would spend a discovery somebody
     * else made, which is the same gate the authored sites use.
     */
    it('is gated on the record the player holds, not on the world', () => {
        expect(foundGroundIn(world, null, () => true)).toHaveLength(2);
        expect(foundGroundIn(world, null, () => false)).toHaveLength(0);
        expect(foundGroundIn(world, null, id => id === 'loc-find-2')).toHaveLength(1);
    });

    it('is scoped to a province, because a ruin four provinces off is hearsay', () => {
        expect(foundGroundIn(world, 'loc-region-low-fall', () => true)).toHaveLength(2);
        expect(foundGroundIn(world, 'loc-region-elsewhere', () => true)).toHaveLength(0);
    });

    it('answers to its name', () => {
        const all = foundGroundIn(world, null, () => true);
        expect(resolveFoundGround('Hollow Under Nine Steps', all)?.id).toBe('loc-find-1');
        expect(resolveFoundGround('something else entirely', all)).toBeNull();
    });

    it('reads nothing at all from an empty world', () => {
        expect(foundGroundIn(null, null, () => true)).toEqual([]);
    });
});

describe('what the ground does', () => {
    /**
     * The same `readAdmission` the authored catalog uses, so a floor here means
     * what a floor there means and the player learns one rule rather than two.
     */
    it('is the catalog rule, applied to a generated row', () => {
        // Floor 16. Under it the ground is deeper than the body; at or over it
        // they come back out.
        const ground = foundGroundOf(find());
        expect(readFoundGroundAccess(ground, 10)?.survives).toBe(false);
        expect(readFoundGroundAccess(ground, 16)?.survives).toBe(true);
        expect(readFoundGroundAccess(ground, 20)?.survives).toBe(true);
        // And a minimum is not a locked door: they are let in either way, which
        // is the distinction `readAdmission` exists to keep.
        expect(readFoundGroundAccess(ground, 10)?.admitted).toBe(true);
    });

    it('turns a body away above a cap, which is the shape that was unreachable', () => {
        const capped = foundGroundOf(find({}, {
            admits: 'nobody_above_the_line', floorOrdinal: 4, ceilingOrdinal: 12
        }));
        expect(readFoundGroundAccess(capped, 20)?.admitted).toBe(false);
        expect(readFoundGroundAccess(capped, 8)?.admitted).toBe(true);
    });

    it('says so when nobody has read it', () => {
        const unread = foundGroundOf(find({}, { admits: undefined }));
        expect(readFoundGroundAccess(unread, 20)).toBeNull();
        expect(describeFoundGround(unread).join(' ')).toMatch(/Nobody has read what it does/);
    });
});

describe('the account it gives', () => {
    /**
     * Structure, not invented prose. A catalog site earns its voice from three
     * strings of eighty characters written for that place; a generated ruin has
     * none, and writing in that register here would flatten every find in the
     * world into one voice.
     */
    it('names the character, whose it was, and what the ground does', () => {
        const said = describeFoundGround(foundGroundOf(find())).join(' ');
        expect(said).toContain('The Hollow Under Nine Steps');
        expect(said).toContain('vault');
        expect(said).toContain('Qiu Zhaoxun');
        expect(said).toMatch(/Anybody may walk in/);
        // Read as prose, not as a field dump.
        expect(said).not.toMatch(/ruinCharacter|floorOrdinal|_[a-z]/);
    });

    it('says which way a cap is closed, and who a floor is really for', () => {
        const capped = describeFoundGround(foundGroundOf(find({}, {
            admits: 'nobody_above_the_line', floorOrdinal: 4, ceilingOrdinal: 12
        }))).join(' ');
        expect(capped).toMatch(/closed from above/);

        const errand = describeFoundGround(foundGroundOf(find({}, {
            admits: 'elders_and_above', floorOrdinal: 30
        }))).join(' ');
        expect(errand).toMatch(/not the one who gains by it/);
    });

    it('reports the wards as what is left of them', () => {
        expect(describeFoundGround(foundGroundOf(find({}, { wardIntegrity: 0.95 }))).join(' '))
            .toMatch(/still standing/);
        expect(describeFoundGround(foundGroundOf(find({}, { wardIntegrity: 0.05 }))).join(' '))
            .toMatch(/not keeping them out any more/);
    });
});
