import { z } from 'zod';

/** A corpse: where it fell, what it still carries, and how far it has gone. */

export const CorpseStateSchema = z.enum(['fresh', 'decaying', 'skeletal', 'gone']);
export type CorpseState = z.infer<typeof CorpseStateSchema>;

export const CorpseSchema = z.object({
    id: z.string(),
    characterId: z.string().describe('Original character/creature ID'),
    characterName: z.string(),
    characterType: z.enum(['pc', 'npc', 'enemy', 'neutral']),

    // Location
    worldId: z.string().nullable(),
    regionId: z.string().nullable(),
    position: z.object({
        x: z.number(),
        y: z.number()
    }).nullable(),
    encounterId: z.string().nullable().describe('Encounter where death occurred'),

    // State
    state: CorpseStateSchema.default('fresh'),
    stateUpdatedAt: z.string().datetime(),

    // Loot
    lootGenerated: z.boolean().default(false),
    looted: z.boolean().default(false),
    lootedBy: z.string().nullable(),
    lootedAt: z.string().datetime().nullable(),

    // Currency
    currency: z.object({
        gold: z.number().int().min(0).default(0),
        silver: z.number().int().min(0).default(0),
        copper: z.number().int().min(0).default(0)
    }).default({ gold: 0, silver: 0, copper: 0 }),
    currencyLooted: z.boolean().default(false),

    // Harvesting
    harvestable: z.boolean().default(false),
    harvestableResources: z.array(z.object({
        resourceType: z.string(),
        quantity: z.number().int(),
        harvested: z.boolean().default(false)
    })).default([]),

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

export type Corpse = z.infer<typeof CorpseSchema>;

// Corpse decay rules (in game hours)
export const CORPSE_DECAY_RULES = {
    fresh_to_decaying: 24,    // 1 day
    decaying_to_skeletal: 168, // 1 week
    skeletal_to_gone: 720      // 30 days
};
