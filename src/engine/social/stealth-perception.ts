/**
 * Eavesdropping detection as a D&D 5e opposed check. Speaker rolls Stealth,
 * listener rolls Perception, and ties go to the listener. Older substrate:
 * deliberately not re-exported from `index.js`.
 */

import { Character, NPC } from '../../schema/character.js';

export interface OpposedRollResult {
    speakerRoll: number;           // Raw d20 roll
    speakerModifier: number;       // DEX mod + stealthBonus
    speakerTotal: number;          // Roll + modifier

    listenerRoll: number;          // Raw d20 roll
    listenerModifier: number;      // WIS mod + perceptionBonus + environment
    listenerTotal: number;         // Roll + modifier

    success: boolean;              // Did the listener hear it?
    margin: number;                // How much they beat or missed by
}

/** Ability modifier from an ability score, by the D&D 5e formula. */
export function getModifier(abilityScore: number): number {
    return Math.floor((abilityScore - 10) / 2);
}

/** Unseeded, unlike `socialRoll` in `common.ts`. Not replayable. */
function rollD20(): number {
    return Math.floor(Math.random() * 20) + 1;
}

/**
 * One opposed roll. `environmentModifier` applies to the LISTENER only, and is
 * signed the way `getEnvironmentModifier` returns it: positive helps them hear.
 */
export function rollStealthVsPerception(
    speaker: Character | NPC,
    listener: Character | NPC,
    environmentModifier: number = 0
): OpposedRollResult {
    const speakerRoll = rollD20();
    const dexModifier = getModifier(speaker.stats.dex);
    const speakerStealthBonus = speaker.stealthBonus || 0;
    const speakerModifier = dexModifier + speakerStealthBonus;
    const speakerTotal = speakerRoll + speakerModifier;

    const listenerRoll = rollD20();
    const wisModifier = getModifier(listener.stats.wis);
    const listenerPerceptionBonus = listener.perceptionBonus || 0;
    const listenerModifier = wisModifier + listenerPerceptionBonus + environmentModifier;
    const listenerTotal = listenerRoll + listenerModifier;

    // Ties go to the listener.
    const success = listenerTotal >= speakerTotal;
    const margin = listenerTotal - speakerTotal;

    return {
        speakerRoll,
        speakerModifier,
        speakerTotal,
        listenerRoll,
        listenerModifier,
        listenerTotal,
        success,
        margin
    };
}

/** What the room does to a Perception check. */
export function getEnvironmentModifier(atmospherics: string[]): number {
    let modifier = 0;

    if (atmospherics.includes('SILENCE')) {
        modifier += 5;
    }

    // FOG, DARKNESS and ANTIMAGIC deliberately return nothing: none of them
    // touch natural hearing.

    return modifier;
}

export function isDeafened(character: Character | NPC): boolean {
    return character.conditions?.some(c => c.name === 'DEAFENED') || false;
}

/** One speaker against many listeners. Deafened listeners are absent, not false. */
export function batchRollStealthVsPerception(
    speaker: Character | NPC,
    listeners: Array<Character | NPC>,
    environmentModifier: number = 0
): Map<string, OpposedRollResult> {
    const results = new Map<string, OpposedRollResult>();

    for (const listener of listeners) {
        if (isDeafened(listener)) {
            continue;
        }

        const result = rollStealthVsPerception(speaker, listener, environmentModifier);
        results.set(listener.id, result);
    }

    return results;
}
