import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'brk-a', catalog });
advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });

let boards = new Map<string, number>(), winners = 0, sameBracket = 0, cross = 0;
for (const f of state.history.facts) {
    const ps = (f.data as { placings?: unknown })?.placings;
    if (typeof ps !== 'string' || !ps) continue;
    let rows: { place: number; bracket: string; score: number }[];
    try { rows = JSON.parse(ps); } catch { continue; }
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
        if (!r.bracket) continue;
        boards.set(r.bracket, (boards.get(r.bracket) ?? 0) + 1);
        if (r.place === 1) winners++;
    }
    // every board should be internally one realm
    const byBracket = new Map<string, number[]>();
    for (const r of rows) {
        const arr = byBracket.get(r.bracket) ?? []; arr.push(r.place); byBracket.set(r.bracket, arr);
    }
    for (const [, places] of byBracket) {
        if (places.includes(1)) sameBracket++;
    }
    if (byBracket.size > 1) cross++;
}
console.log('placings by realm bracket:');
for (const [k, n] of [...boards.entries()].sort((a,b)=>b[1]-a[1])) console.log('   ', k.padEnd(26), n);
console.log('first places awarded:', winners, '| boards with a winner:', sameBracket,
    '| gatherings with more than one bracket:', cross);
