import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'move-a', catalog });
const alive = state.npcs.filter(n => n.status === 'alive');
const unaffiliated = alive.filter(n => n.factionId === null);
console.log('alive at seed:', alive.length);
console.log('  unaffiliated (the only ones migration can move):', unaffiliated.length,
    `(${(100 * unaffiliated.length / alive.length).toFixed(1)}%)`);
console.log('  in a house (never move):', alive.length - unaffiliated.length,
    `(${(100 * (alive.length - unaffiliated.length) / alive.length).toFixed(1)}%)`);
