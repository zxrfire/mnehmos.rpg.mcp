/**
 * Held attention: an effect somebody is actively sustaining.
 *
 * What survived of the retired spellcasting layer, and it survived because the
 * Operator's constraint-perception lens reads it. `perception_manage` refuses
 * an assessment from an observer who is already holding something, on the
 * grounds that looking properly and sustaining an effect compete for the same
 * attention. That rule is about attention, not about spells, and it outlived
 * the engine that used to write these rows.
 *
 * Nothing in the engine writes here any more. When sustained cultivation arts
 * arrive they should write here rather than growing a second table.
 */

import { z } from 'zod';
export const ConcentrationStateSchema = z.object({
    characterId: z.string(),
    activeSpell: z.string(), // Spell name
    spellLevel: z.number().int().min(0).max(9),
    targetIds: z.array(z.string()).optional(), // Targets affected by the spell
    startedAt: z.number().int().min(1), // Round number when concentration started
    maxDuration: z.number().int().optional(), // Maximum rounds (null = indefinite)
    saveDCBase: z.number().int().default(10), // Base DC for concentration saves (min 10 or half damage)
});

export type ConcentrationState = z.infer<typeof ConcentrationStateSchema>;

/** Result of a concentration check (saving throw) */
export const ConcentrationCheckResultSchema = z.object({
    characterId: z.string(),
    spell: z.string(),
    broken: z.boolean(),
    reason: z.enum(['damage', 'incapacitated', 'death', 'new_spell', 'voluntary', 'duration', 'failed_save']),
    saveRoll: z.number().int().optional(), // d20 roll result
    saveDC: z.number().int().optional(), // DC of the save
    saveTotal: z.number().int().optional(), // Roll + modifier
    damageAmount: z.number().int().optional(), // Damage that triggered the check
    constitutionModifier: z.number().int().optional(),
});

export type ConcentrationCheckResult = z.infer<typeof ConcentrationCheckResultSchema>;

/** Request to break concentration (manual or automatic) */
export const BreakConcentrationRequestSchema = z.object({
    characterId: z.string(),
    reason: z.enum(['damage', 'incapacitated', 'death', 'new_spell', 'voluntary', 'duration']),
    damageAmount: z.number().int().optional(), // Required if reason is 'damage'
});

export type BreakConcentrationRequest = z.infer<typeof BreakConcentrationRequestSchema>;
