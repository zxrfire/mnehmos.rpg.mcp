/**
 * Reusable Zod field patterns, spread or referenced by the other schema modules
 * so a validation rule changes in one place.
 *
 * @module schema/base-schemas
 */

import { z } from 'zod';

// IDENTIFIERS

export const IdField = z.string().min(1, 'ID cannot be empty');

export const UuidField = z.string().uuid('Must be a valid UUID');

export const WorldIdField = z.string().describe('World this entity belongs to');

/** Optional, for entities that may not be region-linked. */
export const RegionIdField = z.string().optional().describe('Region containing this entity');

export const CharacterIdField = z.string().describe('Character ID reference');

// TIMESTAMPS

/** ISO 8601 datetime. */
export const DateTimeField = z.string().datetime();

/** Spread into object schemas that need createdAt/updatedAt. */
export const TimestampFields = {
    createdAt: DateTimeField,
    updatedAt: DateTimeField,
} as const;

export const LastVisitedField = z.string().datetime().optional();

// COORDINATES & SPATIAL

export const GridXField = z.number().int().min(0).describe('World grid X coordinate');

export const GridYField = z.number().int().min(0).describe('World grid Y coordinate');

export const GridCoordinates = z.object({
    x: GridXField,
    y: GridYField,
});

/** Combat/tactical position. Floating point, unlike the world grid. */
export const TacticalPosition = z.object({
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
});

export type TacticalPositionType = z.infer<typeof TacticalPosition>;

/** Bounding box for spatial queries. */
export const BoundingBox = z.object({
    minX: z.number().int().min(0),
    maxX: z.number().int().min(0),
    minY: z.number().int().min(0),
    maxY: z.number().int().min(0),
});

export type BoundingBoxType = z.infer<typeof BoundingBox>;

// NAMES & TEXT FIELDS

export const NameField = z.string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name cannot exceed 100 characters')
    .refine(s => s.trim().length > 0, 'Name cannot be whitespace only');

/** For tooltips and summaries. */
export const ShortDescriptionField = z.string()
    .max(500, 'Description too long')
    .optional();

/** For detailed content. */
export const LongDescriptionField = z.string()
    .min(10, 'Description must be detailed')
    .max(2000, 'Description too long')
    .refine(s => s.trim().length >= 10, 'Description must have at least 10 non-whitespace characters');

// NUMERIC FIELDS

export const NonNegativeInt = z.number().int().min(0);

export const PositiveInt = z.number().int().min(1);

export const PopulationField = z.number().int().min(0).describe('Population count');

/** Character level, 1-20 for standard D&D. */
export const LevelField = z.number().int().min(1).max(20);

/** Difficulty Class, 5-30 standard range. */
export const DCField = z.number().int().min(5).max(30);

export const HpField = z.number().int().min(0);

export const AcField = z.number().int().min(0);

/** 0-1 as a decimal. */
export const PercentageField = z.number().min(0).max(1);

/** 0-100 as an integer. */
export const PercentageInt = z.number().int().min(0).max(100);

// D&D ABILITY SCORES

/** A single score, typically 1-30. */
export const AbilityScoreField = z.number().int().min(0).max(30);

export const AbilityScores = z.object({
    str: AbilityScoreField,
    dex: AbilityScoreField,
    con: AbilityScoreField,
    int: AbilityScoreField,
    wis: AbilityScoreField,
    cha: AbilityScoreField,
});

export type AbilityScoresType = z.infer<typeof AbilityScores>;

export const SaveProficiencyEnum = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']);

export const SkillProficiencyEnum = z.enum([
    'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception',
    'history', 'insight', 'intimidation', 'investigation', 'medicine',
    'nature', 'perception', 'performance', 'persuasion', 'religion',
    'sleight_of_hand', 'stealth', 'survival'
]);

// SIZE CATEGORIES

/** Named BaseSizeCategory to avoid a conflict with encounter.ts SizeCategory. */
export const BaseSizeCategory = z.enum([
    'tiny',      // 2.5ft, shares space
    'small',     // 5ft, 1 square
    'medium',    // 5ft, 1 square
    'large',     // 10ft, 2x2 squares
    'huge',      // 15ft, 3x3 squares
    'gargantuan' // 20ft+, 4x4+ squares
]);

export type BaseSizeCategoryType = z.infer<typeof BaseSizeCategory>;

// DAMAGE & EFFECTS

/** Named BaseDamageType to avoid a conflict with spell.ts DamageType. */
export const BaseDamageTypeEnum = z.enum([
    'slashing', 'piercing', 'bludgeoning',
    'fire', 'cold', 'lightning', 'thunder',
    'acid', 'poison', 'necrotic', 'radiant',
    'psychic', 'force'
]);

export type BaseDamageType = z.infer<typeof BaseDamageTypeEnum>;

/** For resistances, immunities, vulnerabilities. */
export const BaseDamageTypeArray = z.array(BaseDamageTypeEnum).default([]);

export const ConditionTypeEnum = z.enum([
    'blinded', 'charmed', 'deafened', 'frightened',
    'grappled', 'incapacitated', 'invisible', 'paralyzed',
    'petrified', 'poisoned', 'prone', 'restrained',
    'stunned', 'unconscious', 'exhaustion'
]);

export type ConditionType = z.infer<typeof ConditionTypeEnum>;

// CURRENCY

export const CurrencyFields = z.object({
    gold: z.number().int().min(0).default(0),
    silver: z.number().int().min(0).default(0),
    copper: z.number().int().min(0).default(0),
}).default({});

export type CurrencyType = z.infer<typeof CurrencyFields>;

// COMBAT & ENCOUNTER

export const EncounterStatusEnum = z.enum(['active', 'completed', 'paused']);

/** In feet. */
export const MovementSpeedField = z.number().int().min(0).default(30);

export const InitiativeBonusField = z.number().int();

// DISCOVERY & VISIBILITY

export const DiscoveryStateEnum = z.enum([
    'unknown',      // Not yet discovered
    'rumored',      // Heard about but not visited
    'discovered',   // Visited at least once
    'explored',     // Fully explored
    'mapped'        // Detailed notes created
]);

export type DiscoveryState = z.infer<typeof DiscoveryStateEnum>;

// EXIT & CONNECTION TYPES

export const DirectionEnum = z.enum([
    'north', 'south', 'east', 'west',
    'up', 'down',
    'northeast', 'northwest', 'southeast', 'southwest'
]);

export type Direction = z.infer<typeof DirectionEnum>;

export const ExitTypeEnum = z.enum(['OPEN', 'LOCKED', 'HIDDEN']);

/** Cover types for combat props. */
export const CoverTypeEnum = z.enum(['none', 'half', 'three_quarter', 'full']);

// HELPER FUNCTIONS

/** An entity schema with a string id and timestamps around `fields`. */
export function createEntitySchema<T extends z.ZodRawShape>(fields: T) {
    return z.object({
        id: IdField,
        ...fields,
        ...TimestampFields,
    });
}

/** As `createEntitySchema`, with a UUID id. */
export function createUuidEntitySchema<T extends z.ZodRawShape>(fields: T) {
    return z.object({
        id: UuidField,
        ...fields,
        ...TimestampFields,
    });
}

/** As `createEntitySchema`, plus worldId, optional regionId, and grid coordinates. */
export function createWorldEntitySchema<T extends z.ZodRawShape>(fields: T) {
    return z.object({
        id: IdField,
        worldId: WorldIdField,
        regionId: RegionIdField,
        x: GridXField,
        y: GridYField,
        ...fields,
        ...TimestampFields,
    });
}
