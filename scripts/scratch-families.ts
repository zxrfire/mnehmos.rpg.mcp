/** What a lineage record holds today, and whether its members are kin at all. */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { heirsOf } from '../src/engine/world/lineage.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const KIN = new Set(['parent', 'child', 'kin', 'spouse']);

function report(state: WorldState, label: string): void {
    const byId = new Map(state.npcs.map(n => [n.id, n]));
    const kin = (a: string, b: string) => {
        const one = byId.get(a);
        return one !== undefined && one.relationships.some(r => r.targetId === b && KIN.has(r.kind));
    };
    let edges = 0;
    let edgesWithNoTie = 0;
    let members = 0;
    let sameName = 0;
    for (const lineage of state.lineages) {
        members += lineage.memberIds.length;
        for (const edge of lineage.edges) {
            edges++;
            if (!kin(edge.parentId, edge.childId) && !kin(edge.childId, edge.parentId)) edgesWithNoTie++;
        }
        const names = new Set(lineage.memberIds.map(id => byId.get(id)?.name.split(' ')[0] ?? '?'));
        if (names.size === 1) sameName++;
    }
    const withHeirs = state.npcs.filter(npc => {
        const line = state.lineages.find(l => l.memberIds.includes(npc.id));
        return line !== undefined && heirsOf(line, npc.id, id => byId.get(id)?.status === 'alive').length > 0;
    }).length;
    const biggest = Math.max(0, ...state.lineages.map(l => l.memberIds.length));
    console.log(`${label}: lineages ${state.lineages.length}, members ${members}, biggest ${biggest}, `
        + `edges ${edges}, edges between people with no kin tie ${edgesWithNoTie}, `
        + `one-surname lineages ${sameName}, people with a living heir ${withHeirs}`);
}

const catalog = await loadCultivationCatalog();
for (const seed of (process.argv[2] ?? 'fam-a,fam-b,fam-c').split(',')) {
    const { state } = seedWorld({ seed, catalog });
    report(state, `${seed} at open`);
    if (process.argv[3]) {
        advanceWorldYears(state, Number(process.argv[3]), { stopOnInterrupt: false });
        report(state, `${seed} after ${process.argv[3]}y`);
    }
}
