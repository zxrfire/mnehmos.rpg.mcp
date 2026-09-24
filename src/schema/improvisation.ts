/**
 * Custom effects: boons, curses and transformations applied to a person and
 * carried on the `custom_effects` table.
 */

import { z } from 'zod';

export const ActorTypeSchema = z.enum(['character', 'npc']);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const SourceTypeSchema = z.enum(['divine', 'arcane', 'natural', 'cursed', 'psionic', 'unknown']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const EffectCategorySchema = z.enum(['boon', 'curse', 'neutral', 'transformative']);
export type EffectCategory = z.infer<typeof EffectCategorySchema>;

export const PowerLevelSchema = z.number().int().min(1).max(5);
export type PowerLevel = z.infer<typeof PowerLevelSchema>;

export const MechanicTypeSchema = z.enum([
    'attack_bonus', 'damage_bonus', 'ac_bonus', 'saving_throw_bonus', 'skill_bonus',
    'advantage_on', 'disadvantage_on',
    'damage_resistance', 'damage_vulnerability', 'damage_immunity',
    'damage_over_time', 'healing_over_time',
    'extra_action', 'prevent_action', 'movement_modifier',
    'sense_granted', 'sense_removed', 'speak_language', 'cannot_speak',
    'custom_trigger'
]);
export type MechanicType = z.infer<typeof MechanicTypeSchema>;

export const EffectMechanicSchema = z.object({
    type: MechanicTypeSchema,
    value: z.union([z.number(), z.string()]),
    condition: z.string().optional().describe('e.g., "against undead"')
});
export type EffectMechanic = z.infer<typeof EffectMechanicSchema>;

export const DurationTypeSchema = z.enum(['rounds', 'minutes', 'hours', 'days', 'permanent', 'until_removed']);
export type DurationType = z.infer<typeof DurationTypeSchema>;

export const TriggerEventSchema = z.enum([
    'always_active', 'start_of_turn', 'end_of_turn',
    'on_attack', 'on_hit', 'on_miss',
    'on_damage_taken', 'on_heal', 'on_rest',
    'on_spell_cast', 'on_death'
]);
export type TriggerEvent = z.infer<typeof TriggerEventSchema>;

export const EffectTriggerSchema = z.object({
    event: TriggerEventSchema,
    condition: z.string().optional()
});
export type EffectTrigger = z.infer<typeof EffectTriggerSchema>;

export const RemovalConditionTypeSchema = z.enum([
    'duration_expires', 'dispelled', 'specific_action', 'quest_complete', 'death', 'rest'
]);

export const RemovalConditionSchema = z.object({
    type: RemovalConditionTypeSchema,
    description: z.string().optional(),
    difficulty_class: z.number().int().optional()
});
export type RemovalCondition = z.infer<typeof RemovalConditionSchema>;

export const CustomEffectSourceSchema = z.object({
    type: SourceTypeSchema,
    entity_id: z.string().optional(),
    entity_name: z.string().optional()
});

export const CustomEffectDurationSchema = z.object({
    type: DurationTypeSchema,
    value: z.number().int().optional()
});

export const ApplyCustomEffectArgsSchema = z.object({
    target_id: z.string(),
    target_type: ActorTypeSchema,
    name: z.string(),
    description: z.string(),
    source: CustomEffectSourceSchema,
    category: EffectCategorySchema,
    power_level: PowerLevelSchema,
    mechanics: z.array(EffectMechanicSchema),
    duration: CustomEffectDurationSchema,
    triggers: z.array(EffectTriggerSchema),
    removal_conditions: z.array(RemovalConditionSchema),
    stackable: z.boolean().optional().default(false),
    max_stacks: z.number().int().min(1).optional().default(1)
});
export type ApplyCustomEffectArgs = z.infer<typeof ApplyCustomEffectArgsSchema>;

export const CustomEffectSchema = z.object({
    id: z.number().int(),
    target_id: z.string(),
    target_type: ActorTypeSchema,
    name: z.string(),
    description: z.string().nullable(),
    source_type: SourceTypeSchema,
    source_entity_id: z.string().nullable(),
    source_entity_name: z.string().nullable(),
    category: EffectCategorySchema,
    power_level: PowerLevelSchema,
    mechanics: z.array(EffectMechanicSchema),
    duration_type: DurationTypeSchema,
    duration_value: z.number().int().nullable(),
    rounds_remaining: z.number().int().nullable(),
    triggers: z.array(EffectTriggerSchema),
    removal_conditions: z.array(RemovalConditionSchema),
    stackable: z.boolean(),
    max_stacks: z.number().int(),
    current_stacks: z.number().int(),
    is_active: z.boolean(),
    created_at: z.string(),
    expires_at: z.string().nullable()
});
export type CustomEffect = z.infer<typeof CustomEffectSchema>;
