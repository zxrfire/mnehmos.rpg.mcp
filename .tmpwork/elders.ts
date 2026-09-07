import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';
import { isElderRank } from '../src/engine/cultivation/leadership.js';
import { getSect } from '../src/data/cultivation/sects.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'eld-a', catalog });
advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });

let elders = 0, idleElders = 0, busyElders = 0;
const doing = new Map<string, number>();
for (const n of state.npcs) {
    if (n.status !== 'alive' || !n.factionId) continue;
    const ranks = getSect(n.factionId)?.ranks.length ?? 0;
    if (ranks === 0 || !isElderRank(n.factionRankIndex, ranks)) continue;
    elders++;
    const k = n.activity?.kind ?? '(nothing at all)';
    doing.set(k, (doing.get(k) ?? 0) + 1);
    if (n.activity === null) idleElders++; else busyElders++;
}
console.log('living elders:', elders, '| with an activity:', busyElders, '| with NOTHING:', idleElders);
console.log('what elders are at:');
for (const [k, n] of [...doing.entries()].sort((a,b)=>b[1]-a[1])) console.log('   ', k.padEnd(24), n);

// And everybody, for comparison
const all = state.npcs.filter(n => n.status === 'alive');
const allIdle = all.filter(n => n.activity === null).length;
console.log('\nEVERYBODY alive:', all.length, '| doing nothing:', allIdle,
    `(${(100*allIdle/all.length).toFixed(0)}%)`);
