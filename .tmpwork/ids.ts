import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { getMembersOf, MEMBERS } from '../src/data/cultivation/members.js';

const { state } = seedWorld({ seed: 'roll-a', catalog: await loadCultivationCatalog() });
console.log('authored ids :', MEMBERS.slice(0, 3).map(m => m.id).join(', '));
const worldMembers = state.npcs.filter(n => n.id.includes('member'));
console.log('world ids    :', worldMembers.slice(0, 3).map(n => n.id).join(', '));

const worldIds = new Set(state.npcs.map(n => n.id));
let exact = 0, prefixed = 0;
for (const m of MEMBERS) {
    if (worldIds.has(m.id)) exact++;
    else if (worldIds.has(`npc-${m.id}`)) prefixed++;
}
console.log('\nauthored rows:', MEMBERS.length,
    '| id matches the world exactly:', exact,
    '| matches only with an npc- prefix:', prefixed);
