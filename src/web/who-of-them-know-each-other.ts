/**
 * Which of the people who introduced themselves together know each other.
 *
 * Stated so the narrator can have one name the other ("I am X, and this is
 * Y"); strangers answer separately. A tie the world wrote down, or one roll
 * shared, is knowing each other. Nothing else is.
 */

import type { NpcRelationship } from '../engine/world/npc-state.js';

export interface SomebodyWhoAnswered {
    id: string;
    name: string;
    /** Their house, where they are on a roll. */
    sectId: string | null;
}

export function whoOfThemKnowEachOther(
    answered: readonly SomebodyWhoAnswered[],
    tiesOf: (id: string) => readonly Pick<NpcRelationship, 'targetId'>[]
): string[] {
    const lines: string[] = [];
    for (let i = 0; i < answered.length; i++) {
        for (let j = i + 1; j < answered.length; j++) {
            const a = answered[i]!;
            const b = answered[j]!;
            const tied = tiesOf(a.id).some(tie => tie.targetId === b.id)
                || tiesOf(b.id).some(tie => tie.targetId === a.id);
            const oneRoll = a.sectId !== null && a.sectId === b.sectId;
            if (tied || oneRoll) lines.push(`${a.name} and ${b.name} know each other.`);
        }
    }
    return lines;
}
