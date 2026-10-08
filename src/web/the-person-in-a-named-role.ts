/** Anonymous ordinary work is addressable without learning the worker's name. */
import { OCCUPATIONS } from '../data/cultivation/mortal-world.js';
import { ordinaryProfessionOf } from '../engine/world/the-work-an-ordinary-mortal-does.js';

import type { WorldState } from '../engine/world/world-state.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';

// These are readings of catalog words, not a second profession/alias catalog.
const roleWords = new Map<string, Set<string>>();
for (const job of OCCUPATIONS) {
    const words = [job.name.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').trim(),
        job.id.replace(/^job-/, '').replace(/^mortal-/, '').replace(/-/g, ' ')];
    for (const word of words) {
        const ids = roleWords.get(word) ?? new Set<string>(); ids.add(job.id); roleWords.set(word, ids);
    }
}
export function theOrdinaryRoleNamed(said: string): ReadonlySet<string> | null {
    return roleWords.get(said.trim().toLowerCase().replace(/^(?:the|a|an|that|this)\s+/, '')) ?? null;
}
/** Only the actual capped roster may supply a listener. Hidden identity is not a role. */
export function thePersonInThatOrdinaryRole(
    said: string, present: readonly RosterEntry[],
    world: Pick<WorldState, 'locations' | 'npcs' | 'seed' | 'currentDay' | 'currentHour'> | null
): RosterEntry | null {
    const named = theOrdinaryRoleNamed(said);
    if (!named || !world) return null;
    const byId = new Map(world.npcs.map(npc => [npc.id, npc]));
    const matches = present.filter(person => {
        const npc = byId.get(person.id);
        if (!npc || npc.status !== 'alive') return false;
        const work = ordinaryProfessionOf(npc);
        if (!work || !named.has(work.id)) return false;
        return true;
    });
    return matches.length === 1 ? matches[0] : null;
}
