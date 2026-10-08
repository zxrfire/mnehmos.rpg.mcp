/**
 * Residence05 native run passed29/30 but broken reinforcement never reached
 * engine.reinforceADoor. Source trace found craft missing from TARGETED_ACTIONS:
 * validatePlan dropped the noun although the native craft executor reads target.
 * Register that existing ownership once. Printed catalog material names must
 * reach the action; an untargeted craft must remain the existing bench read.
 * These pure controls do not assert a schema membership or invent a door parser.
 */
import { expect, it } from 'vitest';
import { BEAST_MATERIALS } from '../../src/data/cultivation/beasts.js';
import { validatePlan } from '../../src/web/planned-action.js';

it('a model craft plan preserves the full printed catalog material noun', () => {
    const part = BEAST_MATERIALS[0]!;
    const noun = `reinforce the door with the ${part.name}`;
    const result = validatePlan({ action: 'craft', target: noun });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.action.target).toBe(noun);
});
it('an untargeted model craft plan remains an untargeted bench read', () => {
    const result = validatePlan({ action: 'craft' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.action.action).toBe('craft');
    expect(result.action.target).toBeUndefined();
});
