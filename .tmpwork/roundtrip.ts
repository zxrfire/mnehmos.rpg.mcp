import Database from 'better-sqlite3';
import { migrate } from '../src/storage/migrations.js';
import { migrateWorld } from '../src/storage/migrations.world.js';
import { WorldStateRepository } from '../src/storage/repos/world-state.repo.js';
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const db = new Database(':memory:');
migrate(db);
migrateWorld(db);
const repo = new WorldStateRepository(db);

const state = seedWorld({ seed: 'repo-long', catalog: await loadCultivationCatalog(), presentYear: 1000, population: 200 }).state;
const advanced = advanceWorldYears(state, 500).state;
repo.saveWorld(advanced);
const loaded = repo.loadWorld(advanced.id)!;

// Which top-level collection differs, and by how much.
const keys = Object.keys(advanced) as (keyof typeof advanced)[];
for (const k of keys) {
    const a = JSON.stringify((advanced as any)[k]);
    const b = JSON.stringify((loaded as any)[k]);
    if (a !== b) {
        const av = (advanced as any)[k];
        const bv = (loaded as any)[k];
        console.log(
            String(k).padEnd(16),
            'DIFFERS.',
            Array.isArray(av) ? `saved ${av.length} rows, loaded ${bv?.length}` : 'not an array',
            `| json ${a?.length} vs ${b?.length}`
        );
    }
}

// And inside objects, which field.
const byId = new Map(loaded.objects.map(o => [o.id, o]));
let claims = 0, prov = 0, other = 0;
for (const saved of advanced.objects) {
    const back = byId.get(saved.id);
    if (!back) { other++; continue; }
    if (JSON.stringify(saved.claims) !== JSON.stringify(back.claims)) claims++;
    if (JSON.stringify(saved.provenance) !== JSON.stringify(back.provenance)) prov++;
}
console.log('\nobjects: claims differ on', claims, '| provenance differs on', prov, '| missing', other);

// One example.
for (const saved of advanced.objects) {
    const back = byId.get(saved.id);
    if (back && JSON.stringify(saved.provenance) !== JSON.stringify(back.provenance)) {
        console.log('\nexample', saved.id);
        console.log('  saved links :', saved.provenance.length, saved.provenance.map(p => p.how).join(','));
        console.log('  loaded links:', back.provenance.length, back.provenance.map(p => p.how).join(','));
        break;
    }
}
db.close();

// ORDER OR CONTENT?
const savedIds = advanced.locations.map(l => l.id);
const loadedIds = loaded.locations.map(l => l.id);
console.log('\nlocations same set:', JSON.stringify([...savedIds].sort()) === JSON.stringify([...loadedIds].sort()));
console.log('locations same order:', JSON.stringify(savedIds) === JSON.stringify(loadedIds));
for (let i = 0; i < savedIds.length; i++) {
    if (savedIds[i] !== loadedIds[i]) { console.log('  first divergence at', i, savedIds[i], 'vs', loadedIds[i]); break; }
}

const hk = Object.keys(advanced.history) as (keyof typeof advanced.history)[];
for (const k of hk) {
    const a = JSON.stringify((advanced.history as any)[k]);
    const b = JSON.stringify((loaded.history as any)[k]);
    if (a !== b) console.log('history.' + String(k), 'differs; lengths', a?.length, b?.length);
}

function firstDiff(a: string, b: string, label: string) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
            console.log('\n' + label + ' first differs at char', i);
            console.log('  saved : ...' + a.slice(Math.max(0, i - 90), i + 90));
            console.log('  loaded: ...' + b.slice(Math.max(0, i - 90), i + 90));
            return;
        }
    }
}
firstDiff(JSON.stringify(advanced.history.eras), JSON.stringify(loaded.history.eras), 'eras');
firstDiff(JSON.stringify(advanced.locations), JSON.stringify(loaded.locations), 'locations');

// A real deep diff, ignoring key order.
function walk(a: any, b: any, path: string, out: string[]) {
    if (out.length > 12) return;
    if (a === b) return;
    if (typeof a !== typeof b) { out.push(`${path}: type ${typeof a} vs ${typeof b}`); return; }
    if (a === null || b === null) { out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); return; }
    if (Array.isArray(a)) {
        if (a.length !== b.length) { out.push(`${path}: length ${a.length} vs ${b.length}`); return; }
        for (let i = 0; i < a.length; i++) walk(a[i], b[i], `${path}[${i}]`, out);
        return;
    }
    if (typeof a === 'object') {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of keys) walk(a[k], b[k], `${path}.${k}`, out);
        return;
    }
    out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
}
const diffs: string[] = [];
walk(advanced, loaded, 'world', diffs);
console.log('\nREAL DIFFERENCES:');
for (const d of diffs) console.log('  ' + d);
if (diffs.length === 0) console.log('  none - the failure is key order only');

// WHICH OBJECTS ARE LOST
const backIds = new Set(loaded.objects.map(o => o.id));
const lost = advanced.objects.filter(o => !backIds.has(o.id));
console.log('\nLOST ON RELOAD:', lost.length);
const byKind = new Map<string, number>();
for (const o of lost) byKind.set(o.kind, (byKind.get(o.kind) ?? 0) + 1);
for (const [k, n] of byKind) console.log('  kind', k, n);
console.log('  sample ids:', lost.slice(0, 5).map(o => o.id).join(', '));
const dupIds = advanced.objects.length - new Set(advanced.objects.map(o => o.id)).size;
console.log('  duplicate ids in memory:', dupIds);

const seenIds = new Map<string, number>();
for (const o of advanced.objects) seenIds.set(o.id, (seenIds.get(o.id) ?? 0) + 1);
const dups = [...seenIds.entries()].filter(([, n]) => n > 1);
console.log('\nDUPLICATED OBJECTS:', dups.length);
for (const [id, n] of dups.slice(0, 6)) {
    const copies = advanced.objects.filter(o => o.id === id);
    console.log(' ', id, 'x' + n,
        '| kinds', copies.map(c => c.kind).join(','),
        '| owners', copies.map(c => c.ownerId ?? 'null').join(','),
        '| holders', copies.map(c => c.possessorId ?? 'null').join(','),
        '| links', copies.map(c => c.provenance.length).join(','));
}
