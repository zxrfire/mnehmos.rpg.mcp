import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldForPlay } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'sent-a', catalog });
advanceWorldForPlay(state, { days: 200 * 365, stopOnInterrupt: false });
const alive = state.npcs.filter(n => n.status === 'alive');
const out = alive.filter(n => n.activity?.kind === 'out_with_a_party');
const st = alive.filter(n => n.activity?.kind === 'stationed');
console.log('alive', alive.length, '| out_with_a_party', out.length, '| stationed', st.length,
  '| busy', alive.filter(n => n.activity !== null).length);
const seats = new Set(state.factions.map(f => f.seatLocationId));
const atSeat = st.filter(n => seats.has(n.locationId));
console.log('stationed AT a seat (should be 0):', atSeat.length,
  atSeat.slice(0,2).map(n => n.locationId).join(', '));
