import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'places-probe', catalog });
const locs = [...(state.locations ?? [])] as any[];
const byId = new Map(locs.map(l => [l.id, l]));
const depth = (l: any): number => (l.parentId && byId.has(l.parentId) ? 1 + depth(byId.get(l.parentId)) : 0);

const kinds = new Map<string, number>();
const depths = new Map<number, number>();
for (const l of locs) {
    kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + 1);
    const d = depth(l);
    depths.set(d, (depths.get(d) ?? 0) + 1);
}
console.log('locations:', locs.length);
console.log('kinds:', [...kinds].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join(', '));
console.log('nesting depth:', [...depths].sort().map(([d, n]) => `depth ${d}: ${n}`).join(', '));
const seat = locs.find(l => l.kind === 'sect_seat');
if (seat) {
    console.log(`\na sect seat: ${seat.name}`);
    console.log('  children:', locs.filter(l => l.parentId === seat.id).map(l => `${l.name} (${l.kind})`).join(', ') || 'NONE');
    console.log('  links:', (seat.links ?? []).map((k: any) => `${k.kind}->${byId.get(k.toLocationId)?.name ?? k.toLocationId}`).join(', ') || 'NONE');
}
