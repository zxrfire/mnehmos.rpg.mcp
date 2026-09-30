import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

const SPENT = 'primal-essence-spent';

/** A personal resource: marriage and rites read the same record. */
export function primalEssenceOf(person: Pick<NpcRecord, 'tags' | 'identity'>): 'yin' | 'yang' | null {
    return person.tags.includes(SPENT) ? null : person.identity.sex === 'female' ? 'yin' : 'yang';
}

export function consumePrimalEssence(world: WorldState, personId: string, onDay: number): boolean {
    const at = world.npcs.findIndex(person => person.id === personId);
    if (at < 0 || primalEssenceOf(world.npcs[at]!) === null) return false;
    const person = world.npcs[at]!;
    world.npcs[at] = { ...person, tags: [...person.tags, SPENT], updatedOnDay: onDay };
    return true;
}
