import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
for (const seed of ['bst-a', 'bst-b']) {
    const { state } = seedWorld({ seed, catalog });
    advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });
    const came = state.history.facts.filter(f => f.summary.includes('came down on'));
    const held = came.filter(f => f.summary.includes('was put back'));
    const stationed = state.npcs.filter(n => n.status === 'alive' && n.activity?.kind === 'stationed');
    const idle = state.npcs.filter(n => n.status === 'alive' && n.activity === null).length;
    const alive = state.npcs.filter(n => n.status === 'alive').length;
    console.log(seed,
        '| beasts came down:', String(came.length).padStart(3),
        '(held', held.length + ',', 'not', came.length - held.length + ')',
        '| stationed now:', String(stationed.length).padStart(3),
        '| idle:', `${idle}/${alive}`, `(${(100*idle/alive).toFixed(0)}%)`);
    if (came.length) console.log('    e.g.', String(came[0].summary).slice(0, 110));
}
