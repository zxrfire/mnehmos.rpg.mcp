/**
 * The character record.
 *
 * What this is now: the identity row for NPCs the agent runtime drives, the
 * social layer overhears and the perception subsystem meters. It is NOT the
 * player's sheet - a cultivator lives in `schema/cultivation.ts` and is the
 * only thing the game proper advances, injures or kills.
 *
 * The spellcasting block (slots, prepared spells, save DC, attack bonus,
 * concentration) and the legendary-action block were removed with the D&D magic
 * and combat engines they existed to feed. Nothing reads them any more, and
 * leaving them in the schema kept putting spell slots in front of a narrator
 * whose world has techniques and a qi pool instead.
 */

import { z } from 'zod';
import { CharacterTypeSchema } from './party.js';

export const SkillProficiencySchema = z.enum([
    'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception',
    'history', 'insight', 'intimidation', 'investigation', 'medicine',
    'nature', 'perception', 'performance', 'persuasion', 'religion',
    'sleight_of_hand', 'stealth', 'survival'
]);

export const SaveProficiencySchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']);

export const CurrencySchema = z.object({
    gold: z.number().int().min(0).default(0),
    silver: z.number().int().min(0).default(0),
    copper: z.number().int().min(0).default(0),
});

/**
 * Bastion world-brief origin tracker.
 *
 * The world's central conceit is that almost no one is native to Bastion -
 * the population is summoned from every fictional universe (Forgotten Realms,
 * Konoha, contemporary Earth, ...). origin records where a soul came from
 * and when it arrived, so tools can enforce/expose that fact.
 */
export const CharacterOriginSchema = z.object({
    universe: z.string().min(1)
        .describe('Source universe (e.g. "Contemporary Earth - Arizona Mine", "Forgotten Realms", "Konoha")'),
    native: z.boolean().default(false)
        .describe('True iff born in Bastion; false for summoned souls'),
    arrivedAt: z.string().optional()
        .describe('PD-year or ISO date the soul arrived in Bastion'),
    arrivedInCohortId: z.string().uuid().optional()
        .describe('Optional cohort/wave ID the soul arrived with')
});

export type CharacterOrigin = z.infer<typeof CharacterOriginSchema>;

export const CharacterSchema = z.object({
    id: z.string(),
    name: z.string()
        .min(1, 'Character name cannot be empty')
        .max(100, 'Character name cannot exceed 100 characters'),
    stats: z.object({
        str: z.number().int().min(0),
        dex: z.number().int().min(0),
        con: z.number().int().min(0),
        int: z.number().int().min(0),
        wis: z.number().int().min(0),
        cha: z.number().int().min(0),
    }),
    hp: z.number().int().min(0),
    maxHp: z.number().int().min(0),
    ac: z.number().int().min(0),
    level: z.number().int().min(1),
    xp: z.number().int().min(0).default(0).describe('Current experience points'),
    characterType: CharacterTypeSchema.optional().default('pc'),

    // PHASE-2: Social Hearing Mechanics - skill bonuses for opposed rolls
    perceptionBonus: z.number().int().optional().default(0)
        .describe('Proficiency bonus for Perception checks (WIS-based)'),
    stealthBonus: z.number().int().optional().default(0)
        .describe('Proficiency bonus for Stealth checks (DEX-based)'),

    // Free-form descriptive labels. No mechanics hang off either of them.
    characterClass: z.string().optional().default('commoner'),
    race: z.string().optional().default('Human')
        .describe('Descriptive kind - any string allowed'),
    conditions: z.array(z.object({
        name: z.string().describe('Condition name (e.g., Poisoned, Frightened)'),
        duration: z.number().int().optional().describe('Duration in rounds'),
        source: z.string().optional().describe('Source of the condition')
    })).optional().default([]),
    position: z.object({
        x: z.number(),
        y: z.number()
    }).optional(),

    // PHASE-1: Spatial Graph System - current room for spatial awareness
    currentRoomId: z.string().uuid().optional()
        .describe('ID of the room the character is currently in'),

    // Damage modifiers, kept as plain labels. Nothing in this repository
    // resolves damage against a character row any more; cultivation combat
    // resolves against a cultivator.
    resistances: z.array(z.string()).optional().default([])
        .describe('Damage types that deal half damage (e.g., ["fire", "cold"])'),
    vulnerabilities: z.array(z.string()).optional().default([])
        .describe('Damage types that deal double damage'),
    immunities: z.array(z.string()).optional().default([])
        .describe('Damage types that deal no damage'),

    // §10.3 forward-compat: generalized resource pools.
    // Operator's attentional_capacity lives here (resourcePools.attentional_capacity).
    // Backwards-compatible - existing 5e characters keep spellSlots untouched.
    resourcePools: z.record(z.string(), z.object({
        current: z.number(),
        max: z.number(),
        lastRefilledAt: z.string().optional(),
    })).optional().default({}),

    // Skill and Save Proficiencies
    skillProficiencies: z.array(SkillProficiencySchema).optional().default([])
        .describe('Skills the character is proficient in'),
    saveProficiencies: z.array(SaveProficiencySchema).optional().default([])
        .describe('Saving throws the character is proficient in'),
    expertise: z.array(z.string()).optional().default([])
        .describe('Skills with double proficiency bonus (rogues, bards)'),
    armorProficiencies: z.array(z.string()).optional().default([])
        .describe('Armor categories the character is proficient with'),
    weaponProficiencies: z.array(z.string()).optional().default([])
        .describe('Weapons or weapon categories the character is proficient with'),
    toolProficiencies: z.array(z.string()).optional().default([])
        .describe('Tools the character is proficient with'),
    languages: z.array(z.string()).optional().default([])
        .describe('Languages the character can speak or understand'),
    currency: CurrencySchema.optional().default({})
        .describe('Character currency in gold, silver, and copper denominations'),

    // Background and alignment - accepted previously but silently dropped on
    // persistence (no migration column). See docs/bastion/05-world-brief-vs-tool-surface.md.
    background: z.string().optional()
        .describe('Character background (e.g. "Soldier", "Charlatan", "Folk Hero")'),
    alignment: z.string().optional()
        .describe('Character alignment (free-form string, e.g. "lawful_good", "chaotic_neutral")'),

    // Bastion-world origin tracker (universe of origin, native-ness, arrival data).
    origin: CharacterOriginSchema.optional()
        .describe('Source universe / Bastion-arrival metadata'),

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type Character = z.infer<typeof CharacterSchema>;

export const NPCSchema = CharacterSchema.extend({
    factionId: z.string().optional(),
    behavior: z.string().optional(),
});

export type NPC = z.infer<typeof NPCSchema>;
