/**
 * Creating a character row.
 *
 * What is left of `character_manage` after the D&D character sheet was retired.
 * The tool is gone - there is no class table, no level-up, no XP curve, no
 * spell-slot progression and no SRD catalog behind it any more, because the
 * game those served is not the game this engine runs. The player is a
 * cultivator and lives in `cultivators`; advancement is `cultivation_manage`.
 *
 * What survives is the plain insert, because two retained tools genuinely need
 * one: `npc_manage` creating the sheet an LLM-driven NPC is bound to, and
 * `batch_manage` creating several at once. Both used to call into the tool, so
 * this exists to keep them working through a single authoritative path rather
 * than two hand-rolled inserts that will drift.
 *
 * Everything here is a straight write. Nothing is derived, rolled, or looked up
 * in a catalog: the caller supplies the numbers and the engine records them.
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getDb } from '../../storage/index.js';
import { CharacterRepository } from '../../storage/repos/character.repo.js';
import { CharacterOriginSchema } from '../../schema/character.js';

export const CharacterStatsSchema = z.object({
    str: z.number().int().min(0).default(10),
    dex: z.number().int().min(0).default(10),
    con: z.number().int().min(0).default(10),
    int: z.number().int().min(0).default(10),
    wis: z.number().int().min(0).default(10),
    cha: z.number().int().min(0).default(10)
});

export const CharacterRecordSchema = z.object({
    name: z.string().min(1),
    class: z.string().optional(),
    race: z.string().optional(),
    background: z.string().optional(),
    alignment: z.string().optional(),
    stats: CharacterStatsSchema.optional(),
    hp: z.number().int().min(1).optional(),
    maxHp: z.number().int().min(1).optional(),
    ac: z.number().int().min(0).optional(),
    level: z.number().int().min(1).optional(),
    characterType: z.enum(['pc', 'npc', 'enemy', 'neutral']).optional(),
    factionId: z.string().optional(),
    behavior: z.string().optional(),
    resistances: z.array(z.string()).optional(),
    vulnerabilities: z.array(z.string()).optional(),
    immunities: z.array(z.string()).optional(),
    perceptionBonus: z.number().int().optional(),
    stealthBonus: z.number().int().optional(),
    languages: z.array(z.string()).optional(),
    origin: CharacterOriginSchema.optional()
});

export type CharacterRecordInput = z.input<typeof CharacterRecordSchema>;

const DEFAULT_STATS = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
/** A person with no training and nothing on. Callers who know better say so. */
const DEFAULT_HP = 8;
const DEFAULT_AC = 10;

/**
 * Insert one character row and hand it back as it was stored.
 *
 * `hp` defaults to `maxHp` and vice versa, so a caller that supplies only one
 * gets a character at full health rather than a silent zero.
 */
export function createCharacterRecord(input: CharacterRecordInput): Record<string, unknown> {
    const args = CharacterRecordSchema.parse(input);
    const now = new Date().toISOString();
    const repo = new CharacterRepository(getDb());

    const maxHp = args.maxHp ?? args.hp ?? DEFAULT_HP;
    const hp = Math.min(args.hp ?? maxHp, maxHp);

    const character = {
        id: randomUUID(),
        name: args.name,
        stats: { ...DEFAULT_STATS, ...(args.stats ?? {}) },
        hp,
        maxHp,
        ac: args.ac ?? DEFAULT_AC,
        level: args.level ?? 1,
        xp: 0,
        characterType: args.characterType ?? 'pc',
        characterClass: args.class ?? 'commoner',
        race: args.race ?? 'Human',
        conditions: [],
        currency: { gold: 0, silver: 0, copper: 0 },
        resistances: args.resistances ?? [],
        vulnerabilities: args.vulnerabilities ?? [],
        immunities: args.immunities ?? [],
        perceptionBonus: args.perceptionBonus ?? 0,
        stealthBonus: args.stealthBonus ?? 0,
        resourcePools: {},
        skillProficiencies: [],
        saveProficiencies: [],
        expertise: [],
        armorProficiencies: [],
        weaponProficiencies: [],
        toolProficiencies: [],
        languages: args.languages ?? [],
        background: args.background,
        alignment: args.alignment,
        origin: args.origin,
        createdAt: now,
        updatedAt: now,
        ...(args.factionId ? { factionId: args.factionId } : {}),
        ...(args.behavior ? { behavior: args.behavior } : {})
    };

    repo.create(character as Parameters<CharacterRepository['create']>[0]);

    const stored = repo.findById(character.id);
    if (!stored) {
        throw new Error(`Character ${character.id} was not persisted`);
    }
    return stored as unknown as Record<string, unknown>;
}
