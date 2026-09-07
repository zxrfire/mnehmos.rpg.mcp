import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'move-a', catalog });
const before = new Map(state.npcs.map(n => [n.id, n.locationId]));
advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });

let moved = 0, alive = 0, stayed = 0;
for (const n of state.npcs) {
    if (n.status !== 'alive') continue;
    alive++;
    const was = before.get(n.id);
    if (was === undefined) continue;      // born during the span
    if (was !== n.locationId) moved++; else stayed++;
}
console.log('alive after 200y:', alive, '| of those present at the start:',
    moved + stayed, '| moved:', moved, '| never moved:', stayed);

// Who is out right now, and where are they?
const out = state.npcs.filter(n => n.status === 'alive' && n.activity?.kind === 'mustering');
console.log('away on a sending at this instant:', out.length);
const seats = new Set(state.factions.map(f => f.seatLocationId));
const notAtASeat = state.npcs.filter(n =>
    n.status === 'alive' && n.factionId && n.locationId && !seats.has(n.locationId)).length;
const inAHouse = state.npcs.filter(n => n.status === 'alive' && n.factionId).length;
console.log('house members standing somewhere other than a seat:', notAtASeat, 'of', inAHouse);
const places = new Set(state.npcs.filter(n => n.status === 'alive').map(n => n.locationId));
console.log('distinct places holding somebody alive:', places.size);
