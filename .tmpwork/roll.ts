import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { getMembersOf, MEMBERS } from '../src/data/cultivation/members.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'roll-a', catalog });

console.log('authored MEMBERS rows:', MEMBERS.length);
console.log('world npcs alive:', state.npcs.filter(n => n.status === 'alive').length);

let authoredTotal = 0, worldTotal = 0, houses = 0, housesWithNoAuthored = 0;
for (const f of state.factions) {
    if (f.dissolvedOnDay !== null) continue;
    houses++;
    const authored = getMembersOf(f.id).length;
    const live = state.npcs.filter(n => n.factionId === f.id && n.status === 'alive').length;
    authoredTotal += authored;
    worldTotal += live;
    if (authored === 0) housesWithNoAuthored++;
}
console.log('houses:', houses);
console.log('  authored roll total :', authoredTotal, '| mean', (authoredTotal / houses).toFixed(1));
console.log('  live world roll     :', worldTotal, '| mean', (worldTotal / houses).toFixed(1));
console.log('  houses with NO authored members:', housesWithNoAuthored,
    `(${(100 * housesWithNoAuthored / houses).toFixed(0)}%)`);

// what the authored rows carry that a world row does not
const sample = MEMBERS[0] as Record<string, unknown>;
console.log('\nauthored member fields:', Object.keys(sample).join(', '));

// THE QUESTION THAT MATTERS: does the authored roll include the dead?
import { advanceWorldForPlay } from '../src/engine/world/driver.js';
advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });
const statusOf = new Map(state.npcs.map(n => [n.id, n.status]));
let onRoll = 0, dead = 0, unknown = 0, wrongHouse = 0;
for (const f of state.factions) {
    if (f.dissolvedOnDay !== null) continue;
    for (const m of getMembersOf(f.id)) {
        onRoll++;
        const st = statusOf.get(m.id);
        if (st === undefined) { unknown++; continue; }
        if (st !== 'alive') dead++;
        const npc = state.npcs.find(n => n.id === m.id);
        if (npc && npc.factionId !== f.id) wrongHouse++;
    }
}
console.log('\nAFTER 200 YEARS, the authored authority roll holds:');
console.log('  rows:', onRoll, '| DEAD:', dead, '| not in the world at all:', unknown,
    '| in a different house now:', wrongHouse);
console.log('  so', ((100 * (dead + unknown + wrongHouse)) / onRoll).toFixed(1) + '% of every deciding room is wrong');
