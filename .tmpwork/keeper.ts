import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
for (const seed of ['keep-a', 'keep-b']) {
    const { state } = seedWorld({ seed, catalog });
    advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });
    const notices = state.history.facts.filter(f => f.summary.includes('The hall has started asking'));
    const away = state.npcs.filter(n => n.status === 'alive' && n.activity?.kind === 'mustering'
        && typeof n.activity.untilDay === 'number').length;
    const missing = state.npcs.filter(n => n.status !== 'alive' && n.status !== 'physically_dead').length;
    console.log(seed,
        '| keeper notices over 200y:', String(notices.length).padStart(3),
        '| out right now:', String(away).padStart(3),
        '| not-alive-not-dead:', String(missing).padStart(3));
    if (notices.length) console.log('     e.g.', notices[0].summary.slice(0, 110));
}
