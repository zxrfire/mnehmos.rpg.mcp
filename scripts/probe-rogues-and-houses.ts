/**
 * The one claim in `audit-alive-world.ts` a pill economy could accidentally
 * undo: "rogue cultivators aren't rare but high level ones are. even above
 * something like 29 is crazy rare".
 *
 * The audit runs one seed and bars more than two. One seed is not a
 * distribution, and the before-figure was zero unbacked above ordinal THIRTEEN,
 * which is a claim holding because nobody unbacked was anywhere rather than
 * because the top was thin. So this runs the same measurement over several
 * seeds and prints the backed / unbacked split at every band, plus how many
 * houses are still standing - because the share of the world that carries no
 * house is decided by how many houses there are to carry.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
const SEEDS = ['alive-audit', 'population-shape', 'rogues-a', 'rogues-b', 'rogues-c'];

console.log('AFTER 300 YEARS, BY SEED');
console.log('  ' + 'seed'.padEnd(18) + 'living'.padStart(8) + 'rogue%'.padStart(8)
    + 'houses'.padStart(8)
    + '  |  unbacked / backed above  13'.padEnd(32) + '21'.padStart(9) + '29'.padStart(9));

for (const seed of SEEDS) {
    let { state } = seedWorld({ seed, catalog });
    state = advanceWorldYears(state, 300).state;
    const living = state.npcs.filter(n => n.status === 'alive');
    const rogues = living.filter(n => !n.factionId);
    const backed = living.filter(n => n.factionId);
    const above = (p: typeof living, n: number) => p.filter(x => x.cultivation.realmOrdinal > n).length;
    const houses = state.factions.filter(f => f.dissolvedOnDay === null).length;
    const cell = (n: number) => `${above(rogues, n)}/${above(backed, n)}`;
    console.log('  ' + seed.padEnd(18) + String(living.length).padStart(8)
        + `${Math.round(100 * rogues.length / living.length)}%`.padStart(8)
        + String(houses).padStart(8)
        + '  |  '.padEnd(29) + cell(13).padStart(9) + cell(21).padStart(9) + cell(29).padStart(9));
}
