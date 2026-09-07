import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
for (const seed of ['d-a', 'd-b']) {
    const { state } = seedWorld({ seed, catalog });
    const before = state.npcs.filter(n => n.status !== 'alive').length;
    advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });
    const dead = state.npcs.filter(n => n.status !== 'alive');

    // An inherited account is a relationship carrying an inheritedFromId.
    let inheritedTies = 0;
    for (const n of state.npcs) {
        for (const r of n.relationships) if (r.inheritedFromId) inheritedTies++;
    }
    let inheritedGoals = 0;
    for (const n of state.npcs) {
        for (const g of n.goals) if ((g as { inheritedFromId?: string }).inheritedFromId) inheritedGoals++;
    }
    console.log(seed,
        '| dead over the span:', String(dead.length - before).padStart(4),
        '| inherited ties:', String(inheritedTies).padStart(4),
        '| inherited goals:', String(inheritedGoals).padStart(3));
}
