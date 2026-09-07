import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'prest-a', catalog });
advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });

const gatherings = state.history.facts.filter(f => f.kind === 'gathering');
console.log('gathering facts over 200y:', gatherings.length);
const chosen = state.npcs.filter(n => n.status === 'alive' && n.tags.includes('chosen'));
console.log('people tagged `chosen` right now:', chosen.length,
    'of', state.npcs.filter(n => n.status === 'alive').length, 'alive');

// Does ANY npc record carry a placing / a win?
const fields = new Set<string>();
for (const n of state.npcs.slice(0, 5)) for (const k of Object.keys(n)) fields.add(k);
console.log('NpcRecord fields:', [...fields].join(', '));

// what a gathering fact carries
const g = gatherings[0];
if (g) {
    console.log('\na gathering fact data keys:', Object.keys(g.data ?? {}).join(', '));
    console.log('summary:', String(g.summary).slice(0, 140));
}
