import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';

const { state } = seedWorld({ seed: 'ordinal-audit', catalog: await loadCultivationCatalog() });
const objects: any[] = (state as any).objects ?? [];
const byKind = new Map<string, { total: number; withOrdinal: number }>();
for (const o of objects) {
    const row = byKind.get(o.kind) ?? { total: 0, withOrdinal: 0 };
    row.total++;
    if (o.power !== null && o.power !== undefined) row.withOrdinal++;
    byKind.set(o.kind, row);
}
console.log('objects in a seeded world:', objects.length, '\n');
for (const [kind, row] of [...byKind.entries()].sort((a, b) => b[1].total - a[1].total)) {
    const pct = row.total === 0 ? 0 : (100 * row.withOrdinal) / row.total;
    console.log(kind.padEnd(12), String(row.total).padStart(5),
        'with an ordinal:', String(row.withOrdinal).padStart(5), '(' + pct.toFixed(1) + '%)');
}
