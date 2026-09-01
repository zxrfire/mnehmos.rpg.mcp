/**
 * Is a house shaped like a pyramid, and does it stay that way?
 *
 * `factionRankIndex` was written at seeding and never advanced, so the ranks
 * inverted into a slab - 340 of 364 house members at rank 0 by year 500 - and
 * because rank decides how far up a shelf somebody reaches, nobody alive held a
 * manual past ordinal 17. This walks the world and reports the rank histogram,
 * the book ceilings it produces, and how many people are STUCK: qualified for
 * the next rank and unable to have it because the seats above them are full.
 *
 * The last number is the one the setting runs on. Somebody who has outgrown
 * their house and cannot rise inside it has one move left, and it is to leave.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { manualCeilingOf } from '../src/engine/world/manuals.js';
import { assessPromotions } from '../src/engine/world/promotion-inside-a-house.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'pyramid-probe', catalog });

function report(label: string): void {
    const inHouse = state.npcs.filter(n => n.status === 'alive' && n.factionId && n.factionRankIndex >= 0);
    const ranks = new Map<number, number>();
    for (const n of inHouse) ranks.set(n.factionRankIndex, (ranks.get(n.factionRankIndex) ?? 0) + 1);
    const ceilings = new Map<number, number>();
    for (const n of inHouse) { const c = manualCeilingOf(n); ceilings.set(c, (ceilings.get(c) ?? 0) + 1); }
    const { blocked } = assessPromotions(state);
    const noSeat = blocked.filter(b => b.reason === 'no_seat').length;
    console.log(`${label.padEnd(9)} in a house ${String(inHouse.length).padStart(4)}`
        + `   ranks {${[...ranks].sort((a, b) => a[0] - b[0]).map(([r, n]) => `${r}:${n}`).join(', ')}}`);
    console.log(`${''.padEnd(9)} book ceilings {${[...ceilings].sort((a, b) => a[0] - b[0])
        .map(([c, n]) => `${c}:${n}`).join(', ')}}`);
    console.log(`${''.padEnd(9)} blocked ${blocked.length} (no seat above them: ${noSeat})`);
    console.log();
}

report('seeding');
for (const [label, step] of [['50y', 50], ['150y', 100], ['300y', 150], ['500y', 200]] as const) {
    state = advanceWorldYears(state, step).state;
    report(label);
}
