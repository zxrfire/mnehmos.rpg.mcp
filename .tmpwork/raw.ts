import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';
const { state } = seedWorld({ seed: 'brk-a', catalog: await loadCultivationCatalog() });
advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });
const g = state.history.facts.filter(f => f.kind === 'gathering');
console.log('gathering facts:', g.length);
for (const f of g.slice(0, 2)) {
    console.log('---', String(f.summary).slice(0, 80));
    console.log('   placings raw:', JSON.stringify((f.data as Record<string, unknown>)?.placings).slice(0, 300));
}
