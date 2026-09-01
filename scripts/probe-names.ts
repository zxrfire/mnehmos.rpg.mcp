import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'names', catalog });
const show = (k: string) => (state.locations as any[]).filter(l => l.kind === k).map(l => l.name);
console.log('ruins:', show('ruin').join('  |  '));
console.log('scars:', show('scar').join('  |  '));
const bad = [...show('ruin'), ...show('scar')].filter(n => /compound|scar|ruin/i.test(n));
console.log(bad.length === 0 ? '\nNo place is named after its own kind.' : `\nSTILL GENERIC: ${bad.join(', ')}`);
