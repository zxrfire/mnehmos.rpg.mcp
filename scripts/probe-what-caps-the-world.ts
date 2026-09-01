/**
 * What is actually stopping the world's middle bands - the book, the province,
 * or the ladder itself?
 *
 * `probe-population-shape.ts` says Foundation through Void Refinement all reach
 * zero across five centuries. `probe-pill-affordability.ts` says the life walk
 * on its own produces Foundation at one in thirty-nine, which is the lore
 * figure - so the walk is not the thing failing, and the difference has to be
 * in what the world hands the walk.
 *
 * `applyAdvancement` in `the-world-changing-on-its-own.ts` passes exactly three
 * things the walk cares about: an age, a region rate, and a ceiling that is the
 * lesser of the province's and the book's. This prints all three for everybody
 * alive, so the binding one is visible rather than argued about.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { manualCeilingOf, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'population-shape', catalog });

function report(label: string) {
    const alive = state.npcs.filter(n => n.status === 'alive' && isBelowTheLid(n));
    const rows = alive.map(npc => {
        const regionTag = npc.tags.find(t => t.startsWith('region:'))?.slice(7);
        const region = state.locations.find(
            l => l.kind === 'region' && isBelowTheLid(l) &&
                String(l.data.catalogRegionId ?? '') === regionTag
        ) ?? state.locations.find(l => l.id === npc.locationId);
        const regionCeiling = Number(region?.data.localCeilingOrdinal ?? 20);
        const manual = manualCeilingOf(npc) || BOOKLESS_CEILING;
        return {
            ordinal: npc.cultivation.realmOrdinal,
            regionCeiling,
            manual,
            ceiling: Math.min(regionCeiling, manual),
            books: npc.cultivation.techniqueIds.length,
            age: Math.floor((state.currentDay - npc.identity.bornOnDay) / 365)
        };
    });

    const q = (xs: number[], p: number) => {
        const s = [...xs].sort((a, b) => a - b);
        return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
    };
    const manuals = rows.map(r => r.manual);
    const regions = rows.map(r => r.regionCeiling);
    const ceilings = rows.map(r => r.ceiling);

    console.log(`\n── ${label} - ${rows.length} alive below the Lid`);
    console.log('  ' + 'quantity'.padEnd(20) + 'p10'.padStart(6) + 'median'.padStart(8)
        + 'p90'.padStart(6) + 'max'.padStart(6));
    for (const [name, xs] of [
        ['manual ceiling', manuals], ['province ceiling', regions],
        ['effective ceiling', ceilings], ['ordinal held', rows.map(r => r.ordinal)],
        ['books held', rows.map(r => r.books)]
    ] as [string, number[]][]) {
        console.log('  ' + name.padEnd(20) + String(q(xs, 0.1)).padStart(6)
            + String(q(xs, 0.5)).padStart(8) + String(q(xs, 0.9)).padStart(6)
            + String(Math.max(...xs, 0)).padStart(6));
    }

    // Who is capped by which. The one that matters.
    const bookBound = rows.filter(r => r.manual < r.regionCeiling).length;
    const provinceBound = rows.filter(r => r.regionCeiling < r.manual).length;
    const atCeiling = rows.filter(r => r.ordinal >= r.ceiling).length;
    const bookless = rows.filter(r => r.books === 0).length;
    console.log(`  book is the binding ceiling for ${bookBound}, the province for ${provinceBound}`);
    console.log(`  already standing at their ceiling: ${atCeiling}`);
    console.log(`  holding no book at all: ${bookless} (ceiling ${BOOKLESS_CEILING})`);
    const canReach13 = rows.filter(r => r.ceiling >= 13).length;
    const canReach17 = rows.filter(r => r.ceiling >= 17).length;
    console.log(`  ceiling permits Foundation (13+): ${canReach13}`);
    console.log(`  ceiling permits Core Formation (17+): ${canReach17}`);
}

report('seeding');
for (const [label, step] of [['50y', 50], ['150y', 100], ['300y', 150], ['500y', 200]] as const) {
    state = advanceWorldYears(state, step).state;
    report(label);
}
