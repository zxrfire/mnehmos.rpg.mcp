/**
 * A rank is written by the roll, and by nothing else.
 *
 * `cultivators.sect_id` and `cultivators.sect_rank` MIRROR the `sect_members`
 * row, so the cultivator's own record answers "who do you answer to" without a
 * join. `SectRepository` maintains that mirror at all three of its writers and
 * is careful about it.
 *
 * `CultivatorRepository.update` also wrote both columns, and it is a
 * read-merge-write over a caller's snapshot. So a caller holding a `Cultivator`
 * fetched BEFORE a promotion, updating something unrelated - a location, a
 * purse - wrote the old rank back over the new one, and nothing anywhere said
 * so. Two writers for one fact, and only one of them knew it was a mirror.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

import { migrate } from '../../src/storage/migrations';
import { CultivatorRepository } from '../../src/storage/repos/cultivator.repo';
import { SectRepository } from '../../src/storage/repos/sect.repo';
import type { Cultivator } from '../../src/schema/cultivation';

let db: Database.Database;
let cultivators: CultivatorRepository;
let sects: SectRepository;

beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    cultivators = new CultivatorRepository(db);
    sects = new SectRepository(db);
});

function aHouse(): string {
    sects.upsert({
        id: 'sect-test',
        name: 'Test House',
        alignment: 'righteous',
        powerOrdinal: 20,
        ranks: ['Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder'],
        admissionOrdinal: 0,
        stipend: [1, 2, 5, 10],
        description: 'A house.'
    } as Parameters<SectRepository['upsert']>[0]);
    return 'sect-test';
}

function aCultivator(): Cultivator {
    return cultivators.create({
        id: 'cult-rank',
        name: 'Shen Ke',
        kind: 'pc',
        spiritRoot: 'single_fire',
        sex: 'male',
        physique: null,
        attributes: { might: 2, insight: 2, resolve: 2, presence: 2, fortune: 2, charm: 2 },
        realmOrdinal: 10,
        cultivationProgress: 0,
        hp: 100, maxHp: 100, qi: 100, maxQi: 100,
        satiety: 100, starvationTurns: 0, age: 40, yearsAtCurrentRealm: 0,
        spiritStones: 100
    } as unknown as Parameters<CultivatorRepository['create']>[0]);
}

/** What the mirror on the cultivator row says. */
function mirrored(id: string): { sectId: string | null; rank: string | null } {
    const row = db
        .prepare('SELECT sect_id AS sectId, sect_rank AS rank FROM cultivators WHERE id = ?')
        .get(id) as { sectId: string | null; rank: string | null };
    return row;
}

describe('the roll is the only writer of a rank', () => {
    it('mirrors what the membership says when somebody joins', () => {
        const house = aHouse();
        const who = aCultivator();
        sects.addMember(house, who.id, 0);
        expect(mirrored(who.id).sectId).toBe(house);
        expect(mirrored(who.id).rank).toBe('Outer Disciple');
    });

    it('and follows a promotion', () => {
        const house = aHouse();
        const who = aCultivator();
        sects.addMember(house, who.id, 0);
        sects.setRank(house, who.id, 1);
        expect(sects.getMembership(who.id)?.rankIndex).toBe(1);
        expect(mirrored(who.id).rank).toBe('Inner Disciple');
    });

    it('SURVIVES AN UNRELATED UPDATE MADE FROM A STALE SNAPSHOT', () => {
        const house = aHouse();
        const who = aCultivator();
        sects.addMember(house, who.id, 0);

        // The caller reads the person. This snapshot carries the OLD rank.
        const snapshot = cultivators.getById(who.id)!;
        expect(snapshot.sectRank).toBe('Outer Disciple');

        // The house raises them. The caller does not know.
        sects.setRank(house, who.id, 1);
        expect(mirrored(who.id).rank).toBe('Inner Disciple');

        // And now the caller writes something entirely unrelated. This is the
        // ordinary shape of every verb in the game: read a person, change one
        // thing about them, write them back.
        cultivators.update(who.id, { location: 'somewhere else' });

        // The promotion must still stand. Before this fix the stale snapshot's
        // rank was written back over it and the disciple was quietly demoted.
        expect(sects.getMembership(who.id)?.rankIndex).toBe(1);
        expect(mirrored(who.id).rank).toBe('Inner Disciple');
        expect(cultivators.getById(who.id)!.sectRank).toBe('Inner Disciple');
    });

    it('and an unrelated update cannot put somebody in a house either', () => {
        const who = aCultivator();
        expect(mirrored(who.id).sectId).toBeNull();
        // A snapshot carrying no house, written back, must not be able to
        // create or destroy a membership - only the roll does that.
        cultivators.update(who.id, { spiritStones: 500 });
        expect(mirrored(who.id).sectId).toBeNull();
        expect(sects.getMembership(who.id)).toBeNull();
    });

    it('and leaving clears it, because the roll said so', () => {
        const house = aHouse();
        const who = aCultivator();
        sects.addMember(house, who.id, 0);
        sects.removeMember(house, who.id);
        expect(mirrored(who.id).sectId).toBeNull();
        expect(mirrored(who.id).rank).toBeNull();
    });
});

describe('and the two halves of the mirror never disagree', () => {
    it('a rank without a house is not a state anybody should be in', () => {
        // `sect-manage.ts` has one deliberate exception to "the roll writes the
        // rank": somebody BORN into a house has no `sect_members` row to
        // remove, so walking out is written on the cultivator directly. It sets
        // `sectId: null` and says nothing about the rank, and `update` merges
        // over a fresh read - so the title survives the house.
        const house = aHouse();
        const who = aCultivator();
        db.prepare('UPDATE cultivators SET sect_id = ?, sect_rank = ? WHERE id = ?')
            .run(house, 'Outer Disciple', who.id);

        cultivators.update(who.id, { sectId: null });

        const after = mirrored(who.id);
        expect(after.sectId).toBeNull();
        // A title with no house behind it is a person the game will describe as
        // an Outer Disciple of nowhere.
        expect(after.rank).toBeNull();
    });
});
