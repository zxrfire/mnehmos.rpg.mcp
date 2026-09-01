/**
 * How high can each house's own library carry one of its disciples?
 *
 * The design rule is that a low house cannot produce a high cultivator, and the
 * mechanism is meant to be the manual: you climb as far as your book goes and
 * then you need a new one. Every sect declares `teaches` - its entire working
 * library - and every cultivation manual declares a `cap`. So the ceiling a
 * house can offer is a fact already in the catalog, and this reads it out.
 */
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { SECTS } from '../src/data/cultivation/sects.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';

const catalog = await loadCultivationCatalog();
const power = new Map(catalog.factions.map(f => [f.id, f.powerOrdinal]));

type Row = { name: string; power: number; taught: number; manuals: number; cap: number; best: string };
const rows: Row[] = [];
for (const s of SECTS as any[]) {
    const taught = (s.teaches ?? []) as string[];
    let cap = 0, manuals = 0, best = '-';
    for (const id of taught) {
        const t: any = getTechnique(id);
        if (!t) continue;
        if (t.class !== 'cultivation') continue;
        manuals++;
        const c = Number(t.cap ?? 0);
        if (c > cap) { cap = c; best = t.name ?? id; }
    }
    rows.push({ name: s.name, power: power.get(s.id) ?? 0, taught: taught.length, manuals, cap, best });
}
rows.sort((a, b) => b.cap - a.cap || b.power - a.power);
console.log('house'.padEnd(32) + 'power'.padStart(6) + 'taught'.padStart(7) + 'manuals'.padStart(8) + 'bestCap'.padStart(8) + '  best manual');
for (const r of rows) {
    console.log(r.name.slice(0, 31).padEnd(32) + String(r.power).padStart(6) + String(r.taught).padStart(7)
        + String(r.manuals).padStart(8) + String(r.cap).padStart(8) + '  ' + r.best.slice(0, 34));
}
const noManual = rows.filter(r => r.manuals === 0).length;
console.log(`\nhouses teaching NO cultivation manual at all: ${noManual} of ${rows.length}`);
console.log(`highest cap any house can teach: ${Math.max(...rows.map(r => r.cap))}`);
console.log(`houses whose bestCap is below their own powerOrdinal: `
    + rows.filter(r => r.cap < r.power).length);

// ── What the world now holds ────────────────────────────────────────────────
const { seedWorld } = await import('../src/engine/world/seeding.js');
const { manualCeilingOf } = await import('../src/engine/world/manuals.js');
const { state } = seedWorld({ seed: 'books-probe', catalog });

const manuals = (state.objects as any[]).filter(o => o.kind === 'manual');
const copies = manuals.reduce((n, o) => n + Number(o.data?.copies ?? 1), 0);
console.log(`\nWORLD AFTER SEEDING`);
console.log(`  objects in the world:        ${(state.objects as any[]).length}`);
console.log(`  manual holdings:             ${manuals.length}  (${copies} physical copies)`);

const alive = (state.npcs as any[]).filter(n => n.status === 'alive');
const withBooks = alive.filter(n => n.cultivation.techniqueIds.length > 0);
const chosen = alive.filter(n => n.tags.includes('chosen'));
console.log(`  living cultivators:          ${alive.length}`);
console.log(`  holding anything at all:     ${withBooks.length}`);
console.log(`  the chosen:                  ${chosen.length}`);

const banded = new Map<string, number>();
for (const n of alive) {
    const c = manualCeilingOf(n);
    const key = c === 0 ? 'no road' : c <= 13 ? 'to 13' : c <= 21 ? 'to 21' : c <= 29 ? 'to 29' : c <= 37 ? 'to 37' : 'to 44';
    banded.set(key, (banded.get(key) ?? 0) + 1);
}
console.log('  ceiling their road gives them: '
    + [...banded].sort().map(([k, v]) => `${k}: ${v}`).join('   '));

const blank = alive.filter(n => n.cultivation.realmOrdinal > 0 && n.cultivation.techniqueIds.length === 0);
console.log(`  climbed above 0 but hold nothing: ${blank.length}`);
