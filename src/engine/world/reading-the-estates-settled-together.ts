/** A lifespan batch reads possessions and bonds once, before settling its deaths. */
import { isAStackOfCommunicationTalismans, whoseSlipsTheyAre } from './a-communication-talisman-carries-word-home.js';
import { indexById, type WorldState } from './world-state.js';

export function readDeathsTogether(state: WorldState) {
    const here = new Map<string | null, string[]>();
    const bonds = new Map<string, string[]>();
    const carrying = new Map<string, Set<string>>();
    const keyed = new Map<string, Set<string>>();
    const add = (map: Map<string, Set<string>>, holder: string | null, id: string) => {
        if (holder === null) return;
        const rows = map.get(holder) ?? new Set<string>();
        rows.add(id); map.set(holder, rows);
    };
    for (const npc of state.npcs) {
        const rows = here.get(npc.locationId) ?? [];
        rows.push(npc.id); here.set(npc.locationId, rows);
        for (const target of new Set(npc.relationships.filter(r => r.kind === 'master' || r.kind === 'disciple')
            .map(r => r.targetId))) {
            const held = bonds.get(target) ?? [];
            held.push(npc.id); bonds.set(target, held);
        }
    }
    for (const object of state.objects) {
        add(carrying, object.possessorId, object.id);
        if (typeof object.data.keyedTo === 'string') add(keyed, object.data.keyedTo, object.id);
        if (isAStackOfCommunicationTalismans(object)) add(keyed, whoseSlipsTheyAre(object), object.id);
    }
    const objectsFor = (map: Map<string, Set<string>>, id: string) => [...map.get(id) ?? []]
        .map(key => indexById(state.objects, key)).filter(at => at >= 0).sort((a, b) => a - b);
    return { here, bonds,
        keyed: (id: string) => objectsFor(keyed, id),
        carrying: (id: string) => objectsFor(carrying, id).map(at => state.objects[at]!),
        moved: (before: (typeof state.objects)[number] | undefined, after: (typeof state.objects)[number]) => {
            if (before?.possessorId) carrying.get(before.possessorId)?.delete(before.id);
            add(carrying, after.possessorId, after.id);
        }
    };
}
