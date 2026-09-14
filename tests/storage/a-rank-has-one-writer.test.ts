/**
 * A rank is written by the roll, and by nothing else.
 *
 * ── WHAT THIS USED TO PROTECT, AND WHY IT NO LONGER HAS TO ───────────────
 *
 * `cultivators.sect_rank` was a string MIRRORED off the `sect_members` row, so
 * the cultivator's own record could answer "what rung do you hold" without a
 * join. `CultivatorRepository.update` is a read-merge-write over a caller's
 * snapshot, so a caller holding a `Cultivator` fetched BEFORE a promotion and
 * updating something unrelated - a location, a purse - wrote the old rank back
 * over the new one. Two writers for one fact, and only one of them knew it was
 * a mirror. That was patched by having the merge leave the mirror alone.
 *
 * THE MIRROR IS NOW GONE, which is the fix rather than the patch. A rung has
 * two stores and no third: `sect_members.rank_index` for a cultivator the
 * database holds, and `NpcRecord.factionRankIndex` for somebody the world
 * holds. `whereSomebodyStandsOnAHousesRoll` is the one read. A stale snapshot
 * can no longer carry a rank back with it because there is no rank on the row
 * to carry - which is what the first test here asserts directly, and it is a
 * stronger claim than the old one: not "the write is careful" but "there is
 * nothing here to write".
 *
 * `sect_id` is NOT the same fact and stays. Somebody born on a house's roll
 * carries one with no `sect_members` row at all, which is this world's "on the
 * roll, at no rung" - so the pair of them still has to agree about the house,
 * and the last test here is the one that survived unchanged in meaning.
 *
 * RED-CHECKED. Putting `sect_rank TEXT` back in the `cultivators` DDL fails the
 * first test; making `setRank` write the title anywhere but `sect_members`
 * fails the second.
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
        ranks: ['Outer Disciple', 'Inner Disciple', 'Core Disciple'],
        admissionOrdinal: 1,
        stipend: [1, 2, 3],
        description: 'A house that exists to be joined.'
    } as unknown as Parameters<SectRepository['upsert']>[0]);
    return 'sect-test';
}

function aCultivator(): Cultivator {
    return cultivators.create({
        id: 'who-1',
        name: 'Shen Yi',
        // These three were `player` / `commoner` / `orthodox` and every one of
        // them had stopped being a member of its enum. The literal is behind a
        // cast, so nothing typechecked it and the whole file was red on this
        // tree before any of the work above was done.
        kind: 'pc',
        spiritRoot: 'single_fire',
        origin: 'market_town',
        traditionId: 'tradition-drawn',
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

/** What the cultivator row says about the house. It says nothing about a rung. */
function mirrored(id: string): { sectId: string | null } {
    return db
        .prepare('SELECT sect_id AS sectId FROM cultivators WHERE id = ?')
        .get(id) as { sectId: string | null };
}

/** Every column the `cultivators` table has, as the schema built it. */
function columnsOfCultivators(): string[] {
    return (db.prepare('PRAGMA table_info(cultivators)').all() as { name: string }[])
        .map(row => row.name);
}

describe('the roll is the only place a rank lives', () => {
    it('and the cultivator row has no column that could hold one', () => {
        // The ratchet. Everything below is about behaviour; this is about there
        // being nowhere for the behaviour to go wrong.
        expect(columnsOfCultivators()).toContain('sect_id');
        expect(columnsOfCultivators()).not.toContain('sect_rank');
    });

    it('a join writes the house on the row and the rung on the roll', () => {
        const house = aHouse();
        const who = aCultivator();
        sects.addMember(house, who.id, 0);
        expect(mirrored(who.id).sectId).toBe(house);
        expect(sects.getMembership(who.id)?.rankIndex).toBe(0);
        expect(sects.getMembership(who.id)?.rankTitle).toBe('Outer Disciple');
    });

    it('and a promotion moves the roll, which is the only thing to move', () => {
        const house = aHouse();
        const who = aCultivator();
        sects.addMember(house, who.id, 0);
        sects.setRank(house, who.id, 1);
        expect(sects.getMembership(who.id)?.rankIndex).toBe(1);
        expect(sects.getMembership(who.id)?.rankTitle).toBe('Inner Disciple');
    });

    it('SURVIVES AN UNRELATED UPDATE MADE FROM A STALE SNAPSHOT', () => {
        const house = aHouse();
        const who = aCultivator();
        sects.addMember(house, who.id, 0);

        // The caller reads the person. This snapshot is from before the raise.
        const snapshot = cultivators.getById(who.id)!;
        expect(snapshot.sectId).toBe(house);

        // The house raises them. The caller does not know.
        sects.setRank(house, who.id, 1);

        // And now the caller writes something entirely unrelated. This is the
        // ordinary shape of every verb in the game: read a person, change one
        // thing about them, write them back.
        cultivators.update(who.id, { location: 'somewhere else' });

        // The promotion still stands, and now by construction rather than by a
        // careful merge: the snapshot never held a rank.
        expect(sects.getMembership(who.id)?.rankIndex).toBe(1);
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

    it('and leaving clears the house and empties the roll', () => {
        const house = aHouse();
        const who = aCultivator();
        sects.addMember(house, who.id, 0);
        sects.removeMember(house, who.id);
        expect(mirrored(who.id).sectId).toBeNull();
        expect(sects.getMembership(who.id)).toBeNull();
    });
});

describe('and walking out of the house you were born into', () => {
    it('leaves nothing behind that names a rung', () => {
        // `sect-manage.ts` has one deliberate exception to "the roll writes the
        // rank": somebody BORN into a house has no `sect_members` row to
        // remove, so walking out is written on the cultivator directly. It sets
        // `sectId: null`. That used to leave a rank title stranded on the row,
        // and the game would describe an Outer Disciple of nowhere.
        const house = aHouse();
        const who = aCultivator();
        db.prepare('UPDATE cultivators SET sect_id = ? WHERE id = ?').run(house, who.id);

        cultivators.update(who.id, { sectId: null });

        expect(mirrored(who.id).sectId).toBeNull();
        expect(sects.getMembership(who.id)).toBeNull();
    });
});
