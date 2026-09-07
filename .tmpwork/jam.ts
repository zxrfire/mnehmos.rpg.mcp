import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';
import { assessPromotions } from '../src/engine/world/promotion-inside-a-house.js';

const catalog = await loadCultivationCatalog();
for (const seed of ['jam-a', 'jam-b']) {
    const { state } = seedWorld({ seed, catalog });
    advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });
    const { promotions, blocked } = assessPromotions(state);
    const members = state.npcs.filter(n => n.status === 'alive' && n.factionId).length;
    const noSeat = blocked.filter(b => b.reason === 'no_seat').length;
    const outranked = blocked.filter(b => b.reason === 'outranked').length;
    console.log(seed,
        '| house members alive:', String(members).padStart(4),
        '| promotions this pass:', String(promotions.length).padStart(3),
        '| blocked:', String(blocked.length).padStart(4),
        `(no_seat ${noSeat}, outranked ${outranked})`);
    console.log('     -> of everybody who MET the bar,',
        ((100 * blocked.length) / Math.max(1, blocked.length + promotions.length)).toFixed(1) + '% cannot be raised');
}
