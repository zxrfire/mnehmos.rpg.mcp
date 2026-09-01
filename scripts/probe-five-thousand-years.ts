/**
 * At five thousand years, is anybody still standing at the top?
 *
 * The bar, stated by the designer: lifespan at Tribulation Transcendence is a
 * hundred thousand years, so a world five thousand years old should still hold
 * at least one person up there. Variance over millions of years is fine; an
 * empty apex at 5k is not, because nobody up there should have died of age yet.
 *
 * So this asks the question at 5k across several seeds, and - when the apex is
 * gone - asks WHAT KILLED THEM, since old age cannot be the answer.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
console.log('seed'.padEnd(8) + 'at 41+'.padStart(8) + 'at 37+'.padStart(8)
    + 'at 29+'.padStart(8) + 'top'.padStart(6) + '   how the high ones ended');
let empties = 0;
for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    let { state } = seedWorld({ seed: `5k-${seed}`, catalog });
    const highAtSeeding = new Set(state.npcs
        .filter(n => n.cultivation.realmOrdinal >= 37).map(n => n.id));
    state = advanceWorldYears(state, 5000).state;

    const alive = state.npcs.filter(n => n.status === 'alive');
    const at = (n: number) => alive.filter(p => p.cultivation.realmOrdinal >= n).length;
    const top = alive.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);

    const causes = new Map<string, number>();
    for (const n of state.npcs) {
        if (!highAtSeeding.has(n.id) || n.status === 'alive') continue;
        const c = String((n as any).deathCause ?? n.status ?? 'unknown');
        causes.set(c, (causes.get(c) ?? 0) + 1);
    }
    if (at(41) === 0) empties++;
    console.log(seed.padEnd(8) + String(at(41)).padStart(8) + String(at(37)).padStart(8)
        + String(at(29)).padStart(8) + String(top).padStart(6) + '   '
        + ([...causes].map(([k, v]) => `${k} x${v}`).join(', ') || 'none died'));
}
console.log(`\n  worlds with NOBODY at Tribulation Transcendence after 5,000 years: ${empties} of 5`);
console.log(empties === 0
    ? '  The apex survives five millennia, which a hundred-thousand-year lifespan says it should.'
    : '  The apex is being emptied by something other than age, and that is the thing to find.');
