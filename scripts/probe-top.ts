/**
 * Why does the high band empty instead of turning over?
 *
 * Two candidate constraints and they want different fixes: either nobody HOLDS
 * a book that reaches the high band, or they hold one and the life walk cannot
 * get them there. Ask which.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { manualCeilingOf } from '../src/engine/world/manuals.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'drift-audit', catalog });
const report = (label: string, s: any) => {
    const alive = (s.npcs as any[]).filter(n => n.status === 'alive');
    const band = (lo: number) => alive.filter(n => n.cultivation.realmOrdinal >= lo).length;
    const canReach = (lo: number) => alive.filter(n => manualCeilingOf(n) >= lo).length;
    const chosen = alive.filter(n => n.tags.includes('chosen'));
    console.log(`${label.padEnd(10)} living ${String(alive.length).padStart(5)}`
        + `   at 30+: ${String(band(30)).padStart(3)}   at 20+: ${String(band(20)).padStart(4)}`
        + `   hold a book reaching 30+: ${String(canReach(30)).padStart(4)}`
        + `   reaching 20+: ${String(canReach(20)).padStart(4)}`
        + `   chosen alive: ${String(chosen.length).padStart(3)}`);
};
report('seeding', state);
for (const step of [50, 150, 300, 500]) {
    state = advanceWorldYears(state, step === 50 ? 50 : step === 150 ? 100 : step === 300 ? 150 : 200).state;
    report(`${step}y`, state);
}
