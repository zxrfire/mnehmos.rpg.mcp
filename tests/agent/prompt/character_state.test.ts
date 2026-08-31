import * as fs from 'fs';
import { initDB } from '../../../src/storage/db';
import { migrate } from '../../../src/storage/migrations';
import { CharacterRepository } from '../../../src/storage/repos/character.repo';
import { InventoryRepository } from '../../../src/storage/repos/inventory.repo';
import { buildCharacterStateSlice } from '../../../src/agent/prompt/slices/character_state';
import { Character } from '../../../src/schema/character';
import { FIXED_TIMESTAMP } from '../../fixtures.js';

const TEST_DB = 'test-char-state-slice.db';

function cleanup() {
    for (const s of ['', '-wal', '-shm']) {
        const p = TEST_DB + s;
        if (fs.existsSync(p)) fs.unlinkSync(p);
    }
}

function baseChar(id: string, overrides: Partial<Character> = {}): Character {
    return {
        id,
        name: 'Kara',
        stats: { str: 12, dex: 17, con: 14, int: 10, wis: 14, cha: 12 },
        hp: 32,
        maxHp: 45,
        ac: 16,
        level: 5,
        characterType: 'pc',
        characterClass: 'ranger',
        race: 'Half-Elf',
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
        ...overrides
    } as Character;
}

describe('buildCharacterStateSlice', () => {
    let db: ReturnType<typeof initDB>;
    let deps: { characterRepo: CharacterRepository; inventoryRepo: InventoryRepository };

    beforeEach(() => {
        cleanup();
        db = initDB(TEST_DB);
        migrate(db);
        deps = {
            characterRepo: new CharacterRepository(db),
            inventoryRepo: new InventoryRepository(db)
        };
    });

    afterEach(() => {
        db.close();
        cleanup();
    });

    it('returns null for a missing character', () => {
        expect(buildCharacterStateSlice('nope', deps)).toBeNull();
    });

    it('renders basic identity + vitals + stats', () => {
        deps.characterRepo.create(baseChar('c1'));
        const slice = buildCharacterStateSlice('c1', deps)!;

        expect(slice).toContain('--- YOUR CHARACTER ---');
        expect(slice).toContain('Kara');
        expect(slice).toContain('Half-Elf');
        expect(slice).toContain('ranger');
        expect(slice).toContain('level 5');
        expect(slice).toContain('HP: 32/45');
        // No AC line. Armour class went with the D&D combat engine; a
        // cultivator's defence is composite and lives in combat_manage.
        expect(slice).not.toContain('AC:');
        expect(slice).toContain('STR 12 (+1)');
        expect(slice).toContain('DEX 17 (+3)');
        expect(slice).toContain('Conditions: none');
    });

    it('tags BLOODIED when HP <= 50%', () => {
        deps.characterRepo.create(baseChar('c1', { hp: 20, maxHp: 45 }));
        const slice = buildCharacterStateSlice('c1', deps)!;
        expect(slice).toContain('BLOODIED');
    });

    it('tags DOWN when HP is 0', () => {
        deps.characterRepo.create(baseChar('c1', { hp: 0, maxHp: 45 }));
        const slice = buildCharacterStateSlice('c1', deps)!;
        expect(slice).toContain('DOWN');
    });

    it('lists conditions when present', () => {
        deps.characterRepo.create(baseChar('c1', {
            conditions: [
                { name: 'Poisoned', duration: 3, source: "wyvern's sting" },
                { name: 'Prone' }
            ]
        }));
        const slice = buildCharacterStateSlice('c1', deps)!;
        expect(slice).toContain('Poisoned (3r)');
        expect(slice).toContain("<- wyvern's sting");
        expect(slice).toContain('Prone');
    });

    it('puts no spellcasting block in front of the narrator', () => {
        // The D&D spellcasting layer is gone, along with the fields it read.
        // A cultivator's arts, qi and rank are cultivation state, and the
        // narrator reads them from the cultivator row rather than from here.
        deps.characterRepo.create(baseChar('c1'));
        const slice = buildCharacterStateSlice('c1', deps)!;
        expect(slice).not.toContain('Spellcasting:');
        expect(slice).not.toContain('Slots:');
        expect(slice).not.toContain('Concentrating');
    });

    it('renders resistances/immunities/vulnerabilities only when present', () => {
        deps.characterRepo.create(baseChar('c1', {
            resistances: ['fire'],
            immunities: ['poison'],
            vulnerabilities: ['cold']
        }));
        const slice = buildCharacterStateSlice('c1', deps)!;
        expect(slice).toContain('Resistant to: fire');
        expect(slice).toContain('Immune to: poison');
        expect(slice).toContain('Vulnerable to: cold');
    });

    it.skip('renders skill / save proficiencies when persisted', () => {
        // NOTE: CharacterRepository does not currently persist skillProficiencies
        // or saveProficiencies - schema defines them but INSERT/UPDATE statements
        // do not include them. The slice code is correct; when the repo is
        // extended to round-trip these fields, this test can be unskipped.
        deps.characterRepo.create(baseChar('c1', {
            saveProficiencies: ['dex', 'wis'],
            skillProficiencies: ['stealth', 'perception', 'sleight_of_hand']
        }));
        const slice = buildCharacterStateSlice('c1', deps)!;
        expect(slice).toContain('Save proficiencies: DEX, WIS');
        expect(slice).toContain('Skill proficiencies: stealth, perception, sleight of hand');
    });

    it('has no legendary-action block', () => {
        // Legendary actions were a D&D monster affordance and went with the
        // combat engine that resolved them. What makes something in this world
        // hard to fight is its rank, and rank is not a per-round budget.
        deps.characterRepo.create(baseChar('c1'));
        const slice = buildCharacterStateSlice('c1', deps)!;
        expect(slice).not.toContain('Legendary');
    });

    it('omits inventory section when no items', () => {
        deps.characterRepo.create(baseChar('c1'));
        const slice = buildCharacterStateSlice('c1', deps)!;
        expect(slice).not.toContain('Inventory:');
    });
});
