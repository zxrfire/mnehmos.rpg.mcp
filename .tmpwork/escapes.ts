import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
for (const seed of ['esc-a', 'esc-b']) {
    const { state } = seedWorld({ seed, catalog });
    advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });
    const slips = state.objects.filter(o => o.tags.includes('talisman'));
    const escapes = slips.filter(o => o.tags.includes('escape'));
    const burned = slips.filter(o => o.data?.spent === true);
    const held = slips.filter(o => o.possessorId !== null && o.data?.spent !== true);
    console.log(seed,
        '| slips:', String(slips.length).padStart(4),
        '| escape slips:', String(escapes.length).padStart(3),
        '| held by somebody:', String(held.length).padStart(3),
        '| burned:', String(burned.length).padStart(3));
}
