import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';
import { whoseThisIs } from '../src/engine/world/a-house-holds-its-own.js';

const catalog = await loadCultivationCatalog();

for (const seed of ['arm-a', 'arm-b', 'arm-c']) {
    const { state } = seedWorld({ seed, catalog });
    const before = state.objects.filter(o => o.possessorId !== null).length;
    advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });

    const houseIds = new Set(state.factions.map(f => f.id));
    let lent = 0;
    for (const o of state.objects) {
        const whose = whoseThisIs({
            ownerId: o.ownerId,
            possessorId: o.possessorId,
            houseIds,
            provenance: o.provenance
        });
        if (whose === 'lent_by_their_house') lent++;
    }
    const armings = state.history.facts.filter(f =>
        typeof f.summary === 'string' && f.summary.includes('armed its own')).length;

    console.log(
        seed,
        '| possessed before:', String(before).padStart(4),
        '| armings:', String(armings).padStart(3),
        '| things now lent by a house:', String(lent).padStart(4)
    );
}
