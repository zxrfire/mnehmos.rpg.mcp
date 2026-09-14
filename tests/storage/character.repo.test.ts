
import { z } from 'zod';
import * as fs from 'fs';
import { initDB } from '../../src/storage/db';
import { migrate } from '../../src/storage/migrations';
import { CharacterRepository } from '../../src/storage/repos/character.repo';
import { Character, CharacterSchema, NPC, NPCSchema } from '../../src/schema/character';
import { FIXED_TIMESTAMP } from '../fixtures.js';

const TEST_DB_PATH = 'test-character-repo.db';

/**
 * WHAT A CALLER STATES, AND WHAT THE REPOSITORY STORES, ARE TWO SHAPES.
 *
 * `CharacterSchema` gives sixteen fields a `.default()` - `xp`, `conditions`,
 * `race`, `currency`, the six proficiency arrays and the rest - so the type it
 * PARSES TO has all of them and the type it ACCEPTS has none of them required.
 * Every fixture below states the handful of fields its own test is about, which
 * is the input shape; `CharacterRepository.create` is declared as taking the
 * parsed shape even though its first statement parses its own argument.
 *
 * So the fixtures are typed as input and handed to `create` parsed. Nothing
 * about what reaches the repository changes - it parses again either way - and
 * the assertions still match against exactly the fields each test stated.
 */
type CharacterInput = z.input<typeof CharacterSchema>;
type NPCInput = z.input<typeof NPCSchema>;

const asStored = (fields: CharacterInput): Character => CharacterSchema.parse(fields);
const asStoredNPC = (fields: NPCInput): NPC => NPCSchema.parse(fields);

describe('CharacterRepository', () => {
    let db: ReturnType<typeof initDB>;
    let repo: CharacterRepository;

    beforeEach(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        db = initDB(TEST_DB_PATH);
        migrate(db);
        repo = new CharacterRepository(db);
    });

    afterEach(() => {
        db.close();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    it('should create and retrieve a character', () => {
        const character = {
            id: 'char-1',
            name: 'Hero',
            stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 20,
            maxHp: 20,
            ac: 15,
            level: 1,
            characterType: 'pc',
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        } satisfies CharacterInput;

        repo.create(asStored(character));

        const retrieved = repo.findById('char-1');
        // Use toMatchObject since repository adds spellcasting defaults
        expect(retrieved).toMatchObject(character);
    });

    it('should create and retrieve an NPC', () => {
        const npc = {
            id: 'npc-1',
            name: 'Guard',
            stats: { str: 12, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
            hp: 15,
            maxHp: 15,
            ac: 16,
            level: 2,
            characterType: 'pc',
            factionId: 'guards',
            behavior: 'aggressive',
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        } satisfies NPCInput;

        repo.create(asStoredNPC(npc));

        const retrieved = repo.findById('npc-1') as NPC;
        // Use toMatchObject since repository adds spellcasting defaults
        expect(retrieved).toMatchObject(npc);
        expect(retrieved.factionId).toBe('guards');
    });

    it('should update a character', () => {
        const character = {
            id: 'char-1',
            name: 'Hero',
            stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 20,
            maxHp: 20,
            ac: 15,
            level: 1,
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        } satisfies CharacterInput;

        repo.create(asStored(character));

        const updated = repo.update('char-1', { hp: 15, level: 2 });
        expect(updated).not.toBeNull();
        expect(updated?.hp).toBe(15);
        expect(updated?.level).toBe(2);
        expect(updated?.updatedAt).not.toBe(FIXED_TIMESTAMP); // Should update timestamp

        const retrieved = repo.findById('char-1');
        expect(retrieved?.hp).toBe(15);
        expect(retrieved?.level).toBe(2);
    });

    it('should find all characters', () => {
        const c1 = asStored({
            id: 'c1', name: 'C1', stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 10, maxHp: 10, ac: 10, level: 1, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
        });
        const c2 = asStored({
            id: 'c2', name: 'C2', stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 10, maxHp: 10, ac: 10, level: 1, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
        });

        repo.create(c1);
        repo.create(c2);

        const all = repo.findAll();
        expect(all).toHaveLength(2);
        expect(all.map(c => c.id).sort()).toEqual(['c1', 'c2']);
    });

    // EDGE-003: Character name length limits
    // The two rejection cases are built valid and then spoiled on the way out,
    // so the row is unimpeachable everywhere except the one field under test and
    // `repo.create` is still the thing doing the rejecting. Parsing the bad name
    // into the fixture would move the throw off the repository and onto the
    // fixture, and the test would pass without the repository being involved.
    it('EDGE-003: should reject empty character names', () => {
        const character: Character = {
            ...asStored({
                id: 'edge-empty',
                name: 'placeholder',
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                hp: 10, maxHp: 10, ac: 10, level: 1,
                createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
            }),
            name: ''  // Empty name - should be rejected
        };

        expect(() => repo.create(character)).toThrow();
    });

    it('EDGE-003: should reject excessively long character names', () => {
        const longName = 'A'.repeat(200);  // 200 chars - too long
        const character: Character = {
            ...asStored({
                id: 'edge-long',
                name: 'placeholder',
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                hp: 10, maxHp: 10, ac: 10, level: 1,
                createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
            }),
            name: longName
        };

        expect(() => repo.create(character)).toThrow('Character name cannot exceed 100 characters');
    });

    it('EDGE-003: should accept character names up to 100 characters', () => {
        const maxName = 'A'.repeat(100);  // Exactly 100 chars - should work
        const character = asStored({
            id: 'edge-max',
            name: maxName,
            stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 10, maxHp: 10, ac: 10, level: 1,
            createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
        });

        repo.create(character);
        const retrieved = repo.findById('edge-max');
        expect(retrieved?.name).toBe(maxName);
    });

    // The characters table has had an `xp` column since the XP-system migration,
    // but the repository never read or wrote it: create/update omitted the column
    // and rowToCharacter never mapped it, so CharacterSchema's `.default(0)`
    // silently re-synthesized 0 on every read. update() still *returned* the
    // merged in-memory object, so callers saw their own value echoed back and
    // only noticed on the next get.
    describe('xp persistence', () => {
        const baseCharacter = (id: string, xp?: number): Character => asStored({
            id,
            name: 'Adventurer',
            stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 20, maxHp: 20, ac: 15, level: 1,
            ...(xp === undefined ? {} : { xp }),
            createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
        });

        it('persists xp supplied at create time', () => {
            repo.create(baseCharacter('xp-create', 250));

            expect(repo.findById('xp-create')?.xp).toBe(250);
        });

        it('defaults xp to 0 when omitted at create time', () => {
            repo.create(baseCharacter('xp-default'));

            expect(repo.findById('xp-default')?.xp).toBe(0);
        });

        it('persists xp through update instead of resetting it to 0', () => {
            repo.create(baseCharacter('xp-update', 0));

            const returned = repo.update('xp-update', { xp: 500 });

            // The echoed response and the stored row must agree - the original
            // bug returned 500 here while writing nothing.
            expect(returned?.xp).toBe(500);
            expect(repo.findById('xp-update')?.xp).toBe(500);
        });

        it('leaves xp untouched when an unrelated field is updated', () => {
            repo.create(baseCharacter('xp-untouched', 1200));

            repo.update('xp-untouched', { hp: 12 });

            const retrieved = repo.findById('xp-untouched');
            expect(retrieved?.hp).toBe(12);
            expect(retrieved?.xp).toBe(1200);
        });
    });
});
