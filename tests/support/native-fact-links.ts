/** Every present historical participant carries the same fact in their career. */
import type { WorldState } from '../../src/engine/world/world-state.js';
export function missingNativeFactLinks(world: WorldState): string[] {
    const people = new Map(world.npcs.map(person => [person.id, person]));
    const missing: string[] = [];
    for (const fact of world.history.facts) for (const actor of fact.actors) {
        const person = people.get(actor.id);
        if (actor.present !== false && person && !person.historyFactIds.includes(fact.id))
            missing.push(`${person.id} does not carry ${fact.id}: ${fact.summary}`);
    }
    return missing;
}
